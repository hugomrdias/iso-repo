/**
 * WebAuthn Varsig - Public API.
 */

export {
  WEBAUTHN_ED25519,
  WEBAUTHN_P256,
  ED25519_PUB,
  P256_PUB,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  INNER_EDDSA,
  INNER_ECDSA,
  CURVE_ED25519,
  CURVE_P256,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  PAYLOAD_ENCODING_RAW,
  WEBAUTHN_WRAPPER,
  ALGORITHM_TO_MULTICODEC,
  MULTICODEC_TO_ALGORITHM,
  isWebAuthnMulticodec,
  getAlgorithm,
} from './multicodec.js'

export { encodeWebAuthnVarsigV1, validateWebAuthnAssertion } from './encoder.js'

export { decodeWebAuthnVarsigV1, parseClientDataJSON } from './decoder.js'

export {
  verifyWebAuthnAssertion,
  reconstructSignedData,
  verifyEd25519Signature,
  verifyP256Signature,
} from './verifier.js'

export {
  varintEncode,
  varintDecode,
  concat,
  base64urlToBytes,
  bytesToBase64url,
  bytesEqual,
} from './utils.js'
