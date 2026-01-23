# iso-webauthn-varsig

WebAuthn varsig encoding/decoding helpers for Ed25519 and P-256.

## Usage

```js
import {
  encodeWebAuthnVarsigV1,
  decodeWebAuthnVarsigV1,
  parseClientDataJSON,
  verifyWebAuthnAssertion,
} from 'iso-webauthn-varsig'

const assertion = {
  authenticatorData: new Uint8Array([/* ... */]),
  clientDataJSON: new Uint8Array([/* ... */]),
  signature: new Uint8Array([/* ... */]),
}

const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
const decoded = decodeWebAuthnVarsigV1(varsig)
const clientData = parseClientDataJSON(decoded.clientDataJSON)

const result = await verifyWebAuthnAssertion(decoded, {
  expectedOrigin: clientData.origin,
  expectedRpId: new URL(clientData.origin).hostname,
  expectedChallenge: new Uint8Array([/* ... */]),
})

console.log(result.valid)
```

## Notes

- Ed25519 WebAuthn credentials are not supported on all platforms. If your authenticator does not return an Ed25519 key, you must fall back to P-256.
