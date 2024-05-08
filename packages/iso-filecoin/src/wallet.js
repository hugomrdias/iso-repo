import { secp256k1 as secp } from '@noble/curves/secp256k1'
import { blake2b } from '@noble/hashes/blake2b'
import { HDKey } from '@scure/bip32'
import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { concat } from 'iso-base/utils'
import { fromPublicKey } from './address.js'
import { Message } from './message.js'
import { getNetworkFromPath } from './utils.js'

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
 * @param {string} mnemonic
 * @param {import('./types.js').SignatureType} type
 * @param {string} path
 * @param {string} [password]
 * @param {import('./types.js').Network} [network]
 */
export function accountFromMnemonic(mnemonic, type, path, password, network) {
  const seed = mnemonicToSeed(mnemonic, password)
  return accountFromSeed(seed, type, path, network)
}

/**
 *
 * @param {Uint8Array} seed
 * @param {import('./types.js').SignatureType} type
 * @param {string} path
 * @param {import('./types.js').Network} [network]
 */
export function accountFromSeed(seed, type, path, network) {
  switch (type) {
    case 'SECP256K1': {
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
 * Account from private key
 *
 * @param {Uint8Array} privateKey
 * @param {import('./types.js').SignatureType} type
 * @param {import('./types.js').Network} network
 * @param {string} [path]
 */
export function accountFromPrivateKey(privateKey, type, network, path) {
  switch (type) {
    case 'SECP256K1': {
      if (privateKey.length !== 32) {
        throw new Error('Private key should be 32 bytes.')
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
 * @param {import('./types.js').Network} network
 */
export function getPublicKey(privateKey, network) {
  const publicKey = secp.getPublicKey(privateKey, false)

  return {
    pubKey: publicKey,
    address: fromPublicKey(publicKey, network, 'SECP256K1'),
  }
}

/**
 * Sign filecoin message
 *
 * @param {Uint8Array} privateKey
 * @param {import('./types.js').SignatureType} type
 * @param {import('./types.js').MessageObj} message
 * @returns
 */
export function signMessage(privateKey, type, message) {
  const msg = new Message(message).serialize()
  return sign(privateKey, type, msg)
}

/**
 * Sign message
 *
 * @param {Uint8Array} privateKey
 * @param {import('./types.js').SignatureType} type
 * @param {string | Uint8Array} message
 * @returns
 */
export function sign(privateKey, type, message) {
  const cid = concat([
    Uint8Array.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]),
    blake2b(message, {
      dkLen: 32,
    }),
  ])

  const digest = blake2b(cid, {
    dkLen: 32,
  })

  switch (type) {
    case 'SECP256K1': {
      const signature = secp.sign(digest, privateKey)
      return concat([
        signature.toCompactRawBytes(),
        // @ts-ignore
        Uint8Array.from([signature.recovery]),
      ])
    }
    default: {
      throw new Error('Not supported.')
    }
  }
}
