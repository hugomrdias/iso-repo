import * as wn from 'webnative'
import { utf8 } from 'iso-base/utf8'
import * as Session from 'webnative/session'
import { WebnativePasskey } from './wn-passkey.js'
import { defaultConfig, defaultWebauthnConfig } from './common.js'
import { credentialsCreate, credentialsGet } from '../webauthn/api.js'
import { set, get } from 'idb-keyval'

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

/**
 * @param {string} username
 * @param {any} config
 */
export async function isUsernameAvailable(username, config = defaultConfig) {
  const program = await wn.program(defaultConfig)

  if (!(await program.auth.isUsernameValid(username))) {
    throw new Error('Invalid username')
  }

  return program.auth.isUsernameAvailable(username)
}

/**
 * @param {string} username
 */
export async function register(username) {
  const salt1 = utf8.decode(defaultWebauthnConfig.salt)
  const salt2 = utf8.decode(defaultWebauthnConfig.salt + '2')

  const credential = await credentialsCreate({
    publicKey: {
      challenge: defaultWebauthnConfig.challenge,
      rp: {
        name: document.location.host,
        // id: document.location.host,
      },
      user: {
        id: username,
        name: username,
        displayName: username,
      },
      attestation: 'none',
      authenticatorSelection: {
        userVerification: 'required',
        requireResidentKey: true,
        residentKey: 'required',
      },
      extensions: {
        credProps: true,
        largeBlob: {
          support: 'preferred',
        },
        prf: {
          eval: {
            first: salt1.buffer,
            second: salt2.buffer,
          },
        },
      },
    },
  })

  if (credential.clientExtensionResults.prf?.enabled === false) {
    throw new Error('PRF not supported.')
  }

  await set(username, { credential, username })

  const assertion = await credentialsGet({
    publicKey: {
      challenge: defaultWebauthnConfig.challenge,
      allowCredentials: [credential],
      userVerification: 'required',
      //   rpId: document.location.host,
      extensions: {
        largeBlob: {
          // read: true,
          write: utf8.decode('hello world').buffer,
        },
        prf: {
          eval: {
            first: salt1.buffer,
            second: salt2.buffer,
          },
        },
      },
    },
  })

  // @ts-ignore
  const key = assertion.clientExtensionResults.prf.results.first
  const wnPasskey = await WebnativePasskey.create(key, defaultConfig)
  const program = await wnPasskey.defaultProgram()

  // Create an account UCAN
  const accountUcan = await wn.ucan.build({
    dependencies: { crypto: wnPasskey.crypto },
    potency: 'APPEND',
    resource: '*',
    lifetimeInSeconds: 60 * 60 * 24 * 30 * 12 * 1000, // 1000 years

    audience: await wn.did.ucan(wnPasskey.crypto),
    issuer: wnPasskey.did(),
  })

  // Save account UCAN
  await program.components.storage.setItem(
    program.components.storage.KEYS.ACCOUNT_UCAN,
    wn.ucan.encode(accountUcan)
  )

  // Register user with passkey
  const passkeyProgram = await wnPasskey.program()
  const { success } = await passkeyProgram.auth.register({
    username,
  })
  if (!success) throw new Error('Failed to register user')

  await Session.provide(program.components.storage, {
    type: program.auth.implementation.type,
    username,
  })

  return program.auth.session()
}

/**
 * @param {string} username
 */
export async function login(username) {
  const salt1 = utf8.decode(defaultWebauthnConfig.salt)
  const salt2 = utf8.decode(defaultWebauthnConfig.salt + '2')
  const credential = await get(username)
  const assertion = await credentialsGet({
    publicKey: {
      challenge: defaultWebauthnConfig.challenge,
      allowCredentials: credential ? [credential.credential] : [],
      userVerification: 'required',
      //   rpId: document.location.host,
      extensions: {
        // largeBlob: {
        //   // read: true,
        //   write: utf8.decode('hello world').buffer,
        // },
        prf: {
          eval: {
            first: salt1.buffer,
            second: salt2.buffer,
          },
        },
      },
    },
  })

  // @ts-ignore
  const key = assertion.clientExtensionResults.prf.results.first
  const wnPasskey = await WebnativePasskey.create(key, defaultConfig)
  const program = await wnPasskey.defaultProgram()

  let session = program.session
  if (!session) {
    // Create an account UCAN
    const accountUcan = await wn.ucan.build({
      dependencies: { crypto: wnPasskey.crypto },
      potency: 'APPEND',
      resource: '*',
      lifetimeInSeconds: 60 * 60 * 24 * 30 * 12 * 1000, // 1000 years

      audience: await wn.did.ucan(wnPasskey.crypto),
      issuer: wnPasskey.did(),
    })

    // Save account UCAN
    await program.components.storage.setItem(
      program.components.storage.KEYS.ACCOUNT_UCAN,
      wn.ucan.encode(accountUcan)
    )

    await Session.provide(program.components.storage, {
      type: program.auth.implementation.type,
      username,
    })

    session = await program.auth.session()
  }

  return session
}
