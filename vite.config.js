import { defineConfig } from 'vite'

export default defineConfig({
  base: '/image_to_bw_pdf/',  // GitHub Pages base path
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
