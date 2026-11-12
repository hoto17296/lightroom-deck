import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works both at a domain root and under a subpath.
  base: './',
  plugins: [react()],
})
