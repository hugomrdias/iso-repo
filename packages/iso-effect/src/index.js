import { getDotPath, SchemaError } from '@standard-schema/utils'
import { createCacheKey } from './key.js'
import { WindowRateLimiter } from './rate-limit.js'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 * @import {
 *   EffectContext,
 *   EffectHandler,
 *   EffectOptions,
 *   EffectStats,
 *   Logger,
 *   PendingCall,
 *   RunnerOptions,
 *   State,
 * } from './types.js'
 */

const CACHE_PREFIX = 'iso-effect'

const noop = () => undefined

/** @type {Logger} */
const noopLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
}

/**
 * Checks whether a value implements the Standard Schema v1 contract.
 *
 * The runner uses this during effect construction so invalid descriptors fail
 * early instead of failing later during the first call.
 *
 * @param {unknown} schema
 * @returns {schema is StandardSchemaV1}
 */
function isStandardSchema(schema) {
  return (
    !!schema &&
    typeof schema === 'object' &&
    '~standard' in schema &&
    typeof schema['~standard'] === 'object' &&
    schema['~standard'] !== null &&
    'validate' in schema['~standard'] &&
    typeof schema['~standard'].validate === 'function'
  )
}

/**
 * Validates a value with a synchronous Standard Schema and returns the parsed
 * schema output.
 *
 * Standard Schema allows validators to transform/coerce values, so callers
 * must use the returned value for cache-key generation and handler execution.
 * Async schemas are rejected because effect calls need deterministic validation
 * before they are queued, deduplicated, or read from cache.
 *
 * @param {StandardSchemaV1} schema
 * @param {unknown} value
 * @param {string} label - Human-readable value label used in error messages.
 */
function validateSchema(schema, value, label) {
  const result = schema['~standard'].validate(value)

  if (result instanceof Promise) {
    throw new TypeError(
      `Async schemas are not supported. The effect ${label} schema must validate synchronously.`
    )
  }

  if (result.issues) {
    const message = result.issues
      .map((issue) => {
        const dotPath = getDotPath(issue)
        return dotPath ? `\`${dotPath}\` ${issue.message}` : issue.message
      })
      .join('; ')
    const error = new SchemaError(result.issues)
    error.message = `Effect ${label} schema violation: ${message}`
    throw error
  }

  return result.value
}

/**
 * Creates the initial stats object for a single effect registered in a runner.
 *
 * Stats are intentionally local to the runner, not the effect descriptor, so
 * the same effect can be reused in multiple isolated runners.
 *
 * @returns {EffectStats}
 */
function createStats() {
  return {
    calls: 0,
    cacheHits: 0,
    cacheWrites: 0,
    dedupHits: 0,
    errors: 0,
    invalidations: 0,
    memoHits: 0,
  }
}

/**
 * Immutable descriptor for a typed effect.
 *
 * `Effect` instances are created by {@link createEffect}. They hold the public
 * name, input/output schemas, rate-limit/cache options, and handler function,
 * but no runtime state. All mutable data such as memoized results, queued
 * calls, in-flight promises, and rate-limit windows lives in `EffectRunner`.
 *
 * @template Input
 * @template Output
 */
export class Effect {
  /** @type {string} */
  name
  /** @type {StandardSchemaV1<Input>} */
  input
  /** @type {StandardSchemaV1<Output>} */
  output
  /** @type {import('./types.js').RateLimit} */
  rateLimit
  /** @type {boolean} */
  cache
  /** @type {EffectHandler<Input, Output>} */
  handler

  /**
   * Creates an immutable effect descriptor.
   *
   * Prefer {@link createEffect} for public construction because it validates the
   * descriptor and preserves Standard Schema type inference.
   *
   * @param {EffectOptions<StandardSchemaV1<Input>, StandardSchemaV1<Output>>} options
   * @param {EffectHandler<Input, Output>} handler
   */
  constructor(options, handler) {
    this.name = options.name
    this.input = options.input
    this.output = options.output
    this.rateLimit = options.rateLimit ?? false
    this.cache = options.cache ?? false
    this.handler = handler
    Object.freeze(this)
  }
}

/**
 * Defines a reusable effect descriptor.
 *
 * Effects model external or expensive work such as HTTP requests, RPC reads, or
 * webhook calls. The descriptor is inert: creating it does not execute the
 * handler or allocate caches. Pass it to {@link EffectRunner.call} to validate
 * input, deduplicate same-input calls, apply rate limits, and optionally persist
 * results through `iso-kv`.
 *
 * The `input` schema output is used for both handler execution and cache-key
 * generation, so schema transforms are reflected consistently. The `output`
 * schema validates handler results and cached values before they are returned.
 *
 * @template {StandardSchemaV1} InputSchema
 * @template {StandardSchemaV1} OutputSchema
 * @param {EffectOptions<InputSchema, OutputSchema>} options - Effect name,
 * schemas, rate limit, and cache behavior.
 * @param {EffectHandler<StandardSchemaV1.InferOutput<InputSchema>, StandardSchemaV1.InferOutput<OutputSchema>>} handler - Function
 * that performs the work for a cache miss. It receives parsed input and a
 * context with logger, nested-effect caller, and per-call cache flag.
 * @returns {Effect<StandardSchemaV1.InferOutput<InputSchema>, StandardSchemaV1.InferOutput<OutputSchema>>}
 */
