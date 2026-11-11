import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /lightroom-deck/ subpath.
  base: './',
  plugins: [react()],
})
