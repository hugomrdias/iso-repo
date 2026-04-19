/**
 * CLI client.
 *
 * Usage:
 *   pnpm cli list
 *   pnpm cli add "<text>"
 *   pnpm cli complete <id>
 *
 * On startup the CLI seeds an in-memory store with deterministic delegations
 * (see `bootstrap.ts`) so the proofs referenced by every invocation can be
 * resolved by the server's matching local store.
 */
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { defineClient } from 'iso-ucan/rpc'
import { Store } from 'iso-ucan/store'
import { bootstrap } from './bootstrap.ts'
import { cliSigner, serverSigner, verifierResolver } from './keys.ts'
import { Protocol } from './protocol.ts'

const URL = process.env.RPC_URL ?? 'http://localhost:4000/rpc'

const store = new Store(new MemoryDriver())
await bootstrap(store)
const client = defineClient(Protocol, {
  url: URL,
  issuer: cliSigner,
  audience: serverSigner.didObject,
  store,
  verifierResolver,
})

/** Print a receipt and exit with a non-zero code on errors. */
function report(receipt: unknown): void {
  if (receipt && typeof receipt === 'object' && 'result' in receipt) {
    console.log(JSON.stringify(receipt.result, null, 2))
    return
  }
  if (
    receipt &&
    typeof receipt === 'object' &&
    'error' in receipt &&
    receipt.error &&
    typeof receipt.error === 'object'
  ) {
    const error = receipt.error as {
      code: string
      message: string
      data?: unknown
    }
    console.error(`[${error.code}] ${error.message}`)
    if (error.data !== undefined) {
      console.error(JSON.stringify(error.data, null, 2))
    }
    process.exit(1)
  }
  console.error('unexpected receipt:', receipt)
  process.exit(1)
}

const [command, ...rest] = process.argv.slice(2)

try {
  switch (command) {
    case 'list': {
      report(await client.request({ cmd: '/todo/list', args: {} }))
      break
    }
    case 'add': {
      const text = rest.join(' ').trim()
      if (!text) {
        console.error('usage: cli add "<text>"')
        process.exit(2)
      }
      report(await client.request({ cmd: '/todo/add', args: { text } }))
      break
    }
    case 'complete': {
      const [id] = rest
      if (!id) {
        console.error('usage: cli complete <id>')
        process.exit(2)
      }
      report(await client.request({ cmd: '/todo/complete', args: { id } }))
      break
    }
    default: {
      console.error('usage: cli <list|add|complete> [args...]')
      process.exit(2)
    }
  }
} catch (error) {
  console.error(
    'request failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
}
