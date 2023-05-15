import * as ed from '@noble/ed25519'
import * as odd from '@oddjs/odd'
import { webcrypto } from 'iso-base/crypto'
import { concat, u8 } from 'iso-base/utils'

export const ED25519_DID_PREFIX = new Uint8Array([0xed, 0x01])
/**
 * Encrypt data with AES-GCM
 *
 * @param {Uint8Array} data
 * @param {CryptoKey} encryptionKey
 */
export async function encrypt(data, encryptionKey) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12))

  const encrypted = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    data.buffer
  )

  return concat([iv, u8(encrypted)])
}

/**
 * Decrypt data with AES-GCM
 *
 * @param {Uint8Array} data
 * @param {CryptoKey} encryptionKey
 */
export async function decrypt(data, encryptionKey) {
  const iv = data.slice(0, 12)
  const encrypted = data.slice(12)
  const decrypted = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encrypted.buffer
  )
  return u8(decrypted)
}

/**
 * Odd crypto implementation
 *
 * @param {import('@oddjs/odd').Configuration} config
 * @param {Uint8Array} publicKey
 * @param {Uint8Array} privateKey
 * @returns {Promise<import('@oddjs/odd/components/crypto/implementation').Implementation>}
 */
export async function implementation(config, publicKey, privateKey) {
  const defaultCrypto = await odd.defaultCryptoComponent(config)

  return {
    aes: defaultCrypto.aes,
    hash: defaultCrypto.hash,
    misc: defaultCrypto.misc,
    rsa: defaultCrypto.rsa,
    did: {
      keyTypes: {
        ...defaultCrypto.did.keyTypes,
        ed25519: {
          magicBytes: ED25519_DID_PREFIX,
          verify: (opts) => {
            return ed.verifyAsync(opts.signature, opts.message, opts.publicKey)
          },
        },
      },
    },
    keystore: {
      ...defaultCrypto.keystore,
      getAlgorithm: async () => 'ed25519',
      getUcanAlgorithm: async () => 'EdDSA',
      sign: async (/** @type {string | Uint8Array} */ data) => {
        return ed.signAsync(data, privateKey)
      },
      publicWriteKey: async () => {
        return publicKey
      },
    },
  }
}
