import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, GitMerge, AlertTriangle, CheckCircle2, User, Calendar, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getPatientDisplayName } from '../utils/patientName';

/**
 * Modal para unificar dos perfiles de paciente duplicados.
 * Mueve historial_clinico, citas, triage_enfermeria y patient_links
 * del perfil duplicado al perfil primario, luego marca el duplicado.
 */
const ModalUnificarExpedientes = ({ pacienteId, pacienteNombre, onClose, showToast }) => {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [duplicadoSeleccionado, setDuplicadoSeleccionado] = useState(null);
  const [paso, setPaso] = useState('buscar'); // buscar | confirmar | procesando | listo
  const [primarioData, setPrimarioData] = useState(null);
  const [resumen, setResumen] = useState(null);

  // Cargar datos del paciente primario
  useEffect(() => {
    if (!pacienteId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'pacientes', pacienteId));
        if (snap.exists()) setPrimarioData({ id: snap.id, ...snap.data() });
      } catch (e) { console.error(e); }
    };
    load();
  }, [pacienteId]);

  // Buscar pacientes candidatos
  const handleBuscar = useCallback(async () => {
    const term = busqueda.trim().toUpperCase();
    if (term.length < 3) return;
    setBuscando(true);
    try {
      // Buscar por nombre completo
      const snaps = await getDocs(collection(db, 'pacientes'));
      const encontrados = [];
      snaps.forEach(d => {
        if (d.id === pacienteId) return; // excluir el propio paciente
        if (d.data().mergedIntoPacienteId) return; // excluir ya fusionados
        const data = d.data();
        const nombre = getPatientDisplayName(data).toUpperCase();
        const curp = (data.curp || '').toUpperCase();
        const tel = (data.telefonoMovil || '');
        const idPx = (data.idPaciente || '').toUpperCase();
        if (nombre.includes(term) || curp.includes(term) || tel.includes(term) || idPx.includes(term)) {
          encontrados.push({ id: d.id, ...data });
        }
      });
      setResultados(encontrados.slice(0, 10));
    } catch (e) {
      console.error('Error buscando pacientes:', e);
    } finally {
      setBuscando(false);
    }
  }, [busqueda, pacienteId]);

  // Ejecutar merge
  const ejecutarMerge = async () => {
    if (!duplicadoSeleccionado || !pacienteId) return;
    setPaso('procesando');

    const dupId = duplicadoSeleccionado.id;
    const dupNombre = getPatientDisplayName(duplicadoSeleccionado);
    const primNombre = pacienteNombre || getPatientDisplayName(primarioData || {});

    try {
      let totalHistorial = 0, totalCitas = 0, totalTriage = 0, totalLinks = 0;

      // 1. Migrar historial_clinico
      const histSnap = await getDocs(query(collection(db, 'historial_clinico'), where('pacienteId', '==', dupId)));
      if (!histSnap.empty) {
        const batch = writeBatch(db);
        histSnap.docs.forEach(d => {
          batch.update(d.ref, { 
            pacienteId: pacienteId, 
            pacienteNombre: primNombre,
            _mergedFrom: dupId,
            _mergedAt: new Date().toISOString()
          });
        });
        await batch.commit();
        totalHistorial = histSnap.size;
      }

      // 2. Migrar citas
      const citasSnap = await getDocs(query(collection(db, 'citas'), where('pacienteId', '==', dupId)));
      if (!citasSnap.empty) {
        const batch = writeBatch(db);
        citasSnap.docs.forEach(d => {
          batch.update(d.ref, { 
            pacienteId: pacienteId, 
            paciente: primNombre,
            _mergedFrom: dupId,
            _mergedAt: new Date().toISOString()
          });
        });
        await batch.commit();
        totalCitas = citasSnap.size;
      }

      // 3. Migrar triage_enfermeria
      const triageSnap = await getDocs(query(collection(db, 'triage_enfermeria'), where('pacienteId', '==', dupId)));
      if (!triageSnap.empty) {
        const batch = writeBatch(db);
        triageSnap.docs.forEach(d => {
          batch.update(d.ref, { 
            pacienteId: pacienteId,
            _mergedFrom: dupId,
            _mergedAt: new Date().toISOString()
          });
        });
        await batch.commit();
        totalTriage = triageSnap.size;
      }

      // 4. Migrar patient_links
      const linksSnap = await getDocs(query(collection(db, 'patient_links'), where('pacienteId', '==', dupId)));
      if (!linksSnap.empty) {
        const batch = writeBatch(db);
        linksSnap.docs.forEach(d => {
          batch.update(d.ref, { 
            pacienteId: pacienteId,
            _mergedFrom: dupId,
            _mergedAt: new Date().toISOString()
          });
        });
        await batch.commit();
        totalLinks = linksSnap.size;
      }

      // 5. Complementar datos vacíos del primario con datos del duplicado
      if (primarioData) {
        const camposComplementar = ['telefonoMovil', 'telefonoFijo', 'email', 'curp', 'grupoSanguineo', 'calleNumero', 'cp', 'colonia', 'municipioEstado', 'escolaridad', 'derechohabiente', 'aseguradora', 'empresa'];
        const updates = {};
        camposComplementar.forEach(campo => {
          if (!primarioData[campo] && duplicadoSeleccionado[campo]) {
            updates[campo] = duplicadoSeleccionado[campo];
          }
        });
        if (Object.keys(updates).length > 0) {
          updates.fechaActualizacion = serverTimestamp();
          await updateDoc(doc(db, 'pacientes', pacienteId), updates);
        }
      }

      // 6. Marcar duplicado como fusionado (no eliminar para auditoría)
      await updateDoc(doc(db, 'pacientes', dupId), {
        mergedIntoPacienteId: pacienteId,
        mergedIntoPacienteNombre: primNombre,
        mergedAt: serverTimestamp(),
        nombreCompleto: `[FUSIONADO] ${dupNombre}`
      });

      setResumen({ totalHistorial, totalCitas, totalTriage, totalLinks, dupNombre, primNombre });
      setPaso('listo');
      if (showToast) showToast('Expedientes unificados correctamente');
    } catch (err) {
      console.error('Error en merge:', err);
      if (showToast) showToast('Error al unificar expedientes', 'error');
      setPaso('confirmar');
    }
  };

  const getNombreCompleto = (px) => getPatientDisplayName(px);
  const formatFecha = (f) => {
    if (!f) return '--';
    if (f.toDate) return f.toDate().toLocaleDateString('es-MX');
    if (typeof f === 'string') return new Date(f).toLocaleDateString('es-MX');
    return '--';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-b from-violet-50 to-white">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"><X size={18}/></button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600"><GitMerge size={22}/></div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Unificar Expedientes</h2>
              <p className="text-xs text-slate-400">Fusionar un perfil duplicado en <span className="font-bold text-slate-600">{pacienteNombre}</span></p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── PASO 1: BUSCAR ── */}
          {paso === 'buscar' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Buscar perfil duplicado</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                      placeholder="Nombre, CURP, teléfono o ID..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50"
                    />
                  </div>
                  <button onClick={handleBuscar} disabled={buscando || busqueda.trim().length < 3}
                    className="px-5 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all disabled:opacity-40 flex items-center gap-2">
                    {buscando ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                    Buscar
                  </button>
                </div>
              </div>

              {/* Resultados */}
              {resultados.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{resultados.length} resultado{resultados.length > 1 ? 's' : ''}</p>
                  {resultados.map(px => (
                    <button
                      key={px.id}
                      onClick={() => { setDuplicadoSeleccionado(px); setPaso('confirmar'); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:border-violet-300 hover:shadow-md hover:shadow-violet-50 ${duplicadoSeleccionado?.id === px.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{getNombreCompleto(px)}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                            {px.fechaNacimiento && <span className="flex items-center gap-1"><Calendar size={10}/> {formatFecha(px.fechaNacimiento)}</span>}
                            {px.telefonoMovil && <span className="flex items-center gap-1"><Phone size={10}/> {px.telefonoMovil}</span>}
                            {px.curp && <span className="font-mono text-[10px]">{px.curp}</span>}
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-slate-300 shrink-0 ml-2"/>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {resultados.length === 0 && busqueda.length >= 3 && !buscando && (
                <div className="text-center py-8 text-slate-400">
                  <User size={32} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-sm">No se encontraron pacientes</p>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: CONFIRMAR ── */}
          {paso === 'confirmar' && duplicadoSeleccionado && (
            <div className="p-6 space-y-5">
              {/* Comparación visual */}
              <div className="grid grid-cols-2 gap-3">
                {/* Primario */}
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-4">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1"><CheckCircle2 size={10}/> Se mantiene</p>
                  <p className="text-sm font-bold text-slate-800">{pacienteNombre}</p>
                  {primarioData && (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                      {primarioData.fechaNacimiento && <p className="flex items-center gap-1"><Calendar size={10}/> {formatFecha(primarioData.fechaNacimiento)}</p>}
                      {primarioData.telefonoMovil && <p className="flex items-center gap-1"><Phone size={10}/> {primarioData.telefonoMovil}</p>}
                      {primarioData.curp && <p className="font-mono text-[10px]">{primarioData.curp}</p>}
                    </div>
                  )}
                </div>
                {/* Duplicado */}
                <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1"><X size={10}/> Se fusiona</p>
                  <p className="text-sm font-bold text-slate-800">{getNombreCompleto(duplicadoSeleccionado)}</p>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                    {duplicadoSeleccionado.fechaNacimiento && <p className="flex items-center gap-1"><Calendar size={10}/> {formatFecha(duplicadoSeleccionado.fechaNacimiento)}</p>}
                    {duplicadoSeleccionado.telefonoMovil && <p className="flex items-center gap-1"><Phone size={10}/> {duplicadoSeleccionado.telefonoMovil}</p>}
                    {duplicadoSeleccionado.curp && <p className="font-mono text-[10px]">{duplicadoSeleccionado.curp}</p>}
                  </div>
                </div>
              </div>

              {/* Advertencia */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-bold text-amber-800">¿Estás seguro?</p>
                  <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                    Se moverán <strong>todas las citas, historial clínico, triage y vínculos</strong> del perfil duplicado al perfil principal. 
                    El duplicado quedará marcado como fusionado. Esta acción no se puede deshacer fácilmente.
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button onClick={() => { setDuplicadoSeleccionado(null); setPaso('buscar'); }}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                  Volver
                </button>
                <button onClick={ejecutarMerge}
                  className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                  <GitMerge size={16}/> Unificar
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 3: PROCESANDO ── */}
          {paso === 'procesando' && (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
                <Loader2 size={28} className="text-violet-600 animate-spin"/>
              </div>
              <p className="text-base font-bold text-slate-800">Unificando expedientes...</p>
              <p className="text-sm text-slate-400 mt-1">Migrando registros clínicos, citas y triage</p>
            </div>
          )}

          {/* ── PASO 4: LISTO ── */}
          {paso === 'listo' && resumen && (
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-emerald-500"/>
                </div>
                <p className="text-lg font-black text-slate-800">¡Expedientes Unificados!</p>
                <p className="text-sm text-slate-400 mt-1">
                  <span className="font-bold text-slate-600">{resumen.dupNombre}</span> fue fusionado en <span className="font-bold text-slate-600">{resumen.primNombre}</span>
                </p>
              </div>

              {/* Resumen */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Registros migrados</p>
                {[
                  { label: 'Historial Clínico', count: resumen.totalHistorial },
                  { label: 'Citas', count: resumen.totalCitas },
                  { label: 'Triage Enfermería', count: resumen.totalTriage },
                  { label: 'Vínculos Legacy', count: resumen.totalLinks },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className={`text-sm font-bold ${item.count > 0 ? 'text-violet-600' : 'text-slate-300'}`}>{item.count}</span>
                  </div>
                ))}
              </div>

              <button onClick={onClose}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalUnificarExpedientes;
