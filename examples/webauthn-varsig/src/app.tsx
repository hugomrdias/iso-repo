import { useRef, useState } from 'react'
import { DIDKey } from 'iso-did'
import { parseAttestationObject } from 'iso-passkeys'
import {
  CURVE_ED25519,
  INNER_EDDSA,
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
  verifyWebAuthnAssertion,
} from 'iso-webauthn-varsig'

const encoder = new TextEncoder()
const STORAGE_KEY = 'webauthn-varsig-demo-credential'
const STORAGE_KEY_PUBLIC = 'webauthn-varsig-demo-public-key'
const STORAGE_KEY_DID = 'webauthn-varsig-demo-did'

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

async function extractEd25519PublicKey(
  attestationObject: Uint8Array
): Promise<{
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

  if (kty !== 1 || (alg !== -50 && alg !== -8) || crv !== 6) {
    return { publicKey: null, kty, alg, crv }
  }

  const publicKeyBytes = new Uint8Array(getValue(-2))
  if (publicKeyBytes.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${publicKeyBytes.length}`)
  }

  return { publicKey: publicKeyBytes, kty, alg, crv }
}

function loadStoredCredential() {
  const stored = localStorage.getItem(STORAGE_KEY)
  const storedPublicKey = localStorage.getItem(STORAGE_KEY_PUBLIC)
  const storedDid = localStorage.getItem(STORAGE_KEY_DID)
  if (stored && storedPublicKey && storedDid) {
    return {
      credentialId: base64urlToBytes(stored),
      publicKey: base64urlToBytes(storedPublicKey),
      did: storedDid,
      cose: { kty: 1, alg: -50, crv: 6 },
    }
  }
  return null
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
  const { publicKey: publicKeyBytes, kty, alg, crv } =
    await extractEd25519PublicKey(
      new Uint8Array(response.attestationObject)
    )

  if (!publicKeyBytes) {
    throw new Error(
      'Ed25519 not supported by this authenticator (kty/alg/crv mismatch)'
    )
  }

  const rawId = new Uint8Array(credential.rawId)
  const encoded = bytesToBase64url(rawId)
  const encodedPublicKey = bytesToBase64url(publicKeyBytes)
  const did = DIDKey.fromPublicKey('Ed25519', publicKeyBytes).did
  localStorage.setItem(STORAGE_KEY, encoded)
  localStorage.setItem(STORAGE_KEY_PUBLIC, encodedPublicKey)
  localStorage.setItem(STORAGE_KEY_DID, did)
  return {
    credentialId: rawId,
    publicKey: publicKeyBytes,
    did,
    cose: { kty, alg, crv },
  }
}

async function runWebAuthnAssertion() {
  const rpId = window.location.hostname
  const origin = window.location.origin
  const payload = { scope: 'webauthn-varsig-demo', ts: Date.now() }
  const payloadText = JSON.stringify(payload)
  const payloadBytes = encoder.encode(payloadText)
  const domain = encoder.encode('ucan-webauthn-v1:')
  const challengeInput = concat([domain, payloadBytes])
  const challengeBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', challengeInput)
  )
  const challenge = bytesToBase64url(challengeBytes)

  const stored = loadStoredCredential()
  if (!stored) {
    throw new Error('No stored passkey. Register first.')
  }
  const { credentialId, publicKey, did, cose } = stored
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
    payloadBytes,
    payloadText,
    payloadTs: payload.ts,
    assertion: {
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJSON: new Uint8Array(response.clientDataJSON),
      signature: new Uint8Array(response.signature),
    },
  }
}

function buildEd25519Header(): Uint8Array {
  return concat([
    new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION]),
    varintEncode(INNER_EDDSA),
    varintEncode(CURVE_ED25519),
    varintEncode(MULTIHASH_SHA256),
    varintEncode(MULTIHASH_SHA256_LEN),
    varintEncode(WEBAUTHN_WRAPPER),
    varintEncode(PAYLOAD_ENCODING_RAW),
  ])
}

function buildHeaderParts() {
  return [
    {
      label: 'Varsig prefix + version',
      value: toHexSpaced(new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION])),
      detail: '0x34 0x01',
    },
    {
      label: 'Inner algorithm (EdDSA)',
      value: toHexSpaced(varintEncode(INNER_EDDSA)),
      detail: `0x${INNER_EDDSA.toString(16)}`,
    },
    {
      label: 'Curve (Ed25519)',
      value: toHexSpaced(varintEncode(CURVE_ED25519)),
      detail: `0x${CURVE_ED25519.toString(16)}`,
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
  const [tsHover, setTsHover] = useState(false)
  const webauthnInFlight = useRef(false)
  const signAttemptRef = useRef(0)
  const [signAttempt, setSignAttempt] = useState(0)
  const [output, setOutput] = useState<null | {
    mode: 'mock' | 'webauthn'
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
        await createMockAssertion()

      const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
      const decoded = decodeWebAuthnVarsigV1(varsig)
      const clientData = parseClientDataJSON(decoded.clientDataJSON)

      const verification = await verifyWebAuthnAssertion(decoded, {
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedChallenge: challengeBytes,
      })

      const signedData = await reconstructSignedData(decoded)
      const headerHex = toHex(buildEd25519Header())

      setOutput({
        mode: 'mock',
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
      const {
        assertion,
        challengeBytes,
        rpId,
        origin,
        challenge,
        publicKey,
        did,
        cose,
        payloadBytes,
        payloadText,
        payloadTs,
      } = await runWebAuthnAssertion()
        await runWebAuthnAssertion()

      const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
      const decoded = decodeWebAuthnVarsigV1(varsig)
      const clientData = parseClientDataJSON(decoded.clientDataJSON)

      const verification = await verifyWebAuthnAssertion(decoded, {
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedChallenge: challengeBytes,
      })

      const signedData = await reconstructSignedData(decoded)
      const signatureValid = await verifyEd25519Signature(
        signedData,
        decoded.signature,
        publicKey
      )
      const headerHex = toHex(buildEd25519Header())

      setOutput({
        mode: 'webauthn',
        headerHex,
        varsigHex: toHex(varsig),
        decoded,
        clientData,
        verification,
        signatureValid,
        signedDataHex: toHex(signedData),
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
        <h1>WebAuthn Varsig Demo</h1>
        <p className="lede">
          This example creates a mock WebAuthn assertion in the browser, encodes
          it with varsig v1, then decodes and validates the metadata.
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
            <li>signature bytes (Ed25519 = 64 bytes).</li>
          </ol>
        </div>
        <div className="card">
          <h2>Decode Flow</h2>
          <ol>
            <li>Parse header and verify constants.</li>
            <li>Extract auth data + client data lengths.</li>
            <li>Recover assertion bytes and check WebAuthn metadata.</li>
            <li>Rebuild signed data and verify signature.</li>
          </ol>
        </div>
      </section>

      <section className="controls">
        <div className="button-row">
          <button type="button" onClick={runDemo} disabled={busy}>
            {busy ? 'Running…' : 'Run Demo'}
          </button>
          <button type="button" onClick={runRegister} disabled={busy}>
            {busy ? 'Waiting…' : registered ? 'Passkey registered' : 'Register passkey'}
          </button>
          <button
            type="button"
            onClick={runWebAuthn}
            disabled={busy || !registered}
          >
            {busy ? 'Waiting…' : 'Sign with WebAuthn Ed25519'}
          </button>
        </div>
        <p className="hint">Sign attempt: {signAttempt}</p>
        <p className="hint">
          Run Demo uses mock data. Register passkey creates a WebAuthn
          credential. Sign with WebAuthn uses that credential to sign.
        </p>
        <p className="hint">
          The WebAuthn path also verifies the Ed25519 signature using the
          extracted public key when supported by your authenticator.
        </p>
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
              {buildHeaderParts().map((part) => (
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
