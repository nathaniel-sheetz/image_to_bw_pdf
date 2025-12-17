import { defineConfig } from 'vite'

export default defineConfig({
  base: './',  // For GitHub Pages compatibility
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
