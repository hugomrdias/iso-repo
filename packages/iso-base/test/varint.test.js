import assert from 'assert'
import { decode, encode, encodingLength } from '../src/varint.js'

/**
 * @param {number} range
 */
function randint(range) {
  return Math.floor(Math.random() * range)
}

describe('varint', () => {
  it('fuzz test', () => {
    for (let i = 0, len = 100; i < len; ++i) {
      const expect = randint(0x7f_ff_ff_ff)
      const [encoded, size] = encode(expect)
      const [code] = decode(encoded)
      assert.equal(expect, code, `fuzz test: ${expect.toString()}`)
      assert.equal(size, encoded.length)
    }
  })

  it('test single byte works as expected', () => {
    const buf = new Uint8Array(2)
    buf[0] = 172
    buf[1] = 2
    const [data, size] = decode(buf)
    assert.equal(data, 300, 'should equal 300')
    assert.equal(size, 2)
  })

  it('test encode works as expected', () => {
    assert.deepEqual(encode(300)[0], new Uint8Array([0xac, 0x02]))
  })

  it('test decode single bytes', () => {
    const expected = randint(0b1111111)
    const buf = new Uint8Array(1)
    buf[0] = expected
    const [data, size] = decode(buf)
    assert.equal(data, expected)
    assert.equal(size, 1)
  })

  it('test decode multiple bytes with zero', () => {
    const expected = randint(0b1111111)
    const buf = new Uint8Array(2)
    buf[0] = 128
    buf[1] = expected
    const [data, size] = decode(buf)
    assert.equal(data, expected << 7)
    assert.equal(size, 2)
  })

  it('encode single byte', () => {
    const expected = randint(0b1111111)
    const [encoded, size] = encode(expected)
    assert.deepEqual(encoded, new Uint8Array([expected]))
    assert.equal(size, 1)
  })

  it('encode multiple byte with zero first byte', () => {
    const expected = 0x0f_00
    const [encoded, size] = encode(expected)
    assert.deepEqual(encoded, new Uint8Array([0x80, 0x1e]))
    assert.equal(size, 2)
  })

  it('big integers', () => {
    const bigs = []
    for (let i = 32; i <= 53; i++)
      ((i) => {
        bigs.push(2 ** i - 1)
      })(i)

    for (const n of bigs) {
      const [data] = encode(n)
      // console.error(n, '->', data)
      assert.equal(decode(data)[0], n)
      assert.notEqual(decode(data)[0], n - 1)
    }
  })

  it('fuzz test - big', () => {
    const MAX_INTD = Number.MAX_SAFE_INTEGER
    const MAX_INT = 2 ** 31

    for (let i = 0, len = 100; i < len; ++i) {
      const expect = randint(MAX_INTD - MAX_INT) + MAX_INT
      const [encoded] = encode(expect)
      const [data, size] = decode(encoded)
      assert.equal(expect, data, `fuzz test: ${expect.toString()}`)
      assert.equal(size, encoded.length)
    }
  })

  it('encodingLength', () => {
    for (let i = 0; i <= 53; i++) {
      const n = 2 ** i - 1
      assert.equal(encode(n)[1], encodingLength(n))
    }
  })

  it('buffer too short', () => {
    const [buffer] = encode(9_812_938_912_312)

    let l = buffer.length
    while (l-- > 0) {
      const index = l
      assert.throws(
        () => {
          decode(buffer.slice(0, index))
        },
        {
          name: 'RangeError',
          message: 'Could not decode varint',
        }
      )
    }
  })

  it('buffer too long', () => {
    const buffer = Uint8Array.from([
      ...Array.from({ length: 150 }, () => 0xff),
      ...Array.from({ length: 1 }, () => 0x1),
    ])

    assert.throws(
      () => {
        const [val] = decode(buffer)
        encode(val)
      },
      {
        name: 'RangeError',
        message: 'Could not decode varint',
      }
    )
  })
})
