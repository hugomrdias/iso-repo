import { keccak_256 } from '@noble/hashes/sha3'
import { Signature } from '@noble/secp256k1'
import { hex } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { concat } from 'iso-base/utils'
import { DIDPkh } from 'iso-did/pkh'
import * as Address from 'ox/Address'
import * as PublicKey from 'ox/PublicKey'
import * as SignatureOx from 'ox/Signature'

const PREFIX = '\x19Ethereum Signed Message:\n'

/**
 * Convert a 0x signature to a Uint8Array
 *
 * @param {`0x${string}`} signature
 * @returns {Uint8Array}
 */
export function hexToBytes(signature) {
  return hex.decode(signature.slice(2))
}

/**
 * @param { Uint8Array} data
 */
export function getSignPayload(data) {
  const prefixBytes = utf8.decode(`${PREFIX}${data.length}`)
  return keccak_256(concat([prefixBytes, data]))
}

/** @type {import('../types.js').Verify} */
export function verify({ signature, message, did }) {
  const didPkh = DIDPkh.fromString(did.did)
  const pubKey = Signature.fromCompact(signature.slice(0, 64))
    .addRecoveryBit(SignatureOx.vToYParity(signature[64]))
    .recoverPublicKey(getSignPayload(message))
    .toRawBytes(false)

  const address = Address.fromPublicKey(PublicKey.fromBytes(pubKey))

  return Promise.resolve(Address.isEqual(address, didPkh.address))
}

/** @type {import('../types').Verifier<'EIP191'>} */
export const verifier = {
  EIP191: verify,
}
