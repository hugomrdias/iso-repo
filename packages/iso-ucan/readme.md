# iso-ucan [![NPM Version](https://img.shields.io/npm/v/iso-ucan.svg)](https://www.npmjs.com/package/iso-ucan) [![License](https://img.shields.io/npm/l/iso-ucan.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-ucan](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ucan.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ucan.yml)

> Isomorphic UCAN primitives for delegations, invocations, proof storage, and
> typed RPC.

## Overview

UCAN is a local-first authorization model where permissions are
cryptographically signed, delegated, and verified without relying on a central
authority. See [ucan.xyz](https://ucan.xyz/) for more background.

`iso-ucan` provides:

- Typed capabilities backed by schema validation.
- Delegation and invocation builders for UCAN authorization flows.
- Proof storage with pluggable `iso-kv` drivers.
- Signer and verifier support through `iso-signatures`.
- EIP-191 wallet signing support through `iso-signatures` `EIP191Signer`.
- Filsnap-powered UCAN signature insights in MetaMask signature popups.
- A typed RPC layer for request/response APIs built on UCAN invocations.

## Install

```bash
pnpm install iso-ucan
```

## Usage

```ts
import { Capability } from 'iso-ucan/capability'
import { Store } from 'iso-ucan/store'
import { MemoryDriver } from 'iso-kv/drivers/memory'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { z } from 'zod'

const store = new Store(new MemoryDriver())

const AccountCreateCap = Capability.from({
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

const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
})

const owner = await EdDSASigner.generate()
const bob = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()

const nowInSeconds = Math.floor(Date.now() / 1000)

const ownerDelegation = await AccountCap.delegate({
  iss: owner,
  aud: bob,
  sub: owner,
  pol: [],
  exp: nowInSeconds + 1000,
})

await store.set(ownerDelegation)

const bobDelegation = await AccountCap.delegate({
  iss: bob,
  aud: invoker,
  sub: owner,
  pol: [],
  exp: nowInSeconds + 1000,
})

await store.set(bobDelegation)

const invocation = await AccountCreateCap.invoke({
  iss: invoker,
  sub: owner,
  args: {
    type: 'account',
    properties: {
      name: 'John Doe',
    },
  },
  store,
  exp: nowInSeconds + 1000,
})
```

## EIP-191 wallet signing

`iso-ucan` can use EIP-191 wallet signatures through `EIP191Signer` from
`iso-signatures`. That lets UCAN delegations and invocations be issued by an
Ethereum account exposed through an EIP-1193 provider, such as an injected
MetaMask wallet, while verification is handled by the matching EIP-191 verifier
from `iso-signatures`.

[`examples/eip191`](../../examples/eip191) shows this flow in a browser web
app. It uses `wagmi` to connect the wallet, wraps the provider in
`EIP191Signer`, then creates and verifies UCAN delegations and invocations
directly in the browser.

The example uses `filsnap-adapter` to install or enable
[Filsnap](https://github.com/filecoin-project/filsnap), the Filecoin Wallet
MetaMask Snap. Filsnap supports UCAN signature insights for EIP-191 signers, so
when the app asks MetaMask to sign a UCAN delegation, the MetaMask signature
popup can show a readable summary of the issuer, audience, subject, command,
expiration, and raw payload.

## RPC

`iso-ucan/rpc` is a small request/response layer on top of UCAN
invocations. You declare a protocol once as a record of commands
(`defineCommand`), then build matching client and server pairs from it
(`defineClient` / `defineServer`). Every command's success and error shapes
are described by a single receipt schema (`receipt`, `receiptResult`,
`receiptError`) which is shared by both ends, so the call sites are fully
type-safe and discriminated unions just work on the client.

Internal server failures (invalid invocation, unknown command, handler
threw, …) are surfaced as a generic `SERVER_ERROR` variant that
`receipt(...)` adds implicitly, so clients can always handle them with one
narrow.

### Define a shared protocol

```ts
import {
  defineCommand,
  receipt,
  receiptError,
  receiptResult,
} from 'iso-ucan/rpc'
import { z } from 'zod'

const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
})

export const Protocol = {
  TodoList: defineCommand({
    cmd: '/todo/list',
    args: z.object({}),
    receipt: receipt(receiptResult(z.object({ todos: z.array(TodoSchema) }))),
  }),
  TodoAdd: defineCommand({
    cmd: '/todo/add',
    args: z.object({ text: z.string().min(1) }),
    receipt: receipt(receiptResult(z.object({ todo: TodoSchema }))),
  }),
  TodoComplete: defineCommand({
    cmd: '/todo/complete',
    args: z.object({ id: z.string() }),
    receipt: receipt(
      receiptResult(z.object({ todo: TodoSchema })),
      receiptError('NOT_FOUND', 'Todo not found.', z.object({ id: z.string() }))
    ),
  }),
} as const
```

### Server (e.g. Hono + `@hono/node-server`)

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { defineServer, type ServerHandlers } from 'iso-ucan/rpc'
import { Store } from 'iso-ucan/store'
import { Protocol } from './protocol.ts'

const store = new Store(new MemoryDriver())
// ...seed `store` with the delegations that authorise your clients...

const handlers: ServerHandlers<typeof Protocol> = {
  '/todo/list': ({ invocation }) => ({
    cid: invocation.cid,
    result: { todos: [/* ... */] },
  }),
  '/todo/add': ({ args, invocation }) => ({
    cid: invocation.cid,
    result: { todo: { id: '1', text: args.text, done: false } },
  }),
  '/todo/complete': ({ args, invocation }) => {
    // return either { cid, result: ... } or { cid, error: { code, message, data } }
    return {
      cid: invocation.cid,
      error: {
        code: 'NOT_FOUND',
        message: 'Todo not found.',
        data: { id: args.id },
      },
    }
  },
}

const rpc = defineServer(Protocol, {
  signer: serverSigner,
  store,
  verifierResolver,
  handlers,
})

const app = new Hono()
app.post('/rpc', (c) => rpc(c.req.raw))
serve({ fetch: app.fetch, port: 3000 })
```

### Client

```ts
import { defineClient } from 'iso-ucan/rpc'

const client = defineClient(Protocol, {
  url: 'http://localhost:3000/rpc',
  issuer: cliSigner,
  audience: serverSigner.didObject,
  store,
  verifierResolver,
})

// `args` and the returned receipt are typed from the protocol entry for `cmd`.
const r = await client.request({ cmd: '/todo/complete', args: { id: '42' } })

if ('result' in r) {
  console.log(r.result.todo)
} else if (r.error.code === 'NOT_FOUND') {
  console.error(r.error.message, r.error.data) // data: { id: string }
} else {
  // r.error.code === 'SERVER_ERROR' — always present in every receipt union.
  console.error('server error:', r.error.message)
}
```

A complete runnable example (Hono server + a small CLI client) lives in
[`examples/rpc-todo`](../../examples/rpc-todo).

## License

MIT © [Hugo Dias](http://hugodias.me)
