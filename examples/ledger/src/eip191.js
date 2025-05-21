import { keccak_256 } from '@noble/hashes/sha3'
import { Signature } from '@noble/secp256k1'
import { hex } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { concat } from 'iso-base/utils'

import * as Address from 'ox/Address'
import * as PublicKey from 'ox/PublicKey'
import * as SignatureOx from 'ox/Signature'

const PREFIX = '\x19Ethereum Signed Message:\n'

/**
 * @param {`0x${string}`} signature
 * @param {Uint8Array<ArrayBufferLike>} data
 */
export function decodeSignature(signature, data) {
  const sig = hex.decode(signature.slice(2))
  const pubKey = Signature.fromCompact(sig.slice(0, 64))
    .addRecoveryBit(SignatureOx.vToYParity(sig[64]))
    .recoverPublicKey(getSignPayload(data))
    .toRawBytes(false)

  const address = Address.fromPublicKey(PublicKey.fromBytes(pubKey))
  console.log('🚀 ~ decodeSignature ~ address:', address)
  return {
    address,
    publicKey: pubKey,
  }
}

/**
 * @param { Uint8Array} data
 */
export function getSignPayload(data) {
  const prefixBytes = utf8.decode(`${PREFIX}${data.length}`)
  return keccak_256(concat([prefixBytes, data]))
}
