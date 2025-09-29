import { verifyAsync as secpVerify } from '@noble/secp256k1'
import { webcrypto } from 'iso-base/crypto'
import { decompress, isCompressed } from 'iso-base/ec-compression'
import { createEcdsaParams } from '../signers/ecdsa.js'

/**
 *
 * @param {import('../signers/ecdsa.js').Curves} curve
 */
function createVerifier(curve) {
  const params = createEcdsaParams(curve)

  /** @type {import('../types.js').Verify} */
  async function fn({ signature, message, did }) {
    let publicKey = did.verifiableDid.publicKey
    if (isCompressed(publicKey)) {
      publicKey = decompress(publicKey, params.namedCurve)
    }

    const key = await webcrypto.subtle.importKey(
      'raw',
      /** @type {BufferSource} */ (publicKey),
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
      /** @type {BufferSource} */ (signature),
      /** @type {BufferSource} */ (message)
    )
  }

  return fn
}
/** @type {import('../types.js').Verify} */
async function es256kVerify({ signature, message, did }) {
  if (signature.length !== 64) {
    throw new Error('Invalid signature length')
  }

  return await secpVerify(signature, message, did.verifiableDid.publicKey)
}

/** @type {import('../types.js').Verifier<'ES256' | 'ES384' | 'ES512' | 'ES256K'>} */
export const verifier = {
  ES256: createVerifier('P-256'),
  ES384: createVerifier('P-384'),
  ES512: createVerifier('P-521'),
  ES256K: es256kVerify,
}

/**
 *
 * @param {'ES256' | 'ES384' | 'ES512' | 'ES256K'} type
 * @param {import('../types.js').VerifyInput} param1
 * @returns
 */
export async function verify(type, { signature, message, did }) {
  return await verifier[type]({ signature, message, did })
}
