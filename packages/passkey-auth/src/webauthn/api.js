import * as wn from 'webnative'
import { set } from 'idb-keyval'
import { abortService } from './abort.js'
import {
  parseAuthenticationCredential,
  parseCreationOptionsFromJSON,
  parseRegistrationCredential,
  parseRequestOptionsFromJSON,
} from './parsing.js'
import { WebnativePasskey } from './wn-passkey.js'
import * as Session from 'webnative/session'

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
  let credential
  try {
    credential = await credentials.get({
      mediation: options?.mediation,
      signal: options?.signal ?? abortService.createSignal(),
      publicKey: options?.publicKey
        ? parseRequestOptionsFromJSON(options?.publicKey)
        : undefined,
    })
  } catch (error) {
    // TODO error handling
    // eslint-disable-next-line no-console
    console.error(error)
  }

  if (!credential) {
    throw new Error('Authentication failed.')
  }

  const parsed = parseAuthenticationCredential(credential)
  return parsed
}

/**
 * Executes Create a Credential algorithm
 *
 * @see {https} ://w3c.github.io/webappsec-credential-management/#algorithm-create
 * @param {import('./types').CredentialCreationOptionsJSON} options
 */
export async function credentialsCreate(options) {
  let credential
  try {
    credential = await credentials.create({
      signal: options?.signal ?? abortService.createSignal(),
      publicKey: options?.publicKey
        ? parseCreationOptionsFromJSON(options?.publicKey)
        : undefined,
    })
  } catch (error) {
    // TODO error handling
    // eslint-disable-next-line no-console
    console.error(error)
  }

  if (!credential) {
    throw new Error('Registration failed.')
  }

  const parsed = parseRegistrationCredential(credential)

  // eslint-disable-next-line no-console
  console.log(parsed)

  await set('pub-key', parsed.attestationObject.authData.credentialPublicKey)

  return parsed
}

/**
 * @param {ArrayBuffer} keyMaterial
 * @param {import('webnative').Configuration} config
 * @param {string} username
 */
export async function program(keyMaterial, config, username) {
  const wnPasskey = await WebnativePasskey.create(keyMaterial, config)

  const program = await wnPasskey.defaultProgram()

  let session = program.session

  // eslint-disable-next-line no-console
  console.log(
    'username',
    await program.auth.isUsernameAvailable(username),
    program.session
  )

  const isNewUser = await program.auth.isUsernameAvailable(username)

  if (program.session) {
    session = program.session
    // await session.destroy()
  } else {
    // Create an account UCAN
    const accountUcan = await wn.ucan.build({
      dependencies: { crypto: wnPasskey.crypto },
      potency: 'APPEND',
      resource: '*',
      lifetimeInSeconds: 60 * 60 * 24 * 30 * 12 * 1000, // 1000 years

      audience: await wn.did.ucan(wnPasskey.crypto),
      issuer: wnPasskey.did(),
    })

    await program.components.storage.setItem(
      program.components.storage.KEYS.ACCOUNT_UCAN,
      wn.ucan.encode(accountUcan)
    )

    if (isNewUser) {
      const passkeyProgram = await wnPasskey.program()
      const { success } = await passkeyProgram.auth.register({
        username,
      })
      if (!success) throw new Error('Failed to register user')
    } else {
      await Session.provide(program.components.storage, {
        type: program.auth.implementation.type,
        username,
      })
    }

    session = await program.auth.session()
    program.session = session
  }

  // fs with session
  if (session && session.fs) {
    // const branch = wn.path.RootBranch.Public
    // const { fs } = session
    // console.log('ls', await fs.ls(wn.path.directory(branch)))
    // const contentPath = wn.path.file(branch, 'hello2.txt')
    // const contentPath2 = wn.path.directory(branch, 'test')
    // await fs.rm(contentPath2)
    // await fs.publish()
    // if (await fs.exists(contentPath)) {
    //   const content = new TextDecoder().decode(await fs.read(contentPath))
    //   console.log('🚀 ~ file: api.js:248 ~ program ~ content', content)
    // } else {
    //   await fs.write(contentPath, new TextEncoder().encode('hello world'))
    //   const r = await fs.publish()
    //   console.log('🚀 ~ file: api.js:175 ~ program ~ r', r.toString())
    // }
  }

  return program
}
