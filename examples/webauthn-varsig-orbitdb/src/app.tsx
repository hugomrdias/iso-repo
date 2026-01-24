import { useRef, useState } from 'react'
import { DIDKey } from 'iso-did'
import { parseAttestationObject, unwrapEC2Signature } from 'iso-passkeys'
import {
  CURVE_ED25519,
  CURVE_P256,
  INNER_EDDSA,
  INNER_ECDSA,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  PAYLOAD_ENCODING_RAW,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  WEBAUTHN_WRAPPER,
  base64urlToBytes,
  bytesToBase64url,
  concat,
  decodeWebAuthnVarsigV1,
  encodeWebAuthnVarsigV1,
  parseClientDataJSON,
  reconstructSignedData,
  varintEncode,
  verifyEd25519Signature,
  verifyP256Signature,
  verifyWebAuthnAssertion,
} from 'iso-webauthn-varsig'

const encoder = new TextEncoder()
const STORAGE_KEY = 'webauthn-varsig-demo-credential'
const STORAGE_KEY_PUBLIC = 'webauthn-varsig-demo-public-key'
const STORAGE_KEY_DID = 'webauthn-varsig-demo-did'
const STORAGE_KEY_META = 'webauthn-varsig-demo-meta'
const STORAGE_KEY_ORBITDB_IDENTITY = 'webauthn-varsig-orbitdb-identity'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function toHexSpaced(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(' ')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function buildChallengeBytes(domainLabel: string, payloadBytes: Uint8Array) {
  const domain = encoder.encode(domainLabel)
  return crypto.subtle
    .digest('SHA-256', concat([domain, payloadBytes]))
    .then((hash) => new Uint8Array(hash))
}

async function runWebAuthnAssertionForPayload(
  payloadBytes: Uint8Array,
  domainLabel: string
) {
  const rpId = window.location.hostname
  const origin = window.location.origin
  const challengeBytes = await buildChallengeBytes(domainLabel, payloadBytes)
  const challenge = bytesToBase64url(challengeBytes)

  const stored = loadStoredCredential()
  if (!stored) {
    throw new Error('No stored passkey. Register first.')
  }
  const { credentialId, publicKey, did, cose, algorithm } = stored
  const assertion = (await navigator.credentials.get({
    publicKey: {
      rpId,
      challenge: challengeBytes,
      allowCredentials: [
        {
          type: 'public-key',
          id: toArrayBuffer(credentialId),
        },
      ],
      userVerification: 'preferred',
    },
  })) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('Passkey authentication failed.')
  }

  const response = assertion.response as AuthenticatorAssertionResponse

  return {
    rpId,
    origin,
    challenge,
    challengeBytes,
    publicKey,
    did,
    cose,
    algorithm,
    assertion: {
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJSON: new Uint8Array(response.clientDataJSON),
      signature: new Uint8Array(response.signature),
    },
  }
}

async function buildVarsigOutput(
  assertionData: Awaited<ReturnType<typeof runWebAuthnAssertionForPayload>>
) {
  const { assertion, algorithm, origin, rpId, challengeBytes, publicKey } =
    assertionData
  const varsig = encodeWebAuthnVarsigV1(assertion, algorithm)
  const decoded = decodeWebAuthnVarsigV1(varsig)
  const clientData = parseClientDataJSON(decoded.clientDataJSON)

  const verification = await verifyWebAuthnAssertion(decoded, {
    expectedOrigin: origin,
    expectedRpId: rpId,
    expectedChallenge: challengeBytes,
  })

  const signedData = await reconstructSignedData(decoded)
  const signatureValid =
    algorithm === 'Ed25519'
      ? await verifyEd25519Signature(signedData, decoded.signature, publicKey)
      : await verifyP256Signature(
          signedData,
          unwrapEC2Signature(decoded.signature),
          publicKey
        )

  return {
    varsig,
    decoded,
    clientData,
    verification,
    signedData,
    signatureValid,
  }
}

