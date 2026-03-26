import React from 'react';

const MEDICAMENTOS_POR_RECETA = 4;

const splitIntoChunks = (items = [], chunkSize = MEDICAMENTOS_POR_RECETA) => {
   if (!Array.isArray(items) || items.length === 0) return [];
   const chunks = [];
   for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
   }
   return chunks;
};

const RecetaIndividual = ({ expediente, doctor, sucursalInfo, medicamentos = [], startIndex = 0 }) => {
  const { px_info } = expediente;
  const { exploracion, diagnostico } = expediente.consulta;
  const suc = sucursalInfo || {};
  const folio = px_info?.folio_receta || expediente?.folio || '';

  const signos = exploracion?.signos || {};
  const antropometria = exploracion?.antropometria || {};

  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

  const formatWithUnit = (value, unit = '') => {
    if (!hasValue(value)) return '--';
    const raw = String(value).trim();
    if (!unit) return raw;
    const lower = raw.toLowerCase();
    if (lower.includes(unit.toLowerCase())) return raw;
    return `${raw} ${unit}`;
  };

  const vitals = [
    { l: 'Peso:', v: antropometria.peso || signos.peso, u: 'kg' },
    { l: 'Talla:', v: antropometria.talla || signos.talla, u: 'm' },
    { l: 'Temp:', v: signos.temp, u: '°C' },
    { l: 'T.A.:', v: signos.ta, u: '' },
    { l: 'F.C.:', v: signos.fc, u: 'lpm' },
    { l: 'F.R.:', v: signos.fr, u: 'rpm' },
    { l: 'Grupo:', v: px_info.grupo_sanguineo, u: '' },
    { l: 'SpO2:', v: signos.spo2, u: '%' },
  ];
  
  // Fecha actual formateada
  const fechaActual = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Formatear Fecha de Nacimiento para mostrarla bonita
  const fechaNacFormat = px_info.fecha_nacimiento 
    ? new Date(px_info.fecha_nacimiento).toLocaleDateString('es-MX') 
    : '--/--/----';

  const Logo = () => (
    <svg viewBox="0 0 300 80" className="h-full w-auto">
      <path d="M20 30 h-15 v20 h15 v15 h20 v-15 h15 v-20 h-15 v-15 h-20 v15 z" fill="#2563EB" />
      <text x="65" y="35" fontSize="24" fontWeight="900" fontFamily="Arial" fill="#334155">CENTRO MÉDICO</text>
      <text x="65" y="60" fontSize="24" fontWeight="900" fontFamily="Arial" fill="#64748b">SANTA CRUZ</text>
    </svg>
  );

  const WatermarkECG = () => (
    <svg viewBox="0 0 500 150" className="w-full h-full opacity-[0.03] text-blue-600 stroke-current" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
       <path d="M0 75 L150 75 L170 20 L190 130 L210 75 L500 75" />
    </svg>
  );

  return (
    <div className="relative h-full w-full px-8 py-4 flex flex-col text-[10px] font-sans text-slate-800 leading-none">
      
      {/* FONDO MARCA DE AGUA */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
         <div className="w-[90%]"><WatermarkECG /></div>
      </div>

      {/* --- ENCABEZADO --- */}
      <div className="relative z-10 flex justify-between items-start mb-3">
        <div className="h-12"><Logo /></div>
        
        <div className="text-center absolute w-full top-0 pointer-events-none">
           <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Esta receta es válida y original solo con firma autógrafa.</p>
        </div>

        <div className="text-right">
           <p className="font-black text-xs text-slate-900 uppercase">Dr. {doctor.nombre}</p>
           <p className="font-bold text-slate-500 uppercase text-[9px]">MEDICINA GENERAL</p>
           <p className="text-[9px] uppercase font-medium">Ced. Prof. <span className="font-bold text-slate-800">{doctor.cedulaProfesional}</span></p>
           <p className="text-[8px] font-bold text-blue-700 uppercase mt-0.5">{doctor.universidadEgreso}</p>
           <p className="text-[10px] font-black text-red-600 mt-1">Folio: {folio || '—'}</p>
        </div>
      </div>

      {/* --- FICHA PACIENTE (DISEÑO EXACTO AL PDF) --- */}
      <div className="relative z-10 mb-3 border-b border-slate-300 pb-1">
         {/* Línea 1: Nombre | Edad | Fecha */}
         <div className="flex items-baseline mb-1">
            <span className="font-bold text-slate-900 uppercase mr-1">Nombre del paciente:</span>
            <span className="uppercase text-slate-700 border-b border-slate-200 flex-1 mr-4">{expediente.pacienteNombre}</span>
            
            <span className="font-bold text-slate-900 uppercase mr-1">Edad:</span>
            <span className="uppercase text-slate-700 mr-4">{px_info.edad}</span>
            
            <span className="font-bold text-slate-900 uppercase mr-1">Fecha:</span>
            <span className="uppercase text-slate-700">{fechaActual}</span>
         </div>

         {/* Línea 2: F. Nac | ID | Tel */}
         <div className="flex items-baseline mb-1 text-[9px]">
            <span className="font-bold text-slate-900 uppercase mr-1">Fecha de nacimiento:</span>
            <span className="uppercase text-slate-600 mr-4">{fechaNacFormat}</span>

            <span className="font-bold text-slate-900 uppercase mr-1">ID:</span>
            <span className="uppercase text-slate-600 mr-4">{px_info.id_receta}</span>

            <span className="font-bold text-slate-900 uppercase mr-1">Tel. paciente:</span>
            <span className="uppercase text-slate-600">{px_info.telefono}</span>
         </div>

         {/* Línea 3: Alergias */}
         <div className="flex items-baseline mt-1">
            <span className="font-bold text-slate-900 uppercase mr-1">Alergias:</span>
            <span className="font-black text-slate-800 uppercase">{px_info.alergias_base || 'INTERROGADAS Y NEGADAS.'}</span>
         </div>
      </div>

      {/* --- CUERPO: VITALES (Izq) y RECETA (Der) --- */}
      <div className="relative z-10 flex flex-1 gap-4 overflow-hidden">
         {/* Columna Izquierda: Vitales + GRUPO SANGUÍNEO AGREGADO */}
         <div className="w-20 shrink-0 space-y-2 pt-1 border-r border-slate-200 pr-2">
          {vitals.map((s, i) => (
                <div key={i} className="text-left">
                    <p className="text-[9px] font-bold text-slate-500 mb-0.5">{s.l}</p>
              <p className="font-bold text-slate-800 text-[11px] leading-none">{formatWithUnit(s.v, s.u)}</p>
                </div>
            ))}
         </div>

         {/* Columna Derecha: Medicamentos */}
         <div className="flex-1 pt-1">
            {medicamentos.length > 0 ? (
                <div className="space-y-3">
                  {medicamentos.map((med, idx) => (
                        <div key={idx} className="mb-2">
                            <div className="flex justify-between items-baseline">
                           <span className="font-black text-slate-900 text-[11px] uppercase">{startIndex + idx + 1}. {med.nombre}</span>
                            </div>
                            <p className="text-slate-600 italic ml-3 uppercase text-[10px] mt-0.5 font-medium">
                                {med.dosis || '1 CADA 8 HRS X 3 DÍAS.'}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
            
            {/* Diagnóstico (Parte Inferior Derecha) */}
            {diagnostico.enfermedad_actual && (
                <div className="mt-6 pt-2 border-t border-dashed border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Diagnóstico:</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">{diagnostico.enfermedad_actual}</p>
                </div>
            )}
         </div>
      </div>

      {/* --- FOOTER --- */}
      <div className="relative z-10 mt-auto pt-2 flex items-end justify-between">
         {/* Datos Sucursal */}
         <div className="text-[8px] text-slate-500 w-1/2 leading-tight">
            <p className="font-black text-slate-800 uppercase mb-0.5">Suc. {suc.nombre || doctor.sucursal || 'Central'}</p>
            {(suc.horario) && <p>{suc.horario}</p>}
            {(suc.quejas || suc.telefono) && <p className="font-bold">Quejas o Sugerencias: {suc.quejas || suc.telefono}</p>}
            {(suc.direccion) && <p className="mt-0.5 uppercase">{suc.direccion}</p>}
         </div>

         {/* Firma */}
         <div className="text-center w-48">
            <div className="border-t border-slate-800 mb-1 w-full"></div>
            <p className="font-bold text-slate-900 text-[9px] uppercase">FIRMA DEL MÉDICO</p>
            <p className="text-[7px] font-bold text-slate-500 uppercase leading-tight">
                {doctor.universidadEgreso} - MEDICINA GENERAL - {doctor.cedulaProfesional}
            </p>
         </div>
      </div>

    </div>
  );
};

// COMPONENTE PRINCIPAL (Layout de impresión doble)
const FormatoReceta = ({ expediente, doctor, sucursalInfo }) => {
  if (!expediente || !doctor) return null;

   const tratamientoLista = expediente?.consulta?.diagnostico?.tratamiento_lista || [];
   const medicamentosChunks = splitIntoChunks(tratamientoLista, MEDICAMENTOS_POR_RECETA);

   // Si no hay medicamentos no se imprime la receta para evitar formatos vacios.
   if (medicamentosChunks.length === 0) return null;

   const paginas = splitIntoChunks(medicamentosChunks, 2);

  return (
      <div className="hidden print:block w-full bg-white m-0 p-0">
         {paginas.map((pagina, paginaIdx) => {
            const recetaSuperior = pagina[0];
            const recetaInferior = pagina[1];
            const baseSuperior = paginaIdx * 2 * MEDICAMENTOS_POR_RECETA;
            const baseInferior = baseSuperior + MEDICAMENTOS_POR_RECETA;

            return (
               <div
                  key={`pagina-receta-${paginaIdx}`}
                  className={`flex flex-col h-screen w-full overflow-hidden ${paginaIdx > 0 ? 'print:break-before-page' : ''}`}
               >
                  {recetaSuperior ? (
                     <div className="h-[50vh] w-full border-b border-dashed border-slate-300 relative box-border">
                        <RecetaIndividual
                           expediente={expediente}
                           doctor={doctor}
                           sucursalInfo={sucursalInfo}
                           medicamentos={recetaSuperior}
                           startIndex={baseSuperior}
                        />
                        <div className="absolute -bottom-2.5 left-4 bg-white px-1 text-slate-300 print:hidden text-[10px]">✄ Corte aquí</div>
                     </div>
                  ) : null}

                  {recetaInferior ? (
                     <div className="h-[50vh] w-full relative box-border">
                        <RecetaIndividual
                           expediente={expediente}
                           doctor={doctor}
                           sucursalInfo={sucursalInfo}
                           medicamentos={recetaInferior}
                           startIndex={baseInferior}
                        />
                     </div>
                  ) : null}
               </div>
            );
         })}
      </div>
  );
};

export default FormatoReceta;