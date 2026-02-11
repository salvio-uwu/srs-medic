import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import PortalAcceso from './pages/auth/PortalAcceso';

// Módulos Administrativos
import DashboardAdmin from './pages/admin/DashboardAdmin';
import Inventario from './pages/admin/Inventario';
import Usuarios from './pages/admin/Usuarios';
import Supervision from './pages/admin/Supervision';
import Reportes from './pages/admin/Reportes'; 
import MonitorActividad from './pages/admin/MonitorActividad';

// Módulos Doctor
import Consultorio from './pages/doctor/Consultorio'; 
import ExpedienteClinico from './pages/doctor/ExpedienteClinico'; 
import NotaMedicaRapida from './pages/doctor/NotaMedicaRapida';
import Pacientes from './pages/doctor/Pacientes';

// Módulos Enfermería (AQUÍ ESTÁ EL CAMBIO)
// import DashboardEnfermeria from './pages/enfermeria/DashboardEnfermeria'; <--- YA NO LO USAMOS
import AgendaEnfermeria from './pages/enfermeria/AgendaEnfermeria'; // <--- NUEVA IMPORTACIÓN
import Triage from './pages/enfermeria/Triage';
import HojaEnfermeria from './pages/enfermeria/HojaEnfermeria'; 

// Módulos Compartidos
import Agenda from './shared/Agenda';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta Pública */}
        <Route path="/" element={<Login />} />

        {/* --- RUTA PORTAL DE BIENVENIDA (INTERMEDIA) --- */}
        <Route path="/portal" element={<PortalAcceso />} />

        {/* --- RUTAS ADMINISTRADOR --- */}
        <Route path="/admin/dashboard" element={<DashboardAdmin />} />
        <Route path="/admin/inventario" element={<Inventario />} />
        <Route path="/admin/usuarios" element={<Usuarios />} />
        <Route path="/admin/supervision" element={<Supervision />} />
        <Route path="/admin/reportes" element={<Reportes />} />
        <Route path="/admin/monitor" element={<MonitorActividad />} />

        {/* --- RUTAS DOCTOR --- */}
        <Route path="/doctor/consulta" element={<Consultorio />} />
        <Route path="/doctor/expediente" element={<ExpedienteClinico />} />
        <Route path="/doctor/nota-rapida" element={<NotaMedicaRapida />} />

        {/* --- RUTAS ENFERMERÍA --- */}
        {/* Aquí conectamos la ruta '/enfermeria/dashboard' directo a tu nueva AgendaEnfermeria */}
        <Route path="/enfermeria/dashboard" element={<AgendaEnfermeria />} /> 
        <Route path="/enfermeria/triage" element={<Triage />} />
        <Route path="/enfermeria/hoja-enfermeria" element={<HojaEnfermeria />} />

        {/* --- RUTAS COMPARTIDAS --- */}
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/pacientes" element={<Pacientes />} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;