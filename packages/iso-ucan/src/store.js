import { parse as didParse } from 'iso-did'
import { KV } from 'iso-kv'
import merge from 'it-merge'
import { Delegation } from './delegation.js'

/**
 * @import {Driver} from 'iso-kv'
 * @import {CID} from 'multiformats'
 */

const POWERLINE = '$pwrl'

/**
 * Store
 */
export class Store {
  /** @type {Driver} */
  driver

  /** @type {KV} */
  kv

  /**
   * @param {Driver} driver
   */
  constructor(driver) {
    this.driver = driver

    this.kv = new KV({
      driver,
    })
  }

  /**
   * Set a delegation in the store by CID and index it by cmd and aud
   *
   * @param {Delegation} delegation
   */
  async #set(delegation) {
    const options = {
      expiration: delegation.envelope.payload.exp,
    }
    const cid = delegation.cid.toString()

    // Index by CID
    await this.kv.set([cid], delegation.toString(), options)

    // Index by subject and audience
    /** @type {string | null} */
    let sub = delegation.sub ? delegation.sub : null
    if (sub === null) {
      sub = POWERLINE
    }
    await this.kv.set([sub, delegation.aud, cid], cid, options)
  }

  /**
   * @param {Delegation[]} delegations
   */
  async add(delegations) {
    for (const delegation of delegations) {
      await this.#set(delegation)
    }
  }

  /**
   * Get a delegation by cid
   *
   * @param {string} cid
   */
  async get(cid) {
    const str = await /** @type {typeof this.kv.get<string>} */ (this.kv.get)([
      cid,
    ])
    if (!str) {
      return undefined
    }
    return await Delegation.fromString(str)
  }

  /**
   * Resolve a proof by CID
   *
   * @param {CID} cid
   */
  async resolveProof(cid) {
    const delegation = await this.get(cid.toString())
    if (!delegation) {
      throw new Error(`Delegation not found: ${cid.toString()}`)
    }
    return delegation
  }

  /**
   * List proofs by sub and aud
   *
   * @param {import('./types.js').StoreProofsOptions} options
   */
  async *proofs(options) {
    /**@type {string | null} */
    let sub = options.sub ? options.sub.toString() : null
    /**@type {string | undefined} */
    let aud = options.aud ? options.aud.toString() : undefined

    if (!aud && !sub) {
      throw new Error('No audience or subject provided')
    }
    if (!aud && sub) {
      aud = sub
    }
    if (sub === null) {
      sub = POWERLINE
    }
    if (!aud) {
      throw new Error('No audience provided')
    }

    for await (const element of this.kv.list({
      prefix: [sub, aud],
    })) {
      const value = await this.get(element.value)

      if (value) {
        yield value
      }
    }
  }

  /**
   * Resolve a single chain of proofs ending with a root (subject === issuer).
   * Returns the first such chain found (depth-first).
   *
   * @param {import('./types.js').StoreProofsOptions} options
   * @returns {Promise<Delegation[]>}
   */
  async chain({ aud, sub, cmd }) {
    // console.log('🚀 ~ aud', aud, 'sub', sub, 'cmd', cmd)
    const parents = parentCmds(cmd)

    const sources = merge(
      this.proofs({ sub, aud, cmd }),
      this.proofs({ sub: null, aud, cmd })
    )

    for await (const proof of sources) {
      if (!parents.includes(proof.cmd)) continue

      // If root, return this proof as the end of the path
      if (proof.sub === didParse(proof.iss).did) {
        // console.log('🚀 ~ found root:', proof.iss, proof.sub, proof.cmd)
        return [proof]
      }

      // Otherwise, go deeper and prepend this proof if a path is found
      // console.log('🚀 ~ trying deeper:', proof.iss, proof.sub, proof.cmd)
      const nextPath = await this.chain({
        aud: didParse(proof.iss).did,
        sub: proof.sub ? proof.sub : sub,
        cmd: proof.cmd,
      })
      if (nextPath?.length) {
        return [proof, ...nextPath]
      }
      // console.log('🚀 ~ no path found')
    }

    // No path found
    return []
  }
}

/**
 * Returns all parent commands for a given command string.
 *
 * @param {string} cmd
 * @returns {string[]}
 * @example
 * ```ts twoslash
 * import { parentCmds } from 'iso-ucan/store'
 * parentCmds('/foo/bar/baz') // ["/", "/foo", "/foo/bar", "/foo/bar/baz"]
 * ```
 */
function parentCmds(cmd) {
  if (!cmd || cmd === '/') return ['/']
  const parts = cmd.split('/').filter(Boolean)
  const result = ['/']
  let current = ''
  for (const part of parts) {
    current += `/${part}`
    result.push(current)
  }
  return result
}
