import assert from 'assert'
import * as Wallet from '../src/wallet.js'

const mnemonic =
  'raw include ecology social turtle still perfect trip dance food welcome aunt patient very toss very program estate diet portion city camera loop guess'

describe('wallet', function () {
  it('should generate 24 word mnemonic', function () {
    assert.strictEqual(Wallet.generateMnemonic().split(' ').length, 24)
  })

  it('should generate seed from mnemonic', function () {
    const seed = Wallet.mnemonicToSeed(Wallet.generateMnemonic())
    assert.strictEqual(toString.call(seed).slice(8, -1), 'Uint8Array')
  })

  it('should generate create account from seed', function () {
    const seed = Wallet.mnemonicToSeed(mnemonic)
    const account = Wallet.accountFromSeed(
      seed,
      Wallet.SIGNATURES.SECP256K1,
      "m/44'/461'/0'/0/0"
    )

    assert.strictEqual(
      account.address.toString(),
      'f17levgrkmq7jeloew44ixqokvl4qdozvmacidp7i'
    )
  })
})
