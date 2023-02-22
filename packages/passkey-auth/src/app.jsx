import { Router } from 'preact-router'
import Home from './home.jsx'
import Login from './login.jsx'

export function App() {
  return (
    <>
      <main className="App">
        <Router>
          <Home path="/" />
          <Login path="/login" />
        </Router>
      </main>
    </>
  )
}
