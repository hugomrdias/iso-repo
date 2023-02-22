import { render } from 'preact'
import { App } from './app.jsx'
import './styles/index.css'

const appEl = document.querySelector('#app')

if (appEl) {
  render(<App />, appEl)
}
