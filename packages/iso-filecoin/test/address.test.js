import assert from 'assert'
import {
  fromBytes,
  fromString,
  fromPublicKey,
  isEthAddress,
  fromEthAddress,
  toEthAddress,
  isAddress,
  from,
} from '../src/address.js'
import { base16, base64pad } from 'iso-base/rfc4648'

const secp = [
  [
    'f17uoq6tp427uzv7fztkbsnn64iwotfrristwpryy',
    '01fd1d0f4dfcd7e99afcb99a8326b7dc459d32c628',
  ],
  [
    'f1xcbgdhkgkwht3hrrnui3jdopeejsoatkzmoltqy',
    '01b882619d46558f3d9e316d11b48dcf211327026a',
  ],
  [
    'f1xtwapqc6nh4si2hcwpr3656iotzmlwumogqbuaa',
    '01bcec07c05e69f92468e2b3e3bf77c874f2c5da8c',
  ],
  [
    'f1wbxhu3ypkuo6eyp6hjx6davuelxaxrvwb2kuwva',
    '01b06e7a6f0f551de261fe3a6fe182b422ee0bc6b6',
  ],
  [
    'f12fiakbhe2gwd5cnmrenekasyn6v5tnaxaqizq6a',
    '01d1500504e4d1ac3e89ac891a4502586fabd9b417',
  ],
]

const delegated = [
  [
    'f410feot7hrogmplrcupubsdbbqarkdewmb4vkwc5qqq',
    '040a23a7f3c5c663d71151f40c8610c01150c9660795',
  ],
  [
    'f410fek3n2tlnqghc5phd2lqatisj7d57j2lf5hgcs2q',
    '040a22b6dd4d6d818e2ebce3d2e009a249f8fbf4e965',
  ],
  [
    'f410firjm446mw5tqabmlxjp4sxwshdhrff7adk4srea',
    '040a4452ce73ccb76700058bba5fc95ed238cf1297e0',
  ],
]

describe('address', function () {
  for (const [address, expected] of secp) {
    it(`sepc256k1 vectors ${address} fromString`, function () {
      const a = fromString(address)
      assert.ok(isAddress(a))
      assert.equal(a.protocol, 1)
      assert.strictEqual(base16.encode(a.toBytes()).toLowerCase(), expected)
    })

    it(`sepc256k1 vectors ${address} fromBytes`, function () {
      const a = fromBytes(base16.decode(expected.toUpperCase()), 'mainnet')

      assert.strictEqual(a.toString(), address)
    })

    it(`sepc256k1 vectors ${address} from`, function () {
      const a = from(base16.decode(expected.toUpperCase()), 'mainnet')
      assert.strictEqual(a.toString(), address)
      assert.ok(isAddress(a))

      const b = from(address)
      assert.equal(a.protocol, 1)
      assert.strictEqual(base16.encode(b.toBytes()).toLowerCase(), expected)
    })
  }

  it('from public key', function () {
    const a = fromPublicKey(
      base64pad.decode(
        'BIgvf8Me7SAb7jpWOH2B5PwmhiaCz1R5BZKraZ2heQuFPk3DACNkUwP3ffqTYcE7Y1SjZeqrF8J0uraaYQjBtSs='
      ),
      'mainnet',
      'SECP256K1'
    )

    assert.strictEqual(
      a.toString(),
      'f1eyo4qsoe7kjpehccfhhxlvd6wfo6mbi3ikfiheq'
    )
  })

  for (const [address, expected] of delegated) {
    it(`delegated vectors ${address}`, function () {
      const a = fromString(address)

      assert.ok(isAddress(a))
      assert.equal(a.protocol, 4)
      assert.strictEqual(base16.encode(a.toBytes()).toLowerCase(), expected)
    })

    it(`delegated vectors ${address} fromBytes`, function () {
      const a = fromBytes(base16.decode(expected.toUpperCase()), 'mainnet')

      assert.strictEqual(a.toString(), address)
    })
  }

  it('is eth address', function () {
    assert.ok(isEthAddress('0xd388ab098ed3e84c0d808776440b48f685198498'))
  })

  it('should convert from eth address', function () {
    const f4 = fromEthAddress(
      '0xd388ab098ed3e84c0d808776440b48f685198498',
      'testnet'
    )

    assert.strictEqual(
      f4.toString(),
      't410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy'
    )
  })

  it('should convert from eth address with "from" ', function () {
    const f4 = from('0xd388ab098ed3e84c0d808776440b48f685198498', 'testnet')

    assert.strictEqual(
      f4.toString(),
      't410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy'
    )
  })

  it('should convert from f4 to eth address', function () {
    const f4 = fromString('f410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy')

    assert.strictEqual(
      toEthAddress(f4),
      '0xd388ab098ed3e84c0d808776440b48f685198498'
    )
  })

  it('should fail convert from f1 to eth address', function () {
    const f1 = fromString('f1wbxhu3ypkuo6eyp6hjx6davuelxaxrvwb2kuwva')

    assert.throws(() => toEthAddress(f1))
  })
})
