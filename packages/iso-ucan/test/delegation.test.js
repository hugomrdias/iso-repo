import { base64 } from 'iso-base/rfc4648'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { ES256KSigner } from 'iso-signatures/signers/es256k.js'
import { verify } from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { randomBytes } from 'iso-web/crypto'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'
import { cid, nowInSeconds } from '../src/utils.js'

const secp256k1 = ES256KSigner.generate()
const owner = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()
const verifierResolver = new Resolver({
  Ed25519: verify,
})

const proofs = suite('delegation')

proofs('should fail to parse non did', async () => {
  await assert.rejects(
    Delegation.create({
      // @ts-expect-error
      iss: 'owner',
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
    }),
    {
      name: 'TypeError',
      message: 'Invalid DID "owner"',
    }
  )

  await assert.rejects(
    Delegation.create({
      iss: owner,
      // @ts-expect-error
      aud: 'audience',
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
    }),
    {
      name: 'TypeError',
      message: 'Invalid DID "audience"',
    }
  )
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      // @ts-expect-error
      sub: 'subject',
      pol: [],
      cmd: '/account/create',
    }),
    {
      name: 'TypeError',
      message: 'Invalid DID "subject"',
    }
  )
  await assert.doesNotReject(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: null,
      pol: [],
      cmd: '/account/create',
    }),
    TypeError,
    'should not throw if sub is null'
  )
})

proofs('should fail to parse invalid cmd', async () => {
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      // @ts-expect-error
      cmd: 10,
    }),
    {
      name: 'TypeError',
      message:
        'Invalid command: Input must be a string, but received type number',
    }
  )

  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: 'invalid',
    }),
    {
      name: 'TypeError',
      message:
        'Invalid command: Must begin with a slash (/). Received: "invalid"',
    }
  )

  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/ff/',
    }),
    {
      name: 'TypeError',
      message:
        'Invalid command: Must not have a trailing slash. Received: "/ff/"',
    }
  )

  await assert.doesNotReject(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/',
    }),
    TypeError,
    'should not throw if cmd is /'
  )

  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/FFF',
    }),
    {
      name: 'TypeError',
      message: 'Invalid command: Must be lowercase. Received: "/FFF"',
    }
  )

  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/f//ss',
    }),
    {
      name: 'TypeError',
      message:
        'Invalid command: Must not contain empty segments (e.g., "//"). Received: "/f//ss"',
    }
  )
})

proofs('should fail to parse invalid nonce', async () => {
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      // @ts-expect-error
      nonce: 10,
    }),
    {
      name: 'TypeError',
      message: 'Invalid nonce: Expected Uint8Array, got [object Number]',
    }
  )

  await assert.doesNotReject(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      nonce: new Uint8Array([1, 2, 3]),
    }),
    TypeError,
    'should not throw if nonce is a Uint8Array'
  )
})

proofs('should fail to parse invalid expiration', async () => {
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      // @ts-expect-error
      exp: 'invalid',
    }),
    {
      name: 'TypeError',
      message:
        'UCAN expiration must be null or a safe integer. Received: invalid',
    }
  )
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      exp: nowInSeconds() - 1000,
    }),
    /UCAN expiration must be in the future/
  )

  await assert.doesNotReject(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      exp: null,
    }),
    TypeError,
    'should not throw if exp is null'
  )
})

proofs('should fail to parse invalid meta', async () => {
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      // @ts-expect-error
      meta: 10,
    }),
    {
      name: 'TypeError',
      message:
        'Invalid meta: ✖ Invalid input: expected record, received number',
    }
  )
  await assert.rejects(
    Delegation.create({
      iss: owner,
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      // @ts-expect-error
      meta: { hello: new Date(), invalid: { hello: new Date() } },
    }),
    {
      name: 'TypeError',
      message:
        'Invalid meta: ✖ Invalid input\n  → at hello\n✖ Invalid input\n  → at invalid',
    }
  )
})

