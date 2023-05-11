/* eslint-disable no-console */
/* eslint-disable unicorn/no-useless-undefined */
import pDebounce from 'p-debounce'
import { route } from 'preact-router'
import { useState } from 'preact/hooks'
import { useOdd } from './odd-preact/index.jsx'

/**
 * @param {import('preact').Attributes} props
 */
export default function Register(props) {
  const { program, isLoading, isUsernameAvailable } = useOdd({
    redirectTo: '/',
    redirectIfFound: true,
  })

  const [errorMsg, setErrorMsg] = useState('')
  const [mode, setMode] = useState(false)

  /** @type {import('preact/src/jsx.js').JSXInternal.GenericEventHandler<HTMLInputElement>} */
  async function onChange(event) {
    // @ts-ignore
    const username = event.target.value

    try {
      const res = await isUsernameAvailable(username)
      setMode(res)
      setErrorMsg('')
    } catch (error) {
      setMode(false)
      // @ts-ignore
      setErrorMsg(error.message)
      console.error(error)
    }
  }
  const debouncedFn = pDebounce(onChange, 200, {})

  /** @type {import('preact/src/jsx.js').JSXInternal.GenericEventHandler<HTMLFormElement>} */
  async function onSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = /** @type {string | null} */ (formData.get('username'))

    if (!username) return

    try {
      const reg = await program?.auth.register({ username })
      if (reg && reg.success) {
        setErrorMsg('')
        route('/login')
      } else {
        setErrorMsg('Registration failed')
      }
    } catch (error) {
      // @ts-ignore
      setErrorMsg(error.message)
      console.error(error)
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <div className="login">
        <form autoComplete="on" onSubmit={onSubmit}>
          <label>
            <input
              type="text"
              name="username"
              placeholder="username"
              autoFocus
              autoComplete="username webauthn"
              onChange={debouncedFn}
            />
          </label>

          <button type="submit" disabled={!mode}>
            Register
          </button>

          {errorMsg && <p className="error">{errorMsg}</p>}
          <p>
            Navigate to{' '}
            <code>
              chrome://flags/#enable-experimental-web-platform-features
            </code>{' '}
            and enable it
          </p>
        </form>
      </div>

      <style jsx>{`
        .login {
          max-width: 21rem;
          margin: 0 auto;
          padding: 1rem;
          border: 1px solid #f0f0f0;
          border-radius: 4px;
        }
        form,
        label {
          display: flex;
          flex-flow: column;
        }
        .error {
          color: brown;
          margin: 1rem 0 0;
        }
      `}</style>
    </>
  )
}
