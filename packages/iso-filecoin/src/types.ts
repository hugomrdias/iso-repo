import type { PROTOCOL_INDICATOR } from './address.js'
import type { Schemas as MessageSchemas } from './message.js'
import type {
  Schemas as SignatureSchemas,
  SIGNATURE_TYPE,
} from './signature.js'
import type { z } from 'zod'

export type ProtocolIndicator = typeof PROTOCOL_INDICATOR
export type ProtocolIndicatorCode = ProtocolIndicator[keyof ProtocolIndicator]

export interface Address {
  protocol: ProtocolIndicatorCode
  payload: Uint8Array
  network: Network
  networkPrefix: NetworkPrefix
  namespace?: number
  toString: () => string
  toBytes: () => Uint8Array
  checksum: () => Uint8Array
}

export interface DerivationPathComponents {
  purpose: number
  coinType: number
  account: number
  change: number
  addressIndex: number
}

export type Network = 'mainnet' | 'testnet'
export type NetworkPrefix = 'f' | 't'

// Message types
export type MessageObj = z.infer<(typeof MessageSchemas)['message']>
export type PartialMessageObj = z.infer<
  (typeof MessageSchemas)['messagePartial']
>
export interface LotusMessage {
  Version: 0
  To: string
  From: string
  Nonce: number
  Value: string
  GasLimit: number
  GasFeeCap: string
  GasPremium: string
  Method: number
  Params: string
  CID?: {
    '/': string
  }
}

// Signature types
export type SignatureType = keyof typeof SIGNATURE_TYPE
export type SignatureCode = (typeof SIGNATURE_TYPE)[SignatureType]

export type LotusSignature = z.infer<
  (typeof SignatureSchemas)['lotusSignature']
>
export type SignatureObj = z.infer<(typeof SignatureSchemas)['signature']>

// RPC types
export interface RpcError {
  error: {
    code: number
    message: string
  }
  result?: undefined
}

export interface Options {
  token?: string
  api: string | URL
  network?: Network
  fetch?: typeof globalThis.fetch
}

/**
 * Lotus API responses
 */
export type VersionResponse =
  | {
      result: { Version: string; APIVersion: number; BlockDelay: number }
      error: undefined
    }
  | RpcError

export type StateNetworkNameResponse =
  | {
      result: Network
      error: undefined
    }
  | RpcError

export type MpoolGetNonceResponse =
  | {
      result: number
      error: undefined
    }
  | RpcError

export type GasEstimateMessageGasResponse =
  | {
      result: LotusMessage
      error: undefined
    }
  | RpcError

export type WalletBalanceResponse =
  | {
      /**
       * Wallet balance in attoFIL
       *
       * @example '99999927137190925849'
       */
      result: string
      error: undefined
    }
  | RpcError

export type MpoolPushResponse =
  | {
      result: {
        ['/']: string
      }
      error: undefined
    }
  | RpcError
