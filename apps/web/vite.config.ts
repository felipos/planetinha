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
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
