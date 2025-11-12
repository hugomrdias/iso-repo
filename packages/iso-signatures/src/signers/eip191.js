import { hex } from 'iso-base/rfc4648'
import { DID } from 'iso-did'
import { DIDPkh } from 'iso-did/pkh'

/**
 * @typedef {import('../types.js').ISigner<string>} ISigner
 * @typedef {import('ox').Provider.Provider} Provider
 * @typedef {import('eventemitter3').EventEmitter} EventEmitter
 */

/**
 * EIP191 signer
 *
 * @implements {ISigner}
 */
export class EIP191Signer extends DID {
  /** @type {import('../types.js').SignatureType} */
  signatureType

  /**
   * Create a DIDPkh from an address
   *
   * @param {Provider} provider -  https://oxlib.sh/guides/eip-1193#eip-1193-providers
   * @param {`0x${string}`} address
   * @param {number | `0x${string}`} [chainId]
   * @param {string} [namespace]
   */
  constructor(provider, address, chainId = 1, namespace = 'eip155') {
    super(DIDPkh.fromAddress(address, chainId, namespace))
    this.signatureType = 'EIP191'
    this.provider = provider
    this.address = address
    this.chainId = chainId
    this.namespace = namespace
  }

  /**
   * Generate a new signer
   *
   * @param {object} options
   * @param {Provider} options.provider -  https://oxlib.sh/guides/eip-1193#eip-1193-providers
   * @param {`0x${string}`} [options.address] - default: first account from provider
   * @param {number | `0x${string}`} [options.chainId] - default: 1
   * @param {string} [options.namespace] - default: eip155
   *
   * @example
   * ```ts twoslash
   * import { Provider } from 'ox'
   * const provider = Provider.from(window.ethereum)
   * const signer = await EIP191Signer.generate({
   *   provider,
   * })
   * ```
   */
  static async from(options) {
    let { provider, address, chainId, namespace } = options
    if (!address) {
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      })
      address = accounts[0]
    }
    if (!chainId) {
      chainId = await provider.request({
        method: 'eth_chainId',
      })
    }

    return new EIP191Signer(provider, address, chainId, namespace)
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    const result = await this.provider.request({
      method: 'personal_sign',
      params: [`0x${hex.encode(message)}`, this.address],
    })
    return hex.decode(result.slice(2))
  }

  /**
   * Export the signer as a encoded string
   */
  export() {
    return ''
  }

  toString() {
    return this.didObject.didUrl
  }
}
