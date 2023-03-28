import assert from 'assert'
import { Token } from '../src/token.js'

describe('should convert', function () {
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
})
