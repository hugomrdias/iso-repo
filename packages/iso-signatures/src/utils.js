import { equals, u8 } from 'iso-base/utils'
import { DIDKey } from 'iso-did/key'

/**
 *
 * @param {import('iso-did/types').KeyType} type
 * @param {BufferSource} publicKey
 * @param {import('iso-did/types').VerifiableDID} [did]
 */
export function didKeyOrVerifiableDID(type, publicKey, did) {
  /** @type {import('iso-did/types').VerifiableDID} */
  let _did = DIDKey.fromPublicKey(type, u8(publicKey))
  if (did) {
    if (!equals(did.verifiableDid.publicKey, _did.verifiableDid.publicKey)) {
      throw new Error('Public key mismatch')
    }

    // if (did.alg !== _did.alg) {
    //   throw new Error('Algorithm mismatch')
    // }

    if (did.verifiableDid.type !== _did.verifiableDid.type) {
      throw new Error('Key type mismatch')
    }
    _did = did
  }

  return _did
}
