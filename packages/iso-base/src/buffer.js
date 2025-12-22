/**
 * Cross-platform binary buffer with cursor-based reading/writing.
 *
 * @example
 * ```ts twoslash
 * import { ISOBuffer } from 'iso-base/buffer'
 *
 * const buf = new ISOBuffer(16)
 * buf.writeUint32(0xdeadbeef)
 * buf.writeVarint(300)
 * buf.rewind()
 * console.log(buf.readUint32().toString(16)) // 'deadbeef'
 * console.log(buf.readVarint()) // 300
 * ```
 *
 * @module
 */

import { unsigned as leb128 } from './leb128.js'
import { utf8 } from './utf8.js'
import * as varint from './varint.js'

/** @import { ISOBufferInput, ISOBufferOptions } from './types.js' */

const DEFAULT_SIZE = 1024 * 8

/**
 * Cross-platform binary buffer with auto-advancing cursor.
 *
 * @example
 * ```ts twoslash
 * import { ISOBuffer } from 'iso-base/buffer'
 *
 * // Create from size
 * const buf = new ISOBuffer(256)
 *
 * // Write some data
 * buf.writeUint8(0x01)
 * buf.writeUint32(0xdeadbeef)
 * buf.writeUtf8('hello')
 *
 * // Rewind and read back
 * buf.rewind()
 * console.log(buf.readUint8()) // 1
 * console.log(buf.readUint32().toString(16)) // 'deadbeef'
 * console.log(buf.readUtf8(5)) // 'hello'
 * ```
 */
export class ISOBuffer {
  /**
   * The underlying ArrayBuffer
   *
   * @type {ArrayBuffer}
   */
  buffer

  /**
   * Uint8Array view over the buffer
   *
   * @type {Uint8Array}
   */
  bytes

  /**
   * Current cursor position
   *
   * @type {number}
   */
  offset

  /**
   * Byte length of the buffer
   *
   * @type {number}
   */
  length

  /**
   * Byte offset within the underlying ArrayBuffer
   *
   * @type {number}
   */
  byteOffset

  /**
   * Byte length of the buffer (alias for length, for compatibility)
   *
   * @type {number}
   */
  get byteLength() {
    return this.length
  }

  /**
   * @type {boolean}
   * @private
   */
  littleEndian

  /**
   * @type {DataView}
   * @private
   */
  _data

  /**
   * @type {number}
   * @private
   */
  _mark

  /**
   * @type {number[]}
   * @private
   */
  _marks

  /**
   * Tracks the last written byte position for toArray()
   *
   * @type {number}
   * @private
   */
  _lastWrittenByte

  /**
   * Create a new ISOBuffer.
   *
   * @param {ISOBufferInput} [data] - Initial data or size. Defaults to 8KB.
   *   - If a number, creates a new buffer of that size
   *   - If ArrayBuffer/Uint8Array/ISOBuffer, wraps it (zero-copy view)
   * @param {ISOBufferOptions} [options] - Configuration options
   *
   * @example
   * ```ts twoslash
   * import { ISOBuffer } from 'iso-base/buffer'
   *
   * // From size
   * const buf1 = new ISOBuffer(256)
   *
   * // From Uint8Array (zero-copy)
   * const arr = new Uint8Array([1, 2, 3, 4])
   * const buf2 = new ISOBuffer(arr)
   *
   * // From ArrayBuffer with offset
   * const ab = new ArrayBuffer(100)
   * const buf3 = new ISOBuffer(ab, { offset: 10 })
   *
   * // Big-endian mode
   * const buf4 = new ISOBuffer(64, { littleEndian: false })
   * ```
   */
  constructor(data = DEFAULT_SIZE, options = {}) {
    let dataIsGiven = false
    /** @type {ArrayBuffer} */
    let arrayBuffer

    if (typeof data === 'number') {
      arrayBuffer = new ArrayBuffer(data)
    } else if (data instanceof ISOBuffer) {
      dataIsGiven = true
      arrayBuffer = /** @type {ArrayBuffer} */ (data.buffer)
    } else if (ArrayBuffer.isView(data)) {
      dataIsGiven = true
      arrayBuffer = /** @type {ArrayBuffer} */ (data.buffer)
    } else {
      dataIsGiven = true
      arrayBuffer = /** @type {ArrayBuffer} */ (data)
    }

    const inputOffset = options.offset ? options.offset >>> 0 : 0
    let dvOffset = inputOffset

    // Handle views that may have their own byteOffset
    if (ArrayBuffer.isView(data) || data instanceof ISOBuffer) {
      const view =
        /** @type {ArrayBufferView & { buffer: ArrayBuffer, byteOffset: number, byteLength: number }} */ (
          data
        )
      if (view.byteLength !== view.buffer.byteLength) {
        dvOffset = view.byteOffset + inputOffset
      }
    }

    const byteLength = arrayBuffer.byteLength - dvOffset

    this.buffer = arrayBuffer
    this.bytes = new Uint8Array(arrayBuffer, dvOffset, byteLength)
    this.length = byteLength
    this.byteOffset = dvOffset
    this.offset = 0
    this.littleEndian = options.littleEndian !== false
    this._data = new DataView(arrayBuffer, dvOffset, byteLength)
    this._mark = 0
    this._marks = []
    this._lastWrittenByte = dataIsGiven ? byteLength : 0
  }

