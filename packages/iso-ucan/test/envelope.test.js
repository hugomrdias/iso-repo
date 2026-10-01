import * as cbor from '@ipld/dag-cbor'
import { base64 } from 'iso-base/rfc4648'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'
import { Invocation } from '../src/invocation.js'
import * as varsig from '../src/varsig.js'
import delegationFixtures from './fixtures/delegation.json' with {
  type: 'json',
}
import * as mocks from './mocks.js'

/**
 * Tokens issued by iso-ucan <= 1.0.0, tagged `ucan/{dlg,inv}@1.0.0-rc.1`.
 * Taken from the previous (rc.1) test vectors.
 */
const RC1 = {
  delegation: {
    // basic delegation bob > carol
    token:
      'glhAd7jvZs44lTWmjSG/PWBRXvAdJA6Pq0fj86WQOVBYSw3fLrpjF7OMvjUlTynZZblPHzFsiBeBlUqtbCAHvhppCaJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xp2NhdWR4OGRpZDprZXk6ejZNa21KY2VWb1FTSHM0NWNSZUVYb0x0V20xd29zQ0c4Ukx4Zkt3aHhvcXpvVGtDY2NtZGgvYWNjb3VudGNleHAaaIIMsWNpc3N4OGRpZDprZXk6ejZNa21UOWo2ZlZacXpYVjh1MndWVlN1NDlnWVNSWUdTUW5kdVdYRjZmb0FKcnF6Y3BvbIBjc3VieDhkaWQ6a2V5Ono2TWttVDlqNmZWWnF6WFY4dTJ3VlZTdTQ5Z1lTUllHU1FuZHVXWEY2Zm9BSnJxemVub25jZUwnbSv2keQn/Kg2KsM=',
    cid: 'bafyreifqsojs54lpxxyx5xfqxiwkc4paglcyqd7vjzrcyapxi557extz6m',
    exp: 1753353393,
  },
  // single non-time bounded proof
  invocation: {
    token:
      'glhAdcYl9DBuAPXRsY+qsB2kemOcTvJ6vIKAsf3gIYL7imHQNAevH5sW2bKgb9btUM2Xjx9KD9PMHyEeM3Ls0bKJA6JhaEg0Ae0B7QETcXN1Y2FuL2ludkAxLjAuMC1yYy4xqGNjbWRpL21zZy9zZW5kY2V4cPZjaWF0Gmj1e4BjaXNzeDhkaWQ6a2V5Ono2TWtnR3lrTjlBUk5GakV6b3dWcTRtTFAya0w0TnN5QWFER1hlSkZRNXFFMWJmZ2NwcmaB2CpYJQABcRIgMI8CZFZ8CH7BynpUg0BDCfuktrmFJjLSu+KK/DXIDmpjc3VieDhkaWQ6a2V5Ono2TWttVDlqNmZWWnF6WFY4dTJ3VlZTdTQ5Z1lTUllHU1FuZHVXWEY2Zm9BSnJxemRhcmdzoGVub25jZVAFBgcIBQYHCAUGBwgFBgcI',
    proof:
      'glhAR4mfb8ah/x4Ec2ncbW1jfm4T/SSqX2rbe7XSLiXZPTRaSsdR94U/dyC0dviEpYjou21f0iC4DUho1DFzms/bAKJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xp2NhdWR4OGRpZDprZXk6ejZNa2dHeWtOOUFSTkZqRXpvd1ZxNG1MUDJrTDROc3lBYURHWGVKRlE1cUUxYmZnY2NtZGkvbXNnL3NlbmRjZXhw9mNpc3N4OGRpZDprZXk6ejZNa21UOWo2ZlZacXpYVjh1MndWVlN1NDlnWVNSWUdTUW5kdVdYRjZmb0FKcnF6Y3BvbIBjc3VieDhkaWQ6a2V5Ono2TWttVDlqNmZWWnF6WFY4dTJ3VlZTdTQ5Z1lTUllHU1FuZHVXWEY2Zm9BSnJxemVub25jZVABAgMEAQIDBAECAwQBAgME',
    time: 1767225600,
  },
}

