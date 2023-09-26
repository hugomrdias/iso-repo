import { webcrypto } from 'iso-base/crypto'

/** @type {import('../types.js').Verify} */
export async function verify({ signature, message, publicKey }) {
  const key = await webcrypto.subtle.importKey(
    'spki',
    publicKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    true,
    ['verify']
  )

  return await webcrypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', saltLength: 128 },
    key,
    signature,
    message
  )
}

/** @type {import('../types.js').Verifier<'RS256_OLD'>} */
export const verifier = {
  RS256_OLD: verify,
}