  // ============================================================
  // Capacity & Growth
  // ============================================================

  /**
   * Check if there's enough space to read/write n bytes from current offset.
   *
   * @param {number} [byteLength=1] - Number of bytes needed
   * @returns {boolean} True if space is available
   *
   * @example
   * ```ts twoslash
   * import { ISOBuffer } from 'iso-base/buffer'
   *
   * const buf = new ISOBuffer(4)
   * buf.available(4) // true
   * buf.skip(2)
   * buf.available(4) // false
   * buf.available(2) // true
   * ```
   */
  available(byteLength = 1) {
    return this.offset + byteLength <= this.length
  }

  /**
   * Ensure buffer has enough space, growing if necessary.
   * Growth strategy: double the required size.
   *
   * @param {number} [byteLength=1] - Number of bytes needed
   * @returns {this}
   *
   * @example
   * ```ts twoslash
   * import { ISOBuffer } from 'iso-base/buffer'
   *
   * const buf = new ISOBuffer(4)
   * buf.seek(4)
   * buf.ensureAvailable(10) // Buffer grows to accommodate
   * buf.available(10) // true
   * ```
   */
  ensureAvailable(byteLength = 1) {
    if (!this.available(byteLength)) {
      const requiredLength = this.offset + byteLength
      const newLength = requiredLength * 2
      const newArray = new Uint8Array(newLength)
      newArray.set(this.bytes)
      this.buffer = newArray.buffer
      this.bytes = newArray
      this.length = newLength
      this._data = new DataView(this.buffer)
    }
    return this
  }

  // ============================================================
  // Endianness
  // ============================================================

  /**
   * Check if little-endian mode is active.
   *
   * @returns {boolean}
   */
  isLittleEndian() {
    return this.littleEndian
  }

  /**
   * Check if big-endian mode is active.
   *
   * @returns {boolean}
   */
  isBigEndian() {
    return !this.littleEndian
  }

  /**
   * Switch to little-endian mode.
   *
   * @returns {this}
   */
  setLittleEndian() {
    this.littleEndian = true
    return this
  }

  /**
   * Switch to big-endian mode.
   *
   * @returns {this}
   */
  setBigEndian() {
    this.littleEndian = false
    return this
  }

  // ============================================================
  // Cursor Navigation
  // ============================================================

  /**
   * Move cursor forward by n bytes.
   *
   * @param {number} [n=1] - Bytes to skip
   * @returns {this}
   */
  skip(n = 1) {
    this.offset += n
    return this
  }

  /**
   * Move cursor backward by n bytes.
   *
   * @param {number} [n=1] - Bytes to go back
   * @returns {this}
   */
  back(n = 1) {
    this.offset -= n
    return this
  }

  /**
   * Move cursor to specific offset.
   *
   * @param {number} offset - Target offset
   * @returns {this}
   */
  seek(offset) {
    this.offset = offset
    return this
  }