/**
 * Concatenate raw CBOR fragments, used to build envelopes that
 * `@ipld/dag-cbor` refuses to encode (e.g. non-canonical map key order).
 *
 * @param {...(number | Uint8Array)} parts
 */
function concat(...parts) {
  return Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'number' ? [p] : [...p]))
  )
}

/**
 * Self-signed invocation payload to build envelopes from
 */
async function invocationPayload() {
  const inv = await Invocation.create({
    iss: mocks.bob,
    sub: mocks.bob.did,
    cmd: '/msg/send',
    args: {},
    prf: [],
    verifierResolver: mocks.verifierResolver,
  })
  return inv.envelope.payload
}

/**
 * Sign and encode an envelope from an arbitrary signature payload
 *
 * @param {Record<string, unknown>} sigPayload
 */
async function signEnvelope(sigPayload) {
  const signature = await mocks.bob.sign(cbor.encode(sigPayload))
  return cbor.encode([signature, sigPayload])
}

/**
 * @param {Uint8Array} bytes
 * @param {string} message
 */
function assertDecodeError(bytes, message) {
  assert.throws(
    () => Envelope.decode({ envelope: bytes }),
    (/** @type {Error} */ err) => {
      assert.ok(err instanceof TypeError, `expected TypeError got ${err.name}`)
      assert.ok(
        err.message.includes(message),
        `expected "${message}" got "${err.message}"`
      )
      return true
    }
  )
}

const h = varsig.encode({ enc: 'DAG-CBOR', alg: mocks.bob.signatureType })

const envelope = suite('envelope')

envelope('should encode delegations with ucan/dlg@1.0.0', async () => {
  const delegation = await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store: mocks.createStore(),
  })

  const [, sigPayload] = cbor.decode(delegation.bytes)
  assert.deepEqual(Object.keys(sigPayload), ['h', 'ucan/dlg@1.0.0'])
  assert.equal(delegation.envelope.version, '1.0.0')

  const decoded = await Delegation.from({
    bytes: delegation.bytes,
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal(decoded.envelope.version, '1.0.0')
  assert.equal(decoded.cid.toString(), delegation.cid.toString())
})

envelope('should encode invocations with ucan/inv@1.0.0', async () => {
  const invocation = await Invocation.create({
    iss: mocks.bob,
    sub: mocks.bob.did,
    cmd: '/msg/send',
    args: {},
    prf: [],
    verifierResolver: mocks.verifierResolver,
  })

  const [, sigPayload] = cbor.decode(invocation.bytes)
  assert.deepEqual(Object.keys(sigPayload), ['h', 'ucan/inv@1.0.0'])
  assert.equal(invocation.envelope.version, '1.0.0')

  const decoded = await Invocation.from({
    bytes: invocation.bytes,
    verifierResolver: mocks.verifierResolver,
    resolveProof: () => {
      throw new Error('no proofs expected')
    },
  })
  assert.equal(decoded.envelope.version, '1.0.0')
  assert.equal(decoded.cid.toString(), invocation.cid.toString())
})

for (const fixture of delegationFixtures.valid) {
  envelope(`should validate 1.0.0 vector ${fixture.name}`, async () => {
    const { payload } = fixture.envelope
    const now = payload.exp - 1
    const bytes = base64.decode(fixture.token)

    const delegation = await Delegation.from({
      bytes,
      verifierResolver: mocks.verifierResolver,
      now,
    })

    assert.equal(delegation.cid.toString(), fixture.cid)
    assert.equal(delegation.envelope.version, delegationFixtures.version)
    assert.equal(delegation.envelope.spec, fixture.envelope.spec)
    assert.equal(delegation.envelope.alg, fixture.envelope.alg)
    assert.equal(delegation.envelope.enc, fixture.envelope.enc)
    assert.deepEqual(
      delegation.envelope.signature,
      base64.decode(fixture.envelope.signature)
    )
  })

  envelope(`should reproduce 1.0.0 vector ${fixture.name}`, async () => {
    const { payload } = fixture.envelope
    const delegation = await Delegation.create({
      iss: mocks.bob,
      aud: /** @type {import('../src/types.js').DID} */ (payload.aud),
      sub: /** @type {import('../src/types.js').DID} */ (payload.sub),
      cmd: payload.cmd,
      pol: [],
      exp: payload.exp,
      nonce: base64.decode(payload.nonce),
      now: payload.exp - 1,
    })

    assert.equal(delegation.cid.toString(), fixture.cid)
    assert.deepEqual(delegation.bytes, base64.decode(fixture.token))
  })
}

