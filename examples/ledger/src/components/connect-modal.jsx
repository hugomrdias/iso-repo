import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { useConnect } from 'iso-filecoin-react'
import { WalletAdapterHd } from 'iso-filecoin-wallets/hd'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { ErrorBox } from './common.jsx'
import Modal from './modal.tsx'

/**
 * @typedef {Object} Inputs
 * @property {string} mnemonic
 * @property {string} password
 * @property {number} index
 */

/**
 * Modal component for connecting wallets
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {(isOpen: boolean) => void} props.setIsOpen - Function to set modal open state
 */
export function ConnectModal({ isOpen, setIsOpen }) {
  const {
    error,
    adapters,
    mutate: connect,
    isPending,
    loading,
    reset,
  } = useConnect()
  const [HDAdapter, setHDAdapter] =
    /** @type {typeof useState<WalletAdapterHd | undefined>} */ (useState)(
      undefined
    )
  const handleClose = () => {
    setHDAdapter(undefined)
    setIsOpen(false)
    reset()
  }

  if (HDAdapter) {
    return (
      <HDModal
        adapter={HDAdapter}
        isOpen={isOpen}
        handleClose={handleClose}
        setHDAdpter={setHDAdapter}
      />
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h4>Connect a wallet</h4>
      {adapters.map((adapter) => (
        <button
          key={adapter.name}
          title={
            adapter.support === 'NotDetected' && adapter.name === 'Filsnap'
              ? 'Install Metamask'
              : adapter.name
          }
          type="button"
          className="modal-button"
          onClick={() => {
            if (WalletAdapterHd.is(adapter)) {
              setHDAdapter(adapter)
            } else {
              connect({ adapter })
            }
          }}
          disabled={isPending || adapter.support === 'NotDetected' || loading}
        >
          <span>{adapter.name}</span>
        </button>
      ))}
      {error && <ErrorBox error={error} />}
    </Modal>
  )
}

/**
 * Modal component for connecting HD wallets
 *
 * @param {object} props
 * @param {WalletAdapterHd} props.adapter
 * @param {boolean} props.isOpen
 * @param {() => void} props.handleClose
 * @param {(adapter: undefined) => void} props.setHDAdpter
 */
function HDModal({ adapter, isOpen, handleClose, setHDAdpter }) {
  const { error, mutate: connect } = useConnect()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    reset,
  } = /** @type {import('react-hook-form').UseFormReturn<Inputs>} */ (useForm())

  /** @type {import('react-hook-form').SubmitHandler<Inputs>} */
  const onSubmit = (data) => {
    adapter.setup({
      mnemonic: data.mnemonic,
      password: data.password,
      index: Number.isInteger(data.index) ? data.index : 0,
    })
    connect({
      adapter,
    })
    reset()
    setHDAdpter(undefined)
    return
  }
  const onClose = () => {
    handleClose()
    reset()
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h4>Connect Burner Wallet</h4>
      <form onSubmit={handleSubmit(onSubmit)}>
        <label className="u-FullWidth">
          <span>Mnemonic</span>
          <input
            data-1p-ignore
            autoComplete="off"
            type="text"
            placeholder="already turtle birth enroll since owner keep patch skirt drift any dinner"
            className="u-FullWidth"
            {...register('mnemonic', {
              required: 'Mnemonic is required',
              validate: (value) => {
                return bip39.validateMnemonic(value, wordlist)
                  ? true
                  : 'Invalid mnemonic'
              },
            })}
          />
        </label>
        <small>{errors.mnemonic?.message}</small>
        <label className="u-FullWidth">
          <span>Password (optional)</span>
          <input
            data-1p-ignore
            autoComplete="off"
            type="password"
            placeholder="Enter your password"
            className="u-FullWidth"
            {...register('password')}
          />
        </label>
        <label className="u-FullWidth">
          <span>Address Index</span>
          <input
            type="number"
            placeholder="0"
            className="u-FullWidth"
            {...register('index')}
          />
        </label>
        <button
          title="Connect Burner Wallet"
          type="submit"
          className="modal-button"
          disabled={!isValid}
        >
          Import
        </button>
        <button
          title="Generate Burner Wallet"
          type="button"
          className="modal-button"
          onClick={() => {
            setValue('mnemonic', bip39.generateMnemonic(wordlist), {
              shouldValidate: true,
            })
          }}
        >
          Generate
        </button>
      </form>
      {error && <ErrorBox error={error} />}
    </Modal>
  )
}
