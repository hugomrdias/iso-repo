import { useRef, useState } from 'react'
import { createHelia } from 'helia'
import { createOrbitDB, IPFSAccessController } from '@orbitdb/core'
import {
  CURVE_ED25519,
  CURVE_P256,
  INNER_ECDSA,
  INNER_EDDSA,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  PAYLOAD_ENCODING_RAW,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  WEBAUTHN_WRAPPER,
  varintEncode,
} from 'iso-webauthn-varsig'
import {
  buildVarsigHeader,
  buildVarsigOutput,
  decodeWebAuthnVarsigV1,
  parseClientDataJSON,
  runWebAuthnAssertion,
  verifyWebAuthnAssertion,
} from './webauthn/varsig'
import { loadStoredCredential, registerCredential } from './webauthn/credential'
import {
  createWebAuthnIdentities,
  createOrbitDbIdentity,
  loadStoredIdentity,
  type OrbitDbIdentity,
  type WebAuthnIdentities,
  type WebAuthnOrbitIdentity,
} from './orbitdb/identity'
import { createLibp2pNode } from './orbitdb/libp2p'
import { loadDbList, storeDbList } from './orbitdb/storage'
import { createIpfsIdentityStorage } from './orbitdb/identity-storage'

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
  const [registered, setRegistered] = useState(Boolean(loadStoredCredential()))
  const [orbitdbIdentity, setOrbitdbIdentity] =
    useState<OrbitDbIdentity | null>(loadStoredIdentity())
  const [orbitdbIdentityObj, setOrbitdbIdentityObj] = useState<null | {
    id: string
    publicKey: Uint8Array
    signatures: { id: Uint8Array; publicKey: Uint8Array }
    type: string
    sign: (identity: unknown, data: Uint8Array | string) => Promise<Uint8Array>
    verify: (
      signature: Uint8Array,
      publicKey: Uint8Array,
      data: Uint8Array | string
    ) => Promise<boolean>
    hash: string
    bytes: Uint8Array
  }>(null)
  const [identityChecks, setIdentityChecks] = useState<null | {
    idValid: boolean
    publicKeyValid: boolean
    idVarsigHex: string
    publicKeyVarsigHex: string
  }>(null)
  const [recordText, setRecordText] = useState(
    'Hello OrbitDB! Signed with WebAuthn.'
  )
  const [orbitdbName, setOrbitdbName] = useState('webauthn-demo')
  const [orbitdbRemoteAddress, setOrbitdbRemoteAddress] = useState('')
  const [orbitdbStatus, setOrbitdbStatus] = useState('idle')
  const [orbitdbAddress, setOrbitdbAddress] = useState<string | null>(null)
  const [orbitdbEntries, setOrbitdbEntries] = useState<
    Array<{ hash: string; value: string }>
  >([])
  const [orbitdbDbList, setOrbitdbDbList] = useState<string[]>(loadDbList())
  const [dbJoinActive, setDbJoinActive] = useState(false)
  const [dbUpdateActive, setDbUpdateActive] = useState(false)
  const [orbitdbPeerId, setOrbitdbPeerId] = useState<string | null>(null)
  const [orbitdbPeerCount, setOrbitdbPeerCount] = useState(0)
  const joinTimeoutRef = useRef<number | null>(null)
  const updateTimeoutRef = useRef<number | null>(null)
  const orbitdbRef = useRef<{
    libp2p?: Awaited<ReturnType<typeof createLibp2pNode>>
    helia?: Awaited<ReturnType<typeof createHelia>>
    orbitdb?: Awaited<ReturnType<typeof createOrbitDB>>
    db?: { add: (value: string) => Promise<string>; all: () => Promise<any[]>; address?: string }
    identities?: WebAuthnIdentities
    peerHandlers?: {
      onPeerConnect: () => void
      onPeerDisconnect: () => void
      onPeerDiscovery: (event: Event) => void
    }
    dbHandlers?: {
      onJoin: (peerId: unknown) => void
      onUpdate: (entry: unknown) => void
    }
  }>({})
  const [tsHover, setTsHover] = useState(false)
  const webauthnInFlight = useRef(false)
  const signAttemptRef = useRef(0)
  const [signAttempt, setSignAttempt] = useState(0)
  const [output, setOutput] = useState<null | {
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
      const {
        identityData,
        orbitdbIdentity,
        idOutput,
        pubKeyOutput,
      } = await createOrbitDbIdentity()
      setOrbitdbIdentity(identityData)
      setOrbitdbIdentityObj(orbitdbIdentity)
      setRegistered(true)
      setIdentityChecks({
        idValid: Boolean(
          idOutput.verification.valid && idOutput.signatureValid
        ),
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

  const refreshOrbitDbEntries = async () => {
    if (!orbitdbRef.current.db) return
    const entries = await orbitdbRef.current.db.all()
    const normalized = entries.map((entry: { hash: string; value: string }) => ({
      hash: entry.hash,
      value: entry.value,
    }))
    console.info('[orbitdb] entries refreshed', {
      count: normalized.length,
      address: orbitdbRef.current.db?.address?.toString?.(),
    })
    setOrbitdbEntries(normalized)
  }

  const triggerLed = (
    setActive: (value: boolean) => void,
    timeoutRef: React.MutableRefObject<number | null>
  ) => {
    setActive(true)
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      setActive(false)
    }, 1500)
  }

  const attachDbEvents = (db: { events?: { on: Function; off?: Function } }) => {
    if (orbitdbRef.current.dbHandlers && orbitdbRef.current.db?.events?.off) {
      const { onJoin, onUpdate } = orbitdbRef.current.dbHandlers
      orbitdbRef.current.db.events.off('join', onJoin)
      orbitdbRef.current.db.events.off('update', onUpdate)
    }

    const onJoin = async (peerId?: unknown) => {
      console.info('[orbitdb] db join', {
        peerId,
        address: orbitdbRef.current.db?.address?.toString?.(),
      })
      triggerLed(setDbJoinActive, joinTimeoutRef)
      await refreshOrbitDbEntries()
    }
    const onUpdate = async (entry?: unknown) => {
      console.info('[orbitdb] db update', {
        entry,
        address: orbitdbRef.current.db?.address?.toString?.(),
      })
      triggerLed(setDbUpdateActive, updateTimeoutRef)
      await refreshOrbitDbEntries()
    }
    db.events?.on('join', onJoin)
    db.events?.on('update', onUpdate)
    orbitdbRef.current.dbHandlers = { onJoin, onUpdate }
  }

  const runStartOrbitDb = async () => {
    setBusy(true)
    setError(null)
    setOrbitdbStatus('starting')

    try {
      if (!orbitdbIdentityObj) {
        throw new Error('Create a WebAuthn identity before starting OrbitDB.')
      }

      const libp2p = await createLibp2pNode()
      const helia = await createHelia({ libp2p })
      const identityStorage = createIpfsIdentityStorage(helia)
      const identities = createWebAuthnIdentities(
        orbitdbIdentityObj as WebAuthnOrbitIdentity,
        identityStorage
      )
      const orbitdb = await createOrbitDB({
        ipfs: helia,
        identity: orbitdbIdentityObj,
        identities,
      })

      const updatePeerCount = () => {
        const connections = libp2p.getConnections?.() ?? []
        const peerIds = new Set(
          connections.map((connection) => connection.remotePeer?.toString?.())
        )
        peerIds.delete(undefined as unknown as string)
        setOrbitdbPeerCount(peerIds.size)
      }

      const onPeerConnect = (event?: Event) => {
        updatePeerCount()
        const connection = (event as CustomEvent)?.detail?.connection
        const peerId = connection?.remotePeer ?? (event as CustomEvent)?.detail?.remotePeer
        if (peerId) {
          console.info('[orbitdb] peer connected', peerId.toString?.())
        }
      }
      const onPeerDisconnect = () => updatePeerCount()
      const onPeerDiscovery = (event: Event) => {
        const detail = (event as CustomEvent).detail as
          | { id?: { toString?: () => string }; multiaddrs?: Array<{ toString: () => string }> }
          | undefined
        const peerId = detail?.id
        const multiaddrs = detail?.multiaddrs ?? []
        if (!peerId || multiaddrs.length === 0) return
        console.info('[orbitdb] peer discovered', peerId.toString?.(), multiaddrs.length)

        const dialableAddrs = multiaddrs.filter((addr) => {
          const addrStr = addr.toString()
          return (
            addrStr.includes('/webrtc') ||
            addrStr.includes('/webtransport') ||
            addrStr.includes('/ws')
          )
        })
        if (dialableAddrs.length === 0) return

        const existingConnections = libp2p.getConnections?.(peerId) ?? []
        const hasDirectConnection = existingConnections.some((conn) => {
          const addrStr = conn.remoteAddr?.toString?.() ?? ''
          return !addrStr.includes('/p2p-circuit')
        })
        if (hasDirectConnection) return

        console.info('[orbitdb] auto-dialing peer', peerId.toString?.())
        libp2p
          .dial?.(peerId)
          .then(() => {
            console.info('[orbitdb] dial succeeded', peerId.toString?.())
          })
          .catch((err) => {
            console.warn(
              '[orbitdb] dial failed',
              peerId.toString?.(),
              err instanceof Error ? err.message : String(err)
            )
          })
      }

      libp2p.addEventListener?.('peer:connect', onPeerConnect)
      libp2p.addEventListener?.('peer:disconnect', onPeerDisconnect)
      libp2p.addEventListener?.('peer:discovery', onPeerDiscovery)
      libp2p.addEventListener?.('connection:open', (event: Event) => {
        const connection = (event as CustomEvent).detail
        const addrStr = connection?.remoteAddr?.toString?.() ?? ''
        const isRelay = addrStr.includes('/p2p-circuit')
        const isWebrtc = addrStr.includes('/webrtc')
        console.info('[orbitdb] connection opened', {
          peerId: connection?.remotePeer?.toString?.(),
          address: addrStr,
          transport: isWebrtc ? 'webrtc' : 'relay',
        })
      })
      libp2p.addEventListener?.('connection:close', (event: Event) => {
        const connection = (event as CustomEvent).detail
        const addrStr = connection?.remoteAddr?.toString?.() ?? ''
        console.info('[orbitdb] connection closed', {
          peerId: connection?.remotePeer?.toString?.(),
          address: addrStr,
          transport: addrStr.includes('/webrtc') ? 'webrtc' : 'relay',
        })
      })
      updatePeerCount()
      const existingConnections = libp2p.getConnections?.() ?? []
      if (existingConnections.length > 0) {
        updatePeerCount()
      }

      orbitdbRef.current = {
        ...orbitdbRef.current,
        libp2p,
        helia,
        orbitdb,
        identities,
        peerHandlers: { onPeerConnect, onPeerDisconnect, onPeerDiscovery },
      }
      setOrbitdbPeerId(libp2p.peerId?.toString() ?? null)
      setOrbitdbStatus('ready')
    } catch (err) {
      setOrbitdbStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runOpenOrbitDb = async () => {
    setBusy(true)
    setError(null)

    try {
      if (!orbitdbRef.current.orbitdb) {
        await runStartOrbitDb()
      }
      if (!orbitdbRef.current.orbitdb || !orbitdbIdentityObj) {
        throw new Error('OrbitDB is not ready yet.')
      }

      const db = await orbitdbRef.current.orbitdb.open(orbitdbName, {
        type: 'events',
        AccessController: IPFSAccessController({
          write: ['*'],
        }),
      })
      orbitdbRef.current.db = db
      attachDbEvents(db)
      const address = db.address?.toString?.() ?? String(db.address)
      setOrbitdbAddress(address)
      if (!orbitdbDbList.includes(address)) {
        const updated = [address, ...orbitdbDbList]
        setOrbitdbDbList(updated)
        storeDbList(updated)
      }
      await refreshOrbitDbEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runOpenOrbitDbByAddress = async () => {
    setBusy(true)
    setError(null)

    try {
      if (!orbitdbRef.current.orbitdb) {
        await runStartOrbitDb()
      }
      if (!orbitdbRef.current.orbitdb) {
        throw new Error('OrbitDB is not ready yet.')
      }
      if (!orbitdbRemoteAddress.trim()) {
        throw new Error('Enter a database address to open.')
      }

      const db = await orbitdbRef.current.orbitdb.open(
        orbitdbRemoteAddress.trim()
      )
      orbitdbRef.current.db = db
      attachDbEvents(db)
      const address = db.address?.toString?.() ?? String(db.address)
      setOrbitdbAddress(address)
      if (!orbitdbDbList.includes(address)) {
        const updated = [address, ...orbitdbDbList]
        setOrbitdbDbList(updated)
        storeDbList(updated)
      }
      await refreshOrbitDbEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const runAddOrbitDbEntry = async () => {
    setBusy(true)
    setError(null)

    try {
      if (!orbitdbRef.current.db) {
        throw new Error('Open an OrbitDB database first.')
      }
      await orbitdbRef.current.db.add(recordText)
      await refreshOrbitDbEntries()
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
          This demo uses real passkey flows to register, sign, and build a
          WebAuthn-backed OrbitDB identity without a separate browser keypair.
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
          <div className="group-label">Real passkey flow</div>
          <div className="button-row">
            <button
              className="button-real"
              disabled={busy}
              onClick={runRegister}
              type="button"
            >
              {busy
                ? 'Waiting…'
                : registered
                  ? 'Passkey registered'
                  : 'Register passkey (real device)'}
            </button>
            <button
              className="button-real"
              disabled={busy || !registered}
              onClick={runWebAuthn}
              type="button"
            >
              {busy ? 'Waiting…' : 'Sign with WebAuthn (real)'}
            </button>
          </div>
        </div>
        <p className="hint">Sign attempt: {signAttempt}</p>
        <p className="hint">
          Register passkey uses the real WebAuthn API to create a credential on
          your device. Sign with WebAuthn uses that credential to sign (Ed25519
          preferred, P-256 fallback).
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
              className="button-real"
              disabled={busy || !registered}
              onClick={runOrbitDbIdentity}
              type="button"
            >
              {busy ? 'Working…' : 'Create OrbitDB identity'}
            </button>
          </div>
          <p className="hint">
            Identity signatures use passkey assertions over the DID and
            public-key binding payloads.
          </p>
        </div>

        <div className="card">
          <h2>OrbitDB Database</h2>
          <p>
            Start OrbitDB with the WebAuthn identity, then open a database and
            add entries. Open the same address in another tab to see replication.
          </p>
          <div className="button-row">
            <button
              className="button-real"
              disabled={busy || !orbitdbIdentityObj}
              onClick={runStartOrbitDb}
              type="button"
            >
              {busy ? 'Working…' : 'Start OrbitDB'}
            </button>
            <button
              className="button-real"
              disabled={busy || !orbitdbIdentityObj}
              onClick={runOpenOrbitDb}
              type="button"
            >
              {busy ? 'Working…' : 'Open DB'}
            </button>
          </div>
          <label className="input-label" htmlFor="orbitdb-entry">
            Entry payload
          </label>
          <textarea
            className="record-input"
            id="orbitdb-entry"
            onChange={(event) => setRecordText(event.target.value)}
            rows={3}
            value={recordText}
          />
          <div className="button-row">
            <button
              className="button-real"
              disabled={busy || !orbitdbIdentityObj || !orbitdbAddress}
              onClick={runAddOrbitDbEntry}
              type="button"
            >
              {busy ? 'Working…' : 'Add entry to DB'}
            </button>
          </div>
          <label className="input-label" htmlFor="orbitdb-name">
            Database name
          </label>
          <input
            className="record-input"
            id="orbitdb-name"
            onChange={(event) => setOrbitdbName(event.target.value)}
            value={orbitdbName}
          />
          <label className="input-label" htmlFor="orbitdb-address">
            Open by address
          </label>
          <input
            className="record-input"
            id="orbitdb-address"
            onChange={(event) => setOrbitdbRemoteAddress(event.target.value)}
            value={orbitdbRemoteAddress}
            placeholder="Copy address from another tab"
          />
          <div className="button-row">
            <button
              className="button-real"
              disabled={busy || !orbitdbIdentityObj}
              onClick={runOpenOrbitDbByAddress}
              type="button"
            >
              {busy ? 'Working…' : 'Open remote DB'}
            </button>
          </div>
          <p className="hint">
            Status: {orbitdbStatus} · Peers: {orbitdbPeerCount}
          </p>
          <div className="led-row">
            <span className={`led ${dbJoinActive ? 'led-on' : ''}`} />
            <span className="hint">Join</span>
            <span className={`led ${dbUpdateActive ? 'led-on' : ''}`} />
            <span className="hint">Update</span>
          </div>
          <label className="input-label" htmlFor="orbitdb-peerid">
            Peer ID
          </label>
          <input
            className="record-input"
            id="orbitdb-peerid"
            readOnly
            value={orbitdbPeerId ?? ''}
          />
          <label className="input-label" htmlFor="orbitdb-address-display">
            Database address
          </label>
          <input
            className="record-input"
            id="orbitdb-address-display"
            readOnly
            value={orbitdbAddress ?? ''}
          />
          <p className="hint">
            Outcome: new entries appear in the list, and another tab opened with
            the same address should replicate them over libp2p.
          </p>
        </div>

        <div className="card">
          <h2>OrbitDB Entries</h2>
          {orbitdbEntries.length === 0 ? (
            <p className="hint">Open a database and add an entry.</p>
          ) : (
            <dl>
              {orbitdbEntries.slice(0, 5).map((entry) => (
                <div key={entry.hash}>
                  <dt>{entry.hash.slice(0, 10)}…</dt>
                  <dd className="mono">{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
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
      </section>

      {error ? <div className="error">{error}</div> : null}

      {output ? (
        <section className="grid">
          <div className="card">
            <h2>Inputs</h2>
            <dl>
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
              <p className="hint">
                COSE metadata is captured during registration.
              </p>
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
                    {output.payloadText
                      .split(`${output.payloadTs}`)
                      .map((part, index, parts) =>
                        index === parts.length - 1 ? (
                          // eslint-disable-next-line react/no-array-index-key
                          <span key={`${part}-${index}`}>{part}</span>
                        ) : (
                          // eslint-disable-next-line react/no-array-index-key
                          <span key={`${part}-${index}`}>
                            {part}
                            <button
                              aria-label="Show ts source"
                              className="ts-token"
                              onBlur={() => setTsHover(false)}
                              onFocus={() => setTsHover(true)}
                              onMouseEnter={() => setTsHover(true)}
                              onMouseLeave={() => setTsHover(false)}
                              type="button"
                            >
                              {output.payloadTs}
                            </button>
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
                <div className="header-item" key={part.label}>
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
