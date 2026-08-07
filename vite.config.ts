import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import heapMarkers from 'react-memory-leak-detector/vite'

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    // Dev-only (apply: "serve" by default): tags every component/hook with a
    // heap marker + a synthetic unmount-tracking effect. Runs as its own
    // enforce:"pre" transform, so it no longer needs @vitejs/plugin-react's
    // `babel` option (removed in v6) — works with plugin-react v5 or v6.
    heapMarkers({ leakAgeMs: 5000 }),
    react(),
  ],
}))
