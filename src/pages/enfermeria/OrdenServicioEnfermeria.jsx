import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, User, Syringe, FileText, Plus, Trash2,
  Activity, Hash, ClipboardList, AlertCircle,
  CheckCircle, Stethoscope, Package, ChevronLeft
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../config/firebase';
import {
  doc, getDoc, addDoc, updateDoc, collection, serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const VIA_OPTIONS = ['Intramuscular', 'Intravenosa', 'Oral', 'Subcutánea', 'Tópica', 'Inhalatoria', 'Sublingual', 'Otra'];

const SIGNOS_CAMPOS = [
  { key: 'ta', label: 'T/A (mmHg)', placeholder: '120/80' },
  { key: 'fc', label: 'F.C. (lpm)', placeholder: '72' },
  { key: 'fr', label: 'F.R. (rpm)', placeholder: '16' },
  { key: 'temp', label: 'Temp. (°C)', placeholder: '36.5' },
  { key: 'spo2', label: 'SpO₂ (%)', placeholder: '98' },
  { key: 'glucosa', label: 'Glucosa (mg/dL)', placeholder: '90' },
  { key: 'peso', label: 'Peso (kg)', placeholder: '70' },
  { key: 'talla', label: 'Talla (m)', placeholder: '1.70' },
];

const OrdenServicioEnfermeria = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const citaId = useMemo(() => searchParams.get('citaId') || '', [searchParams]);

  const [cita, setCita] = useState(null);
  const [ordenId, setOrdenId] = useState('');
  const [loadingCita, setLoadingCita] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState('');
  const readOnly = false; // Siempre editable; se puede reabrir y corregir.

  const [motivoClinico, setMotivoClinico] = useState('');
  const [notasClinicas, setNotasClinicas] = useState('');
  const [codigoCompras, setCodigoCompras] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [signos, setSignos] = useState({
    ta: '', temp: '', fc: '', fr: '', spo2: '', glucosa: '', peso: '', talla: ''
  });

  const [insumos, setInsumos] = useState([]);
  const [tempInsumo, setTempInsumo] = useState({
    nombre: '', cantidad: '', unidad: '', codigoArticulo: '', via: 'Intramuscular', hora: '', nota: ''
  });

  const [procedimientos, setProcedimientos] = useState([]);
  const [tempProcedimiento, setTempProcedimiento] = useState('');

  useEffect(() => {
    if (!citaId) {
      setLoadingCita(false);
      setError('No se recibió el ID de la cita.');
      return;
    }
    const fetchCita = async () => {
      try {
        const snap = await getDoc(doc(db, 'citas', citaId));
        if (!snap.exists()) {
          setError('Cita no encontrada.');
          return;
        }
        const data = snap.data();
        setCita({ id: snap.id, ...data });
        setMotivoClinico(data.motivo || '');

        // Prefill signos desde triage si existen
        if (data.signos_vitales) {
          setSignos((prev) => ({
            ...prev,
            ta: data.signos_vitales.ta || '',
            temp: data.signos_vitales.temp || '',
            fc: data.signos_vitales.fc || '',
            fr: data.signos_vitales.fr || '',
            spo2: data.signos_vitales.spo2 || '',
            glucosa: data.signos_vitales.glucosa || '',
            peso: data.signos_vitales.peso || '',
            talla: data.signos_vitales.talla || '',
          }));
        }

        // Si ya hay orden, cargar datos (sigue editable para correcciones)
        if (data.ordenEnfermeriaId) {
          const ordenSnap = await getDoc(doc(db, 'ordenes_enfermeria', data.ordenEnfermeriaId));
          if (ordenSnap.exists()) {
            const orden = ordenSnap.data();
            setOrdenId(ordenSnap.id);
            setMotivoClinico(orden.motivoClinico || data.motivo || '');
            setNotasClinicas(orden.notasClinicas || '');
            setCodigoCompras(orden.codigoCompras || '');
            setObservaciones(orden.observaciones || '');
            setSignos((prev) => ({ ...prev, ...(orden.signos || {}) }));
            setInsumos(Array.isArray(orden.insumos) ? orden.insumos : []);
            setProcedimientos(Array.isArray(orden.procedimientos) ? orden.procedimientos : []);
          }
        }
      } catch (e) {
        setError('Error al cargar la cita: ' + e.message);
      } finally {
        setLoadingCita(false);
      }
    };
    fetchCita();

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTempInsumo((prev) => ({ ...prev, hora: `${hh}:${mm}` }));
  }, [citaId]);

  const addInsumo = () => {
    if (readOnly) return;
    if (!tempInsumo.nombre.trim() || !tempInsumo.cantidad.trim() || !tempInsumo.via || !tempInsumo.hora) {
      setError('Para agregar un insumo completa: nombre, cantidad, vía y hora.');
      return;
    }
    setError('');
    setInsumos((prev) => [...prev, { ...tempInsumo, id: Date.now() }]);
    setTempInsumo((prev) => ({ nombre: '', cantidad: '', unidad: '', codigoArticulo: '', via: prev.via, hora: prev.hora, nota: '' }));
  };

  const removeInsumo = (id) => {
    if (readOnly) return;
    setInsumos((prev) => prev.filter((item) => item.id !== id));
  };

  const addProcedimiento = () => {
    if (readOnly) return;
    if (!tempProcedimiento.trim()) return;
    setProcedimientos((prev) => [...prev, { nombre: tempProcedimiento.trim(), id: Date.now() }]);
    setTempProcedimiento('');
  };

  const removeProcedimiento = (id) => {
    if (readOnly) return;
    setProcedimientos((prev) => prev.filter((item) => item.id !== id));
  };

  const validarObligatorios = () => {
    const faltantes = [];
    if (!motivoClinico.trim()) faltantes.push('Motivo clínico');
    if (!notasClinicas.trim()) faltantes.push('Notas clínicas');
    if (!observaciones.trim()) faltantes.push('Observaciones finales');
    if (!codigoCompras.trim()) faltantes.push('Código de compras / requisición (o N/A)');

    if (insumos.length === 0 && procedimientos.length === 0) {
      faltantes.push('Al menos 1 procedimiento o 1 insumo/medicamento');
    }

    insumos.forEach((item, idx) => {
      if (!item.nombre?.trim() || !item.cantidad?.trim() || !item.via || !item.hora) {
        faltantes.push(`Insumo #${idx + 1} incompleto (nombre, cantidad, vía, hora)`);
      }
    });

    return faltantes;
  };

  const handleGuardar = async () => {
    if (!citaId || !cita || readOnly) return;

    const faltantes = validarObligatorios();
    if (faltantes.length > 0) {
      setError(`Completa los campos obligatorios: ${faltantes.slice(0, 6).join(', ')}${faltantes.length > 6 ? '…' : ''}`);
      return;
    }

    setSaving(true);
    setError('');
    setSavedBanner(false);
    try {
      const payloadOrden = {
        citaId,
        pacienteId: cita.pacienteId || '',
        pacienteNombre: cita.paciente || '',
        pacienteTelefono: cita.pacienteTelefono || '',
        motivoCita: cita.motivo || '',
        motivoClinico: motivoClinico.trim(),
        fecha: cita.fecha || '',
        hora: cita.hora || '',
        sucursal: cita.sucursal || '',
        sucursalId: cita.sucursalId || '',
        consultorioNombre: cita.consultorioNombre || cita.consultorio || '',
        enfermeroAsignadoId: cita.enfermeroAsignadoId || '',
        enfermeroAsignadoNombre: cita.enfermeroAsignadoNombre || '',
        notasClinicas: notasClinicas.trim(),
        codigoCompras: codigoCompras.trim(),
        observaciones: observaciones.trim(),
        signos,
        insumos,
        procedimientos,
        estado: 'completada',
        actualizadoAt: serverTimestamp(),
        actualizadoPorId: user?.uid || '',
        actualizadoPorNombre: user?.nombre || '',
      };

      let idOrden = ordenId;
      const esNueva = !idOrden;

      if (esNueva) {
        const ordenRef = await addDoc(collection(db, 'ordenes_enfermeria'), {
          ...payloadOrden,
          registradoPorId: user?.uid || '',
          registradoPorNombre: user?.nombre || '',
          creadoAt: serverTimestamp(),
        });
        idOrden = ordenRef.id;
        setOrdenId(idOrden);

        await updateDoc(doc(db, 'citas', citaId), {
          ordenEnfermeriaId: idOrden,
          ordenEnfermeriaGenerada: true,
          ordenEnfermeriaAt: serverTimestamp(),
          estado: 'completada',
          procedimientoFinalizadoAt: serverTimestamp(),
          procedimientoFinalizadoPor: user?.uid || '',
          procedimientoFinalizadoPorNombre: user?.nombre || '',
        });

        await addDoc(collection(db, 'historial_clinico'), {
          pacienteId: cita.pacienteId || '',
          pacienteNombre: cita.paciente || '',
          medicoNombre: user?.nombre || 'Enfermero/a',
          medicoPerfil: 'Enfermería',
          fecha: serverTimestamp(),
          medicoId: user?.uid || 'anonimo',
          citaId,
          tipoNota: 'Servicio de Enfermería',
          origenRegistro: 'enfermeria_orden_servicio',
          motivoClinico: motivoClinico.trim(),
          notasClinicas: notasClinicas.trim(),
          codigoCompras: codigoCompras.trim(),
          observaciones: observaciones.trim(),
          signos,
          insumos,
          procedimientos,
          motivoCita: cita.motivo || '',
          sucursal: cita.sucursal || '',
          consultorio: cita.consultorioNombre || cita.consultorio || '',
          enfermeroNombre: user?.nombre || 'Enfermero/a',
          ordenEnfermeriaId: idOrden,
        });
      } else {
        await updateDoc(doc(db, 'ordenes_enfermeria', idOrden), payloadOrden);
        await updateDoc(doc(db, 'citas', citaId), {
          ordenEnfermeriaId: idOrden,
          ordenEnfermeriaGenerada: true,
          ordenEnfermeriaActualizadaAt: serverTimestamp(),
        });
      }

      setSavedBanner(true);
    } catch (e) {
      setError('Error al guardar la orden: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    outline: 'none',
    background: readOnly ? '#fafafa' : '#fff',
    color: '#111',
    boxSizing: 'border-box',
  };

  if (loadingCita) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="text-slate-500 text-sm font-semibold">Cargando datos de la cita…</div>
      </div>
    );
  }

  if (error && !cita) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-sm text-center">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold text-sm">{error}</p>
          <button onClick={() => window.close()} className="mt-5 text-xs text-slate-500 underline">Cerrar pestaña</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-sans pb-16">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Syringe size={18} className="text-slate-700" />
            <div>
              <h1 style={{ fontFamily: 'Sora, system-ui, sans-serif', fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>
                {ordenId ? 'Hoja de servicio — Editar' : 'Orden de servicio — Enfermería'}
              </h1>
              <p className="text-xs text-slate-500">{cita?.fecha || ''} {cita?.hora ? `• ${cita.hora}` : ''} • {cita?.sucursal || 'Clínica'}</p>
            </div>
          </div>
          <button type="button" onClick={() => window.close()} className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 font-semibold">
            <ChevronLeft size={14} /> Cerrar
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
        {savedBanner && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} /> Cambios guardados. Puedes seguir editando o cerrar la pestaña.
          </div>
        )}

        {!ordenId && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            Campos marcados con * son obligatorios. No se puede completar el servicio sin la hoja llena.
          </div>
        )}

        {/* DATOS DEL PACIENTE */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={13} style={{ color: '#9ca3af' }} /> Datos del paciente
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Nombre</p>
              <p className="font-bold text-slate-800">{cita?.paciente || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Teléfono</p>
              <p className="font-semibold text-slate-700">{cita?.pacienteTelefono || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Tipo de consulta</p>
              <p className="font-semibold text-slate-700 capitalize">{(cita?.tipoConsulta || '').replace('_', ' ') || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Motivo agendado</p>
              <p className="font-semibold text-slate-700">{cita?.motivo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Consultorio</p>
              <p className="font-semibold text-slate-700">{cita?.consultorioNombre || cita?.consultorio || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Enfermero/a asignado/a</p>
              <p className="font-bold text-slate-800">{cita?.enfermeroAsignadoNombre || '—'}</p>
            </div>
          </div>
        </section>

        {/* MOTIVO CLÍNICO */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList size={14} /> Motivo clínico y notas
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / descripción clínica *</label>
              <textarea rows={2} style={inputStyle} disabled={readOnly} placeholder="Describe el motivo de atención por enfermería…" value={motivoClinico} onChange={(e) => setMotivoClinico(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notas clínicas *</label>
              <textarea rows={3} style={inputStyle} disabled={readOnly} placeholder="Observaciones, evolución, indicaciones…" value={notasClinicas} onChange={(e) => setNotasClinicas(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <Hash size={12} /> Código de compras / requisición *
              </label>
              <input type="text" style={inputStyle} disabled={readOnly} placeholder="Ej. REQ-2026-001 o N/A" value={codigoCompras} onChange={(e) => setCodigoCompras(e.target.value)} />
            </div>
          </div>
        </section>

        {/* SIGNOS (opcionales) */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Activity size={14} /> Signos vitales
          </h2>
          <p className="text-[11px] text-slate-400 mb-3">Opcional. Captúralos solo si aplica al servicio.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SIGNOS_CAMPOS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                <input type="text" style={inputStyle} disabled={readOnly} placeholder={placeholder} value={signos[key]} onChange={(e) => setSignos((prev) => ({ ...prev, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </section>

        {/* INSUMOS */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package size={14} /> Insumos y medicamentos
          </h2>
          {!readOnly && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <input type="text" style={inputStyle} placeholder="Nombre *" value={tempInsumo.nombre} onChange={(e) => setTempInsumo((p) => ({ ...p, nombre: e.target.value }))} />
              <input type="text" style={inputStyle} placeholder="Cantidad *" value={tempInsumo.cantidad} onChange={(e) => setTempInsumo((p) => ({ ...p, cantidad: e.target.value }))} />
              <input type="text" style={inputStyle} placeholder="Unidad (ml, mg…)" value={tempInsumo.unidad} onChange={(e) => setTempInsumo((p) => ({ ...p, unidad: e.target.value }))} />
              <input type="text" style={inputStyle} placeholder="Código artículo" value={tempInsumo.codigoArticulo} onChange={(e) => setTempInsumo((p) => ({ ...p, codigoArticulo: e.target.value }))} />
              <select style={{ ...inputStyle, background: '#fff' }} value={tempInsumo.via} onChange={(e) => setTempInsumo((p) => ({ ...p, via: e.target.value }))}>
                {VIA_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="time" style={inputStyle} value={tempInsumo.hora} onChange={(e) => setTempInsumo((p) => ({ ...p, hora: e.target.value }))} />
              <input type="text" className="col-span-2" style={inputStyle} placeholder="Nota (opcional)" value={tempInsumo.nota} onChange={(e) => setTempInsumo((p) => ({ ...p, nota: e.target.value }))} />
              <button type="button" onClick={addInsumo} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={14} /> Agregar
              </button>
            </div>
          )}
          {insumos.length > 0 ? (
            <div className="space-y-2">
              {insumos.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800">{item.nombre}</span>
                    {item.cantidad && <span className="text-slate-500 ml-2">{item.cantidad} {item.unidad}</span>}
                    <span className="ml-2 text-xs text-slate-600 font-semibold">{item.via}</span>
                    {item.hora && <span className="ml-2 text-xs text-slate-500">{item.hora}</span>}
                  </div>
                  {!readOnly && (
                    <button type="button" onClick={() => removeInsumo(item.id)} className="text-red-400 hover:text-red-600 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">Sin insumos. Debe haber al menos 1 insumo o 1 procedimiento.</p>
          )}
        </section>

        {/* PROCEDIMIENTOS */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Stethoscope size={14} /> Procedimientos realizados
          </h2>
          {!readOnly && (
            <div className="flex gap-2 mb-3">
              <input type="text" style={{ ...inputStyle, flex: 1 }} placeholder="Ej. Toma de muestra, curación…" value={tempProcedimiento} onChange={(e) => setTempProcedimiento(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProcedimiento(); } }} />
              <button type="button" onClick={addProcedimiento} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Agregar
              </button>
            </div>
          )}
          {procedimientos.length > 0 ? (
            <ul className="space-y-1.5">
              {procedimientos.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{item.nombre}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => removeProcedimiento(item.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">Sin procedimientos.</p>
          )}
        </section>

        {/* OBSERVACIONES */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText size={14} /> Observaciones finales *
          </h2>
          <textarea rows={3} style={inputStyle} disabled={readOnly} placeholder="Indicaciones al paciente, seguimiento, recomendaciones…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-semibold flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {!readOnly && (
          <button type="button" disabled={saving} onClick={handleGuardar} style={{ width: '100%', background: saving ? '#9ca3af' : '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Save size={16} />
            {saving ? 'Guardando…' : (ordenId ? 'Guardar cambios' : 'Guardar hoja de servicio')}
          </button>
        )}
      </div>
    </div>
  );
};

export default OrdenServicioEnfermeria;