proofs('should fail to validate not before', async () => {
  const delegation = await Delegation.create({
    iss: owner,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
    cmd: '/account/create',
    nbf: nowInSeconds() + 1000,
  })
  await assert.rejects(
    delegation.validate({
      verifierResolver,
    }),
    {
      name: 'Error',
      message: 'UCAN not valid yet',
    }
  )
})

proofs(
  'should fail to validate issuer and signature alg mismatch',
  async () => {
    const nonce = randomBytes(12)

    /** @type {import('../src/types.js').DelegationPayload} */
    const payload = {
      iss: owner.toString(),
      aud: invoker.did,
      sub: owner.did,
      pol: [],
      cmd: '/account/create',
      nonce,
      exp: null,
    }

    const { signature, signaturePayload } = await Envelope.sign({
      spec: 'dlg',
      signer: secp256k1,
      payload,
    })

    const bytes = Envelope.encode({ signature, signaturePayload })

    /** @type {import('../src/types.js').DecodedEnvelope<'dlg'>} */
    const envelope = {
      alg: secp256k1.signatureType,
      enc: 'DAG-CBOR',
      signature,
      payload,
      spec: 'dlg',
      version: Envelope.VERSION,
    }

    const delegation = new Delegation(envelope, bytes, await cid(envelope))

    await assert.rejects(
      delegation.validate({
        verifierResolver,
      }),
      {
        name: 'Error',
        message:
          'UCAN issuer type mismatch: DID Ed25519 and Signature ES256K are not compatible',
      }
    )
  }
)

proofs('should fail to validate verify signature', async () => {
  const nonce = randomBytes(12)

  /** @type {import('../src/types.js').DelegationPayload} */
  const payload = {
    iss: owner.toString(),
    aud: invoker.did,
    sub: owner.did,
    pol: [],
    cmd: '/account/create',
    nonce,
    exp: null,
  }

  const { signature, signaturePayload } = await Envelope.sign({
    spec: 'dlg',
    signer: secp256k1,
    payload,
  })

  const bytes = Envelope.encode({ signature, signaturePayload })

  /** @type {import('../src/types.js').DecodedEnvelope<'dlg'>} */
  const envelope = {
    alg: owner.signatureType,
    enc: 'DAG-CBOR',
    signature,
    payload,
    spec: 'dlg',
    version: Envelope.VERSION,
  }

  const delegation = new Delegation(envelope, bytes, await cid(envelope))

  await assert.rejects(
    delegation.validate({
      verifierResolver,
    }),
    {
      name: 'Error',
      message: 'UCAN signature verification failed',
    }
  )
})

proofs('should fail to validate if revoked', async () => {
  const delegation = await Delegation.create({
    iss: owner,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
    cmd: '/account/create',
  })
  await assert.rejects(
    delegation.validate({
      verifierResolver,
      isRevoked: () => Promise.resolve(true),
    }),
    {
      name: 'Error',
      message: 'UCAN revoked',
    }
  )
})

proofs('should reject non-canonical bytes', async () => {
  const delegation = await Delegation.create({
    iss: owner,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
    cmd: '/account/create',
    meta: { x: 1.5 },
  })
  // Same envelope with `1.5` as a float16 instead of the canonical float64
  const float64 = [0xfb, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0]
  const at = delegation.bytes.findIndex((_, i) =>
    float64.every((b, j) => delegation.bytes[i + j] === b)
  )
  assert.ok(at > 0)
  const bytes = new Uint8Array([
    ...delegation.bytes.subarray(0, at),
    0xf9,
    0x3e,
    0x00,
    ...delegation.bytes.subarray(at + float64.length),
  ])

  const message =
    'UCAN envelope is not canonical DAG-CBOR, re-encoding does not match the received bytes'
  await assert.rejects(Delegation.from({ bytes, verifierResolver }), {
    name: 'TypeError',
    message,
  })
  await assert.rejects(Delegation.fromString(base64.encode(bytes)), {
    name: 'TypeError',
    message,
  })

  const decoded = await Delegation.from({
    bytes: delegation.bytes,
    verifierResolver,
  })
  assert.ok(decoded.cid.equals(delegation.cid))
})
