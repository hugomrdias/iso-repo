/**
 * @import {Delegation} from './delegation.js'
 * @import {Driver} from 'iso-kv'
 */

import { KV } from 'iso-kv'

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
  async set(delegation) {
    const options = {
      expiration: delegation.envelope.payload.exp,
    }
    const cid = delegation.cid.toString()

    await this.kv.set([cid], delegation, options)

    await this.kv.set(
      [delegation.envelope.payload.cmd, delegation.envelope.payload.aud],
      cid,
      options
    )
  }

  /**
   * Get a delegation by cid
   *
   * @param {string} cid
   */
  get(cid) {
    return /** @type {typeof this.kv.get<string>} */ (this.kv.get)([cid])
  }

  /**
   * Get a proof by cmd and iss
   *
   * @param {string} cmd
   * @param {string} iss
   */
  async proof(cmd, iss) {
    /** @type {string | undefined} */
    const cid = await /** @type {typeof this.kv.get<string>} */ (this.kv.get)([
      cmd,
      iss,
    ])

    if (cid) {
      return /** @type {typeof this.kv.get<Delegation>} */ (this.kv.get)([cid])
    }

    return undefined
  }

  /**
   * Resolve proofs by cmd and iss
   *
   * @param {string} cmd
   * @param {string} iss
   */
  async resolveProofs(cmd, iss) {
    /** @type {Delegation[]} */
    const proofs = []
    const parts = cmd.split('/')

    for (let i = 0; i < parts.length; i++) {
      let cmd = `${parts.slice(0, i + 1).join('/')}`
      if (cmd === '') {
        cmd = '/'
      }
      const proof = await this.proof(cmd, iss)

      if (proof && proof.envelope.payload.iss === proof.envelope.payload.sub) {
        proofs.push(proof)
        break
      }
      if (proof) {
        proofs.push(proof)
        const more = await this.resolveProofs(cmd, proof.envelope.payload.iss)
        proofs.push(...more)
      }
    }

    return proofs.reverse()
  }
}
