/**
 * Create web crypto params for ECDSA.
 *
 * @param {import("iso-did/types").SignatureAlgorithm} alg
 * @returns {{name: 'ECDSA', namedCurve: 'P-256' | 'P-384' | 'P-521', hash: 'SHA-256' | 'SHA-384' | 'SHA-512'}}
 */
export function createEcdsaParams(alg) {
  switch (alg) {
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
      throw new TypeError(`Unsupported algorithm ${alg}`)
    }
  }
}
