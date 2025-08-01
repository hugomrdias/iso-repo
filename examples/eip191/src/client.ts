import { base64pad } from 'iso-base/rfc4648'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import * as EdDSA from 'iso-signatures/verifiers/eddsa.js'
import * as EIP191 from 'iso-signatures/verifiers/eip191.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { createClient } from 'iso-ucan/client'
import { Delegation } from 'iso-ucan/delegation'
import { Store } from 'iso-ucan/store'
import { capabilities } from '../worker/capabilities'
import type { Protocol } from '../worker/router'

const issuer = await EdDSASigner.import(
  'gCYA//n3JI0gzjSa+w2RvMVDgO8M1a9iCaJjjM+n3PB4ZQ=='
)
const audience = await EdDSASigner.import(
  'gCZx8eS6eh6NR1yuz4Ru78uCFGwr3ORwuAHzhabEu0zM/g=='
)

export const resolver = new Resolver({
  ...EdDSA.verifier,
  ...EIP191.verifier,
})
export const store = new Store(new MemoryDriver())

// const delegation1 = await Delegation.from({
//   bytes: base64pad.decode(
//     'glhApGlsy06H1NFEhHmtHe4KNCcOjRkEj/Ze1gCw9WZXJsW6cZFTxXRuSc4Z5K66acMyue9b6X/DJ9wawMEGKrUEBaJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xp2NhdWR4OGRpZDprZXk6ejZNa3V1R3hrQ0FtZlY2Mnc3Vlg2OTJnZ1d6OXFuZjhqTlBqUXVWYUJ2ZnpueThnY2NtZG8vYWNjb3VudC9jcmVhdGVjZXhw9mNpc3N4OGRpZDprZXk6ejZNa3FGc0RzbTh5bzJ2VEVIWXN0ak1taVhhVWFmSndXZERFOFJXSjhXTUZyMzVGY3BvbIBjc3VieDhkaWQ6a2V5Ono2TWtxRnNEc204eW8ydlRFSFlzdGpNbWlYYVVhZkp3V2RERThSV0o4V01GcjM1RmVub25jZUzmFzqW9dAm218FqzA='
//   ),
//   verifierResolver: resolver,
// })

// await store.add([delegation1])

// export const client = createClient<Protocol>({
//   url: '/ucan',
//   issuer,
//   audience: audience.didObject,
//   store,
//   capabilities: [...capabilities],
// })