export function createEffect(options, handler) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('Expected effect options to be an object.')
  }

  if (typeof options.name !== 'string' || options.name.length === 0) {
    throw new TypeError('Expected effect name to be a non-empty string.')
  }

  if (!isStandardSchema(options.input)) {
    throw new TypeError('Expected effect input to be a Standard Schema.')
  }

  if (!isStandardSchema(options.output)) {
    throw new TypeError('Expected effect output to be a Standard Schema.')
  }

  if (typeof handler !== 'function') {
    throw new TypeError('Expected effect handler to be a function.')
  }

  return new Effect(options, handler)
}

/**
 * Executes effects with per-runner state.
 *
 * A runner owns the mutable behavior around otherwise inert effect descriptors:
 * validated input memoization, same-input in-flight deduplication, microtask
 * collection, fixed-window rate limiters, nested effect calls, optional
 * persistent cache access, and lightweight stats. Create separate runners when
 * you want separate memo/cache state for tests, tenants, requests, or isolated
 * workflows.
 */
export class EffectRunner {
  /** @type {import('./types.js').IKV | undefined} */
  #kv
  /** @type {Logger} */
  #logger
  /** @type {Map<Effect<any, any>, State>} */
  #states = new Map()
  /** @type {Map<string, Effect<any, any>>} */
  #effectByName = new Map()

  /**
   * Creates a new isolated effect runner.
   *
   * Provide `kv` to enable persistent cache reads/writes for effects created
   * with `cache: true`. Without `kv`, the runner still deduplicates in-flight
   * calls and memoizes completed values in memory for its lifetime.
   *
   * @param {RunnerOptions} [options] - Optional `iso-kv` compatible cache and
   * logger used by effect handlers.
   */
  constructor(options = {}) {
    this.#kv = options.kv
    this.#logger = options.logger ?? noopLogger
  }

  /**
   * Calls an effect with validated input and returns its validated output.
   *
   * The call pipeline is:
   *
   * 1. validate and normalize input through the effect's input schema;
   * 2. derive a stable cache key from the normalized input;
   * 3. return an in-memory value or in-flight promise for same-input calls;
   * 4. queue the call until the next microtask so simultaneous callers coalesce;
   * 5. read and validate persistent cache when enabled;
   * 6. wait for rate-limit capacity, execute the handler, validate output, and
   *    persist the result unless `context.cache` was set to `false`.
   *
   * @template Input
   * @template Output
   * @param {Effect<Input, Output>} effect - Effect descriptor created with
   * `createEffect`.
   * @param {Input} input - Raw input value to validate with the effect schema.
   * @returns {Promise<Output>}
   */
  call(effect, input) {
    /** @type {State} */
    let state
    /** @type {unknown} */
    let parsedInput
    /** @type {string} */
    let cacheKey

    try {
      state = this.#getState(effect)
      parsedInput = validateSchema(effect.input, input, 'input')
      cacheKey = createCacheKey(effect, parsedInput)
    } catch (error) {
      return Promise.reject(error)
    }

    if (state.memory.has(cacheKey)) {
      state.stats.memoHits++
      return Promise.resolve(/** @type {Output} */ (state.memory.get(cacheKey)))
    }

    const inFlight = state.inFlight.get(cacheKey)
    if (inFlight) {
      state.stats.dedupHits++
      return /** @type {Promise<Output>} */ (inFlight)
    }

    const promise = new Promise((resolve, reject) => {
      state.pending.push({ cacheKey, input: parsedInput, reject, resolve })
    })

    state.inFlight.set(cacheKey, promise)

    if (!state.isCollecting) {
      state.isCollecting = true
      Promise.resolve().then(() => {
        state.isCollecting = false
        void this.#flush(effect, state)
      })
    }

    return /** @type {Promise<Output>} */ (promise)
  }

