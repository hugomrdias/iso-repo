# iso-did [![NPM Version](https://img.shields.io/npm/v/iso-did.svg)](https://www.npmjs.com/package/iso-did) [![License](https://img.shields.io/npm/l/iso-did.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-did](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-did.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-did.yml)

> Isomorphic did core and did key tooling

## Install

```bash
pnpm install iso-did
```

## Usage

```js
import { DID } from 'iso-did'

const did = DID.fromString(
  'did:example:21tDAKCERh95uGgKbJNHYp;service=agent;foo:bar=high/some/path?foo=bar#key1'
)

// did.did = 'did:example:21tDAKCERh95uGgKbJNHYp'
// did.id = '21tDAKCERh95uGgKbJNHYp'
// did.method = 'example'
// did.path = '/some/path'
// did.fragment = 'key1'
```

```js
import { DIDKey } from 'iso-did/key'

const did1 = DIDKey.fromString(
  'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp'
)

// did1.key = Uint8Array([1, 2, 3, 4])
// did1.code = 0xed
// did1.type = 'ED25519'

const did2 = DIDKey.fromPublicKey('ED25519', publicKeyBytes)

// did2.id = z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp
// did2.did = did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp
```

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_did.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
