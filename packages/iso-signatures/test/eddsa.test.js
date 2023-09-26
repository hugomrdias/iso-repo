import assert from 'assert'
import { base64url } from 'iso-base/rfc4648'
import * as EdDSA from '../src/verifiers/eddsa.js'
import { EdDSASigner } from '../src/signers/eddsa.js'

const fixtures = {
  ed25519: [
    {
      // https://www.rfc-editor.org/rfc/rfc8037#appendix-A.1
      pub: base64url.decode('11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo'),
      priv: base64url.decode('nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A'),
    },
    {
      // https://github.com/w3c-ccg/did-method-key/blob/main/test-vectors/ed25519-x25519.json#L225-L230
      pub: base64url.decode('_eT7oDCtAC98L31MMx9J0T-w7HR-zuvsY08f9MvKne8'),
      priv: base64url.decode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU'),
    },
    {
      // https://www.w3.org/community/reports/credentials/CG-FINAL-lds-jws2020-20220721/#example-4
      pub: base64url.decode('CV-aGlld3nVdgnhoZK0D36Wk-9aIMlZjZOK2XhPMnkQ'),
      priv: base64url.decode('m5N7gTItgWz6udWjuqzJsqX-vksUnxJrNjD5OilScBc'),
    },
  ],
}

describe('Verifier EdDSA', function () {
  for (const { pub, priv } of fixtures.ed25519) {
    it(`should verify ${base64url.encode(priv)}`, async function () {
      const message = new TextEncoder().encode('hello world')
      const signer = await EdDSASigner.generate(priv)

      assert.deepStrictEqual(pub, signer.publicKey)

      const signature = await signer.sign(message)

      const verified = await EdDSA.verify({
        signature,
        message,
        publicKey: pub,
      })
      assert.ok(verified)
    })
  }
})
