/** Vite config for the React SPA — React plugin only; add aliases or proxy here if needed. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
