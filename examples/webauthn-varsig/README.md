# WebAuthn Varsig Demo

Simple browser demo showing how to encode and decode WebAuthn varsig v1 using mock data or a real Ed25519 passkey.

## Development

```bash
pnpm install
pnpm dev
```

The demo runs entirely in the browser and validates WebAuthn assertion metadata. The WebAuthn path also verifies the Ed25519 signature when supported by your authenticator.

Run WebAuthn Ed25519 triggers a real passkey flow and requires a secure context (https or localhost). If your platform does not support Ed25519 passkeys, the demo will show an error.

## References

- https://www.w3.org/TR/webauthn-3/
- https://github.com/ChainAgnostic/varsig#signature-algorithm
