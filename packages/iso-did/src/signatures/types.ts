// https://www.iana.org/assignments/cose/cose.xhtml#algorithms
export type SignatureAlgorithm =
  | 'EdDSA'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'RS256'
  | 'ES256K'

export type KeyType =
  | 'Ed25519'
  | 'P-256'
  | 'P-384'
  | 'P-521'
  | 'secp256k1'
  | 'RSA'

export interface PublicKeyJwk {
  kty: string
  crv: string
  x: string
  y: string
}

export interface PublicKeyRSAJwk {
  kty: string
  n: string
  e: string
}

export interface PrivateKeyRSAJwk extends PublicKeyRSAJwk {
  d: string
  p: string
  q: string
  dp: string
  dq: string
  qi: string
}

export type PrivateKeyJwk = PublicKeyJwk & { d: string }
