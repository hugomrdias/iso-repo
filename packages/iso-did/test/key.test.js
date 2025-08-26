import assert from 'assert'
import { base64pad } from 'iso-base/rfc4648'
import { DIDKey } from '../src/key.js'

/**
 * @typedef {import('../src/types').KeyType} PublicKeyType
 */

/** @type {Record<PublicKeyType, {did: string, pub: Uint8Array<ArrayBuffer>}[]>} */
const VECTORS = {
  Ed25519: [
    {
      did: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      pub: base64pad.decode('O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik='),
    },
    {
      did: 'did:key:z6MkjchhfUsD6mmvni8mCdXHw216Xrm9bQe2mBH1P5RDjVJG',
      pub: base64pad.decode('TLWr9q15+/WrvMr8wmnYXNJlHtS4hbWGnyQa7fCluik='),
    },
    {
      did: 'did:key:z6MknGc3ocHs3zdPiJbnaaqDi58NGb4pk1Sp9WxWufuXSdxf',
      pub: base64pad.decode('dCK5iHWYBo4yxESKlJrbKQ0PTjW54BsO5fGh5gD+JnQ='),
    },
    // extra
    {
      did: 'did:key:z6MkgYGF3thn8k1Fv4p4dWXKtsXCnLH7q9yw4QgNPULDmDKB',
      pub: base64pad.decode('Hv+AVRD2WUjUFOsSNbsmrp9fokuwrUnjBcr92f0kxw4='),
    },
  ],
  RSA: [
    {
      did: 'did:key:zgghBUVkqmWS8e1ioRVp2WN9Vw6x4NvnE9PGAyQsPqM3fnfPf8EdauiRVfBTcVDyzhqM5FFC7ekAvuV1cJHawtfgB9wDcru1hPDobk3hqyedijhgWmsYfJCmodkiiFnjNWATE7PvqTyoCjcmrc8yMRXmFPnoASyT5beUd4YZxTE9VfgmavcPy3BSouNmASMQ8xUXeiRwjb7xBaVTiDRjkmyPD7NYZdXuS93gFhyDFr5b3XLg7Rfj9nHEqtHDa7NmAX7iwDAbMUFEfiDEf9hrqZmpAYJracAjTTR8Cvn6mnDXMLwayNG8dcsXFodxok2qksYF4D8ffUxMRmyyQVQhhhmdSi4YaMPqTnC1J6HTG9Yfb98yGSVaWi4TApUhLXFow2ZvB6vqckCNhjCRL2R4MDUSk71qzxWHgezKyDeyThJgdxydrn1osqH94oSeA346eipkJvKqYREXBKwgB5VL6WF4qAK6sVZxJp2dQBfCPVZ4EbsBQaJXaVK7cNcWG8tZBFWZ79gG9Cu6C4u8yjBS8Ux6dCcJPUTLtixQu4z2n5dCsVSNdnP1EEs8ZerZo5pBgc68w4Yuf9KL3xVxPnAB1nRCBfs9cMU6oL1EdyHbqrTfnjE8HpY164akBqe92LFVsk8RusaGsVPrMekT8emTq5y8v8CabuZg5rDs3f9NPEtogjyx49wiub1FecM5B7QqEcZSYiKHgF4mfkteT2',
      pub: base64pad.decode(
        'MIICCgKCAgEAqMCkFFRFWtzUyZeK8mgJdyM6SEQcXC5E6JwCRVDld+jlJs8sXNOE/vliexq34wZRQ4hk53+JPFlvZ/QjRgIxdUxSMiZ3S5hlNVvvRaue6SMakA9ugQhnfXaWORro0UbPuHLms+bg5StDP8+8tIezu9c1H1FjwPcdbV6rAvKhyhnsM10qP3v2CPbdE0q3FOsihoKuTelImtO110E7N6fLn4U3EYbC4OyViqlrP1o/1M+R+tiM1cb4pD7XKJnIs6ryZdfOQSPBJwjNqSdN6Py/tdrFgPDTyacSSdpTVADOM2IMAoYbhV1N5APhnjOHBRFyKkF1HffQKpmXQLBqvUNNjuhmpVKWBtrTdcCKrglFXiw0cKGHKxIirjmiOlB/HYHg5UdosyE3/1Txct2U7+WBB6QXak1UgxCzgKYBDI8UPA0RlkUuHHP/Zg0fVXrXIInHO04MYxUeSps5qqyP6dJBu/v/BDn3zUq6LYFwJ/+xsU7zbrKYB4jaRlHPoCj/eDC+rSA2uQ4KXHBB8/aAqNFC9ukWxc26Ifz9dF968DLuL30bi+ZAa2oUh492Pw1bg89J7i4qTsOOfpQvGyDV7TGhKuUG3Hbumfr2w16S+/3EI2RIyd1nYsflE6ZmCkZQMG/lwDAFXaqfyGKEDouJuja4XH8r4fGWeGTrozIoniXT1HUCAwEAAQ=='
      ),
    },
  ],
  'P-256': [
    {
      did: 'did:key:zDnaerDaTF5BXEavCrfRZEk316dpbLsfPDZ3WJ5hRTPFU2169',
      pub: base64pad.decode('A38jWDDdPe+nIu8aoknWoN27pPmQsIF1OJM/VzZAZTVC'),
    },
  ],
  'P-384': [
    {
      did: 'did:key:z82Lm1MpAkeJcix9K8TMiLd5NMAhnwkjjCBeWHXyu3U4oT2MVJJKXkcVBgjGhnLBn2Kaau9',
      pub: base64pad.decode(
        'A5SJ08ZfH4yyqf1Aq8SNFg5JWoYvu/v+iW7Yh44kbzL4XnYSlXRwX4thwmPLf0CcnA=='
      ),
    },
  ],
  'P-521': [
    {
      did: 'did:key:z2J9gaYxrKVpdoG9A4gRnmpnRCcxU6agDtFVVBVdn1JedouoZN7SzcyREXXzWgt3gGiwpoHq7K68X4m32D8HgzG8wv3sY5j7',
      pub: base64pad.decode(
        'AgElBzzMonIUNEGx2faHzcf5eMu5bp3J+X3ii6NzqSdp0m2aAu5n36JY+bsu7OikilxZpzVsRieNiDq42eO6qsKskg=='
      ),
    },
  ],
  secp256k1: [
    {
      did: 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme',
      pub: base64pad.decode('A4dMFcf9og5TnG5bpXPBOYhMNRGIeZ9UWLS0H3kk8jXN'),
    },
  ],
}

describe('did:key', () => {
  for (const [
    type,
    fixtures,
  ] of /** @type {import('type-fest').Entries<typeof VECTORS> } */ (
    Object.entries(VECTORS)
  )) {
    for (const { did, pub } of fixtures) {
      it(`should parse ${type}`, () => {
        assert.deepStrictEqual(DIDKey.fromString(did).publicKey, pub)
      })

      it(`should create did from ${type} public key`, () => {
        assert.deepStrictEqual(DIDKey.fromPublicKey(type, pub).toString(), did)
      })
    }
  }
})
