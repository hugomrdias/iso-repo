import assert from 'assert'
import { ISOBuffer } from '../src/buffer.js'

describe('ISOBuffer', () => {
  describe('constructor', () => {
    it('creates buffer from size', () => {
      const buf = new ISOBuffer(256)
      assert.equal(buf.length, 256)
      assert.equal(buf.offset, 0)
      assert.equal(buf.isLittleEndian(), true)
    })

    it('creates buffer with default size', () => {
      const buf = new ISOBuffer()
      assert.equal(buf.length, 1024 * 8)
    })

    it('creates buffer from Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5])
      const buf = new ISOBuffer(arr)
      assert.equal(buf.length, 5)
      assert.equal(buf.readUint8(), 1)
      assert.equal(buf.readUint8(), 2)
    })

    it('creates buffer from ArrayBuffer', () => {
      const ab = new ArrayBuffer(16)
      const view = new Uint8Array(ab)
      view[0] = 0xde
      view[1] = 0xad

      const buf = new ISOBuffer(ab)
      assert.equal(buf.length, 16)
      assert.equal(buf.readUint8(), 0xde)
      assert.equal(buf.readUint8(), 0xad)
    })

    it('creates buffer from another ISOBuffer', () => {
      const buf1 = new ISOBuffer(new Uint8Array([1, 2, 3]))
      const buf2 = new ISOBuffer(buf1)
      assert.equal(buf2.readUint8(), 1)
    })

    it('respects offset option', () => {
      const arr = new Uint8Array([0, 0, 1, 2, 3])
      const buf = new ISOBuffer(arr, { offset: 2 })
      assert.equal(buf.readUint8(), 1)
    })

    it('respects littleEndian option', () => {
      const buf = new ISOBuffer(16, { littleEndian: false })
      assert.equal(buf.isBigEndian(), true)
    })
  })

  describe('capacity and growth', () => {
    it('available() checks remaining space', () => {
      const buf = new ISOBuffer(4)
      assert.equal(buf.available(4), true)
      assert.equal(buf.available(5), false)
      buf.skip(2)
      assert.equal(buf.available(2), true)
      assert.equal(buf.available(3), false)
    })

    it('ensureAvailable() grows buffer when needed', () => {
      const buf = new ISOBuffer(4)
      buf.seek(4)
      buf.ensureAvailable(10)
      assert.equal(buf.available(10), true)
      assert.ok(buf.length >= 14)
    })

    it('ensureAvailable() does nothing when space exists', () => {
      const buf = new ISOBuffer(100)
      const originalLength = buf.length
      buf.ensureAvailable(50)
      assert.equal(buf.length, originalLength)
    })
  })

  describe('endianness', () => {
    it('defaults to little-endian', () => {
      const buf = new ISOBuffer(16)
      assert.equal(buf.isLittleEndian(), true)
      assert.equal(buf.isBigEndian(), false)
    })

    it('setLittleEndian() switches to LE', () => {
      const buf = new ISOBuffer(16, { littleEndian: false })
      buf.setLittleEndian()
      assert.equal(buf.isLittleEndian(), true)
    })

    it('setBigEndian() switches to BE', () => {
      const buf = new ISOBuffer(16)
      buf.setBigEndian()
      assert.equal(buf.isBigEndian(), true)
    })

    it('endianness affects multi-byte reads', () => {
      const buf = new ISOBuffer(new Uint8Array([0x01, 0x02]))

      buf.setLittleEndian()
      assert.equal(buf.readUint16(), 0x0201)

      buf.rewind().setBigEndian()
      assert.equal(buf.readUint16(), 0x0102)
    })
  })

  describe('cursor navigation', () => {
    it('skip() moves forward', () => {
      const buf = new ISOBuffer(16)
      buf.skip(5)
      assert.equal(buf.offset, 5)
    })

    it('back() moves backward', () => {
      const buf = new ISOBuffer(16)
      buf.skip(10).back(3)
      assert.equal(buf.offset, 7)
    })

    it('seek() moves to absolute position', () => {
      const buf = new ISOBuffer(16)
      buf.seek(8)
      assert.equal(buf.offset, 8)
    })

    it('rewind() moves to start', () => {
      const buf = new ISOBuffer(16)
      buf.seek(10).rewind()
      assert.equal(buf.offset, 0)
    })
  })

  describe('mark/reset', () => {
    it('mark() and reset() work', () => {
      const buf = new ISOBuffer(16)
      buf.seek(5).mark().seek(10).reset()
      assert.equal(buf.offset, 5)
    })

    it('pushMark() and popMark() work as stack', () => {
      const buf = new ISOBuffer(16)
      buf.seek(3).pushMark()
      buf.seek(7).pushMark()
      buf.seek(15)

      buf.popMark()
      assert.equal(buf.offset, 7)

      buf.popMark()
      assert.equal(buf.offset, 3)
    })

    it('popMark() throws on empty stack', () => {
      const buf = new ISOBuffer(16)
      assert.throws(() => buf.popMark(), /Mark stack is empty/)
    })
  })

  describe('read/write integers', () => {
    it('int8 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeInt8(-42).rewind()
      assert.equal(buf.readInt8(), -42)
    })

    it('uint8 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeUint8(255).rewind()
      assert.equal(buf.readUint8(), 255)
    })

    it('int16 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeInt16(-12345).rewind()
      assert.equal(buf.readInt16(), -12345)
    })

    it('uint16 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeUint16(65535).rewind()
      assert.equal(buf.readUint16(), 65535)
    })

    it('int32 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeInt32(-2147483648).rewind()
      assert.equal(buf.readInt32(), -2147483648)
    })

    it('uint32 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeUint32(0xdeadbeef).rewind()
      assert.equal(buf.readUint32(), 0xdeadbeef)
    })

    it('bigint64 round-trip', () => {
      const buf = new ISOBuffer(16)
      const val = -9223372036854775808n
      buf.writeBigInt64(val).rewind()
      assert.equal(buf.readBigInt64(), val)
    })

    it('biguint64 round-trip', () => {
      const buf = new ISOBuffer(16)
      const val = 18446744073709551615n
      buf.writeBigUint64(val).rewind()
      assert.equal(buf.readBigUint64(), val)
    })
  })

  describe('read/write floats', () => {
    it('float32 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeFloat32(3.14).rewind()
      assert.ok(Math.abs(buf.readFloat32() - 3.14) < 0.001)
    })

    it('float64 round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeFloat64(Math.PI).rewind()
      assert.equal(buf.readFloat64(), Math.PI)
    })
  })

  describe('read/write bytes and strings', () => {
    it('readBytes returns subarray', () => {
      const buf = new ISOBuffer(new Uint8Array([1, 2, 3, 4, 5]))
      const bytes = buf.readBytes(3)
      assert.deepEqual(bytes, new Uint8Array([1, 2, 3]))
      assert.equal(buf.offset, 3)
    })

    it('writeBytes writes array', () => {
      const buf = new ISOBuffer(16)
      buf.writeBytes(new Uint8Array([0xca, 0xfe, 0xba, 0xbe]))
      buf.rewind()
      assert.equal(buf.readUint32(), 0xbebafeca) // little-endian
    })

    it('utf8 round-trip', () => {
      const buf = new ISOBuffer(64)
      const str = 'Hello, 世界! 🌍'
      const encoded = new TextEncoder().encode(str)
      buf.writeUtf8(str).rewind()
      assert.equal(buf.readUtf8(encoded.length), str)
    })

    it('boolean round-trip', () => {
      const buf = new ISOBuffer(16)
      buf.writeBoolean(true).writeBoolean(false).rewind()
      assert.equal(buf.readBoolean(), true)
      assert.equal(buf.readBoolean(), false)
    })
  })

  describe('varint', () => {
    /** @type {Array<[number, number[]]>} */
    const VARINT_VECTORS = [
      [1, [0x01]],
      [127, [0x7f]],
      [128, [0x80, 0x01]],
      [255, [0xff, 0x01]],
      [300, [0xac, 0x02]],
      [16384, [0x80, 0x80, 0x01]],
    ]

    for (const [value, bytes] of VARINT_VECTORS) {
      it(`writeVarint(${value}) produces correct bytes`, () => {
        const buf = new ISOBuffer(16)
        buf.writeVarint(value)
        assert.deepEqual(buf.toArray(), new Uint8Array(bytes))
      })

      it(`readVarint decodes ${value}`, () => {
        const buf = new ISOBuffer(new Uint8Array(bytes))
        assert.equal(buf.readVarint(), value)
      })
    }

    it('varint round-trip for large numbers', () => {
      const buf = new ISOBuffer(16)
      const value = 2645675237
      buf.writeVarint(value).rewind()
      assert.equal(buf.readVarint(), value)
    })
  })

  describe('leb128', () => {
    it('leb128 round-trip', () => {
      const buf = new ISOBuffer(32)
      const value = 624485n
      buf.writeLeb128(value).rewind()
      assert.equal(buf.readLeb128(), value)
    })

    it('leb128 works with large bigints', () => {
      const buf = new ISOBuffer(32)
      const value = 123456789012345678901234567890n
      buf.writeLeb128(value).rewind()
      assert.equal(buf.readLeb128(), value)
    })
  })

  describe('export and utility', () => {
    it('toArray() returns written portion', () => {
      const buf = new ISOBuffer(100)
      buf.writeUint8(1).writeUint8(2).writeUint8(3)
      const arr = buf.toArray()
      assert.equal(arr.length, 3)
      assert.deepEqual(arr, new Uint8Array([1, 2, 3]))
    })

    it('subarray() returns zero-copy view', () => {
      const buf = new ISOBuffer(new Uint8Array([1, 2, 3, 4, 5]))
      const sub = buf.subarray(1, 4)
      assert.deepEqual(sub, new Uint8Array([2, 3, 4]))

      // Verify it's a view (modifying affects original)
      sub[0] = 99
      assert.equal(buf.bytes[1], 99)
    })

    it('getWrittenLength() returns bytes written', () => {
      const buf = new ISOBuffer(100)
      assert.equal(buf.getWrittenLength(), 0)
      buf.writeUint32(0)
      assert.equal(buf.getWrittenLength(), 4)
      buf.writeUint16(0)
      assert.equal(buf.getWrittenLength(), 6)
    })

    it('remaining() returns bytes left', () => {
      const buf = new ISOBuffer(10)
      assert.equal(buf.remaining(), 10)
      buf.skip(3)
      assert.equal(buf.remaining(), 7)
    })

    it('clone() creates shallow copy', () => {
      const buf = new ISOBuffer(16)
      buf.writeUint32(0xdeadbeef)
      buf.mark()

      const cloned = buf.clone()
      assert.equal(cloned.offset, buf.offset)

      // Verify mark is preserved by testing reset behavior
      cloned.seek(10).reset()
      buf.seek(10).reset()
      assert.equal(cloned.offset, buf.offset)

      // Same underlying buffer
      buf.rewind()
      buf.writeUint32(0xcafebabe)
      cloned.rewind()
      assert.equal(cloned.readUint32(), 0xcafebabe)
    })

    it('deepClone() creates independent copy', () => {
      const buf = new ISOBuffer(16)
      buf.writeUint32(0xdeadbeef)

      const cloned = buf.deepClone()

      // Different underlying buffer
      buf.rewind()
      buf.writeUint32(0xcafebabe)
      cloned.rewind()
      assert.equal(cloned.readUint32(), 0xdeadbeef)
    })
  })

  describe('chaining', () => {
    it('write methods are chainable', () => {
      const buf = new ISOBuffer(32)
      buf.writeUint8(1).writeUint16(2).writeUint32(3).writeFloat64(4.0).rewind()

      assert.equal(buf.readUint8(), 1)
      assert.equal(buf.readUint16(), 2)
      assert.equal(buf.readUint32(), 3)
      assert.equal(buf.readFloat64(), 4.0)
    })

    it('navigation methods are chainable', () => {
      const buf = new ISOBuffer(16)
      buf.skip(4).mark().skip(4).reset().back(2)
      assert.equal(buf.offset, 2)
    })
  })

  describe('auto-growth', () => {
    it('grows buffer automatically on write', () => {
      const buf = new ISOBuffer(4)
      buf.writeUint32(1)
      buf.writeUint32(2) // Should trigger growth
      buf.writeUint32(3)

      buf.rewind()
      assert.equal(buf.readUint32(), 1)
      assert.equal(buf.readUint32(), 2)
      assert.equal(buf.readUint32(), 3)
    })

    it('preserves data after growth', () => {
      const buf = new ISOBuffer(2)
      buf.writeUint8(0xaa)
      buf.writeUint8(0xbb)
      buf.writeUint8(0xcc) // Triggers growth

      buf.rewind()
      assert.equal(buf.readUint8(), 0xaa)
      assert.equal(buf.readUint8(), 0xbb)
      assert.equal(buf.readUint8(), 0xcc)
    })
  })

  describe('edge cases', () => {
    it('handles empty buffer from size 0', () => {
      const buf = new ISOBuffer(0)
      assert.equal(buf.length, 0)
      assert.equal(buf.available(1), false)
    })

    it('handles Uint8Array with byteOffset', () => {
      const ab = new ArrayBuffer(10)
      const view = new Uint8Array(ab, 2, 5) // offset 2, length 5
      view[0] = 42

      const buf = new ISOBuffer(view)
      assert.equal(buf.readUint8(), 42)
    })
  })
})
