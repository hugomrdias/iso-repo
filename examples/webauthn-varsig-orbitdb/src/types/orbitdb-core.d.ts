declare module '@orbitdb/core' {
  export function createOrbitDB(options: {
    ipfs: unknown
    identity?: unknown
    identities?: unknown
  }): Promise<{
    open: (name: string, options?: Record<string, unknown>) => Promise<unknown>
  }>

  export function IPFSAccessController(options: { write: string[] }): unknown
}
