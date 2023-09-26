import { webcrypto } from 'iso-base/crypto'
import { decompress, isCompressed } from 'iso-base/ec-compression'
import { createEcdsaParams } from '../utils.js'

/**
 *
 * @param {import('iso-did/types').SignatureAlgorithm} type
 */
function createVerifier(type) {
  const params = createEcdsaParams(type)

  /** @type {import('../types.js').Verify} */
  async function fn({ signature, message, publicKey }) {
    if (isCompressed(publicKey)) {
      publicKey = decompress(publicKey, params.namedCurve)
    }

    const key = await webcrypto.subtle.importKey(
      'raw',
      publicKey,
      { name: params.name, namedCurve: params.namedCurve },
      true,
      ['verify']
    )

    return await webcrypto.subtle.verify(
      {
        name: params.name,
        hash: { name: params.hash },
      },
      key,
      signature,
      message
    )
  }

  return fn
}

/** @type {import('../types.js').Verifier<'ES256' | 'ES384' | 'ES512'>} */
export const verifier = {
  ES256: createVerifier('ES256'),
  ES384: createVerifier('ES384'),
  ES512: createVerifier('ES512'),
}

/**
 *
 * @param {'ES256' | 'ES384' | 'ES512'} type
 * @param {import('../types.js').VerifyInput} param1
 * @returns
 */
export async function verify(type, { signature, message, publicKey }) {
  return await verifier[type]({ signature, message, publicKey })
}
