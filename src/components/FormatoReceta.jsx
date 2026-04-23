import React from 'react';

/**
 * Peso en "líneas" de cada tipo de item.
 * Un medicamento con presentación + dosis ocupa ~3 líneas.
 * Un estudio simple ~1.5, un procedimiento con detalle ~2.5, una nota ~1.
 * El presupuesto total por media-página es ~12 líneas (espacio entre encabezado y footer).
 */
const LINE_WEIGHT = {
  medicamento: 3,
  estudio: 1.5,
  procedimiento: 2.5,
  nota: 1
};
const MAX_LINES_PER_RECETA = 12;

/**
 * Construye un arreglo plano de "items de receta" con tipo, texto principal y subtexto.
 * Se juntan medicamentos + estudios + procedimientos en orden.
 */
const buildRecetaItems = (expediente = {}) => {
  const items = [];

  // 1) Medicamentos
  const meds = expediente?.consulta?.diagnostico?.tratamiento_lista || [];
  meds.forEach((med) => {
    items.push({
      tipo: 'medicamento',
      nombre: med.nombre || 'Medicamento',
      subtexto: med.dosis || '',
      detalle: [med.presentacion, med.sustanciasActivas, med.numeroAcomodo].filter(Boolean).join(' · ')
    });
  });

  // 2) Estudios
  const estudios = expediente?.consulta?.estudios?.estudios_seleccionados || [];
  const paquetes = expediente?.consulta?.estudios?.paquetes_seleccionados || [];
  if (paquetes.length > 0) {
    items.push({
      tipo: 'estudio',
      nombre: `Paquetes: ${paquetes.join(', ')}`,
      subtexto: '',
      detalle: ''
    });
  }
  estudios.forEach((est) => {
    const nombre = typeof est === 'string' ? est : (est?.nombre || '');
    const nota = typeof est === 'object' ? (est?.nota || '') : '';
    if (nombre) {
      items.push({ tipo: 'estudio', nombre, subtexto: nota, detalle: '' });
    }
  });

  // 3) Procedimientos
  const procs = expediente?.consulta?.procedimientos?.seleccionados || [];
  procs.forEach((proc) => {
    if (!proc || typeof proc !== 'object') {
      const txt = String(proc || '').trim();
      if (txt) items.push({ tipo: 'procedimiento', nombre: txt, subtexto: '', detalle: '' });
      return;
    }
    const nombre = String(proc.nombre || proc.procedimiento || proc.descripcion || '').trim() || 'Procedimiento';
    const extras = [];
    if (proc.prioridad) extras.push(proc.prioridad.replace(/_/g, ' '));
    if (proc.estado) extras.push(proc.estado.replace(/_/g, ' '));
    if (proc.sitio) extras.push(proc.sitio);
    items.push({
      tipo: 'procedimiento',
      nombre,
      subtexto: proc.nota || '',
      detalle: extras.join(' · ')
    });
  });

  // Notas generales
  const notasEstudios = expediente?.consulta?.estudios?.notas_generales || '';
  const notasProcs = expediente?.consulta?.procedimientos?.notas_generales || '';
  if (notasEstudios) items.push({ tipo: 'nota', nombre: `Nota estudios: ${notasEstudios}`, subtexto: '', detalle: '' });
  if (notasProcs) items.push({ tipo: 'nota', nombre: `Nota procedimientos: ${notasProcs}`, subtexto: '', detalle: '' });

  return items;
};

/**
 * Distribuye items en páginas de receta según el peso de líneas.
 * Cuando agregar un item haría exceder MAX_LINES_PER_RECETA, se abre una nueva receta.
 */
const splitByWeight = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const pages = [];
  let currentPage = [];
  let usedLines = 0;

  for (const item of items) {
    const weight = LINE_WEIGHT[item.tipo] || 2;
    // Si agregar este item excede el límite Y ya hay algo en la página, cortar
    if (usedLines + weight > MAX_LINES_PER_RECETA && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      usedLines = 0;
    }
    currentPage.push(item);
    usedLines += weight;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
};

