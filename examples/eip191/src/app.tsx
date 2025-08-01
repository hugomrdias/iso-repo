import { useState } from 'react'
import './app.css'
import { useAccount } from 'wagmi'
// import { client } from './client'
import { Account } from './components/account'
import { WalletOptions } from './components/wallet-options'

function ConnectWallet() {
  const { isConnected } = useAccount()
  if (isConnected) return <Account />
  return <WalletOptions />
}
function App() {
  const [name, setName] = useState('unknown')

  return (
    <>
      <h1>EIP-191</h1>
      <div className="card">
        <ConnectWallet />
      </div>
      <div className="card">
        {/* <button
          aria-label="get name"
          onClick={async () => {
            const result = await client.request('/account/create', {
              type: 'object',
              properties: {
                name: 'hello',
              },
            })
            setName(result.id)
          }}
          type="button"
        >
          Name from API is: {name}
        </button> */}
      </div>
    </>
  )
}

export default App
