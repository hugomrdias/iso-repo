# WebAuthn Varsig Demo

Simple browser demo showing how to encode and decode WebAuthn varsig v1 using mock Ed25519/P-256 data or a real passkey.

## Development

```bash
pnpm install
pnpm dev
```

The demo runs entirely in the browser and validates WebAuthn assertion metadata. The WebAuthn path verifies Ed25519 or P-256 signatures when supported by your authenticator.

Sign with WebAuthn uses a real passkey flow and requires a secure context (https or localhost). If Ed25519 is not supported, the demo falls back to P-256.

## References

- https://www.w3.org/TR/webauthn-3/
- https://github.com/ChainAgnostic/varsig#signature-algorithm
