import {
  useAccount,
  useAdapter,
  useAddresses,
  useBalance,
  useChangeNetwork,
  useDeriveAccount,
  useDisconnect,
} from 'iso-filecoin-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ConnectModal } from './connect-modal.jsx'
import ExplorerLink from './explorer-link.jsx'
import { toast } from './toast.jsx'

/**
 * Connect to the network.
 */
export default function ConnectLedger() {
  const [isOpen, setIsOpen] = useState(false)
  const { error } = useAdapter()
  const { account, network, adapter, address } = useAccount()
  const disconnect = useDisconnect()
  const balance = useBalance()
  const { address0x, addressId } = useAddresses({ address })
  const changeNetwork = useChangeNetwork()
  const deriveAccount = useDeriveAccount()

  useEffect(() => {
    if (account) {
      setIsOpen(false)
    }
  }, [account])

  useLayoutEffect(() => {
    const _err = error ?? changeNetwork.error ?? deriveAccount.error
    if (_err && !isOpen) {
      toast.error(_err)
    }
  }, [error, changeNetwork.error, deriveAccount.error, isOpen])

  return (
    <div className="Cell100 Box Grid">
      <div className="Cell50">
        <h3>Network</h3>
        <select
          name="network"
          id="network"
          className="u-FullWidth"
          disabled={changeNetwork.isPending}
          onChange={(event) => {
            const value = /** @type {import('iso-filecoin/types').Network} */ (
              event.target.value
            )
            changeNetwork.mutate(value)
          }}
          value={network}
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
      </div>
      <div
        className="Cell50"
        style={{
          alignContent: 'center',
          textAlign: 'center',
        }}
      >
        {!account && (
          <button type="button" onClick={() => setIsOpen(true)}>
            Connect
          </button>
        )}
        {account && (
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            Disconnect
          </button>
        )}
      </div>

      {account && (
        <div className="Cell100">
          <h3>Wallet</h3>
          <p>{adapter?.name}</p>
          <p>{adapter?.url}</p>
          <br />
          <h3>Account</h3>
          <code>{account?.path}</code>
          <ExplorerLink
            address={account?.address.toString()}
            chain="filecoin"
          />
          <ExplorerLink address={addressId.data?.toString()} chain="id" />
          <ExplorerLink address={address0x.data?.toString()} chain="ethereum" />
          <div>
            <b>
              {balance.data?.value?.toFIL().toFormat({
                decimalPlaces: 2,
                suffix: ` ${balance.data.symbol}`,
              }) ?? '...'}
            </b>
          </div>
          <br />
          <hr />
          <br />

          <button
            type="button"
            onClick={() => deriveAccount.mutate(1)}
            disabled={deriveAccount.isPending}
          >
            Change to Account 1
          </button>
          <button
            type="button"
            onClick={() => deriveAccount.mutate(0)}
            disabled={deriveAccount.isPending}
          >
            Change to Account 0
          </button>
          <button
            type="button"
            // @ts-ignore
            onClick={() => changeNetwork.mutate('eeee')}
            disabled={changeNetwork.isPending}
          >
            Change Network Error
          </button>
        </div>
      )}

      <ConnectModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </div>
  )
}
