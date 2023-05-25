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