async function createMockAssertion() {
  const rpId = window.location.hostname
  const origin = window.location.origin

  const challengeBytes = crypto.getRandomValues(new Uint8Array(32))
  const challenge = bytesToBase64url(challengeBytes)
  const payloadBytes = encoder.encode('demo-payload')

  const clientDataJSON = encoder.encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge,
      origin,
      crossOrigin: false,
    })
  )

  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(rpId))
  )

  const flags = 0x01 | 0x04
  const signCount = 1
  const signCountBytes = new Uint8Array([
    (signCount >> 24) & 0xff,
    (signCount >> 16) & 0xff,
    (signCount >> 8) & 0xff,
    signCount & 0xff,
  ])

  const authenticatorData = new Uint8Array(37)
  authenticatorData.set(rpIdHash, 0)
  authenticatorData[32] = flags
  authenticatorData.set(signCountBytes, 33)

  const signature = crypto.getRandomValues(new Uint8Array(64))

  return {
    rpId,
    origin,
    challenge,
    challengeBytes,
    payloadBytes,
    assertion: {
      authenticatorData,
      clientDataJSON,
      signature,
    },
  }
}

function createMockP256Signature(): Uint8Array {
  const r = new Uint8Array(32)
  const s = new Uint8Array(32)

  for (let i = 0; i < 32; i++) {
    r[i] = (i * 5 + 11) % 256
    s[i] = (i * 7 + 13) % 256
  }

  const signature = new Uint8Array(6 + 32 + 32)
  signature[0] = 0x30
  signature[1] = 68
  signature[2] = 0x02
  signature[3] = 32
  signature.set(r, 4)
  signature[36] = 0x02
  signature[37] = 32
  signature.set(s, 38)

  return signature
}

async function createMockAssertionForAlgorithm(algorithm: 'Ed25519' | 'P-256') {
  const base = await createMockAssertion()
  if (algorithm === 'Ed25519') {
    return base
  }

  return {
    ...base,
    assertion: {
      ...base.assertion,
      signature: createMockP256Signature(),
    },
  }
}

async function extractCredentialInfo(
  attestationObject: Uint8Array
): Promise<{
  algorithm: 'Ed25519' | 'P-256' | null
  publicKey: Uint8Array | null
  kty?: number
  alg?: number
  crv?: number
}> {
  const parsed = parseAttestationObject(attestationObject.buffer as ArrayBuffer)
  const coseKey = parsed.authData.credentialPublicKey

  if (!coseKey) {
    throw new Error('Credential public key missing from attestation')
  }

  const getValue = (key: number) =>
    coseKey instanceof Map ? coseKey.get(key) : coseKey[key]

  const kty = getValue(1)
  const alg = getValue(3)
  const crv = getValue(-1)

  if (kty === 1 && (alg === -50 || alg === -8) && crv === 6) {
    const publicKeyBytes = new Uint8Array(getValue(-2))
    if (publicKeyBytes.length !== 32) {
      throw new Error(
        `Invalid Ed25519 public key length: ${publicKeyBytes.length}`
      )
    }

    return { algorithm: 'Ed25519', publicKey: publicKeyBytes, kty, alg, crv }
  }

  if (kty === 2 && alg === -7 && crv === 1) {
    const x = new Uint8Array(getValue(-2))
    const y = new Uint8Array(getValue(-3))
    if (x.length !== 32 || y.length !== 32) {
      throw new Error(
        `Invalid P-256 coordinate length: x=${x.length} y=${y.length}`
      )
    }

    const publicKeyBytes = new Uint8Array(65)
    publicKeyBytes[0] = 0x04
    publicKeyBytes.set(x, 1)
    publicKeyBytes.set(y, 33)
    return { algorithm: 'P-256', publicKey: publicKeyBytes, kty, alg, crv }
  }

  return { algorithm: null, publicKey: null, kty, alg, crv }
}

function loadStoredCredential() {
  const stored = localStorage.getItem(STORAGE_KEY)
  const storedPublicKey = localStorage.getItem(STORAGE_KEY_PUBLIC)
  const storedDid = localStorage.getItem(STORAGE_KEY_DID)
  const storedMeta = localStorage.getItem(STORAGE_KEY_META)
  if (stored && storedPublicKey && storedDid && storedMeta) {
    const meta = JSON.parse(storedMeta) as {
      algorithm: 'Ed25519' | 'P-256'
      kty?: number
      alg?: number
      crv?: number
    }
    return {
      credentialId: base64urlToBytes(stored),
      publicKey: base64urlToBytes(storedPublicKey),
      did: storedDid,
      cose: { kty: meta.kty, alg: meta.alg, crv: meta.crv },
      algorithm: meta.algorithm,
    }
  }
  return null
}

