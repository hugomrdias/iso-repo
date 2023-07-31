import { blake2b } from '@noble/hashes/blake2b'
import * as leb128 from 'iso-base/leb128'
import { base16, base32 } from 'iso-base/rfc4648'
import { concat, equals, isBufferSource, u8 } from 'iso-base/utils'
import { NETWORKS, checkNetworkPrefix, getNetwork } from './utils.js'

/**
 * @typedef {import('./types.js').Address} IAddress
 * @typedef { string | IAddress | BufferSource} Value
 */

/**
 * Protocol indicator
 */
export const PROTOCOL_INDICATOR = /** @type {const} */ ({
  ID: 0,
  SECP256K1: 1,
  ACTOR: 2,
  BLS: 3,
  DELEGATED: 4,
})

const symbol = Symbol.for('filecoin-address')

/**
 * Check if object is a {@link IAddress} instance
 *
 * @param {any} val
 * @returns {val is IAddress}
 */
export function isAddress(val) {
  return Boolean(val?.[symbol])
}

/**
 * Validate checksum
 *
 * @param {Uint8Array} actual
 * @param {Uint8Array} expected
 */
function validateChecksum(actual, expected) {
  return equals(actual, expected)
}

/**
 * Check if string is valid Ethereum address
 *
 * @param {string} address
 */
export function isEthAddress(address) {
  return /^0x[\dA-Fa-f]{40}$/.test(address)
}

/**
 * Address from Ethereum address
 *
 * @param {string} address
 * @param {import('./types.js').Network} network
 * @returns {IAddress}
 */
export function fromEthAddress(address, network) {
  return new AddressDelegated(
    10,
    base16.decode(address.slice(2).toUpperCase()),
    network
  )
}

/**
 * Ethereum address from address
 *
 * @param {IAddress} address
 */
export function toEthAddress(address) {
  if (address.protocol !== PROTOCOL_INDICATOR.DELEGATED) {
    throw new Error(
      `Invalid protocol indicator: ${address.protocol}. Only Delegated Adresses are supported.`
    )
  }
  return `0x${base16.encode(address.payload).toLowerCase()}`
}

/**
 * @param {Value} value - Value to convert to address
 * @param {import('./types.js').Network} [network] - Network
 * @returns {IAddress}
 */
export function from(value, network = 'mainnet') {
  if (isBufferSource(value)) {
    return fromBytes(u8(value), network)
  }

  if (isAddress(value)) {
    return value
  }

  if (typeof value === 'string') {
    return isEthAddress(value)
      ? fromEthAddress(value, network)
      : fromString(value)
  }

  throw new Error(`Invalid value: ${value}`)
}

/**
 * Address from string
 *
 * @param {string} address
 * @returns {IAddress}
 */
export function fromString(address) {
  const type = Number.parseInt(address[1])

  switch (type) {
    case PROTOCOL_INDICATOR.SECP256K1: {
      return AddressSecp256k1.fromString(address)
    }

    case PROTOCOL_INDICATOR.DELEGATED: {
      return AddressDelegated.fromString(address)
    }

    case PROTOCOL_INDICATOR.ACTOR: {
      return AddressActor.fromString(address)
    }

    case PROTOCOL_INDICATOR.BLS: {
      return AddressBLS.fromString(address)
    }

    case PROTOCOL_INDICATOR.ID: {
      return AddressId.fromString(address)
    }

    default: {
      throw new Error(`Invalid protocol indicator: ${type}`)
    }
  }
}

/**
 * Create address from bytes
 *
 * @param {Uint8Array} bytes
 * @param {import('./types.js').Network} network
 * @returns {IAddress}
 */
export function fromBytes(bytes, network) {
  const type = bytes[0]

  switch (type) {
    case PROTOCOL_INDICATOR.SECP256K1: {
      return AddressSecp256k1.fromBytes(bytes, network)
    }
    case PROTOCOL_INDICATOR.DELEGATED: {
      return AddressDelegated.fromBytes(bytes, network)
    }
    case PROTOCOL_INDICATOR.BLS: {
      return AddressBLS.fromBytes(bytes, network)
    }
    case PROTOCOL_INDICATOR.ACTOR: {
      return AddressActor.fromBytes(bytes, network)
    }
    case PROTOCOL_INDICATOR.ID: {
      return AddressId.fromBytes(bytes, network)
    }

    default: {
      throw new Error(`Invalid protocol indicator: ${type}`)
    }
  }
}

