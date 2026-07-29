import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/collector/',
  server: {
    port: 5173,
    strictPort: true,
    open: '/collector/',
  },
})
