import { type EIP1193Provider, getOrInstallSnap } from 'filsnap-adapter'
import { useEffect, useState } from 'react'
import { type Connector, useConnect } from 'wagmi'
import { mainnet } from 'wagmi/chains'

export function WalletOptions() {
  const { connectors, connect } = useConnect()

  return connectors.map((connector) => (
    <WalletOption
      connector={connector}
      key={connector.uid}
      onClick={async () => {
        const provider = (await connector.getProvider()) as EIP1193Provider
        await getOrInstallSnap(provider, 'local:http://localhost:8080', '*')
        connect({ connector, chainId: mainnet.id })
      }}
    />
  ))
}

function WalletOption({
  connector,
  onClick,
}: {
  connector: Connector
  onClick: () => void
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const provider = await connector.getProvider()
      setReady(!!provider)
    })()
  }, [connector])

  return (
    <button disabled={!ready} onClick={onClick} type="button">
      {connector.name}
    </button>
  )
}