envelope('should decode and verify 1.0.0-rc.1 delegations', async () => {
  const bytes = base64.decode(RC1.delegation.token)
  const decoded = Envelope.decode({ envelope: bytes })
  assert.equal(decoded.version, '1.0.0-rc.1')
  assert.equal(decoded.spec, 'dlg')

  const delegation = await Delegation.from({
    bytes,
    verifierResolver: mocks.verifierResolver,
    now: RC1.delegation.exp - 1,
  })

  // CID is rebuilt with the decoded rc.1 tag
  assert.equal(delegation.cid.toString(), RC1.delegation.cid)
  assert.equal(delegation.envelope.version, '1.0.0-rc.1')
})

envelope('should decode and verify 1.0.0-rc.1 invocations', async () => {
  const store = mocks.createStore()
  const proof = await Delegation.fromString(RC1.invocation.proof)
  assert.equal(proof.envelope.version, '1.0.0-rc.1')
  await store.add([proof])

  // the invocation references the proof by its rc.1 CID
  const invocation = await Invocation.from({
    bytes: base64.decode(RC1.invocation.token),
    verifierResolver: mocks.verifierResolver,
    resolveProof: (cid) => store.resolveProof(cid),
    now: RC1.invocation.time,
  })

  assert.equal(invocation.envelope.version, '1.0.0-rc.1')
  assert.equal(invocation.delegations.length, 1)
})

envelope('should reject unsupported payload tag version', async () => {
  const payload = await invocationPayload()
  const bytes = await signEnvelope({ h, 'ucan/inv@9.9.9': payload })

  assertDecodeError(bytes, 'Unsupported payload tag version "9.9.9"')
  await assert.rejects(
    Invocation.from({
      bytes,
      verifierResolver: mocks.verifierResolver,
      resolveProof: () => {
        throw new Error('no proofs expected')
      },
    }),
    /Unsupported payload tag version "9.9.9"/
  )
})

envelope('should reject unsupported payload tag spec', async () => {
  const payload = await invocationPayload()
  const bytes = await signEnvelope({ h, 'ucan/foo@1.0.0': payload })

  assertDecodeError(bytes, 'Unsupported payload tag spec "foo"')
})

envelope('should reject malformed payload tags', async () => {
  const payload = await invocationPayload()

  assertDecodeError(
    await signEnvelope({ h, 'ucan/inv': payload }),
    'Invalid payload tag "ucan/inv"'
  )
  assertDecodeError(
    await signEnvelope({ h, 'foo/inv@1.0.0': payload }),
    'Invalid payload tag "foo/inv@1.0.0"'
  )
})

envelope('should reject non DAG-CBOR varsig payload encoding', async () => {
  const payload = await invocationPayload()
  const raw = varsig.encode({ enc: 'RAW', alg: mocks.bob.signatureType })
  assert.equal(raw.at(-1), 0x5f)

  assertDecodeError(
    await signEnvelope({ h: raw, 'ucan/inv@1.0.0': payload }),
    'Unsupported varsig payload encoding RAW expected DAG-CBOR'
  )
})

