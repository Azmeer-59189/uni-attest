import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/uploads/certificates': { target: process.env.API_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true },
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
