/**
 * Elliptic-curve-point-compression for p256 65 byte pubkey
 *
 * @param { Uint8Array} pubkeyBytes
 */
export function compressP256Pubkey(pubkeyBytes) {
  if (pubkeyBytes.length !== 65) {
    throw new Error('Expected 65 byte pubkey')
  } else if (pubkeyBytes[0] !== 0x04) {
    throw new Error('Expected first byte to be 0x04')
  }
  // first byte is a prefix
  const x = pubkeyBytes.slice(1, 33)
  const y = pubkeyBytes.slice(33, 65)
  const out = new Uint8Array(x.length + 1)

  out[0] = 2 + (y[y.length - 1] & 1)
  out.set(x, 1)

  return out
}
