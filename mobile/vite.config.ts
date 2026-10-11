import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Web preview under Next.js uses /collector/; Capacitor APK needs relative paths.
  base: mode === 'capacitor' ? './' : '/collector/',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: '/collector/',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
}))
