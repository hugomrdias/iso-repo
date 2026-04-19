import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ISigner } from 'iso-signatures/types'
import type { Capability } from '../capability.js'
import type { Invocation } from '../invocation.js'
import type { Store } from '../store.js'
import type { ClientOptions, Promisable, VerifierResolver } from '../types.js'

export interface CommandOptions<
  Args extends StandardSchemaV1,
  Cmd extends string = string,
  ReceiptSchema extends StandardSchemaV1 = StandardSchemaV1,
> {
  cmd: Cmd
  args: Args
  receipt: ReceiptSchema
}

export interface CommandOutput<
  Args extends StandardSchemaV1,
  Cmd extends string = string,
  ReceiptSchema extends StandardSchemaV1 = StandardSchemaV1,
> {
  capability: Capability<Args, Cmd>
  receipt: ReceiptSchema
}

export type AnyCommand = CommandOutput<
  StandardSchemaV1,
  string,
  StandardSchemaV1
>

export type CommandsRecord = Record<string, AnyCommand>

/**
 * Union of `{cmd, args, receipt}` shapes derived from a commands record.
 * Used to discriminate `request` calls by `cmd`.
 *
 * `args` is the schema's input type (what the caller provides) and `receipt`
 * is the schema's output type (what the caller receives back).
 */
export type CommandUnion<Commands extends CommandsRecord> = {
  [K in keyof Commands]: Commands[K] extends CommandOutput<
    infer Args,
    infer Cmd,
    infer ReceiptSchema
  >
    ? {
        cmd: Cmd
        args: StandardSchemaV1.InferInput<Args>
        receipt: StandardSchemaV1.InferOutput<ReceiptSchema>
      }
    : never
}[keyof Commands]

/**
 * Server-side counterpart to {@link CommandUnion}: `args` is the schema's
 * output (validated value passed to the handler) and `receipt` is the
 * schema's input — the full receipt object, including `cid`, that the
 * handler is responsible for constructing (typically using `invocation.cid`).
 */
export type ServerCommandUnion<Commands extends CommandsRecord> = {
  [K in keyof Commands]: Commands[K] extends CommandOutput<
    infer Args,
    infer Cmd,
    infer ReceiptSchema
  >
    ? {
        cmd: Cmd
        args: StandardSchemaV1.InferOutput<Args>
        receipt: StandardSchemaV1.InferInput<ReceiptSchema>
      }
    : never
}[keyof Commands]

/**
 * Options for {@link defineClient}.
 *
 * Same as {@link ClientOptions} but the `capabilities` are derived from the
 * commands record passed as the first argument.
 */
export type DefineClientOptions = Omit<ClientOptions, 'capabilities'>

/**
 * Options for {@link CommandClient.request}.
 */
export type RequestOptions<
  Commands extends CommandsRecord,
  Cmd extends CommandUnion<Commands>['cmd'] = CommandUnion<Commands>['cmd'],
> = {
  cmd: Cmd
  args: Extract<CommandUnion<Commands>, { cmd: Cmd }>['args']
}

/**
 * Type-safe client built from a record of commands.
 */
export interface CommandClient<Commands extends CommandsRecord> {
  request<Cmd extends CommandUnion<Commands>['cmd']>(
    options: RequestOptions<Commands, Cmd>
  ): Promise<Extract<CommandUnion<Commands>, { cmd: Cmd }>['receipt']>
  invoke<Cmd extends CommandUnion<Commands>['cmd']>(
    options: RequestOptions<Commands, Cmd>
  ): Promise<Invocation>
}

/**
 * Options passed to a server handler.
 *
 * `args` is the validated/decoded args from the command's schema.
 */
export interface ServerHandlerOptions<Args> {
  args: Args
  invocation: Invocation
  signer: ISigner
  store: Store
}

/**
 * Map of server handlers keyed by `cmd`, derived from a commands record.
 *
 * Each handler receives args typed as the command's args schema output and
 * must return a value matching the command's receipt schema input.
 */
export type ServerHandlers<Commands extends CommandsRecord> = {
  [Cmd in ServerCommandUnion<Commands>['cmd']]: (
    options: ServerHandlerOptions<
      Extract<ServerCommandUnion<Commands>, { cmd: Cmd }>['args']
    >
  ) => Promisable<
    Extract<ServerCommandUnion<Commands>, { cmd: Cmd }>['receipt']
  >
}

/**
 * Options for {@link defineServer}.
 */
export interface DefineServerOptions<Commands extends CommandsRecord> {
  handlers: ServerHandlers<Commands>
  /**
   * The server's signer. Used as the audience when decoding the incoming
   * invocation and passed through to handlers as `signer` so they can issue
   * receipts or further invocations.
   */
  signer: ISigner
  store: Store
  verifierResolver: VerifierResolver
}

/**
 * Handler for an incoming HTTP request, returned by {@link defineServer}.
 */
export type ServerRequestHandler = (request: Request) => Promise<Response>
