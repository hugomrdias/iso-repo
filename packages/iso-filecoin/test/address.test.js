import assert from 'assert'
import { fromBytes, fromString, fromPublicKey } from '../src/address.js'
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

describe('address', function () {
  for (const [address, expected] of secp) {
    it(`sepc256k1 vectors ${address}`, function () {
      const a = fromString(address)

      assert.strictEqual(base16.encode(a.toBytes()).toLowerCase(), expected)
    })

    it(`sepc256k1 vectors ${address} fromBytes`, function () {
      const a = fromBytes(base16.decode(expected.toUpperCase()), 'mainnet')

      assert.strictEqual(a.toString(), address)
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
})
