import type { StandardSchemaV1 } from '@standard-schema/spec'

export type { StandardSchemaV1 } from '@standard-schema/spec'

/** Single key segment accepted by an iso-kv compatible store. */
export type KvKeyPart = number | string | Date | BufferSource

/**
 * Composite iso-kv key.
 *
 * Effect caches use structured keys so callers can list or clear entries by
 * prefix, for example `['iso-effect', 'getMetadata']`.
 */
export type KvKey = KvKeyPart[]

/**
 * Minimal iso-kv surface used by `EffectRunner`.
 *
 * The full `iso-kv` `KV` class satisfies this interface, but custom stores can
 * implement just these methods when they need to plug in a different backend.
 */
export interface IKV {
  /** Reads a value by structured key. */
  get: <T = unknown>(key: KvKey) => Promise<T | undefined>
  /** Stores a value by structured key. */
  set: <T = unknown>(key: KvKey, value: T) => Promise<IKV>
  /** Deletes a value by structured key. */
  delete: (key: KvKey) => Promise<void>
}

/**
 * Rate-limit window duration.
 *
 * `"second"` and `"minute"` are conveniences for common windows. A number is
 * interpreted as milliseconds.
 */
export type RateLimitDuration = 'second' | 'minute' | number

/**
 * Effect rate-limit configuration.
 *
 * `false` disables rate limiting. Otherwise, `calls` unique cache misses are
 * allowed per duration window and overflow waits until later windows.
 */
export type RateLimit =
  | false
  | {
      /** Number of calls allowed within each window. */
      calls: number
      /** Window duration. */
      per: RateLimitDuration
    }

/**
 * Minimal logger available to effect handlers.
 *
 * The default runner logger is a no-op. Pass a custom logger when effects need
 * to share application or test logging.
 */
export interface Logger {
  debug: (message: string, params?: Record<string, unknown>) => void
  info: (message: string, params?: Record<string, unknown>) => void
  warn: (message: string, params?: Record<string, unknown>) => void
  error: (message: string, params?: Record<string, unknown>) => void
}

/**
 * Handle for an external-call effect created via `createEffect`.
 *
 * Effect descriptors are immutable and reusable. They do not own cache,
 * memoization, rate-limit, or stats state; that state is isolated inside each
 * `EffectRunner`.
 */
export interface Effect<Input = unknown, Output = unknown> {
  /** Unique effect name within a runner. Used in cache keys and error messages. */
  readonly name: string
  /** Schema used to validate and normalize raw call input. */
  readonly input: StandardSchemaV1<Input>
  /** Schema used to validate handler results and cached outputs. */
  readonly output: StandardSchemaV1<Output>
  /** Fixed-window limit applied to cache misses before handler execution. */
  readonly rateLimit: RateLimit
  /** Whether calls should use persistent cache when a runner has `kv`. */
  readonly cache: boolean
  /** Work function executed on cache miss after rate-limit capacity is acquired. */
  readonly handler: EffectHandler<Input, Output>
}

/**
 * Calls an effect with the given input and returns its validated output.
 *
 * This is the shape exposed as `context.effect` inside effect handlers for
 * nested calls.
 */
export type EffectCaller = <Input, Output>(
  effect: Effect<Input, Output>,
  input: Input
) => Promise<Output>

/**
 * Context passed to an effect handler.
 *
 * It provides the runner logger, nested effect calling, and a per-invocation
 * cache flag. The cache flag is mutable by design so handlers can skip
 * persistence for partial or failed responses.
 */
export interface EffectContext {
  /** Access the runner logger. */
  readonly log: Logger
  /** Call another effect through the same runner. */
  readonly effect: EffectCaller
  /**
   * Whether to persist this call's result. Defaults to the effect's `cache`
   * option; set to false inside the handler to skip caching this invocation.
   */
  cache: boolean
}

/**
 * Arguments passed to an effect handler.
 *
 * `input` is the parsed Standard Schema output, not necessarily the raw value
 * passed to `runner.call`.
 */
export interface EffectArgs<Input = unknown> {
  readonly input: Input
  readonly context: EffectContext
}

/**
 * Function that executes an effect on a cache miss.
 *
 * The function may be synchronous or asynchronous. Returned values are always
 * validated against the effect's output schema before callers receive them.
 */
export type EffectHandler<Input = unknown, Output = unknown> = (
  args: EffectArgs<Input>
) => Promise<Output> | Output

/**
 * Options accepted by `createEffect`.
 *
 * Schemas must implement Standard Schema v1 and validate synchronously. The
 * input schema output is used for both the handler argument and stable cache-key
 * generation.
 */
export interface EffectOptions<
  InputSchema extends StandardSchemaV1 = StandardSchemaV1,
  OutputSchema extends StandardSchemaV1 = StandardSchemaV1,
> {
  /** Unique effect name. Used for cache namespace and debugging. */
  readonly name: string
  /** Standard Schema used to validate and normalize inputs. */
  readonly input: InputSchema
  /** Standard Schema used to validate handler outputs and cached outputs. */
  readonly output: OutputSchema
  /**
   * Rate limit for this effect. Set to false or omit to disable rate limiting.
   */
  readonly rateLimit?: RateLimit
  /** Whether this effect should use the runner's persistent cache. */
  readonly cache?: boolean
}

/**
 * Options for creating an `EffectRunner`.
 *
 * Runners can be in-memory only, or backed by any `iso-kv` compatible store for
 * persistent caches shared across runner instances.
 */
export interface RunnerOptions {
  /**
   * Optional iso-kv instance for persistent effect caches. Without this,
   * effects still deduplicate in-flight calls and memoize results in memory.
   */
  kv?: IKV
  /** Optional handler logger. Defaults to no-op methods. */
  logger?: Logger
}

/**
 * Lightweight per-effect counters scoped to one runner.
 *
 * These counters are intended for tests, diagnostics, and basic observability.
 * They are not persisted and are not shared across runners.
 */
export interface EffectStats {
  /** Handler executions. Cache and memo hits do not increment this counter. */
  calls: number
  /** Persistent cache reads that produced valid output. */
  cacheHits: number
  /** Persistent cache writes. */
  cacheWrites: number
  /** Calls that reused an in-flight same-input promise. */
  dedupHits: number
  /** Calls rejected because validation, cache, or handler execution failed. */
  errors: number
  /** Persistent cache entries removed because output validation failed. */
  invalidations: number
  /** Calls served from runner-local memory. */
  memoHits: number
}

/** @internal */
export interface PendingCall {
  cacheKey: string
  input: unknown
  resolve: (output: unknown) => void
  reject: (error: unknown) => void
}

/** @internal */
export interface RateLimiter {
  readonly queued: number
  acquire: () => Promise<void>
}

/** @internal */
export interface State {
  inFlight: Map<string, Promise<unknown>>
  isCollecting: boolean
  limiter?: RateLimiter
  memory: Map<string, unknown>
  pending: PendingCall[]
  stats: EffectStats
}
