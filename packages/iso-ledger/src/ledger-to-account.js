import _Eth from '@ledgerhq/hw-app-eth'

import { TransportStatusError } from '@ledgerhq/hw-transport'
import {
  bytesToHex,
  getAddress,
  getTypesForEIP712Domain,
  hashDomain,
  hashStruct,
  serializeTransaction,
  stringToHex,
} from 'viem'
import { serializeSignature, toAccount } from 'viem/accounts'

/**
 * @import {LedgerEthAppClass, LedgerToAccountParameters, LedgerAccount, LedgerEthAppType, MessageTypeProperty} from './types.ts'
 * @import {Address, Hex, HashTypedDataParameters} from 'viem'
 */

export const Eth = /** @type {LedgerEthAppClass} */ (_Eth)
export { TransportStatusError } from '@ledgerhq/hw-transport'

/**
 *
 * @param {string} input
 * @returns {Hex}
 */
export function ensureLeading0x(input) {
  return input.startsWith('0x')
    ? /** @type {Hex} */ (input)
    : /** @type {Hex} */ (`0x${input}`)
}

/**
 * @param {string} input
 * @returns {string}
 */
export function trimLeading0x(input) {
  return input.startsWith('0x')
    ? /** @type {string} */ (input.slice(2))
    : /** @type {string} */ (input)
}

/**
 * Convert a ledger transport to a viem account normally used together with `@ledgerhq/hw-transport-webhid` or `@ledgerhq/hw-transport-node-hid`
 *
 * Notice: Ledger packages need Buffer polyfill in the browser.
 *
 * @param {LedgerToAccountParameters} parameters - The parameters for the ledger to account conversion {@link LedgerToAccountParameters}
 * @returns {Promise<LedgerAccount>} The viem account
 * @example
 * ```ts
 * import TransportWebHID from '@ledgerhq/hw-transport-webhid'
 * import { ledgerToAccount } from '@filoz/synapse-core/ledger'
 *
 * const transport = await TransportWebHID.create()
 * const account = await ledgerToAccount({
 *   transport,
 *   accountIndex: 0,
 *   addressIndex: 0,
 *   changeIndex: 0,
 * })
 *
 * await transport.close()
 * ```
 */
export async function ledgerToAccount({
  transport,
  accountIndex = 0,
  addressIndex = 0,
  changeIndex = 0,
  verifyAddress = false,
  nonceManager,
  forceBlindSigning = false,
}) {
  const path = `m/44'/60'/${accountIndex}'/${changeIndex}/${addressIndex}`
  /** @type {Address} */
  let address
  /** @type {Hex} */
  let publicKey
  /** @type {LedgerEthAppType} */
  let eth

  try {
    eth = new Eth(transport)
    const getAddressResult = await eth.getAddress(path, verifyAddress)
    address = getAddress(getAddressResult.address)
    publicKey = /** @type {Hex} */ (getAddressResult.publicKey)
    const appConfig = await eth.getAppConfiguration()
    if (forceBlindSigning && appConfig.arbitraryDataEnabled === 0) {
      throw new Error('Blind signing is not enabled on your Ledger device')
    }
  } catch (error) {
    // Ledger device: UNKNOWN_ERROR (0x6511)
    if (error instanceof TransportStatusError && error.statusCode === 0x6511) {
      throw new Error('Open the Ethereum app on your Ledger device to continue')
    }
    if (error instanceof TransportStatusError && error.statusCode === 0x5515) {
      throw new Error('Ledger device is locked')
    }
    if (error instanceof TransportStatusError && error.statusCode === 0x6d02) {
      throw new Error('Wrong application selected')
    }
    throw error
  }

  const account = toAccount({
    address: ensureLeading0x(address),
    nonceManager,
    signMessage: async ({ message }) => {
      const _message = (() => {
        if (typeof message === 'string') return stringToHex(message)
        if (typeof message.raw === 'string') return message.raw
        return bytesToHex(message.raw)
      })()
      const { r, s, v } = await eth.signPersonalMessage(path, _message)
      return serializeSignature({
        r: ensureLeading0x(r),
        s: ensureLeading0x(s),
        v: BigInt(v),
      })
    },
    signTransaction: async (tx) => {
      const serializedTx = serializeTransaction(tx)

      let {
        r,
        s,
        v: _v,
      } = await eth.signTransaction(path, trimLeading0x(serializedTx), null)
      if (typeof _v === 'string' && (_v === '' || _v === '0x')) {
        _v = '0x0'
      }
      /** @type {bigint} */
      let v
      try {
        v = BigInt(typeof _v === 'string' ? ensureLeading0x(_v) : _v)
      } catch (err) {
        throw new Error(
          `Ledger signature \`v\` was malformed and couldn't be parsed \`${_v}\` (Original error: ${err})`
        )
      }

      return serializeTransaction(tx, {
        r: ensureLeading0x(r),
        s: ensureLeading0x(s),
        v,
      })
    },
    signTypedData: async (parameters) => {
      const {
        domain = {},
        message,
        primaryType,
      } = /** @type {HashTypedDataParameters} */ (parameters)
      const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...parameters.types,
      }

      const domainSeparator = hashDomain({
        domain,
        types: /** @type {Record<string, MessageTypeProperty[]>} */ (types),
      })

      const messageHash = hashStruct({
        data: message,
        primaryType,
        types: /** @type {Record<string, MessageTypeProperty[]>} */ (types),
      })

      const { r, s, v } = await eth.signEIP712HashedMessage(
        path,
        domainSeparator,
        messageHash
      )
      return serializeSignature({
        r: ensureLeading0x(r),
        s: ensureLeading0x(s),
        v: BigInt(v),
      })
    },
  })

  return {
    ...account,
    publicKey: ensureLeading0x(publicKey),
    source: 'ledger',
  }
}
