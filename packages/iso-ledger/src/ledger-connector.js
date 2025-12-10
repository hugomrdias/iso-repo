import _TransportWebHID from '@ledgerhq/hw-transport-webhid'
import { ChainNotConfiguredError, createConnector } from '@wagmi/core'
import { createWalletClient, getAddress } from 'viem'
import {
  Eth,
  ledgerToAccount,
  TransportStatusError,
} from './ledger-to-account.js'

/**
 * @import {TransportWebHIDClass, LedgerConnector, Config, LedgerParameters, Properties, LedgerEthAppType, StorageItem, DerivationPathParts} from './types.ts'
 * @import {Connector} from '@wagmi/core'
 * @import {Chain, Address} from 'viem'
 */

// needs buffer polyfill in vite config
export const TransportWebHID = /** @type {TransportWebHIDClass} */ (
  _TransportWebHID
)

/**
 *
 * @param {Connector} connector
 * @returns {LedgerConnector | undefined}
 */
export function asLedgerConnector(connector) {
  if (connector.type !== 'ledger') {
    return undefined
  }
  return /** @type {LedgerConnector} */ (connector)
}

/**
 *
 * @param {Connector | undefined} connector
 * @returns { connector is LedgerConnector}
 */
export function isLedgerConnector(connector) {
  if (!connector) {
    return false
  }
  return connector.type === 'ledger'
}

/**
 * Get the chain from the config
 *
 * @param {Config} config
 * @param {number | undefined} chainId
 * @returns {Promise<Chain>}
 */
async function getChain(config, chainId) {
  if (!chainId) {
    const store = await config.storage?.getItem('store')
    if (store?.state?.chainId) {
      chainId = store?.state?.chainId
    } else {
      chainId = config.chains[0].id
    }
  }

  const chain = config.chains.find((chain) => chain.id === chainId)
  if (!chain) {
    throw new ChainNotConfiguredError()
  }
  return chain
}

/**
 * Find the device from the config
 *
 * @param {Config} config
 * @returns {Promise<HIDDevice | undefined>}
 */
async function findDevice(config) {
  const devices = await TransportWebHID.list()
  const ledgerDevice = await config.storage?.getItem('ledgerDevice')

  return devices.find((device) => device.productId === ledgerDevice)
}

/**
 * Create a ledger connector
 *
 * Notice: Ledger packages need Buffer polyfill in the browser.
 *
 * @param {LedgerParameters} parameters
 */
