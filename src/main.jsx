import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { SessionLocationProvider } from './context/SessionLocationContext'
import { decodeRoute } from './utils/routeObfuscator'

// Decodificar URL ofuscada ANTES de montar el router.
// Si no, la primera pintada cae en el catch-all (*) → /login
// y se pierde la ruta (p. ej. orden de servicio en pestaña nueva).
(() => {
  const rawPath = window.location.pathname + window.location.search + window.location.hash;
  const decoded = decodeRoute(rawPath);
  if (decoded !== rawPath && decoded.startsWith('/')) {
    window.history.replaceState(null, '', decoded);
  }
})();

const root = createRoot(document.getElementById('root'));

// HEMOS QUITADO <StrictMode> PARA EVITAR EL ERROR DE FIRESTORE "INTERNAL ASSERTION FAILED"
root.render(
    <AuthProvider>
      <SessionLocationProvider>
        <App />
      </SessionLocationProvider>
    </AuthProvider>
)