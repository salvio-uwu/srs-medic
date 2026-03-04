// src/pages/enfermeria/DashboardJefaEnfermeria.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Thermometer, Droplet,
  CheckCircle2, Search, LogOut,
  Printer, Clock, Sparkles, X, Package, ShieldAlert,
  ChevronDown, Activity, Calendar,
  ChevronRight, Clipboard, Shield, MapPin, LayoutDashboard,
  ClipboardList, Stethoscope, Plus, Zap
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo_azul.png';
import RegistrosEnfermeriaModal from '../../components/RegistrosEnfermeriaModal';

const IconCross = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2v20M2 12h20"/>
  </svg>
);

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-4 backdrop-blur-md print:hidden ${
    type === 'error'   ? 'bg-red-50/90 border-red-200 text-red-700' :
    type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-700' :
                         'bg-emerald-50/90 border-emerald-200 text-emerald-700'
  }`}>
    {type === 'error'   ? <AlertTriangle size={20}/> :
     type === 'warning' ? <Clock size={20}/> :
                          <CheckCircle2 size={20}/>}
    <span className="font-bold">{msg}</span>
    <button onClick={onClose} className="ml-3 opacity-50 hover:opacity-100 p-1 bg-black/5 rounded-full"><X size={14}/></button>
  </div>
);

const LIMPIEZA_AREAS = {
  "Rayos X":          ["Limpieza y acomodo de mobiliario","Limpieza de cuarto de control","Piso barrido y trapeado","Recolección de basura"],
  "Tomas de muestra": ["Limpieza Silla, cajón de insumos","Limpieza centrifugadora, estantes, paredes","Piso barrido y trapeado","Recolección de basura"],
  "Aplicaciones":     ["Limpieza Silla, repisa, mesa, cajón de insumos","Limpieza de cajón de pinzas, paredes y puerta","Piso barrido y trapeado","Recolección de basura"],
  "Observación":      ["Lavado de manos (Limpieza y surtido de insumos)","Limpieza de carro rojo, camas, trípie, mesa, etc.","Piso barrido y trapeado","Recolección de basura"],
  "Salas y Recepción":["Lavado de manos (Limpieza y surtido de insumos)","Sala de espera, puertas y ventanas","Piso barrido y trapeado","Recolección de basura"],
  "Sanitarios":       ["Sanitario y estación de lavado (Limpieza y surtido)","Surtido de insumos","Piso barrido y trapeado","Recolección de basura"],
  "Consultorios":     ["Estación de lavado (Limpieza y surtido de insumos)","Limpieza de consultorio en general (escritorio, sillas, repisas, etc.)","Piso barrido y trapeado","Recolección de basura"]
};

const VIEW_META = {
  dashboard:    { label: 'Resumen',    icon: LayoutDashboard, color: 'blue'   },
  temperaturas: { label: 'Temperaturas',       icon: Thermometer,     color: 'indigo' },
  cloro:        { label: 'Cloro Residual',     icon: Droplet,         color: 'cyan'   },
  limpieza:     { label: 'Limpieza y Desinf.', icon: Sparkles,        color: 'teal'   },
  recepcion:    { label: 'Recepción Insumos',  icon: Package,         color: 'violet' },
  es:           { label: 'Entradas y Salidas', icon: Activity,        color: 'indigo' },
  alertas:      { label: 'Centro de Alertas',  icon: AlertTriangle,   color: 'rose'   },
};

const COLOR_MAP = {
  blue:   { pill:'bg-blue-50 text-blue-600',     dot:'bg-blue-500',   active:'bg-white text-blue-700 shadow-sm border border-blue-200 ring-2 ring-blue-50'   },
  cyan:   { pill:'bg-cyan-50 text-cyan-600',     dot:'bg-cyan-500',   active:'bg-white text-cyan-700 shadow-sm border border-cyan-200 ring-2 ring-cyan-50'   },
  teal:   { pill:'bg-teal-50 text-teal-600',     dot:'bg-teal-500',   active:'bg-white text-teal-700 shadow-sm border border-teal-200 ring-2 ring-teal-50'   },
  violet: { pill:'bg-violet-50 text-violet-600', dot:'bg-violet-500', active:'bg-white text-violet-700 shadow-sm border border-violet-200 ring-2 ring-violet-50'},
  indigo: { pill:'bg-indigo-50 text-indigo-600', dot:'bg-indigo-500', active:'bg-white text-indigo-700 shadow-sm border border-indigo-200 ring-2 ring-indigo-50'},
  rose:   { pill:'bg-rose-50 text-rose-600',     dot:'bg-rose-500',   active:'bg-white text-rose-700 shadow-sm border border-rose-200 ring-2 ring-rose-50'   },
};

const Badge = ({ children, variant = 'default' }) => {
  const styles = {
    default:    'bg-slate-50 text-slate-600 border border-slate-200',
    critical:   'bg-rose-50 text-rose-600 font-bold border border-rose-200 shadow-sm',
    preventive: 'bg-amber-50 text-amber-600 font-bold border border-amber-200',
    ok:         'bg-emerald-50 text-emerald-600 font-bold border border-emerald-200',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest font-black ${styles[variant]}`}>
      {children}
    </span>
  );
};

const Check = ({ ok }) => ok
  ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-teal-50 text-teal-600 border border-teal-100 font-black text-xs shadow-sm">✓</span>
  : <span className="text-slate-300 font-bold">—</span>;

const StatusWidget = ({ title, done, time }) => (
  <div className={`p-4 rounded-2xl border transition-all h-full flex flex-col justify-center ${done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-rose-200 shadow-sm'}`}>
    <div className="flex justify-between items-start mb-2">
      <span className={`text-[10px] font-black uppercase tracking-widest ${done ? 'text-emerald-600' : 'text-rose-500'}`}>{title}</span>
      {done ? <CheckCircle2 size={16} className="text-emerald-500"/> : <AlertTriangle size={16} className="text-rose-500 animate-pulse"/>}
    </div>
    <p className={`text-sm font-bold ${done ? 'text-emerald-800' : 'text-slate-700'}`}>{done ? 'Completado' : 'Pendiente'}</p>
    <p className={`text-[10px] mt-1 font-bold ${done ? 'text-emerald-600' : 'text-slate-400'}`}>Requisito: {time}</p>
  </div>
);

