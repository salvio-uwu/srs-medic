import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Leer versión desde package.json o usar 1.0.0 por defecto
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version || '1.0.0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      configureServer() {
        fs.writeFileSync('public/version.json', JSON.stringify({ v: appVersion }))
      },
      buildStart() {
        fs.writeFileSync('public/version.json', JSON.stringify({ v: appVersion }))
      }
    }
  ],
  define: {
    __BUILD_VERSION__: JSON.stringify(appVersion)
  },
  server: {
    host: true, 
    port: 5173,
  },
})