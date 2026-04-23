import React, { useState, useEffect, useMemo } from 'react';
import {
  Gauge, Search, Calendar, MapPin, User, CheckCircle2,
  Printer, ChevronDown, X, Trash2
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const formatDateMX = (str) => {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};

const AutoclaveJefatura = () => {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sucursales, setSucursales] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [mesActual, setMesActual] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ─── Cargar sucursales ───
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'catalogo_sucursales'));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.activo !== false);
        setSucursales(items);
      } catch {}
    };
    load();
  }, []);

  // ─── Cargar registros del mes ───
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [year, month] = mesActual.split('-').map(Number);
        const fechaInicio = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const fechaFin = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const q = query(
          collection(db, 'registros_autoclave'),
          where('fecha', '>=', fechaInicio),
          where('fecha', '<=', fechaFin)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        setRegistros(docs);
      } catch (err) {
        console.error('Error cargando registros Autoclave:', err);
      }
      setLoading(false);
    };
    load();
  }, [mesActual]);

  // ─── Filtrado ───
  const registrosFiltrados = useMemo(() => {
    let result = registros;
    if (filtroSucursal) {
      result = result.filter(r => r.sucursal === filtroSucursal);
    }
    if (filtroBusqueda) {
      const term = filtroBusqueda.toLowerCase();
      result = result.filter(r =>
        (r.responsableNombre || '').toLowerCase().includes(term) ||
        (r.litrosUtilizados || '').toLowerCase().includes(term) ||
        (r.piezas || '').toLowerCase().includes(term) ||
        (r.duracionCiclo || '').toLowerCase().includes(term) ||
        (r.observaciones || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [registros, filtroSucursal, filtroBusqueda]);

  // ─── Estadísticas por sucursal ───
  const estadisticasPorSucursal = useMemo(() => {
    const map = {};
    registros.forEach(r => {
      if (!map[r.sucursal]) map[r.sucursal] = { total: 0, ultimo: null };
      map[r.sucursal].total++;
      if (!map[r.sucursal].ultimo || r.fecha > map[r.sucursal].ultimo.fecha) {
        map[r.sucursal].ultimo = r;
      }
    });
    return map;
  }, [registros]);

  // ─── Eliminar ───
  const handleEliminar = async (id) => {
    try {
      await deleteDoc(doc(db, 'registros_autoclave', id));
      setRegistros(prev => prev.filter(r => r.id !== id));
      setConfirmDelete(null);
    } catch {}
  };

  // ─── Print ───
  const handlePrint = () => window.print();

  // ─── Agrupar por sucursal ───
  const registrosPorSucursal = useMemo(() => {
    const map = {};
    registrosFiltrados.forEach(r => {
      const suc = r.sucursal || 'Sin sucursal';
      if (!map[suc]) map[suc] = [];
      map[suc].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [registrosFiltrados]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {/* ─── HEADER + FILTROS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <Gauge size={18} className="text-white"/>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-800" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Auditoría Autoclave</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Registro de Esterilización</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              type="month"
              value={mesActual}
              onChange={e => setMesActual(e.target.value)}
              className="pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
            />
          </div>
          <div className="relative">
            <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500"/>
            <select
              value={filtroSucursal}
              onChange={e => setFiltroSucursal(e.target.value)}
              className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all appearance-none"
            >
              <option value="">Todas</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              value={filtroBusqueda}
              onChange={e => setFiltroBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all w-36"
            />
          </div>
          <button onClick={handlePrint} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors" title="Imprimir">
            <Printer size={15}/>
          </button>
        </div>
      </div>

      {/* ─── PILLS RESUMEN POR SUCURSAL ─── */}
      {Object.keys(estadisticasPorSucursal).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(estadisticasPorSucursal).map(([suc, stats]) => {
            const isActive = filtroSucursal === suc;
            return (
              <button
                key={suc}
                onClick={() => setFiltroSucursal(prev => prev === suc ? '' : suc)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                  isActive
                    ? 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <MapPin size={11} className={isActive ? 'text-violet-500' : 'text-slate-400'}/>
                {suc}
                <span className={`px-1.5 py-px rounded text-[10px] font-black ${isActive ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{stats.total}</span>
                <CheckCircle2 size={11} className="text-emerald-500"/>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── CONTENIDO ─── */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-xs text-slate-400 mt-2">Cargando...</p>
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Gauge size={28} className="text-slate-200 mx-auto mb-2"/>
          <p className="text-sm font-bold text-slate-500">Sin registros en este periodo</p>
          <p className="text-xs text-slate-400 mt-1">Seleccione otro mes o sucursal.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {registrosPorSucursal.map(([sucName, regs]) => (
            <div key={sucName} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header sucursal */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-violet-500"/>
                  <span className="text-[12px] font-bold text-slate-700">{sucName}</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">{regs.length}</span>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><CheckCircle2 size={10}/> REGISTRADO</span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Fecha</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-center border-b border-slate-100">Litros</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-center border-b border-slate-100">Piezas</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-center border-b border-slate-100">Duración</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Responsable</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Observaciones</th>
                      <th className="bg-white px-3 py-2 border-b border-slate-100 w-14"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regs.map((reg, idx) => (
                      <tr key={reg.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}>
                        <td className="px-4 py-2.5 border-b border-slate-50 font-semibold text-slate-800 text-[12px]">{formatDateMX(reg.fecha)}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-md text-[11px] font-bold">
                            {reg.litrosUtilizados}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-center font-semibold text-slate-700 text-[12px]">{reg.piezas}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-center font-semibold text-slate-700 text-[12px]">{reg.duracionCiclo}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50">
                          <p className="text-[11px] font-semibold text-slate-700">{reg.responsableNombre}</p>
                        </td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-[10px] text-slate-500 italic max-w-[140px] truncate" title={reg.observaciones}>
                          {reg.observaciones || '-'}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-50 text-center">
                          {confirmDelete === reg.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEliminar(reg.id)} className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><CheckCircle2 size={12}/></button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><X size={12}/></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(reg.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12}/></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col gap-1.5 p-2.5">
                {regs.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-800">{formatDateMX(reg.fecha)}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{reg.piezas} pzas · {reg.duracionCiclo}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{reg.responsableNombre}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded text-[11px] font-bold">
                      {reg.litrosUtilizados}
                    </span>
                    <button onClick={() => confirmDelete === reg.id ? handleEliminar(reg.id) : setConfirmDelete(reg.id)}
                      className={`shrink-0 p-1 rounded transition-colors ${confirmDelete === reg.id ? 'bg-red-100 text-red-600' : 'text-slate-300 hover:text-red-500'}`}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoclaveJefatura;
