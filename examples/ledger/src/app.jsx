import { Toaster } from 'react-hot-toast'
import { Logo } from './components/icons.jsx'
import 'ox/window'
import { base64url } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { credentialsCreate, credentialsGet, supports } from 'iso-passkeys'
import { EIP191Signer } from 'iso-signatures/signers/eip191.js'
import * as EIP191 from 'iso-signatures/verifiers/eip191.js'
import { Provider } from 'ox'

/**
 * App component.
 */
export default function App() {
  return (
    <main className="App">
      <div className="Grid">
        <div className="Cell100" style={{ textAlign: 'center' }}>
          <Logo
            width="40"
            height="40"
            style={{ marginRight: '10px', display: 'inline' }}
          />
          <h1 style={{ display: 'inline', verticalAlign: 'super' }}>
            Filecoin Wallet
          </h1>
        </div>
        <div className="Cell100 Box Grid">
          <div className="Cell50">
            <h3>Network</h3>
            <button
              type="button"
              onClick={async () => {
                const signer = await EIP191Signer.from({
                  provider: Provider.from(window.ethereum),
                })
                const msg = utf8.decode('hello world')
                const sig = await signer.sign(msg)
                const verified = await EIP191.verify({
                  signature: sig,
                  message: msg,
                  did: signer,
                })
                console.log('verified', verified)
              }}
            >
              EIP191
            </button>
            <button
              type="button"
              onClick={async () => {
                const credential = await credentialsCreate({
                  publicKey: {
                    challenge: base64url.encode(new Uint8Array([1, 2, 3, 4])),
                    rp: {
                      id: window.location.hostname,
                      name: window.document.title,
                    },
                    user: {
                      id: 'demo-id',
                      name: 'demo-name',
                      displayName: 'demo-display-name',
                    },
                    attestation: 'none',
                    authenticatorSelection: {
                      userVerification: 'required',
                      requireResidentKey: false,
                      residentKey: 'preferred',
                    },

                    extensions: {
                      credProps: true,
                      largeBlob: {
                        support: 'preferred',
                      },
                      prf: {
                        eval: {
                          first: new Uint8Array(
                            Array.from({ length: 32 }).fill(1)
                          ).buffer,
                          second: new Uint8Array(
                            Array.from({ length: 32 }).fill(1)
                          ).buffer,
                        },
                      },
                    },
                  },
                })
                console.log('verified', credential)
              }}
            >
              Webauthn
            </button>

            <button
              type="button"
              onClick={async () => {
                const assertion = await credentialsGet({
                  mediation: 'required',
                  publicKey: {
                    challenge: base64url.encode(new Uint8Array([1, 2, 3, 4])),
                    allowCredentials: [
                      {
                        id: 'VqO7jclnK2AUvrs2BSr38Mi9od77y8HfLGOZq2BPAd4',
                        type: 'public-key',
                      },
                    ],
                    userVerification: 'required',
                    rpId: window.location.hostname,
                  },
                })
                console.log('assertion', assertion)
              }}
            >
              Webauthn Get
            </button>

            <textarea value={'VqO7jclnK2AUvrs2BSr38Mi9od77y8HfLGOZq2BPAd4'} />
          </div>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: '#161f27',
            color: '#dbdbdb',
          },
        }}
      />
    </main>
  )
}
