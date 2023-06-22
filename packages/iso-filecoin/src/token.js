import BigNumber from 'bignumber.js'
import { base16 } from 'iso-base/rfc4648'
import { concat } from 'iso-base/utils'

export const ATTO_DECIMALS = 18
export const FEMTO_DECIMALS = 15
export const PICO_DECIMALS = 12
export const NANO_DECIMALS = 9
export const MICRO_DECIMALS = 6
export const MILLI_DECIMALS = 3
export const WHOLE_DECIMALS = 0

const FEMTO_MUL = 10n ** BigInt(MILLI_DECIMALS)
const PICO_MUL = 10n ** BigInt(MICRO_DECIMALS)
const NANO_MUL = 10n ** BigInt(NANO_DECIMALS)
const MICRO_MUL = 10n ** BigInt(PICO_DECIMALS)
const MILLI_MUL = 10n ** BigInt(FEMTO_DECIMALS)
const WHOLE_MUL = 10n ** BigInt(ATTO_DECIMALS)

const symbol = Symbol.for('filecoin-token')
BigNumber.config({
  EXPONENTIAL_AT: 1e9,
  DECIMAL_PLACES: 40,
  ALPHABET: '0123456789abcdef',
})

/**
 * @typedef {number | string | BigNumber.Instance | bigint | Token} Value
 */

/**
 * Check if object is a {@link Token} instance
 *
 * @param {any} val
 * @returns {val is Token}
 */
export function isToken(val) {
  return Boolean(val?.[symbol])
}

/**
 * @param {unknown} val
 * @returns {val is bigint}
 */
function isBigInt(val) {
  return typeof val === 'bigint'
}

/**
 * @param {Value} val
 */
function bn(val) {
  if (isBigInt(val)) {
    return new BigNumber(val.toString())
  }

  if (isToken(val)) {
    return val.val
  }
  return new BigNumber(val)
}

/**
 * Class to work with different Filecoin denominations.
 *
 * @see https://docs.filecoin.io/basics/assets/the-fil-token/#denomonations
 */
export class Token {
  /** @type {boolean} */
  [symbol] = true
  /**
   * @param {Value} val
   */
  constructor(val) {
    /** @type {BigNumber} */
    this.val = bn(val)
  }

  /**
   * @param {Value} val
   */
  static fromAttoFIL(val) {
    return new Token(val)
  }

  /**
   * @param {Value} val
   */
  static fromFemtoFIL(val) {
    return new Token(val).mul(FEMTO_MUL)
  }

  /**
   * @param {Value} val
   */
  static fromPicoFIL(val) {
    return new Token(val).mul(PICO_MUL)
  }

  /**
   * @param {Value} val
   */
  static fromNanoFIL(val) {
    return new Token(val).mul(NANO_MUL)
  }

  /**
   * @param {Value} val
   */
  static fromMicroFIL(val) {
    return new Token(val).mul(MICRO_MUL)
  }

  /**
   * @param {Value} val
   */
  static fromMilliFIL(val) {
    return new Token(val).mul(MILLI_MUL)
  }

  /**
   * @param {Value} val
   */
  static fromFIL(val) {
    return new Token(val).mul(WHOLE_MUL)
  }

  /**
   * @param {Value} val
   */
  mul(val) {
    return new Token(this.val.times(bn(val)))
  }

  /**
   * @param {Value} val
   */
  div(val) {
    return new Token(this.val.div(bn(val)))
  }

  abs() {
    return new Token(this.val.abs())
  }

  /**
   * @param {Value} val
   */
  add(val) {
    return new Token(this.val.plus(bn(val)))
  }

  /**
   * @param {Value} val
   */
  sub(val) {
    return new Token(this.val.minus(bn(val)))
  }

  /**
   * @param {number | undefined} [base]
   */
  toString(base = 10) {
    return this.val.toString(base)
  }

  toAttoFIL() {
    return this.toString()
  }

  toFemtoFIL() {
    return this.div(FEMTO_MUL).toString()
  }

  toPicoFIL() {
    return this.div(PICO_MUL).toString()
  }

  toNanoFIL() {
    return this.div(NANO_MUL).toString()
  }

  toMicroFIL() {
    return this.div(MICRO_MUL).toString()
  }

  toMilliFIL() {
    return this.div(MILLI_MUL).toString()
  }

  toFIL() {
    return this.div(WHOLE_MUL).toString()
  }

  toBytes() {
    const sign = this.val.isNegative() ? '01' : '00'

    return concat([
      base16.decode(sign),
      bigToUint8Array(BigInt(this.val.toString())),
    ])
  }
}

const big0 = BigInt(0)
const big1 = BigInt(1)
const big8 = BigInt(8)

/**
 *
 * @see https://jackieli.dev/posts/bigint-to-uint8array/
 * @param {bigint} big
 */
function bigToUint8Array(big) {
  // @ts-ignore
  if (big < big0) {
    const bits = (BigInt(big.toString(2).length) / big8 + big1) * big8
    const prefix1 = big1 << bits
    // @ts-ignore
    big += prefix1
  }
  let hex = big.toString(16)
  if (hex.length % 2) {
    hex = '0' + hex
  }
  const len = hex.length / 2
  const u8 = new Uint8Array(len)
  let i = 0
  let j = 0
  while (i < len) {
    u8[i] = Number.parseInt(hex.slice(j, j + 2), 16)
    i += 1
    j += 2
  }
  return u8
}
