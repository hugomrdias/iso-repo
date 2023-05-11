import * as odd from '@oddjs/odd'
import * as Manners from './manners.js'
import * as Auth from './auth.js'

export * as Crypto from './crypto.js'
export * as Auth from './auth.js'
export * as Manners from './manners.js'

/**
 * Create Odd Passkey components
 *
 * @param {import('@oddjs/odd').Configuration} config
 */
export async function createComponents(config) {
  const storage = odd.defaultStorageComponent(config)
  const crypto = await odd.defaultCryptoComponent(config)
  const manners = Manners.implementation(config, storage)
  const reference = await odd.defaultReferenceComponent({
    crypto,
    manners,
    storage,
  })
  const auth = Auth.implementation({
    crypto,
    reference,
    storage,
    config,
  })

  return {
    auth,
    crypto,
    manners,
    storage,
    reference,
  }
}
