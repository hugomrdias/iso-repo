import { parse } from 'did-resolver'

/**
 * @typedef {import('./types').DID} DID
 */

/**
 * DID Core
 *
 * @implements {DID}
 */
export class DIDCore {
  /**
   *
   * @param {DID} parsed
   */
  constructor(parsed) {
    this.did = parsed.did
    this.didUrl = parsed.didUrl
    this.method = parsed.method
    this.id = parsed.id
    this.path = parsed.path
    this.fragment = parsed.fragment
    this.query = parsed.query
    this.params = parsed.params
  }

  /**
   * Create a DIDCore from a DID string
   *
   * @param {string} did
   */
  static fromString(did) {
    const parsedDid = parse(did)
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