/** Agrupa de a 2 recetas por página física (superior + inferior en media carta). */
const pairPages = (recetas = []) => {
  const pairs = [];
  for (let i = 0; i < recetas.length; i += 2) {
    pairs.push(recetas.slice(i, i + 2));
  }
  return pairs;
};

const TIPO_BADGE_STYLES = {
  medicamento: 'bg-blue-50 text-blue-700 border-blue-200',
  estudio: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  procedimiento: 'bg-amber-50 text-amber-700 border-amber-200',
  nota: 'bg-slate-50 text-slate-500 border-slate-200'
};

const TIPO_LABEL = {
  medicamento: 'Rx',
  estudio: 'Est',
  procedimiento: 'Proc',
  nota: 'Nota'
};

const RecetaIndividual = ({ expediente, doctor, sucursalInfo, items = [], startIndex = 0, recetaNum = 1, totalRecetas = 1, globalIndex = 0 }) => {
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

   const formatFooterText = (value = '') => String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([,;\/-])/g, '$1\u200B');

  const vitals = [
    { l: 'Peso:', v: antropometria.peso || signos.peso, u: 'kg' },
    { l: 'Talla:', v: antropometria.talla || signos.talla, u: 'm' },
    { l: 'IMC:', v: antropometria.imc || signos.imc, u: '' },
    { l: 'Temp:', v: signos.temp, u: '°C' },
    { l: 'T.A.:', v: signos.ta, u: '' },
    { l: 'F.C.:', v: signos.fc, u: 'lpm' },
    { l: 'F.R.:', v: signos.fr, u: 'rpm' },
    { l: 'Grupo:', v: px_info.grupo_sanguineo, u: '' },
    { l: 'SpO2:', v: signos.spo2, u: '%' },
  ];
  
  // Fecha formateada (usa fechaHistorica si viene de consulta anterior)
  const fechaBase = expediente.fechaHistorica instanceof Date ? expediente.fechaHistorica : new Date();
  const fechaActual = fechaBase.toLocaleDateString('es-MX', {
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
           {totalRecetas > 1 && (
             <p className="text-[7px] text-slate-400 mt-0.5">Receta {recetaNum} de {totalRecetas}</p>
           )}
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

         {/* Columna Derecha: Items (medicamentos, estudios, procedimientos) */}
         <div className="flex-1 pt-1 overflow-hidden flex flex-col">
            {items.length > 0 ? (
                <div className="space-y-2 flex-1 overflow-hidden">
                  {items.map((item, idx) => (
                        <div key={idx} className="mb-1">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${TIPO_BADGE_STYLES[item.tipo] || TIPO_BADGE_STYLES.nota}`}>{TIPO_LABEL[item.tipo] || item.tipo}</span>
                              <span className="font-black text-slate-900 text-[11px] uppercase">{globalIndex + idx + 1}. {item.nombre}</span>
                            </div>
                            {item.detalle && (
                              <p className="text-slate-500 ml-3 uppercase text-[9px] mt-0.5 font-medium">{item.detalle}</p>
                            )}
                            {item.subtexto && (
                              <p className="text-slate-600 italic ml-3 uppercase text-[10px] mt-0.5 font-medium">
                                  {item.subtexto}
                              </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {/* Indicador de continuación */}
            {totalRecetas > 1 && recetaNum < totalRecetas && (
              <p className="text-[8px] text-blue-600 font-bold uppercase mt-auto pt-1 border-t border-dashed border-blue-200">▸ Continúa en receta {recetaNum + 1} de {totalRecetas}</p>
            )}
            {totalRecetas > 1 && recetaNum > 1 && (
              <p className="text-[8px] text-slate-400 font-semibold italic mb-1">Viene de receta {recetaNum - 1}</p>
            )}
            
            {/* Diagnóstico (Parte Inferior Derecha) */}
            {diagnostico.enfermedad_actual && (
                <div className="mt-auto pt-2 border-t border-dashed border-slate-200 shrink-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Diagnóstico:</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase">{diagnostico.enfermedad_actual}</p>
                </div>
            )}

            {/* Indicaciones Generales */}
            {diagnostico.indicaciones && (
                <div className={`${diagnostico.enfermedad_actual ? 'pt-1' : 'mt-auto pt-2 border-t border-dashed border-slate-200'} shrink-0`}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Indicaciones:</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase whitespace-pre-line">{diagnostico.indicaciones}</p>
                </div>
            )}
         </div>
      </div>

      {/* --- FOOTER --- */}
      <div className="relative z-10 mt-auto pt-2 flex items-end justify-between">
         {/* Datos Sucursal */}
         <div className="text-[8px] text-slate-500 w-1/2 leading-tight max-h-[80px] overflow-hidden">
            <p className="font-black text-slate-800 uppercase mb-0.5">Suc. {suc.nombre || doctor.sucursal || 'Central'}</p>
            {(suc.horario) && <p className="break-words [overflow-wrap:anywhere]">{formatFooterText(suc.horario)}</p>}
            {(suc.quejas || suc.telefono) && <p className="font-bold break-words [overflow-wrap:anywhere]">Quejas o Sugerencias: {formatFooterText(suc.quejas || suc.telefono)}</p>}
            {(suc.direccion) && <p className="mt-0.5 uppercase break-words [overflow-wrap:anywhere]">{formatFooterText(suc.direccion)}</p>}
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

   const allItems = buildRecetaItems(expediente);
   const recetas = splitByWeight(allItems);

   // Si no hay items, generar al menos una receta vacía para poder imprimir (ej: solo estudios verbales, indicaciones, etc.)
   if (recetas.length === 0) recetas.push([]);

   const totalRecetas = recetas.length;

   // Calcular el índice global acumulado para cada receta
   const globalStartIndices = [];
   let acc = 0;
   for (const receta of recetas) {
     globalStartIndices.push(acc);
     acc += receta.length;
   }

   const paginas = pairPages(recetas);

  return (
      <div className="hidden print:block w-full bg-white m-0 p-0">
         {paginas.map((pagina, paginaIdx) => {
            const recetaSuperior = pagina[0];
            const recetaInferior = pagina[1];
            const recetaIdxSup = paginaIdx * 2;
            const recetaIdxInf = paginaIdx * 2 + 1;

            return (
               <div
                  key={`pagina-receta-${paginaIdx}`}
                  className={`flex flex-col h-screen w-full overflow-hidden ${paginaIdx > 0 ? 'print:break-before-page' : ''}`}
               >
                  {recetaSuperior ? (
                     <div className="h-[50vh] w-full border-b border-dashed border-slate-300 relative box-border overflow-hidden">
                        <RecetaIndividual
                           expediente={expediente}
                           doctor={doctor}
                           sucursalInfo={sucursalInfo}
                           items={recetaSuperior}
                           startIndex={0}
                           globalIndex={globalStartIndices[recetaIdxSup]}
                           recetaNum={recetaIdxSup + 1}
                           totalRecetas={totalRecetas}
                        />
                        <div className="absolute -bottom-2.5 left-4 bg-white px-1 text-slate-300 print:hidden text-[10px]">✄ Corte aquí</div>
                     </div>
                  ) : null}

                  {recetaInferior ? (
                     <div className="h-[50vh] w-full relative box-border overflow-hidden">
                        <RecetaIndividual
                           expediente={expediente}
                           doctor={doctor}
                           sucursalInfo={sucursalInfo}
                           items={recetaInferior}
                           startIndex={0}
                           globalIndex={globalStartIndices[recetaIdxInf]}
                           recetaNum={recetaIdxInf + 1}
                           totalRecetas={totalRecetas}
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