  /**
   * Move cursor back to start (offset 0).
   *
   * @returns {this}
   */
  rewind() {
    this.offset = 0
    return this
  }

  // ============================================================
  // Mark/Reset (Bookmarking)
  // ============================================================

  /**
   * Store current offset for later reset.
   *
   * @returns {this}
   * @see {@link ISOBuffer#reset}
   */
  mark() {
    this._mark = this.offset
    return this
  }

  /**
   * Return to last marked offset.
   *
   * @returns {this}
   * @see {@link ISOBuffer#mark}
   */
  reset() {
    this.offset = this._mark
    return this
  }

  /**
   * Push current offset onto mark stack.
   *
   * @returns {this}
   * @see {@link ISOBuffer#popMark}
   */
  pushMark() {
    this._marks.push(this.offset)
    return this
  }

  /**
   * Pop offset from mark stack and seek to it.
   *
   * @returns {this}
   * @throws {Error} If mark stack is empty
   * @see {@link ISOBuffer#pushMark}
   */
  popMark() {
    const offset = this._marks.pop()
    if (offset === undefined) {
      throw new Error('Mark stack is empty')
    }
    this.offset = offset
    return this
  }

  // ============================================================
  // Read Operations - Integers
  // ============================================================

  /**
   * Read signed 8-bit integer, advance cursor by 1.
   *
   * @returns {number}
   */
  readInt8() {
    return this._data.getInt8(this.offset++)
  }

  /**
   * Read unsigned 8-bit integer, advance cursor by 1.
   *
   * @returns {number}
   */
  readUint8() {
    return this._data.getUint8(this.offset++)
  }

  /**
   * Read signed 16-bit integer, advance cursor by 2.
   *
   * @returns {number}
   */
  readInt16() {
    const value = this._data.getInt16(this.offset, this.littleEndian)
    this.offset += 2
    return value
  }

  /**
   * Read unsigned 16-bit integer, advance cursor by 2.
   *
   * @returns {number}
   */
  readUint16() {
    const value = this._data.getUint16(this.offset, this.littleEndian)
    this.offset += 2
    return value
  }

  /**
   * Read signed 32-bit integer, advance cursor by 4.
   *
   * @returns {number}
   */
  readInt32() {
    const value = this._data.getInt32(this.offset, this.littleEndian)
    this.offset += 4
    return value
  }

  /**
   * Read unsigned 32-bit integer, advance cursor by 4.
   *
   * @returns {number}
   */
  readUint32() {
    const value = this._data.getUint32(this.offset, this.littleEndian)
    this.offset += 4
    return value
  }

  /**
   * Read signed 64-bit BigInt, advance cursor by 8.
   *
   * @returns {bigint}
   */
  readBigInt64() {
    const value = this._data.getBigInt64(this.offset, this.littleEndian)
    this.offset += 8
    return value
  }

  /**
   * Read unsigned 64-bit BigInt, advance cursor by 8.
   *
   * @returns {bigint}
   */
  readBigUint64() {
    const value = this._data.getBigUint64(this.offset, this.littleEndian)
    this.offset += 8
    return value
  }

  // ============================================================
  // Read Operations - Floats
  // ============================================================

  /**
   * Read 32-bit float, advance cursor by 4.
   *
   * @returns {number}
   */
  readFloat32() {
    const value = this._data.getFloat32(this.offset, this.littleEndian)
    this.offset += 4
    return value
  }

  /**
   * Read 64-bit double, advance cursor by 8.
   *
   * @returns {number}
   */
  readFloat64() {
    const value = this._data.getFloat64(this.offset, this.littleEndian)
    this.offset += 8
    return value
  }

  // ============================================================
  // Read Operations - Bytes & Strings
  // ============================================================

  /**
   * Read n bytes as Uint8Array (zero-copy subarray), advance cursor.
   *
   * @param {number} n - Number of bytes to read
   * @returns {Uint8Array}
   */
  readBytes(n) {
    const bytes = this.bytes.subarray(this.offset, this.offset + n)
    this.offset += n
    return bytes
  }

  /**
   * Read n bytes and decode as UTF-8 string.
   *
   * @param {number} n - Number of bytes to read
   * @returns {string}
   */
  readUtf8(n) {
    return utf8.encode(this.readBytes(n))
  }

