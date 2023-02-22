import { rfc4648 } from './rfc4648.js'

export { rfc4648 } from './rfc4648.js'
export { utf8 } from './utf8.js'
export * from './utils.js'
export * from './crypto.js'

/** @typedef {import('./types').Codec} Codec */

export const hex = rfc4648('hex', true, (str) => str.toLowerCase())
export const base2 = rfc4648('base2')
export const base8 = rfc4648('base8')
export const base16 = rfc4648('base16')
export const base32 = rfc4648('base32')
export const base32hex = rfc4648('base32hex')
export const base64 = rfc4648('base64')

/**
 * Base 64 URL
 *
 * Padding is skipped by default
 */
export const base64url = rfc4648('base64url', false)
