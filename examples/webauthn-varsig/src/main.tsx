import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app.tsx'
import './index.css'

// biome-ignore lint/style/noNonNullAssertion: react root is present in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