type OrbitDbIdentity = {
  id: string
  did: string
  publicKey: Uint8Array
  algorithm: 'Ed25519' | 'P-256'
  signatures: {
    id: Uint8Array
    publicKey: Uint8Array
  }
}

function loadStoredIdentity(): OrbitDbIdentity | null {
  const stored = localStorage.getItem(STORAGE_KEY_ORBITDB_IDENTITY)
  if (!stored) {
    return null
  }
  const parsed = JSON.parse(stored) as {
    id: string
    did: string
    publicKey: string
    algorithm: 'Ed25519' | 'P-256'
    signatures: { id: string; publicKey: string }
  }
  return {
    id: parsed.id,
    did: parsed.did,
    publicKey: base64urlToBytes(parsed.publicKey),
    algorithm: parsed.algorithm,
    signatures: {
      id: base64urlToBytes(parsed.signatures.id),
      publicKey: base64urlToBytes(parsed.signatures.publicKey),
    },
  }
}

function storeIdentity(identity: OrbitDbIdentity) {
  localStorage.setItem(
    STORAGE_KEY_ORBITDB_IDENTITY,
    JSON.stringify({
      id: identity.id,
      did: identity.did,
      publicKey: bytesToBase64url(identity.publicKey),
      algorithm: identity.algorithm,
      signatures: {
        id: bytesToBase64url(identity.signatures.id),
        publicKey: bytesToBase64url(identity.signatures.publicKey),
      },
    })
  )
}

async function registerCredential() {
  const cached = loadStoredCredential()
  if (cached) {
    return cached
  }

  const publicKey: PublicKeyCredentialCreationOptions['publicKey'] = {
    rp: { name: 'iso-webauthn-varsig', id: window.location.hostname },
    user: {
      id: crypto.getRandomValues(new Uint8Array(16)),
      name: 'demo@example.com',
      displayName: 'Varsig Demo',
    },
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams: [
      { type: 'public-key', alg: -50 },
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
    ],
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  }

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null

  if (!credential) {
    throw new Error('Passkey registration failed.')
  }

  const response = credential.response as AuthenticatorAttestationResponse
  const { algorithm, publicKey: publicKeyBytes, kty, alg, crv } =
    await extractCredentialInfo(
      new Uint8Array(response.attestationObject)
    )

  if (!publicKeyBytes || !algorithm) {
    throw new Error(
      'No supported credential returned (expected Ed25519 or P-256)'
    )
  }

  const rawId = new Uint8Array(credential.rawId)
  const encoded = bytesToBase64url(rawId)
  const encodedPublicKey = bytesToBase64url(publicKeyBytes)
  const did = DIDKey.fromPublicKey(algorithm, publicKeyBytes).did
  localStorage.setItem(STORAGE_KEY, encoded)
  localStorage.setItem(STORAGE_KEY_PUBLIC, encodedPublicKey)
  localStorage.setItem(STORAGE_KEY_DID, did)
  localStorage.setItem(
    STORAGE_KEY_META,
    JSON.stringify({ algorithm, kty, alg, crv })
  )
  return {
    credentialId: rawId,
    publicKey: publicKeyBytes,
    did,
    cose: { kty, alg, crv },
    algorithm,
  }
}

async function runWebAuthnAssertion() {
  const payload = { scope: 'webauthn-varsig-demo', ts: Date.now() }
  const payloadText = JSON.stringify(payload)
  const payloadBytes = encoder.encode(payloadText)

  const assertionData = await runWebAuthnAssertionForPayload(
    payloadBytes,
    'ucan-webauthn-v1:'
  )

  return {
    ...assertionData,
    payloadBytes,
    payloadText,
    payloadTs: payload.ts,
  }
}

