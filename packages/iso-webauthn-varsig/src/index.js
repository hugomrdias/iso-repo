/**
 * WebAuthn Varsig - Public API.
 */

export { decodeWebAuthnVarsigV1, parseClientDataJSON } from './decoder.js'

export { encodeWebAuthnVarsigV1, validateWebAuthnAssertion } from './encoder.js'
export {
  ALGORITHM_TO_MULTICODEC,
  CURVE_ED25519,
  CURVE_P256,
  ED25519_PUB,
  getAlgorithm,
  INNER_ECDSA,
  INNER_EDDSA,
  isWebAuthnMulticodec,
  MULTICODEC_TO_ALGORITHM,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  P256_PUB,
  PAYLOAD_ENCODING_RAW,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  WEBAUTHN_ED25519,
  WEBAUTHN_P256,
  WEBAUTHN_WRAPPER,
} from './multicodec.js'
export {
  base64urlToBytes,
  bytesEqual,
  bytesToBase64url,
  concat,
  varintDecode,
  varintEncode,
} from './utils.js'
export {
  reconstructSignedData,
  verifyEd25519Signature,
  verifyP256Signature,
  verifyWebAuthnAssertion,
} from './verifier.js'
