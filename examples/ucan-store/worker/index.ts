import { Hono } from 'hono'
import { base64pad } from 'iso-base/rfc4648'
import { u8 } from 'iso-base/utils'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import * as EdDSA from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { Delegation } from 'iso-ucan/delegation'
import { Invocation } from 'iso-ucan/invocation'
import { Store } from 'iso-ucan/store'
import { router } from './router'

const audience = await EdDSASigner.import(
  'gCZx8eS6eh6NR1yuz4Ru78uCFGwr3ORwuAHzhabEu0zM/g=='
)
const verifierResolver = new Resolver(
  {
    Ed25519: EdDSA.verify,
  },
  {}
)

const store = new Store(new MemoryDriver())

const delegation1 = await Delegation.from({
  bytes: base64pad.decode(
    'glhApGlsy06H1NFEhHmtHe4KNCcOjRkEj/Ze1gCw9WZXJsW6cZFTxXRuSc4Z5K66acMyue9b6X/DJ9wawMEGKrUEBaJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xp2NhdWR4OGRpZDprZXk6ejZNa3V1R3hrQ0FtZlY2Mnc3Vlg2OTJnZ1d6OXFuZjhqTlBqUXVWYUJ2ZnpueThnY2NtZG8vYWNjb3VudC9jcmVhdGVjZXhw9mNpc3N4OGRpZDprZXk6ejZNa3FGc0RzbTh5bzJ2VEVIWXN0ak1taVhhVWFmSndXZERFOFJXSjhXTUZyMzVGY3BvbIBjc3VieDhkaWQ6a2V5Ono2TWtxRnNEc204eW8ydlRFSFlzdGpNbWlYYVVhZkp3V2RERThSV0o4V01GcjM1RmVub25jZUzmFzqW9dAm218FqzA='
  ),
  verifierResolver,
})
await store.add([delegation1])

const app = new Hono()

app.get('/api', (c) => c.json({ name: 'Cloudflare' }))

app.post('/ucan', async (c) => {
  const inv = await Invocation.from({
    bytes: u8(await c.req.arrayBuffer()),
    audience,
    verifierResolver,
    resolveProof: store.resolveProof.bind(store),
  })
  inv.payload.cmd

  const route = router[inv.payload.cmd as keyof typeof router]
  if (!route) {
    return c.text('Route not found', 404)
  }

  console.log('route', inv.payload.args)

  const result = await route.fn({
    request: c.req.raw,
    issuer: audience,
    invocation: inv,
    store,
  })

  console.log('hello', inv.payload.cmd)
  return c.json(result)
})

export default app
