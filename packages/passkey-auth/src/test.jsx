/* eslint-disable unicorn/no-useless-undefined */
/* eslint-disable no-console */
import { utf8 } from 'iso-base/utf8'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'preact/hooks'
import { signal, effect } from '@preact/signals'
import { credentialsCreate, credentialsGet, supports } from 'iso-passkeys'
import { set, get } from 'idb-keyval'

// Signals
const supportsLargeBlob = signal(false)
const supportsPrf = signal(false)
const credentials = signal(
  /** @type { import('iso-passkeys/types').PublicKeyCredentialDescriptorJSON[] | undefined} */ (
    undefined
  )
)

effect(() => {
  if (credentials.value) {
    set('credentials', credentials.value)
  }
})

/**
 * @param {import('preact').Attributes} props
 */
export default function Test(props) {
  useEffect(() => {
    get('credentials').then((value) => {
      credentials.value = value || []
    })
  }, [])

  async function resetCredentials() {
    credentials.value = []
  }

  return (
    <>
      <div className="login">
        {credentials.value && credentials.value.length > 0 && <Login />}
        <Registration />
        <details open={true}>
          <summary>Support</summary>
          <pre>
            <code>
              navigator.credentials
              {supports.credentials ? '✅' : '❌'}
              <br />
              PublicKeyCredential
              {supports.webauthn ? '✅' : '❌'}
              <br />
              conditionalMediation
              {supports.conditionalMediation ? '✅' : '❌'}
              <br />
              platformAuthenticator
              {supports.platformAuthenticator ? '✅' : '❌'}
              <br />
              largeBlob {supportsLargeBlob.value ? '✅' : '❌'} - Click the
              register button
              <br />
              PRF {supportsPrf.value ? '✅' : '❌'} - Click the register button
              <br />
              {globalThis.navigator.userAgent}
            </code>
          </pre>

          <p>
            <b>Credentials</b>
          </p>
          <ol>
            {credentials.value?.map((cred) => {
              return (
                <li key={cred.id} style="margin-left: 15px ">
                  {' '}
                  {cred.id}
                  {JSON.stringify(cred.transports?.join(','))}{' '}
                  {JSON.stringify(cred.clientExtensionResults)}
                  {JSON.stringify(
                    cred.attestationObject.authData.extensionsData
                  )}
                </li>
              )
            })}
          </ol>
        </details>
        <button onClick={resetCredentials}>Reset Credentials</button>
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

/**
 *
 */
function Login() {
  const [errorMsg, setErrorMsg] = useState('')

  /** @type {import('preact/src/jsx.js').JSXInternal.GenericEventHandler<HTMLFormElement>} */
  async function onSubmit(event) {
    event.preventDefault()
    try {
      const salt1 = utf8.decode('hello')
      const salt2 = utf8.decode('hello2')
      const creds = await get('credentials')
      const credential = await credentialsGet({
        publicKey: {
          challenge: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          allowCredentials: [
            {
              id: creds[0].id,
              type: 'public-key',
              transports: creds[0].transports,
            },
          ],
          userVerification: 'discouraged',
          rpId: document.location.host,
          extensions: {
            largeBlob: {
              // read: true,
              write: utf8.decode('hello world').buffer,
            },
            prf: {
              eval: {
                first: salt1.buffer,
                second: salt2.buffer,
              },
            },
          },
        },
      })
      console.log('Credential Login', credential)
    } catch (error) {
      // @ts-ignore
      setErrorMsg(error.message)
      console.error(error)
    }
  }

  return (
    <form autoComplete="on" onSubmit={onSubmit}>
      <h4>Login</h4>
      <label>
        <span>Type your username</span>
        <input
          type="text"
          name="username"
          placeholder="joe"
          autoFocus
          autoComplete="username webauthn"
          value="user.name"
        />
      </label>

      <button type="submit">Login</button>

      {errorMsg && <p className="error">{errorMsg}</p>}
    </form>
  )
}

/**
 * Registration form
 *
 */
function Registration() {
  const [errorMsg, setErrorMsg] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  /** @type {import('react-hook-form').SubmitHandler<import('react-hook-form').FieldValues>} */
  const onSubmit = async (data) => {
    console.log(data)
    // reset supports
    supportsLargeBlob.value = false
    supportsPrf.value = false

    const {
      attestation,
      authenticatorAttachment,
      userVerification,
      largeBlob,
      challenge,
      prfSalt,
    } = data

    try {
      const salt1 = utf8.decode(prfSalt)
      const salt2 = utf8.decode(prfSalt + '2')
      const credential = await credentialsCreate({
        publicKey: {
          excludeCredentials: credentials.value,
          challenge,
          rp: {
            name: document.location.host,
            id: document.location.host,
          },
          user: {
            id: 'user.id',
            name: 'user.name',
            displayName: 'user.displayName',
          },
          attestation,
          authenticatorSelection: {
            authenticatorAttachment,
            userVerification,
            requireResidentKey: true,
            residentKey: 'required',
          },
          extensions: {
            credProps: true,
            largeBlob: {
              support: largeBlob,
            },
            prf: {
              eval: {
                first: salt1.buffer,
                second: salt2.buffer,
              },
            },
          },
        },
      })
      console.log('Credential:', credential)

      // @ts-ignore
      credentials.value = [...credentials.value, credential]

      if (
        credential.clientExtensionResults.largeBlob &&
        credential.clientExtensionResults.largeBlob.supported
      ) {
        supportsLargeBlob.value = true
      }

      if (credential.clientExtensionResults.prf?.enabled) {
        supportsPrf.value = true
      }
    } catch (error) {
      console.error('An unexpected error happened:', error)
      // @ts-ignore
      setErrorMsg(error.message)
    }
  }

  return (
    <>
      <form autoComplete="on" onSubmit={handleSubmit(onSubmit)}>
        <h4>Registration</h4>
        <details open={false}>
          <summary>Options</summary>
          <label>
            <span>Challenge</span>
            <input
              type="text"
              placeholder="challenge"
              value="somechallengestring"
              {...register('challenge')}
            />
          </label>
          <label>
            <span>PRF Salt</span>
            <input
              type="text"
              placeholder="PRF Salt"
              value="webauthn-passkey-prf-salt"
              {...register('prfSalt')}
            />
          </label>
          <label>
            <span>Attestation</span>
            <select {...register('attestation')}>
              <option value="none">none</option>
              <option value="direct">direct</option>
              <option value="enterprise">enterprise</option>
              <option value="indirect">indirect</option>
            </select>
          </label>
          <label>
            <span>Authenticator</span>
            <select
              {...register('authenticatorAttachment', {
                setValueAs: (v) => (v === '' ? undefined : v),
              })}
            >
              <option value="" />
              <option value="cross-platform">cross-platform</option>
              <option value="platform">platform</option>
            </select>
          </label>
          <label>
            <span>User Verification</span>
            <select {...register('userVerification')}>
              <option value="discouraged">discouraged</option>
              <option value="preferred" selected>
                preferred
              </option>
              <option value="required">required</option>
            </select>
          </label>
          <label>
            <span>Large Blob (not blog)</span>
            <select
              {...register('largeBlob', {
                setValueAs: (v) => (v === '' ? undefined : v),
              })}
            >
              <option value="" />
              <option value="preferred" selected>
                preferred
              </option>
              <option value="required">required</option>
            </select>
          </label>
        </details>

        <button type="submit">Register</button>

        {errorMsg && <p className="error">{errorMsg}</p>}
      </form>
    </>
  )
}
