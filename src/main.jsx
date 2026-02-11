import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

const root = createRoot(document.getElementById('root'));

// HEMOS QUITADO <StrictMode> PARA EVITAR EL ERROR DE FIRESTORE "INTERNAL ASSERTION FAILED"
root.render(
    <AuthProvider>
      <App />
    </AuthProvider>
)