  /**
   * Read a boolean (1 byte, false if 0, true otherwise).
   *
   * @returns {boolean}
   */
  readBoolean() {
    return this.readUint8() !== 0
  }

  // ============================================================
  // Read Operations - Variable Length Integers
  // ============================================================

  /**
   * Read unsigned varint (multiformats style), advance cursor.
   *
   * @returns {number} The decoded value
   *
   * @example
   * ```ts twoslash
   * import { ISOBuffer } from 'iso-base/buffer'
   *
   * const buf = new ISOBuffer(new Uint8Array([0xac, 0x02]))
   * console.log(buf.readVarint()) // 300
   * ```
   */
  readVarint() {
    const [value, bytesRead] = varint.decode(this.bytes, this.offset)
    this.offset += bytesRead
    return value
  }

  /**
   * Read unsigned LEB128 encoded bigint, advance cursor.
   *
   * @returns {bigint} The decoded value
   */
  readLeb128() {
    const [value, bytesRead] = leb128.decode(this.bytes, this.offset)
    this.offset += bytesRead
    return value
  }

  // ============================================================
  // Write Operations - Integers
  // ============================================================

  /**
   * Update lastWrittenByte tracker after write.
   *
   * @private
   */
  _updateLastWrittenByte() {
    if (this.offset > this._lastWrittenByte) {
      this._lastWrittenByte = this.offset
    }
  }

