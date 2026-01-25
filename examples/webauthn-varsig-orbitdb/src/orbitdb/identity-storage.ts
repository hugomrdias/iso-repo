import { CID } from 'multiformats/cid'

export function createIpfsIdentityStorage(ipfs: { blockstore: { get: (cid: CID) => Promise<Uint8Array>; put: (cid: CID, bytes: Uint8Array) => Promise<void> } }) {
  return {
    get: async (hash: string) => {
      try {
        const cid = CID.parse(hash)
        return await ipfs.blockstore.get(cid)
      } catch {
        return undefined
      }
    },
    put: async (hash: string, bytes: Uint8Array) => {
      const cid = CID.parse(hash)
      await ipfs.blockstore.put(cid, bytes)
    },
  }
}
