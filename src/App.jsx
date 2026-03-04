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

// Módulos Intendencia
import RegistroLimpiezaManual from './pages/intendencia/RegistroLimpiezaManual';
// Módulos Enfermería
import AgendaEnfermeria from './pages/enfermeria/AgendaEnfermeria'; 
import Triage from './pages/enfermeria/Triage';
import HojaEnfermeria from './pages/enfermeria/HojaEnfermeria'; 
import DashboardJefaEnfermeria from './pages/enfermeria/DashboardJefaEnfermeria';

// Módulos Recursos Humanos
import DashboardRH from './pages/rh/DashboardRH';
import AuditoriaEmpleados from './pages/rh/AuditoriaEmpleados';
import InventarioMacro from './pages/rh/InventarioMacro';
import FinanzasRH from './pages/rh/FinanzasRH';

// Módulos Compartidos
import Agenda from './shared/Agenda';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/portal" element={<PortalAcceso />} />

        {/* --- RUTAS ADMINISTRADOR --- */}
        <Route path="/admin/dashboard" element={<DashboardAdmin />} />
        <Route path="/admin/inventario" element={<Inventario />} />
        <Route path="/admin/usuarios" element={<Usuarios />} />
        <Route path="/admin/supervision" element={<Supervision />} />
        <Route path="/admin/reportes" element={<Reportes />} />
        <Route path="/admin/monitor" element={<MonitorActividad />} />

        {/* --- RUTAS RECURSOS HUMANOS --- */}
        <Route path="/rh/dashboard" element={<DashboardRH />} />
        <Route path="/rh/auditoria" element={<AuditoriaEmpleados />} />
        <Route path="/rh/inventario-macro" element={<InventarioMacro />} />
        <Route path="/rh/finanzas" element={<FinanzasRH />} />

        {/* --- RUTAS INTENDENCIA --- */}
        <Route path="/intendencia/registro" element={<RegistroLimpiezaManual />} />
        {/* --- RUTAS DOCTOR --- */}
        <Route path="/doctor/consulta" element={<Consultorio />} />
        <Route path="/doctor/expediente" element={<ExpedienteClinico />} />
        <Route path="/doctor/nota-rapida" element={<NotaMedicaRapida />} />

        {/* --- RUTAS ENFERMERÍA --- */}
        <Route path="/enfermeria/dashboard" element={<AgendaEnfermeria />} /> 
        <Route path="/enfermeria/jefatura" element={<DashboardJefaEnfermeria />} /> 
        <Route path="/enfermeria/triage" element={<Triage />} />
        <Route path="/enfermeria/hoja-enfermeria" element={<HojaEnfermeria />} />

        {/* --- RUTAS COMPARTIDAS --- */}
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/pacientes" element={<Pacientes />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;