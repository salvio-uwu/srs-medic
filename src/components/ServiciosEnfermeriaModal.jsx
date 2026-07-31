import React, { useEffect, useMemo, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Calendar as CalIcon, Clock, MapPin,
  ClipboardList, CheckCircle2, AlertCircle, ExternalLink, User, FileText
} from 'lucide-react';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import EstadoPacienteBadge from './EstadoPacienteBadge';

const toInputDateValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Vista interna: pacientes atendidos por enfermería del día,
 * agrupados por hora, con auditoría de hoja de servicio.
 */
const ServiciosEnfermeriaModal = ({
  open,
  onClose,
  citas = [],
  currentDate,
  onChangeDate,
  sucursalNombre = '',
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [ordenDetalle, setOrdenDetalle] = useState(null);
  const [loadingOrden, setLoadingOrden] = useState(false);

  const citasEnfermeria = useMemo(() => {
    return citas
      .filter((c) => c.esCitaEnfermeria && c.estado !== 'cancelada')
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  }, [citas]);

  const gruposPorHora = useMemo(() => {
    const map = new Map();
    citasEnfermeria.forEach((cita) => {
      const hora = cita.hora || 'Sin hora';
      if (!map.has(hora)) map.set(hora, []);
      map.get(hora).push(cita);
    });
    return Array.from(map.entries());
  }, [citasEnfermeria]);

  const selected = useMemo(
    () => citasEnfermeria.find((c) => c.id === selectedId) || null,
    [citasEnfermeria, selectedId]
  );

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setOrdenDetalle(null);
    }
  }, [open]);

  useEffect(() => {
    if (!selected) {
      setOrdenDetalle(null);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      if (!selected.ordenEnfermeriaId) {
        setOrdenDetalle(null);
        return;
      }
      setLoadingOrden(true);
      try {
        const snap = await getDoc(doc(db, 'ordenes_enfermeria', selected.ordenEnfermeriaId));
        if (!cancelled) {
          setOrdenDetalle(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        }
      } catch (e) {
        console.error('Error cargando orden de servicio:', e);
        if (!cancelled) setOrdenDetalle(null);
      } finally {
        if (!cancelled) setLoadingOrden(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selected?.id, selected?.ordenEnfermeriaId]);

  if (!open) return null;

  const abrirHoja = (cita) => {
    const qs = new URLSearchParams({ citaId: cita.id });
    window.open(`/enfermeria/orden-servicio?${qs.toString()}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-[95vw] xl:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
                Servicios de enfermería
              </h2>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={11} /> {sucursalNombre || 'Sin sucursal'}
                <span style={{ color: '#d1d5db' }}>·</span>
                Pacientes del día con motivo de enfermería
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-slate-200 rounded-md bg-white p-0.5">
                <button type="button" onClick={() => onChangeDate?.(-1)} className="p-1.5 text-slate-500 hover:bg-slate-50 rounded">
                  <ChevronLeft size={15} />
                </button>
                <div className="relative px-2 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    value={toInputDateValue(currentDate)}
                    onChange={(e) => {
                      if (e.target.value && onChangeDate) {
                        onChangeDate(0, new Date(`${e.target.value}T12:00:00`));
                      }
                    }}
                  />
                  <CalIcon size={13} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    {currentDate?.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <button type="button" onClick={() => onChangeDate?.(1)} className="p-1.5 text-slate-500 hover:bg-slate-50 rounded">
                  <ChevronRight size={15} />
                </button>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px' }}>
                {citasEnfermeria.length} servicio{citasEnfermeria.length !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr]">
          {/* Lista por hora */}
          <div className="overflow-y-auto border-r border-slate-200 bg-[#f7f8fa] p-3 space-y-3">
            {gruposPorHora.length === 0 && (
              <div className="text-center py-16 text-sm text-slate-400 font-medium">
                No hay servicios de enfermería en este día.
              </div>
            )}
            {gruposPorHora.map(([hora, rows]) => (
              <div key={hora} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} style={{ color: '#9ca3af' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{hora}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>{rows.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {rows.map((cita) => {
                    const active = selectedId === cita.id;
                    const tieneOrden = Boolean(cita.ordenEnfermeriaGenerada || cita.ordenEnfermeriaId);
                    return (
                      <button
                        key={cita.id}
                        type="button"
                        onClick={() => setSelectedId(cita.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: active ? '#f3f4f6' : '#fff',
                          border: 'none',
                          borderLeft: active ? '2px solid #111' : '2px solid transparent',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }} className="truncate">
                              {cita.paciente || 'Sin nombre'}
                            </p>
                            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }} className="truncate">
                              {cita.motivo || 'Sin motivo'}
                              {cita.enfermeroAsignadoNombre ? ` · ${cita.enfermeroAsignadoNombre}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <EstadoPacienteBadge cita={cita} size="xs" />
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: tieneOrden ? '#059669' : '#b45309',
                              background: tieneOrden ? '#ecfdf5' : '#fffbeb',
                              border: `1px solid ${tieneOrden ? '#a7f3d0' : '#fde68a'}`,
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}>
                              {tieneOrden ? 'Hoja lista' : 'Sin hoja'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Detalle / auditoría */}
          <div className="overflow-y-auto p-4 bg-white">
            {!selected && (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 font-medium px-6 text-center">
                Selecciona un paciente de la lista para revisar su bitácora y hoja de servicio.
              </div>
            )}

            {selected && (
              <div className="space-y-4">
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={13} style={{ color: '#9ca3af' }} /> Paciente
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { l: 'Nombre', v: selected.paciente },
                      { l: 'Motivo', v: selected.motivo },
                      { l: 'Hora', v: selected.hora || '—' },
                      { l: 'Enfermero/a', v: selected.enfermeroAsignadoNombre || 'Sin asignar' },
                      { l: 'Forma de pago', v: selected.formaPago || 'Sin registro' },
                      { l: 'Estado', v: selected.estado || '—' },
                    ].map((row, i) => (
                      <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 6, background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{row.l}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'right' }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <ClipboardList size={13} style={{ color: '#9ca3af' }} /> Hoja de servicio
                    </span>
                    {selected.ordenEnfermeriaGenerada || selected.ordenEnfermeriaId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#059669' }}>
                        <CheckCircle2 size={12} /> Registrada
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#b45309' }}>
                        <AlertCircle size={12} /> Pendiente
                      </span>
                    )}
                  </div>

                  <div style={{ padding: 12 }}>
                    {loadingOrden && (
                      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Cargando hoja…</p>
                    )}

                    {!loadingOrden && !ordenDetalle && (
                      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                          Este servicio aún no tiene hoja de servicio completa.
                        </p>
                        <button
                          type="button"
                          onClick={() => abrirHoja(selected)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <FileText size={13} /> Llenar hoja de servicio
                        </button>
                      </div>
                    )}

                    {!loadingOrden && ordenDetalle && (
                      <div className="space-y-3">
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          <p style={{ margin: '0 0 4px' }}><strong style={{ color: '#111' }}>Motivo clínico:</strong> {ordenDetalle.motivoClinico || '—'}</p>
                          <p style={{ margin: '0 0 4px' }}><strong style={{ color: '#111' }}>Notas:</strong> {ordenDetalle.notasClinicas || '—'}</p>
                          <p style={{ margin: '0 0 4px' }}><strong style={{ color: '#111' }}>Observaciones:</strong> {ordenDetalle.observaciones || '—'}</p>
                          <p style={{ margin: '0 0 4px' }}><strong style={{ color: '#111' }}>Código compras:</strong> {ordenDetalle.codigoCompras || '—'}</p>
                          <p style={{ margin: '0 0 4px' }}><strong style={{ color: '#111' }}>Registró:</strong> {ordenDetalle.registradoPorNombre || '—'}</p>
                        </div>

                        {ordenDetalle.signos && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {Object.entries(ordenDetalle.signos).filter(([, v]) => v).map(([k, v]) => (
                              <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', background: '#fafafa' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{k}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {(ordenDetalle.procedimientos?.length > 0) && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Procedimientos</p>
                            <div className="flex flex-wrap gap-1">
                              {ordenDetalle.procedimientos.map((p, i) => (
                                <span key={i} style={{ fontSize: 11, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', background: '#fafafa', color: '#374151' }}>
                                  {p.nombre || p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {(ordenDetalle.insumos?.length > 0) && (
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Insumos</p>
                            <ul className="space-y-1">
                              {ordenDetalle.insumos.map((item, i) => (
                                <li key={i} style={{ fontSize: 11, color: '#374151' }}>
                                  <strong>{item.nombre}</strong>
                                  {item.cantidad ? ` · ${item.cantidad} ${item.unidad || ''}` : ''}
                                  {item.via ? ` · ${item.via}` : ''}
                                  {item.hora ? ` · ${item.hora}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirHoja(selected)}
                          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#fff', color: '#111', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <ExternalLink size={13} /> Editar hoja de servicio
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiciosEnfermeriaModal;
