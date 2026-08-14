# iso-webauthn-varsig

WebAuthn varsig encoding/decoding helpers for Ed25519 and P-256.

Implements the **non-recursive** WebAuthn varsig layout per [Gozala's suggestion](https://github.com/ChainAgnostic/varsig/pull/11#discussion_r2766471176) on the ChainAgnostic varsig spec.

## Wire Format

All multi-byte integers are unsigned varint-encoded.

```abnf
webauthn-varsig = webauthn-varsig-header
                 client-data-length client-data-json
                 authenticator-data-length authenticator-data
                 signature-hash-algorithm encoding-info signature-bytes

webauthn-varsig-header = varsig-prefix varsig-version inner-algorithm curve webauthn-marker
varsig-prefix = %x34
varsig-version = %x01
inner-algorithm = %xED / %xEC       ; EdDSA / ECDSA
curve = %xED / %x1200               ; Ed25519 / P-256 (multicodec code,
                                    ; varint-encoded: ED -> ED 01)
webauthn-marker = %x300001           ; private-use multicodec

client-data-length = 1*unsigned-varint
client-data-json = *OCTET
authenticator-data-length = 1*unsigned-varint
authenticator-data = *OCTET
signature-hash-algorithm = 1*unsigned-varint  ; multihash code (default 0x12 = SHA-256)
encoding-info = 1*unsigned-varint             ; payload encoding (default 0x5f = raw)
signature-bytes = *OCTET                      ; raw WebAuthn signature
```

This layout avoids recursion (no nested varsig-body) and aligns with the [dialog-db](https://github.com/dialog-db/dialog-db) Go/Rust reference implementation.

## Usage

```js
import {
  encodeWebAuthnVarsigV1,
  decodeWebAuthnVarsigV1,
  parseClientDataJSON,
  verifyWebAuthnVarsig,
} from 'iso-webauthn-varsig'

const assertion = {
  authenticatorData: new Uint8Array([/* ... */]),
  clientDataJSON: new Uint8Array([/* ... */]),
  signature: new Uint8Array([/* ... */]),
}

// Encode with defaults (SHA-256 hash, raw encoding)
const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')

// Or with explicit signature metadata
const varsig2 = encodeWebAuthnVarsigV1(assertion, 'P-256', {
  signatureHashAlgorithm: 0x12, // SHA-256
  encodingInfo: 0x5f,           // raw
})

const decoded = decodeWebAuthnVarsigV1(varsig)

const result = await verifyWebAuthnVarsig(decoded, {
  // These must come from *your* configuration and from the challenge you
  // issued — never from the assertion being verified. Reading them out of
  // decoded.clientDataJSON would compare each value against itself and
  // check nothing.
  expectedOrigin: 'https://example.com',
  expectedRpId: 'example.com',
  expectedChallenge: challengeYouIssued,
  // The credential's public key, from registration: 32 raw bytes for Ed25519,
  // or an uncompressed P-256 point (65 bytes, 0x04 || x || y).
  publicKey: storedCredentialPublicKey,
})

console.log(result.valid)
```

### Verifying

`verifyWebAuthnVarsig` is the function you want: it checks the ceremony type,
origin, challenge, rpIdHash and flags **and** verifies the signature.

`verifyWebAuthnAssertion` performs only the first half. It is exported for
callers who manage key lookup themselves, but on its own a `valid: true` result
says the assertion is well-formed and addressed to you — not that it is
authentic. It accepts a fabricated signature.

P-256 signatures are accepted in either the ASN.1 DER form an authenticator
emits or raw `r||s`; the conversion happens internally. WebCrypto only
understands the raw form, so passing DER to `subtle.verify` yourself silently
returns `false` for every genuine signature.

## Notes

- Ed25519 WebAuthn credentials are not supported on all platforms. If your authenticator does not return an Ed25519 key, you must fall back to P-256.
- **Breaking change in v0.2.0**: The wire format changed from v0.1.0. Encoded bytes from the old format are not compatible with this version. See [issue #1](https://github.com/NiKrause/iso-repo/issues/1) for details.
