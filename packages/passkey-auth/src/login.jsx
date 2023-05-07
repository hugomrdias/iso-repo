/* eslint-disable unicorn/no-useless-undefined */
import { useState } from 'preact/hooks'
import { useWebNative } from './hooks/use-webnative.js'
import { isUsernameAvailable, register, login } from './webnative/index.js'

/**
 * @param {import('preact').Attributes} props
 */
export default function Login(props) {
  const { setSession } = useWebNative({
    redirectTo: '/',
    redirectIfFound: true,
  })

  return (
    <>
      <div className="login">
        <Form setSession={setSession} />
      </div>

      <style jsx>{`
        .login {
          max-width: 21rem;
          margin: 0 auto;
          padding: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
      `}</style>
    </>
  )
}

function Form({ setSession }) {
  const [errorMsg, setErrorMsg] = useState('')
  const [mode, setMode] = useState(
    /** @type { 'register' | 'login' | undefined} */ (undefined)
  )

  /** @type {import('preact/src/jsx.js').JSXInternal.GenericEventHandler<HTMLInputElement>} */
  async function onInput(event) {
    const username = event.currentTarget.value

    try {
      const res = await isUsernameAvailable(username)
      setMode(res === true ? 'register' : 'login')
      setErrorMsg('')
    } catch (error) {
      setMode(undefined)
      // @ts-ignore
      setErrorMsg(error.message)
      console.error(error)
    }
  }

  /** @type {import('preact/src/jsx.js').JSXInternal.GenericEventHandler<HTMLFormElement>} */
  async function onSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = /** @type {string | null} */ (formData.get('username'))

    if (mode === 'register' && username) {
      try {
        const session = await register(username)
        setSession(session)
        setErrorMsg('')
      } catch (error) {
        // @ts-ignore
        setErrorMsg(error.message)
        console.error(error)
      }
    } else {
      try {
        const session = await login(username)
        setSession(session)
        setErrorMsg('')
      } catch (error) {
        // @ts-ignore
        setErrorMsg(error.message)
        console.error(error)
      }
    }
  }
  return (
    <form autoComplete="on" onSubmit={onSubmit}>
      <label>
        <span>Type your username</span>
        <input
          type="text"
          name="username"
          placeholder="joe"
          autoFocus
          autoComplete="username webauthn"
          onInput={onInput}
        />
      </label>

      {mode === 'register' && <button type="submit">Register</button>}
      {mode === 'login' && <button type="submit">Login</button>}

      {errorMsg && <p className="error">{errorMsg}</p>}

      <style jsx>{`
        form,
        label {
          display: flex;
          flex-flow: column;
        }
        label > span {
          font-weight: 600;
        }
        input {
          padding: 8px;
          margin: 0.3rem 0 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .error {
          color: brown;
          margin: 1rem 0 0;
        }
      `}</style>
    </form>
  )
}
