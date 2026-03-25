/**
 * main.jsx — Vite entry: mounts the app, loads global styles, and runs env validation side effects.
 * `./config/env` asserts `VITE_API_BASE_URL` is HTTPS (or localhost) when set.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config/env'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
