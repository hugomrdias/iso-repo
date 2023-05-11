import * as odd from '@oddjs/odd'
import * as RootKey from '@oddjs/odd/common/root-key'
import * as FileSystemProtocol from '@oddjs/odd/fs/protocol/basic'
import PublicFile from '@oddjs/odd/fs/v1/PublicFile'
import PublicTree from '@oddjs/odd/fs/v1/PublicTree'
import * as PasskeyCrypto from './crypto.js'

export const READ_KEY_PATH = odd.path.file(
  odd.path.RootBranch.Public,
  '.well-known',
  'read-key'
)

/**
 * @param {import('@oddjs/odd').Configuration} config
 * @param {import('@oddjs/odd/components/storage/implementation').Implementation} storage
 *
 * @returns {import('@oddjs/odd/components/manners/implementation').Implementation}
 */
export function implementation(config, storage) {
  const defaultManners = odd.defaultMannersComponent(config)

  return {
    ...defaultManners,
    fileSystem: {
      hooks: {
        ...defaultManners.fileSystem.hooks,
        afterLoadNew: async (fs, account, dataComponents) => {
          const readKey = await RootKey.retrieve({
            crypto: dataComponents.crypto,
            accountDID: account.rootDID,
          })

          const encryptionKey = await storage.getItem('passkey/encryption-key')
          await fs.write(
            READ_KEY_PATH,
            await PasskeyCrypto.encrypt(readKey, encryptionKey)
          )

          return defaultManners.fileSystem.hooks.afterLoadNew(
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

          const links = await FileSystemProtocol.getSimpleLinks(depot, dataRoot)
          const publicCid = odd.decodeCID(links.public.cid)
          const publicTree = await PublicTree.fromCID(
            depot,
            reference,
            publicCid
          )
          const unwrappedPath = odd.path.unwrap(READ_KEY_PATH)
          const publicPath = unwrappedPath.slice(1)
          const readKeyChild = await publicTree.get(publicPath)

          if (!readKeyChild) {
            throw new Error(
              `Expected an encrypted read key at: ${odd.path.log(publicPath)}`
            )
          }

          if (!PublicFile.instanceOf(readKeyChild)) {
            throw new Error(
              `Did not expect a tree at: ${odd.path.log(publicPath)}`
            )
          }

          const encryptionKey = await storage.getItem('passkey/encryption-key')
          const encryptedRootKey = readKeyChild.content
          const rootKey = await PasskeyCrypto.decrypt(
            encryptedRootKey,
            encryptionKey
          )

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
