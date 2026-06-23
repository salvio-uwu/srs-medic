import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, User, Clock, Syringe, FileText, Plus, Trash2,
  Activity, Hash, ShoppingCart, ClipboardList, AlertCircle,
  CheckCircle, Stethoscope, Package, ChevronLeft
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../config/firebase';
import {
  doc, getDoc, addDoc, updateDoc, collection, serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const VIA_OPTIONS = ['Intramuscular', 'Intravenosa', 'Oral', 'Subcutánea', 'Tópica', 'Inhalatoria', 'Sublingual', 'Otra'];

const OrdenServicioEnfermeria = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const citaId = useMemo(() => searchParams.get('citaId') || '', [searchParams]);

  const [cita, setCita] = useState(null);
  const [loadingCita, setLoadingCita] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Campos de la orden
  const [motivoClinico, setMotivoClinico] = useState('');
  const [notasClinicas, setNotasClinicas] = useState('');
  const [codigoCompras, setCodigoCompras] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Signos vitales
  const [signos, setSignos] = useState({
    ta: '', temp: '', fc: '', fr: '', spo2: '', glucosa: '', peso: '', talla: ''
  });

  // Medicamentos/insumos administrados
  const [insumos, setInsumos] = useState([]);
  const [tempInsumo, setTempInsumo] = useState({
    nombre: '', cantidad: '', unidad: '', codigoArticulo: '', via: 'Intramuscular', hora: '', nota: ''
  });

  // Procedimientos realizados
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
        if (snap.exists()) {
          setCita({ id: snap.id, ...snap.data() });
          setMotivoClinico(snap.data().motivo || '');
        } else {
          setError('Cita no encontrada.');
        }
      } catch (e) {
        setError('Error al cargar la cita: ' + e.message);
      } finally {
        setLoadingCita(false);
      }
    };
    fetchCita();

    // Pre-llenar hora actual en insumo
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTempInsumo((prev) => ({ ...prev, hora: `${hh}:${mm}` }));
  }, [citaId]);

  const addInsumo = () => {
    if (!tempInsumo.nombre.trim()) return;
    setInsumos((prev) => [...prev, { ...tempInsumo, id: Date.now() }]);
    setTempInsumo((prev) => ({ nombre: '', cantidad: '', unidad: '', codigoArticulo: '', via: prev.via, hora: prev.hora, nota: '' }));
  };

  const removeInsumo = (id) => setInsumos((prev) => prev.filter((item) => item.id !== id));

  const addProcedimiento = () => {
    if (!tempProcedimiento.trim()) return;
    setProcedimientos((prev) => [...prev, { nombre: tempProcedimiento.trim(), id: Date.now() }]);
    setTempProcedimiento('');
  };

  const removeProcedimiento = (id) => setProcedimientos((prev) => prev.filter((item) => item.id !== id));

  const handleGuardar = async () => {
    if (!citaId || !cita) return;
    setSaving(true);
    setError('');
    try {
      const ordenRef = await addDoc(collection(db, 'ordenes_enfermeria'), {
        citaId,
        pacienteId: cita.pacienteId || '',
        pacienteNombre: cita.paciente || '',
        pacienteTelefono: cita.pacienteTelefono || '',
        motivoCita: cita.motivo || '',
        motivoClinico,
        fecha: cita.fecha || '',
        hora: cita.hora || '',
        sucursal: cita.sucursal || '',
        sucursalId: cita.sucursalId || '',
        consultorioNombre: cita.consultorioNombre || '',
        enfermeroAsignadoId: cita.enfermeroAsignadoId || '',
        enfermeroAsignadoNombre: cita.enfermeroAsignadoNombre || '',
        registradoPorId: user?.uid || '',
        registradoPorNombre: user?.nombre || '',
        notasClinicas,
        codigoCompras: codigoCompras.trim(),
        observaciones,
        signos,
        insumos,
        procedimientos,
        estado: 'completada',
        creadoAt: serverTimestamp()
      });

      // Marcar la cita como completada y con orden generada
      await updateDoc(doc(db, 'citas', citaId), {
        ordenEnfermeriaId: ordenRef.id,
        ordenEnfermeriaGenerada: true,
        ordenEnfermeriaAt: serverTimestamp(),
        estado: 'completada',
        procedimientoFinalizadoAt: serverTimestamp(),
        procedimientoFinalizadoPor: user?.uid || '',
        procedimientoFinalizadoPorNombre: user?.nombre || ''
      });

      // Escribir en el expediente clínico del paciente
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
        motivoClinico,
        notasClinicas,
        codigoCompras: codigoCompras.trim(),
        observaciones,
        signos,
        insumos,
        procedimientos,
        motivoCita: cita.motivo || '',
        sucursal: cita.sucursal || '',
        consultorio: cita.consultorioNombre || '',
        enfermeroNombre: user?.nombre || 'Enfermero/a',
        ordenEnfermeriaId: ordenRef.id
      });

      setSaved(true);
    } catch (e) {
      setError('Error al guardar la orden: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingCita) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 text-sm font-semibold">Cargando datos de la cita…</div>
      </div>
    );
  }

  if (error && !cita) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-sm text-center shadow">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold text-sm">{error}</p>
          <button onClick={() => window.close()} className="mt-5 text-xs text-slate-500 underline">Cerrar pestaña</button>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-emerald-200 rounded-2xl p-8 max-w-sm text-center shadow">
          <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
          <h2 className="text-slate-800 font-black text-lg mb-1">Orden guardada</h2>
          <p className="text-slate-500 text-sm">La orden de servicio de enfermería fue registrada correctamente.</p>
          <button onClick={() => window.close()} className="mt-6 bg-emerald-600 text-white text-sm font-bold px-5 py-2 rounded-lg">Cerrar pestaña</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Syringe size={18} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 leading-tight">Orden de Servicio — Enfermería</h1>
              <p className="text-xs text-slate-500">{cita?.fecha || ''} {cita?.hora ? `• ${cita.hora}` : ''} • {cita?.sucursal || 'Clínica'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.close()}
            className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 font-semibold"
          >
            <ChevronLeft size={14} /> Cerrar
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

        {/* DATOS DEL PACIENTE */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={14} /> Datos del paciente
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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
              <p className="font-semibold text-slate-700">{cita?.consultorioNombre || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold mb-0.5">Enfermero/a asignado/a</p>
              <p className="font-bold text-indigo-700">{cita?.enfermeroAsignadoNombre || '—'}</p>
            </div>
          </div>
        </section>

        {/* MOTIVO CLÍNICO */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList size={14} /> Motivo clínico y notas
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / descripción clínica</label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400"
              placeholder="Describe el motivo de atención por enfermería…"
              value={motivoClinico}
              onChange={(e) => setMotivoClinico(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notas clínicas</label>
            <textarea
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400"
              placeholder="Observaciones, evolución, indicaciones…"
              value={notasClinicas}
              onChange={(e) => setNotasClinicas(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <Hash size={12} /> Código de compras / requisición
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Ej. REQ-2026-001"
              value={codigoCompras}
              onChange={(e) => setCodigoCompras(e.target.value)}
            />
          </div>
        </section>

        {/* SIGNOS VITALES */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={14} /> Signos vitales
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'ta', label: 'T/A (mmHg)', placeholder: '120/80' },
              { key: 'fc', label: 'F.C. (lpm)', placeholder: '72' },
              { key: 'fr', label: 'F.R. (rpm)', placeholder: '16' },
              { key: 'temp', label: 'Temp. (°C)', placeholder: '36.5' },
              { key: 'spo2', label: 'SpO₂ (%)', placeholder: '98' },
              { key: 'glucosa', label: 'Glucosa (mg/dL)', placeholder: '90' },
              { key: 'peso', label: 'Peso (kg)', placeholder: '70' },
              { key: 'talla', label: 'Talla (cm)', placeholder: '170' }
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  placeholder={placeholder}
                  value={signos[key]}
                  onChange={(e) => setSignos((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </section>

        {/* INSUMOS / MEDICAMENTOS */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package size={14} /> Insumos y medicamentos administrados
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Nombre del insumo/medicamento *"
              value={tempInsumo.nombre}
              onChange={(e) => setTempInsumo((p) => ({ ...p, nombre: e.target.value }))}
            />
            <input
              type="text"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Cantidad"
              value={tempInsumo.cantidad}
              onChange={(e) => setTempInsumo((p) => ({ ...p, cantidad: e.target.value }))}
            />
            <input
              type="text"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Unidad (ml, mg, pz…)"
              value={tempInsumo.unidad}
              onChange={(e) => setTempInsumo((p) => ({ ...p, unidad: e.target.value }))}
            />
            <input
              type="text"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Código artículo"
              value={tempInsumo.codigoArticulo}
              onChange={(e) => setTempInsumo((p) => ({ ...p, codigoArticulo: e.target.value }))}
            />
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400"
              value={tempInsumo.via}
              onChange={(e) => setTempInsumo((p) => ({ ...p, via: e.target.value }))}
            >
              {VIA_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input
              type="time"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              value={tempInsumo.hora}
              onChange={(e) => setTempInsumo((p) => ({ ...p, hora: e.target.value }))}
            />
            <input
              type="text"
              className="col-span-2 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Nota (opcional)"
              value={tempInsumo.nota}
              onChange={(e) => setTempInsumo((p) => ({ ...p, nota: e.target.value }))}
            />
            <button
              type="button"
              onClick={addInsumo}
              className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-indigo-700"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>

          {insumos.length > 0 && (
            <div className="space-y-2">
              {insumos.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800">{item.nombre}</span>
                    {item.cantidad && <span className="text-slate-500 ml-2">{item.cantidad} {item.unidad}</span>}
                    {item.codigoArticulo && <span className="ml-2 text-xs text-slate-400">#{item.codigoArticulo}</span>}
                    <span className="ml-2 text-xs text-indigo-600 font-semibold">{item.via}</span>
                    {item.hora && <span className="ml-2 text-xs text-slate-500">{item.hora}</span>}
                    {item.nota && <span className="ml-2 text-xs text-slate-400 italic">— {item.nota}</span>}
                  </div>
                  <button type="button" onClick={() => removeInsumo(item.id)} className="text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {insumos.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">Sin insumos agregados aún.</p>
          )}
        </section>

        {/* PROCEDIMIENTOS */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Stethoscope size={14} /> Procedimientos realizados
          </h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Ej. Toma de muestra, curación, canalización…"
              value={tempProcedimiento}
              onChange={(e) => setTempProcedimiento(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProcedimiento(); } }}
            />
            <button
              type="button"
              onClick={addProcedimiento}
              className="bg-indigo-600 text-white rounded-lg px-4 text-sm font-bold inline-flex items-center gap-1.5 hover:bg-indigo-700"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {procedimientos.length > 0 ? (
            <ul className="space-y-1.5">
              {procedimientos.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{item.nombre}</span>
                  <button type="button" onClick={() => removeProcedimiento(item.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">Sin procedimientos registrados.</p>
          )}
        </section>

        {/* OBSERVACIONES FINALES */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText size={14} /> Observaciones finales
          </h2>
          <textarea
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400"
            placeholder="Indicaciones al paciente, seguimiento, recomendaciones…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </section>

        {/* ERROR */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* BOTÓN GUARDAR */}
        <button
          type="button"
          disabled={saving}
          onClick={handleGuardar}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-sm rounded-xl py-3 inline-flex items-center justify-center gap-2 shadow-md"
        >
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar orden de servicio'}
        </button>
      </div>
    </div>
  );
};

export default OrdenServicioEnfermeria;
