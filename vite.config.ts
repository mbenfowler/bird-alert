import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Listen on IPv4 and IPv6 so both `localhost` resolutions (and CI) reach the dev server.
    host: true,
    // Same-origin /api in development, so the session cookie is first-party (see vercel.json for production).
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: { outDir: 'dist' }
})
