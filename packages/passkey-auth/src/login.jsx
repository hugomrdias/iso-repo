import { utf8 } from 'iso-base'
import { useEffect, useState } from 'preact/hooks'
import { useWebNative } from './hooks/use-webnative.js'
import { program, credentialsCreate, credentialsGet } from './webauthn/api.js'

/**
 * @param {import('preact').Attributes} props
 */
export default function Login(props) {
  const { session, setSession, config } = useWebNative({
    redirectTo: '/',
    redirectIfFound: true,
  })

  const [errorMsg, setErrorMsg] = useState('')
  const [isLogginIn, setIsLogginIn] = useState(false)
  const salt = utf8.decode('webauthn-passkey-prf-salt')

  /**
   * @type {import('preact').JSX.GenericEventHandler<HTMLFormElement>}
   */
  // eslint-disable-next-line unicorn/consistent-function-scoping
  async function onSubmit(event) {
    event.preventDefault()

    const username = event.currentTarget?.username.value

    try {
      await credentialsCreate({
        publicKey: {
          challenge: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          rp: {
            name: 'passkey-auth',
          },
          user: {
            displayName: username,
            id: username,
            name: username,
          },
          pubKeyCredParams: [-8, -7, -257].map((id) => ({
            alg: id,
            type: 'public-key',
          })),
          attestation: 'none',
          authenticatorSelection: {
            // authenticatorAttachment: 'cross-platform',
            userVerification: 'required',
            // requireResidentKey: true,
            // residentKey: 'required',
          },
          extensions: {
            prf: {
              eval: {
                first: salt.buffer,
              },
            },
          },
        },
      })
    } catch (error) {
      console.error('An unexpected error happened:', error)
      setErrorMsg(error.message)
    }
  }

  /**
   * @type {import('preact').JSX.GenericEventHandler<HTMLButtonElement>}
   */
  // eslint-disable-next-line unicorn/consistent-function-scoping
  async function onLogin(event) {
    setIsLogginIn(true)
    try {
      const credential = await credentialsGet({
        mediation: 'required',

        publicKey: {
          challenge: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          allowCredentials: [],
          userVerification: 'required',
          extensions: {
            // @ts-ignore
            prf: {
              eval: {
                first: salt.buffer,
              },
            },
          },
        },
      })
      console.log('🚀 ~ file: login.jsx:87 ~ onLogin ~ credential', credential)

      // @ts-ignore
      const key = credential.clientExtensionResults.prf.results.first

      const p = await program(key, config, credential.userHandle)

      console.log('🚀 ~ file: login.jsx:96 ~ onLogin ~ p?.session', p?.session)
      setSession(p?.session)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <>
      <div className="login">
        <Form
          errorMessage={errorMsg}
          onSubmit={onSubmit}
          onLogin={onLogin}
          isLogginIn={isLogginIn}
        />
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

/**
 *
 * @param {object} props
 * @param {string} props.errorMessage
 * @param {import('preact').JSX.GenericEventHandler<HTMLFormElement>} props.onSubmit
 * @param {import('preact').JSX.GenericEventHandler<HTMLButtonElement>} props.onLogin
 * @param {boolean} props.isLogginIn
 */
function Form({ errorMessage, onSubmit, onLogin, isLogginIn }) {
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
        />
      </label>

      <button type="submit">Register</button>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <button type="button" onClick={onLogin}>
        {!isLogginIn ? 'Login' : 'Loading...'}
      </button>

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
