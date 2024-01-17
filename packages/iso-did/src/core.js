import { parse } from 'did-resolver'

/**
 * @typedef {import('./types').DIDURLObject} DIDURLObject
 */

/**
 * DID Core
 *
 * @implements {DIDURLObject}
 */
export class DIDCore {
  /**
   *
   * @param {DIDURLObject} parsed
   */
  constructor(parsed) {
    this.did = parsed.did
    this.didUrl = parsed.didUrl
    this.method = parsed.method
    this.id = parsed.id
    this.path = parsed.path
    this.fragment = parsed.fragment
    this.query = parsed.query
  }

  /**
   * Create a DIDCore from a DID string
   *
   * @param {string} did
   */
  static fromString(did) {
    const parsedDid = /** @type {DIDURLObject} */ (parse(did))
    if (parsedDid) {
      return new DIDCore(parsedDid)
    } else {
      throw new TypeError(`Invalid DID "${did}"`)
    }
  }

  toString() {
    return this.didUrl
  }
}
