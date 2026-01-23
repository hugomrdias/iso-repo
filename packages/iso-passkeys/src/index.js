import { abortService } from './abort.js'
import {
  parseAuthenticationCredential,
  parseCreationOptionsFromJSON,
  parseRegistrationCredential,
  parseRequestOptionsFromJSON,
  parseAttestationObject,
} from './parsing.js'
import { unwrapEC2Signature } from './validation.js'
import { supports } from './utils.js'

export { supports } from './utils.js'
export { parseAttestationObject } from './parsing.js'
export { unwrapEC2Signature } from './validation.js'

const credentials =
  /** @type {import('./types.js').PublicKeyCredentialsContainer} */ (
    navigator.credentials
  )

/**
 * Requests a PublicKeyCredential
 *
 * @see https://w3c.github.io/webappsec-credential-management/#algorithm-request
 *
 * @param {import('./types.js').CredentialRequestOptionsJSON} [options]
 */
export async function credentialsGet(options) {
  if (!supports.webauthn) {
    throw new Error('Webauthn not supported.')
  }

  if (options?.mediation === 'conditional') {
    if (!supports.conditionalMediation) {
      throw new Error('Conditional mediation not supported.')
    }

    if (options.publicKey?.allowCredentials?.length !== 0) {
      throw new Error('Conditional mediation require empty allow credentials.')
    }

    const webauthnInputs = document.querySelectorAll(
      "input[autocomplete*='webauthn']"
    )

    // WebAuthn autofill requires at least one valid input
    if (webauthnInputs.length === 0) {
      throw new Error(
        'Conditional mediation at least one input with `"webauthn"` in its `autocomplete` attribute.'
      )
    }
  }

  const credential = await credentials.get({
    mediation: options?.mediation,
    signal: options?.signal ?? abortService.createSignal(),
    publicKey: options?.publicKey
      ? parseRequestOptionsFromJSON(options?.publicKey)
      : undefined,
  })

  if (!credential) {
    throw new Error('Authentication failed.')
  }

  return parseAuthenticationCredential(credential)
}

/**
 * Creates a PublicKeyCredential
 *
 * @see https://w3c.github.io/webappsec-credential-management/#algorithm-create
 *
 * @param {import('./types.js').CredentialCreationOptionsJSON} options
 */
export async function credentialsCreate(options) {
  if (!supports.webauthn) {
    throw new Error('Webauthn not supported.')
  }
  const credential = await credentials.create({
    signal: options?.signal ?? abortService.createSignal(),
    publicKey: options?.publicKey
      ? parseCreationOptionsFromJSON(options?.publicKey)
      : undefined,
  })

  if (!credential) {
    throw new Error('Registration failed.')
  }

  return parseRegistrationCredential(credential)
}
