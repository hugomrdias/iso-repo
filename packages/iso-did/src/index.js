import { Resolver } from 'did-resolver'
import { varint } from 'iso-base/varint'
import { concat } from 'iso-base/utils'
import { base64url } from 'iso-base/rfc4648'
import { base58btc } from 'multiformats/bases/base58'
import * as DidKey from './key.js'
import { DIDCore } from './core.js'

// eslint-disable-next-line no-unused-vars
import * as T from './types.js'
import {
  CODE_KEY_TYPE,
  keyTypeToAlg,
  validateRawPublicKeyLength,
} from './key.js'

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
    },
    { cache: opts.cache ?? true }
  )

  const r = await resolver.resolve(did, {
    accept: 'application/did+ld+json',
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
   * @param {Omit<T.VerifiableDID, 'didKey'>} opts
   */
  constructor(opts) {
    this.did = opts.did
    this.publicKey = opts.publicKey
    this.alg = opts.alg
    this.type = opts.type
    this.document = opts.document
    this.url = opts.url
    this.didKey = DidKey.DIDKey.fromPublicKey(opts.type, opts.publicKey).url.did
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

    if (method.type === 'MultiKey') {
      const encodedKey = base58btc.decode(method.publicKeyMultibase)
      const [code, size] = varint.decode(encodedKey)
      const key = validateRawPublicKeyLength(code, encodedKey.slice(size))
      const type = CODE_KEY_TYPE[/** @type {T.PublicKeyCode} */ (code)]

      return new DID({
        did: parsedDid.did,
        alg: keyTypeToAlg(type),
        type,
        publicKey: key,
        url: parsedDid,
        document,
      })
    }

    if (method.publicKeyJwk && method.publicKeyJwk.kty === 'OKP') {
      const publicKey = base64url.decode(method.publicKeyJwk.x)
      const type = method.publicKeyJwk.crv
      const alg = keyTypeToAlg(type)
      return new DID({
        did: parsedDid.did,
        alg,
        type,
        publicKey,
        url: parsedDid,
        document,
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
      const alg = keyTypeToAlg(type)
      return new DID({
        did: parsedDid.did,
        alg,
        type,
        publicKey: didkey.publicKey,
        url: parsedDid,
        document,
      })
    }
    throw new Error(`Unsupported verification method type "${method.type}"`)
  }

  toString() {
    return this.url.didUrl
  }
}
