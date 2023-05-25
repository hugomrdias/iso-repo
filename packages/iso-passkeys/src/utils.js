const supportsWebauthn =
  'PublicKeyCredential' in globalThis &&
  typeof globalThis.PublicKeyCredential === 'function'

export const supports = {
  credentials: 'credentials' in navigator,
  webauthn: supportsWebauthn,
  conditionalMediation:
    supportsWebauthn &&
    'isConditionalMediationAvailable' in globalThis.PublicKeyCredential &&
    globalThis.PublicKeyCredential.isConditionalMediationAvailable(),
  platformAuthenticator:
    supportsWebauthn &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in
      globalThis.PublicKeyCredential,
}
