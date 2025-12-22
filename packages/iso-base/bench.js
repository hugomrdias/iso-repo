// @ts-nocheck
/** biome-ignore-all lint/suspicious/noConsole: benckmark */

import * as scure from '@scure/base'
import { Bench } from 'tinybench'
import * as rfc4648 from './src/bases/rfc4648.js'
import * as iso from './src/index.js'

/**
 * Codecs to benchmark
 * @type {Record<string, {
 *   encode: Record<string, (buf: Uint8Array) => string>,
 *   decode: Record<string, (str: string) => Uint8Array>,
 * }>}
 */
const codecs = {
  Hex: {
    encode: {
      node: (buf) => Buffer.from(buf).toString('hex'),
      iso: (buf) => iso.Rfc4648.hex.encode(buf),
      scure: (buf) => scure.hex.encode(buf),
      web: (buf) => buf.toHex(),
    },
    decode: {
      node: (str) => Buffer.from(str, 'hex'),
      iso: (str) => iso.Rfc4648.hex.decode(str),
      scure: (str) => scure.hex.decode(str),
      web: (str) => Uint8Array.fromHex(str),
      isoNew: (str) => rfc4648.hex.decode(str),
    },
  },
  // Base64: {
  //   encode: {
  //     node: (buf) => Buffer.from(buf).toString('base64'),
  //     iso: (buf) => iso.Rfc4648.base64.encode(buf),
  //     scure: (buf) => scure.base64.encode(buf),
  //     web: (buf) => buf.toBase64(),
  //   },
  //   decode: {
  //     node: (str) => Buffer.from(str, 'base64'),
  //     iso: (str) => iso.Rfc4648.base64.decode(str),
  //     scure: (str) => scure.base64.decode(str),
  //     web: (str) => Uint8Array.fromBase64(str),
  //   },
  // },

  // UTF8: {
  //   encode: {
  //     node: (buf) => Buffer.from(buf).toString('utf8'),
  //     iso: (buf) => iso.UTF8.utf8.encode(buf),
  //   },
  //   decode: {
  //     node: (str) => Buffer.from(str, 'utf8'),
  //     iso: (str) => iso.UTF8.utf8.decode(str),
  //   },
  // },
}

// buffer title, sample count, data
const buffers = {
  '32 B': new Uint8Array(32).fill(1),
  '64 B': new Uint8Array(64).fill(1),
  '1 KB': new Uint8Array(1024).fill(2),
  '8 KB': new Uint8Array(1024 * 8).fill(3),
}
const strs = {
  '32 B': iso.Rfc4648.hex.encode(new Uint8Array(32).fill(1)),
  '64 B': iso.Rfc4648.hex.encode(new Uint8Array(64).fill(1)),
  '1 KB': iso.Rfc4648.hex.encode(new Uint8Array(1024).fill(2)),
  '8 KB': iso.Rfc4648.hex.encode(new Uint8Array(1024 * 8).fill(3)),
}

const parseSize = (sizeStr) => {
  const match = sizeStr.match(/^(\d+)\s*(B|KB)$/)
  if (!match) return 0
  const value = parseInt(match[1], 10)
  const unit = match[2]
  return unit === 'KB' ? value * 1024 : value
}

const main = async () => {
  const sortedSizes = Object.keys(buffers).sort(
    (a, b) => parseSize(a) - parseSize(b)
  )

  for (const size of sortedSizes) {
    console.log(`==== ${size} ====`)
    const buf = buffers[size]
    const str = strs[size]

    // All encodes and decodes for all codecs in one bench
    const bench = new Bench({ time: 10 })
    for (const [codecName, libs] of Object.entries(codecs)) {
      for (const [lib, fn] of Object.entries(libs.encode)) {
        bench.add(`${codecName} (encode) ${size} ${lib}`, () => fn(buf))
      }
      for (const [lib, fn] of Object.entries(libs.decode)) {
        bench.add(`${codecName} (decode) ${size} ${lib}`, () => fn(str))
      }
    }
    await bench.run()
    console.table(bench.table())
    console.log()
  }
}

main()
