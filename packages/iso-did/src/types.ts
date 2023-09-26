import type { ParsedDID } from 'did-resolver'
import type { Alg } from './common'

export interface DID extends ParsedDID {}

// https://www.iana.org/assignments/cose/cose.xhtml#algorithms
export type SignatureAlgorithm = Alg

export type { KeyType, PublicKeyCode } from './common'
