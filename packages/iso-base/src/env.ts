declare global {
  interface Uint8Array {
    toHex(): string
    toBase64(options?: {
      alphabet?: 'base64' | 'base64url'
      omitPadding?: boolean
    }): string
  }

  interface Uint8ArrayConstructor {
    fromHex(base16: string): Uint8Array
    fromBase64(
      base64: string,
      options?: {
        alphabet?: 'base64' | 'base64url'
        lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial'
      }
    ): Uint8Array
  }
}

export {}
