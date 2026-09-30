import { u8 } from 'iso-base/utils'
import { Invocation } from '../invocation.js'
import { KVReplayStore } from '../replay.js'

/**
 * @import {
 *   CommandsRecord,
 *   DefineServerOptions,
 *   ServerRequestHandler,
 * } from './types.js'
 * @import {ReceiptServerError} from './receipt.js'
 */

/**
 * Default maximum invocation lifetime accepted by {@link defineServer}, in
 * seconds. Twice the client default `ttl`, to tolerate clock skew.
 */
export const DEFAULT_MAX_TTL = 600

/**
 * Build a {@link ReceiptServerError} payload.
 *
 * @param {string} message
 * @param {{
 *   cid?: import('multiformats').CID,
 *   cmd?: string,
 *   issues?: readonly import('@standard-schema/spec').StandardSchemaV1.Issue[],
 * }} [extra]
 * @returns {ReceiptServerError}
 */
function buildServerError(message, extra) {
  /** @type {Record<string, unknown> | undefined} */
  let data
  if (extra?.cmd !== undefined || extra?.issues !== undefined) {
    data = {}
    if (extra.cmd !== undefined) data.cmd = extra.cmd
    if (extra.issues !== undefined) data.issues = extra.issues
  }

  /** @type {ReceiptServerError['error']} */
  const error = { code: 'SERVER_ERROR', message }
  if (data !== undefined) error.data = data
  if (extra?.cid !== undefined) error.cid = extra.cid
  return { error }
}

/**
 * Build a JSON {@link Response} for a server error.
 *
 * @param {number} status
 * @param {string} message
 * @param {Parameters<typeof buildServerError>[1]} [extra]
 */
function serverErrorResponse(status, message, extra) {
  return Response.json(buildServerError(message, extra), { status })
}

/**
 * Define a type-safe server from a record of commands.
 *
 * The returned function accepts a standard `Request`, decodes its body as a
 * UCAN {@link Invocation}, validates the args against the matching command's
 * schema, and dispatches to the corresponding handler in `options.handlers`.
 * The handler's return value is serialized to JSON.
 *
 * Each invocation is executed at most once: replays are rejected using
 * `options.replayStore`, which defaults to an in-memory {@link KVReplayStore}.
 * Pass a shared store when running more than one server instance.
 *
 * Invocations must expire within `options.maxTtl` seconds, which defaults to
 * {@link DEFAULT_MAX_TTL}. Pass `null` to accept any expiration.
 *
 * @template {CommandsRecord} Commands
 * @param {Commands} commands
 * @param {DefineServerOptions<Commands>} options
 * @returns {ServerRequestHandler}
 */
export function defineServer(commands, options) {
  /** @type {Record<string, CommandsRecord[string]>} */
  const commandMap = {}
  for (const command of Object.values(commands)) {
    commandMap[command.capability.cmd] = command
  }

  /** @type {Record<string, (opts: any) => unknown>} */
  const handlers = options.handlers
  const replayStore = options.replayStore ?? new KVReplayStore()
  const maxTtl =
    options.maxTtl === undefined
      ? DEFAULT_MAX_TTL
      : (options.maxTtl ?? undefined)

  return async (request) => {
    /** @type {Invocation | undefined} */
    let invocation

    try {
      const bytes = u8(await request.arrayBuffer())

      invocation = await Invocation.from({
        bytes,
        audience: options.signer,
        verifierResolver: options.verifierResolver,
        resolveProof: options.store.resolveProof.bind(options.store),
        replayStore,
        maxTtl,
      })
    } catch (error) {
      return serverErrorResponse(
        400,
        `Invalid invocation: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    const cid = invocation.cid
    const cmd = invocation.payload.cmd
    const command = commandMap[cmd]
    if (!command) {
      return serverErrorResponse(404, `Command not found: ${cmd}`, {
        cid,
        cmd,
      })
    }

    const handler = handlers[cmd]
    if (!handler) {
      return serverErrorResponse(404, `Handler not found: ${cmd}`, {
        cid,
        cmd,
      })
    }

    const validated = await command.capability.validate(
      /** @type {any} */ (invocation.payload.args)
    )
    if (validated.issues) {
      return serverErrorResponse(400, `Invalid args for ${cmd}`, {
        cid,
        cmd,
        issues: validated.issues,
      })
    }

    /** @type {unknown} */
    let receipt
    try {
      receipt = await handler({
        args: validated.value,
        invocation,
        signer: options.signer,
        store: options.store,
      })
    } catch (error) {
      return serverErrorResponse(
        500,
        error instanceof Error ? error.message : String(error),
        { cid, cmd }
      )
    }

    const validatedReceipt = await command.receipt['~standard'].validate(
      /** @type {any} */ (receipt)
    )
    if (validatedReceipt.issues) {
      return serverErrorResponse(500, `Invalid receipt for ${cmd}`, {
        cid,
        cmd,
        issues: validatedReceipt.issues,
      })
    }

    return Response.json(receipt)
  }
}
