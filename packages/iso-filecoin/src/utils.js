/**
 * @typedef {import('./types').NetworkPrefix} NetworkPrefix
 */

/**
 * Signature types filecoin network has to sign transactions
 */
export const SIGNATURES = /** @type {const} */ ({
  SECP256K1: 1,
  BLS: 3,
})

/**
 * Filecoin network prefixes
 */
export const NETWORKS = /** @type {const} */ ({
  mainnet: 'f',
  testnet: 't',
})

/**
 * Get network prefix from network
 *
 * @param {import("./types.js").Network} network
 */
export function getNetworkPrefix(network) {
  return network === 'mainnet' ? 'f' : 't'
}

/**
 * Get network from prefix
 *
 * @param {NetworkPrefix} networkPrefix
 * @returns {import('./types').Network}
 */
export function getNetwork(networkPrefix) {
  return networkPrefix === 'f' ? 'mainnet' : 'testnet'
}

/**
 * Returns the third position from derivation path
 *
 * @param {string} path - path to parse
 * @returns {import('./types.js').Network}
 */
export function getNetworkFromPath(path) {
  const type = parseDerivationPath(path).coinType
  if (type === 1) {
    return 'testnet'
  }
  return 'mainnet'
}

/**
 * Checks if the prefix is a valid network prefix
 *
 * @param {string} prefix
 * @returns {prefix is NetworkPrefix}
 */
export function checkNetworkPrefix(prefix) {
  return Object.values(NETWORKS).includes(/** @type {NetworkPrefix} */ (prefix))
}

export const BIP_32_PATH_REGEX = /^\d+'?$/u

/**
 * Parse a derivation path into its components
 *
 * @see https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#path-levels
 * @param {string} path - The derivation path to parse
 * @returns {import('./types').DerivationPathComponents} An object containing the derivation path components
 */
export function parseDerivationPath(path) {
  const parts = path.split('/')
  if (parts.length !== 6) {
    throw new Error(
      "Invalid derivation path: depth must be 5 \"m / purpose' / coin_type' / account' / change / address_index\""
    )
  }

  if (parts[0] !== 'm') {
    throw new Error('Invalid derivation path: depth 0 must be "m"')
  }

  if (parts[1] !== "44'") {
    throw new Error(
      'Invalid derivation path: The "purpose" node (depth 1) must be the string "44\'"'
    )
  }

  if (!BIP_32_PATH_REGEX.test(parts[2]) || !parts[2].endsWith("'")) {
    throw new Error(
      'Invalid derivation path: The "coin_type" node (depth 2) must be a hardened BIP-32 node.'
    )
  }

  if (!BIP_32_PATH_REGEX.test(parts[3]) || !parts[3].endsWith("'")) {
    throw new Error(
      'Invalid derivation path: The "account" node (depth 3) must be a hardened BIP-32 node.'
    )
  }

  if (!BIP_32_PATH_REGEX.test(parts[4])) {
    throw new Error(
      'Invalid derivation path: The "change" node (depth 4) must be a BIP-32 node.'
    )
  }

  if (!BIP_32_PATH_REGEX.test(parts[5])) {
    throw new Error(
      'Invalid derivation path: The "address_index" node (depth 5) must be a BIP-32 node.'
    )
  }

  const purpose = Number.parseInt(parts[1], 10)
  const coinType = Number.parseInt(parts[2], 10)
  const account = Number.parseInt(parts[3], 10)
  const change = Number.parseInt(parts[4], 10)
  const addressIndex = Number.parseInt(parts[5], 10)
  if (
    Number.isNaN(purpose) ||
    Number.isNaN(coinType) ||
    Number.isNaN(account) ||
    Number.isNaN(change) ||
    Number.isNaN(addressIndex)
  ) {
    throw new TypeError(
      'Invalid derivation path: some of the components cannot be parsed as numbers'
    )
  }

  return { purpose, coinType, account, change, addressIndex }
}