/**
 * Create address from bytes
 *
 * @param {Uint8Array} bytes
 * @param {import('./types.js').Network} network
 * @param {import('./types.js').SignatureType} type
 * @returns IAddress
 */
export function fromPublicKey(bytes, network, type) {
  switch (type) {
    case 'SECP256K1': {
      return AddressSecp256k1.fromPublicKey(bytes, network)
    }

    case 'BLS': {
      return AddressBLS.fromPublicKey(bytes, network)
    }

    default: {
      throw new Error(`Invalid signature type: ${type}`)
    }
  }
}

/**
 * Create an `Address` instance from a 0x-prefixed hex string address returned by `Address.toContractDestination()`.
 *
 * @param {`0x${string}`} address - The 0x-prefixed hex string address returned by `Address.toContractDestination()`.
 * @param {import("./types.js").Network} network - The network the address is on.
 */
export function fromContractDestination(address, network) {
  if (!address.startsWith('0x')) {
    throw new Error(`Expected 0x prefixed hex, instead got: '${address}'`)
  }
  return fromBytes(base16.decode(address.slice(2)), network)
}

/**
 * Secp256k1 address
 *
 * @implements {IAddress}
 */
class Address {
  /** @type {boolean} */
  [symbol] = true

  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    this.payload = payload
    this.network = network
    this.networkPrefix = NETWORKS[network]
    /** @type {import('./types.js').ProtocolIndicatorCode} */
    this.protocol = PROTOCOL_INDICATOR.ID
  }

  toString() {
    return `${this.networkPrefix}${this.protocol}${base32
      .encode(concat([this.payload, this.checksum()]), false)
      .toLowerCase()}`
  }

  toBytes() {
    return concat([base16.decode(`0${this.protocol}`), this.payload])
  }

  toContractDestination() {
    return /** @type {`0x${string}`} */ (`0x${base16.encode(this.toBytes())}`)
  }

  checksum() {
    return blake2b(this.toBytes(), {
      dkLen: 4,
    })
  }
}

/**
 * ID Address f0..
 *
 * Protocol 0 addresses are simple IDs. All actors have a numeric ID even if they don’t have public keys. The payload of an ID address is base10 encoded. IDs are not hashed and do not have a checksum.
 *
 * @see https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-0-ids
 *
 * @implements {IAddress}
 */
export class AddressId extends Address {
  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    super(payload, network)
    this.protocol = PROTOCOL_INDICATOR.ID
    this.id = leb128.unsigned.decode(payload)[0]
  }

  /**
   * Create address from string
   *
   * @param {string} address
   */
  static fromString(address) {
    const networkPrefix = address[0]
    const protocolIndicator = address[1]

    if (!checkNetworkPrefix(networkPrefix)) {
      throw new Error(`Invalid network: ${networkPrefix}`)
    }

    if (Number.parseInt(protocolIndicator) !== PROTOCOL_INDICATOR.ID) {
      throw new Error(`Invalid protocol indicator: ${protocolIndicator}`)
    }

    const newAddress = new AddressId(
      leb128.unsigned.encode(address.slice(2)),
      getNetwork(networkPrefix)
    )

    return newAddress
  }

  /**
   * Create address from bytes
   *
   * @param {Uint8Array} bytes
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromBytes(bytes, network) {
    if (bytes[0] !== PROTOCOL_INDICATOR.ID) {
      throw new Error(`Invalid protocol indicator: ${bytes[0]}`)
    }
    return new AddressId(bytes.subarray(1), network)
  }

  toString() {
    return `${this.networkPrefix}${this.protocol}${this.id}`
  }
}

/**
 * Secp256k1 address f1..
 *
 * @see https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-1-libsecpk1-elliptic-curve-public-keys
 *
 * @implements {IAddress}
 */
export class AddressSecp256k1 extends Address {
  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    super(payload, network)
    this.protocol = PROTOCOL_INDICATOR.SECP256K1

