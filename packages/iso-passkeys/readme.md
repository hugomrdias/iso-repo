# iso-passkeys [![NPM Version](https://img.shields.io/npm/v/iso-passkeys.svg)](https://www.npmjs.com/package/iso-passkeys) [![License](https://img.shields.io/npm/l/iso-passkeys.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-passkeys](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-passkeys.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-passkeys.yml)

> Isomorphic passkeys tooling

## Install

```bash
pnpm install iso-passkeys
```

## Usage

```js
import { credentialsCreate, credentialsGet, supports } from 'iso-passkeys'

const credential = await credentialsCreate({
  publicKey: {
    challenge: base64url.encode(new Uint8Array([1, 2, 3, 4])),
    rp: {
      id: 'example.com',
      name: 'Example',
    },
    user: {
      id: user.id,
      name: username,
      displayName: 'Joe Doe',
    },
    attestation: 'none',
    authenticatorSelection: {
      userVerification: 'required',
      requireResidentKey: true,
      residentKey: 'required',
    },
    extensions: {
      credProps: true,
      largeBlob: {
        support: 'preferred',
      },
      prf: {
        eval: {
          first: new Uint8Array(Array.from({ length: 32 }).fill(1)).buffer,
          second: new Uint8Array(Array.from({ length: 32 }).fill(1)).buffer,
        },
      },
    },
  },
})

const assertion = await credentialsGet({
  mediation: 'conditional',
  publicKey: {
    challenge: base64url.encode(new Uint8Array([1, 2, 3, 4])),
    allowCredentials: [],
    userVerification: 'required',
    rpId: 'example.com',
    extensions: {
      largeBlob: {
        // read: true,
        write: utf8.decode('hello world').buffer,
      },
      prf: {
        eval: {
          first: utf8.decode('first-salt').buffer,
          second: utf8.decode('second-salt').buffer,
        },
      },
    },
  },
})
```

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_passkeys.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
