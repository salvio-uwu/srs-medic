import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  DollarSign, 
  Camera, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Search,
  Filter
} from 'lucide-react';

// Datos de prueba (Hardcodeados por ahora para visualizar el diseño)
// Una vez aprobemos el diseño, conectaremos Firebase real.
const MOCK_CORTES = [
  { id: 1, sucursal: 'Sucursal Norte', usuario: 'Ana Martinez', fecha: '2024-02-15 20:30', monto: 12500, estado: 'Revisado', diferencia: 0 },
  { id: 2, sucursal: 'Sucursal Central', usuario: 'Pedro Lopez', fecha: '2024-02-15 21:00', monto: 34200, estado: 'Alerta', diferencia: -500 },
];

const MOCK_LIMPIEZA = [
  { id: 1, sucursal: 'Sucursal Central', area: 'Consultorio 1', usuario: 'Maria Limpieza', hora: '07:00 AM', estado: 'Completado', foto: true },
  { id: 2, sucursal: 'Sucursal Sur', area: 'Sala de Espera', usuario: 'Juan Perez', hora: '08:15 AM', estado: 'Pendiente', foto: false },
];

const Supervision = () => {
  const [activeTab, setActiveTab] = useState('caja'); // 'caja' | 'limpieza' | 'asistencia'

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans min-h-screen">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="text-blue-600" />
          Supervisión Operativa
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Auditoría de cortes de caja, bitácoras de limpieza y asistencia.
        </p>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex gap-4 border-b border-slate-200 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('caja')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'caja' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <DollarSign size={18} />
          Cortes de Caja
        </button>
        <button 
          onClick={() => setActiveTab('limpieza')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'limpieza' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Camera size={18} />
          Bitácoras de Limpieza
        </button>
        <button 
          onClick={() => setActiveTab('asistencia')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'asistencia' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Clock size={18} />
          Asistencia y Logueo
        </button>
      </div>

      {/* FILTROS RÁPIDOS (Común para todas las tabs) */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por usuario o sucursal..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 text-slate-600 text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Filter size={16} />
          Filtrar por Fecha
        </button>
      </div>

      {/* CONTENIDO DINÁMICO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
        
        {/* --- VISTA DE CAJA --- */}
        {activeTab === 'caja' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                <tr>
                  <th className="p-4">Sucursal / Usuario</th>
                  <th className="p-4">Fecha Cierre</th>
                  <th className="p-4">Monto Declarado</th>
                  <th className="p-4">Diferencia</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {MOCK_CORTES.map(corte => (
                  <tr key={corte.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <p className="font-bold text-slate-700">{corte.sucursal}</p>
                      <p className="text-slate-400 text-xs">{corte.usuario}</p>
                    </td>
                    <td className="p-4 text-slate-600">{corte.fecha}</td>
                    <td className="p-4 font-mono font-medium text-slate-700">
                      ${corte.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {corte.diferencia === 0 ? (
                        <span className="text-green-500 font-bold flex items-center gap-1"><CheckCircle size={14}/> OK</span>
                      ) : (
                        <span className="text-red-500 font-bold flex items-center gap-1"><AlertCircle size={14}/> {corte.diferencia}</span>
                      )}
                    </td>
                    <td className="p-4">
                       <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                         corte.estado === 'Alerta' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                       }`}>
                         {corte.estado}
                       </span>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-blue-600 hover:underline text-xs font-bold">Ver Ticket</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- VISTA DE LIMPIEZA --- */}
        {activeTab === 'limpieza' && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_LIMPIEZA.map(log => (
              <div key={log.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                 <div className="flex justify-between items-start mb-3">
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">{log.sucursal}</span>
                    {log.foto ? <Camera size={16} className="text-blue-500" /> : <AlertCircle size={16} className="text-orange-400" />}
                 </div>
                 <h3 className="font-bold text-slate-800">{log.area}</h3>
                 <p className="text-sm text-slate-500 mb-4">Por: {log.usuario} • {log.hora}</p>
                 
                 <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs border border-dashed border-slate-300">
                    {log.foto ? (
                      <span className="flex flex-col items-center gap-1">
                        <Camera size={24} />
                        Foto Evidencia
                      </span>
                    ) : (
                      "Sin foto adjunta"
                    )}
                 </div>
                 <button className="mt-3 w-full py-2 text-sm text-blue-600 font-bold hover:bg-blue-50 rounded-lg transition-colors">
                   Ver Detalle
                 </button>
              </div>
            ))}
          </div>
        )}

        {/* --- VISTA DE ASISTENCIA --- */}
        {activeTab === 'asistencia' && (
          <div className="p-8 text-center text-slate-500">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <Clock size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Registro de Asistencia</h3>
            <p className="max-w-md mx-auto mt-2">
              Aquí se visualizarán los "Login con Fotografía" del personal al iniciar turno.
              <br/>Esta función requiere configurar el almacenamiento de fotos primero.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Supervision;