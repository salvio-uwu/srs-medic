import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Calendar, MapPin, Printer, ChevronDown,
  CheckCircle2, AlertTriangle, Package, ShieldAlert, Trash2, X, ArrowLeftRight
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import TraspasoSucursalModal from '../../components/TraspasoSucursalModal';

/* ════════════════════════════════════════════════════════════════
   CADUCIDADES JEFATURA — Auditoría de Medicamentos Próximos a Caducar
   Colección Firestore: caducidades_almacen
   ════════════════════════════════════════════════════════════════ */

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const CaducidadesJefatura = () => {
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
  const [traspasoItem, setTraspasoItem] = useState(null);
  const [traspasoMsg, setTraspasoMsg] = useState('');

  const abrirTraspaso = (reg) => setTraspasoItem({
    nombre: reg.medicamento || '',
    numeroAcomodo: reg.codigo || '',
    lote: reg.lote || '',
    caducidad: reg.mesCaducidad || '',
    cantidadDisponible: Number(reg.cantidad) || 0,
    sucursalOrigen: reg.sucursal || ''
  });

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

  // ─── Registros del mes en tiempo real ───
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'caducidades_almacen'),
      where('mesCaducidad', '==', mesActual)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !r.eliminado);
      docs.sort((a, b) => (a.medicamento || '').localeCompare(b.medicamento || ''));
      setRegistros(docs);
      setLoading(false);
    }, (err) => {
      console.error('Error cargando caducidades:', err);
      setLoading(false);
    });
    return () => unsub();
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
        (r.codigo || '').toLowerCase().includes(term) ||
        (r.medicamento || '').toLowerCase().includes(term) ||
        (r.lote || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [registros, filtroSucursal, filtroBusqueda]);

  // ─── Estadísticas por sucursal ───
  const estadisticasPorSucursal = useMemo(() => {
    const map = {};
    registros.forEach(r => {
      const suc = r.sucursal || 'Sin sucursal';
      if (!map[suc]) map[suc] = { total: 0, medicamentos: 0 };
      map[suc].total++;
      map[suc].medicamentos += (r.cantidad || 0);
    });
    return map;
  }, [registros]);

  // ─── Eliminar (soft delete para auditoría) ───
  const handleEliminar = async (id) => {
    try {
      await updateDoc(doc(db, 'caducidades_almacen', id), {
        eliminado: true,
        eliminadoPor: user?.nombre || 'Sin nombre',
        eliminadoPorId: user?.uid || '',
        eliminadoPorRol: user?.rol || '',
        eliminadoEn: serverTimestamp()
      });
      setConfirmDelete(null);
    } catch {}
  };

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

  const mesLabel = (() => {
    const [y, m] = mesActual.split('-');
    return `${MESES[Number(m) - 1]} ${y}`;
  })();

  // ─── Print ───
  const handlePrint = () => {
    const sections = registrosPorSucursal.map(([sucName, regs]) => {
      const rows = regs.map((r, i) => `
        <tr style="${i % 2 === 0 ? '' : 'background:#f8fafc'}">
          <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;font-weight:600">${escapeHtml(r.codigo)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px">${escapeHtml(r.medicamento)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;text-align:center;font-weight:700">${r.cantidad}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;font-weight:600">${escapeHtml(r.lote)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:10px;color:#64748b">${escapeHtml(r.responsableNombre || '')}</td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom:24px">
          <h3 style="font-size:14px;color:#334155;margin:0 0 8px;padding:6px 12px;background:#f1f5f9;border-radius:6px;border-left:4px solid #f97316">${escapeHtml(sucName)} <span style="font-size:11px;color:#94a3b8;font-weight:normal">(${regs.length} registros)</span></h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155;text-align:left">Código</th>
              <th style="background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155;text-align:left">Medicamento</th>
              <th style="background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155;text-align:center">Cantidad</th>
              <th style="background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155;text-align:left">Lote</th>
              <th style="background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155;text-align:left">Responsable</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Caducidades ${mesLabel}</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px;color:#1e293b}
      @media print{button{display:none!important}@page{size:landscape;margin:10mm}}</style></head><body>
      <div style="text-align:center;margin-bottom:20px">
        <h1 style="margin:0;font-size:20px;color:#1e293b">MEDICAMENTO PRÓXIMO A CADUCAR — ALMACÉN</h1>
        <p style="margin:4px 0 0;font-size:14px;color:#64748b;font-weight:600">${mesLabel.toUpperCase()}</p>
      </div>
      ${sections}
      <p style="margin-top:20px;font-size:10px;color:#94a3b8;text-align:right">Impreso: ${new Date().toLocaleString('es-MX')} | Generado por: ${escapeHtml(user?.nombre || '')}</p>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;padding:10px 28px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px">Imprimir</button></div>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in">
      {traspasoMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1200] bg-white border border-slate-200 shadow-lg rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-800">
          {traspasoMsg}
        </div>
      )}
      {traspasoItem && (
        <TraspasoSucursalModal
          item={traspasoItem}
          onClose={() => setTraspasoItem(null)}
          onDone={({ msg }) => {
            setTraspasoMsg(msg);
            setTimeout(() => setTraspasoMsg(''), 3500);
          }}
        />
      )}
      {/* ─── HEADER + FILTROS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-sm">
            <ShieldAlert size={18} className="text-white"/>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-slate-800" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Caducidades de Almacén</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Medicamentos Próximos a Caducar</p>
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
              <option value="">Todas las sucursales</option>
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
              placeholder="Buscar medicamento..."
              className="pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all w-44"
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
                    ? 'bg-orange-50 border-orange-300 text-orange-700 ring-1 ring-orange-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <MapPin size={11} className={isActive ? 'text-orange-500' : 'text-slate-400'}/>
                {suc}
                <span className={`px-1.5 py-px rounded text-[10px] font-black ${isActive ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{stats.total}</span>
                <span className={`px-1.5 py-px rounded text-[10px] font-semibold ${isActive ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>{stats.medicamentos} uds</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── CONTENIDO ─── */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-xs text-slate-400 mt-2">Cargando...</p>
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package size={28} className="text-slate-200 mx-auto mb-2"/>
          <p className="text-sm font-bold text-slate-500">Sin registros de caducidades en este periodo</p>
          <p className="text-xs text-slate-400 mt-1">Seleccione otro mes o sucursal.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {registrosPorSucursal.map(([sucName, regs]) => (
            <div key={sucName} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header sucursal */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-orange-500"/>
                  <span className="text-[12px] font-bold text-slate-700">{sucName}</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">{regs.length} medicamentos</span>
                </div>
                <span className="text-[9px] font-bold text-slate-400">
                  {regs.reduce((sum, r) => sum + (r.cantidad || 0), 0)} unidades total
                </span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Código</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Medicamento</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-center border-b border-slate-100">Cantidad</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Lote</th>
                      <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Responsable</th>
                      <th className="bg-white px-3 py-2 border-b border-slate-100 w-14"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regs.map((reg, idx) => (
                      <tr key={reg.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors`}>
                        <td className="px-4 py-2.5 border-b border-slate-50 font-semibold text-slate-800 text-[12px]">{reg.codigo}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-[12px] text-slate-700 font-medium">{reg.medicamento}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md text-[11px] font-bold">
                            {reg.cantidad}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-slate-50 font-semibold text-slate-600 text-[12px]">{reg.lote}</td>
                        <td className="px-4 py-2.5 border-b border-slate-50">
                          <p className="text-[11px] font-semibold text-slate-500">{reg.responsableNombre}</p>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-50 text-center">
                          {confirmDelete === reg.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEliminar(reg.id)} className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><CheckCircle2 size={12}/></button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><X size={12}/></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => abrirTraspaso(reg)} title="Traspasar a otra sucursal" className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><ArrowLeftRight size={12}/></button>
                              <button onClick={() => setConfirmDelete(reg.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12}/></button>
                            </div>
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
                  <div key={reg.id} className="bg-white rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 truncate">{reg.medicamento}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-400 font-semibold">Cód: {reg.codigo}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">Lote: {reg.lote}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">{reg.responsableNombre}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[11px] font-bold shrink-0">{reg.cantidad}</span>
                      {confirmDelete === reg.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEliminar(reg.id)} className="p-1 rounded bg-red-100 text-red-600"><CheckCircle2 size={12}/></button>
                          <button onClick={() => setConfirmDelete(null)} className="p-1 rounded bg-slate-100 text-slate-500"><X size={12}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirTraspaso(reg)} className="p-1 text-slate-400 hover:text-blue-600"><ArrowLeftRight size={12}/></button>
                          <button onClick={() => setConfirmDelete(reg.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                      )}
                    </div>
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

// ── Utilidad ──
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default CaducidadesJefatura;