async function createOrbitDbIdentity() {
  const stored = loadStoredCredential() ?? (await registerCredential())
  const id = stored.did
  const idBytes = encoder.encode(id)

  const idAssertion = await runWebAuthnAssertionForPayload(
    idBytes,
    'orbitdb-id:'
  )
  const idOutput = await buildVarsigOutput(idAssertion)

  const pubkeyPayload = concat([stored.publicKey, idOutput.varsig])
  const pubKeyAssertion = await runWebAuthnAssertionForPayload(
    pubkeyPayload,
    'orbitdb-pubkey:'
  )
  const pubKeyOutput = await buildVarsigOutput(pubKeyAssertion)

  const identity: OrbitDbIdentity = {
    id,
    did: stored.did,
    publicKey: stored.publicKey,
    algorithm: stored.algorithm,
    signatures: {
      id: idOutput.varsig,
      publicKey: pubKeyOutput.varsig,
    },
  }

  storeIdentity(identity)

  return { identity, idOutput, pubKeyOutput }
}

async function signOrbitDbRecord(payloadText: string) {
  const payloadBytes = encoder.encode(payloadText)
  const assertion = await runWebAuthnAssertionForPayload(
    payloadBytes,
    'orbitdb-record:'
  )
  const output = await buildVarsigOutput(assertion)

  return {
    payloadText,
    output,
  }
}

function buildVarsigHeader(algorithm: 'Ed25519' | 'P-256'): Uint8Array {
  const innerAlgorithm = algorithm === 'Ed25519' ? INNER_EDDSA : INNER_ECDSA
  const curve = algorithm === 'Ed25519' ? CURVE_ED25519 : CURVE_P256

  return concat([
    new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION]),
    varintEncode(innerAlgorithm),
    varintEncode(curve),
    varintEncode(MULTIHASH_SHA256),
    varintEncode(MULTIHASH_SHA256_LEN),
    varintEncode(WEBAUTHN_WRAPPER),
    varintEncode(PAYLOAD_ENCODING_RAW),
  ])
}

function buildHeaderParts(algorithm: 'Ed25519' | 'P-256') {
  const innerAlgorithm = algorithm === 'Ed25519' ? INNER_EDDSA : INNER_ECDSA
  const curve = algorithm === 'Ed25519' ? CURVE_ED25519 : CURVE_P256

  return [
    {
      label: 'Varsig prefix + version',
      value: toHexSpaced(new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION])),
      detail: '0x34 0x01',
    },
    {
      label: `Inner algorithm (${algorithm === 'Ed25519' ? 'EdDSA' : 'ECDSA'})`,
      value: toHexSpaced(varintEncode(innerAlgorithm)),
      detail: `0x${innerAlgorithm.toString(16)}`,
    },
    {
      label: `Curve (${algorithm === 'Ed25519' ? 'Ed25519' : 'P-256'})`,
      value: toHexSpaced(varintEncode(curve)),
      detail: `0x${curve.toString(16)}`,
    },
    {
      label: 'Multihash (SHA-256)',
      value: toHexSpaced(varintEncode(MULTIHASH_SHA256)),
      detail: `0x${MULTIHASH_SHA256.toString(16)}`,
    },
    {
      label: 'Multihash length',
      value: toHexSpaced(varintEncode(MULTIHASH_SHA256_LEN)),
      detail: `0x${MULTIHASH_SHA256_LEN.toString(16)}`,
    },
    {
      label: 'WebAuthn wrapper',
      value: toHexSpaced(varintEncode(WEBAUTHN_WRAPPER)),
      detail: `0x${WEBAUTHN_WRAPPER.toString(16)}`,
    },
    {
      label: 'Payload encoding (RAW)',
      value: toHexSpaced(varintEncode(PAYLOAD_ENCODING_RAW)),
      detail: `0x${PAYLOAD_ENCODING_RAW.toString(16)}`,
    },
  ]
}

