/**
 * RFC4648 codec factory and predefines `base2`, `base8`, `hex`, `base16`, `base32`, `base32hex`, `base64` and `base64url` alphabets and {@link Codec | Codecs}.
 *
 * @module
 */

import {
  HAS_NATIVE_BASE64_SUPPORT,
  HAS_NATIVE_HEX_SUPPORT,
  nativeBase64,
  nativeHex,
  rfc4648,
} from './bases/rfc4648.js'

/** @typedef {import('./types').Codec} Codec */

/**
 * Matches node
 */
export const hex = HAS_NATIVE_HEX_SUPPORT
  ? nativeHex
  : rfc4648('hex', true, (str) => str.toLowerCase())
export const base2 = rfc4648('base2')
export const base8 = rfc4648('base8')
export const base16 = rfc4648('base16')
export const base32 = rfc4648('base32')
export const base32hex = rfc4648('base32hex', true)
export const base64 = HAS_NATIVE_BASE64_SUPPORT
  ? nativeBase64('base64', false)
  : rfc4648('base64', false)
export const base64pad = HAS_NATIVE_BASE64_SUPPORT
  ? nativeBase64('base64', true)
  : rfc4648('base64', true)
/**
 * Base 64 URL
 *
 * Padding is skipped by default
 */
export const base64url = HAS_NATIVE_BASE64_SUPPORT
  ? nativeBase64('base64url', false)
  : rfc4648('base64url', false)

/**
 * Base 64 URL Padded
 */
export const base64urlpad = HAS_NATIVE_BASE64_SUPPORT
  ? nativeBase64('base64url', true)
  : rfc4648('base64url', true)
