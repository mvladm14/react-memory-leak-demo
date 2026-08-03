import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import heapMarkers from 'react-memory-leak-detector/babel-plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        // Dev-only: tag every component/hook with a heap marker + a synthetic
        // unmount-tracking effect. Stripped entirely from production builds.
        plugins:
          mode === 'development'
            ? [[heapMarkers, { leakAgeMs: 5000 }]]
            : [],
      },
    }),
  ],
}))
