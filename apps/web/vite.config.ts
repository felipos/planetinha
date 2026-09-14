import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The frontend calls a relative API path, so it needs no base URL variable and no CORS
// configuration: in development the dev server forwards that path to the containerised api, and
// in production the reverse proxy does the same. Running the frontend on the host this way keeps
// hot module reloading intact.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forwarded to the containerised stack's reverse proxy, the same single address the built
    // frontend is served from in production — so a developer runs the frontend on their host
    // against the real api, with hot module reloading intact.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
