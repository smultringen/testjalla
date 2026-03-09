import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/testjalla/'   // ← CHANGE TO YOUR REPO NAME (with trailing slash)
})