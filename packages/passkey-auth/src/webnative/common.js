export const defaultConfig = {
  namespace: {
    creator: document.location.host,
    name: 'Passkey auth',
  },
  debug: true,
  debugging: {
    injectIntoGlobalContext: true,
  },
}

export const defaultWebauthnConfig = {
  challenge: 'somechallengestring',
  salt: 'webauthn-passkey-prf-salt',
}
