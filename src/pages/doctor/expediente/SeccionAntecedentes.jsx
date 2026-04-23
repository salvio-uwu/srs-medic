import React, { useState, useEffect } from 'react';
import { 
  Trash2, Activity, Scissors, ClipboardList, 
  FlaskConical, Shield, ChevronRight, Search, 
  Users, Baby, Zap, HeartPulse, CheckCircle, ChevronDown 
} from 'lucide-react';

const SeccionAntecedentes = ({ 
  expediente, updateCampo, sexo, edad, 
  tempAlergia, setTempAlergia, 
  tempCirugia, setTempCirugia,
  onNextStep 
}) => {
  const [activeSubTab, setActiveSubTab] = useState('hereditarios');
  const [activeGinecoTab, setActiveGinecoTab] = useState('menstruaciones');

  // --- ESTADOS PARA BUSCADOR CIE-10 ---
  const [catalogoCie10, setCatalogoCie10] = useState([]);
  const [sugerenciasCie10, setSugerenciasCie10] = useState([]);
  const [mostrarCie10, setMostrarCie10] = useState(false);
  const [busquedaCie10, setBusquedaCie10] = useState('');

  // --- CARGA DE CATÁLOGO CIE-10 ---
  useEffect(() => {
    const cargarCie10 = async () => {
      try {
        const res = await fetch('/data/cie10.json');
        if (res.ok) setCatalogoCie10(await res.json());
      } catch (error) {
        console.error("Error cargando CIE-10:", error);
      }
    };
    cargarCie10();
  }, []);

  // Estados temporales locales (Solo Vacuna se queda aquí)
  const [tempVacuna, setTempVacuna] = useState({ nombre: '', fecha: '', nota: '', seAplicoAqui: false });

  // --- AQUÍ EMPIEZAN LOS RENDERS...
  // --- ESTILOS ---
  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full w-full flex flex-col overflow-hidden";
  const labelClass = "text-[11px] font-semibold text-slate-500 uppercase mb-1.5 ml-1 block tracking-wider";
  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-colors text-sm font-medium text-slate-700 placeholder:text-slate-400";
  const headerClass = "text-[13px] font-semibold text-blue-800 uppercase tracking-widest mb-6 border-b border-slate-200 pb-2 flex items-center gap-2";
  const tableHeaderClass = "bg-slate-50 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-200";
  const tableRowClass = "py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center";

  // --- RENDERS DE SECCIONES NUEVAS ---

  const renderCie10 = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><CheckCircle size={16} className="text-blue-500"/> Enfermedades del CIE-10</h4>
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.cie10_preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.cie10_preguntados_y_negados', e.target.checked)} />
          <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
          <span className="text-xs text-amber-600 ml-1">— El paciente niega enfermedades CIE-10</span>
        </label>
      </div>
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 shrink-0">
        <div className="relative w-full">
          <label className={labelClass}>Buscador de enfermedades</label>
          <input 
            className={`${inputClass} bg-white pr-12`} 
            placeholder="Código o nombre de la patología..." 
            value={busquedaCie10}
            onChange={(e) => {
              const t = e.target.value;
              setBusquedaCie10(t);
              if(t.length > 2) {
                const res = catalogoCie10.filter(i => 
                  i.code?.toLowerCase().startsWith(t.toLowerCase()) || 
                  i.description?.toLowerCase().includes(t.toLowerCase())
                ).slice(0, 50);
                setSugerenciasCie10(res);
                setMostrarCie10(true);
              } else setMostrarCie10(false);
            }}
          />
          <Search className="absolute right-4 top-9 text-slate-400" size={18} />
          {mostrarCie10 && sugerenciasCie10.length > 0 && (
            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-2 max-h-64 overflow-y-auto z-[100] p-2">
              {sugerenciasCie10.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => {
                    updateCampo('antecedentes.cie10', [...(expediente.antecedentes.cie10 || []), item]);
                    setBusquedaCie10('');
                    setMostrarCie10(false);
                  }} 
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 text-sm flex gap-3 items-center rounded-xl"
                >
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold">{item.code}</span>
                  <span className="text-slate-700 font-bold">{item.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
        <div className="grid grid-cols-[100px_1fr_50px] bg-slate-50 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 shrink-0">
          <span>Código</span><span>Descripción</span><span></span>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          {(expediente.antecedentes.cie10 || []).map((enf, i) => (
            <div key={i} className="grid grid-cols-[100px_1fr_50px] py-3 border-b border-slate-50 items-center">
              <span className="text-center font-bold text-blue-600 text-xs">{enf.code}</span>
              <span className="px-4 text-xs font-medium text-slate-700 uppercase">{enf.description}</span>
              <button onClick={() => updateCampo('antecedentes.cie10', expediente.antecedentes.cie10.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

const renderPadres = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><Users size={16} className="text-blue-500"/> Nombre de los padres</h4>
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.padres?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.padres.preguntados_y_negados', e.target.checked)} />
          <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
          <span className="text-xs text-amber-600 ml-1">— Datos de padres y embarazo negados</span>
        </label>
      </div>
      <div className="space-y-3 mb-8 shrink-0">
        <input 
          className={inputClass} 
          placeholder="Nombre de la madre" 
          value={expediente.antecedentes.padres?.madre_nombre || ''} 
          onChange={e => updateCampo('antecedentes.padres.madre_nombre', e.target.value)} 
        />
        <input 
          className={inputClass} 
          placeholder="Nombre del padre" 
          value={expediente.antecedentes.padres?.padre_nombre || ''} 
          onChange={e => updateCampo('antecedentes.padres.padre_nombre', e.target.value)} 
        />
      </div>

      <h4 className={headerClass}><Baby size={16} className="text-blue-500"/> Información del embarazo</h4>
      <div className="space-y-4 max-w-md overflow-y-auto pr-2">
        <div className="flex items-center gap-4">
           <label className="text-[10px] font-bold text-slate-500 uppercase w-40 shrink-0">* Edad de la madre:</label>
           <input className={`${inputClass} w-24`} placeholder="Edad" value={expediente.antecedentes.padres?.edad_madre_embarazo || ''} onChange={e => updateCampo('antecedentes.padres.edad_madre_embarazo', e.target.value)} />
        </div>
        <div className="flex items-center gap-4">
           <label className="text-[10px] font-bold text-slate-500 uppercase w-40 shrink-0">* Embarazo No.:</label>
           <div className="relative w-24">
              <select className={`${inputClass} appearance-none bg-white`} value={expediente.antecedentes.padres?.numero_embarazo || '1'} onChange={e => updateCampo('antecedentes.padres.numero_embarazo', e.target.value)}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <label className="text-[10px] font-bold text-slate-500 uppercase w-40 shrink-0">* Semanas de gestación:</label>
           <div className="relative w-24">
              <select className={`${inputClass} appearance-none bg-white`} value={expediente.antecedentes.padres?.semanas_gestacion || '40'} onChange={e => updateCampo('antecedentes.padres.semanas_gestacion', e.target.value)}>
                {Array.from({length: 27}, (_, i) => i + 16).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
           </div>
        </div>
      </div>
    </div>
  );

const renderPerinatales = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><Baby size={16} className="text-blue-500"/> Antecedentes Perinatales</h4>
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.perinatales?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.perinatales.preguntados_y_negados', e.target.checked)} />
          <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
          <span className="text-xs text-amber-600 ml-1">— El paciente niega antecedentes perinatales</span>
        </label>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
        
        {/* GRUPO 1: SOBRE EL NACIMIENTO */}
        <h5 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 border-b border-blue-100 pb-1">
          Sobre el nacimiento
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
           <div>
              <label className={labelClass}>Anestesia</label>
              <input 
                className={inputClass} 
                placeholder="Tipo de anestesia (sólo si aplica)" 
                value={expediente.antecedentes.perinatales?.anestesia || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.anestesia', e.target.value)} 
              />
           </div>
           <div>
              <label className={labelClass}>Sitio de atención</label>
              <input 
                className={inputClass} 
                placeholder="Hospital / Clínica / Domicilio" 
                value={expediente.antecedentes.perinatales?.sitio_atencion || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.sitio_atencion', e.target.value)} 
              />
           </div>
           
           <div className="flex flex-col justify-center">
              <label className={labelClass}>¿Curso normal?</label>
              <div className="flex gap-6 mt-2 px-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer hover:text-blue-600">
                  <input 
                    type="radio" 
                    className="w-4 h-4 accent-blue-600" 
                    checked={expediente.antecedentes.perinatales?.curso_normal === true} 
                    onChange={() => updateCampo('antecedentes.perinatales.curso_normal', true)} 
                  /> Sí
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer hover:text-blue-600">
                  <input 
                    type="radio" 
                    className="w-4 h-4 accent-blue-600" 
                    checked={expediente.antecedentes.perinatales?.curso_normal === false} 
                    onChange={() => updateCampo('antecedentes.perinatales.curso_normal', false)} 
                  /> No
                </label>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>* Tipo de nacimiento</label>
                <div className="relative">
                  <select 
                    className={`${inputClass} appearance-none bg-white cursor-pointer`} 
                    value={expediente.antecedentes.perinatales?.tipo_nacimiento || ''} 
                    onChange={e => updateCampo('antecedentes.perinatales.tipo_nacimiento', e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Parto">Parto</option>
                    <option value="Cesarea">Cesárea</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
                </div>
              </div>
              <div>
                <label className={labelClass}>Duración de parto</label>
                <input 
                  className={inputClass} 
                  placeholder="Horas" 
                  value={expediente.antecedentes.perinatales?.duracion_parto || ''} 
                  onChange={e => updateCampo('antecedentes.perinatales.duracion_parto', e.target.value)} 
                />
              </div>
           </div>
        </div>

        {/* GRUPO 2: SOBRE EL BEBÉ */}
        <h5 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 border-b border-blue-100 pb-1">
          Sobre el bebé
        </h5>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
           <div>
              <label className={labelClass}>* Peso (Kg)</label>
              <input 
                type="number" 
                className={inputClass} 
                value={expediente.antecedentes.perinatales?.peso || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.peso', e.target.value)} 
              />
           </div>
           <div>
              <label className={labelClass}>* Talla (cm)</label>
              <input 
                type="number" 
                className={inputClass} 
                value={expediente.antecedentes.perinatales?.talla || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.talla', e.target.value)} 
              />
           </div>
           <div>
              <label className={labelClass}>Apgar</label>
              <div className="relative">
                <select 
                    className={`${inputClass} appearance-none bg-white cursor-pointer`} 
                    value={expediente.antecedentes.perinatales?.apgar || ''} 
                    onChange={e => updateCampo('antecedentes.perinatales.apgar', e.target.value)}
                >
                    <option value="">--</option>
                    {[...Array(11).keys()].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
              </div>
           </div>
           <div>
              <label className={labelClass}>Silverman-Anderson</label>
              <div className="relative">
                <select 
                    className={`${inputClass} appearance-none bg-white cursor-pointer`} 
                    value={expediente.antecedentes.perinatales?.silverman || ''} 
                    onChange={e => updateCampo('antecedentes.perinatales.silverman', e.target.value)}
                >
                    <option value="">--</option>
                    {[...Array(11).keys()].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
           <div>
              <label className={labelClass}>Tamiz metabólico</label>
              <input 
                className={inputClass} 
                value={expediente.antecedentes.perinatales?.tamiz_metabolico || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.tamiz_metabolico', e.target.value)} 
              />
           </div>
           <div>
              <label className={labelClass}>Tamiz auditivo</label>
              <input 
                className={inputClass} 
                value={expediente.antecedentes.perinatales?.tamiz_auditivo || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.tamiz_auditivo', e.target.value)} 
              />
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
              <label className={labelClass}>Maniobras de reanimación</label>
              <textarea 
                className={`${inputClass} h-24 resize-none bg-white`} 
                value={expediente.antecedentes.perinatales?.reanimacion || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.reanimacion', e.target.value)} 
              />
           </div>
           <div>
              <label className={labelClass}>Otros / Observaciones</label>
              <textarea 
                className={`${inputClass} h-24 resize-none bg-white`} 
                value={expediente.antecedentes.perinatales?.otros || ''} 
                onChange={e => updateCampo('antecedentes.perinatales.otros', e.target.value)} 
              />
           </div>
        </div>

      </div>
    </div>
  );

const renderPsicomotor = () => {
    const data = expediente.antecedentes.psicomotor || {};

    // Agrupación lógica para las tarjetas
    const categorias = [
      {
        titulo: 'Desarrollo Motor Inicial',
        clase: 'bg-blue-50/40 border-blue-100',
        texto: 'text-blue-600',
        hitos: [
          { l: 'Sostuvo la cabeza', k: 'sostuvo_cabeza' },
          { l: 'Rodamiento', k: 'rodamiento' },
          { l: 'Sedestación', k: 'sedestacion' },
          { l: 'Gateó', k: 'gateo' },
        ]
      },
      {
        titulo: 'Social y Lenguaje',
        clase: 'bg-emerald-50/40 border-emerald-100',
        texto: 'text-emerald-600',
        hitos: [
          { l: 'Sonrió', k: 'sonrio' },
          { l: 'Siguió objetos', k: 'siguio_objetos' },
          { l: 'Bisílabos', k: 'bisilabos' },
          { l: 'Lenguaje fluido', k: 'lenguaje_fluido', unit: 'años' },
        ]
      },
      {
        titulo: 'Locomoción y Control',
        clase: 'bg-violet-50/40 border-violet-100',
        texto: 'text-violet-600',
        hitos: [
          { l: 'Caminó', k: 'camino' },
          { l: 'Correr', k: 'correr' },
          { l: 'Bipedestación', k: 'bipedestacion' },
          { l: 'Subir escaleras', k: 'subir_escaleras' },
          { l: 'Control de esfínteres', k: 'control_esfinteres' },
        ]
      }
    ];

    return (
      <div className={sectionClass}>
        <h4 className={headerClass}><Zap size={16} className="text-blue-500"/> Desarrollo Psicomotor</h4>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.psicomotor?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.psicomotor.preguntados_y_negados', e.target.checked)} />
            <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
            <span className="text-xs text-amber-600 ml-1">— El paciente niega alteraciones del desarrollo psicomotor</span>
          </label>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          
          {/* GRID DE TARJETAS CATEGORIZADAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {categorias.map((cat, idx) => (
              <div key={idx} className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col ${cat.clase}`}>
                <div className="px-5 py-3 border-b border-inherit">
                  <h5 className={`text-[10px] font-black uppercase tracking-[0.15em] ${cat.texto}`}>{cat.titulo}</h5>
                </div>
                <div className="p-5 space-y-4 bg-white/60 backdrop-blur-sm flex-1">
                  {cat.hitos.map(h => (
                    <div key={h.k} className="flex items-center justify-between group">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-slate-800 transition-colors">
                        {h.l}
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          className="w-14 h-9 text-center bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
                          value={data[h.k] || ''} 
                          onChange={e => updateCampo(`antecedentes.psicomotor.${h.k}`, e.target.value)}
                          placeholder="0"
                        />
                        <span className="text-[9px] font-black text-slate-300 uppercase w-8">{h.unit || 'meses'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ÁREAS DE NOTAS ESTILIZADAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
              <label className={labelClass}>Desempeño escolar</label>
              <textarea 
                className={`${inputClass} h-24 resize-none bg-white border-none shadow-inner mt-2`} 
                placeholder="Escriba observaciones sobre el rendimiento académico..."
                value={data.desempeno_escolar || ''} 
                onChange={e => updateCampo('antecedentes.psicomotor.desempeno_escolar', e.target.value)} 
              />
            </div>
            <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
              <label className={labelClass}>Otros Hallazgos</label>
              <textarea 
                className={`${inputClass} h-24 resize-none bg-white border-none shadow-inner mt-2`} 
                placeholder="Cualquier otra observación relevante del desarrollo..."
                value={data.otros_psicomotor || ''} 
                onChange={e => updateCampo('antecedentes.psicomotor.otros_psicomotor', e.target.value)} 
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. GINECO-OBSTÉTRICOS (Versión Avanzada con Tabs)
  const renderGineco = () => {
    // Helper para no escribir rutas largas y evitar errores de undefined
    const data = expediente.antecedentes.gineco_obstetricos || {};

    return (
      <div className={sectionClass}>
        <h4 className={headerClass}><HeartPulse size={16} className="text-blue-500"/> Gineco-Obstétricos</h4>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.gineco_obstetricos?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.gineco_obstetricos.preguntados_y_negados', e.target.checked)} />
            <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
            <span className="text-xs text-amber-600 ml-1">— La paciente niega antecedentes gineco-obstétricos</span>
          </label>
        </div>
        
        {/* Navegación de Pestañas Internas */}
        <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          {[
            { id: 'menstruaciones', label: 'Menstruaciones' },
            { id: 'embarazos', label: 'Embarazos' },
            { id: 'otros_ginecologicos', label: 'Otros ginecológicos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveGinecoTab(tab.id)}
              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-colors border-t border-l border-r ${
                activeGinecoTab === tab.id 
                ? 'bg-blue-50 text-blue-700 border-blue-200 border-b-transparent relative top-[1px]' 
                : 'bg-white text-slate-400 border-transparent hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
  
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 h-full">
          
          {/* --- TAB 1: MENSTRUACIONES --- */}
          {activeGinecoTab === 'menstruaciones' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-2 space-y-5">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div>
                      <label className={labelClass}>* Edad 1ª menstruación (Menarquía)</label>
                      <input type="number" className={inputClass} value={data.menarca || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.menarca', e.target.value)} />
                   </div>
                   <div>
                      <label className={labelClass}>* F.U.M.</label>
                      <input type="date" className={inputClass} value={data.fum || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.fum', e.target.value)} />
                   </div>
                   <div className="md:col-span-2">
                      <label className={labelClass}>* Característica de la menstruación</label>
                      <select className={`${inputClass} bg-white`} value={data.caracteristicas_menstruacion || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.caracteristicas_menstruacion', e.target.value)}>
                          <option value="">Seleccionar...</option>
    
    <option value="Normal">Normal</option>

    <option value="Irregular">Polimenorrea (Ciclos muy frecuentes)</option>
    <option value="Irregular">Oligomenorrea (Ciclos muy espaciados)</option>
    <option value="Irregular">Amenorrea (Ausencia de menstruación)</option>
    <option value="Irregular">Metrorragia (Sangrado fuera del ciclo)</option>
    <option value="Irregular">Opsomenorrea (Retraso en el flujo)</option>
    <option value="Irregular">Proiomenorrea (Ciclos cortos)</option>
    <option value="Irregular">Disovulia (Ovulación irregular)</option>
    <option value="Irregular">Criptomenorrea (Menstruación oculta)</option>

    <option value="Abundante">Hipermenorrea (Mucha cantidad)</option>
    <option value="Abundante">Menorragia (Sangrado excesivo y prolongado)</option>
    <option value="Abundante">Nictomenorrea (Predominio de sangrado nocturno)</option>

    <option value="Escasa">Hipomenorrea (Poca cantidad)</option>
    <option value="Escasa">Braquimenorrea (Corta duración)</option>

    <option value="Dolorosa">Dismenorrea (Dolorosa)</option>
                      </select>
                   </div>
                   <div>
                      <label className={labelClass}>Inicio vida sexual (IVSA)</label>
                      <input type="number" className={inputClass} value={data.ivsa || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.ivsa', e.target.value)} />
                   </div>
                   <div>
                      <label className={labelClass}>Edad de menopausia</label>
                      <input type="number" className={inputClass} value={data.menopausia || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.menopausia', e.target.value)} />
                   </div>
                 </div>
              </div>
              <div className="lg:col-span-1 flex flex-col">
                 <label className={labelClass}>Otros</label>
                 <textarea className={`${inputClass} flex-1 resize-none h-full min-h-[200px] bg-white`} value={data.menstruacion_otros || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.menstruacion_otros', e.target.value)} />
              </div>
            </div>
          )}
  
          {/* --- TAB 2: EMBARAZOS --- */}
          {activeGinecoTab === 'embarazos' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
               <div className="lg:col-span-2 space-y-4">
                 {[
                   {l: 'Total de embarazos', k: 'gestas'},
                   {l: 'No. de partos', k: 'partos'},
                   {l: 'No. de cesáreas', k: 'cesareas'},
                   {l: 'No. de abortos', k: 'abortos'},
                   {l: 'Número de nacidos vivos', k: 'nacidos_vivos'},
                   {l: 'Número de vivos actuales', k: 'vivos_actuales'},
                 ].map((item) => (
                   <div key={item.k} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                      <label className="text-xs font-bold text-slate-600 uppercase flex-1 pl-2">{item.l}</label>
                      <input type="number" className="w-24 p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white" 
                        value={data[item.k] || ''} 
                        onChange={e => updateCampo(`antecedentes.gineco_obstetricos.${item.k}`, e.target.value)} 
                        placeholder="0"
                      />
                   </div>
                 ))}
               </div>
               <div className="lg:col-span-1 flex flex-col">
                 <label className={labelClass}>Otros</label>
                 <textarea className={`${inputClass} flex-1 resize-none h-full min-h-[200px] bg-white`} value={data.embarazos_otros || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.embarazos_otros', e.target.value)} />
              </div>
             </div>
          )}
  
          {/* --- TAB 3: OTROS GINECOLÓGICOS --- */}
          {activeGinecoTab === 'otros_ginecologicos' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in h-full">
                {/* Columna Izquierda */}
                <div className="space-y-6">
                   {/* Fechas Estudios */}
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      {[
                        {l: 'Último Papanicolaou', k: 'fecha_papanicolaou', c: 'papanicolaou_check'},
                        {l: 'Última Colposcopia', k: 'fecha_colposcopia', c: 'colposcopia_check'},
                        {l: 'Última Mamografía', k: 'fecha_mamografia', c: 'mamografia_check'},
                      ].map(f => (
                        <div key={f.k} className="flex items-center gap-3">
                           <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" 
                              checked={data[f.c] || false} onChange={e => updateCampo(`antecedentes.gineco_obstetricos.${f.c}`, e.target.checked)} />
                           <label className="text-[11px] font-bold text-slate-600 w-36 uppercase">{f.l}</label>
                           <input type="date" className="flex-1 p-1.5 border border-slate-200 rounded text-xs text-slate-600 bg-white disabled:opacity-50" 
                              disabled={!data[f.c]} value={data[f.k] || ''} onChange={e => updateCampo(`antecedentes.gineco_obstetricos.${f.k}`, e.target.value)} />
                        </div>
                      ))}
                   </div>
  
                   {/* Parejas */}
                   <div className="flex items-center justify-between px-2">
                      <label className="text-xs font-bold text-blue-900 uppercase">Número de parejas sexuales</label>
                      <input type="number" className="w-20 p-2 border border-slate-200 rounded-lg text-center font-bold bg-white" value={data.parejas_sexuales || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.parejas_sexuales', e.target.value)} />
                   </div>
  
                   {/* Metodos Anticonceptivos */}
                   <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                      <label className="text-xs font-bold text-teal-700 uppercase mb-3 block">Métodos anticonceptivos</label>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                         {['Implante','Mirena','Kyleena','DIU plata','DIU cobre'].map(m => {
                            const k = m.toLowerCase().replace(' ', '_');
                            return (
                              <label key={k} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer hover:text-teal-600">
                                 <input type="checkbox" className="accent-teal-500 w-4 h-4 rounded" 
                                    checked={data.metodos_anticonceptivos?.[k] || false} 
                                    onChange={e => updateCampo(`antecedentes.gineco_obstetricos.metodos_anticonceptivos.${k}`, e.target.checked)} />
                                 {m}
                              </label>
                            )
                         })}
                      </div>
                      <textarea className={`${inputClass} h-20 bg-white border-teal-100 focus:border-teal-400`} placeholder="Descripción o detalles..." value={data.metodos_anticonceptivos_texto || ''} onChange={e => updateCampo('antecedentes.gineco_obstetricos.metodos_anticonceptivos_texto', e.target.value)}/>
                   </div>
                </div>
  
                {/* Columna Derecha */}
                <div className="space-y-4">
                   {[
                     {l: 'Procedimientos ginecológicos', k: 'procedimientos_ginecologicos'},
                     {l: 'Hábitos', k: 'habitos'},
                     {l: 'Presencia de otros flujos vaginales', k: 'flujos_vaginales'},
                     {l: 'Otros', k: 'otros_ginecologicos'},
                   ].map(area => (
                     <div key={area.k}>
                        <label className={`${labelClass} text-blue-800`}>{area.l}</label>
                        <textarea className={`${inputClass} h-20 resize-none bg-white`} value={data[area.k] || ''} onChange={e => updateCampo(`antecedentes.gineco_obstetricos.${area.k}`, e.target.value)} />
                     </div>
                   ))}
                </div>
             </div>
          )}
  
        </div>
      </div>
    );
  };

  // --- RENDERS ORIGINALES (RECUPERADOS) ---

  const renderHereditarios = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><Activity size={16} className="text-blue-500"/> Antecedentes Heredofamiliares</h4>
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.hereditarios?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.hereditarios.preguntados_y_negados', e.target.checked)} />
          <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
          <span className="text-xs text-amber-600 ml-1">— El paciente niega antecedentes heredofamiliares</span>
        </label>
      </div>
      <div className="flex-1 w-full overflow-hidden flex flex-col border border-slate-200 rounded-2xl">
        <div className="flex bg-slate-50 border-b border-slate-200 shrink-0">
          <div className={`${tableHeaderClass} w-48 text-left pl-6`}>Padecimiento</div>
          {['Mamá','Papá','Hnos','Tíos','Primos','Abuelos'].map(f => (
            <div key={f} className={`${tableHeaderClass} flex-1`}>{f}</div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {Object.keys(expediente.antecedentes.hereditarios || {}).filter(k => k !== 'otros').map((enf) => (
            <div key={enf} className={`flex ${tableRowClass}`}>
              <div className="w-48 pl-6 text-xs font-bold text-slate-700 capitalize">{enf.replace('_', ' ')}</div>
              {['mama','papa','hermanos','tios','primos','abuelos'].map(fam => (
                <div key={fam} className="flex-1 flex justify-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600 rounded border-slate-300 cursor-pointer"
                    checked={expediente.antecedentes.hereditarios?.[enf]?.[fam] || false}
                    onChange={e => updateCampo(`antecedentes.hereditarios.${enf}.${fam}`, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 shrink-0">
        <label className={labelClass}>Otros Antecedentes</label>
        <textarea className={`${inputClass} h-20 resize-none`} value={expediente.antecedentes.hereditarios?.otros || ''} onChange={e => updateCampo('antecedentes.hereditarios.otros', e.target.value)} />
      </div>
    </div>
  );

  const renderNoPatologicos = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><ClipboardList size={16} className="text-blue-500"/> Personales No Patológicos</h4>
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {['Baño','Lavado de dientes','Habitación','Alimentación','Sedentarismo'].map(item => {
            const key = item.toLowerCase().replace(/ /g,'_').replace('ñ','n').replace('ó','o');
            const opts = key === 'bano' ? ['Diario','Cada 3er día','Irregular'] : key === 'sedentarismo' ? ['Si','No'] : ['Buena','Regular','Mala'];
            return (
              <div key={key} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className={labelClass}>{item}</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {opts.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-blue-600 transition-colors">
                      <input type="radio" name={key} className="w-4 h-4 accent-blue-600" checked={expediente.antecedentes.no_patologicos?.[key] === opt} onChange={() => updateCampo(`antecedentes.no_patologicos.${key}`, opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <label className={labelClass}>Observaciones Adicionales</label>
          <textarea className={`${inputClass} h-32 resize-none bg-white`} value={expediente.antecedentes.no_patologicos?.otros || ''} onChange={e => updateCampo('antecedentes.no_patologicos.otros', e.target.value)} />
        </div>
      </div>
    </div>
  );

  const renderPatologicos = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><FlaskConical size={16} className="text-blue-500"/> Personales Patológicos</h4>
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          <div className="space-y-4">
            {[
              { label: 'Enfermedades actuales', key: 'actuales' },
              { label: 'Quirúrgicos', key: 'quirurgicos' },
              { label: 'Transfusionales', key: 'transfusionales' },
              { label: 'Traumáticos', key: 'traumaticos' },
              { label: 'Hospitalizaciones', key: 'hospitalizaciones' }
            ].map(item => {
              const negado = expediente.antecedentes.patologicos?.[`${item.key}_negado`] || false;
              return (
                <div key={item.key} className={`rounded-xl border p-3 transition-colors ${negado ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${labelClass} text-blue-900 border-l-2 border-blue-500 pl-2 !mb-0`}>{item.label}</label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-amber-500 rounded" checked={negado} onChange={e => {
                        updateCampo(`antecedentes.patologicos.${item.key}_negado`, e.target.checked);
                        if (e.target.checked) updateCampo(`antecedentes.patologicos.${item.key}`, 'NEGADOS');
                      }} />
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Negado</span>
                    </label>
                  </div>
                  {negado ? (
                    <div className="text-xs font-bold text-slate-400 italic py-2 text-center">Preguntado y negado por el paciente</div>
                  ) : (
                    <textarea className={`${inputClass} h-14 resize-none bg-white shadow-sm`} value={expediente.antecedentes.patologicos?.[item.key] || ''} onChange={e => updateCampo(`antecedentes.patologicos.${item.key}`, e.target.value)} />
                  )}
                </div>
              );
            })}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
              <label className={`${labelClass} text-blue-900 border-l-2 border-blue-500 pl-2 mb-3`}>Adicciones</label>
              <div className="flex gap-6 mb-3">
                {['Tabaquismo', 'Alcohol', 'Drogas'].map(a => (
                  <label key={a} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={expediente.antecedentes.patologicos?.adicciones?.[a.toLowerCase()] || false} onChange={e => updateCampo(`antecedentes.patologicos.adicciones.${a.toLowerCase()}`, e.target.checked)} /> {a}
                  </label>
                ))}
              </div>
              <textarea className={`${inputClass} h-16 bg-white`} placeholder="Detalles..." value={expediente.antecedentes.patologicos?.adicciones?.detalle || ''} onChange={e => updateCampo('antecedentes.patologicos.adicciones.detalle', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Glaucoma', key: 'glaucoma' },
              { label: 'Cálculo biliar', key: 'calculo' },
              { label: 'Reflujo', key: 'reflujo' },
              { label: 'Incontinencia', key: 'incontinencia' },
              { label: 'Dislipidemias', key: 'dislipidemias' },
              { label: 'Otro', key: 'otro' }
            ].map(item => {
              const negado = expediente.antecedentes.patologicos?.especificos?.[`${item.key}_negado`] || false;
              return (
                <div key={item.key} className={`rounded-xl border p-3 transition-colors ${negado ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${labelClass} !mb-0`}>{item.label}</label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-amber-500 rounded" checked={negado} onChange={e => {
                        updateCampo(`antecedentes.patologicos.especificos.${item.key}_negado`, e.target.checked);
                        if (e.target.checked) updateCampo(`antecedentes.patologicos.especificos.${item.key}`, 'NEGADOS');
                      }} />
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Negado</span>
                    </label>
                  </div>
                  {negado ? (
                    <div className="text-xs font-bold text-slate-400 italic py-2 text-center">Preguntado y negado por el paciente</div>
                  ) : (
                    <textarea className={`${inputClass} h-14 resize-none bg-white shadow-sm`} value={expediente.antecedentes.patologicos?.especificos?.[item.key] || ''} onChange={e => updateCampo(`antecedentes.patologicos.especificos.${item.key}`, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAparatos = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><Activity size={16} className="text-blue-500"/> Interrogatorio por Aparatos</h4>
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
          {['Digestivo', 'Cardiovascular', 'Respiratorio', 'Urinario', 'Genital', 'Hematológico', 'Endocrino', 'Osteomuscular', 'Nervioso', 'Sensorial', 'Psicosomático', 'Otro'].map(item => {
            const key = item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(' ', '_');
            return (
              <div key={key}>
                <label className={`${labelClass} text-blue-900 border-l-2 border-blue-500 pl-2`}>{item}</label>
                <textarea className={`${inputClass} h-16 resize-none bg-white mt-1 shadow-sm`} value={expediente.antecedentes.aparatos?.[key] || ''} onChange={e => updateCampo(`antecedentes.aparatos.${key}`, e.target.value)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAlergias = () => {

    const CATS = [
  "AINE", 
  "ANTICONVULSIVOS", 
  "ANTITOXINAS EXTRAÑAS", 
  "ANTITUBERCULOSOS", 
  "CEFALOSPORINA", 
  "ENZIMA", 
  "INSULINA", 
  "PENICILINA", 
  "RELAJANTES MUSCULARES", 
  "SALES DE PLATINO", 
  "SULFONAMIDAS", 
  "MACRÓLIDOS", 
  "LÁTEX"
];
    const negados = expediente.antecedentes.alergias?.preguntados_y_negados || false;

    return (
      <div className={sectionClass}>
        <h4 className={`${headerClass} text-rose-600 border-rose-100`}><FlaskConical size={16} /> Registro de Alergias</h4>

        {/* Preguntados y negados */}
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={negados} onChange={e => updateCampo('antecedentes.alergias.preguntados_y_negados', e.target.checked)} />
            <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
            <span className="text-xs text-amber-600 ml-1">— El paciente niega cualquier alergia</span>
          </label>
        </div>

        {!negados && (
          <>
            {/* Formulario de registro */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 shrink-0 w-full">
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600"><input type="radio" name="al" className="w-4 h-4 accent-blue-600" checked={!expediente.antecedentes.alergias?.buscar_sustancia} onChange={() => updateCampo('antecedentes.alergias.buscar_sustancia', false)} /> Categoría</label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600"><input type="radio" name="al" className="w-4 h-4 accent-blue-600" checked={expediente.antecedentes.alergias?.buscar_sustancia} onChange={() => updateCampo('antecedentes.alergias.buscar_sustancia', true)} /> Sustancia</label>
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  {!expediente.antecedentes.alergias?.buscar_sustancia ? (
                    <select className={`${inputClass} bg-white`} value={tempAlergia.nombre} onChange={e => setTempAlergia({ nombre: e.target.value })}><option value="">Seleccionar...</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
                  ) : (
                    <input className={`${inputClass} bg-white`} placeholder="Nombre de sustancia..." value={tempAlergia.nombre} onChange={e => setTempAlergia({ nombre: e.target.value })} />
                  )}
                </div>
                <button onClick={() => { if(tempAlergia.nombre) { updateCampo('antecedentes.alergias.lista', [...(expediente.antecedentes.alergias?.lista || []), { sustancia: tempAlergia.nombre }]); setTempAlergia({ nombre: '' }); } }} className="bg-blue-600 text-white px-8 h-[46px] rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-600 transition-all active:scale-95">AGREGAR</button>
              </div>
            </div>

            {/* Lista de alergias detectadas */}
            <div className="flex-1 w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col mb-4">
              <div className={tableHeaderClass}>Alergias Detectadas</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {(expediente.antecedentes.alergias?.lista || []).map((a, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <span className="font-bold text-slate-700 text-sm">{a.sustancia}</span>
                    <button onClick={() => updateCampo('antecedentes.alergias.lista', expediente.antecedentes.alergias.lista.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Otros (texto libre) */}
            <div className="w-full">
              <label className={labelClass}>Otros</label>
              <textarea className={`${inputClass} h-24 resize-none bg-white`} placeholder="Especifique otras alergias no listadas..." value={expediente.antecedentes.alergias?.otros || expediente.antecedentes.alergias?.otras || ''} onChange={e => updateCampo('antecedentes.alergias.otros', e.target.value)} />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderVacunas = () => (
    <div className={sectionClass}>
      <h4 className={headerClass}><Shield size={16} className="text-blue-500"/> Esquema de Vacunación</h4>
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.vacunas?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.vacunas.preguntados_y_negados', e.target.checked)} />
          <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
          <span className="text-xs text-amber-600 ml-1">— El paciente niega vacunación</span>
        </label>
      </div>
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 shrink-0 w-full">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className={labelClass}>Vacuna</label><input className={inputClass} placeholder="Ej. Influenza" value={tempVacuna.nombre} onChange={e => setTempVacuna({...tempVacuna, nombre: e.target.value})} /></div>
          <div><label className={labelClass}>Edad / Fecha</label><input className={inputClass} placeholder="Ej. 2 meses" value={tempVacuna.fecha} onChange={e => setTempVacuna({...tempVacuna, fecha: e.target.value})} /></div>
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1"><label className={labelClass}>Notas</label><input className={inputClass} value={tempVacuna.nota} onChange={e => setTempVacuna({...tempVacuna, nota: e.target.value})} /></div>
          <button onClick={() => { if(tempVacuna.nombre) { updateCampo('antecedentes.vacunas.lista', [...(expediente.antecedentes.vacunas?.lista || []), tempVacuna]); setTempVacuna({ nombre: '', fecha: '', nota: '', seAplicoAqui: false }); } }} className="bg-blue-600 text-white px-8 h-[46px] rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-600 transition-all active:scale-95">REGISTRAR</button>
        </div>
      </div>
      <div className="flex-1 w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
        <div className="flex bg-slate-50 border-b border-slate-200 shrink-0">
          <div className={`${tableHeaderClass} w-1/3`}>Fecha/Edad</div>
          <div className={`${tableHeaderClass} flex-1`}>Vacuna</div>
          <div className={`${tableHeaderClass} w-16`}></div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {(expediente.antecedentes.vacunas?.lista || []).map((v, i) => (
            <div key={i} className={`flex ${tableRowClass}`}>
              <div className="w-1/3 text-center text-slate-500 text-sm font-medium">{v.fecha}</div>
              <div className="flex-1 text-center font-bold text-slate-700 text-sm">{v.nombre}</div>
              <div className="w-16 flex justify-center"><button onClick={() => updateCampo('antecedentes.vacunas.lista', expediente.antecedentes.vacunas.lista.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

const renderCirugias = () => {
    const lista = expediente.antecedentes.cirugias?.lista || [];
    
    return (
      <div className={sectionClass}>
        <h4 className={headerClass}><Scissors size={16} className="text-blue-500"/> Cirugías e Intervenciones</h4>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-6 w-full shrink-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-amber-600 rounded" checked={expediente.antecedentes.cirugias?.preguntados_y_negados || false} onChange={e => updateCampo('antecedentes.cirugias.preguntados_y_negados', e.target.checked)} />
            <span className="font-bold text-sm text-amber-800">Preguntados y negados</span>
            <span className="text-xs text-amber-600 ml-1">— El paciente niega cirugías previas</span>
          </label>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {/* FORMULARIO DE CAPTURA ESTILIZADO */}
          <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 mb-8 space-y-6">
            
            {/* Fila 1: Textareas de Procedimiento y Notas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>* Procedimiento:</label>
                <textarea 
                  className={`${inputClass} h-32 resize-none bg-white shadow-sm`} 
                  placeholder="Procedimiento de cirugía realizada" 
                  value={tempCirugia.procedimiento} 
                  onChange={e => setTempCirugia({...tempCirugia, procedimiento: e.target.value})} 
                />
              </div>
              <div>
                <label className={labelClass}>Operación realizada:</label>
                <textarea 
                  className={`${inputClass} h-32 resize-none bg-white shadow-sm`} 
                  placeholder="Operación realizada sobre el paciente" 
                  value={tempCirugia.operacion} 
                  onChange={e => setTempCirugia({...tempCirugia, operacion: e.target.value})} 
                />
              </div>
              <div>
                <label className={labelClass}>Nota operatoria:</label>
                <textarea 
                  className={`${inputClass} h-32 resize-none bg-white shadow-sm`} 
                  placeholder="Observaciones pertinentes" 
                  value={tempCirugia.nota} 
                  onChange={e => setTempCirugia({...tempCirugia, nota: e.target.value})} 
                />
              </div>
            </div>

            {/* Fila 2: Unidad y Selector de Intervención */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
              <div>
                <label className={labelClass}>Unidad médica:</label>
                <input 
                  className={`${inputClass} bg-white shadow-sm`} 
                  placeholder="Lugar donde se realizó" 
                  value={tempCirugia.unidad} 
                  onChange={e => setTempCirugia({...tempCirugia, unidad: e.target.value})} 
                />
              </div>
              
              <div className="lg:col-span-2 flex flex-col md:flex-row gap-6 items-start md:items-end">
                <div className="flex flex-col gap-2 shrink-0">
                  <label className={labelClass}>Intervención:</label>
                  <div className="flex gap-4 h-[46px] items-center px-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input type="radio" name="tipoInt" className="w-4 h-4 accent-blue-600" checked={tempCirugia.tipoFecha === 'ano'} onChange={() => setTempCirugia({...tempCirugia, tipoFecha: 'ano'})} /> *Año
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input type="radio" name="tipoInt" className="w-4 h-4 accent-blue-600" checked={tempCirugia.tipoFecha === 'fecha'} onChange={() => setTempCirugia({...tempCirugia, tipoFecha: 'fecha'})} /> *Fecha y hora
                    </label>
                  </div>
                </div>

                <div className="flex-1 w-full">
                  {tempCirugia.tipoFecha === 'ano' ? (
                    <input type="number" className={`${inputClass} bg-white shadow-sm`} placeholder="2026" value={tempCirugia.ano} onChange={e => setTempCirugia({...tempCirugia, ano: e.target.value})} />
                  ) : (
                    <input type="datetime-local" className={`${inputClass} bg-white shadow-sm text-slate-500`} value={tempCirugia.fechaHora} onChange={e => setTempCirugia({...tempCirugia, fechaHora: e.target.value})} />
                  )}
                </div>
              </div>
            </div>

            {/* Fila 3: Diagnóstico */}
            <div>
              <label className={labelClass}>Diagnóstico operatorio:</label>
              <textarea 
                className={`${inputClass} h-20 resize-none bg-white shadow-sm`} 
                placeholder="Describa el diagnóstico del paciente" 
                value={tempCirugia.diagnostico} 
                onChange={e => setTempCirugia({...tempCirugia, diagnostico: e.target.value})} 
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setTempCirugia({ procedimiento: '', operacion: '', nota: '', unidad: '', tipoFecha: 'fecha', ano: '2026', fechaHora: '', diagnostico: '' })}
                className="px-6 h-[46px] rounded-xl font-bold text-sm text-slate-500 hover:bg-white hover:shadow-sm transition-all"
              >
                Nuevo
              </button>
              <button 
                type="button"
                onClick={() => {
                  if(!tempCirugia.procedimiento) return alert("El procedimiento es obligatorio");
                  const nueva = {
                    ...tempCirugia,
                    id: Date.now(),
                    fechaRegistro: tempCirugia.tipoFecha === 'ano' ? tempCirugia.ano : tempCirugia.fechaHora.split('T')[0],
                    medico: expediente.medicoNombre || 'Médico Tratante'
                  };
                  updateCampo('antecedentes.cirugias.lista', [...lista, nueva]);
                  setTempCirugia({ procedimiento: '', operacion: '', nota: '', unidad: '', tipoFecha: 'fecha', ano: '2026', fechaHora: '', diagnostico: '' });
                }}
                className="bg-blue-600 text-white px-10 h-[46px] rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-600 transition-all active:scale-95"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* TABLA DE HISTORIAL DE CIRUGÍAS */}
          <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm flex flex-col mb-4">
            <div className="grid grid-cols-[140px_1fr_180px_50px] bg-slate-50 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 shrink-0">
              <span>Fecha</span><span>Procedimiento</span><span>Médico</span><span></span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
              {lista.map((c, i) => (
                <div key={c.id || i} className="grid grid-cols-[140px_1fr_180px_50px] py-4 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors group">
                  <span className="text-center text-xs font-bold text-slate-400">{c.fechaRegistro}</span>
                  <span className="px-6 text-xs font-bold text-blue-900 uppercase truncate">{c.procedimiento}</span>
                  <span className="text-center text-[10px] font-bold text-slate-500 uppercase">{c.medico}</span>
                  <div className="flex justify-center">
                    <button 
                      onClick={() => updateCampo('antecedentes.cirugias.lista', lista.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}
              {lista.length === 0 && (
                <div className="p-16 text-center text-slate-300 text-xs font-medium italic">
                  No se han registrado procedimientos quirúrgicos previos.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };
// ... (después de que terminen todas tus funciones render...)

  // --- 1. MUEVE ESTO AQUÍ (FUERA DE LAS FUNCIONES RENDER) ---
  const isAdulto = edad >= 18;
  const isMujer = sexo === 'Femenino';

  const todasLasOpciones = [
    {id:'hereditarios', label:'Hereditarios', icon: <Activity size={18}/>, visible: true},
    {id:'cie10', label:'Enf. CIE-10', icon: <CheckCircle size={18}/>, visible: true},
    {id:'padres', label:'Padres', icon: <Users size={18}/>, visible: !isAdulto}, 
    {id:'perinatales', label:'Perinatales', icon: <Baby size={18}/>, visible: !isAdulto}, 
    {id:'psicomotor', label:'Psicomotor', icon: <Zap size={18}/>, visible: !isAdulto}, 
    {id:'gineco', label:'Gineco-Obst.', icon: <HeartPulse size={18}/>, visible: isMujer}, 
    {id:'no_patologicos', label:'No Patológicos', icon: <ClipboardList size={18}/>, visible: true},
    {id:'patologicos', label:'Patológicos', icon: <FlaskConical size={18}/>, visible: true},
    {id:'aparatos', label:'Aparatos y Sist.', icon: <Activity size={18}/>, visible: true},
    {id:'alergias', label:'Alergias', icon: <FlaskConical size={18}/>, visible: true},
    {id:'vacunas', label:'Vacunas', icon: <Shield size={18}/>, visible: true},
    {id:'cirugias', label:'Cirugías', icon: <Scissors size={18}/>, visible: true}
  ];

  const opcionesVisibles = todasLasOpciones.filter(op => op.visible);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* --- BARRA SUPERIOR CON BOTÓN SIGUIENTE --- */}
      {onNextStep && (
        <div className="shrink-0 flex items-center justify-end px-4 py-2 bg-white border-b border-slate-100">
          <button 
            onClick={onNextStep}
            className="group flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full font-bold text-xs shadow-md shadow-blue-600/25 transition-all active:scale-[0.97]"
          >
            Consulta
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}
    <div className="flex flex-1 w-full gap-6 overflow-hidden">
      {/* --- 2. USA opcionesVisibles AQUÍ --- */}
      <div className="w-56 flex flex-col gap-2 shrink-0 bg-slate-50/50 p-2 rounded-2xl border border-slate-100 overflow-y-auto custom-scrollbar">
        {opcionesVisibles.map(item => (
          <button key={item.id} onClick={() => setActiveSubTab(item.id)}
            className={`p-3.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all ${
                activeSubTab === item.id 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200 ring-2 ring-blue-50' 
                : 'text-slate-400 hover:bg-white/60 hover:text-slate-600'
            }`}
          >
            <span className={activeSubTab === item.id ? 'text-blue-500' : 'text-slate-400'}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden h-full flex flex-col bg-slate-50/30">
        {activeSubTab === 'hereditarios' && renderHereditarios()}
        {activeSubTab === 'padres' && renderPadres()}
        {activeSubTab === 'cie10' && renderCie10()}
        {activeSubTab === 'perinatales' && renderPerinatales()}
        {activeSubTab === 'psicomotor' && renderPsicomotor()}
        {activeSubTab === 'gineco' && renderGineco()}
        {activeSubTab === 'no_patologicos' && renderNoPatologicos()}
        {activeSubTab === 'patologicos' && renderPatologicos()}
        {activeSubTab === 'aparatos' && renderAparatos()}
        {activeSubTab === 'alergias' && renderAlergias()}
        {activeSubTab === 'vacunas' && renderVacunas()}
        {activeSubTab === 'cirugias' && renderCirugias()}
      </div>

    </div>
    </div>
  );
};

export default SeccionAntecedentes;