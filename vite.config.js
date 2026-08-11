import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Leer versión desde package.json o usar 1.0.0 por defecto
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version || '1.0.0'

// Leer notas de la versión desde release-notes.json (archivo dedicado que el dev edita)
let releaseNotes = []
try {
  const notesFile = path.resolve(__dirname, 'release-notes.json')
  const notesData = JSON.parse(fs.readFileSync(notesFile, 'utf-8'))
  releaseNotes = Array.isArray(notesData.notes) ? notesData.notes : []
} catch { /* sin notas, se omite */ }

// Capacitor (APK) necesita rutas relativas; el deploy web sigue con base '/'.
const isCapacitorBuild = process.env.CAPACITOR === '1'

// https://vite.dev/config/
export default defineConfig({
  base: isCapacitorBuild ? './' : '/',
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      configureServer() {
        const versionFile = path.resolve(__dirname, 'public/version.json');
        fs.writeFileSync(versionFile, JSON.stringify({ v: appVersion, notes: releaseNotes }));
      },
      buildStart() {
        const versionFile = path.resolve(__dirname, 'public/version.json');
        fs.writeFileSync(versionFile, JSON.stringify({ v: appVersion, notes: releaseNotes }));
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