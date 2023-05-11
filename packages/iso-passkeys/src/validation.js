import * as ed from '@noble/ed25519'
import { ECDSASigValue } from '@peculiar/asn1-ecc'
import { AsnParser } from '@peculiar/asn1-schema'
import { base64url } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'
import {
  COSEKEYS_MAP,
  getCoseKeyType,
  hash,
  mapCoseAlgToWebCryptoAlg,
} from './cose.js'

/**
 * @typedef {{ authenticatorDataBytes: Uint8Array, clientDataBytes: Uint8Array, signature:Uint8Array }} AuthData
 */

/**
 * In WebAuthn, EC2 signatures are wrapped in ASN.1 structure so we need to peel r and s apart.
 *
 * See https://www.w3.org/TR/webauthn-2/#sctn-signature-attestation-types
 *
 * @param {Uint8Array} signature
 */
export function unwrapEC2Signature(signature) {
  const parsedSignature = AsnParser.parse(signature, ECDSASigValue)
  let rBytes = new Uint8Array(parsedSignature.r)
  let sBytes = new Uint8Array(parsedSignature.s)

  if (shouldRemoveLeadingZero(rBytes)) {
    rBytes = rBytes.slice(1)
  }

  if (shouldRemoveLeadingZero(sBytes)) {
    sBytes = sBytes.slice(1)
  }

  const finalSignature = concat([rBytes, sBytes])

  return finalSignature
}

/**
 * Determine if the DER-specific `00` byte at the start of an ECDSA signature byte sequence
 * should be removed based on the following logic:
 *
 * "If the leading byte is 0x0, and the the high order bit on the second byte is not set to 0,
 * then remove the leading 0x0 byte"
 *
 * @param {Uint8Array} bytes
 */
function shouldRemoveLeadingZero(bytes) {
  return bytes[0] === 0x0 && (bytes[1] & (1 << 7)) !== 0
}

/**
 * Validate EC2 signature
 *
 * @param {AuthData} data
 * @param {import('./types').COSEPublicKeyEC2} key
 */
export async function validateEC2(data, key) {
  const { authenticatorDataBytes, clientDataBytes, signature } = data

  const clientDataHash = await hash(clientDataBytes)
  const sigBase = concat([authenticatorDataBytes, clientDataHash])
  const unwrappedSig = unwrapEC2Signature(signature)

  const alg = key[COSEKEYS_MAP.alg]
  const x = key[COSEKEYS_MAP.x]
  const y = key[COSEKEYS_MAP.y]

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64url.encode(x),
      y: base64url.encode(y),
      // ext: false,
    },
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  )

  const verified = await globalThis.crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: {
        name: mapCoseAlgToWebCryptoAlg(alg),
      },
    },
    cryptoKey,
    unwrappedSig,
    sigBase
  )
  return verified
}

/**
 * Validate OKP signature
 *
 * @param {AuthData} data
 * @param {import('./types').COSEPublicKeyOKP} key
 */
export async function validateOKP(data, key) {
  const { authenticatorDataBytes, clientDataBytes, signature } = data

  const clientDataHash = await hash(clientDataBytes)
  const sigBase = concat([authenticatorDataBytes, clientDataHash])

  const crv = key[COSEKEYS_MAP.crv]
  const x = key[COSEKEYS_MAP.x]

  if (crv !== 6) {
    throw new Error(`unsupported curve ${crv}`)
  }

  return ed.verifyAsync(signature, sigBase, x)
}

/**
 * @param {AuthData} data
 * @param {import("./types").COSEPublicKey} pubKey
 */
export async function validateAuth(data, pubKey) {
  const keyType = getCoseKeyType(pubKey)

  switch (keyType) {
    case 'EC2': {
      return validateEC2(
        data,
        /** @type {import('./types').COSEPublicKeyEC2} */ (pubKey)
      )
    }
    case 'OKP': {
      return validateOKP(
        data,
        /** @type {import('./types').COSEPublicKeyOKP} */ (pubKey)
      )
    }

    default: {
      throw new Error('cose key type not supported')
    }
  }
}
