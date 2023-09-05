import type BigNumber from 'bignumber.js'
import type { PROTOCOL_INDICATOR } from './address.js'
import type { Schemas as MessageSchemas } from './message.js'
import type {
  Schemas as SignatureSchemas,
  SIGNATURE_TYPE,
} from './signature.js'
import type { z } from 'zod'

export type ProtocolIndicator = typeof PROTOCOL_INDICATOR
export type ProtocolIndicatorCode = ProtocolIndicator[keyof ProtocolIndicator]

export interface CID {
  '/': string
}

export interface Address {
  protocol: ProtocolIndicatorCode
  payload: Uint8Array
  network: Network
  networkPrefix: NetworkPrefix
  namespace?: number
  id?: bigint
  toString: () => string
  toBytes: () => Uint8Array
  toContractDestination: () => `0x${string}`
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

export interface RpcOptions {
  method: `Filecoin.${string}`
  params?: unknown[]
}

export interface FetchOptions {
  signal?: AbortSignal
  keepalive?: boolean
  timeout?: number
}

export interface MsgReceipt {
  ExitCode: number
  Return: string | null
  GasUsed: number
  EventsRoot: CID | null
}
export interface MsgLookup {
  Height: number
  Message: CID
  Receipt: MsgReceipt
  ReturnDec: unknown | null
  TipSet: CID[]
}
/**
 * Lotus API responses
 *
 * @see https://filecoin-shipyard.github.io/js-lotus-client/api/api.html
 */

export type LotusResponse<T> = { result: T; error: undefined } | RpcError
export type VersionResponse = LotusResponse<{
  Version: string
  APIVersion: number
  BlockDelay: number
}>
export type StateNetworkNameResponse = LotusResponse<Network>
export type MpoolGetNonceResponse = LotusResponse<number>
export type GasEstimateMessageGasResponse = LotusResponse<LotusMessage>

/**
 * Wallet balance in attoFIL
 *
 * @example '99999927137190925849'
 */
export type WalletBalanceResponse = LotusResponse<string>
export type MpoolPushResponse = LotusResponse<CID>
export type WaitMsgResponse = LotusResponse<MsgLookup>

// RPC methods params

export interface GasEstimateParams {
  /**
   * Message to estimate gas for
   *
   * @see https://lotus.filecoin.io/reference/lotus/gas/#gasestimatemessagegas
   */
  msg: PartialMessageObj
  /**
   * Max fee to pay for gas (attoFIL/gas units)
   *
   * @default '0'
   */
  maxFee?: string
}

export interface PushMessageParams {
  msg: MessageObj
  signature: SignatureObj
}

export interface waitMsgParams {
  cid: CID
  /**
   * Confidence depth to wait for
   *
   * @default 2
   */
  confidence?: number
  /**
   * How chain epochs to look back to find the message
   *
   * @default 100
   */
  lookback?: number
}

// Token types
export type FormatOptions = BigNumber.Format & {
  /**
   * @default 18
   * @see https://mikemcl.github.io/bignumber.js/#decimal-places
   */
  decimalPlaces?: number
  /**
   * @default BigNumber.ROUND_HALF_DOWN
   * @see https://mikemcl.github.io/bignumber.js/#constructor-properties
   */
  roundingMode?: BigNumber.RoundingMode
}
