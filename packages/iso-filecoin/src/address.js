import { NETWORKS, checkNetworkPrefix, getNetwork } from './utils.js'
import { base32, base16 } from 'iso-base/rfc4648'
import { concat, equals } from 'iso-base/utils'
import { blake2b } from '@noble/hashes/blake2b'
import * as leb128 from 'iso-base/leb128'

/**
 * @typedef {import('./types.js').Address} Address
 */

/**
 * Protocol indicator
 */
const PROTOCOL_INDICATOR = {
  ID: 0,
  SECP256K1: 1,
  ACTOR: 2,
  BLS: 3,
  DELEGATED: 4,
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
 * @param {Address} address
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
 * Address from string
 *
 * @param {string} address
 * @returns {Address}
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
 * @returns {Address}
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
 * @returns Address
 */
export function fromPublicKey(bytes, network, type) {
  switch (type) {
    case 'SECP256K1': {
      return AddressSecp256k1.fromPublicKey(bytes, network)
    }

    default: {
      throw new Error(`Invalid signature type: ${type}`)
    }
  }
}

/**
 * Secp256k1 address
 *
 * @implements {Address}
 */
export class AddressSecp256k1 {
  /**
   *
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(payload, network) {
    this.payload = payload
    this.network = network
    this.networkPrefix = NETWORKS[network]
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

  toString() {
    return `${this.networkPrefix}${this.protocol}${base32
      .encode(concat([this.payload, this.checksum()]), false)
      .toLowerCase()}`
  }

  toBytes() {
    return concat([base16.decode(`0${this.protocol}`), this.payload])
  }

  checksum() {
    return blake2b(this.toBytes(), {
      dkLen: 4,
    })
  }
}

/**
 * Delegated address
 *
 * @see https://github.com/filecoin-project/FIPs/blob/master/FIPS/fip-0048.md
 *
 * @example t410f2oekwcmo2pueydmaq53eic2i62crtbeyuzx2gmy
 * @implements {Address}
 */
export class AddressDelegated {
  /**
   * @param {number} namespace
   * @param {Uint8Array} payload
   * @param {import("./types.js").Network} network
   */
  constructor(namespace, payload, network) {
    this.payload = payload
    this.network = network
    this.networkPrefix = NETWORKS[network]
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

  checksum() {
    return blake2b(this.toBytes(), {
      dkLen: 4,
    })
  }
}
