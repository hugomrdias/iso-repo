/**
 * Elliptic Curve point compression
 *
 * Decompress a compressed public key in SEC format.
 * See section 2.3.3 in {@link https://www.secg.org/sec1-v2.pdf | SEC 1 v2}
 *
 * - https://stackoverflow.com/questions/17171542/algorithm-for-elliptic-curve-point-compression/30431547#30431547
 * - https://github.com/w3c-ccg/did-method-key/issues/32
 *
 * @module
 */
import * as bigintModArith from 'bigint-mod-arith'
import { base10 } from './base-x.js'
import { concat } from './utils.js'

/**
 * @typedef {'P-256' | 'P-384' | 'P-521'} Curve
 */

/** @type {Record<Curve, number>} */
const curveToPointLength = {
  'P-256': 64,
  'P-384': 96,
  'P-521': 132,
}

/**
 * Elliptic curves constants
 *
 * @param {Curve} curve
 */
export function getConstantsForCurve(curve) {
  let prime
  let b
  let pIdent
  const two = BigInt(2)

  switch (curve) {
    case 'P-256': {
      prime = two ** 256n - two ** 224n + two ** 192n + two ** 96n - 1n
      pIdent = (prime + 1n) / 4n
      b =
        41_058_363_725_152_142_129_326_129_780_047_268_409_114_441_015_993_725_554_835_256_314_039_467_401_291n
      break
    }
    case 'P-384': {
      prime = two ** 384n - two ** 128n - two ** 96n + two ** 32n - 1n
      pIdent = (prime + 1n) / 4n
      b =
        27_580_193_559_959_705_877_849_011_840_389_048_093_056_905_856_361_568_521_428_707_301_988_689_241_309_860_865_136_260_764_883_745_107_765_439_761_230_575n
      break
    }
    case 'P-521': {
      prime = two ** 521n - 1n
      pIdent = (prime + 1n) / 4n
      b =
        1_093_849_038_073_734_274_511_112_390_766_805_569_936_207_598_951_683_748_994_586_394_495_953_116_150_735_016_013_708_737_573_759_623_248_592_132_296_706_313_309_438_452_531_591_012_912_142_327_488_478_985_984n
      break
    }

    default: {
      throw new Error(`Unsupported curve ${curve}`)
    }
  }

  return { prime, b, pIdent }
}

/**
 * @param {Uint8Array} key
 */
export function isCompressed(key) {
  return key[0] === 0x02 || key[0] === 0x03
}

/**
 * @param {Uint8Array} key
 */
export function isUncompressed(key) {
  return key[0] === 0x04
}

/**
 * Elliptic Curve point compression
 *
 * @param { Uint8Array } pubkeyBytes
 */
export function compress(pubkeyBytes) {
  if (!isUncompressed(pubkeyBytes)) {
    throw new Error('Expected first byte to be 0x04, meaning uncompressed key.')
  }
  // first byte is a prefix
  const unprefixed = pubkeyBytes.subarray(1)
  const x = unprefixed.subarray(0, unprefixed.length / 2)
  const y = unprefixed.subarray(unprefixed.length / 2, unprefixed.length)
  const out = new Uint8Array(x.length + 1)

  // eslint-disable-next-line unicorn/prefer-at
  out[0] = 2 + (y[y.length - 1] & 1)
  out.set(x, 1)

  return out
}

/**
 * Elliptic Curve point decompression
 *
 * @param {Uint8Array} comp - Compressed public key. 1st byte: 0x02 for even or 0x03 for odd. Following curve size n bytes: x coordinate expressed as big-endian.
 * @param {Curve} curve
 */
export function decompress(comp, curve = 'P-256') {
  if (!isCompressed(comp)) {
    throw new TypeError(
      'Expected first byte to be 0x02 or 0x03, meaning compressed key.'
    )
  }

  const { prime, b, pIdent } = getConstantsForCurve(curve)

  const signY = BigInt(comp[0] - 2)
  const x = comp.subarray(1)
  const xBig = BigInt(base10.encode(x))

  const a = xBig ** 3n - xBig * 3n + b
  let yBig = bigintModArith.modPow(a, pIdent, prime)

  // If the parity doesn't match it's the *other* root"
  if (yBig % 2n !== signY) {
    yBig = prime - yBig
  }

  const y = base10.decode(yBig.toString(10))

  // left-pad for smaller than curve size byte y
  const offset = curveToPointLength[curve] / 2 - y.length
  const yPadded = new Uint8Array(curveToPointLength[curve] / 2)
  yPadded.set(y, offset)

  // concat coords & prepend compressed prefix
  const publicKey = concat([[0x04], x, yPadded])
  return publicKey
}
