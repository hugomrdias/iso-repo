import assert from 'assert'
import { base16 } from 'iso-base/rfc4648'
import { Token } from '../src/token.js'

describe('token', function () {
  it('zero', function () {
    assert.strictEqual(new Token(0).toAttoFIL().toString(), '0')
    assert.strictEqual(new Token(0).toFemtoFIL().toString(), '0')
    assert.strictEqual(new Token(0).toPicoFIL().toString(), '0')
    assert.strictEqual(new Token(0).toNanoFIL().toString(), '0')
    assert.strictEqual(new Token(0).toMicroFIL().toString(), '0')
    assert.strictEqual(new Token(0).toMilliFIL().toString(), '0')
    assert.strictEqual(new Token(0).toFIL().toString(), '0')
  })

  it('positive', function () {
    assert.strictEqual(
      Token.fromFIL(1).toAttoFIL().toString(),
      '1000000000000000000'
    )
    assert.strictEqual(
      Token.fromFIL(1).toFemtoFIL().toString(),
      '1000000000000000'
    )
    assert.strictEqual(Token.fromFIL(1).toPicoFIL().toString(), '1000000000000')
    assert.strictEqual(Token.fromFIL(1).toNanoFIL().toString(), '1000000000')
    assert.strictEqual(Token.fromFIL(1).toMicroFIL().toString(), '1000000')
    assert.strictEqual(Token.fromFIL(1).toMilliFIL().toString(), '1000')
    assert.strictEqual(Token.fromFIL(1).toFIL().toString(), '1')
  })

  it('negative', function () {
    assert.strictEqual(
      Token.fromFIL(-1).toAttoFIL().toString(),
      '-1000000000000000000'
    )
    assert.strictEqual(
      Token.fromFIL(-1).toFemtoFIL().toString(),
      '-1000000000000000'
    )
    assert.strictEqual(
      Token.fromFIL(-1).toPicoFIL().toString(),
      '-1000000000000'
    )
    assert.strictEqual(Token.fromFIL(-1).toNanoFIL().toString(), '-1000000000')
    assert.strictEqual(Token.fromFIL(-1).toMicroFIL().toString(), '-1000000')
    assert.strictEqual(Token.fromFIL(-1).toMilliFIL().toString(), '-1000')
    assert.strictEqual(Token.fromFIL(-1).toFIL().toString(), '-1')
  })

  it('float', function () {
    assert.strictEqual(
      Token.fromFIL(0.001).toAttoFIL().toString(),
      '1000000000000000'
    )
    assert.strictEqual(
      Token.fromFIL(0.001).toFemtoFIL().toString(),
      '1000000000000'
    )
    assert.strictEqual(
      Token.fromFIL(0.001).toPicoFIL().toString(),
      '1000000000'
    )
    assert.strictEqual(Token.fromFIL(0.001).toNanoFIL().toString(), '1000000')
    assert.strictEqual(Token.fromFIL(0.001).toMicroFIL().toString(), '1000')
    assert.strictEqual(Token.fromFIL(0.001).toMilliFIL().toString(), '1')
    assert.strictEqual(Token.fromFIL(0.001).toFIL().toString(), '0.001')
  })

  it('precision bigint', function () {
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toAttoFIL().toString(),
      '11231000001100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n)
        .toFemtoFIL()
        .toString(),
      '11231000001100000000.011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toPicoFIL().toString(),
      '11231000001100000.000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toNanoFIL().toString(),
      '11231000001100.000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n)
        .toMicroFIL()
        .toString(),
      '11231000001.100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n)
        .toMilliFIL()
        .toString(),
      '11231000.001100000000011'
    )
    assert.strictEqual(
      Token.fromAttoFIL(11_231_000_001_100_000_000_011n).toFIL().toString(),
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

  it('should format', function () {
    assert.strictEqual(
      Token.fromAttoFIL(1).toFIL().toString(),
      '0.000000000000000001'
    )

    assert.strictEqual(
      Token.fromFIL(100).toFormat({
        decimalPlaces: 0,
        groupSize: 0,
      }),
      Token.fromFIL(100).toString()
    )

    assert.strictEqual(
      Token.fromAttoFIL(1).toFIL().toFormat({
        suffix: ' FIL',
      }),
      '0.000000000000000001 FIL'
    )
  })
})
