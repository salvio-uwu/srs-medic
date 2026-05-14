import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const buildVersion = Date.now().toString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      // Se ejecuta al iniciar el build → escribe public/version.json con el timestamp actual
      buildStart() {
        fs.writeFileSync('public/version.json', JSON.stringify({ v: buildVersion }))
      }
    }
  ],
  define: {
    // Disponible en el código como __BUILD_VERSION__
    __BUILD_VERSION__: JSON.stringify(buildVersion)
  },
  server: {
    host: true, 
    port: 5173,
  },
})