import assert from 'assert'
import { base64url } from 'iso-base/rfc4648'
import { EdDSASigner } from '../src/signers/eddsa.js'
import * as EdDSA from '../src/verifiers/eddsa.js'

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

describe('Verifier EdDSA', () => {
  for (const { pub, priv } of fixtures.ed25519) {
    it(`should verify ${base64url.encode(priv)}`, async () => {
      const message = new TextEncoder().encode('hello world')
      const signer = await EdDSASigner.generate(priv)

      assert.deepStrictEqual(pub, signer.verifiableDid.publicKey)

      const signature = await signer.sign(message)

      const verified = await EdDSA.verify({
        signature,
        message,
        did: signer,
      })
      assert.ok(verified)
      assert.ok(
        await EdDSA.verify({ signature, message, did: signer, strict: true })
      )
    })
  }

  it('should reject S + L', async () => {
    const message = new TextEncoder().encode('hello world')
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)

    // S is little-endian, S + L still fits in 32 bytes
    const L = 2n ** 252n + 27742317777372353535851937790883648493n
    let s = 0n
    for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(signature[i])
    s += L
    const malleated = new Uint8Array(signature)
    for (let i = 32; i < 64; i++) {
      malleated[i] = Number(s & 0xffn)
      s >>= 8n
    }

    for (const strict of [false, true]) {
      assert.equal(
        await EdDSA.verify({
          signature: malleated,
          message,
          did: signer,
          strict,
        }),
        false
      )
    }
  })
})
