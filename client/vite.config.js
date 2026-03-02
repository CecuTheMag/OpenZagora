import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://server:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/api/files': {
        target: 'http://server:5000',
        changeOrigin: true,
        secure: false
      },
      '/admin-api': {
        target: 'http://admin-server:5001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://admin-server:5001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})
