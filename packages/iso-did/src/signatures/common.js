/**
 *
 * @param {Omit<import('./types').KeyType, 'RSA'>} type
 */
export function keyTypeToAlg(type) {
  switch (type) {
    case 'Ed25519': {
      return 'EdDSA'
    }
    case 'P-256': {
      return 'ES256'
    }
    case 'P-384': {
      return 'ES384'
    }
    case 'P-521': {
      return 'ES512'
    }
    case 'secp256k1': {
      return 'ES256K'
    }
    default: {
      throw new TypeError(`Unsupported key type ${type}`)
    }
  }
}

/**
 * Create params for ECDSA.
 *
 * @param {import('./types.js').SignatureAlgorithm} type
 * @returns {{name: 'ECDSA', namedCurve: 'P-256' | 'P-384' | 'P-521', hash: 'SHA-256' | 'SHA-384' | 'SHA-512'}}
 */
export function createEcdsaParams(type) {
  switch (type) {
    case 'ES256': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-256',
        hash: 'SHA-256',
      }
    }
    case 'ES384': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-384',
        hash: 'SHA-384',
      }
    }
    case 'ES512': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-521',
        hash: 'SHA-512',
      }
    }

    default: {
      throw new TypeError(`Unsupported algorithm ${type}`)
    }
  }
}