envelope('should reject envelopes that are not 2-element arrays', async () => {
  const payload = await invocationPayload()
  const sigPayload = { h, 'ucan/inv@1.0.0': payload }
  const signature = await mocks.bob.sign(cbor.encode(sigPayload))

  assertDecodeError(
    cbor.encode([signature, sigPayload, 1]),
    'Invalid envelope expected array of 2 elements'
  )
  assertDecodeError(
    cbor.encode([signature]),
    'Invalid envelope expected array of 2 elements'
  )
  assertDecodeError(
    cbor.encode({ signature, sigPayload }),
    'Invalid envelope expected array of 2 elements'
  )
})

envelope('should reject non-bytes signature', async () => {
  const payload = await invocationPayload()

  assertDecodeError(
    cbor.encode(['signature', { h, 'ucan/inv@1.0.0': payload }]),
    'Invalid envelope signature expected bytes'
  )
})

envelope('should reject invalid signature payload shapes', async () => {
  const payload = await invocationPayload()

  assertDecodeError(
    await signEnvelope({ h, 'ucan/inv@1.0.0': payload, x: 1 }),
    'Invalid signature payload expected 2 keys'
  )
  assertDecodeError(
    await signEnvelope({ 'ucan/inv@1.0.0': payload }),
    'Invalid signature payload expected 2 keys'
  )
  assertDecodeError(
    await signEnvelope({ hh: h, 'ucan/inv@1.0.0': payload }),
    'Invalid signature payload missing h'
  )
  assertDecodeError(
    await signEnvelope({ h: 'h', 'ucan/inv@1.0.0': payload }),
    'Invalid signature payload h expected bytes'
  )
  assertDecodeError(
    await signEnvelope({ h, 'ucan/inv@1.0.0': [] }),
    'Invalid signature payload ucan/inv@1.0.0 expected object'
  )
  assertDecodeError(
    cbor.encode([new Uint8Array(64), []]),
    'Invalid signature payload expected object got array'
  )
})

envelope(
  'should reject non-canonical signature payload key order',
  async () => {
    const payload = await invocationPayload()
    const signature = await mocks.bob.sign(
      cbor.encode({ h, 'ucan/inv@1.0.0': payload })
    )
    // [signature, { "ucan/inv@1.0.0": payload, h }]
    const bytes = concat(
      0x82,
      cbor.encode(signature),
      0xa2,
      cbor.encode('ucan/inv@1.0.0'),
      cbor.encode(payload),
      cbor.encode('h'),
      cbor.encode(h)
    )

    assertDecodeError(
      bytes,
      'Invalid signature payload keys are not in canonical DAG-CBOR order'
    )
  }
)

envelope('should reject trailing bytes in the varsig header', async () => {
  const payload = await invocationPayload()

  assertDecodeError(
    await signEnvelope({ h: concat(h, 0x00), 'ucan/inv@1.0.0': payload }),
    'Invalid varsig header 1 trailing byte(s)'
  )
})

envelope('decodeSignaturePayload should validate', async () => {
  const payload = await invocationPayload()

  const decoded = Envelope.decodeSignaturePayload(
    cbor.encode({ h, 'ucan/inv@1.0.0': payload })
  )
  assert.equal(decoded.spec, 'inv')
  assert.equal(decoded.version, '1.0.0')
  assert.equal(decoded.alg, 'Ed25519')
  assert.equal(decoded.enc, 'DAG-CBOR')
  assert.deepEqual(decoded.payload, payload)

  assert.throws(
    () =>
      Envelope.decodeSignaturePayload(
        cbor.encode({ h, 'ucan/inv@9.9.9': payload })
      ),
    /TypeError: Unsupported payload tag version "9.9.9"/
  )
})

envelope('getSignaturePayload should only build supported tags', () => {
  const payload = /** @type {any} */ ({})

  const sigPayload = Envelope.getSignaturePayload({
    spec: 'dlg',
    signatureType: 'Ed25519',
    payload,
  })
  assert.deepEqual(Object.keys(sigPayload), ['h', 'ucan/dlg@1.0.0'])

  assert.throws(
    () =>
      Envelope.getSignaturePayload({
        spec: 'inv',
        version: '9.9.9',
        signatureType: 'Ed25519',
        payload,
      }),
    /TypeError: Unsupported payload tag version "9.9.9"/
  )
})
