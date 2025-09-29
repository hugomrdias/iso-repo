import * as cbor from '@ipld/dag-cbor'
import { isObject } from './utils.js'
import * as varsig from './varsig.js'

/**
 * @import { Envelope, PayloadTag, EnvelopeDecodeOptions, EnvelopeEncodeOptions, EnvelopeSignOptions, SignaturePayload, PayloadSpec, DecodedEnvelope, DelegationPayload, InvocationPayload, Payload} from './types.js'
 * @import { ByteView } from 'multiformats'
 */

/** Version */
export const VERSION = '1.0.0-rc.1'

/**
 * Get the signature payload for a given payload
 *
 * @param {object} options
 * @param {PayloadSpec} options.spec
 * @param {Payload} options.payload
 * @param {string} [options.version]
 * @param {import('iso-signatures/types').SignatureType} options.signatureType
 */
export function getSignaturePayload(options) {
  const { spec, version, signatureType, payload } = options

  const payloadTag = /** @type {PayloadTag} */ (
    `ucan/${spec}@${version ?? VERSION}`
  )

  const h = varsig.encode({ enc: 'DAG-CBOR', alg: signatureType })

  const signaturePayload = /** @type {SignaturePayload} */ ({
    h,
    [payloadTag]: payload,
  })

  return signaturePayload
}

/**
 * Decode a signature payload
 *
 * @param {Uint8Array} bytes
 */
export function decodeSignaturePayload(bytes) {
  const decode = /** @type typeof cbor.decode<SignaturePayload> **/ (
    cbor.decode
  )
  const decoded = decode(bytes)

  if (!isObject(decoded)) {
    throw new TypeError(
      `Invalid signature payload expected object got ${typeof decoded}`
    )
  }
  if (!('h' in decoded)) {
    throw new TypeError('Invalid signature payload missing h')
  }
  const keys = Object.keys(decoded)
  if (keys.length !== 2) {
    throw new TypeError(
      `Invalid signature payload expected 2 keys got ${keys.length}`
    )
  }
  if (!keys[1].startsWith('ucan/dlg') && !keys[1].startsWith('ucan/inv')) {
    throw new TypeError('Invalid signature payload missing payload')
  }

  const payloadTag = /** @type {PayloadTag} */ (keys[1])
  const { alg, enc } = varsig.decode(decoded.h)
  const payload = decoded[payloadTag]
  return {
    alg,
    enc,
    payload,
  }
}

/**
 * Check if a payload is an invocation payload
 *
 * @param {Payload} payload
 * @returns {payload is InvocationPayload}
 */
export function isInvocationPayload(payload) {
  return 'args' in payload
}

/**
 * Check if a payload is a delegation payload
 *
 * @param {Payload} payload
 * @returns {payload is DelegationPayload}
 */
export function isDelegationPayload(payload) {
  return 'pol' in payload
}

/**
 *
 * @param {EnvelopeSignOptions} options
 */
export async function sign(options) {
  const { spec, version, signer, payload } = options

  const signaturePayload = getSignaturePayload({
    spec,
    version,
    signatureType: signer.signatureType,
    payload,
  })
  const signature = await signer.sign(cbor.encode(signaturePayload))
  return {
    signature,
    signaturePayload,
  }
}

/**
 * Encode a UCAN envelope
 *
 * @see https://github.com/ucan-wg/spec#envelope
 * @param {EnvelopeEncodeOptions} options
 *
 */
export function encode(options) {
  const { signature, signaturePayload } = options

  const envelope = [signature, signaturePayload]

  return cbor.encode(envelope)
}

/**
 * Decode a UCAN envelope
 *
 * @template {PayloadSpec} Spec
 * @see https://github.com/ucan-wg/spec#envelope
 * @param {EnvelopeDecodeOptions} options
 * @returns {DecodedEnvelope<Spec>}
 */
export function decode(options) {
  const { envelope } = options

  const decoded = /** @type typeof cbor.decode<Envelope> **/ (cbor.decode)(
    /** @type {ByteView<Envelope>} */ (envelope)
  )

  const [signature, sigPayload] = decoded
  const [_h, payloadTag] = Object.keys(sigPayload)
  const header = sigPayload.h
  /** @type {DelegationPayload | InvocationPayload} */
  const payload = sigPayload[/** @type {PayloadTag} */ (payloadTag)]

  const [_ucan, specVersion] = payloadTag.split('/')
  const [spec, version] = specVersion.split('@')

  const { alg, enc } = varsig.decode(header)

  return {
    alg,
    enc,
    signature,
    // Narrow payload type based on Spec
    payload:
      /** @type {Spec extends "dlg" ? DelegationPayload : InvocationPayload} */ (
        payload
      ),
    spec: /** @type {Spec} */ (spec),
    version,
  }
}
