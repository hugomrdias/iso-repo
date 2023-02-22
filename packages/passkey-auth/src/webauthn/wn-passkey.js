import * as DID from '@ipld/dag-ucan/did'
import * as ed from '@noble/ed25519'
import { concat, u8, utf8 } from 'iso-base'
import { webcrypto } from 'iso-base/crypto'

import * as Webnative from 'webnative'
import { decodeCID } from 'webnative'
import * as RootKey from 'webnative/common/root-key'
import * as BrowserCrypto from 'webnative/components/crypto/implementation/browser'
import * as WebnativeManners from 'webnative/components/manners/implementation/base'
import * as FileSystemProtocol from 'webnative/fs/protocol/basic'
import PublicFile from 'webnative/fs/v1/PublicFile'
import PublicTree from 'webnative/fs/v1/PublicTree'
import { ED25519_DID_PREFIX } from './cose.js'

export const READ_KEY_PATH = Webnative.path.file(
  Webnative.path.RootBranch.Public,
  '.well-known',
  'read-key'
)
export class WebnativePasskey {
  /**
   *
   * @param {object} opts
   * @param {CryptoKey} opts.encryptionKey
   * @param {Uint8Array} opts.signingKey
   * @param {Uint8Array} opts.publicKey
   * @param {import('webnative/components/crypto/implementation.js').Implementation} opts.defaultCrypto
   * @param {import('webnative').Manners.Implementation} opts.defaultManners
   * @param {import('webnative').Configuration} opts.configuration
   */
  constructor(opts) {
    this.opts = opts
  }

