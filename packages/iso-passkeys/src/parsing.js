/** biome-ignore-all lint/suspicious/noAssignInExpressions: needed */
import { base64url } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { cbor, cborStable } from './cbor.js'

/**
 * Parse AttestationObject as CBOR
 *
 * @param {ArrayBuffer} buf
 */
export function parseAttestationObject(buf) {
  const o = cbor.decode(new Uint8Array(buf))

  return /** @type {import('./types').AttestationObject} */ ({
    fmt: o.fmt,
    attSmt: o.attSmt,
    authData: parseAuthenticatorData(o.authData),
  })
}

/**
 * Parse credential.response.getAuthenticatorData() return by navigator.credentials.create()
 *
 * @see https://w3c.github.io/webauthn/#sctn-authenticator-data
 *
 * @param {Uint8Array} data
 */
export function parseAuthenticatorData(data) {
  if (data.byteLength < 37) {
    throw new Error(
      `Authenticator data has ${data.byteLength} bytes, expected at least 37 bytes.`
    )
  }
  let pointer = 0

  const dataView = new DataView(data.buffer, data.byteOffset, data.length)
  const rpIdHash = data.slice(pointer, (pointer += 32))
  const flagsBytes = data.slice(pointer, (pointer += 1))
  const flagsInt = flagsBytes[0]

  // Bit positions can be referenced here:
  // https://www.w3.org/TR/webauthn-2/#flags
  const flags = {
    // eslint-disable-next-line unicorn/prefer-math-trunc
    up: Boolean(flagsInt & (1 << 0)), // User Presence
    uv: Boolean(flagsInt & (1 << 2)), // User Verified
    be: Boolean(flagsInt & (1 << 3)), // Backup Eligibility
    bs: Boolean(flagsInt & (1 << 4)), // Backup State
    at: Boolean(flagsInt & (1 << 6)), // Attested Credential Data Present
    ed: Boolean(flagsInt & (1 << 7)), // Extension Data Present
    flagsInt,
  }

  const signCountBytes = data.slice(pointer, pointer + 4)
  const signCount = dataView.getUint32(pointer, false)
  pointer += 4

  /** @type {Uint8Array | undefined} */
  let aaguid
  /** @type {Uint8Array | undefined} */
  let credentialID
  /** @type {Uint8Array | undefined} */
  let credentialPublicKeyBytes
  /** @type {import('./types').COSEPublicKey | undefined} */
  let credentialPublicKey

  if (flags.at) {
    aaguid = data.slice(pointer, (pointer += 16))

    const credIDLen = dataView.getUint16(pointer)
    pointer += 2

    credentialID = data.slice(pointer, (pointer += credIDLen))

    // Decode the next CBOR item in the buffer, then re-encode it back to a Buffer
    const bytes = data.slice(pointer)
    const firstDecoded = cborStable.decode(bytes)
    const firstEncoded = cborStable.encode(firstDecoded)

    credentialPublicKeyBytes = firstEncoded

    // TODO parse into a human readable json
    credentialPublicKey = cbor.decode(credentialPublicKeyBytes)

    pointer += firstEncoded.byteLength
  }

  let extensionsData
  let extensionsDataBytes

  if (flags.ed) {
    const firstDecoded = cborStable.decode(data.slice(pointer))
    extensionsDataBytes = cborStable.encode(firstDecoded)
    extensionsData = cbor.decode(extensionsDataBytes)
    pointer += extensionsDataBytes.byteLength
  }

  // Pointer should be at the end of the authenticator data, otherwise too much data was sent
  if (data.byteLength > pointer) {
    throw new Error('Leftover bytes detected while parsing authenticator data')
  }

  return {
    rpIdHash,
    flagsBytes,
    flags,
    signCountBytes,
    signCount,
    aaguid,
    credentialID,
    credentialPublicKey,
    credentialPublicKeyBytes,
    extensionsData,
    extensionsDataBytes,
  }
}

/**
 * Parse CredentialDescriptor as JSON
 *
 * @param {import('./types').PublicKeyCredentialDescriptorJSON} descriptor
 * @returns {PublicKeyCredentialDescriptor}
 */
export function toPublicKeyCredentialDescriptor(descriptor) {
  const { id } = descriptor

  return {
    ...descriptor,
    id: base64url.decode(id),
  }
}

/**
 * Parse CredentialRequestOptions as JSON
 *
 * @see https://w3c.github.io/webauthn/#sctn-parseRequestOptionsFromJSON
 * @param {import('./types').PublicKeyCredentialRequestOptionsJSON} options
 * @returns {PublicKeyCredentialRequestOptions}
 */
