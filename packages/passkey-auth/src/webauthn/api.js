import { abortService } from './abort.js'
import {
  parseAuthenticationCredential,
  parseCreationOptionsFromJSON,
  parseRegistrationCredential,
  parseRequestOptionsFromJSON,
} from './parsing.js'
import { supports } from './utils.js'

const credentials =
  /** @type {import('./types').PublicKeyCredentialsContainer} */ (
    navigator.credentials
  )

/**
 * Executes Request a Credential algorithm
 *
 * @see https://w3c.github.io/webappsec-credential-management/#algorithm-request
 *
 * @param {import('./types').CredentialRequestOptionsJSON} [options]
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
 * Executes Create a Credential algorithm
 *
 * @see https://w3c.github.io/webappsec-credential-management/#algorithm-create
 * @param {import('./types').CredentialCreationOptionsJSON} options
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
