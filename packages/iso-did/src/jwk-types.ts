import type { SignatureAlgorithm } from './types'

export type KeyOps =
  | 'sign'
  | 'verify'
  | 'encrypt'
  | 'decrypt'
  | 'wrapKey'
  | 'unwrapKey'
  | 'deriveKey'
  | 'deriveBits'

/**
 * JsonWebKey represents a JSON Web Key as defined in RFC 7517.
 *
 * @see https://www.rfc-editor.org/rfc/rfc7517#section-4
 */
export type JWK = ECJWK | OKPJWK | RSAJWK
export type JWKPrivate = ECJWKPrivate | OKPJWKPrivate | RSAJWKPrivate

/**
 * JsonWebKey represents a JSON Web Key as defined in RFC 7517.
 *
 * @see https://www.rfc-editor.org/rfc/rfc7517#section-4
 */
export interface BaseJWK {
  kty: 'RSA' | 'EC' | 'OKP'

  use?: 'sig' | 'enc'

  key_ops?: KeyOps[]

  alg?: SignatureAlgorithm
  /**
   * The `kid` (key ID) parameter is used to match a specific key.
   * Recommended that kid is set to the fingerprint of the public key.
   */
  kid?: string
}

/**
 * @see https://www.rfc-editor.org/rfc/rfc7518#section-6.2
 */
export interface ECJWK extends BaseJWK {
  kty: 'EC'
  crv: 'P-256' | 'P-384' | 'P-521' | 'secp256k1'
  alg?: 'ES256' | 'ES384' | 'ES512' | 'ES256K'
  /**
   * The parameter "x" MUST be present and contain the public key encoded using the base64url [RFC4648] encoding.
   */
  x: string
  /**
   * The parameter "y" MUST be present and contain the public key encoded using the base64url [RFC4648] encoding.
   */
  y: string
}

export interface ECJWKPrivate extends ECJWK {
  /**
   * The parameter "d" MUST be present and contain the private key encoded using the base64url [RFC4648] encoding.
   */
  d: string
}

/**
 * @see https://www.rfc-editor.org/rfc/rfc8037.html
 */
export interface OKPJWK extends BaseJWK {
  kty: 'OKP'
  crv: 'Ed25519'
  /**
   * The parameter "x" MUST be present and contain the public key encoded using the base64url [RFC4648] encoding.
   */
  x: string
  alg?: 'EdDSA'
}

export interface OKPJWKPrivate extends OKPJWK {
  /**
   * The parameter "d" MUST be present and contain the private key encoded using the base64url [RFC4648] encoding.
   */
  d: string
}

export interface RSAJWK extends BaseJWK {
  kty: 'RSA'
  /**
   * The "n" (modulus) parameter contains the modulus value for the RSA public key.
   */
  n: string
  /**
   * The "e" (exponent) parameter contains the exponent value for the RSA public key.
   */
  e: string
  alg?: 'RS256'
}

export interface RSAJWKPrivate extends RSAJWK {
  /**
   * The "d" (private exponent) parameter contains the private exponent value for the RSA private key.
   */
  d: string
  /**
   * The "p" (first prime factor) parameter contains the first prime factor.
   */
  p: string
  /**
   * The "q" (second prime factor) parameter contains the second prime factor.
   */
  q: string
  /**
   * The "dp" (first factor CRT exponent) parameter contains the Chinese Remainder Theorem (CRT) exponent of the first factor.
   */
  dp: string
  /**
   * The "dq" (second factor CRT exponent) parameter contains the CRT exponent of the second factor.
   */
  dq: string
  /**
   * The "qi" (first CRT coefficient) parameter contains the CRT coefficient of the second factor.
   */
  qi: string
}
