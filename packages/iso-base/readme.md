# iso-base [![NPM Version](https://img.shields.io/npm/v/iso-base.svg)](https://www.npmjs.com/package/iso-base) [![License](https://img.shields.io/npm/l/iso-base.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-base](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-base.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-base.yml)

> Isomorphic utilities for webcrypto, RFC4648 encoding, LEB128 encoding, UTF-8 encoding, base-x encoding, varint encoding, elliptic curve compression, and buffer manipulation.

## Features

- **RFC4648 Encoding**: Base2, Base8, Base16, Base32, Base32hex, Base64, Base64url encoding/decoding
- **Base-X Encoding**: Base10, Base36, Base58BTC encoding/decoding with leading zero compression
- **LEB128**: Unsigned LEB128 encoding/decoding with BigInt support
- **Varint**: Unsigned variable-length integer encoding/decoding (multiformats compatible)
- **UTF-8**: UTF-8 string encoding/decoding
- **Crypto**: Isomorphic WebCrypto API and secure random bytes
- **EC Compression**: Elliptic curve point compression/decompression (P-256, P-384, P-521, secp256k1)
- **Utils**: TypedArray and BufferSource utilities (concatenation, equality checks, type guards, conversions)

## Install

```bash
pnpm install iso-base
```

## Entrypoints

- `iso-base` - Main entrypoint (exports Crypto, Rfc4648, UTF8, Utils)
- `iso-base/utils` - TypedArray and BufferSource utilities
- `iso-base/utf8` - UTF-8 codec
- `iso-base/crypto` - WebCrypto API and random bytes
- `iso-base/rfc4648` - RFC4648 encoding codecs
- `iso-base/base-x` - Base-X encoding codecs
- `iso-base/varint` - Varint encoding/decoding
- `iso-base/leb128` - LEB128 encoding/decoding
- `iso-base/ec-compression` - Elliptic curve compression utilities
- `iso-base/types` - TypeScript type definitions

## Usage

### RFC4648 Encoding

```ts twoslash
import { base16, base32, base64, base64url, hex } from 'iso-base/rfc4648'

// Encode bytes to string
const encoded = base64.encode(new Uint8Array([1, 2, 3]))
// 'AQID'

// Decode string to bytes
const decoded = base64.decode('AQID')
// Uint8Array [1, 2, 3]

// Encode strings (automatically converts via UTF-8)
const strEncoded = base64.encode('hello')
// 'aGVsbG8='

// Available codecs: base2, base8, hex, base16, base32, base32hex, base64, base64pad, base64url
const hexEncoded = hex.encode(new Uint8Array([255, 255]))
// 'ffff'
```

### Base-X Encoding

```ts twoslash
import { base10, base36, base58btc, baseX } from 'iso-base/base-x'

// Encode bytes to base58
const encoded = base58btc.encode(new Uint8Array([1, 2, 3]))
// 'Ldp'

// Decode base58 to bytes
const decoded = base58btc.decode('Ldp')
// Uint8Array [1, 2, 3]

// Available codecs: base10, base36, base58btc
const base10Encoded = base10.encode(new Uint8Array([123]))
// '123'

// Create custom base-x codec
const custom = baseX('base58btc')
```

### LEB128 Encoding

```ts twoslash
import { unsigned } from 'iso-base/leb128'

// Encode number or BigInt
const encoded = unsigned.encode(19810)
// Uint8Array [226, 154, 1]

// Decode to BigInt
const [decoded, size] = unsigned.decode(encoded)
// [19810n, 3]

// Get encoding length
const length = unsigned.encodingLength(encoded)
// 3

// Supports BigInt
const bigEncoded = unsigned.encode('16497666429405569624')
const [bigDecoded] = unsigned.decode(bigEncoded)
```

### Varint Encoding

```ts twoslash
import { encode, decode, encodingLength, tag, untag } from 'iso-base/varint'

// Encode number
const [encoded, size] = encode(300)
// [Uint8Array [172, 2], 2]

// Decode varint
const [decoded, readSize] = decode(encoded)
// [300, 2]

// Get encoding length
const length = encodingLength(300)
// 2

// Tag bytes with multicodec prefix
const tagged = tag(0x01, new Uint8Array([1, 2, 3]))
// Uint8Array [1, 1, 2, 3]

// Untag bytes
const untagged = untag(0x01, tagged)
// Uint8Array [1, 2, 3]
```

### UTF-8 Encoding

```ts twoslash
import { utf8 } from 'iso-base/utf8'

// Encode string to bytes
const bytes = utf8.decode('hello')
// Uint8Array [104, 101, 108, 108, 111]

// Decode bytes to string
const str = utf8.encode(bytes)
// 'hello'
```

### Crypto

```ts twoslash
import { webcrypto, randomBytes } from 'iso-base/crypto'

// Get WebCrypto API (isomorphic)
const crypto = webcrypto

// Generate random bytes
const random = randomBytes(32)
// Uint8Array(32) [random bytes...]

// Use WebCrypto API
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
)
```

### Elliptic Curve Compression

```ts twoslash
import { compress, decompress, decompressSecp256k1, isCompressed, isUncompressed } from 'iso-base/ec-compression'

// Compress uncompressed public key (0x04 prefix)
const uncompressed = new Uint8Array([0x04, /* x and y coordinates */])
const compressed = compress(uncompressed)
// Uint8Array [0x02 or 0x03, /* x coordinate */]

// Decompress compressed public key
const decompressed = decompress(compressed, 'P-256')
// Uint8Array [0x04, /* x and y coordinates */]

// Check compression status
const isComp = isCompressed(compressed)
// true

// Decompress secp256k1 keys
const secp256k1Decompressed = decompressSecp256k1(compressed)
```

### Utils

```ts twoslash
import { 
  u8, 
  concat, 
  equals, 
  isUint8Array, 
  isBufferSource, 
  isTypedArray,
  assertUint8Array 
} from 'iso-base/utils'

// Convert any TypedArray to Uint8Array
const uint8 = u8(new Int8Array([1, 2, 3]))
// Uint8Array [1, 2, 3]

// Concatenate arrays
const combined = concat([
  new Uint8Array([1, 2]),
  new Uint8Array([3, 4])
])
// Uint8Array [1, 2, 3, 4]

// Check equality
const isEqual = equals(
  new Uint8Array([1, 2, 3]),
  new Uint8Array([1, 2, 3])
)
// true

// Type guards
isUint8Array(new Uint8Array([1]))
// true

isBufferSource(new ArrayBuffer(8))
// true

isTypedArray(new Int16Array([1]))
// true

// Assertions
assertUint8Array(new Uint8Array([1]))
// void (throws if not Uint8Array)
```

### Main Entrypoint

```ts twoslash
import { Crypto, Rfc4648, UTF8, Utils } from 'iso-base'

// Access all modules via namespaces
const random = Crypto.randomBytes(32)
const encoded = Rfc4648.base64.encode(new Uint8Array([1, 2, 3]))
const utf8Bytes = UTF8.utf8.decode('hello')
const isUint8 = Utils.isUint8Array(new Uint8Array([1]))
```

## License

MIT © [Hugo Dias](http://hugodias.me)
