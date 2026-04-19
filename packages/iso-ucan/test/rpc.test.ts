import { assert, suite } from 'playwright-test/taps'
import {
  defineClient,
  defineServer,
  type ServerHandlers,
} from '../src/rpc/index.js'
import * as Protocol from './fixtures/protocol.js'
import * as mocks from './mocks.js'

const rpc = suite('rpc')

/**
 * Build a fresh client/server pair backed by an in-memory store, with the
 * delegations needed for `alice` to invoke `bob`'s account commands.
 */
async function setup(
  handlers: Partial<ServerHandlers<typeof Protocol>> = defaultHandlers
) {
  const store = mocks.createStore()

  await store.add([
    await Protocol.AccountCommand.capability.delegate({
      iss: mocks.bob,
      aud: mocks.alice.did,
      sub: mocks.bob.did,
      pol: [],
      store,
    }),
    await Protocol.AccountCreateCommand.capability.delegate({
      iss: mocks.bob,
      aud: mocks.alice.did,
      sub: mocks.bob.did,
      pol: [],
      store,
    }),
  ])

  const client = defineClient(Protocol, {
    url: 'http://localhost:3000',
    issuer: mocks.alice,
    audience: mocks.bob.didObject,
    store,
    verifierResolver: mocks.verifierResolver,
  })

  const server = defineServer(Protocol, {
    signer: mocks.bob,
    store,
    verifierResolver: mocks.verifierResolver,
    handlers: handlers as ServerHandlers<typeof Protocol>,
  })

  return { store, client, server }
}

const defaultHandlers: ServerHandlers<typeof Protocol> = {
  '/account': ({ args, invocation }) => {
    if (args.name === 'missing') {
      return {
        cid: invocation.cid,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found.',
          data: { name: args.name },
        },
      }
    }
    return {
      cid: invocation.cid,
      result: { name: args.name, id: '123444' },
    }
  },
  '/account/create': ({ args, invocation }) => ({
    cid: invocation.cid,
    result: { name: args.name },
  }),
}

/**
 * Helper to send a {@link Request} to a server using a body buffer.
 */
function postTo(
  server: (request: Request) => Promise<Response>,
  body: BodyInit
) {
  return server(new Request('http://localhost:3000', { method: 'POST', body }))
}

rpc('client.invoke builds an invocation without sending', async () => {
  const { client } = await setup()

  const invocation = await client.invoke({
    cmd: '/account',
    args: { name: 'John Doe', createdAt: Date.now() },
  })

  assert.ok(invocation)
  assert.equal(invocation.payload.cmd, '/account')
})

rpc('client.invoke throws when cmd is unknown', async () => {
  const { client } = await setup()

  await assert.rejects(
    // @ts-expect-error - cmd is not in the protocol
    client.invoke({ cmd: '/unknown', args: {} }),
    { message: 'Command not found: /unknown' }
  )
})

rpc('client.request returns a successful result receipt', async () => {
  const { client, server } = await setup()
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account',
    args: { name: 'John Doe', createdAt: Date.now() },
  })

  assert.ok('result' in receipt, 'expected a result receipt')
  if ('result' in receipt) {
    assert.equal(receipt.result.name, 'John Doe')
    assert.equal(receipt.result.id, '123444')
    assert.ok(receipt.cid, 'expected cid on the receipt')
  }
})

rpc('client.request returns a command-defined error receipt', async () => {
  const { client, server } = await setup()
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account',
    args: { name: 'missing', createdAt: Date.now() },
  })

  assert.ok('error' in receipt, 'expected an error receipt')
  if ('error' in receipt && receipt.error.code === 'NOT_FOUND') {
    assert.equal(receipt.error.message, 'Account not found.')
    assert.deepEqual(receipt.error.data, { name: 'missing' })
    assert.ok('cid' in receipt && receipt.cid, 'expected cid on the receipt')
  }
})

rpc('client.request dispatches to multiple commands', async () => {
  const { client, server } = await setup()
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account/create',
    args: { name: 'new-account', createdAt: Date.now() },
  })

  assert.ok('result' in receipt, 'expected a result receipt')
  if ('result' in receipt) {
    assert.equal(receipt.result.name, 'new-account')
  }
})

rpc('server returns INVALID_INVOCATION for malformed bytes', async () => {
  const { server } = await setup()

  const response = await postTo(server, new Uint8Array([0, 1, 2, 3]))

  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.error.code, 'SERVER_ERROR')
  assert.ok(body.error.message.startsWith('Invalid invocation:'))
})

rpc('server returns HANDLER_ERROR when handler throws', async () => {
  const { client, server } = await setup({
    ...defaultHandlers,
    '/account': () => {
      throw new Error('boom')
    },
  })
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account',
    args: { name: 'John Doe', createdAt: Date.now() },
  })

  assert.ok('error' in receipt, 'expected an error receipt')
  if ('error' in receipt && receipt.error.code === 'SERVER_ERROR') {
    assert.equal(receipt.error.message, 'boom')
    assert.deepEqual(receipt.error.data, { cmd: '/account' })
  }
})

rpc('server returns HANDLER_NOT_FOUND when handler is missing', async () => {
  const { client, server } = await setup({
    '/account/create': defaultHandlers['/account/create'],
  })
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account',
    args: { name: 'John Doe', createdAt: Date.now() },
  })

  assert.ok('error' in receipt, 'expected an error receipt')
  if ('error' in receipt && receipt.error.code === 'SERVER_ERROR') {
    assert.equal(receipt.error.message, 'Handler not found: /account')
    assert.deepEqual(receipt.error.data, { cmd: '/account' })
  }
})

rpc('server returns INVALID_RECEIPT for malformed handler output', async () => {
  const { client, server } = await setup({
    ...defaultHandlers,
    '/account': ({ invocation }) =>
      ({
        cid: invocation.cid,
        // missing `result` and `error` — invalid for the receipt schema
      }) as never,
  })
  globalThis.fetch = (_url, init) => postTo(server, init?.body as BodyInit)

  const receipt = await client.request({
    cmd: '/account',
    args: { name: 'John Doe', createdAt: Date.now() },
  })

  assert.ok('error' in receipt, 'expected an error receipt')
  if ('error' in receipt && receipt.error.code === 'SERVER_ERROR') {
    assert.equal(receipt.error.message, 'Invalid receipt for /account')
  }
})

rpc('client throws when response is not a valid receipt', async () => {
  const { client } = await setup()
  globalThis.fetch = async () => Response.json({ unexpected: true })

  await assert.rejects(
    client.request({
      cmd: '/account',
      args: { name: 'John Doe', createdAt: Date.now() },
    }),
    {
      message:
        'Invalid receipt: response must include a `result` or `error` field',
    }
  )
})
