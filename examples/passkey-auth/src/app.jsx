/* eslint-disable unicorn/no-useless-undefined */
import { Router } from 'preact-router'
import Home from './home.jsx'
import Login from './login.jsx'
import { OddContextProvider } from './odd-preact/index.jsx'
import Register from './register.jsx'
import Test from './test.jsx'
import * as OddPasskey from './odd-passkeys/index.js'

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

export function App() {
  return (
    <>
      <OddContextProvider
        config={config}
        componentsFactory={OddPasskey.createComponents}
      >
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
