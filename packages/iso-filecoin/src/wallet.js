import * as bip39 from '@scure/bip39'
import { HDKey } from '@scure/bip32'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { secp256k1 as secp } from '@noble/curves/secp256k1'
import { blake2b } from '@noble/hashes/blake2b'

import { base16, base32 } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'

/**
 * Enumerates the possible signature types filecoin network has to sign transactions
 */
export const SIGNATURES = /** @type {const} */ ({
  SECP256K1: 1,
  BLS: 3,
})

/**
 * Enumerates the possible signature types filecoin network has to sign transactions
 */
export const NETWORKS = /** @type {const} */ ({
  Mainnet: 'f',
  Testnet: 't',
})

/**
 * @typedef {typeof SIGNATURES} SignaturesType
 * @typedef {SignaturesType[keyof SignaturesType]} Signature
 * @typedef {typeof NETWORKS} NetworkType
 * @typedef {NetworkType[keyof NetworkType]} Network
 */

/**
 * Returns the third position from path
 *
 * @param {string} path - path to parse
 * @returns coin type
 */
export function getNetworkFromPath(path) {
  const type = path.split('/')[2].slice(0, -1)
  if (type === '1') {
    return NETWORKS.Testnet
  }
  return NETWORKS.Mainnet
}

/**
 *
 * @returns
 */
export function generateMnemonic() {
  return bip39.generateMnemonic(wordlist, 256)
}

/**
 * @param {string} mnemonic
 * @param {string} [password]
 */
export function mnemonicToSeed(mnemonic, password) {
  return bip39.mnemonicToSeedSync(mnemonic, password)
}

/**
 *
 * @param {Uint8Array} seed
 * @param {Signature} type
 * @param {string} path
 * @param {Network} [network]
 */
export function accountFromSeed(seed, type, path, network) {
  switch (type) {
    case SIGNATURES.SECP256K1: {
      const masterKey = HDKey.fromMasterSeed(seed)
      const privateKey = masterKey.derive(path).privateKey

      if (!privateKey) {
        throw new Error('Private key could not be generated.')
      }

      if (!network) {
        network = getNetworkFromPath(path)
      }

      const { address, pubKey } = getPublicKey(privateKey, network)

      return {
        type,
        privateKey,
        pubKey,
        address,
        path,
      }
    }

    default: {
      throw new Error('Not supported.')
    }
  }
}

/**
 * @param {Uint8Array} privateKey
 * @param {Network} network
 */
export function getPublicKey(privateKey, network) {
  const publicKey = secp.getPublicKey(privateKey, false)

  const payload = blake2b(publicKey, {
    dkLen: 20,
  })

  return {
    pubKey: publicKey,
    address: getSecp256k1Address(payload, network),
  }
}

/**
 * @param {Uint8Array} payload
 * @param {Network} network
 */
export function getSecp256k1Address(payload, network) {
  const protocol = 1
  const checksum = blake2b(concat([base16.decode(`0${protocol}`), payload]), {
    dkLen: 4,
  })

  return `${network}${protocol}${base32
    .encode(concat([payload, checksum]), false)
    .toLowerCase()}`
}
