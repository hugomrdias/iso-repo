import { CID } from 'multiformats/cid'

type Blockstore = {
  get: (cid: CID) => Uint8Array | Promise<Uint8Array>
  put: (cid: CID, bytes: Uint8Array) => CID | Promise<CID> | undefined
}

export function createIpfsIdentityStorage(ipfs: { blockstore: Blockstore }) {
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
