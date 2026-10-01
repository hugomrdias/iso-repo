import { base64 } from 'iso-base/rfc4648'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { verify } from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { randomBytes } from 'iso-web/crypto'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'

const owner = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()
const verifierResolver = new Resolver({
  Ed25519: verify,
})

const test = suite('delegation policy validation')

/**
 * Policies that are not valid per the spec's IPLD schema, and that dag-cbor
 * can encode (so they can show up in a decoded delegation).
 */
const invalidPolicies = [
  [['bogus']],
  {},
  [['==', '.a']],
  [['like', '.a', 1]],
  [['all', 'a', ['==', '.', 1]]],
  [['==', '.foo-bar', 1]],
  [['==', '..a', 1]],
  [['>', '.a', '1']],
  [['and', [['==', '.a', 1], ['bogus']]]],
]

/**
 * Sign and encode a delegation without going through {@link Delegation.create},
 * so its payload is not validated.
 *
 * @param {unknown} pol
 */
async function encodeRaw(pol) {
  /** @type {import('../src/types.js').DelegationPayload} */
  const payload = {
    iss: owner.toString(),
    aud: invoker.did,
    sub: owner.did,
    pol: /** @type {any} */ (pol),
    cmd: '/account/create',
    nonce: randomBytes(12),
    exp: null,
  }
  const { signature, signaturePayload } = await Envelope.sign({
    spec: 'dlg',
    signer: owner,
    payload,
  })
  return Envelope.encode({ signature, signaturePayload })
}

test('create rejects invalid policies', async () => {
  for (const pol of [...invalidPolicies, [['==', '.a', undefined]]]) {
    await assert.rejects(
      Delegation.create({
        iss: owner,
        aud: invoker.did,
        sub: owner.did,
        pol: /** @type {any} */ (pol),
        cmd: '/account/create',
      }),
      { name: 'TypeError', message: /^Invalid policy/ },
      JSON.stringify(pol)
    )
  }
})

test('from and fromString reject invalid policies', async () => {
  for (const pol of invalidPolicies) {
    const bytes = await encodeRaw(pol)
    await assert.rejects(
      Delegation.from({ bytes, verifierResolver }),
      { name: 'TypeError', message: /^Invalid policy/ },
      JSON.stringify(pol)
    )
    await assert.rejects(
      Delegation.fromString(base64.encode(bytes)),
      { name: 'TypeError', message: /^Invalid policy/ },
      JSON.stringify(pol)
    )
  }
})

test('create, from and fromString accept valid policies', async () => {
  const pol = [
    ['==', '.from', 'alice@example.com'],
    ['!=', '.["a-b"]?', null],
    ['>', '.n', 2n ** 60n],
    ['any', '.to', ['like', '.', '*@example.com']],
    [
      'all',
      '.newsletters',
      ['any', '.recipients', ['==', '.email', 'bob@example.com']],
    ],
  ]
  const delegation = await Delegation.create({
    iss: owner,
    aud: invoker.did,
    sub: owner.did,
    pol: /** @type {any} */ (pol),
    cmd: '/account/create',
  })
  const fromBytes = await Delegation.from({
    bytes: delegation.bytes,
    verifierResolver,
  })
  assert.deepEqual(fromBytes.pol, pol)
  const fromString = await Delegation.fromString(
    base64.encode(delegation.bytes)
  )
  assert.deepEqual(fromString.pol, pol)
})