const DashboardJefaEnfermeria = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeView,    setActiveView]    = useState('dashboard');
  const [areaLimpieza,  setAreaLimpieza]  = useState('Consultorios');
  const [currentTime,   setCurrentTime]   = useState(new Date());
  const [busqueda,      setBusqueda]      = useState('');
  const [toast,         setToast]         = useState({ show:false, msg:'', type:'info' });
  const [alertasCaducidad, setAlertasCaducidad] = useState([]);
  const [bitacorasMes,     setBitacorasMes]     = useState([]);
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [showRegistrosModal, setShowRegistrosModal] = useState(false);

  const showToast = (msg, type = 'info') => {
    setToast({ show:true, msg, type });
    setTimeout(() => setToast({ show:false, msg:'', type:'info' }), 4000);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubInventario = onSnapshot(collection(db, 'inventario'), (snap) => {
      const hoy   = new Date();
      const limit = new Date(); limit.setMonth(hoy.getMonth() + 3);
      const alertas = [];
      snap.docs.forEach(doc => {
        const item = doc.data();
        if (item.caducidad) {
          const fCad = new Date(item.caducidad);
          if (fCad <= limit && item.stock > 0) {
            const dias = Math.ceil((fCad - hoy) / 86400000);
            alertas.push({ id: doc.id, ...item, diasRestantes: dias, riesgo: dias <= 30 ? 'alto' : 'medio' });
          }
        }
      });
      setAlertasCaducidad(alertas.sort((a, b) => a.diasRestantes - b.diasRestantes));
    });

    const startOfMonth = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).toLocaleDateString('en-CA');
    const endOfMonth   = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).toLocaleDateString('en-CA');
    const unsubBitacoras = onSnapshot(
      query(collection(db, 'bitacoras_operativas'),
        where('fechaString', '>=', startOfMonth),
        where('fechaString', '<=', endOfMonth)),
      (snap) => {
        const bitacoras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        bitacoras.sort((a, b) => {
            const dateA = new Date(a.fechaString + 'T' + (a.fecha?.toDate?.().toTimeString() || '00:00:00'));
            const dateB = new Date(b.fechaString + 'T' + (b.fecha?.toDate?.().toTimeString() || '00:00:00'));
            return dateB - dateA;
        });
        setBitacorasMes(bitacoras);
      }
    );

    return () => { unsubInventario(); unsubBitacoras(); };
  }, []);

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch { showToast('Error al salir', 'error'); }
  };

  const alertasFiltradas = alertasCaducidad.filter(a =>
    (a.medicamento || a.compuesto || '').toLowerCase().includes(busqueda.toLowerCase())
  );
  const alertasCriticas = alertasCaducidad.filter(a => a.riesgo === 'alto').length;
  
  const diasDelMes = Array.from(
    { length: new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1
  );

  const meta = VIEW_META[activeView];
  const colors = COLOR_MAP[meta.color];
  const ViewIcon = meta.icon;

  const mesLabel = currentTime.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  const hoyStr = currentTime.toLocaleDateString('en-CA');
  
  // Dashboard Metrics
  const bitacorasHoy = bitacorasMes.filter(b => b.fechaString === hoyStr);
  const temp8Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('8:00'));
  const temp4Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('4:00'));
  const temp10Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('10:00'));
  const cloroDone = bitacorasHoy.some(b => b.tipo === 'Cloro y PH');

  const TableWrap = ({ children }) => (
    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in duration-500 relative z-10 flex-1 flex flex-col min-h-0 print:block">
      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-sm min-w-[800px]">{children}</table>
      </div>
    </div>
  );

  const Th = ({ children, className = '', ...props }) => (
    <th className={`px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-200 whitespace-nowrap sticky top-0 z-10 ${className}`} {...props}>
      {children}
    </th>
  );

  const Td = ({ children, className = '', ...props }) => (
    <td className={`px-4 py-3.5 text-slate-600 border-b border-slate-50 font-medium ${className}`} {...props}>
      {children}
    </td>
  );

  const DayCell = ({ children }) => (
    <td className="px-4 py-3.5 border-b border-slate-50 text-center">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-600 text-xs font-black shadow-sm">
        {children}
      </span>
    </td>
  );

  const NumCell = ({ val, bold }) => (
    <Td className={`text-center ${bold ? 'font-bold text-slate-800' : ''}`}>{val || <span className="text-slate-300 font-bold">—</span>}</Td>
  );

  const NavItem = ({ id }) => {
    const m = VIEW_META[id];
    const Icon = m.icon;
    const c = COLOR_MAP[m.color];
    const active = activeView === id;
    
    return (
      <button
        onClick={() => setActiveView(id)}
        className={`
          relative flex items-center transition-all duration-300 group shrink-0
          ${sidebarOpen 
            ? 'w-full gap-3 px-4 py-3.5 rounded-2xl' 
            : 'w-12 h-12 mx-auto justify-center rounded-[1rem]'
          }
          ${active 
            ? sidebarOpen 
                ? c.active 
                : `bg-white border-2 border-${m.color}-300 text-${m.color}-600 shadow-[0_0_15px_rgba(0,0,0,0.05)] ring-4 ring-${m.color}-50/50` 
            : 'text-slate-400 hover:bg-white/60 hover:text-slate-700 border-2 border-transparent'
          }
        `}
      >
        <Icon 
           size={sidebarOpen ? 18 : 22} 
           strokeWidth={active && !sidebarOpen ? 2.5 : 2} 
           className={active && sidebarOpen ? '' : (active ? '' : 'group-hover:text-blue-500')} 
        />
        
        {sidebarOpen && <span className="block tracking-wide text-xs font-bold whitespace-nowrap">{m.label}</span>}
        
        {id === 'alertas' && alertasCriticas > 0 && (
          <span className={`
            flex items-center justify-center font-black shadow-sm shrink-0
            ${sidebarOpen ? 'ml-auto h-5 px-2 rounded-lg text-[10px]' : 'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px]'}
            ${active ? 'bg-rose-500 text-white border-2 border-white' : 'bg-rose-100 text-rose-600 border border-rose-200'}
          `}>
            {alertasCriticas}
          </span>
        )}
      </button>
    );
  };

  const statsData = [
    { label: 'Registros este mes', value: bitacorasMes.length, icon: Clipboard, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    { label: 'Alertas críticas',   value: alertasCriticas,      icon: AlertTriangle, color: 'text-rose-600',  bg: 'bg-rose-50 border-rose-100'  },
    { label: 'Items por vencer',   value: alertasCaducidad.length, icon: Clock,    color: 'text-amber-600',bg: 'bg-amber-50 border-amber-100'},
    { label: 'Áreas Auditadas',  value: Object.keys(LIMPIEZA_AREAS).length, icon: Shield, color:'text-teal-600', bg:'bg-teal-50 border-teal-100'},
  ];

  const PrintFormat = () => {
    const printRows = Array.from({ length: 31 }, (_, i) => i + 1);
    
    const getPrintDate = (dia) => {
      try {
        const d = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia);
        if (d.getMonth() !== currentTime.getMonth()) return ''; 
        return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      } catch { return ''; }
    };

    const thP = "border border-[#888] bg-[#d9d9d9] font-bold text-[9px] uppercase text-center p-1";
    const tdP = "border border-[#888] text-[9px] text-center p-1 h-5"; 
    const tdPLeft = "border border-[#888] text-[9px] text-left px-2 py-1 h-5 font-medium"; 

    return (
      <div className="hidden print:block w-full text-black font-sans bg-white p-2">
        <div className="flex items-center justify-between mb-1">
           <img src={logoImg} className="h-14 object-contain" alt="Logo" />
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex-1 text-center pr-14">Centro Médico Santa Cruz</h1>
        </div>
        <div className="bg-[#ffff00] py-1 border-t-2 border-b-2 border-slate-600 text-center mb-1 print-exact-colors">
           <h2 className="text-sm font-bold text-black">
              Bitácora de {activeView === 'limpieza' ? `limpieza y desinfección ${areaLimpieza.toUpperCase()}` : meta.label}
           </h2>
        </div>
        <div className="flex justify-center gap-12 font-bold text-[11px] mb-2 uppercase">
           <span>MES: {mesLabel}</span>
           {activeView === 'limpieza' && <span>ÁREA: {areaLimpieza}</span>}
           <span>SUC. {user?.sucursal || 'HUASTECA'}</span>
        </div>

        {activeView === 'temperaturas' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-48"}>Fecha</th>
                <th colSpan={3} className={thP}>8:00 a.m.</th>
                <th colSpan={3} className={thP}>4:00 p.m.</th>
                <th colSpan={3} className={thP}>10:00 p.m.</th>
              </tr>
              <tr>
                {['T° Ext.','Hum %','T° Ref.', 'T° Ext.','Hum %','T° Ref.', 'T° Ext.','Hum %','T° Ref.'].map((h,i) => <th key={i} className={thP}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const regs  = bitacorasMes.filter(b => b.tipo === 'Temperatura' && b.fechaString === fStr);
                const t8  = regs.find(r => r.turno?.includes('8:00'))?.detalles  || {};
                const t4  = regs.find(r => r.turno?.includes('4:00'))?.detalles  || {};
                const t10 = regs.find(r => r.turno?.includes('10:00'))?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{t8.t_ext || ''}</td><td className={tdP}>{t8.humedad || ''}</td><td className={tdP}>{t8.t_ref || ''}</td>
                    <td className={tdP}>{t4.t_ext || ''}</td><td className={tdP}>{t4.humedad || ''}</td><td className={tdP}>{t4.t_ref || ''}</td>
                    <td className={tdP}>{t10.t_ext || ''}</td><td className={tdP}>{t10.humedad || ''}</td><td className={tdP}>{t10.t_ref || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'cloro' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-48"}>Fecha</th>
                <th colSpan={2} className={thP}>LAVADO DE MANOS 1</th>
                <th colSpan={2} className={thP}>LAVADO DE MANOS 2</th>
                <th rowSpan={2} className={thP + " w-32"}>Realizó</th>
              </tr>
              <tr>
                {['PH','CLORO','PH','CLORO'].map((h,i) => <th key={i} className={thP}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const reg  = bitacorasMes.slice().reverse().find(b => b.tipo === 'Cloro y PH' && b.fechaString === fStr);
                const det  = reg?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{det.ph_1 || ''}</td><td className={tdP}>{det.cloro_1 || ''}</td>
                    <td className={tdP}>{det.ph_2 || ''}</td><td className={tdP}>{det.cloro_2 || ''}</td>
                    <td className={tdP}>{reg?.responsableNombre || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'limpieza' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th className={thP + " w-48"}>Fecha</th>
                {LIMPIEZA_AREAS[areaLimpieza].map((col, i) => <th key={i} className={thP + " px-2 leading-tight lowercase first-letter:uppercase"}>{col}</th>)}
                <th className={thP + " w-24"}>Realizó</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const reg  = bitacorasMes.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                const det  = reg?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{det.col1 || det.limpieza_general ? 'X' : ''}</td>
                    <td className={tdP}>{det.col2 || det.piso ? 'X' : ''}</td>
                    <td className={tdP}>{det.col3 || det.basura ? 'X' : ''}</td>
                    <td className={tdP}>{det.col4 || det.surtido_insumos ? 'X' : ''}</td>
                    <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'recepcion' && (
          <>
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-16"}>FECHA</th>
                <th rowSpan={2} className={thP + " w-20 leading-tight"}>NÚMERO DE FACTURA</th>
                <th rowSpan={2} className={thP}>COMPUESTO</th>
                <th rowSpan={2} className={thP}>PRESENTACIÓN</th>
                <th rowSpan={2} className={thP + " leading-tight"}>FORMA FARMACÉUTICA</th>
                <th rowSpan={2} className={thP}>LOTE</th>
                <th rowSpan={2} className={thP + " w-10"}>CANT.</th>
                <th rowSpan={2} className={thP + " w-20 leading-tight"}>FECHA DE CADUCIDAD</th>
                <th colSpan={2} className={thP + " leading-tight"}>CRITERIO DE ACEPTACIÓN</th>
                <th colSpan={2} className={thP}>APROBADO</th>
                <th rowSpan={2} className={thP + " w-24"}>RECIBIÓ</th>
                <th rowSpan={2} className={thP + " w-32"}>OBSERVACIONES</th>
              </tr>
              <tr>
                <th className={thP + " text-[7px]"}>EMPAQUE</th>
                <th className={thP + " text-[7px]"}>ETIQUETA</th>
                <th className={thP + " w-6"}>SI</th>
                <th className={thP + " w-6"}>NO</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 20 }).map((_, i) => {
                const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && b.area === 'Recepción');
                const reg = registros[i];
                const det = reg?.detalles || {};
                return (
                  <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdP}>{reg ? reg.fechaString.split('-').reverse().join('/') : ''}</td>
                    <td className={tdP}>{det.factura || ''}</td>
                    <td className={tdPLeft}>{det.compuesto || ''}</td>
                    <td className={tdP}>{det.presentacion || ''}</td>
                    <td className={tdP}>{det.forma || ''}</td>
                    <td className={tdP}>{det.lote || ''}</td>
                    <td className={tdP}>{det.cantidad || ''}</td>
                    <td className={tdP}>{det.caducidad ? det.caducidad.split('-').reverse().join('/') : ''}</td>
                    <td className={tdP}>{reg ? (det.empaque_ok ? 'X' : '') : ''}</td>
                    <td className={tdP}>{reg ? (det.empaque_ok ? 'X' : '') : ''}</td>
                    <td className={tdP}>{reg ? (det.empaque_ok ? 'X' : '') : ''}</td>
                    <td className={tdP}>{reg ? (!det.empaque_ok ? 'X' : '') : ''}</td>
                    <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                    <td className={tdPLeft}>{det.observaciones || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-[#d9d9d9] print-exact-colors border border-[#666] border-t-0 p-2 min-h-[60px]">
             <span className="font-bold text-[10px]">COMENTARIOS:</span>
          </div>
          </>
        )}

        {activeView === 'es' && (
          <>
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th className={thP + " w-16"}>FECHA</th>
                <th className={thP + " w-20 leading-tight"}>NÚMERO DE FACTURA</th>
                <th className={thP}>COMPUESTO</th>
                <th className={thP}>PRESENTACIÓN</th>
                <th className={thP + " leading-tight"}>FORMA FARMACÉUTICA</th>
                <th className={thP}>LOTE</th>
                <th className={thP + " w-10"}>CANT.</th>
                <th className={thP + " w-20 leading-tight"}>FECHA DE CADUCIDAD</th>
                <th className={thP + " leading-tight w-24"}>TIPO DE MOVIMIENTO</th>
                <th className={thP + " w-24"}>REALIZÓ</th>
                <th className={thP + " w-32"}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 20 }).map((_, i) => {
                const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && b.area !== 'Recepción');
                const reg = registros[i];
                const det = reg?.detalles || {};
                return (
                  <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdP}>{reg ? reg.fechaString.split('-').reverse().join('/') : ''}</td>
                    <td className={tdP}>{det.factura || ''}</td>
                    <td className={tdPLeft}>{det.compuesto || ''}</td>
                    <td className={tdP}>{det.presentacion || ''}</td>
                    <td className={tdP}>{det.forma || ''}</td>
                    <td className={tdP}>{det.lote || ''}</td>
                    <td className={tdP}>{det.cantidad || ''}</td>
                    <td className={tdP}>{det.caducidad ? det.caducidad.split('-').reverse().join('/') : ''}</td>
                    <td className={tdP}>{reg?.area || ''}</td>
                    <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                    <td className={tdPLeft}>{det.observaciones || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-[#d9d9d9] print-exact-colors border border-[#666] border-t-0 p-2 min-h-[60px]">
             <span className="font-bold text-[10px]">COMENTARIOS:</span>
          </div>
          </>
        )}

      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        
        body { font-family: 'Inter', sans-serif; background: #f0f4f8; overflow: hidden; }
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05);
        }

        .th-group { background: #f8fafc !important; color: #475569 !important; font-size: 10px !important; letter-spacing: 0.1em; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .cross-float { animation: float 6s ease-in-out infinite; }

        @media print {
          body * { visibility: hidden; }
          .print-zone, .print-zone * { visibility: visible; }
          .print-zone { position: absolute; inset: 0; padding: 5mm; background: white; width: 100%; height: 100%; }
          .no-print { display: none !important; }
          .print-hidden { display: none !important; }
          @page { size: landscape; margin: 5mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-exact-colors { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {toast.show && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show:false })} />}

      <div className="flex h-[100dvh] w-screen relative overflow-hidden bg-[#f0f4f8] text-slate-700">
        
        <div className="print:hidden" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 70% 60% at 15% 0%, rgba(219,234,254,0.6) 0%, transparent 55%), radial-gradient(ellipse 55% 50% at 90% 100%, rgba(204,251,241,0.4) 0%, transparent 50%)',
        }}/>
        <div className="cross-float print:hidden" style={{ position: 'absolute', top: '10%', left: '5%', color: 'rgba(37,99,235,0.1)', pointerEvents: 'none', zIndex: 0 }}>
          <IconCross />
        </div>

        {/* ── SIDEBAR DESKTOP ──────────────────────────────────────────────────── */}
        <aside className={`print-hidden hidden md:flex flex-shrink-0 ${sidebarOpen ? 'w-64' : 'w-20'} glass-panel my-4 ml-4 rounded-[2rem] flex-col transition-all duration-300 z-20`}>
          <div className={`flex items-center gap-3 px-6 py-6 border-b border-slate-200/50 ${!sidebarOpen && 'justify-center px-0'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30">
              <ShieldAlert size={20} className="text-white" />
            </div>
            {sidebarOpen && (
              <div className="leading-tight">
                <p className="text-sm font-black text-slate-800 font-jakarta tracking-tight">Santa Cruz</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Jefatura Enfermería</p>
              </div>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto space-y-2 custom-scrollbar ${sidebarOpen ? 'p-4' : 'p-2 py-4'}`}>
            {sidebarOpen && <p className="px-2 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen</p>}
            <NavItem id="dashboard" />

            {sidebarOpen && <p className="px-2 pt-5 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditorías</p>}
            {!sidebarOpen && <div className="my-4 border-t border-slate-200/60 w-8 mx-auto"/>}
            {['temperaturas','cloro','limpieza'].map(id => <NavItem key={id} id={id} />)}

            {sidebarOpen && <p className="px-2 pt-5 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">COFEPRIS</p>}
            {!sidebarOpen && <div className="my-4 border-t border-slate-200/60 w-8 mx-auto"/>}
            {['recepcion','es'].map(id => <NavItem key={id} id={id} />)}

            {sidebarOpen && <p className="px-2 pt-5 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistema</p>}
            {!sidebarOpen && <div className="my-4 border-t border-slate-200/60 w-8 mx-auto"/>}
            <NavItem id="alertas" />
          </nav>

          <div className={`p-4 border-t border-slate-200/50 ${!sidebarOpen && 'flex justify-center'}`}>
            {sidebarOpen ? (
              <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm cursor-default">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-black flex-shrink-0 border border-slate-200">
                  {(user?.nombre || 'E')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate font-jakarta">{user?.nombre || 'Supervisora'}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user?.sucursal || 'Central'}</p>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                  <LogOut size={16}/>
                </button>
              </div>
            ) : (
              <button onClick={handleLogout} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 shadow-sm border border-slate-200 transition-all">
                <LogOut size={18}/>
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN AREA ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 md:pl-6 z-10 relative pb-[80px] md:pb-4">

          <header className="print-hidden glass-panel rounded-3xl h-16 md:h-20 mb-4 md:mb-6 px-4 md:px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={() => setSidebarOpen(o => !o)} className="hidden md:block p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:shadow-sm transition-all">
                <ChevronRight size={18} className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`}/>
              </button>
              
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shadow-sm border border-white ${colors.pill}`}>
                    <ViewIcon size={18} className="md:w-5 md:h-5"/>
                </div>
                <div>
                    <h1 className="text-sm md:text-lg font-black text-slate-800 font-jakarta leading-none">{meta.label}</h1>
                    <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-100">
                            <MapPin size={10}/> {user?.sucursal || 'General'}
                        </span>
                    </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                <Calendar size={14} className="text-slate-400"/>
                <span className="text-xs font-bold text-slate-600 capitalize">{mesLabel}</span>
              </div>
              
              <div className="hidden lg:flex items-center gap-2 border-l border-slate-200 pl-4">
                  <button onClick={() => navigate('/enfermeria/dashboard')} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                      <Stethoscope size={16}/> Agenda
                  </button>
                  <button onClick={() => setShowRegistrosModal(true)} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95">
                      <Plus size={16}/> Capturar Registros
                  </button>
              </div>

              {activeView !== 'dashboard' && activeView !== 'alertas' && (
                <button onClick={() => { window.print(); showToast('Preparando documento...', 'success'); }} className="hidden md:flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95">
                    <Printer size={16}/>
                </button>
              )}
            </div>
          </header>

          <main className="print-hidden flex-1 flex flex-col overflow-hidden relative">
              
              {/* --- DASHBOARD VIEW (CENTRO DE MANDO) --- */}
              {activeView === 'dashboard' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 pr-2">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {statsData.map((s, i) => (
                                    <div key={i} className="glass-panel rounded-2xl p-4 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner mb-2 ${s.bg}`}>
                                            <s.icon size={18} className={s.color}/>
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 font-jakarta leading-none mb-1">{s.value}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                                    <Activity size={18} className="text-blue-500"/> Semáforo Diario <span className="text-slate-400 font-medium">({hoyStr.split('-').reverse().join('/')})</span>
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-24">
                                    <StatusWidget title="Temp. Mañana" done={temp8Done} time="8:00 AM" />
                                    <StatusWidget title="Temp. Tarde" done={temp4Done} time="4:00 PM" />
                                    <StatusWidget title="Temp. Noche" done={temp10Done} time="10:00 PM" />
                                    <StatusWidget title="Cloro y PH" done={cloroDone} time="1x por día" />
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[280px]">
                                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <ClipboardList size={16} className="text-indigo-500"/> Últimos Registros
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                    {bitacorasMes.slice(0, 8).map((b, i) => (
                                        <div key={b.id || i} className="flex justify-between items-center p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{b.tipo} <span className="text-xs text-slate-400 font-medium">({b.area || b.turno || 'General'})</span></p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Por: {b.responsableNombre}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{b.fechaString.split('-').reverse().join('/')}</span>
                                        </div>
                                    ))}
                                    {bitacorasMes.length === 0 && <p className="p-6 text-center text-slate-400 text-sm italic">No hay registros recientes.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                                    <Zap size={18} className="text-amber-500"/> Accesos Directos
                                </h3>
                                <div className="space-y-3">
                                    <button onClick={() => navigate('/enfermeria/dashboard')} className="w-full bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                                        <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Stethoscope size={20}/></div>
                                        <div className="text-left">
                                            <p className="font-bold text-sm text-slate-700 group-hover:text-blue-700">Torre de Control</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Agenda y Triage</p>
                                        </div>
                                    </button>
                                    <button onClick={() => setShowRegistrosModal(true)} className="w-full bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-100 p-4 rounded-2xl flex items-center gap-4 transition-all group">
                                        <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><Plus size={20}/></div>
                                        <div className="text-left">
                                            <p className="font-bold text-sm text-slate-700 group-hover:text-emerald-700">Capturar Bitácora</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Auditoría Operativa</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[320px]">
                                <div className="p-5 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center shrink-0">
                                    <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                        <AlertTriangle size={16}/> Riesgo Inventario
                                    </h3>
                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-lg text-[10px] font-black">{alertasCriticas} Críticas</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                                    {alertasCaducidad.filter(a => a.riesgo === 'alto').slice(0, 5).map(item => (
                                        <div key={item.id} className="bg-white border border-rose-100 rounded-xl p-3 shadow-sm flex justify-between items-center hover:bg-rose-50 transition-colors">
                                            <div className="truncate pr-2">
                                                <p className="font-bold text-xs text-slate-800 truncate">{item.medicamento || item.compuesto}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Lote: <span className="font-mono">{item.lote}</span></p>
                                            </div>
                                            <div className="text-center shrink-0 bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg">
                                                <p className="text-sm font-black text-rose-600 leading-none">{item.diasRestantes}</p>
                                                <p className="text-[8px] font-bold text-rose-400 uppercase">Días</p>
                                            </div>
                                        </div>
                                    ))}
                                    {alertasCriticas === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center gap-2 text-emerald-600 opacity-60">
                                            <CheckCircle2 size={32}/>
                                            <p className="text-xs font-bold uppercase tracking-widest">Sin alertas críticas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {/* --- VISTAS TABULARES: TEMPERATURA Y CLORO --- */}
              {(activeView === 'temperaturas' || activeView === 'cloro') && (
                <TableWrap>
                    <thead>
                    <tr>
                        <Th rowSpan={2} className="text-center w-14">Día</Th>
                        {activeView === 'temperaturas' && (
                            <>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">8:00 a.m.</Th>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">4:00 p.m.</Th>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">10:00 p.m.</Th>
                            </>
                        )}
                        {activeView === 'cloro' && (
                            <>
                                <Th colSpan={2} className="th-group text-center border-l border-slate-200">Lavado de Manos 1</Th>
                                <Th colSpan={2} className="th-group text-center border-l border-slate-200">Lavado de Manos 2</Th>
                                <Th rowSpan={2} className="w-48 text-center border-l border-slate-200">Enfermera(o)</Th>
                            </>
                        )}
                    </tr>
                    <tr>
                        {activeView === 'temperaturas' && ['T° Ext.','Hum. %','T° Ref.', 'T° Ext.','Hum. %','T° Ref.', 'T° Ext.','Hum. %','T° Ref.'].map((h,i) => <Th key={i} className={`text-center ${i===0||i===3||i===6?'border-l border-slate-200':''}`}>{h}</Th>)}
                        {activeView === 'cloro' && ['PH','Cloro','PH','Cloro'].map((h,i) => <Th key={i} className={`text-center ${i===0||i===2?'border-l border-slate-200':''}`}>{h}</Th>)}
                    </tr>
                    </thead>
                    <tbody>
                    {diasDelMes.map(dia => {
                        const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                        
                        if (activeView === 'temperaturas') {
                            const regs  = bitacorasMes.filter(b => b.tipo === 'Temperatura' && b.fechaString === fStr);
                            const t8  = regs.find(r => r.turno?.includes('8:00'))?.detalles  || {};
                            const t4  = regs.find(r => r.turno?.includes('4:00'))?.detalles  || {};
                            const t10 = regs.find(r => r.turno?.includes('10:00'))?.detalles || {};
                            return (
                                <tr key={dia} className="hover:bg-blue-50/50 transition-colors group">
                                    <DayCell>{dia}</DayCell>
                                    <NumCell val={t8.t_ext}/><NumCell val={t8.humedad}/><NumCell val={t8.t_ref} bold/>
                                    <NumCell val={t4.t_ext}/><NumCell val={t4.humedad}/><NumCell val={t4.t_ref} bold/>
                                    <NumCell val={t10.t_ext}/><NumCell val={t10.humedad}/><NumCell val={t10.t_ref} bold/>
                                </tr>
                            );
                        }
                        
                        if (activeView === 'cloro') {
                            const reg  = bitacorasMes.slice().reverse().find(b => b.tipo === 'Cloro y PH' && b.fechaString === fStr);
                            const det  = reg?.detalles || {};
                            return (
                                <tr key={dia} className="hover:bg-cyan-50/50 transition-colors group">
                                    <DayCell>{dia}</DayCell>
                                    <NumCell val={det.ph_1}/><NumCell val={det.cloro_1} bold/>
                                    <NumCell val={det.ph_2}/><NumCell val={det.cloro_2} bold/>
                                    <Td className="text-[10px] uppercase font-bold text-slate-500 text-center">{reg?.responsableNombre || <span className="text-slate-300">—</span>}</Td>
                                </tr>
                            );
                        }
                        return null;
                    })}
                    </tbody>
                </TableWrap>
              )}

              {/* VISTAS DE TARJETA MÓVIL (Solo visible en md:hidden para tablas de auditoría) */}
              <div className="md:hidden flex flex-col gap-4 overflow-y-auto pb-10">
                 {(activeView === 'temperaturas' || activeView === 'cloro') && diasDelMes.map(dia => {
                     const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                     const hasData = bitacorasMes.some(b => b.fechaString === fStr && (activeView === 'temperaturas' ? b.tipo === 'Temperatura' : b.tipo === 'Cloro y PH'));
                     
                     if(!hasData) return null; 
                     
                     return (
                         <div key={dia} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                                 <span className="text-sm font-black text-slate-800">{dia} {mesLabel}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">Registrado</span>
                             </div>
                             <p className="text-xs text-slate-500 italic">Ver detalle en pantalla completa.</p>
                         </div>
                     );
                 })}
              </div>

              {/* --- LIMPIEZA ───────────────────────────────────────────────────── */}
              {activeView === 'limpieza' && (
                <div className="space-y-4 animate-in fade-in flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-3 glass-panel rounded-2xl px-5 py-3 w-fit shrink-0">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área Auditada:</label>
                        <div className="relative">
                            <select className="appearance-none bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none cursor-pointer focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all shadow-sm"
                            value={areaLimpieza} onChange={e => setAreaLimpieza(e.target.value)}>
                            {Object.keys(LIMPIEZA_AREAS).map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>

                    <TableWrap>
                        <thead>
                            <tr>
                            <Th className="text-center w-14">Día</Th>
                            {LIMPIEZA_AREAS[areaLimpieza].map((col, i) => <Th key={i}>{col}</Th>)}
                            <Th className="w-48 text-center border-l border-slate-200">Responsable</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {diasDelMes.map(dia => {
                            const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                            const reg  = bitacorasMes.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                            const det  = reg?.detalles || {};
                            return (
                                <tr key={dia} className="hover:bg-teal-50/50 transition-colors">
                                <DayCell>{dia}</DayCell>
                                <Td className="text-center"><Check ok={det.col1 || det.limpieza_general}/></Td>
                                <Td className="text-center"><Check ok={det.col2 || det.piso}/></Td>
                                <Td className="text-center"><Check ok={det.col3 || det.basura}/></Td>
                                <Td className="text-center"><Check ok={det.col4 || det.surtido_insumos}/></Td>
                                <Td className="text-[10px] font-bold uppercase text-slate-500 text-center">{reg?.responsableNombre || <span className="text-slate-300">—</span>}</Td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </TableWrap>

                    {/* Mobile Limpieza Cards */}
                    <div className="md:hidden flex flex-col gap-4 pb-10 overflow-y-auto">
                        {diasDelMes.map(dia => {
                             const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                             const reg  = bitacorasMes.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                             if(!reg) return null;
                             return (
                                 <div key={dia} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                                     <span className="text-sm font-black text-slate-800">{dia} {mesLabel}</span>
                                     <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Completado</span>
                                 </div>
                             );
                        })}
                    </div>
                </div>
              )}

             {/* --- RECEPCIÓN Y ENTRADAS/SALIDAS (FORMATO OFICIAL) ──────────────────── */}
              {(activeView === 'recepcion' || activeView === 'es') && (() => {
                  const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && (activeView === 'recepcion' ? b.area === 'Recepción' : b.area !== 'Recepción'));

                  if (registros.length === 0) {
                      return (
                          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                              <Package size={48} className="text-slate-200 mb-4" />
                              <h3 className="text-lg font-bold text-slate-700">Sin movimientos registrados</h3>
                              <p className="text-sm text-slate-400 mt-1">No hay datos de {activeView === 'recepcion' ? 'recepción' : 'entradas/salidas'} en este periodo.</p>
                          </div>
                      );
                  }

                  return (
                      <div className="flex-1 flex flex-col h-full animate-in fade-in min-h-0">
                        {/* VISTA DESKTOP (Tabla Desglosada - Formato Excel) */}
                        <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-white rounded-3xl border border-slate-200/60 shadow-sm">
                          <div className="overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-sm min-w-[1200px] border-collapse">
                              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 border-r border-slate-200">Fecha</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">Factura</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200">Insumo / Compuesto</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 border-r border-slate-200">Lote</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 border-r border-slate-200">Cant.</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">Caducidad</th>
                                  
                                  {activeView === 'recepcion' ? (
                                      <>
                                        <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 border-r border-slate-200">Criterios (Emp / Etiq)</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 border-r border-slate-200">Aprobado</th>
                                      </>
                                  ) : (
                                      <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 border-r border-slate-200">Movimiento</th>
                                  )}
                                  
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">{activeView === 'recepcion' ? 'Recibió' : 'Realizó'}</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-48">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {registros.map(reg => {
                                    const det = reg.detalles || {};
                                    const esEntrada = reg.area?.toLowerCase().includes('entrada');
                                    return (
                                      <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors group">
                                          <td className="px-4 py-3 align-middle text-center font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {reg.fechaString.split('-').reverse().join('/')}
                                          </td>
                                          <td className="px-4 py-3 align-middle font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.factura || 'S/N'}
                                          </td>
                                          <td className="px-4 py-3 align-middle border-r border-slate-100">
                                              <p className="font-bold text-xs text-slate-800">{det.compuesto}</p>
                                              <p className="text-[10px] text-slate-500 uppercase mt-0.5">{det.presentacion} • {det.forma}</p>
                                          </td>
                                          <td className="px-4 py-3 align-middle font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.lote || 'S/N'}
                                          </td>
                                          <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                              <span className={`text-sm font-black ${esEntrada || activeView === 'recepcion' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                  {esEntrada || activeView === 'recepcion' ? '+' : '-'}{det.cantidad}
                                              </span>
                                          </td>
                                          <td className="px-4 py-3 align-middle text-center font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.caducidad ? det.caducidad.split('-').reverse().join('/') : 'N/A'}
                                          </td>
                                          
                                          {activeView === 'recepcion' ? (
                                              <>
                                                <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${det.criterio_empaque ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            EMP: {det.criterio_empaque ? 'CUMPLE' : 'DAÑO'}
                                                        </span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${det.criterio_etiqueta ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            ETIQ: {det.criterio_etiqueta ? 'CUMPLE' : 'DAÑO'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                                    <Badge variant={det.criterio_empaque && det.criterio_etiqueta ? 'ok' : 'critical'}>
                                                        {det.criterio_empaque && det.criterio_etiqueta ? 'APROBADO' : 'RECHAZADO'}
                                                    </Badge>
                                                </td>
                                              </>
                                          ) : (
                                              <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                                  <Badge variant={esEntrada ? 'ok' : 'preventive'}>{reg.area}</Badge>
                                              </td>
                                          )}

                                          <td className="px-4 py-3 align-middle text-[10px] font-bold uppercase text-slate-700 border-r border-slate-100">
                                              {reg.responsableNombre.split(' ')[0]}
                                          </td>
                                          <td className="px-4 py-3 align-middle text-[10px] text-slate-500 italic max-w-[200px] truncate" title={det.observaciones}>
                                              {det.observaciones || '-'}
                                          </td>
                                      </tr>
                                    );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* VISTA MOBILE (Tarjetas Limpias y Formales) */}
                        <div className="md:hidden flex flex-col gap-4 overflow-y-auto pb-10">
                            {registros.map(reg => {
                                const det = reg.detalles || {};
                                const esEntrada = reg.area?.toLowerCase().includes('entrada');
                                
                                return (
                                    <div key={reg.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                            <div className="flex-1 pr-2">
                                                <p className="font-bold text-sm text-slate-800 leading-tight">{det.compuesto}</p>
                                                <p className="text-[10px] text-slate-500 uppercase mt-0.5">{det.presentacion} • {det.forma}</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-xl text-lg font-black shrink-0 ${esEntrada || activeView === 'recepcion' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {esEntrada || activeView === 'recepcion' ? '+' : '-'}{det.cantidad}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Factura</span>
                                                <span className="text-slate-700 font-mono font-bold block mt-0.5 truncate">{det.factura || 'S/N'}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Lote</span>
                                                <span className="text-slate-700 font-mono font-bold block mt-0.5 truncate">{det.lote || 'S/N'}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Caducidad</span>
                                                <span className="text-slate-700 font-mono font-bold block mt-0.5 truncate">{det.caducidad ? det.caducidad.split('-').reverse().join('/') : 'N/A'}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Fecha / Resp.</span>
                                                <span className="text-slate-700 font-bold block mt-0.5 truncate">{reg.fechaString.split('-').reverse().join('/')} • {reg.responsableNombre.split(' ')[0]}</span>
                                            </div>
                                        </div>

                                        {activeView === 'recepcion' && (
                                            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                                                <div className="flex gap-3">
                                                    <span className={`text-[9px] font-bold uppercase ${det.criterio_empaque ? 'text-emerald-600' : 'text-red-600'}`}>EMP: {det.criterio_empaque ? 'CUMPLE' : 'DAÑO'}</span>
                                                    <span className={`text-[9px] font-bold uppercase ${det.criterio_etiqueta ? 'text-emerald-600' : 'text-red-600'}`}>ETIQ: {det.criterio_etiqueta ? 'CUMPLE' : 'DAÑO'}</span>
                                                </div>
                                                <Badge variant={det.criterio_empaque && det.criterio_etiqueta ? 'ok' : 'critical'}>
                                                    {det.criterio_empaque && det.criterio_etiqueta ? 'APROBADO' : 'RECHAZADO'}
                                                </Badge>
                                            </div>
                                        )}

                                        {activeView === 'es' && (
                                            <div className="flex justify-end mt-1">
                                                <Badge variant={esEntrada ? 'ok' : 'preventive'}>{reg.area}</Badge>
                                            </div>
                                        )}
                                        
                                        {det.observaciones && (
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Observaciones:</span>
                                                <p className="text-[10px] text-slate-600 italic mt-0.5">{det.observaciones}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                  );
              })()}

              {/* --- ALERTAS ────────────────────────────────────────────────────── */}
              {activeView === 'alertas' && (() => {
                  if (alertasFiltradas.length === 0) {
                      return (
                          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-100 mb-4">
                                  <CheckCircle2 size={40} className="text-emerald-500"/>
                              </div>
                              <h3 className="text-xl font-bold text-slate-700">¡Inventario Saludable!</h3>
                              <p className="text-sm text-slate-400 mt-2 text-center max-w-md">No hay medicamentos próximos a caducar en los próximos 3 meses.</p>
                          </div>
                      );
                  }

                  return (
                      <div className="space-y-4 animate-in fade-in flex-1 flex flex-col min-h-0">
                          <div className="relative max-w-md shrink-0">
                              <Search size={18} className="absolute left-4 top-3.5 text-slate-400"/>
                              <input type="text" placeholder="Buscar medicamento en riesgo..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                              className="w-full pl-12 pr-4 py-3.5 text-sm bg-white border border-slate-200 rounded-2xl outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm font-medium" />
                          </div>

                          <TableWrap>
                              <thead>
                                  <tr>
                                  <Th>Medicamento / Compuesto</Th>
                                  <Th>Lote</Th>
                                  <Th className="text-center">Fecha Caducidad</Th>
                                  <Th className="text-center w-32">Días Restantes</Th>
                                  <Th className="text-center w-28">Stock</Th>
                                  <Th className="text-center w-32 border-l border-slate-200">Alerta</Th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {alertasFiltradas.map(item => (
                                  <tr key={item.id} className={`transition-colors ${item.riesgo === 'alto' ? 'hover:bg-rose-50/80 bg-rose-50/30' : 'hover:bg-amber-50/80 bg-amber-50/30'}`}>
                                      <Td className="font-bold text-sm text-slate-800">{item.medicamento || item.compuesto}</Td>
                                      <Td className="font-mono text-xs font-bold text-slate-500">{item.lote}</Td>
                                      <Td className="text-center font-mono text-xs font-bold text-slate-700">{item.caducidad.split('-').reverse().join('/')}</Td>
                                      <Td className="text-center"><span className={`font-black text-xl ${item.diasRestantes <= 30 ? 'text-rose-600' : 'text-amber-600'}`}>{item.diasRestantes}</span></Td>
                                      <Td className="text-center font-black text-lg text-slate-700">{item.stock}</Td>
                                      <Td className="text-center"><Badge variant={item.riesgo === 'alto' ? 'critical' : 'preventive'}>{item.riesgo === 'alto' ? 'Critico' : 'Atención'}</Badge></Td>
                                  </tr>
                                  ))}
                              </tbody>
                          </TableWrap>

                          {/* Mobile Alertas Cards */}
                          <div className="md:hidden flex flex-col gap-4 overflow-y-auto pb-10">
                              {alertasFiltradas.map(item => (
                                   <div key={item.id} className={`p-4 rounded-2xl border shadow-sm ${item.riesgo === 'alto' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                                       <div className="flex justify-between items-start mb-2">
                                           <h4 className="font-bold text-sm text-slate-800">{item.medicamento || item.compuesto}</h4>
                                           <Badge variant={item.riesgo === 'alto' ? 'critical' : 'preventive'}>{item.riesgo === 'alto' ? 'Critico' : 'Atención'}</Badge>
                                       </div>
                                       <div className="flex justify-between text-xs text-slate-500 mt-2">
                                           <span>Lote: {item.lote}</span>
                                           <span className="font-bold">Quedan: {item.diasRestantes} días</span>
                                       </div>
                                   </div>
                              ))}
                          </div>
                      </div>
                  );
              })()}
          </main>

          {/* ── ZONA DE IMPRESIÓN (PIXEL PERFECT EXCEL FORMAT) ── */}
          <div className="print-zone">
              <PrintFormat />
          </div>

        </div>

        {/* ── BOTTOM NAV (MOBILE ONLY) ──────────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 flex items-center gap-2 px-2 py-3 overflow-x-auto custom-scrollbar print-hidden">
            {Object.keys(VIEW_META).map(id => {
                const m = VIEW_META[id];
                const active = activeView === id;
                return (
                    <button key={id} onClick={() => setActiveView(id)} className={`flex flex-col items-center justify-center min-w-[72px] px-2 py-1 rounded-xl transition-all ${active ? `text-${m.color}-600 bg-${m.color}-50` : 'text-slate-400 hover:text-slate-600'}`}>
                        <m.icon size={22} className={active ? 'animate-pulse' : ''}/>
                        <span className="text-[9px] font-bold mt-1 tracking-tight text-center leading-tight">{m.label.split(' ')[0]}</span>
                    </button>
                )
            })}
        </nav>
        
        {/* --- MONTAR EL MODAL DE REGISTROS --- */}
        {showRegistrosModal && (
            <RegistrosEnfermeriaModal 
                onClose={() => setShowRegistrosModal(false)} 
                enfermeraNombre={user?.nombre || "Jefatura Enfermería"} 
            />
        )}

      </div>
    </>
  );
};

export default DashboardJefaEnfermeria;