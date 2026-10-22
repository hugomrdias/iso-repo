import { hex } from 'iso-base/rfc4648'
import { DID } from 'iso-did'
import { DIDPkh } from 'iso-did/pkh'

/**
 * @typedef {import('../types.js').ISigner<string>} ISigner
 * @typedef {import('ox').Provider.Provider} Provider
 * @typedef {import('eventemitter3').EventEmitter} EventEmitter
 */

/** secp256k1 group order */
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

/**
 * Normalize an `r‖s‖v` EIP-191 signature to its canonical encoding: low S
 * (`s <= n/2`) and `v` of 27 or 28.
 *
 * Wallets return `v` as 27 or 28, or as 0 or 1. Strict verifiers accept only
 * the canonical encoding.
 *
 * @param {Uint8Array} signature
 */
export function normalizeSignature(signature) {
  if (signature.length !== 65) {
    throw new Error('Invalid signature length')
  }
  let v = signature[64]
  if (v === 0 || v === 1) {
    v += 27
  }
  if (v !== 27 && v !== 28) {
    throw new Error('Invalid signature recovery byte')
  }

  const out = new Uint8Array(signature)
  out[64] = v
  const s = BigInt(`0x${hex.encode(signature.subarray(32, 64))}`)
  if (s > N >> 1n) {
    // (r, n - s) recovers the same key with the opposite y parity
    out.set(hex.decode((N - s).toString(16).padStart(64, '0')), 32)
    out[64] = v === 27 ? 28 : 27
  }
  return out
}

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
   * Normalizes the wallet signature with {@link normalizeSignature}.
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    const result = await this.provider.request({
      method: 'personal_sign',
      params: [`0x${hex.encode(message)}`, this.address],
    })
    return normalizeSignature(hex.decode(result.slice(2)))
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
