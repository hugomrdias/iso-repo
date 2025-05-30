import { Resolver } from 'did-resolver'
import { base64url } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'
import { varint } from 'iso-base/varint'
import { base58btc } from 'multiformats/bases/base58'
import { DIDCore } from './core.js'
import * as DidKey from './key.js'
import * as DidPkh from './pkh.js'
import * as T from './types.js'

import { CODE_KEY_TYPE, validateRawPublicKeyLength } from './key.js'
/**
 * Resolve a DID to a DID Document
 *
 * @see https://www.w3.org/TR/did-core/#resolution
 *
 * @param {T.DID} did
 * @param {T.ResolveOptions} [opts]
 */
export async function resolve(did, opts = {}) {
  const resolver = new Resolver(
    {
      ...DidKey.resolver,
      ...opts.resolvers,
      ...DidPkh.resolver,
    },
    { cache: opts.cache ?? true }
  )

  const r = await resolver.resolve(did, {
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
 * @param {T.ResolveOptions} [opts]
 */
export async function dereference(didObject, opts) {
  const didDocument = await resolve(didObject.did, opts)

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
   * @param {Omit<T.VerifiableDID, 'did'>} opts
   */
  constructor(opts) {
    this.did = opts.didObject.did
    this.document = opts.document
    this.didObject = opts.didObject
    this.verifiableDid = opts.verifiableDid
  }

  /**
   *
   * @param {T.DIDURL} did
   * @param {T.ResolveOptions} [opts]
   */
  static async fromString(did, opts = {}) {
    const parsedDid = parse(did)
    const document = await resolve(parsedDid.did, opts)
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
    return this.didObject.didUrl
  }
}
