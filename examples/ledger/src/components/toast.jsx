import _toast from 'react-hot-toast'
import { CloseButton } from './close-button.jsx'
export const toast = {
  error: (/** @type {Error} */ error) => {
    _toast.error(
      (t) => (
        <div>
          <CloseButton onClick={() => _toast.dismiss(t.id)} />

          <div style={{ marginRight: '20px', maxWidth: '250px' }}>
            {error.message}
          </div>
          {error.cause ? (
            <footer
              style={{ border: 0, fontSize: '0.9rem', maxWidth: '250px' }}
            >
              {error.cause instanceof Error
                ? error.cause.message
                : error.cause.toString()}
            </footer>
          ) : null}
        </div>
      ),
      {
        id: error.message,
      }
    )
  },
}
