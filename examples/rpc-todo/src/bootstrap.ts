/**
 * Seed a {@link Store} with delegations from the server signer to the CLI
 * signer for every command in the protocol.
 *
 * Called by both the server and the CLI on startup. The delegations are
 * built deterministically (fixed `nonce`, no expiration) so both sides end
 * up with the same delegation CIDs and the server can resolve the proofs
 * referenced by incoming invocations.
 *
 * In a real deployment delegations would be created once and either
 * persisted on the server or shipped to clients out-of-band — never
 * re-created from the server's private key on the client side.
 */
import type { Store } from 'iso-ucan/store'
import { cliSigner, serverSigner } from './keys.ts'
import { Protocol } from './protocol.ts'

export async function bootstrap(store: Store): Promise<void> {
  let i = 0
  for (const command of Object.values(Protocol)) {
    const nonce = new Uint8Array(12)
    nonce[0] = i++
    await command.capability.delegate({
      iss: serverSigner,
      sub: serverSigner.did,
      aud: cliSigner.did,
      pol: [],
      exp: null,
      nonce,
      store,
    })
  }
}
