import assert from 'assert'
import { base64url } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'
import * as ECDSA from '../src/verifiers/ecdsa.js'
import { ECDSASigner } from '../src/signers/ecdsa.js'

const fixtures = {
  // https://github.com/w3c-ccg/did-method-key/blob/main/test-vectors/nist-curves.json
  p256: [
    {
      did: 'did:key:zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv',
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns',
        y: 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM',
        d: 'gPh-VvVS8MbvKQ9LSVVmfnxnKjHn4Tqj0bmbpehRlpc',
      },
    },
    {
      did: 'did:key:zDnaerDaTF5BXEavCrfRZEk316dpbLsfPDZ3WJ5hRTPFU2169',
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'fyNYMN0976ci7xqiSdag3buk-ZCwgXU4kz9XNkBlNUI',
        y: 'hW2ojTNfH7Jbi8--CJUo3OCbH3y5n91g-IMA9MLMbTU',
        d: 'YjRs6vNvw4sYrzVVY8ipkEpDAD9PFqw1sUnvPRMA-WI',
      },
    },
  ],
  p384: [
    {
      did: 'did:key:z82Lm1MpAkeJcix9K8TMiLd5NMAhnwkjjCBeWHXyu3U4oT2MVJJKXkcVBgjGhnLBn2Kaau9',
      jwk: {
        kty: 'EC',
        crv: 'P-384',
        x: 'lInTxl8fjLKp_UCrxI0WDklahi-7-_6JbtiHjiRvMvhedhKVdHBfi2HCY8t_QJyc',
        y: 'y6N1IC-2mXxHreETBW7K3mBcw0qGr3CWHCs-yl09yCQRLcyfGv7XhqAngHOu51Zv',
        d: 'hAyGZNj9031guBCdpAOaZkO-E5m-LKLYnMIq0-msrp8JLctseaOeNTHmP3uKVWwX',
      },
    },
    {
      did: 'did:key:z82LkvCwHNreneWpsgPEbV3gu1C6NFJEBg4srfJ5gdxEsMGRJUz2sG9FE42shbn2xkZJh54',
      jwk: {
        kty: 'EC',
        crv: 'P-384',
        x: 'CA-iNoHDg1lL8pvX3d1uvExzVfCz7Rn6tW781Ub8K5MrDf2IMPyL0RTDiaLHC1JT',
        y: 'Kpnrn8DkXUD3ge4mFxi-DKr0DYO2KuJdwNBrhzLRtfMa3WFMZBiPKUPfJj8dYNl_',
        d: 'Xe1HHeh-UsrJPRNLR_Y06VTrWpZYBXi7a7kiRqCgwnAOlJZPwE-xzL3DIIVMavAL',
      },
    },
  ],
  p521: [
    {
      did: 'did:key:z2J9gaYxrKVpdoG9A4gRnmpnRCcxU6agDtFVVBVdn1JedouoZN7SzcyREXXzWgt3gGiwpoHq7K68X4m32D8HgzG8wv3sY5j7',
      jwk: {
        kty: 'EC',
        crv: 'P-521',
        x: 'ASUHPMyichQ0QbHZ9ofNx_l4y7luncn5feKLo3OpJ2nSbZoC7mffolj5uy7s6KSKXFmnNWxGJ42IOrjZ47qqwqyS',
        y: 'AW9ziIC4ZQQVSNmLlp59yYKrjRY0_VqO-GOIYQ9tYpPraBKUloEId6cI_vynCzlZWZtWpgOM3HPhYEgawQ703RjC',
        d: 'AHwRaNaGs0jkj_pT6PK2aHep7dJK-yxyoL2bIfVRAceq1baxoiFDo3W14c8E2YZn1k5S53r4a11flhQdaB5guJ_X',
      },
    },
    {
      did: 'did:key:z2J9gcGdb2nEyMDmzQYv2QZQcM1vXktvy1Pw4MduSWxGabLZ9XESSWLQgbuPhwnXN7zP7HpTzWqrMTzaY5zWe6hpzJ2jnw4f',
      jwk: {
        kty: 'EC',
        crv: 'P-521',
        x: 'AQgyFy6EwH3_u_KXPw8aTXTY7WSVytmbuJeFpq4U6LipxtSmBJe_jjRzms9qubnwm_fGoHMQlvQ1vzS2YLusR2V0',
        y: 'Ab06MCcgoG7dM2I-VppdLV1k3lDoeHMvyYqHVfP05Ep2O7Zu0Qwd6IVzfZi9K0KMDud22wdnGUpUtFukZo0EeO15',
        d: 'AbheZ-AA58LP4BpopCGCLH8ZoMdkdJaVOS6KK2NNmDCisr5_Ifxl-qcunrkOJ0CSauA4LJyNbCWcy28Bo6zgHTXQ',
      },
    },
  ],
}

describe('Verifier ES256', function () {
  for (const { did, jwk } of fixtures.p256) {
    it(`should verify ${jwk.d}`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const pub = concat([
        [4],
        base64url.decode(jwk.x),
        base64url.decode(jwk.y),
      ])

      assert.deepStrictEqual(signer.publicKey, pub)

      assert.strictEqual(signer.did.toString(), did)

      const verified = await ECDSA.verify('ES256', {
        signature,
        message,
        publicKey: pub,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from did compressed EC`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)

      const verified = await ECDSA.verify('ES256', {
        signature,
        message,
        ...signer.did,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from signer directly`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const verified = await ECDSA.verify('ES256', {
        signature,
        message,
        ...signer,
      })
      assert.ok(verified)
    })
  }
})

describe('Verifier ES384', function () {
  for (const { did, jwk } of fixtures.p384) {
    it(`should verify ${jwk.d}`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const pub = concat([
        [4],
        base64url.decode(jwk.x),
        base64url.decode(jwk.y),
      ])

      assert.deepStrictEqual(signer.publicKey, pub)

      assert.strictEqual(signer.did.toString(), did)

      const verified = await ECDSA.verify('ES384', {
        signature,
        message,
        publicKey: pub,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from did compressed EC`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)

      const verified = await ECDSA.verify('ES384', {
        signature,
        message,
        ...signer.did,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from signer directly`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const verified = await ECDSA.verify('ES384', {
        signature,
        message,
        ...signer,
      })
      assert.ok(verified)
    })
  }
})

describe('Verifier ES521', function () {
  for (const { did, jwk } of fixtures.p521) {
    it(`should verify ${jwk.d}`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const pub = concat([
        [4],
        base64url.decode(jwk.x),
        base64url.decode(jwk.y),
      ])

      assert.deepStrictEqual(signer.publicKey, pub)

      assert.strictEqual(signer.did.toString(), did)

      const verified = await ECDSA.verify('ES512', {
        signature,
        message,
        publicKey: pub,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from did compressed EC`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)

      const verified = await ECDSA.verify('ES512', {
        signature,
        message,
        ...signer.did,
      })
      assert.ok(verified)
    })

    it(`should verify ${jwk.d} from signer directly`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await ECDSASigner.importJwk(jwk)
      const signature = await signer.sign(message)
      const verified = await ECDSA.verify('ES512', {
        signature,
        message,
        ...signer,
      })
      assert.ok(verified)
    })
  }
})
