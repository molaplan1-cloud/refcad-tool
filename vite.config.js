import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  },
  optimizeDeps: {
    include: ['jspdf', 'html2canvas']
  }
})
