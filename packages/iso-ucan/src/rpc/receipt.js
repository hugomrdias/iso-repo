import { CID } from 'multiformats/cid'
import { z } from 'zod/v4'

/**
 * @import {z as zType} from 'zod/v4'
 */

/**
 * Schema for an Invocation CID.
 *
 * Accepts a {@link CID} instance (server-side construction), a CID string,
 * or the dag-json `{ "/": "<cid>" }` form (which is what `CID.toJSON()`
 * produces when serialized through `JSON.stringify`) and normalizes to a
 * {@link CID}.
 */
export const cidSchema = z.union([
  z.instanceof(CID),
  z
    .union([z.string(), z.object({ '/': z.string() }).transform((v) => v['/'])])
    .transform((value, ctx) => {
      try {
        return CID.parse(value)
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid CID: ${
            error instanceof Error ? error.message : String(error)
          }`,
        })
        return z.NEVER
      }
    }),
])

/**
 * Schema for a successful receipt: `{ cid, result }`.
 *
 * @template {zType.ZodType} ResultSchema
 * @param {ResultSchema} result Schema for the `result` payload.
 * @returns {zType.ZodObject<{ cid: typeof cidSchema, result: ResultSchema }>}
 */
export function receiptResult(result) {
  return z.object({
    cid: cidSchema,
    result,
  })
}

/**
 * Schema for an error receipt: `{ cid, error: { code, message, data } }`.
 *
 * `code` and `message` are encoded as Zod literals so each error variant is
 * distinguishable in the resulting union.
 *
 * @template {string} Code
 * @template {string} Message
 * @template {zType.ZodType} DataSchema
 * @param {Code} code
 * @param {Message} message
 * @param {DataSchema} data Schema for the structured error `data` payload.
 * @returns {zType.ZodObject<{
 *   cid: typeof cidSchema,
 *   error: zType.ZodObject<{
 *     code: zType.ZodLiteral<Code>,
 *     message: zType.ZodLiteral<Message>,
 *     data: DataSchema,
 *   }>,
 * }>}
 */
export function receiptError(code, message, data) {
  return z.object({
    cid: cidSchema,
    error: z.object({
      code: z.literal(code),
      message: z.literal(message),
      data,
    }),
  })
}

/**
 * Generic schema for server-emitted internal errors.
 *
 * Unlike {@link receiptError} (which is part of the per-command receipt
 * schema with literal `code`/`message`), this schema is emitted by the
 * server for any error that happens outside of normal handler execution
 * (invalid invocation, command not found, args validation failure, handler
 * threw, etc.).
 *
 * `cid` is optional because some errors happen before the invocation can
 * be decoded.
 *
 * Automatically included as a variant in every command receipt produced by
 * {@link receipt}, so the client always knows how to validate and discriminate
 * a server error from a normal receipt.
 */
export const receiptServerError = z.object({
  error: z.object({
    code: z.literal('SERVER_ERROR'),
    message: z.string(),
    cid: cidSchema.optional(),
    data: z.unknown().optional(),
  }),
})

/**
 * @typedef {zType.infer<typeof receiptServerError>} ReceiptServerError
 */

/**
 * Combine one {@link receiptResult} schema and zero or more
 * {@link receiptError} schemas into a single discriminated receipt schema.
 *
 * The {@link receiptServerError} schema is always appended as the last
 * variant of the union so every command receipt accepts a server-emitted
 * internal error in addition to its declared result/error variants.
 *
 * The resulting schema validates one of:
 *   - `{ cid, result }`
 *   - `{ cid, error: { code, message, data } }` (one of the declared command errors)
 *   - `{ error: { code, message, cid?, data? } }` (a generic server error)
 *
 * Consumers discriminate via `'result' in receipt` / `'error' in receipt`,
 * and within the error branch via the `code` field.
 *
 * @template {zType.ZodType} Result
 * @template {zType.ZodType} Error
 * @param {Result} result
 * @param {...Error} errors
 * @returns {zType.ZodUnion<readonly [Result, ...Error[], typeof receiptServerError]>}
 */
export function receipt(result, ...errors) {
  return /** @type {any} */ (
    z.union(/** @type {any} */ ([result, ...errors, receiptServerError]))
  )
}
