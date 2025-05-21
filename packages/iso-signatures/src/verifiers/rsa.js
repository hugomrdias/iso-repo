import { webcrypto } from 'iso-base/crypto'
import { spki } from '../spki.js'

/** @type {import('../types.js').Verify} */
export async function verify({ signature, message, did }) {
  const key = await webcrypto.subtle.importKey(
    'spki',
    spki.encode(did.verifiableDid.publicKey),
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

/** @type {import('../types.js').Verifier<'RS256'>} */
export const verifier = {
  RS256: verify,
}
