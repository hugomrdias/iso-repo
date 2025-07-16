# iso-ucan [![NPM Version](https://img.shields.io/npm/v/iso-ucan.svg)](https://www.npmjs.com/package/iso-ucan) [![License](https://img.shields.io/npm/l/iso-ucan.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-ucan](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ucan.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ucan.yml)

> Isomorphic UCAN

## Install

```bash
pnpm install iso-ucan
```

## Usage

```ts
import { Capability } from 'iso-ucan/capability'
import { Store } from 'iso-ucan/store'
import { MemoryDriver } from 'iso-kv/drivers/memory'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { z } from 'zod'

const store = new Store(new MemoryDriver())

const AccountCreateCap = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
})

const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
})

const owner = await EdDSASigner.generate()
const bob = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()

const nowInSeconds = Math.floor(Date.now() / 1000)

const ownerDelegation = await AccountCap.delegate({
iss: owner,
aud: bob,
sub: owner,
pol: [],
exp: nowInSeconds + 1000,
})

await store.set(ownerDelegation)

const bobDelegation = await AccountCap.delegate({
iss: bob,
aud: invoker,
sub: owner,
pol: [],
exp: nowInSeconds + 1000,
})

await store.set(bobDelegation)

const invocation = await AccountCreateCap.invoke({
iss: invoker,
sub: owner,
args: {
    type: 'account',
    properties: {
    name: 'John Doe',
    },
},
store,
exp: nowInSeconds + 1000,
})
```

## License

MIT © [Hugo Dias](http://hugodias.me)
