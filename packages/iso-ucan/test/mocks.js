import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import * as ECDSA from 'iso-signatures/verifiers/ecdsa.js'
import { verify } from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { z } from 'zod/v4'
import { Capability } from '../src/capability.js'
import { Store } from '../src/store.js'

export const carol = await EdDSASigner.import(
  'gCZC43QGw7ZvYQuKTtBwBy+tdjYrKf0hXU3dd+J0HON5dw=='
)
export const bob = await EdDSASigner.import(
  'gCZfj9+RzU2U518TMBNK/fjdGQz34sB4iKE6z+9lQDpCIQ=='
)
export const alice = await EdDSASigner.import(
  'gCa9UfZv+yI5/rvUIt21DaGI7EZJlzFO1uDc5AyJ30c6/w=='
)

export const verifierResolver = new Resolver({
  Ed25519: verify,
  ES256: ECDSA.verifier.ES256,
})

export const defaultStore = new Store(new MemoryDriver())

export function createStore() {
  return new Store(new MemoryDriver())
}

export const AccountCreateCap = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
})

export const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
})

export const TopCap = Capability.from({
  schema: z.never(),
  cmd: '/',
})

/** Group orders of the ECDSA curves */
const N = {
  ES256: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
  ES384:
    0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n,
  ES512:
    0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409n,
  ES256K: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
  EIP191: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
}

/**
 * The other valid ECDSA signature `(r, n - s)`. For EIP-191 the recovery byte
 * is flipped too, so the signature recovers the same key.
 *
 * @param {keyof typeof N} alg
 * @param {Uint8Array} signature
 */
export function flipS(alg, signature) {
  const size = alg === 'EIP191' ? 32 : signature.length / 2
  let s = 0n
  for (const b of signature.subarray(size, size * 2)) s = (s << 8n) | BigInt(b)
  let flipped = N[alg] - s
  const out = new Uint8Array(signature)
  for (let i = size * 2 - 1; i >= size; i--) {
    out[i] = Number(flipped & 0xffn)
    flipped >>= 8n
  }
  if (alg === 'EIP191') {
    out[64] = signature[64] === 27 ? 28 : 27
  }
  return out
}
