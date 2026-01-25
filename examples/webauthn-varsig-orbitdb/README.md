# WebAuthn Varsig + OrbitDB Identity Demo

Browser demo showing how to encode and decode WebAuthn varsig v1, then use a passkey to build a WebAuthn-backed OrbitDB-style identity and use it with a real OrbitDB database (no extra browser keypair).

## Development

```bash
pnpm install
pnpm dev
```

The demo runs entirely in the browser and validates WebAuthn assertion metadata. The WebAuthn path verifies Ed25519 or P-256 signatures when supported by your authenticator.

Sign with WebAuthn uses a real passkey flow and requires a secure context (https or localhost). If Ed25519 is not supported, the demo falls back to P-256. The OrbitDB identity section signs the DID and record payloads with WebAuthn varsig directly. The OrbitDB database section starts a real OrbitDB instance and opens a database that can replicate across tabs.

## References

- https://www.w3.org/TR/webauthn-3/
- https://github.com/ChainAgnostic/varsig#signature-algorithm
