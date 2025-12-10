import type * as _Eth from '@ledgerhq/hw-app-eth'
import type * as _LedgerTransport from '@ledgerhq/hw-transport'
import type * as _TransportWebHID from '@ledgerhq/hw-transport-webhid'
import type {
  Connector,
  ConnectorEventMap,
  CreateConnectorFn,
  Storage,
  Transport as WagmiTransport,
} from '@wagmi/core'
import type { Compute, Emitter } from '@wagmi/core/internal'
import type { Chain, NonceManager } from 'viem'
import type { Address, LocalAccount } from 'viem/accounts'

export type LedgerTransportType = _LedgerTransport.default
export type LedgerEthAppType = _Eth.default
export type LedgerEthAppClass = typeof _Eth.default

export interface DerivationPathParts {
  /** The account index to use in the path (`"m/44'/60'/${accountIndex}'/0/0"`). */
  accountIndex?: number | undefined
  /** The change index to use in the path (`"m/44'/60'/0'/${changeIndex}/0"`). */
  changeIndex?: number | undefined
  /** The address index to use in the path (`"m/44'/60'/0'/0/${addressIndex}"`). */
  addressIndex?: number | undefined
}

export interface LedgerToAccountParameters extends DerivationPathParts {
  /** The ledger transport to use. */
  transport: LedgerTransportType
  /** Whether to verify the address on the device. */
  verifyAddress?: boolean | undefined
  /** The nonce manager to use. */
  nonceManager?: NonceManager | undefined
  /** Whether to force blind signing. */
  forceBlindSigning?: boolean | undefined
}

export type LedgerAccount = LocalAccount<'ledger'>

export interface MessageTypeProperty {
  name: string
  type: string
}

// connector types

export type TransportWebHIDClass = typeof _TransportWebHID.default

export interface LedgerParameters extends DerivationPathParts {
  /** Whether to verify the address on the device. */
  verifyAddress?: boolean | undefined
  /** Whether to force blind signing. */
  forceBlindSigning?: boolean | undefined
}

export type StorageItem = {
  ledgerDevice: number
  recentConnectorId: string
  store: {
    state: {
      chainId: number
    }
  }
}
export interface Config {
  chains: readonly [Chain, ...Chain[]]
  emitter: Emitter<ConnectorEventMap>
  storage?: Compute<Storage<StorageItem>> | null | undefined
  transports?: Record<number, WagmiTransport> | undefined
}

export type Properties = {
  getEth(): Promise<LedgerEthAppType>
  onHidDisconnect(event: HIDConnectionEvent): Promise<void>
  changeAccount(parts?: DerivationPathParts): Promise<readonly Address[]>
}
export type LedgerConnector = Connector<
  CreateConnectorFn<unknown, Properties, StorageItem>
>
