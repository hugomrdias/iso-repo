# iso-signatures [![NPM Version](https://img.shields.io/npm/v/iso-signatures.svg)](https://www.npmjs.com/package/iso-signatures) [![License](https://img.shields.io/npm/l/iso-signatures.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-did](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-signatures.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-signatures.yml)

> Isomorphic signatures tooling

## Install

```bash
pnpm install iso-signatures
```

## Usage

```js
import { EdDSASigner } from 'iso-signatures/signers/eddsa'
import * as EdDSA from 'iso-signatures/verifiers/eddsa'
import { Resolver } from 'iso-signatures/verifiers/resolver'

const message = new TextEncoder().encode('hello world')
const resolver = new Resolver({
  ...EdDSA.verifier,
})
const signer = await EdDSASigner.generate()
const signature = await signer.sign(message)
const verified = await resolver.verify({
  signature,
  message,
  ...signer,
})
```

```js
import { EdDSASigner } from 'iso-signatures/signers/eddsa'
import * as EdDSA from 'iso-signatures/verifiers/eddsa'
import * as ECDSA from 'iso-signatures/verifiers/ecdsa'
import * as RSA from 'iso-signatures/verifiers/rsa'
import { Resolver } from 'iso-signatures/verifiers/resolver'

const message = new TextEncoder().encode('hello world')
const resolver = new Resolver(
  {
    ...ECDSA.verifier,
    ...EdDSA.verifier,
  },
  { cache: true }
)
const signer = await EdDSASigner.generate()
const signature = await signer.sign(message)
const verified = await resolver.verify({
  signature,
  message,
  ...signer.did, // Signer and DID both have `alg` property that the resolver uses to find the correct verifier
})
```

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_signatures.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
