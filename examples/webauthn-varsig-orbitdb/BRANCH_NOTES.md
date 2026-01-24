# WebAuthn Varsig + OrbitDB Identity Demo (Browser-Only)

This example demonstrates a WebAuthn-backed, OrbitDB-style identity that signs
directly with passkeys using varsig, without creating a separate browser
keystore keypair. The demo mirrors the OrbitDB identity shape but uses WebAuthn
assertions end-to-end in the browser.

## Scope

- WebAuthn registration + assertion in the browser.
- Encode assertions as varsig v1 envelopes.
- Build an OrbitDB-style identity:
  - `id` is a DIDKey derived from the credential public key.
  - `signatures.id` is a varsig over the DID.
  - `signatures.publicKey` is a varsig over `publicKey || signatures.id`.
- Sign and verify record payloads with WebAuthn varsig.

## Non-goals

- No OrbitDB keystore or default identity flow.
- No server-side verification or attestation checks.
- No persistence to a real OrbitDB database.

## Run

```bash
pnpm install
pnpm dev
```

Requires HTTPS or localhost for WebAuthn.