    if (payload.length !== 20) {
      throw new Error(`Invalid payload length: ${payload.length} should be 20.`)
    }
  }

  /**
   * Create address from string
   *
   * @param {string} address
   */
  static fromString(address) {
    const networkPrefix = address[0]
    const protocolIndicator = address[1]

    if (!checkNetworkPrefix(networkPrefix)) {
      throw new Error(`Invalid network: ${networkPrefix}`)
    }

    if (Number.parseInt(protocolIndicator) !== PROTOCOL_INDICATOR.SECP256K1) {
      throw new Error(`Invalid protocol indicator: ${protocolIndicator}`)
    }

    const data = base32.decode(address.slice(2).toUpperCase())
    const payload = data.subarray(0, -4)
    const checksum = data.subarray(-4)
    const newAddress = new AddressSecp256k1(payload, getNetwork(networkPrefix))

    if (validateChecksum(newAddress.checksum(), checksum)) {
      return newAddress
    } else {
      throw new Error(`Invalid checksum`)
    }
  }

  /**
   * Create address from bytes
   *
   * @param {Uint8Array} bytes
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromBytes(bytes, network) {
    if (bytes[0] !== PROTOCOL_INDICATOR.SECP256K1) {
      throw new Error(`Invalid protocol indicator: ${bytes[0]}`)
    }
    return new AddressSecp256k1(bytes.subarray(1), network)
  }

  /**
   *
   * @param {Uint8Array} publicKey
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromPublicKey(publicKey, network) {
    if (publicKey.length !== 65) {
      throw new Error(
        `Invalid public key length: ${publicKey.length} should be 65.`
      )
    }
    const payload = blake2b(publicKey, {
      dkLen: 20,
    })
    return new AddressSecp256k1(payload, network)
  }
}

/**
 * Actor Address f2..
 *
 * Protocol 2 addresses representing an Actor. The payload field contains the SHA256 hash of meaningful data produced as a result of creating the actor.
 *
 * @see https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-2-actor
 *
 * @implements {IAddress}
 */
export class AddressActor extends Address {
  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    super(payload, network)
    this.protocol = PROTOCOL_INDICATOR.ACTOR
    if (payload.length !== 20) {
      throw new Error(`Invalid payload length: ${payload.length} should be 20.`)
    }
  }

  /**
   * Create address from string
   *
   * @param {string} address
   */
  static fromString(address) {
    const networkPrefix = address[0]
    const protocolIndicator = address[1]

    if (!checkNetworkPrefix(networkPrefix)) {
      throw new Error(`Invalid network: ${networkPrefix}`)
    }

    if (Number.parseInt(protocolIndicator) !== PROTOCOL_INDICATOR.ACTOR) {
      throw new Error(`Invalid protocol indicator: ${protocolIndicator}`)
    }

    const data = base32.decode(address.slice(2).toUpperCase())
    const payload = data.subarray(0, -4)
    const checksum = data.subarray(-4)
    const newAddress = new AddressActor(payload, getNetwork(networkPrefix))

    if (validateChecksum(newAddress.checksum(), checksum)) {
      return newAddress
    } else {
      throw new Error(`Invalid checksum`)
    }
  }

  /**
   * Create address from bytes
   *
   * @param {Uint8Array} bytes
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromBytes(bytes, network) {
    if (bytes[0] !== PROTOCOL_INDICATOR.ACTOR) {
      throw new Error(`Invalid protocol indicator: ${bytes[0]}`)
    }
    return new AddressActor(bytes.subarray(1), network)
  }
}

/**
 * BLS Address f3..
 *
 * Protocol 3 addresses represent BLS public encryption keys. The payload field contains the BLS public key.
 *
 * @see https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-3-bls
 *
 * @implements {IAddress}
 */
