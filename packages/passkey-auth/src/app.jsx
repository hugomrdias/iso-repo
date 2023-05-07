import { Router } from 'preact-router'
import Home from './home.jsx'
import Login from './login.jsx'
import Test from './test.jsx'

export function App() {
  return (
    <>
      <main className="App">
        <Router>
          <Home path="/" />
          <Test path="/test" />
          <Login path="/login" />
        </Router>
      </main>
    </>
  )
}