export function parseRequestOptionsFromJSON(options) {
  let allowCredentials
  if (options.allowCredentials?.length !== 0) {
    allowCredentials = options.allowCredentials?.map(
      toPublicKeyCredentialDescriptor
    )
  }
  return {
    challenge: base64url.decode(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    allowCredentials,
    userVerification: options.userVerification,
    extensions: options.extensions,
  }
}

/**
 * Parse CredentialCreationOptions as JSON
 *
 * @see https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON
 * @param {import('./types').PublicKeyCredentialCreationOptionsJSON} options
 * @returns {PublicKeyCredentialCreationOptions}
 */
export function parseCreationOptionsFromJSON(options) {
  let excludeCredentials
  if (options.excludeCredentials?.length !== 0) {
    excludeCredentials = options.excludeCredentials?.map(
      toPublicKeyCredentialDescriptor
    )
  }

  return {
    pubKeyCredParams: [-8, -7, -257].map((id) => ({
      alg: id,
      type: 'public-key',
    })),
    ...options,
    challenge: base64url.decode(options.challenge),
    user: {
      ...options.user,
      id: utf8.decode(options.user.id),
    },

    excludeCredentials,
  }
}

/**
 * Public Key Credential to JSON
 *
 * TODO: either split into to functions or make the return types match the input
 *
 * @see https://w3c.github.io/webauthn/#dom-publickeycredential-tojson
 * @param {import('./types').AuthenticationPublicKeyCredential | import('./types').RegistrationPublicKeyCredential} credential
 */
export function publicKeyCredentialToJSON(credential) {
  // @ts-ignore
  if (credential.response.signature) {
    const { rawId, id, type, authenticatorAttachment, response } =
      /** @type {import('./types').AuthenticationPublicKeyCredential} */ (
        credential
      )
    /** @type {import('./types').AuthenticationResponseJSON} */
    const rsp = {
      id,
      rawId: base64url.encode(new Uint8Array(rawId)),
      type,
      authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        authenticatorData: base64url.encode(
          new Uint8Array(response.authenticatorData)
        ),
        clientDataJSON: base64url.encode(
          new Uint8Array(response.clientDataJSON)
        ),
        signature: base64url.encode(new Uint8Array(response.signature)),
        userHandle: response.userHandle
          ? utf8.encode(new Uint8Array(response.userHandle))
          : undefined,
      },
    }

    return rsp
  }
  const { rawId, id, type, authenticatorAttachment, response } =
    /** @type {import('./types').RegistrationPublicKeyCredential} */ (
      credential
    )
  /** @type {import('./types').RegistrationResponseJSON} */
  const rsp = {
    id,
    rawId: base64url.encode(new Uint8Array(rawId)),
    type,
    authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: base64url.encode(new Uint8Array(response.clientDataJSON)),
      attestationObject: base64url.encode(
        new Uint8Array(response.attestationObject)
      ),
      // @ts-ignore
      transports: response.getTransports(),
    },
  }
  return rsp
}

/**
 *
 * @param {import('./types').RegistrationPublicKeyCredential} credential
 */
export function parseRegistrationCredential(credential) {
  /** @type {import('./types').CollectedClientData} */
  const clientData = JSON.parse(
    utf8.encode(new Uint8Array(credential.response.clientDataJSON))
  )

  return {
    id: credential.id,
    clientData,
    attestationObject: parseAttestationObject(
      credential.response.attestationObject
    ),
    transports: credential.response.getTransports(),
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    type: credential.type,
  }
}

/**
 *
 * @param {import('./types').AuthenticationPublicKeyCredential} credential
 */
export function parseAuthenticationCredential(credential) {
  /** @type {import('./types').CollectedClientData} */
  const clientData = JSON.parse(
    utf8.encode(new Uint8Array(credential.response.clientDataJSON))
  )

  return {
    id: credential.id,
    clientData,
    clientDataBytes: new Uint8Array(credential.response.clientDataJSON),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    authenticatorData: parseAuthenticatorData(
      new Uint8Array(credential.response.authenticatorData)
    ),
    authenticatorDataBytes: new Uint8Array(
      credential.response.authenticatorData
    ),
    clientExtensionResults: credential.getClientExtensionResults(),
    signature: new Uint8Array(credential.response.signature),
    userHandle: credential.response.userHandle
      ? utf8.encode(new Uint8Array(credential.response.userHandle))
      : undefined,
  }
}