  /**
   * Returns a snapshot of this runner's counters for an effect.
   *
   * The returned object is a copy, so mutating it will not affect runner state.
   * Counters are scoped to this runner and do not include activity from other
   * runners using the same effect descriptor.
   *
   * @param {Effect<any, any>} effect - Effect whose stats should be returned.
   */
  getStats(effect) {
    return { ...this.#getState(effect).stats }
  }

  /**
   * Clears runner-local memoized outputs.
   *
   * This only clears completed in-memory values. In-flight promises continue to
   * resolve normally, rate-limit windows are preserved, and persistent `iso-kv`
   * cache entries are intentionally left untouched.
   *
   * @param {Effect<any, any>} [effect] - Optional effect to clear. Omit to clear
   * memoized outputs for all effects registered in this runner.
   */
  clear(effect) {
    if (effect) {
      const state = this.#getState(effect)
      state.memory.clear()
      return
    }

    for (const state of this.#states.values()) {
      state.memory.clear()
    }
  }

  /**
   * Gets or creates the mutable state bucket for an effect in this runner.
   *
   * Effect names must be unique per runner because the name is part of the
   * persistent cache namespace. Registering a different descriptor with the same
   * name would make cache entries ambiguous, so it is rejected.
   *
   * @param {Effect<any, any>} effect
   * @returns {State}
   */
  #getState(effect) {
    if (!(effect instanceof Effect)) {
      throw new TypeError('Expected an Effect created by createEffect.')
    }

    const existingEffect = this.#effectByName.get(effect.name)
    if (existingEffect && existingEffect !== effect) {
      throw new TypeError(
        `An effect named "${effect.name}" is already registered in this runner. Effect names must be unique per runner.`
      )
    }
    this.#effectByName.set(effect.name, effect)

    let state = this.#states.get(effect)
    if (!state) {
      state = {
        inFlight: new Map(),
        isCollecting: false,
        limiter: effect.rateLimit
          ? new WindowRateLimiter(effect.rateLimit)
          : undefined,
        memory: new Map(),
        pending: [],
        stats: createStats(),
      }
      this.#states.set(effect, state)
    }

    return state
  }

  /**
   * Processes all calls collected during the current microtask.
   *
   * Calls are already deduplicated by cache key before they reach this method.
   * Processing them together lets the persistent cache and rate limiter observe
   * the current batch of unique inputs.
   *
   * @param {Effect<any, any>} effect
   * @param {State} state
   */
  async #flush(effect, state) {
    const pending = state.pending.splice(0)

    await Promise.all(
      pending.map((call) => this.#processCall(effect, state, call))
    )
  }

  /**
   * Resolves one pending unique input.
   *
   * The method first tries the persistent cache, then waits for the effect's
   * rate limiter if one is configured, then executes the handler. Handler output
   * is schema-validated before it is stored or returned. Any validation,
   * storage, or handler error rejects the caller and is not cached.
   *
   * @param {Effect<any, any>} effect
   * @param {State} state
   * @param {PendingCall} pending
   */
  async #processCall(effect, state, pending) {
    try {
      const cached = await this.#readCache(effect, state, pending.cacheKey)
      if (cached.hit) {
        state.memory.set(pending.cacheKey, cached.output)
        pending.resolve(cached.output)
        return
      }

      if (state.limiter) {
        await state.limiter.acquire()
      }

      const context = this.#createContext(effect)
      const rawOutput = await effect.handler({
        context,
        input: pending.input,
      })
      const output = validateSchema(effect.output, rawOutput, 'output')
      state.stats.calls++
      state.memory.set(pending.cacheKey, output)

      if (context.cache && this.#kv) {
        await this.#kv.set(this.#cacheKey(effect, pending.cacheKey), {
          output,
        })
        state.stats.cacheWrites++
      }

      pending.resolve(output)
    } catch (error) {
      state.stats.errors++
      pending.reject(error)
    } finally {
      state.inFlight.delete(pending.cacheKey)
    }
  }

  /**
   * Creates the handler context for one effect execution.
   *
   * The context starts with the effect's default `cache` option, but handlers
   * may set `context.cache = false` to avoid persisting a specific result (for
   * example, after a failed HTTP response). Nested calls use this same runner so
   * they share deduplication, memoization, cache, and rate-limit state.
   *
   * @template Input
   * @template Output
   * @param {Effect<Input, Output>} effect
   * @returns {EffectContext}
   */
  #createContext(effect) {
    return {
      cache: effect.cache,
      effect: (nestedEffect, input) => this.call(nestedEffect, input),
      log: this.#logger,
    }
  }

  /**
   * Reads a cached output from `iso-kv` and validates it.
   *
   * Cache reads only happen when the effect has `cache: true` and the runner was
   * constructed with a `kv` store. Invalid cached outputs are deleted and
   * reported as cache misses so the handler can refresh them.
   *
   * @param {Effect<any, any>} effect
   * @param {State} state
   * @param {string} cacheKey
   * @returns {Promise<{hit: true, output: unknown} | {hit: false}>}
   */
  async #readCache(effect, state, cacheKey) {
    if (!effect.cache || !this.#kv) {
      return { hit: false }
    }

    const key = this.#cacheKey(effect, cacheKey)
    const entry = await this.#kv.get(key)
    if (entry === undefined) {
      return { hit: false }
    }

    try {
      const output = validateSchema(
        effect.output,
        /** @type {{output?: unknown}} */ (entry).output,
        'output'
      )
      state.stats.cacheHits++
      return { hit: true, output }
    } catch {
      await this.#kv.delete(key)
      state.stats.invalidations++
      return { hit: false }
    }
  }

  /**
   * Builds the `iso-kv` key used for persistent effect cache entries.
   *
   * The namespace is stable and human-readable so users can inspect or clear
   * entries by prefix: `['iso-effect', effectName, inputHash]`.
   *
   * @param {Effect<any, any>} effect
   * @param {string} cacheKey
   */
  #cacheKey(effect, cacheKey) {
    return [CACHE_PREFIX, effect.name, cacheKey]
  }
}
