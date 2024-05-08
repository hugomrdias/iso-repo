import assert from 'assert'
import * as BASES from '../src/rfc4648.js'
import { utf8 } from '../src/utf8.js'

const VECTORS = [
  ['base16', '', ''],
  ['base16', utf8.encode(Uint8Array.from([0x01])), '01'],
  ['base16', utf8.encode(Uint8Array.from([15])), '0F'],
  ['base16', 'f', '66'],
  ['base16', 'fo', '666F'],
  ['base16', 'foo', '666F6F'],
  ['base16', 'foob', '666F6F62'],
  ['base16', 'fooba', '666F6F6261'],
  ['base16', 'foobar', '666F6F626172'],

  ['base32', '', ''],
  ['base32', 'yes mani !', 'PFSXGIDNMFXGSIBB'],
  ['base32', 'f', 'MY'],
  ['base32', 'fo', 'MZXQ'],
  ['base32', 'foo', 'MZXW6'],
  ['base32', 'foob', 'MZXW6YQ'],
  ['base32', 'fooba', 'MZXW6YTB'],
  ['base32', 'foobar', 'MZXW6YTBOI'],

  ['base32hex', '', ''],
  ['base32hex', 'yes mani !', 'f5in683dc5n6i811'],
  ['base32hex', 'f', 'co======'],
  ['base32hex', 'fo', 'cpng===='],
  ['base32hex', 'foo', 'cpnmu==='],
  ['base32hex', 'foob', 'cpnmuog='],
  ['base32hex', 'fooba', 'cpnmuoj1'],
  ['base32hex', 'foobar', 'cpnmuoj1e8======'],

  ['base64', '', ''],
  ['base64', '÷ïÿ', 'w7fDr8O/'],
  ['base64', 'f', 'Zg'],
  ['base64', 'fo', 'Zm8'],
  ['base64', 'foo', 'Zm9v'],
  ['base64', 'foob', 'Zm9vYg'],
  ['base64', 'fooba', 'Zm9vYmE'],
  ['base64', 'foobar', 'Zm9vYmFy'],
  ['base64', '÷ïÿ🥰÷ïÿ😎🥶🤯', 'w7fDr8O/8J+lsMO3w6/Dv/CfmI7wn6W28J+krw'],

  ['base64url', '', ''],
  ['base64url', 'f', 'Zg'],
  ['base64url', 'fo', 'Zm8'],
  ['base64url', 'foo', 'Zm9v'],
  ['base64url', 'foob', 'Zm9vYg'],
  ['base64url', 'fooba', 'Zm9vYmE'],
  ['base64url', 'foobar', 'Zm9vYmFy'],
  ['base64url', '÷ïÿ🥰÷ïÿ😎🥶🤯', 'w7fDr8O_8J-lsMO3w6_Dv_CfmI7wn6W28J-krw'],
]

describe('decode', () => {
  for (const [base, input, output] of VECTORS) {
    // @ts-ignore
    const codec = /** @type {import('../src/types.js').Codec} */ (BASES[base])
    it(`${base}: ${input}`, () => {
      assert.deepStrictEqual(codec.decode(output), utf8.decode(input))
    })
  }
})

describe('encode', () => {
  for (const [base, input, output] of VECTORS) {
    // @ts-ignore
    const codec = /** @type {import('../src/types.js').Codec} */ (BASES[base])

    it(`${base}: ${input}`, () => {
      assert.deepStrictEqual(codec.encode(input), output)
    })
  }
})

describe('encode/decode', () => {
  for (const [base, input] of VECTORS) {
    // @ts-ignore
    const codec = /** @type {import('../src/types.js').Codec} */ (BASES[base])

    it(`${base}: ${input}`, () => {
      const bytes = utf8.decode(input)
      assert.deepStrictEqual(codec.decode(codec.encode(input)), bytes)
    })
  }
})

describe('others', () => {
  it('hex matches node', function () {
    if (!globalThis.Buffer) {
      this.skip()
    }
    const vector = ['foobar', '666F6F626172']

    assert.deepStrictEqual(
      BASES.hex.decode(vector[1]),
      new Uint8Array(Buffer.from(vector[1], 'hex'))
    )

    assert.deepStrictEqual(BASES.hex.decode(vector[1]), utf8.decode(vector[0]))

    assert.deepStrictEqual(BASES.hex.encode(vector[0]), vector[1].toLowerCase())
  })

  it('base64url matches node', function () {
    if (!globalThis.Buffer) {
      this.skip()
    }
    const vector = ['÷ïÿo', 'w7fDr8O_bw']

    assert.deepStrictEqual(BASES.base64url.encode(vector[0]), vector[1])

    assert.deepStrictEqual(
      BASES.base64url.encode(vector[0]),
      Buffer.from(vector[0]).toString('base64url')
    )
  })

  it('base64url with pad ', () => {
    const vector = ['foob', 'Zm9vYg==']

    assert.deepStrictEqual(BASES.base64url.encode(vector[0], true), vector[1])
  })
})