export default function App() {
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(
    Boolean(loadStoredCredential())
  )
  const [orbitdbIdentity, setOrbitdbIdentity] = useState<OrbitDbIdentity | null>(
    loadStoredIdentity()
  )
  const [identityChecks, setIdentityChecks] = useState<null | {
    idValid: boolean
    publicKeyValid: boolean
    idVarsigHex: string
    publicKeyVarsigHex: string
  }>(null)
  const [recordText, setRecordText] = useState(
    'Hello OrbitDB! Signed with WebAuthn.'
  )
  const [records, setRecords] = useState<
    Array<{
      payloadText: string
      varsigHex: string
      verificationValid: boolean
      signatureValid: boolean
    }>
  >([])
  const [tsHover, setTsHover] = useState(false)
  const webauthnInFlight = useRef(false)
  const signAttemptRef = useRef(0)
  const [signAttempt, setSignAttempt] = useState(0)
  const [output, setOutput] = useState<null | {
    mode: 'mock' | 'webauthn'
    algorithm: 'Ed25519' | 'P-256'
    headerHex: string
    varsigHex: string
    decoded: ReturnType<typeof decodeWebAuthnVarsigV1>
    clientData: ReturnType<typeof parseClientDataJSON>
    verification: Awaited<ReturnType<typeof verifyWebAuthnAssertion>>
    signatureValid: boolean | null
    signedDataHex: string
    rpId: string
    origin: string
    challenge: string
    did?: string
    cose?: { kty?: number; alg?: number; crv?: number }
    challengeHex: string
    challengeOrigin: string
    payloadText?: string
    payloadTs?: number
    signAttempt?: number
  }>(null)
  const [error, setError] = useState<string | null>(null)

  const runDemo = async () => {
    setBusy(true)
    setError(null)

    try {
      const { assertion, challengeBytes, rpId, origin, challenge } =
        await createMockAssertionForAlgorithm('Ed25519')

      const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
      const decoded = decodeWebAuthnVarsigV1(varsig)
      const clientData = parseClientDataJSON(decoded.clientDataJSON)

      const verification = await verifyWebAuthnAssertion(decoded, {
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedChallenge: challengeBytes,
      })

      const signedData = await reconstructSignedData(decoded)
      const headerHex = toHex(buildVarsigHeader('Ed25519'))

      setOutput({
        mode: 'mock',
        algorithm: 'Ed25519',
        headerHex,
        varsigHex: toHex(varsig),
        decoded,
        clientData,
        verification,
        signatureValid: null,
        signedDataHex: toHex(signedData),
        rpId,
        origin,
        challenge,
        challengeHex: toHex(challengeBytes),
        challengeOrigin: 'Random (mock)',
        payloadText: undefined,
        payloadTs: undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runDemoP256 = async () => {
    setBusy(true)
    setError(null)

    try {
      const { assertion, challengeBytes, rpId, origin, challenge } =
        await createMockAssertionForAlgorithm('P-256')

      const varsig = encodeWebAuthnVarsigV1(assertion, 'P-256')
      const decoded = decodeWebAuthnVarsigV1(varsig)
      const clientData = parseClientDataJSON(decoded.clientDataJSON)

      const verification = await verifyWebAuthnAssertion(decoded, {
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedChallenge: challengeBytes,
      })

      const signedData = await reconstructSignedData(decoded)
      const headerHex = toHex(buildVarsigHeader('P-256'))

      setOutput({
        mode: 'mock',
        algorithm: 'P-256',
        headerHex,
        varsigHex: toHex(varsig),
        decoded,
        clientData,
        verification,
        signatureValid: null,
        signedDataHex: toHex(signedData),
        rpId,
        origin,
        challenge,
        challengeHex: toHex(challengeBytes),
        challengeOrigin: 'Random (mock)',
        payloadText: undefined,
        payloadTs: undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runRegister = async () => {
    setBusy(true)
    setError(null)

    try {
      await registerCredential()
      setRegistered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runOrbitDbIdentity = async () => {
    setBusy(true)
    setError(null)

    try {
      const { identity, idOutput, pubKeyOutput } =
        await createOrbitDbIdentity()
      setOrbitdbIdentity(identity)
      setRegistered(true)
      setIdentityChecks({
        idValid: Boolean(idOutput.verification.valid && idOutput.signatureValid),
        publicKeyValid: Boolean(
          pubKeyOutput.verification.valid && pubKeyOutput.signatureValid
        ),
        idVarsigHex: toHex(idOutput.varsig),
        publicKeyVarsigHex: toHex(pubKeyOutput.varsig),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runAddRecord = async () => {
    setBusy(true)
    setError(null)

    try {
      if (!orbitdbIdentity) {
        throw new Error('Create an OrbitDB identity first.')
      }
      const result = await signOrbitDbRecord(recordText)
      setRecords((prev) => [
        {
          payloadText: result.payloadText,
          varsigHex: toHex(result.output.varsig),
          verificationValid: result.output.verification.valid,
          signatureValid: Boolean(result.output.signatureValid),
        },
        ...prev,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runWebAuthn = async () => {
    if (webauthnInFlight.current) {
      return
    }
    webauthnInFlight.current = true
    signAttemptRef.current += 1
    setSignAttempt(signAttemptRef.current)
    console.log('[webauthn-demo] sign attempt', signAttemptRef.current)
    setBusy(true)
    setError(null)

    try {
      const assertionData = await runWebAuthnAssertion()
      const {
        rpId,
        origin,
        challenge,
        did,
        cose,
        algorithm,
        payloadText,
        payloadTs,
        challengeBytes,
      } = assertionData

      const outputDetails = await buildVarsigOutput(assertionData)
      const headerHex = toHex(buildVarsigHeader(algorithm))

      setOutput({
        mode: 'webauthn',
        algorithm,
        headerHex,
        varsigHex: toHex(outputDetails.varsig),
        decoded: outputDetails.decoded,
        clientData: outputDetails.clientData,
        verification: outputDetails.verification,
        signatureValid: outputDetails.signatureValid,
        signedDataHex: toHex(outputDetails.signedData),
        rpId,
        origin,
        challenge,
        did,
        cose,
        challengeHex: toHex(challengeBytes),
        challengeOrigin: `SHA-256("ucan-webauthn-v1:" || ${payloadText})`,
        payloadText,
        payloadTs,
        signAttempt: signAttemptRef.current,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      webauthnInFlight.current = false
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">iso-webauthn-varsig</p>
        <h1>WebAuthn Varsig + OrbitDB Identity Demo</h1>
        <p className="lede">
          This demo has two modes: mock data to visualize the varsig envelope,
          and real passkey flows that register, sign, and build a WebAuthn-backed
          OrbitDB identity without a separate browser keypair.
        </p>
      </header>

      <section className="explainer">
        <div className="card">
          <h2>Varsig Envelope</h2>
          <p>
            Varsig v1 wraps a WebAuthn assertion so UCAN tooling can carry
            hardware-backed signatures. The envelope is:
          </p>
          <ol>
            <li>
              Header: varsig prefix/version, algorithm metadata, multihash, and
              WebAuthn marker (all varints).
            </li>
            <li>authenticatorData length + bytes.</li>
            <li>clientDataJSON length + bytes.</li>
            <li>signature bytes (Ed25519 = 64 bytes, P-256 = DER).</li>
          </ol>
        </div>
        <div className="card">
          <h2>Decode Flow</h2>
          <ol>
            <li>Parse header and verify constants.</li>
            <li>Extract auth data + client data lengths.</li>
            <li>Recover assertion bytes and check WebAuthn metadata.</li>
            <li>Rebuild signed data and verify signature (real passkeys).</li>
          </ol>
        </div>
      </section>

      <section className="controls">
        <div className="control-group">
          <div className="group-label">Mock data (no passkey required)</div>
          <div className="button-row">
            <button
              type="button"
              onClick={runDemo}
              disabled={busy}
              className="button-mock"
            >
              {busy ? 'Running…' : 'Run mock Ed25519'}
            </button>
            <button
              type="button"
              onClick={runDemoP256}
              disabled={busy}
              className="button-mock"
            >
              {busy ? 'Running…' : 'Run mock P-256'}
            </button>
          </div>
        </div>
        <div className="control-group">
          <div className="group-label">Real passkey flow</div>
          <div className="button-row">
            <button
              type="button"
              onClick={runRegister}
              disabled={busy}
              className="button-real"
            >
              {busy
                ? 'Waiting…'
                : registered
                  ? 'Passkey registered'
                  : 'Register passkey (real device)'}
            </button>
            <button
              type="button"
              onClick={runWebAuthn}
              disabled={busy || !registered}
              className="button-real"
            >
              {busy ? 'Waiting…' : 'Sign with WebAuthn (real)'}
            </button>
          </div>
        </div>
        <p className="hint">Sign attempt: {signAttempt}</p>
        <p className="hint">
          The mock buttons generate fake WebAuthn data for Ed25519 or P-256.
          Register passkey uses the real WebAuthn API to create a credential on
          your device. Sign with WebAuthn uses that credential to sign
          (Ed25519 preferred, P-256 fallback).
        </p>
        <p className="hint">
          The WebAuthn path verifies Ed25519 or P-256 signatures using the
          extracted public key when supported by your authenticator.
        </p>
      </section>

      <section className="grid orbitdb">
        <div className="card">
          <h2>OrbitDB Identity (WebAuthn-only)</h2>
          <p>
            This flow mirrors OrbitDB identity signing, but it uses WebAuthn
            varsig directly (no extra browser keypair).
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={runOrbitDbIdentity}
              disabled={busy || !registered}
              className="button-real"
            >
              {busy ? 'Working…' : 'Create OrbitDB identity'}
            </button>
          </div>
          <label className="input-label" htmlFor="record-input">
            Record payload
          </label>
          <textarea
            id="record-input"
            className="record-input"
            rows={3}
            value={recordText}
            onChange={(event) => setRecordText(event.target.value)}
          />
          <div className="button-row">
            <button
              type="button"
              onClick={runAddRecord}
              disabled={busy || !orbitdbIdentity}
              className="button-real"
            >
              {busy ? 'Working…' : 'Sign record with WebAuthn'}
            </button>
          </div>
          <p className="hint">
            Identity signatures use passkey assertions over the DID and
            public-key binding payloads.
          </p>
        </div>

        <div className="card">
          <h2>Identity Details</h2>
          {orbitdbIdentity ? (
            <dl>
              <div>
                <dt>DID</dt>
                <dd className="mono">{orbitdbIdentity.did}</dd>
              </div>
              <div>
                <dt>Algorithm</dt>
                <dd>{orbitdbIdentity.algorithm}</dd>
              </div>
              <div>
                <dt>Public Key</dt>
                <dd className="mono">{toHex(orbitdbIdentity.publicKey)}</dd>
              </div>
              <div>
                <dt>ID Signature</dt>
                <dd className={identityChecks?.idValid ? 'ok' : 'bad'}>
                  {identityChecks?.idValid ? 'valid' : 'not verified'}
                </dd>
              </div>
              <div>
                <dt>Public Key Signature</dt>
                <dd className={identityChecks?.publicKeyValid ? 'ok' : 'bad'}>
                  {identityChecks?.publicKeyValid ? 'valid' : 'not verified'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="hint">
              Create an identity to capture the DID and varsig signatures.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Signed Records</h2>
          {records.length === 0 ? (
            <p className="hint">Sign a record to see varsig output.</p>
          ) : (
            <dl>
              {records.slice(0, 3).map((record, index) => (
                <div key={`${record.payloadText}-${index}`}>
                  <dt>Record {records.length - index}</dt>
                  <dd className="mono">{record.payloadText}</dd>
                  <dd className={record.signatureValid ? 'ok' : 'bad'}>
                    {record.signatureValid ? 'signature valid' : 'signature invalid'}
                  </dd>
                  <dd className="mono">
                    varsig: {record.varsigHex.slice(0, 64)}…
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {output ? (
        <section className="grid">
          <div className="card">
            <h2>Inputs</h2>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>{output.mode === 'webauthn' ? 'WebAuthn' : 'Mock'}</dd>
              </div>
              <div>
                <dt>Algorithm</dt>
                <dd>{output.algorithm}</dd>
              </div>
              {output.signAttempt ? (
                <div>
                  <dt>Sign Attempt</dt>
                  <dd>{output.signAttempt}</dd>
                </div>
              ) : null}
              <div>
                <dt>Origin</dt>
                <dd>{output.origin}</dd>
              </div>
              <div>
                <dt>RP ID</dt>
                <dd>{output.rpId}</dd>
              </div>
              <div>
                <dt>Challenge</dt>
                <dd className="mono">{output.challenge}</dd>
              </div>
              {output.did ? (
                <div>
                  <dt>DID Key</dt>
                  <dd className="mono">{output.did}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="card">
            <h2>COSE Key</h2>
            {output.cose ? (
              <dl>
                <div>
                  <dt>kty</dt>
                  <dd>{output.cose.kty ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>alg</dt>
                  <dd>{output.cose.alg ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt>crv</dt>
                  <dd>{output.cose.crv ?? 'n/a'}</dd>
                </div>
              </dl>
            ) : (
              <p className="hint">COSE metadata is captured during registration.</p>
            )}
          </div>

          <div className="card">
            <h2>Signed Challenge</h2>
            <p className="hint">
              This payload represents the message we want to sign (UCAN
              signature payload bytes).
            </p>
            <dl>
              <div>
                <dt>Challenge Origin</dt>
                <dd>{output.challengeOrigin}</dd>
              </div>
              {output.payloadText ? (
                <div>
                  <dt>Payload JSON</dt>
                  <dd className="mono">
                    {output.payloadText.split(`${output.payloadTs}`).map((part, index, parts) =>
                      index === parts.length - 1 ? (
                        // eslint-disable-next-line react/no-array-index-key
                        <span key={`${part}-${index}`}>{part}</span>
                      ) : (
                        // eslint-disable-next-line react/no-array-index-key
                        <span key={`${part}-${index}`}>
                          {part}
                          <span
                            className="ts-token"
                            onMouseEnter={() => setTsHover(true)}
                            onMouseLeave={() => setTsHover(false)}
                          >
                            {output.payloadTs}
                          </span>
                        </span>
                      )
                    )}
                  </dd>
                </div>
              ) : null}
              {output.payloadText ? (
                <div className={tsHover ? 'ts-source blink' : 'ts-source'}>
                  <dt>ts source</dt>
                  <dd>Date.now() at button click</dd>
                </div>
              ) : null}
              <div>
                <dt>Challenge (base64url)</dt>
                <dd className="mono">{output.challenge}</dd>
              </div>
              <div>
                <dt>Challenge (hex)</dt>
                <dd className="mono">{output.challengeHex}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2>Varsig Header</h2>
            <dl>
              <div>
                <dt>Algorithm</dt>
                <dd>{output.decoded.algorithm}</dd>
              </div>
              <div>
                <dt>Header Bytes</dt>
                <dd className="mono">{output.headerHex}</dd>
              </div>
              <div>
                <dt>Auth Data Length</dt>
                <dd>{output.decoded.authenticatorData.length} bytes</dd>
              </div>
              <div>
                <dt>Client Data Length</dt>
                <dd>{output.decoded.clientDataJSON.length} bytes</dd>
              </div>
              <div>
                <dt>Varsig Hex</dt>
                <dd className="mono">{output.varsigHex}</dd>
              </div>
            </dl>
            <div className="header-grid">
              {buildHeaderParts(output.algorithm).map((part) => (
                <div key={part.label} className="header-item">
                  <div className="header-label">{part.label}</div>
                  <div className="mono header-bytes">{part.value}</div>
                  <div className="header-detail">{part.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Client Data</h2>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{output.clientData.type}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{output.clientData.origin}</dd>
              </div>
              <div>
                <dt>Challenge</dt>
                <dd className="mono">{output.clientData.challenge}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2>Verification</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd className={output.verification.valid ? 'ok' : 'bad'}>
                  {output.verification.valid ? 'Valid' : 'Invalid'}
                </dd>
              </div>
              <div>
                <dt>Signature</dt>
                <dd
                  className={
                    output.signatureValid === null
                      ? undefined
                      : output.signatureValid
                        ? 'ok'
                        : 'bad'
                  }
                >
                  {output.signatureValid === null
                    ? 'Not checked'
                    : output.signatureValid
                      ? 'Valid'
                      : 'Invalid'}
                </dd>
              </div>
              <div>
                <dt>Sign Count</dt>
                <dd>{output.verification.signCount ?? 'n/a'}</dd>
              </div>
              <div>
                <dt>Signed Data</dt>
                <dd className="mono">{output.signedDataHex}</dd>
              </div>
              {output.verification.error ? (
                <div>
                  <dt>Error</dt>
                  <dd>{output.verification.error}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}
    </div>
  )
}
