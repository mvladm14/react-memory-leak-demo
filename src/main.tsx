import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev-only: install the live memory-leak tracker (window.__heapTracker). This
// dynamic import is dead-code-eliminated from production builds.
if (import.meta.env.DEV) {
  import('react-memory-leak-detector/runtime')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
