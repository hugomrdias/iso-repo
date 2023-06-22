import assert from 'assert'
import { Token } from '../src/token.js'
import { base16 } from 'iso-base/rfc4648'

describe('token', function () {
  it('zero', function () {
    assert.strictEqual(new Token(0).toAttoFIL(), '0')
    assert.strictEqual(new Token(0).toFemtoFIL(), '0')
    assert.strictEqual(new Token(0).toPicoFIL(), '0')
    assert.strictEqual(new Token(0).toNanoFIL(), '0')
    assert.strictEqual(new Token(0).toMicroFIL(), '0')
    assert.strictEqual(new Token(0).toMilliFIL(), '0')
    assert.strictEqual(new Token(0).toFIL(), '0')
  })

  it('positive', function () {
    assert.strictEqual(Token.fromFIL(1).toAttoFIL(), '1000000000000000000')
    assert.strictEqual(Token.fromFIL(1).toFemtoFIL(), '1000000000000000')
    assert.strictEqual(Token.fromFIL(1).toPicoFIL(), '1000000000000')
    assert.strictEqual(Token.fromFIL(1).toNanoFIL(), '1000000000')
    assert.strictEqual(Token.fromFIL(1).toMicroFIL(), '1000000')
    assert.strictEqual(Token.fromFIL(1).toMilliFIL(), '1000')
    assert.strictEqual(Token.fromFIL(1).toFIL(), '1')
  })

  it('negative', function () {
    assert.strictEqual(Token.fromFIL(-1).toAttoFIL(), '-1000000000000000000')
    assert.strictEqual(Token.fromFIL(-1).toFemtoFIL(), '-1000000000000000')
    assert.strictEqual(Token.fromFIL(-1).toPicoFIL(), '-1000000000000')
    assert.strictEqual(Token.fromFIL(-1).toNanoFIL(), '-1000000000')
    assert.strictEqual(Token.fromFIL(-1).toMicroFIL(), '-1000000')
    assert.strictEqual(Token.fromFIL(-1).toMilliFIL(), '-1000')
    assert.strictEqual(Token.fromFIL(-1).toFIL(), '-1')
  })

  it('float', function () {
    assert.strictEqual(Token.fromFIL(0.001).toAttoFIL(), '1000000000000000')
    assert.strictEqual(Token.fromFIL(0.001).toFemtoFIL(), '1000000000000')
    assert.strictEqual(Token.fromFIL(0.001).toPicoFIL(), '1000000000')
    assert.strictEqual(Token.fromFIL(0.001).toNanoFIL(), '1000000')
    assert.strictEqual(Token.fromFIL(0.001).toMicroFIL(), '1000')
    assert.strictEqual(Token.fromFIL(0.001).toMilliFIL(), '1')
    assert.strictEqual(Token.fromFIL(0.001).toFIL(), '0.001')
  })

  it('precision bigint', function () {
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toAttoFIL(),
      '11231000001100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toFemtoFIL(),
      '11231000001100000000.011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toPicoFIL(),
      '11231000001100000.000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toNanoFIL(),
      '11231000001100.000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toMicroFIL(),
      '11231000001.100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toMilliFIL(),
      '11231000.001100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toFIL(),
      '11231.000001100000000011'
    )
  })

  const vectors = [
    ['0', ''],
    ['9', '0009'],
    ['22', '0016'],
    ['-18', '0112'],
    ['-26118', '016606'],
    ['-20368000000000000', '01485c968cc90000'],
    ['23752000000000000', '0054625172b48000'],
    ['4171000000000000', '000ed1809d5bb000'],
    ['6098800000000000000000000', '00050b789c4844bc17c00000'],
    ['-6180700000000000000000000', '01051cd06b1a8ff003f00000'],
  ]

  for (const [atto, serialized] of vectors) {
    it(`serialize ${atto}`, function () {
      const s = base16.encode(Token.fromAttoFIL(atto).toBytes()).toLowerCase()

      assert.strictEqual(s, serialized)
    })
  }
})
