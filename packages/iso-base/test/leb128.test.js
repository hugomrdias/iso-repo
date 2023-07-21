import assert from 'assert'
import * as leb128 from '../src/leb128.js'
import { base16 } from '../src/rfc4648.js'

/** @type {Array<[Uint8Array, number | string | bigint, number]>} */
const VECTORS = [
  [base16.decode('d901'.toUpperCase()), 217, 2],
  [base16.decode('e29a01'.toUpperCase()), 19_810, 3],
  [base16.decode('e086bd2b'.toUpperCase()), 91_177_824, 4],
  [base16.decode('e599c7ed09'.toUpperCase()), 2_645_675_237, 5],
  [
    base16.decode('d8c4ecdcd886dff9e401'.toUpperCase()),
    16_497_666_429_405_569_624n,
    10,
  ],
  [
    base16.decode('d8c4ecdcd886dff9e401'.toUpperCase()),
    '16497666429405569624',
    10,
  ],
  [
    base16.decode('c2ced1e6ecc2ebfaad01'.toUpperCase()),
    '12535116550804629314',
    10,
  ],
]

describe('lib128', function () {
  for (const [bytes, num, size] of VECTORS) {
    it(`${bytes} bytes`, function () {
      assert.deepStrictEqual(leb128.unsigned.decode(bytes)[0], BigInt(num))
    })

    it(`${bytes} size `, function () {
      assert.deepStrictEqual(leb128.unsigned.encodingLength(bytes), size)
    })

    it(`${bytes} num `, function () {
      assert.deepStrictEqual(leb128.unsigned.encode(num), bytes)
    })
  }

  it('offset 1', function () {
    const bytes = Uint8Array.from([4, 226, 154, 1])

    assert.deepStrictEqual(leb128.unsigned.decode(bytes, 1)[0], 19_810n)
    assert.deepStrictEqual(leb128.unsigned.encodingLength(bytes, 1), 3)
  })

  it('offset 0', function () {
    const bytes = Uint8Array.from([226, 154, 1])

    assert.deepStrictEqual(leb128.unsigned.decode(bytes, 0)[0], 19_810n)
    assert.deepStrictEqual(leb128.unsigned.encodingLength(bytes, 0), 3)
  })

  it('offset 2', function () {
    const bytes = Uint8Array.from([10, 4, 226, 154, 1])

    assert.deepStrictEqual(leb128.unsigned.decode(bytes, 2)[0], 19_810n)
    assert.deepStrictEqual(leb128.unsigned.encodingLength(bytes, 2), 3)

    assert.deepStrictEqual(
      leb128.unsigned.encode(19_810),
      Uint8Array.from([226, 154, 1])
    )
  })
})
