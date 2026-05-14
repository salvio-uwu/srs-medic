import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { SessionLocationProvider } from './context/SessionLocationContext'

const root = createRoot(document.getElementById('root'));

// HEMOS QUITADO <StrictMode> PARA EVITAR EL ERROR DE FIRESTORE "INTERNAL ASSERTION FAILED"
root.render(
    <AuthProvider>
      <SessionLocationProvider>
        <App />
      </SessionLocationProvider>
    </AuthProvider>
)