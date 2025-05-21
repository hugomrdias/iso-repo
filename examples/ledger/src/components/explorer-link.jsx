import { useFilecoinProvider } from 'iso-filecoin-react'
import * as chains from 'iso-filecoin/chains'
import { CopyIcon } from './icons'

/**
 *
 * @param {object} param0
 * @param {string} [param0.address]
 * @param {'filecoin' | 'ethereum' | 'id'} [param0.chain]
 */
export default function ExplorerLink({ address, chain }) {
  const { network } = useFilecoinProvider()

  /**
   * @param {string} address
   */
  function onCopy(address) {
    navigator.clipboard.writeText(address)
  }

  let icon
  switch (chain) {
    case 'filecoin':
      icon = '⨎'
      break
    case 'ethereum':
      icon = 'Ξ'
      break
    case 'id':
      icon = '#'
      break
    default:
      icon = '⨎'
      break
  }
  if (!address)
    return (
      <div>
        {icon} <small>...</small>
      </div>
    )

  return (
    <div>
      {icon}{' '}
      <a
        target="_blank"
        rel="noreferrer"
        href={`${chains[network].blockExplorers?.default?.url}/address/${address}`}
      >
        {address}
      </a>{' '}
      <CopyIcon width={16} height={16} onClick={() => onCopy(address)} />
    </div>
  )
}
