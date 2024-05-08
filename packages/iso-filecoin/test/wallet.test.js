import assert from 'assert'
import { base16, base64pad } from 'iso-base/rfc4648'
import { Message } from '../src/message.js'
import * as Wallet from '../src/wallet.js'

const mnemonic =
  'raw include ecology social turtle still perfect trip dance food welcome aunt patient very toss very program estate diet portion city camera loop guess'

describe('wallet', () => {
  it('should generate 24 word mnemonic', () => {
    assert.strictEqual(Wallet.generateMnemonic().split(' ').length, 24)
  })

  it('should generate seed from mnemonic', () => {
    const seed = Wallet.mnemonicToSeed(Wallet.generateMnemonic())
    assert.strictEqual(toString.call(seed).slice(8, -1), 'Uint8Array')
  })

  it('should generate create account from mnemonic', () => {
    const account = Wallet.accountFromMnemonic(
      mnemonic,
      'SECP256K1',
      "m/44'/461'/0'/0/0"
    )

    assert.strictEqual(
      account.address.toString(),
      'f17levgrkmq7jeloew44ixqokvl4qdozvmacidp7i'
    )
  })

  it('should generate create account from seed', () => {
    const seed = Wallet.mnemonicToSeed(mnemonic)
    const account = Wallet.accountFromSeed(
      seed,
      'SECP256K1',
      "m/44'/461'/0'/0/0"
    )

    assert.strictEqual(
      account.address.toString(),
      'f17levgrkmq7jeloew44ixqokvl4qdozvmacidp7i'
    )
  })

  it('should generate create account from mnemonic metamask', () => {
    const seed = Wallet.mnemonicToSeed(
      'already turtle birth enroll since owner keep patch skirt drift any dinner'
    )
    const account = Wallet.accountFromSeed(
      seed,
      'SECP256K1',
      "m/44'/461'/0'/0/0"
    )

    assert.strictEqual(
      account.address.toString(),
      'f1jbnosztqwadgh4smvsnojdvwjgqxsmtzy5n5imi'
    )
  })

  it('should sign', () => {
    const account = Wallet.accountFromPrivateKey(
      base64pad.decode('tI1wF8uJseC1QdNj3CbpBAVC8G9/pfgtSYt4yXlJ+UY='),
      'SECP256K1',
      'mainnet'
    )

    assert.deepEqual(
      base64pad.encode(account.pubKey),
      'BLW+ZCazhsVWEuuwxt5DEcSyXnmpJGxFBizYf/pSiBKlXz9qgW9d4yN0Vm6WJ+D5G9c7WxWAO+mBL3RpjVEYR6E='
    )
    assert.deepEqual(
      account.address.toString(),
      'f17dyptywvmnldq2fsm6j226txnltf4aiwsi3vlka'
    )

    const message = Message.fromLotus({
      Version: 0,
      To: 'f1ypi542zmmgaltijzw4byonei5c267ev5iif2liy',
      From: 'f17dyptywvmnldq2fsm6j226txnltf4aiwsi3vlka',
      Value: '87316',
      Params: '',
      GasFeeCap: '42908',
      GasPremium: '28871',
      GasLimit: 20_982,
      Nonce: 20_101,
      Method: 65_360,
    })

    assert.deepEqual(
      base16.encode(message.serialize()).toLowerCase(),
      '8a005501c3d1de6b2c6180b9a139b703873488e8b5ef92bd5501f8f0f9e2d563563868b26793ad7a776ae65e0116194e8544000155141951f64300a79c430070c719ff5040'
    )

    const sig = Wallet.signMessage(account.privateKey, 'SECP256K1', message)

    assert.deepEqual(
      base64pad.encode(sig),
      'jzg+/H2mHXezbUBAtQAYbj3MrwVn92mXFRw6FX2NRK1+Zfha2vSP23GVEkJHHXxyAd+IggjzG2L440fIJbdfSgA='
    )
  })
})