  /**
   * @param {ArrayBuffer} keyMaterial
   * @param {import('webnative').Configuration} configuration
   */
  static async create(keyMaterial, configuration) {
    const inputKeyMaterial = new Uint8Array(keyMaterial)

    // import key material
    const keyDerivationKey = await crypto.subtle.importKey(
      'raw',
      inputKeyMaterial,
      'HKDF',
      false,
      ['deriveKey']
    )

    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        info: utf8.decode('webnative-passkey'),
        salt: new Uint8Array(), // TODO more salt
        hash: 'SHA-256',
      },
      keyDerivationKey,
      { name: 'AES-GCM', length: 256 },
      // No need for exportability because we can deterministically
      // recreate this key
      true,
      ['encrypt', 'decrypt']
    )

    return new WebnativePasskey({
      encryptionKey,
      signingKey: inputKeyMaterial,
      publicKey: await ed.getPublicKey(inputKeyMaterial),
      defaultCrypto: await BrowserCrypto.implementation({
        storeName: Webnative.namespace(configuration),
        exchangeKeyName: 'exchange-key',
        writeKeyName: 'write-key',
      }),
      defaultManners: WebnativeManners.implementation({ configuration }),
      configuration,
    })
  }

  /** @type {import('webnative/components/crypto/implementation.js').Implementation['did']['keyTypes']} */
  get keyTypes() {
    return {
      ed25519: {
        magicBytes: ED25519_DID_PREFIX,
        verify: this.verify,
      },
    }
  }

  async getAlgorithm() {
    return 'ed25519'
  }

  async getUcanAlgorithm() {
    return 'EdDSA'
  }

  async publicWriteKey() {
    return this.opts.publicKey
  }

  did() {
    return DID.format(
      DID.decode(
        // eslint-disable-next-line unicorn/prefer-spread
        concat([ED25519_DID_PREFIX, this.opts.publicKey])
      )
    )
  }

  /**
   *
   * @param {Uint8Array} data
   */
  async encrypt(data) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12))

    const encrypted = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.opts.encryptionKey,
      data
    )

    return concat([iv, u8(encrypted)])
  }

  /**
   *
   * @param {Uint8Array} data
   */
  async decrypt(data) {
    const iv = data.slice(0, 12)
    const encrypted = data.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.opts.encryptionKey,
      encrypted
    )

    return u8(decrypted)
  }

  /**
   * @param {string | Uint8Array} data
   */
  sign(data) {
    return ed.sign(data, this.opts.signingKey)
  }

  /**
   *
   * @param {import('webnative/components/crypto/implementation.js').VerifyArgs} opts
   */
  verify(opts) {
    return ed.verify(
      opts.signature,
      opts.message,
      opts.publicKey || this.opts.publicKey
    )
  }

  /**
   * @type {import('webnative').Crypto.Implementation}
   */
  get crypto() {
    return {
      aes: this.opts.defaultCrypto.aes,
      hash: this.opts.defaultCrypto.hash,
      misc: this.opts.defaultCrypto.misc,
      rsa: this.opts.defaultCrypto.rsa,
      did: {
        keyTypes: {
          ...this.opts.defaultCrypto.did.keyTypes,
          ...this.keyTypes,
        },
      },
      keystore: {
        clearStore: this.opts.defaultCrypto.keystore.clearStore,
        exportSymmKey: this.opts.defaultCrypto.keystore.exportSymmKey,
        importSymmKey: this.opts.defaultCrypto.keystore.importSymmKey,
        keyExists: this.opts.defaultCrypto.keystore.keyExists,
        publicExchangeKey: this.opts.defaultCrypto.keystore.publicExchangeKey,

        // decrypt: this.opts.defaultCrypto.keystore.decrypt,
        decrypt: this.decrypt.bind(this),
        getAlgorithm: this.getAlgorithm,
        getUcanAlgorithm: this.getUcanAlgorithm,
        publicWriteKey: this.publicWriteKey.bind(this),
        sign: this.sign.bind(this),
      },
    }
  }

  /**
   * @type {import('webnative').Manners.Implementation}
   */
  get manners() {
    return {
      ...this.opts.defaultManners,
      fileSystem: {
        ...this.opts.defaultManners.fileSystem,
        hooks: {
          ...this.opts.defaultManners.fileSystem.hooks,
          afterLoadNew: async (
            /** @type {import('webnative/fs/types').API} */ fs,
            /** @type {import('webnative/fs/types').AssociatedIdentity} */ account,
            /** @type {import('webnative').Manners.DataComponents} */ dataComponents
          ) => {
            const readKey = await RootKey.retrieve({
              crypto: dataComponents.crypto,
              accountDID: account.rootDID,
            })

            await fs.write(READ_KEY_PATH, await this.encrypt(readKey))

            return this.opts.defaultManners.fileSystem.hooks.afterLoadNew(
              fs,
              account,
              dataComponents
            )
          },
          beforeLoadExisting: async (dataRoot, account, dataComponents) => {
            const { crypto, depot, reference } = dataComponents

            const hasRootKey = await RootKey.exists({
              crypto,
              accountDID: account.rootDID,
            })

            if (hasRootKey) {
              return
            }

            const links = await FileSystemProtocol.getSimpleLinks(
              depot,
              dataRoot
            )
            const publicCid = decodeCID(links.public.cid)
            const publicTree = await PublicTree.fromCID(
              depot,
              reference,
              publicCid
            )
            const unwrappedPath = Webnative.path.unwrap(READ_KEY_PATH)
            const publicPath = unwrappedPath.slice(1)
            const readKeyChild = await publicTree.get(publicPath)

            if (!readKeyChild) {
              throw new Error(
                `Expected an encrypted read key at: ${Webnative.path.log(
                  publicPath
                )}`
              )
            }

            if (!PublicFile.instanceOf(readKeyChild)) {
              throw new Error(
                `Did not expect a tree at: ${Webnative.path.log(publicPath)}`
              )
            }

            const encryptedRootKey = readKeyChild.content
            const rootKey = await this.decrypt(encryptedRootKey)

            await RootKey.store({
              crypto,
              accountDID: account.rootDID,
              readKey: rootKey,
            })
          },
        },
      },
    }
  }

  async program() {
    return await Webnative.program({
      ...this.opts.configuration,
      crypto: this.crypto,
      manners: this.manners,
    })
  }

  async defaultProgram() {
    return await Webnative.program({
      ...this.opts.configuration,
      crypto: this.crypto,
      manners: this.manners,
    })
  }
}
