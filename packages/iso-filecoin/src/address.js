import { NETWORKS, checkNetworkPrefix, getNetwork } from './utils.js'
import { base32, base16 } from 'iso-base/rfc4648'
import { concat, equals } from 'iso-base/utils'
import { blake2b } from '@noble/hashes/blake2b'

const PROTOCOL_INDICATOR = {
  ID: 0,
  SECP256K1: 1,
  ACTOR: 2,
  BLS: 3,
  DELEGATED: 4,
}

/**
 * @param {Uint8Array} actual
 * @param {Uint8Array} expected
 */
function validateChecksum(actual, expected) {
  return equals(actual, expected)
}

/**
 *
 * @param {string} address
 */
export function fromString(address) {
  const type = Number.parseInt(address[1])

  switch (type) {
    case PROTOCOL_INDICATOR.SECP256K1: {
      return AddressSecp256k1.fromString(address)
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
 * @returns
 */
export function fromBytes(bytes, network) {
  const type = bytes[0]

  switch (type) {
    case PROTOCOL_INDICATOR.SECP256K1: {
      return AddressSecp256k1.fromBytes(bytes, network)
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
 * @returns
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

    const data = base32.decode(address.slice(2).toLocaleUpperCase())
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
