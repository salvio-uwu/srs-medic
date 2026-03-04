// src/pages/rh/AuditoriaEmpleados.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

/* ─────────────────────────────────────────────
   SVG Icons Premium (Estilo PortalAcceso)
   ───────────────────────────────────────────── */
const IconUsers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconActivity = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconClock = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconEdit = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const IconHistory = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>;

const AuditoriaEmpleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Escuchar a Firebase en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('rol', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmpleados(lista);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id, nombre) => {
    if(window.confirm(`ATENCIÓN: ¿Estás seguro de eliminar definitivamente a ${nombre}? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, "users", id));
      } catch (error) {
        alert("Error al eliminar el empleado.");
      }
    }
  };

  const empleadosActivos = empleados.filter(e => e.isOnline).length;
  const empleadosOcupados = empleados.filter(e => e.statusOperativo === 'ocupado').length;

  const formatearFecha = (isoString) => {
    if (!isoString) return 'Sin registro';
    const fecha = new Date(isoString);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  // UI helpers para colores según rol y estado
  const getRoleColor = (rol) => {
    const r = rol?.toLowerCase() || '';
    if (r.includes('admin')) return { bg: '#dbeafe', text: '#2563eb', border: '#bfdbfe' };
    if (r.includes('medico') || r.includes('doctor')) return { bg: '#ccfbf1', text: '#0d9488', border: '#99f6e4' };
    if (r.includes('enfermeria')) return { bg: '#ffe4e6', text: '#e11d48', border: '#fecdd3' };
    if (r.includes('rh')) return { bg: '#fef3c7', text: '#f59e0b', border: '#fde68a' };
    return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  };

  const getStatusUI = (isOnline, statusOperativo) => {
    if (!isOnline) return { label: 'Desconectado', color: '#94a3b8', dotClass: '' };
    switch (statusOperativo) {
      case 'disponible': return { label: 'Disponible', color: '#10b981', dotClass: 'pulse-green' };
      case 'ocupado': return { label: 'En Consulta', color: '#e11d48', dotClass: 'pulse-red' };
      case 'comida': return { label: 'En Comida', color: '#f59e0b', dotClass: 'pulse-amber' };
      case 'administrativo': return { label: 'Trabajo Admin', color: '#3b82f6', dotClass: 'pulse-blue' };
      default: return { label: 'En Línea', color: '#10b981', dotClass: 'pulse-green' };
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .font-inter { font-family: 'Inter', system-ui, sans-serif; }
        
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        
        /* Pulse Animations para los status dots */
        @keyframes pulse-g { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        @keyframes pulse-r { 0% { box-shadow: 0 0 0 0 rgba(225,29,72,0.4); } 70% { box-shadow: 0 0 0 6px rgba(225,29,72,0); } 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); } }
        @keyframes pulse-a { 0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); } 70% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } }
        @keyframes pulse-b { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); } 70% { box-shadow: 0 0 0 6px rgba(59,130,246,0); } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } }
        
        .pulse-green { animation: pulse-g 2s infinite; background: #10b981; }
        .pulse-red { animation: pulse-r 2s infinite; background: #e11d48; }
        .pulse-amber { animation: pulse-a 2s infinite; background: #f59e0b; }
        .pulse-blue { animation: pulse-b 2s infinite; background: #3b82f6; }
        
        .glass-card {
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 12px 40px -12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04);
        }
        
        .btn-action {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 10px; border: none; cursor: pointer;
          transition: all 0.2s; background: transparent; color: #94a3b8;
        }
        .btn-action:hover.edit { background: #eff6ff; color: #3b82f6; }
        .btn-action:hover.history { background: #f5f3ff; color: #8b5cf6; }
        .btn-action:hover.trash { background: #fff1f2; color: #e11d48; }
        
        .stripe-bg {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(15,23,42,0.015) 18px, rgba(15,23,42,0.015) 19px);
        }
      `}</style>

      <div className="min-h-screen bg-[#f0f4f8] p-6 md:p-10 font-inter">
        
        {/* HEADER */}
        <div className="fade-up flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <IconActivity />
              </div>
              <h1 className="font-jakarta text-3xl font-bold text-[#0f172a] tracking-tight">Centro de Mando RH</h1>
            </div>
            <p className="text-[13px] text-[#64748b] font-medium ml-11">Auditoría global de personal, tiempos y accesos.</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-[#cbd5e1] shadow-sm text-[12px] font-bold text-[#64748b] uppercase tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Conexión Segura
          </div>
        </div>

        {/* KPIs */}
        <div className="fade-up delay-1 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Plantilla Total', value: empleados.length, icon: <IconUsers />, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Personal Activo', value: empleadosActivos, icon: <IconActivity />, color: '#10b981', bg: '#ecfdf5' },
            { label: 'Ocupados / Consulta', value: empleadosOcupados, icon: <IconClock />, color: '#e11d48', bg: '#fff1f2' }
          ].map((kpi, i) => (
            <div key={i} className="glass-card stripe-bg p-6 relative overflow-hidden flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className="font-jakarta text-4xl font-extrabold text-[#0f172a]">{kpi.value}</p>
              </div>
              <div style={{ background: kpi.bg, color: kpi.color }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
                {kpi.icon}
              </div>
            </div>
          ))}
        </div>

        {/* TABLA PREMIUM */}
        <div className="fade-up delay-2 glass-card overflow-hidden">
          <div className="px-8 py-5 border-b border-[#cbd5e1] bg-white flex justify-between items-center">
            <h2 className="font-jakarta text-lg font-bold text-[#0f172a]">Directorio Operativo</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] text-[10px] uppercase tracking-widest text-[#64748b] font-bold">
                  <th className="px-8 py-4">Empleado</th>
                  <th className="px-4 py-4">Rol Asignado</th>
                  <th className="px-4 py-4">Estado en Vivo</th>
                  <th className="px-4 py-4">Última Actividad</th>
                  <th className="px-8 py-4 text-right">Acciones RH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {loading ? (
                  <tr><td colSpan="5" className="px-8 py-12 text-center text-sm font-medium text-[#64748b]">Sincronizando base de datos...</td></tr>
                ) : (
                  empleados.map((emp) => {
                    const rColor = getRoleColor(emp.rol);
                    const status = getStatusUI(emp.isOnline, emp.statusOperativo);
                    const initial = (emp.nombre || emp.email || 'U').charAt(0).toUpperCase();

                    return (
                      <tr key={emp.id} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-jakarta font-bold text-sm" style={{ background: rColor.bg, color: rColor.text, border: `1px solid ${rColor.border}` }}>
                              {initial}
                            </div>
                            <div>
                              <div className="font-jakarta font-bold text-[#0f172a] text-[14px]">{emp.nombre || 'Usuario sin nombre'}</div>
                              <div className="text-[12px] text-[#64748b] font-medium">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span style={{ background: rColor.bg, color: rColor.text, borderColor: rColor.border }} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border">
                            {emp.rol?.replace('_', ' ') || 'Sin Rol'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.dotClass}`} style={{ background: status.dotClass ? '' : status.color }}></div>
                            <span className="text-[12px] font-bold" style={{ color: status.color }}>{status.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[12px] font-medium text-[#64748b]">
                          {formatearFecha(emp.lastSeen)}
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button className="btn-action history" title="Ver Bitácora de Tiempos">
                              <IconHistory />
                            </button>
                            <button className="btn-action edit" title="Modificar Rol/Sucursal">
                              <IconEdit />
                            </button>
                            {/* Evitamos que RH se borre a sí mismo o al SuperAdmin por accidente */}
                            {(emp.rol !== 'admin_maestro' && emp.rol !== 'admin') && (
                              <button onClick={() => handleDelete(emp.id, emp.nombre)} className="btn-action trash" title="Dar de Baja Definitiva">
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuditoriaEmpleados;