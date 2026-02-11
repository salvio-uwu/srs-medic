import React from 'react';
import { FileText } from 'lucide-react';

const FormatoReceta = ({ expediente, doctor }) => {
  if (!expediente || !doctor) return null;

  // Datos del paciente calculados en ExpedienteClinico.jsx
  const { px_info } = expediente;
  const { exploracion, diagnostico } = expediente.consulta;

  // Configuración de Sucursales (Puedes mover esto a un archivo de constantes luego)
  const infoSucursales = {
    "Sucursal Central": {
      dir: "Calle Principal #123, Col. Centro",
      cp: "64000",
      tel: "8182046067",
      horario: "Abierto 24Hrs."
    },
    "Sucursal Huasteca": {
      dir: "CUAJUCO 120 A Col. Inf la Huasteca Santa Catarina, Nuevo León",
      cp: "66354",
      tel: "8182046067",
      horario: "Abierto 24Hrs."
    }
  };

  const sucursalActual = infoSucursales[doctor.sucursal] || infoSucursales["Sucursal Central"];

  return (
    <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-slate-800 p-8 font-sans min-h-screen">
      
      {/* --- CABECERA --- */}
      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
             +
          </div>
          <div>
            <h1 className="text-2xl font-black text-blue-900 leading-none">CENTRO MÉDICO</h1>
            <h2 className="text-xl font-bold text-blue-700">SANTA CRUZ</h2>
            <p className="text-[9px] text-slate-400 mt-1 italic font-medium">
                Esta receta es válida y original solo con firma autógrafa.
            </p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-sm font-black text-red-600">Folio: {Date.now().toString().slice(-6)}</p>
           <p className="text-xs font-bold text-slate-500 mt-1">{new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      {/* --- INFO DOCTOR --- */}
      <div className="mb-6">
        <h3 className="text-lg font-black text-slate-800 uppercase leading-tight">
            {doctor.nombre}
        </h3>
        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">
            Medicina General • Ced. Prof. {doctor.cedulaProfesional || '---'}
        </p>
        <p className="text-[10px] text-slate-500 font-bold uppercase">
            {doctor.universidadEgreso || '---'}
        </p>
      </div>

      {/* --- INFO PACIENTE --- */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
        <div>
           <label className="text-[9px] font-black text-slate-400 uppercase block">Nombre del paciente</label>
           <p className="text-sm font-bold text-slate-800 uppercase">{expediente.pacienteNombre}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">Edad</label>
                <p className="text-sm font-bold text-slate-700">{px_info.edad}</p>
            </div>
            <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">ID Paciente</label>
                <p className="text-sm font-bold text-slate-700">{px_info.id_receta}</p>
            </div>
        </div>
        <div className="col-span-2 grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 mt-2">
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">T.A:</span> <span className="text-sm font-bold">{exploracion.signos.ta || '--'}</span></div>
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Temp:</span> <span className="text-sm font-bold">{exploracion.signos.temp || '--'}°C</span></div>
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Peso:</span> <span className="text-sm font-bold">{exploracion.antropometria.peso || '--'}kg</span></div>
            <div><span className="text-[9px] font-bold text-slate-400 uppercase">SpO2:</span> <span className="text-sm font-bold">{exploracion.signos.spo2 || '--'}%</span></div>
        </div>
      </div>

      {/* --- DIAGNÓSTICO --- */}
      <div className="mb-8 p-3 border-l-4 border-blue-200 bg-blue-50/30">
        <label className="text-[9px] font-black text-blue-600 uppercase block mb-1">Diagnóstico Clínico:</label>
        <p className="text-sm font-bold text-slate-700 italic">
            {diagnostico.enfermedad_actual || "Valoración Médica General"}
        </p>
      </div>

      {/* --- TRATAMIENTO --- */}
      <div className="min-h-[300px]">
        <h4 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase">
            Prescripción Médica (Receta)
        </h4>
        <div className="space-y-6">
            {diagnostico.tratamiento_lista?.map((med, idx) => (
                <div key={idx} className="flex gap-4">
                    <span className="text-sm font-black text-blue-600">{idx + 1}.</span>
                    <div>
                        <p className="text-sm font-black text-slate-800 uppercase">{med.nombre}</p>
                        <p className="text-sm font-medium text-slate-600 italic mt-1 leading-relaxed">
                            {med.dosis}
                        </p>
                    </div>
                </div>
            ))}
            {diagnostico.tratamiento_lista?.length === 0 && (
                <p className="text-slate-400 italic text-sm">Sin medicamentos prescritos.</p>
            )}
        </div>
      </div>

      {/* --- PIE DE PÁGINA --- */}
      <div className="fixed bottom-10 left-8 right-8">
        <div className="flex justify-between items-end border-t border-slate-200 pt-6">
            <div className="text-[10px] text-slate-500 space-y-1">
                <p className="font-black text-blue-800 uppercase">Suc. {doctor.sucursal}</p>
                <p>{sucursalActual.dir}</p>
                <p>C.P. {sucursalActual.cp} • Tel: {sucursalActual.tel}</p>
                <p className="font-bold">Quejas o sugerencias: {sucursalActual.tel}</p>
            </div>
            
            <div className="text-center w-64">
                <div className="border-b-2 border-slate-800 mb-2"></div>
                <p className="text-[10px] font-black text-slate-800 uppercase">Firma del Médico</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                    {doctor.nombre} • Ced. {doctor.cedulaProfesional}
                </p>
            </div>
        </div>
      </div>

    </div>
  );
};

export default FormatoReceta;