import { keccak_256 } from '@noble/hashes/sha3.js'
import { Point, recoverPublicKeyAsync, Signature } from '@noble/secp256k1'
import { hex } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { concat } from 'iso-base/utils'
import { DIDPkh } from 'iso-did/pkh'

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
 * @param {Uint8Array} data
 */
export function getSignPayload(data) {
  const prefixBytes = utf8.decode(`${PREFIX}${data.length}`)
  return keccak_256(concat([prefixBytes, data]))
}

/** @type {import('../types.js').Verify} */
export async function verify({ signature, message, did, strict }) {
  if (signature.length !== 65) {
    throw new Error('Invalid signature length')
  }

  // personal_sign signatures carry v as 27/28, or 0/1 from some signers.
  // EIP-155 values (v >= 35) only apply to transactions.
  const v = signature[64]
  if (v !== 0 && v !== 1 && v !== 27 && v !== 28) {
    throw new Error('Invalid signature recovery byte')
  }

  const didPkh = DIDPkh.fromString(did.did)
  const sig = Signature.fromBytes(signature.slice(0, 64))
  // strict mode only accepts the canonical encoding: low S and v as 27/28
  if (strict && (sig.hasHighS() || (v !== 27 && v !== 28))) {
    return false
  }

  const sigRecovered = sig.addRecoveryBit(v % 27).toBytes('recovered')
  const pubKey = await recoverPublicKeyAsync(
    sigRecovered,
    getSignPayload(message),
    { prehash: false }
  )
  // Ethereum addresses are the last 20 bytes of Keccak-256(x || y), without
  // the uncompressed SEC1 public key's 0x04 prefix.
  const publicKey = Point.fromBytes(pubKey).toBytes(false).subarray(1)
  const address = `0x${hex.encode(keccak_256(publicKey).subarray(-20))}`

  if (!/^0x[\da-fA-F]{40}$/.test(didPkh.address)) {
    throw new TypeError(`Invalid Ethereum address "${didPkh.address}"`)
  }
  return address === didPkh.address.toLowerCase()
}

/** @type {import('../types').Verifier<'EIP191'>} */
export const verifier = {
  EIP191: verify,
}
