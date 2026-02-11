import React from 'react';

const Reportes = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Reportes y Estadísticas</h1>
      <p>Aquí se visualizarán los reportes generados por el sistema.</p>
      
      {/* Ejemplo visual de marcadores de posición */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border p-4 rounded shadow">
          <h2 className="font-semibold">Reporte Mensual</h2>
          <p className="text-gray-500">Gráfico pendiente...</p>
        </div>
        <div className="border p-4 rounded shadow">
          <h2 className="font-semibold">Pacientes Atendidos</h2>
          <p className="text-gray-500">Tabla pendiente...</p>
        </div>
      </div>
    </div>
  );
};

// IMPORTANTE:
export default Reportes;