export function ledger({
  accountIndex = 0,
  addressIndex = 0,
  changeIndex = 0,
  verifyAddress = false,
  forceBlindSigning = false,
} = {}) {
  /** @type {Properties['onHidDisconnect'] | undefined} */
  let onHidDisconnect
  /** @type {number | undefined} */
  let currentChainId
  /** @type {LedgerEthAppType | undefined} */
  let _eth
  /** @type {Promise<LedgerEthAppType> | undefined} */
  let ethPromise
  /** @type {string} */
  let path = `m/44'/60'/${accountIndex}'/${changeIndex}/${addressIndex}`

  return /** @type {typeof createConnector<unknown, Properties, StorageItem>} */ (
    createConnector
  )((config) => {
    return {
      id: 'ledger',
      name: 'Ledger',
      type: 'ledger',

      async setup() {
        const isSupported = await TransportWebHID.isSupported()
        if (!isSupported) {
          throw new Error('Ledger is not supported')
        }
      },

      async connect({ chainId, withCapabilities } = {}) {
        const chain = await getChain(config, chainId)
        currentChainId = chain.id
        try {
          const eth = await this.getEth()
          const appConfig = await eth.getAppConfiguration()
          if (forceBlindSigning && appConfig.arbitraryDataEnabled === 0) {
            throw new Error(
              'Blind signing is not enabled on your Ledger device'
            )
          }

          if (!onHidDisconnect) {
            onHidDisconnect = this.onHidDisconnect.bind(this)
            navigator.hid.addEventListener('disconnect', onHidDisconnect)
          }

          const { address } = await eth.getAddress(
            path,
            verifyAddress,
            false,
            currentChainId?.toString()
          )
          const _address = getAddress(address)
          config.emitter.emit('connect', {
            accounts: [_address],
            chainId: currentChainId,
          })
          return {
            accounts: /** @type {never} */ (
              withCapabilities
                ? [{ address: _address, capabilities: {} }]
                : [_address]
            ),
            chainId: currentChainId,
          }
        } catch (error) {
          // Ledger device: UNKNOWN_ERROR (0x6511)
          if (
            error instanceof TransportStatusError &&
            error.statusCode === 25873
          ) {
            throw new Error(
              'Open the Ethereum app on your Ledger device to continue'
            )
          }
          throw error
        }
      },

      async isAuthorized() {
        const device = await findDevice(config)
        const recentConnectorId =
          await config.storage?.getItem('recentConnectorId')

        if (device && recentConnectorId === 'ledger') {
          return true
        }
        return false
      },

      async disconnect() {
        const eth = await this.getEth()
        await eth.transport.close()
        _eth = undefined
        if (onHidDisconnect) {
          navigator.hid.removeEventListener('disconnect', onHidDisconnect)
          onHidDisconnect = undefined
        }
        const device = await findDevice(config)
        if (device) {
          await device.forget()
        }
        await config.storage?.removeItem('ledgerDevice')
      },

      /**
       *
       * @param {{ chainId?: number | undefined }} [parameters]
       */
      async getClient(parameters) {
        const chain = await getChain(
          config,
          parameters?.chainId ?? currentChainId
        )
        const eth = await this.getEth()
        const viemTransport = config.transports?.[chain.id]
        if (!viemTransport) {
          throw new Error('Viem Transport not found')
        }
        return createWalletClient({
          transport: viemTransport,
          key: 'ledgerWallet',
          name: 'Ledger Wallet Client',
          chain,
          account: await ledgerToAccount({
            transport: eth.transport,
            accountIndex,
            addressIndex,
            changeIndex,
          }),
        })
      },

      async getAccounts() {
        const eth = await this.getEth()
        const { address } = await eth.getAddress(
          path,
          false,
          false,
          currentChainId?.toString()
        )
        return [getAddress(address)]
      },

      async switchChain(parameters) {
        const chain = await getChain(
          config,
          parameters?.chainId ?? currentChainId
        )
        currentChainId = chain.id

        /**
         *
         * @param {number} chainId
         */
        function sendAndWaitForChangeEvent(chainId) {
          return /** @type {Promise<void>} */ (
            new Promise((resolve) => {
              /** @satisfies {Parameters<typeof config.emitter.on>[1]} */
              const listener = (data) => {
                if ('chainId' in data && data.chainId === chainId) {
                  config.emitter.off('change', listener)
                  resolve()
                }
              }
              config.emitter.on('change', listener)
              config.emitter.emit('change', { chainId })
            })
          )
        }

        await sendAndWaitForChangeEvent(chain.id)
        return chain
      },

      async getChainId() {
        const chain = await getChain(config, currentChainId)
        return chain.id
      },

      /**
       *
       * @param {HIDConnectionEvent} event
       */
      async onHidDisconnect(event) {
        const ledgerDevice = await config.storage?.getItem('ledgerDevice')
        if (ledgerDevice === event.device.productId) {
          await this.disconnect()
          await event.device.forget()
          config.emitter.emit('disconnect')
        }
      },

      async getEth() {
        async function init() {
          const transport = await TransportWebHID.create()
          // @ts-expect-error - transport.device is not typed
          config.storage?.setItem('ledgerDevice', transport.device.productId)
          const eth = new Eth(transport)
          return eth
        }

        if (!_eth) {
          if (!ethPromise) {
            ethPromise = init()
          }
          _eth = await ethPromise
          ethPromise = undefined
        }
        return _eth
      },

      /**
       *
       * @param {DerivationPathParts} [parts]
       */
      async changeAccount(parts = {}) {
        accountIndex = parts.accountIndex ?? accountIndex
        changeIndex = parts.changeIndex ?? changeIndex
        addressIndex = parts.addressIndex ?? addressIndex
        path = `m/44'/60'/${accountIndex}'/${changeIndex}/${addressIndex}`
        const accounts = await this.getAccounts()

        config.emitter.emit('change', { accounts, chainId: currentChainId })
        return accounts
      },
      async getProvider() {
        const isSupported = await TransportWebHID.isSupported()
        if (!isSupported) {
          return undefined
        }
        return {}
      },
      onAccountsChanged() {
        // no-op
      },
      onChainChanged() {
        // no-op
      },
      async onDisconnect() {
        // no-op
      },
    }
  })
}
