import type { DIDKey } from '../../key.js'
import type { SignatureAlgorithm, KeyType } from '../../types.js'

export interface ISigner<Export extends CryptoKeyPair | string> {
  /**
   * JWT signing algorithm
   */
  alg: SignatureAlgorithm
  /**
   * Keypair type
   */
  type: KeyType
  /**
   * Multicodec identifier for the private key
   */
  code?: number

  did: DIDKey
  /**
   * Sign a message
   */
  sign: (message: Uint8Array) => Promise<Uint8Array>

  export: () => Export
}