export class AddressBLS extends Address {
  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    super(payload, network)
    this.protocol = PROTOCOL_INDICATOR.BLS
    if (payload.length !== 48) {
      throw new Error(`Invalid payload length: ${payload.length} should be 48.`)
    }
  }

  /**
   * Create address from string
   *
   * @param {string} address
   */
  static fromString(address) {
    const networkPrefix = address[0]
    const protocolIndicator = address[1]

    if (!checkNetworkPrefix(networkPrefix)) {
      throw new Error(`Invalid network: ${networkPrefix}`)
    }

    if (Number.parseInt(protocolIndicator) !== PROTOCOL_INDICATOR.BLS) {
      throw new Error(
        `Invalid protocol indicator: ${protocolIndicator} expected ${PROTOCOL_INDICATOR.BLS}`
      )
    }

    const data = base32.decode(address.slice(2).toUpperCase())
    const payload = data.subarray(0, -4)
    const checksum = data.subarray(-4)
    const newAddress = new AddressBLS(payload, getNetwork(networkPrefix))

    if (validateChecksum(newAddress.checksum(), checksum)) {
      return newAddress
    } else {
      throw new Error(`Invalid checksum`)
    }
  }

  /**
   * Create address from bytes
   *
   * @param {Uint8Array} bytes
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromBytes(bytes, network) {
    if (bytes[0] !== PROTOCOL_INDICATOR.BLS) {
      throw new Error(`Invalid protocol indicator: ${bytes[0]}`)
    }
    return new AddressBLS(bytes.subarray(1), network)
  }

  /**
   *
   * @param {Uint8Array} publicKey
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromPublicKey(publicKey, network) {
    if (publicKey.length !== 48) {
      throw new Error(
        `Invalid public key length: ${publicKey.length} should be 48.`
      )
    }
    return new AddressBLS(publicKey, network)
  }
}

/**
 * Delegated address f4..
 *
 * @see https://github.com/filecoin-project/FIPs/blob/master/FIPS/fip-0048.md
 *
 * @example t410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy
 * @implements {IAddress}
 */
export class AddressDelegated extends Address {
  /**
   * @param {number} namespace
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(namespace, payload, network) {
    super(payload, network)
    this.protocol = PROTOCOL_INDICATOR.DELEGATED
    this.namespace = namespace

    if (namespace !== 10) {
      throw new Error(
        `Invalid namespace: ${namespace}. Only Ethereum Address Manager (EAM) is supported.`
      )
    }
    if (payload.length === 0 || payload.length > 54) {
      throw new Error(
        `Invalid payload length: ${payload.length} should be 54 bytes or less.`
      )
    }
  }

  /**
   * Create address from string
   *
   * @param {string} address
   */
  static fromString(address) {
    const networkPrefix = address[0]
    const protocolIndicator = address[1]

    if (!checkNetworkPrefix(networkPrefix)) {
      throw new Error(`Invalid network: ${networkPrefix}`)
    }

    if (Number.parseInt(protocolIndicator) !== PROTOCOL_INDICATOR.DELEGATED) {
      throw new Error(`Invalid protocol indicator: ${protocolIndicator}`)
    }

    // t410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy

    const namespace = address.slice(2, address.indexOf('f', 2))
    const dataEncoded = address.slice(address.indexOf('f', 2) + 1)

    const data = base32.decode(dataEncoded.toUpperCase())
    const payload = data.subarray(0, -4)
    const checksum = data.subarray(-4)
    const newAddress = new AddressDelegated(
      Number.parseInt(namespace),
      payload,
      getNetwork(networkPrefix)
    )

    if (validateChecksum(newAddress.checksum(), checksum)) {
      return newAddress
    } else {
      throw new Error(`Invalid checksum`)
    }
  }

  /**
   * Create address from bytes
   *
   * @param {Uint8Array} bytes
   * @param {import('./types.js').Network} network
   * @returns
   */
  static fromBytes(bytes, network) {
    if (bytes[0] !== PROTOCOL_INDICATOR.DELEGATED) {
      throw new Error(`Invalid protocol indicator: ${bytes[0]}`)
    }

    const [namespace, size] = leb128.unsigned.decode(bytes, 1)

    return new AddressDelegated(
      Number(namespace),
      bytes.subarray(1 + size),
      network
    )
  }

  toString() {
    return `${this.networkPrefix}${this.protocol}${this.namespace}f${base32
      .encode(concat([this.payload, this.checksum()]), false)
      .toLowerCase()}`
  }

  toBytes() {
    const protocol = leb128.unsigned.encode(this.protocol)
    const namespace = leb128.unsigned.encode(this.namespace)
    return concat([protocol, namespace, this.payload])
  }
}
