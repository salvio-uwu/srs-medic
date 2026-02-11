import React from 'react';
import Agenda from '../../shared/Agenda'; // Importamos la Super Agenda que acabamos de crear

const DashboardEnfermeria = () => {
  return (
    <div className="h-screen w-full bg-slate-50">
       {/* Renderizamos DIRECTAMENTE la Agenda.
          Como el usuario logueado tiene rol 'enfermeria', 
          la Agenda detectará eso y activará automáticamente el modo "Torre de Control".
       */}
       <Agenda />
    </div>
  );
};

export default DashboardEnfermeria;