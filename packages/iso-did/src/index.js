import { Resolver } from 'did-resolver'
import { base64url } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'
import { varint } from 'iso-base/varint'
import { base58btc } from 'multiformats/bases/base58'
import { DIDCore } from './core.js'
import * as DidKey from './key.js'
import { CODE_KEY_TYPE, validateRawPublicKeyLength } from './key.js'
import * as DidPkh from './pkh.js'
import * as T from './types.js'

export { Resolver } from 'did-resolver'

/**
 * Default resolver for DID resolution.
 * Supports `did:key` and `did:pkh` methods.
 *
 * @type {import('did-resolver').Resolver}
 */
export const defaultResolver = new Resolver(
  {
    key: DidKey.resolver.key,
    pkh: DidPkh.resolver.pkh,
  },
  { cache: true }
)

/**
 * Resolve a DID to a DID Document
 *
 * @see https://www.w3.org/TR/did-core/#resolution
 *
 * @param {string} did
 * @param {import('did-resolver').Resolver} [resolver]
 */
export async function resolve(did, resolver = defaultResolver) {
  const parsed = parse(did)
  const r = await resolver.resolve(parsed.did, {
    accept: 'application/did+ld+json,application/json',
  })

  if (r.didResolutionMetadata.error) {
    throw new Error(r.didResolutionMetadata.error)
  }

  return /** @type {T.DIDDocument} */ (r.didDocument)
}

/**
 * Parse a DID string into a DID Core object
 *
 * @see https://www.w3.org/TR/did-core/#identifier
 *
 * @param {string} did
 */
export function parse(did) {
  return DIDCore.fromString(did)
}

/**
 * Dereference a DID URL
 *
 * @see https://www.w3.org/TR/did-core/#did-url-dereferencing
 * @param {T.DIDURLObject} didObject
 * @param {import('did-resolver').Resolver} [resolver]
 */
export async function dereference(didObject, resolver = defaultResolver) {
  const didDocument = await resolve(didObject.did, resolver)

  if (!didDocument) {
    throw new Error(`No DID Document found for ${didObject.did}`)
  }

  return derefDocument(didObject, didDocument)
}

/**
 * Dereference a DID URL from a DID Document
 *
 * @param {T.DIDURLObject} didObject
 * @param {T.DIDDocument} document
 */
export function derefDocument(didObject, document) {
  const fragment = didObject.fragment ?? didObject.id
  /** @type {T.VerificationMethod | undefined} */
  let method

  if (document.verificationMethod) {
    method = document.verificationMethod.find(
      (vm) => vm.id === `${didObject.did}#${fragment}`
    )
  }

  if (!method && document.authentication) {
    method = /** @type {T.VerificationMethod} */ (
      document.authentication.find(
        (vm) =>
          typeof vm !== 'string' && vm.id === `${didObject.did}#${fragment}`
      )
    )
  }

  return method
}

/**
 * Verifiable DID
 *
 * @implements {T.VerifiableDID}
 */
export class DID {
  /**
   *
   * @param {T.VerifiableDidOptions} opts
   */
  constructor(opts) {
    this.did = opts.didObject.did
    this.didUrl = opts.didObject.didUrl
    this.method = opts.didObject.method
    this.id = opts.didObject.id
    this.path = opts.didObject.path
    this.fragment = opts.didObject.fragment
    this.query = opts.didObject.query

    this.document = opts.document
    this.verifiableDid = opts.verifiableDid
    this.didObject = opts.didObject
  }

  /**
   *
   * @param {string} did
   * @param {import('did-resolver').Resolver} [resolver]
   */
  static async fromString(did, resolver = defaultResolver) {
    const parsedDid = parse(did)
    const document = await resolve(parsedDid.did, resolver)
    const method = derefDocument(parsedDid, document)

    if (!method) {
      throw new Error(`No verification method found for ${did}`)
    }

    if (method.type === 'EcdsaSecp256k1RecoveryMethod2020') {
      const didPkh = new DidPkh.DIDPkh(parsedDid)
      return new DID({
        didObject: parsedDid,
        document,
        verifiableDid: didPkh,
      })
    }

    if (method.type === 'MultiKey' || method.type === 'Multikey') {
      const encodedKey = base58btc.decode(method.publicKeyMultibase)
      const [code, size] = varint.decode(encodedKey)
      const key = validateRawPublicKeyLength(code, encodedKey.slice(size))
      const type = CODE_KEY_TYPE[/** @type {T.PublicKeyCode} */ (code)]

      return new DID({
        didObject: parsedDid,
        document,
        verifiableDid: DidKey.DIDKey.fromPublicKey(type, key),
      })
    }
    if (
      method.type === 'JsonWebKey2020' ||
      method.type === 'JsonWebKey' ||
      method.type === 'Ed25519VerificationKey2018'
    ) {
      if (method.publicKeyJwk && method.publicKeyJwk.kty === 'OKP') {
        const publicKey = base64url.decode(method.publicKeyJwk.x)
        const type = method.publicKeyJwk.crv
        // const alg = keyTypeToAlg(type)
        return new DID({
          didObject: parsedDid,
          document,
          verifiableDid: DidKey.DIDKey.fromPublicKey(type, publicKey),
        })
      }

      if (method.publicKeyJwk && method.publicKeyJwk.kty === 'EC') {
        const type = method.publicKeyJwk.crv
        const didkey = DidKey.DIDKey.fromPublicKey(
          type,
          concat([
            [4],
            base64url.decode(method.publicKeyJwk.x),
            base64url.decode(method.publicKeyJwk.y),
          ])
        )
        // const alg = keyTypeToAlg(type)
        return new DID({
          didObject: parsedDid,
          document,
          verifiableDid: didkey,
        })
      }
    }
    throw new Error(`Unsupported verification method type "${method.type}"`)
  }

  toString() {
    return this.didUrl
  }
}
