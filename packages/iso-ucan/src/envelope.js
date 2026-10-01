import * as cbor from '@ipld/dag-cbor'
import { isObject } from './utils.js'
import * as varsig from './varsig.js'

/**
 * @import { PayloadTag, EnvelopeDecodeOptions, EnvelopeEncodeOptions, EnvelopeSignOptions, SignaturePayload, PayloadSpec, DecodedEnvelope, DelegationPayload, InvocationPayload, Payload} from './types.js'
 */

/**
 * Payload tag version used for new tokens (`ucan/dlg@1.0.0`, `ucan/inv@1.0.0`)
 *
 * @see https://github.com/ucan-wg/delegation#type-tag
 * @see https://github.com/ucan-wg/invocation#type-tag
 */
export const VERSION = '1.0.0'

/**
 * Payload tag versions accepted on decode.
 *
 * `1.0.0-rc.1` is still accepted so tokens issued by iso-ucan <= 1.0.0 keep
 * verifying. New tokens are always encoded with {@link VERSION}.
 *
 * @type {readonly string[]}
 */
export const SUPPORTED_VERSIONS = Object.freeze([VERSION, '1.0.0-rc.1'])

/**
 * Payload specs
 *
 * @type {readonly PayloadSpec[]}
 */
export const SPECS = Object.freeze(/** @type {const} */ (['dlg', 'inv']))

const PAYLOAD_TAG_REGEX = /^ucan\/([^@/]+)@(.+)$/

/**
 * Parse and validate a payload tag (`ucan/<spec>@<version>`)
 *
 * @param {string} tag
 */
export function parsePayloadTag(tag) {
  const match = PAYLOAD_TAG_REGEX.exec(tag)
  if (!match) {
    throw new TypeError(
      `Invalid payload tag "${tag}" expected "ucan/<spec>@<version>"`
    )
  }
  const spec = /** @type {PayloadSpec} */ (match[1])
  const version = match[2]
  if (!SPECS.includes(spec)) {
    throw new TypeError(
      `Unsupported payload tag spec "${spec}" in "${tag}" expected one of: ${SPECS.join(', ')}`
    )
  }
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new TypeError(
      `Unsupported payload tag version "${version}" in "${tag}" expected one of: ${SUPPORTED_VERSIONS.join(', ')}`
    )
  }

  return { tag: /** @type {PayloadTag} */ (tag), spec, version }
}

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

  const { tag: payloadTag } = parsePayloadTag(
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
 * Validate a decoded signature payload (`{ h, "ucan/<spec>@<version>": payload }`)
 *
 * @see https://github.com/ucan-wg/spec#envelope
 * @param {unknown} sigPayload
 */
function parseSignaturePayload(sigPayload) {
  if (!isObject(sigPayload)) {
    throw new TypeError(
      `Invalid signature payload expected object got ${Array.isArray(sigPayload) ? 'array' : typeof sigPayload}`
    )
  }
  const keys = Object.keys(sigPayload)
  if (keys.length !== 2) {
    throw new TypeError(
      `Invalid signature payload expected 2 keys (h and payload tag) got ${keys.length}: ${keys.join(', ')}`
    )
  }
  if (!keys.includes('h')) {
    throw new TypeError('Invalid signature payload missing h')
  }
  const { tag, spec, version } = parsePayloadTag(
    /** @type {string} */ (keys.find((key) => key !== 'h'))
  )
  // DAG-CBOR sorts map keys by length first, so `h` must be the first key.
  if (keys[0] !== 'h') {
    throw new TypeError(
      'Invalid signature payload keys are not in canonical DAG-CBOR order'
    )
  }

  const header = sigPayload.h
  if (!(header instanceof Uint8Array)) {
    throw new TypeError('Invalid signature payload h expected bytes')
  }
  const { alg, enc } = varsig.decode(header)
  if (enc !== 'DAG-CBOR') {
    throw new TypeError(
      `Unsupported varsig payload encoding ${enc} expected DAG-CBOR`
    )
  }

  const payload = sigPayload[tag]
  if (!isObject(payload)) {
    throw new TypeError(`Invalid signature payload ${tag} expected object`)
  }

  return {
    alg,
    enc,
    spec,
    version,
    payload: /** @type {Payload} */ (/** @type {unknown} */ (payload)),
  }
}

/**
 * Decode and validate a signature payload
 *
 * @param {Uint8Array} bytes
 */
export function decodeSignaturePayload(bytes) {
  return parseSignaturePayload(cbor.decode(bytes))
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

  const decoded = cbor.decode(envelope)

  if (!Array.isArray(decoded) || decoded.length !== 2) {
    throw new TypeError(
      `Invalid envelope expected array of 2 elements [signature, signature payload] got ${Array.isArray(decoded) ? `array of ${decoded.length} elements` : typeof decoded}`
    )
  }

  const [signature, sigPayload] = decoded
  if (!(signature instanceof Uint8Array)) {
    throw new TypeError('Invalid envelope signature expected bytes')
  }

  const { alg, enc, spec, version, payload } = parseSignaturePayload(sigPayload)

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
