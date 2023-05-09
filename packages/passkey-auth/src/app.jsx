/* eslint-disable unicorn/no-useless-undefined */
import * as odd from '@oddjs/odd'
import { Router } from 'preact-router'
import Home from './home.jsx'
import Login from './login.jsx'
import { OddContextProvider } from './odd-passkey-preact/index.jsx'
import Register from './register.jsx'
import Test from './test.jsx'
import * as OddPasskey from './odd-passkey-core/index.js'

/** @type {import('@oddjs/odd').Configuration} */
const config = {
  namespace: {
    creator: document.location.host,
    name: 'Passkey auth',
  },
  debug: true,
  debugging: {
    injectIntoGlobalContext: true,
  },
}

async function init() {
  const defaultStorage = odd.defaultStorageComponent(config)
  const crypto = await odd.defaultCryptoComponent(config)
  const manners = OddPasskey.Manners.implementation(config, defaultStorage)
  const defaultReference = await odd.defaultReferenceComponent({
    crypto,
    manners,
    storage: defaultStorage,
  })
  const auth = OddPasskey.Auth.implementation({
    crypto,
    reference: defaultReference,
    storage: defaultStorage,
    config,
  })

  return {
    auth,
    crypto,
    manners,
    storage: defaultStorage,
    reference: defaultReference,
  }
}

export function App() {
  return (
    <>
      <OddContextProvider config={config} componentsFactory={init}>
        <main className="App">
          <Router>
            <Home path="/" />
            <Test path="/test" />
            <Login path="/login" />
            <Register path="/register" />
          </Router>
        </main>
      </OddContextProvider>
    </>
  )
}
