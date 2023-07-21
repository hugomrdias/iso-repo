export const unsigned = {
  /**
   * Decode a Uint8Array into a number.
   *
   * @param {Uint8Array} buf - Uint8Array containing the representation in LEB128
   * @param {number} offset - Offset to read from
   * @returns {[bigint, number]} - The decoded number and the number of bytes read
   */
  decode(buf, offset = 0) {
    let count = offset
    let byte
    let n = 0n
    let shiftVal = -7n

    do {
      if (count >= buf.byteLength) {
        throw new RangeError(
          'This is not a LEB128-encoded Uint8Array, no ending found!'
        )
      }
      byte = buf[count++]
      shiftVal += 7n
      n += BigInt(byte & 127) << shiftVal
    } while (byte & 128)

    return [n, count - offset]
  },

  /**
   * Create a LEB128 Uint8Array from a number
   *
   * @param {number | string | bigint} num - Number to convert from
   */
  encode(num) {
    let n = BigInt(num)
    if (n < 0)
      throw new Error(`An unsigned number must NOT be negative, ${num} is!`)
    const out = []

    while (true) {
      const byte = Number(n & 127n)
      n >>= 7n
      if (n === 0n) {
        out.push(byte)
        return Uint8Array.from(out)
      }
      out.push(byte | 128)
    }
  },

  /**
   * @param {Uint8Array} buf
   * @param {number} offset
   */
  encodingLength(buf, offset = 0) {
    return this.decode(buf, offset)[1]
  },
}
