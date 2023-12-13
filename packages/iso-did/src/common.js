/* eslint-disable unicorn/numeric-separators-style */
export const KEY_TYPE_ALG = /** @type {const} */ ({
  Ed25519: 'EdDSA',
  'P-256': 'ES256',
  'P-384': 'ES384',
  'P-521': 'ES512',
  secp256k1: 'ES256K',
  RSA: 'RS256',
})

export const ALG_KEY_TYPE = /** @type {const} */ ({
  EdDSA: 'Ed25519',
  ES256: 'P-256',
  ES384: 'P-384',
  ES512: 'P-521',
  ES256K: 'secp256k1',
  RS256: 'RSA',
})

/**
 * @typedef {keyof ALG_KEY_TYPE} Alg
 * @typedef {keyof KEY_TYPE_ALG} KeyType
 */

export const KEY_TYPE_CODE = /** @type {const} */ ({
  Ed25519: 0xed,
  RSA: 0x1205,
  'P-256': 0x1200,
  'P-384': 0x1201,
  'P-521': 0x1202,
  secp256k1: 0xe7,
})

export const CODE_KEY_TYPE = /** @type {const} */ ({
  0xed: 'Ed25519',
  0x1205: 'RSA',
  0x1200: 'P-256',
  0x1201: 'P-384',
  0x1202: 'P-521',
  0xe7: 'secp256k1',
})

/**
 * @typedef {keyof CODE_KEY_TYPE} PublicKeyCode
 */

/**
 * Key type to signature algorithm name.
 *
 * @param {string} type
 * @throws {TypeError} if the key type is not supported.
 */
export function keyTypeToAlg(type) {
  // @ts-ignore
  const alg = /** @type {Alg} */ (KEY_TYPE_ALG[type])

  if (!alg) {
    throw new TypeError(`Unsupported key type ${type}`)
  }
  return alg
}

/**
 * Signature algorithm name to key type.
 *
 * @param {Alg} alg
 * @throws {TypeError} if the algorithm is not supported.
 */
export function algToKeyType(alg) {
  const type = ALG_KEY_TYPE[alg]

  if (!type) {
    throw new TypeError(`Unsupported algorithm ${alg}`)
  }
  return type
}
