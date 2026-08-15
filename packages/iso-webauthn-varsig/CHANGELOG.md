# Changelog

## 0.3.0

Wire format fix. **Ed25519 varsigs written by 0.2.x no longer decode** — the
curve field changes. P-256 is unaffected: its bytes are identical to 0.2.1.

- `CURVE_ED25519` was `0xed01`, the varint *encoding* of multicodec `0xed`
  rather than the code itself, so the encoder emitted `81 da 03` where the
  multicodec table says `ed 01`. Round-trips passed because the encoder and
  decoder shared the constant, but nothing else could read it. The varsig spec
  (`common.md`: `eddsa-curve` hex `0xED`) and the `dialog-varsig` reference
  implementation (`config_tags vec![0xed, 0x13]`) both use the plain code.

  Measured, first eight bytes of an Ed25519 varsig:

  ```
  0.2.1  3401 ed01 81da03 81
  0.3.0  3401 ed01 ed01   8180
  ```

  `CURVE_ED25519` now aliases `ED25519_PUB`, as `CURVE_P256` already aliased
  `P256_PUB`, so the two cannot drift apart again.

### Still open

The WebAuthn varsig header is not settled upstream:
`webauthn-varsig-header` is `TODO` in ChainAgnostic/varsig#11, and the
`0x300001` marker this package emits is a private-use codepoint chosen here
rather than an allocated one. Expect another wire change when that lands.

## 0.2.1

Verification fixes. The wire format is unchanged — encoding is byte-identical
to 0.2.0 in both directions, so signatures written by 0.2.0 still verify.

- P-256 signatures now verify. An authenticator returns ASN.1 DER, WebCrypto's
  ECDSA `verify` only accepts raw `r||s`, and it reports a format it cannot read
  as `false` rather than throwing — so every genuine P-256 assertion was
  rejected. `verifyP256Signature` accepts either form now and converts.
- Added `verifyWebAuthnVarsig`, which performs the assertion checks *and*
  verifies the signature. `verifyWebAuthnAssertion` never looked at the
  signature yet returned `valid: true`; it remains for callers that manage keys
  themselves and now documents what it does not do.
- `signCount` is read as an unsigned 32-bit integer. Assembling it with `<< 24`
  made any counter at or above 2^31 negative.
- A counter of 0 on both sides is no longer treated as a replay. WebAuthn L2
  §6.1.1 says that means the authenticator has no counter, and Apple's platform
  authenticators always report 0.
- Truncated input reports a decode error instead of surfacing a `RangeError`
  from `iso-base`, and trailing bytes after the signature are rejected rather
  than absorbed into it.
- The readme's usage example no longer derives `expectedOrigin` and
  `expectedRpId` from the assertion being verified, which compared each value
  with itself and checked nothing.

### Known issue

`CURVE_ED25519` is `0xed01`, the varint *encoding* of multicodec `0xed` rather
than the code. Both the varsig spec (`common.md`: `eddsa-curve` hex `0xED`) and
`dialog-varsig` (`config_tags vec![0xed, 0x13]`) use the plain code. Correcting
it changes the bytes on the wire, so it is held for a release that groups the
wire-format changes together.

## 0.2.0

- Non-recursive wire format. Encoded bytes from 0.1.0 are not compatible.
