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
    open: '/collector/',
  },
}))
