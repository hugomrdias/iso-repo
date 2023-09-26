/* eslint-disable no-console */
// @ts-nocheck
import bench from 'micro-bmark'

import * as scure from '@scure/base'
import * as iso from './src/index.js'

const codecs = {
  Hex: {
    encode: {
      node: (buf) => Buffer.from(buf).toString('hex'),
      iso: (buf) => iso.hex.encode(buf),
      scure: (buf) => scure.hex.encode(buf),
    },
    decode: {
      node: (str) => Buffer.from(str, 'hex'),
      iso: (str) => iso.hex.decode(str),
      scure: (str) => scure.hex.decode(str),
    },
  },
  Base64: {
    encode: {
      node: (buf) => Buffer.from(buf).toString('base64'),
      iso: (buf) => iso.base64.encode(buf),
      scure: (buf) => scure.base64.encode(buf),
    },
    decode: {
      node: (str) => Buffer.from(str, 'base64'),
      iso: (str) => iso.base64.decode(str),
      noble: (str) => scure.base64.decode(str),
    },
  },

  UTF8: {
    encode: {
      node: (buf) => Buffer.from(buf).toString('utf8'),
      iso: (buf) => iso.utf8.encode(buf),
    },
    decode: {
      node: (str) => Buffer.from(str, 'utf8'),
      iso: (str) => iso.utf8.decode(str),
    },
  },
}

// buffer title, sample count, data
const buffers = {
  '32 B': [20_000, new Uint8Array(32).fill(1)],
  '64 B': [20_000, new Uint8Array(64).fill(1)],
  '1 KB': [500, new Uint8Array(1024).fill(2)],
  '8 KB': [10, new Uint8Array(1024 * 8).fill(3)],
}

const main = () =>
  bench.run(async () => {
    for (const [k, libs] of Object.entries(codecs)) {
      console.log(`==== ${k} ====`)
      for (const [size, [samples, buf]] of Object.entries(buffers)) {
        // encode
        for (const [lib, fn] of Object.entries(libs.encode))
          await bench.mark(`${k} (encode) ${size} ${lib}`, samples, () =>
            fn(buf)
          )
        console.log()

        // decode
        const str = libs.encode.iso(buf)
        for (const [lib, fn] of Object.entries(libs.decode))
          await bench.mark(`${k} (decode) ${size} ${lib}`, samples, () =>
            fn(str)
          )
        console.log()
      }
    }
    // Log current RAM
    bench.logMem()
  })

main()
