import * as cbor from '@ipld/dag-cbor'
import * as varsig from './varsig.js'

/**
 * @import { Envelope, PayloadTag, EnvelopeDecodeOptions, EnvelopeEncodeOptions, EnvelopeSignOptions, SignaturePayload, PayloadSpec, DecodedEnvelope, DelegationPayload, InvocationPayload} from './types.js'
 * @import { ByteView } from 'multiformats'
 */

/** Version */
export const VERSION = '1.0.0-rc.1'

/**
 *
 * @param {EnvelopeSignOptions} options
 */
export async function sign(options) {
  const { spec, version, enc, signer, payload } = options

  const payloadTag = /** @type {PayloadTag} */ (
    `ucan/${spec}@${version ?? VERSION}`
  )
  const h = varsig.encode({ enc: enc ?? 'DAG-CBOR', alg: signer.signatureType })

  const signaturePayload = /** @type {SignaturePayload} */ ({
    h,
    [payloadTag]: payload,
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
