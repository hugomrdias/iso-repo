import { keccak_256 } from '@noble/hashes/sha3'
import { recoverPublicKeyAsync, Signature, verifyAsync } from '@noble/secp256k1'
import { hex } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { concat } from 'iso-base/utils'
import * as SignatureOx from 'ox/Signature'

const PREFIX = '\x19Ethereum Signed Message:\n'

/**
 * Convert a 0x signature to a Uint8Array
 *
 * @param {`0x${string}`} signature
 */
export function hexToBytes(signature) {
  return hex.decode(signature.slice(2))
}

/**
 * @param {Uint8Array<ArrayBuffer>} data
 */
export function getSignPayload(data) {
  const prefixBytes = utf8.decode(`${PREFIX}${data.length}`)
  return keccak_256(concat([prefixBytes, data]))
}

/** @type {import('../types.js').Verify} */
export async function verify({ signature, message }) {
  const msgHash = getSignPayload(message)
  const sigRecovered = Signature.fromBytes(signature.slice(0, 64))
    .addRecoveryBit(SignatureOx.vToYParity(signature[64]))
    .toBytes('recovered')
  const pubKey = await recoverPublicKeyAsync(sigRecovered, msgHash, {
    prehash: false,
  })

  return await verifyAsync(sigRecovered, msgHash, pubKey, {
    prehash: false,
    format: 'recovered',
  })
}

/** @type {import('../types').Verifier<'EIP191'>} */
export const verifier = {
  EIP191: verify,
}
