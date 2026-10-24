import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.BANTAYLUBAK_API_URL ?? 'http://127.0.0.1:8000'
// Phone mode: listen on the LAN over HTTPS (self-signed). Phone browsers only allow the
// camera on HTTPS or localhost. The backend stays on 127.0.0.1, reached via the proxy.
const phoneMode = process.env.BANTAYLUBAK_PHONE === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: phoneMode ? [react(), basicSsl()] : [react()],
  server: {
    port: 5173,
    host: phoneMode ? '0.0.0.0' : undefined,
    proxy: {
      '/api': apiTarget,
      '/media': apiTarget,
    },
  },
})
