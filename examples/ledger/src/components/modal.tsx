import type React from 'react'
import { type FC, type PropsWithChildren, useEffect, useRef } from 'react'
import '../styles/modal.css'
import { CloseButton } from './close-button'

export type ModalProps = PropsWithChildren<{
  isOpen: boolean
  hasCloseBtn?: boolean
  onClose?: () => void
}>

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  hasCloseBtn = true,
  children,
}) => {
  const modalRef = useRef<HTMLDialogElement>(null)

  const handleCloseModal = () => {
    if (onClose) {
      onClose()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      handleCloseModal()
    }
  }
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.currentTarget.tagName !== 'DIALOG')
      //This prevents issues with forms
      return

    const rect = e.currentTarget.getBoundingClientRect()

    const clickedInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width

    if (clickedInDialog === false) handleCloseModal()
  }

  useEffect(() => {
    const modalElement = modalRef.current
    if (!modalElement) return

    // Open modal when 'isOpen' changes to true
    if (isOpen) {
      modalElement.showModal()
    } else {
      modalElement.close()
    }
  }, [isOpen])

  return (
    <dialog
      ref={modalRef}
      className="modal"
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      {hasCloseBtn && <CloseButton onClick={handleCloseModal} />}
      {children}
    </dialog>
  )
}

export default Modal