  /**
   * Write signed 8-bit integer, advance cursor by 1.
   *
   * @param {number} value
   * @returns {this}
   */
  writeInt8(value) {
    this.ensureAvailable(1)
    this._data.setInt8(this.offset++, value)
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write unsigned 8-bit integer, advance cursor by 1.
   *
   * @param {number} value
   * @returns {this}
   */
  writeUint8(value) {
    this.ensureAvailable(1)
    this._data.setUint8(this.offset++, value)
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write signed 16-bit integer, advance cursor by 2.
   *
   * @param {number} value
   * @returns {this}
   */
  writeInt16(value) {
    this.ensureAvailable(2)
    this._data.setInt16(this.offset, value, this.littleEndian)
    this.offset += 2
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write unsigned 16-bit integer, advance cursor by 2.
   *
   * @param {number} value
   * @returns {this}
   */
  writeUint16(value) {
    this.ensureAvailable(2)
    this._data.setUint16(this.offset, value, this.littleEndian)
    this.offset += 2
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write signed 32-bit integer, advance cursor by 4.
   *
   * @param {number} value
   * @returns {this}
   */
  writeInt32(value) {
    this.ensureAvailable(4)
    this._data.setInt32(this.offset, value, this.littleEndian)
    this.offset += 4
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write unsigned 32-bit integer, advance cursor by 4.
   *
   * @param {number} value
   * @returns {this}
   */
  writeUint32(value) {
    this.ensureAvailable(4)
    this._data.setUint32(this.offset, value, this.littleEndian)
    this.offset += 4
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write signed 64-bit BigInt, advance cursor by 8.
   *
   * @param {bigint} value
   * @returns {this}
   */
  writeBigInt64(value) {
    this.ensureAvailable(8)
    this._data.setBigInt64(this.offset, value, this.littleEndian)
    this.offset += 8
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write unsigned 64-bit BigInt, advance cursor by 8.
   *
   * @param {bigint} value
   * @returns {this}
   */
  writeBigUint64(value) {
    this.ensureAvailable(8)
    this._data.setBigUint64(this.offset, value, this.littleEndian)
    this.offset += 8
    this._updateLastWrittenByte()
    return this
  }

  // ============================================================
  // Write Operations - Floats
  // ============================================================

  /**
   * Write 32-bit float, advance cursor by 4.
   *
   * @param {number} value
   * @returns {this}
   */
  writeFloat32(value) {
    this.ensureAvailable(4)
    this._data.setFloat32(this.offset, value, this.littleEndian)
    this.offset += 4
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write 64-bit double, advance cursor by 8.
   *
   * @param {number} value
   * @returns {this}
   */
  writeFloat64(value) {
    this.ensureAvailable(8)
    this._data.setFloat64(this.offset, value, this.littleEndian)
    this.offset += 8
    this._updateLastWrittenByte()
    return this
  }

  // ============================================================
  // Write Operations - Bytes & Strings
  // ============================================================

  /**
   * Write bytes from Uint8Array, advance cursor.
   *
   * @param {Uint8Array | ArrayLike<number>} bytes
   * @returns {this}
   */
  writeBytes(bytes) {
    const len = bytes.length
    this.ensureAvailable(len)
    this.bytes.set(bytes, this.offset)
    this.offset += len
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write string as UTF-8 encoded bytes.
   *
   * @param {string} str
   * @returns {this}
   */
  writeUtf8(str) {
    const encoded = utf8.decode(str)
    return this.writeBytes(encoded)
  }

  /**
   * Write boolean as single byte (0xff for true, 0x00 for false).
   *
   * @param {boolean} value
   * @returns {this}
   */
  writeBoolean(value) {
    return this.writeUint8(value ? 0xff : 0x00)
  }

  // ============================================================
  // Write Operations - Variable Length Integers
  // ============================================================

  /**
   * Write unsigned varint (multiformats style), advance cursor.
   *
   * @param {number} value - Value to encode (must be non-negative safe integer)
   * @returns {this}
   *
   * @example
   * ```ts twoslash
   * import { ISOBuffer } from 'iso-base/buffer'
   *
   * const buf = new ISOBuffer(16)
   * buf.writeVarint(300)
   * console.log(buf.toArray()) // Uint8Array([0xac, 0x02])
   * ```
   */
  writeVarint(value) {
    const size = varint.encodingLength(value)
    this.ensureAvailable(size)
    varint.encode(value, this.bytes, this.offset)
    this.offset += size
    this._updateLastWrittenByte()
    return this
  }

  /**
   * Write unsigned LEB128 encoded bigint.
   *
   * @param {number | bigint | string} value - Value to encode
   * @returns {this}
   */
  writeLeb128(value) {
    const encoded = leb128.encode(value)
    return this.writeBytes(encoded)
  }

  // ============================================================
  // Export & Utility
  // ============================================================

  /**
   * Get a Uint8Array of the written portion of the buffer.
   * This is a view from byteOffset to lastWrittenByte.
   *
   * @returns {Uint8Array}
   */
  toArray() {
    return new Uint8Array(this.buffer, this.byteOffset, this._lastWrittenByte)
  }

  /**
   * Get a zero-copy subarray view.
   *
   * @param {number} [start=0] - Start offset
   * @param {number} [end] - End offset (defaults to length)
   * @returns {Uint8Array}
   */
  subarray(start = 0, end) {
    return this.bytes.subarray(start, end)
  }

  /**
   * Get number of bytes written so far.
   *
   * @returns {number}
   */
  getWrittenLength() {
    return this._lastWrittenByte
  }

  /**
   * Get remaining bytes available from current offset.
   *
   * @returns {number}
   */
  remaining() {
    return this.length - this.offset
  }

  /**
   * Create a new ISOBuffer wrapping the same underlying buffer.
   * Changes to either buffer affect the other.
   *
   * @returns {ISOBuffer}
   */
  clone() {
    const cloned = new ISOBuffer(this.buffer, {
      offset: this.byteOffset,
      littleEndian: this.littleEndian,
    })
    cloned.offset = this.offset
    cloned._lastWrittenByte = this._lastWrittenByte
    cloned._mark = this._mark
    cloned._marks = [...this._marks]
    return cloned
  }

  /**
   * Create a deep copy with its own ArrayBuffer.
   *
   * @returns {ISOBuffer}
   */
  deepClone() {
    const newBuffer = new ArrayBuffer(this.length)
    const newBytes = new Uint8Array(newBuffer)
    newBytes.set(this.bytes)
    const cloned = new ISOBuffer(newBuffer, {
      littleEndian: this.littleEndian,
    })
    cloned.offset = this.offset
    cloned._lastWrittenByte = this._lastWrittenByte
    cloned._mark = this._mark
    cloned._marks = [...this._marks]
    return cloned
  }
}
