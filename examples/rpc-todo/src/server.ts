/**
 * Hono server exposing the todo protocol over a single `POST /rpc`
 * endpoint backed by `defineServer` from `iso-ucan/rpc`.
 */
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { defineServer } from 'iso-ucan/rpc'
import { Store } from 'iso-ucan/store'
import type { ServerHandlers } from 'iso-ucan/types'
import { bootstrap } from './bootstrap.ts'
import { serverSigner, verifierResolver } from './keys.ts'
import { Protocol, type Todo } from './protocol.ts'

const PORT = Number(process.env.PORT ?? 4000)

const store = new Store(new MemoryDriver())
await bootstrap(store)

/**
 * In-memory todo database. A real server would persist this to disk or a
 * database; using a `Map` keeps the example focused on the RPC layer.
 */
const todos = new Map<string, Todo>()
let nextId = 1
function createTodo(text: string): Todo {
  const todo: Todo = { id: String(nextId++), text, done: false }
  todos.set(todo.id, todo)
  return todo
}

const handlers: ServerHandlers<typeof Protocol> = {
  '/todo/list': ({ invocation }) => ({
    cid: invocation.cid,
    result: { todos: [...todos.values()] },
  }),

  '/todo/add': ({ args, invocation }) => ({
    cid: invocation.cid,
    result: { todo: createTodo(args.text) },
  }),

  '/todo/complete': ({ args, invocation }) => {
    const todo = todos.get(args.id)
    if (!todo) {
      return {
        cid: invocation.cid,
        error: {
          code: 'NOT_FOUND',
          message: 'Todo not found.',
          data: { id: args.id },
        },
      }
    }
    todo.done = true
    return { cid: invocation.cid, result: { todo } }
  },
}

const rpc = defineServer(Protocol, {
  signer: serverSigner,
  store,
  verifierResolver,
  handlers,
})

const app = new Hono()
app.get('/', (c) =>
  c.json({
    name: 'rpc-todo',
    audience: serverSigner.did,
    commands: Object.keys(handlers),
  })
)
app.post('/rpc', (c) => rpc(c.req.raw))

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[rpc-todo] server ready on http://localhost:${info.port}`)
  console.log(`[rpc-todo] audience: ${serverSigner.did}`)
})
