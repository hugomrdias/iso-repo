# rpc-todo

End-to-end example of `iso-ucan/rpc`: a Hono server (Node adapter) and a
small CLI client driven by a single shared protocol module.

## Layout

```
src/
├── protocol.ts   shared command + receipt schemas (used by both ends)
├── keys.ts       hardcoded dev signers + verifier resolver
├── server.ts     Hono server exposing POST /rpc
└── cli.ts        CLI client invoking commands over HTTP
```

The protocol defines three commands:

| cmd               | args              | result                  | errors      |
|-------------------|-------------------|-------------------------|-------------|
| `/todo/list`      | `{}`              | `{ todos: Todo[] }`     | —           |
| `/todo/add`       | `{ text }`        | `{ todo: Todo }`        | —           |
| `/todo/complete`  | `{ id }`          | `{ todo: Todo }`        | `NOT_FOUND` |

Every receipt also implicitly accepts the generic `SERVER_ERROR` variant
emitted by `defineServer` for internal failures (invalid invocation, command
not found, handler threw, etc).

## Running

Requires Node.js `>= 24` — TypeScript sources are executed directly via
Node's built-in type stripping (no bundler, no `tsx`, no flags).

In one terminal start the server:

```bash
pnpm server
```

In another terminal use the CLI:

```bash
pnpm cli add "buy milk"
pnpm cli add "ship it"
pnpm cli list
pnpm cli complete 1
pnpm cli complete 999   # → [NOT_FOUND] Todo not found.
```

## Auth model

- `serverSigner` is the audience for every invocation.
- `cliSigner` is the issuer.
- On startup the CLI seeds an in-memory store with one delegation per
  command (`iss = serverSigner`, `sub = serverSigner`, `aud = cliSigner`).
  Both private keys are checked into `keys.ts` because this is a local dev
  demo — never do this for real deployments.
