// import * as DID from '@ipld/dag-ucan/did'
import { utf8 } from 'iso-base/utf8'
import { DIDKey } from 'iso-did/key'
import { webcrypto } from 'iso-base/crypto'
import { concat } from 'iso-base/utils'
import { compressP256Pubkey } from './utils.js'

// export const P256_DID_PREFIX = new Uint8Array([0x80, 0x24])
// export const ED25519_DID_PREFIX = new Uint8Array([0xed, 0x01])

/**
 * COSE Keys
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#key-common-parameters
 * https://www.iana.org/assignments/cose/cose.xhtml#key-type-parameters
 */
export const COSEKEYS_MAP = /** @type {const} */ ({
  kty: 1,
  alg: 3,
  crv: -1,
  x: -2,
  y: -3,
  n: -1,
  e: -2,
})

export const COSEALG_MAP = /** @type {const} */ ({
  ES256: -7,
  EdDSA: -8,
  ES384: -35,
  ES512: -36,
  PS256: -37,
  PS384: -38,
  PS512: -39,
  ES256K: -47,
  RS256: -257,
  RS384: -258,
  RS512: -259,
  RS1: -65_535,
})

/**
 * @typedef {typeof COSEALG_MAP} CoseAlgMap
 * @typedef {CoseAlgMap[keyof CoseAlgMap]} COSEALG
 */

/**
 * Get COSE key type
 *
 * @param {import("./types.js").COSEPublicKey} key
 */
export function getCoseKeyType(key) {
  const type = key[COSEKEYS_MAP.kty]

  switch (type) {
    case 1: {
      return 'OKP'
    }
    case 2: {
      return 'EC2'
    }
    case 3: {
      return 'RSA'
    }

    default: {
      throw new Error(`COSE key type ${type} is not supported`)
    }
  }
}

/**
 * Convert a COSE alg ID into a corresponding string value that WebCrypto APIs expect
 *
 * @param {COSEALG} alg
 */
export function mapCoseAlgToWebCryptoAlg(alg) {
  // @ts-ignore
  if ([COSEALG_MAP.RS1].includes(alg)) {
    return 'SHA-1'
  } else if (
    // @ts-ignore
    [COSEALG_MAP.ES256, COSEALG_MAP.PS256, COSEALG_MAP.RS256].includes(alg)
  ) {
    return 'SHA-256'
  } else if (
    // @ts-ignore
    [COSEALG_MAP.ES384, COSEALG_MAP.PS384, COSEALG_MAP.RS384].includes(alg)
  ) {
    return 'SHA-384'
  } else if (
    [
      COSEALG_MAP.ES512,
      COSEALG_MAP.PS512,
      COSEALG_MAP.RS512,
      COSEALG_MAP.EdDSA,
      // @ts-ignore
    ].includes(alg)
  ) {
    return 'SHA-512'
  }

  throw new Error(`Could not map COSE alg value of ${alg} to a WebCrypto alg`)
}

/**
 * @param {import("./types.js").COSEPublicKeyEC2} key
 */
export function didFromCose(key) {
  const x = key[COSEKEYS_MAP.x]
  const y = key[COSEKEYS_MAP.y]

  const keyType = getCoseKeyType(key)

  switch (keyType) {
    case 'EC2': {
      const buf = concat([[4], x, y])

      return DIDKey.fromPublicKey('P256', compressP256Pubkey(buf)).toString()
    }
    case 'OKP': {
      return DIDKey.fromPublicKey('ED25519', x).toString()
    }

    default: {
      throw new Error('cose key type not supported')
    }
  }
}

/**
 * Hash based on the cose alg using web crypto
 *
 * @param {Uint8Array | string} data
 * @param {import('./cose.js').COSEALG} alg - Cose alg, defaults to -7 (ES256) SHA-256 for web crypto
 */
export async function hash(data, alg = -7) {
  if (typeof data === 'string') {
    data = utf8.decode(data)
  }

  const subtleAlg = mapCoseAlgToWebCryptoAlg(alg)

  return new Uint8Array(await webcrypto.subtle.digest(subtleAlg, data))
}
