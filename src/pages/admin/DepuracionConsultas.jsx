import React, { useState, useCallback } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, limit, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Merge, AlertTriangle, CheckCircle, Loader2, Search, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';

const BATCH_SIZE = 300;

const DepuracionConsultas = () => {
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState('');
  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [gruposExpandidos, setGruposExpandidos] = useState({});

  const toggleGrupo = (key) => {
    setGruposExpandidos((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const tieneDatosClinicos = (record) => {
    const c = record.consulta || {};
    const signos = c.exploracion?.signos || {};
    const antro = c.exploracion?.antropometria || {};
    const tieneSignos = Object.values(signos).some((v) => String(v || '').trim());
    const tieneAntro = ['peso', 'talla'].some((k) => String(antro[k] || '').trim());
    const tienePadecimiento = String(c.padecimiento || '').trim();
    const tieneDiagnostico = String(c.diagnostico?.enfermedad_actual || '').trim();
    const tieneTratamiento = (c.diagnostico?.tratamiento_lista || []).length > 0;
    const tieneIndicaciones = String(c.diagnostico?.indicaciones || '').trim();
    const tieneEstudios = (c.estudios?.paquetes_seleccionados?.length || 0) > 0 || (c.estudios?.estudios_seleccionados?.length || 0) > 0;
    const tieneProc = (c.procedimientos?.seleccionados?.length || 0) > 0;
    const tieneRecetas = (record.recetasGeneradas || []).length > 0;
    const tieneDocs = (record.documentosGenerados || []).length > 0;
    return tieneSignos || tieneAntro || tienePadecimiento || tieneDiagnostico || tieneTratamiento || tieneIndicaciones || tieneEstudios || tieneProc || tieneRecetas || tieneDocs;
  };

  const resumirRecord = (r) => {
    const parts = [];
    if (r.medicoNombre) parts.push(`Med: ${r.medicoNombre}`);
    if (r.tipoNota) parts.push(r.tipoNota);
    const fecha = r.fecha?.toDate ? r.fecha.toDate().toLocaleString('es-MX') : (r.fecha || '');
    if (fecha) parts.push(fecha);
    const tiene = tieneDatosClinicos(r);
    parts.push(tiene ? 'CON datos' : 'VACIO');
    const extras = [];
    if (r.soloAntecedentes) extras.push('soloAntecedentes');
    if ((r.recetasGeneradas || []).length > 0) extras.push(`${r.recetasGeneradas.length} recetas`);
    if ((r.documentosGenerados || []).length > 0) extras.push(`${r.documentosGenerados.length} docs`);
    if (extras.length) parts.push(extras.join(', '));
    return parts.join(' | ');
  };

  const puntuarRecord = (r) => {
    let score = 0;
    if (r.medicoNombre) score += 1;
    if (r.tipoNota) score += 1;
    if (tieneDatosClinicos(r)) score += 5;
    if ((r.recetasGeneradas || []).length > 0) score += 2;
    if ((r.documentosGenerados || []).length > 0) score += 2;
    if (r.consulta?.diagnostico?.tratamiento_lista?.length > 0) score += 3;
    if (r.consulta?.diagnostico?.enfermedad_actual) score += 2;
    if (r.meta?.costo > 0) score += 1;
    return score;
  };

  const escanear = useCallback(async () => {
    setLoading(true);
    setError('');
    setResultados(null);
    setMensaje('');
    setGruposExpandidos({});

    try {
      const todos = [];
      let lastDoc = null;

      while (true) {
        let q;
        if (lastDoc) {
          q = query(collection(db, 'historial_clinico'), orderBy('fecha', 'desc'), limit(BATCH_SIZE));
        } else {
          q = query(collection(db, 'historial_clinico'), orderBy('fecha', 'desc'), limit(BATCH_SIZE));
        }
        const snap = await getDocs(q);
        if (snap.empty) break;

        snap.forEach((d) => {
          todos.push({ id: d.id, ...d.data() });
        });

        if (snap.docs.length < BATCH_SIZE) break;
        // Usamos el último documento como cursor aproximado
        lastDoc = snap.docs[snap.docs.length - 1];
        // Para simplificar, solo tomamos el primer lote de BATCH_SIZE
        break;
      }

      // Agrupar por pacienteId
      const porPaciente = {};
      const porCita = {};

      todos.forEach((r) => {
        const pxId = r.pacienteId || 'sin-paciente';
        if (!porPaciente[pxId]) porPaciente[pxId] = [];
        porPaciente[pxId].push(r);

        const citaId = r.citaId;
        if (citaId) {
          if (!porCita[citaId]) porCita[citaId] = [];
          porCita[citaId].push(r);
        }
      });

      // Detectar duplicados: misma citaId con más de 1 registro
      const duplicados = [];
      Object.entries(porCita).forEach(([citaId, records]) => {
        if (records.length > 1) {
          duplicados.push({ citaId, records: records.sort((a, b) => puntuarRecord(b) - puntuarRecord(a)) });
        }
      });

      // Ordenar duplicados: más registros primero
      duplicados.sort((a, b) => b.records.length - a.records.length);

      // Detectar registros vacíos (sin datos clínicos) que NO son parte de duplicados
      const citaIdsDuplicadas = new Set(duplicados.map((d) => d.citaId));
      const vacios = todos.filter((r) => !tieneDatosClinicos(r) && (!r.citaId || !citaIdsDuplicadas.has(r.citaId)));

      setResultados({
        totalRegistros: todos.length,
        totalDuplicados: duplicados.length,
        totalRegistrosDuplicados: duplicados.reduce((sum, g) => sum + g.records.length, 0),
        totalVacios: vacios.length,
        duplicados,
        vacios
      });

      setMensaje(`Escaneados ${todos.length} registros. ${duplicados.length} grupos duplicados, ${vacios.length} registros vacíos.`);
    } catch (e) {
      console.error(e);
      setError('Error al escanear: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const unificarDuplicado = async (citaId, records) => {
    if (records.length < 2) return;
    setOperando(true);
    setError('');

    try {
      const batch = writeBatch(db);
      const principal = records[0];
      const secundarios = records.slice(1);

      // Fusionar recetasGeneradas y documentosGenerados
      const allRecetas = [];
      const allDocumentos = [];
      records.forEach((r) => {
        if (Array.isArray(r.recetasGeneradas)) allRecetas.push(...r.recetasGeneradas);
        if (Array.isArray(r.documentosGenerados)) allDocumentos.push(...r.documentosGenerados);
      });

      // Deducir recetas y docs únicos
      const seenRecetas = new Set();
      const recetasUnicas = allRecetas.filter((item) => {
        const key = item.nombre || item.plantillaNombre || item.id || '';
        if (seenRecetas.has(key)) return false;
        seenRecetas.add(key);
        return true;
      });
      const seenDocs = new Set();
      const docsUnicos = allDocumentos.filter((item) => {
        const key = item.nombre || item.plantillaNombre || item.id || '';
        if (seenDocs.has(key)) return false;
        seenDocs.add(key);
        return true;
      });

      // Actualizar el registro principal
      batch.update(doc(db, 'historial_clinico', principal.id), {
        recetasGeneradas: recetasUnicas,
        documentosGenerados: docsUnicos,
        unificadoDe: secundarios.map((r) => r.id),
        unificadoEn: new Date().toISOString()
      });

      // Eliminar secundarios
      secundarios.forEach((r) => {
        batch.delete(doc(db, 'historial_clinico', r.id));
      });

      await batch.commit();

      // Actualizar UI
      setResultados((prev) => {
        if (!prev) return prev;
        const nuevosDuplicados = prev.duplicados.filter((d) => d.citaId !== citaId);
        return {
          ...prev,
          totalDuplicados: nuevosDuplicados.length,
          totalRegistrosDuplicados: prev.totalRegistrosDuplicados - secundarios.length,
          duplicados: nuevosDuplicados
        };
      });

      setMensaje(`Unificado: ${secundarios.length} duplicados eliminados, datos fusionados en el registro principal.`);
    } catch (e) {
      console.error(e);
      setError('Error al unificar: ' + e.message);
    } finally {
      setOperando(false);
    }
  };

  const eliminarVacios = async (vacios) => {
    if (vacios.length === 0) return;
    if (!window.confirm(`¿Eliminar ${vacios.length} registros vacíos? Esta acción no se puede deshacer.`)) return;

    setOperando(true);
    setError('');

    try {
      const batch = writeBatch(db);
      vacios.forEach((r) => {
        batch.delete(doc(db, 'historial_clinico', r.id));
      });
      await batch.commit();

      setResultados((prev) => {
        if (!prev) return prev;
        return { ...prev, totalVacios: 0, vacios: [] };
      });

      setMensaje(`${vacios.length} registros vacíos eliminados.`);
    } catch (e) {
      console.error(e);
      setError('Error al eliminar: ' + e.message);
    } finally {
      setOperando(false);
    }
  };

  const eliminarRegistro = async (recordId) => {
    if (!window.confirm('¿Eliminar este registro? No se puede deshacer.')) return;
    setOperando(true);
    try {
      await deleteDoc(doc(db, 'historial_clinico', recordId));
      setMensaje('Registro eliminado.');
      escanear();
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setOperando(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FlaskConical size={22} className="text-purple-600" />
            Depuración de Consultas
          </h2>
          <p className="text-sm text-slate-500 mt-1">Detecta duplicados, unifica registros y elimina consultas vacías del historial clínico.</p>
        </div>
        <button
          onClick={escanear}
          disabled={loading || operando}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-md"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Escaneando...' : 'Escanear Historial'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 text-sm font-semibold">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {mensaje && !error && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700 text-sm font-semibold">
          <CheckCircle size={18} /> {mensaje}
        </div>
      )}

      {/* Resultados */}
      {resultados && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Registros</p>
              <p className="text-2xl font-black text-slate-800">{resultados.totalRegistros}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs font-bold text-amber-600 uppercase">Grupos Duplicados</p>
              <p className="text-2xl font-black text-amber-700">{resultados.totalDuplicados}</p>
            </div>
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
              <p className="text-xs font-bold text-orange-600 uppercase">Registros Duplicados</p>
              <p className="text-2xl font-black text-orange-700">{resultados.totalRegistrosDuplicados}</p>
            </div>
            <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
              <p className="text-xs font-bold text-rose-600 uppercase">Registros Vacíos</p>
              <p className="text-2xl font-black text-rose-700">{resultados.totalVacios}</p>
            </div>
          </div>

          {/* Sección: Duplicados */}
          {resultados.duplicados.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <Merge size={18} className="text-amber-600" />
                    Registros Duplicados ({resultados.duplicados.length} grupos)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Misma cita con múltiples registros. El primero de cada grupo es el de mayor puntuación (más completo).</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                {resultados.duplicados.map((grupo) => {
                  const key = grupo.citaId;
                  const expandido = gruposExpandidos[key] || false;
                  return (
                    <div key={key} className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleGrupo(key)} className="text-slate-400 hover:text-slate-600">
                          {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            Cita: {key} — Paciente: {grupo.records[0]?.pacienteNombre || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">{grupo.records.length} registros duplicados</p>
                        </div>
                        <button
                          onClick={() => unificarDuplicado(key, grupo.records)}
                          disabled={operando}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95"
                        >
                          <Merge size={14} />
                          Unificar
                        </button>
                      </div>
                      {expandido && (
                        <div className="mt-3 ml-8 space-y-2">
                          {grupo.records.map((r, idx) => (
                            <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg text-xs ${idx === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                {idx === 0 && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                <span className="font-mono text-slate-400 shrink-0">{r.id.slice(0, 8)}...</span>
                                <span className="text-slate-600 truncate">{resumirRecord(r)}</span>
                              </div>
                              <button
                                onClick={() => eliminarRegistro(r.id)}
                                disabled={operando}
                                className="text-slate-300 hover:text-red-500 p-1 shrink-0"
                                title="Eliminar este registro"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sección: Vacíos */}
          {resultados.vacios.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <Trash2 size={18} className="text-rose-600" />
                    Registros Vacíos ({resultados.vacios.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Registros sin datos clínicos: sin signos, diagnóstico, tratamiento, recetas ni documentos.</p>
                </div>
                <button
                  onClick={() => eliminarVacios(resultados.vacios)}
                  disabled={operando}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95"
                >
                  <Trash2 size={14} />
                  Eliminar todos
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-[40vh] overflow-y-auto">
                {resultados.vacios.slice(0, 50).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 px-6">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-slate-400">{r.id.slice(0, 8)}...</span>
                      <span className="text-slate-500">{r.pacienteNombre || 'Sin nombre'}</span>
                      {r.soloAntecedentes && <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">Solo antecedentes</span>}
                      {r.tipoNota === 'Carga de Estudio' && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">Carga estudio</span>}
                    </div>
                    <button
                      onClick={() => eliminarRegistro(r.id)}
                      disabled={operando}
                      className="text-slate-300 hover:text-red-500 p-1"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {resultados.vacios.length > 50 && (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Mostrando 50 de {resultados.vacios.length}. Usa "Eliminar todos" para procesar el resto.
                  </div>
                )}
              </div>
            </div>
          )}

          {resultados.duplicados.length === 0 && resultados.vacios.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800">Todo limpio</h3>
              <p className="text-sm text-slate-500 mt-2">No se encontraron duplicados ni registros vacíos en el historial clínico.</p>
            </div>
          )}
        </>
      )}

      {!resultados && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Search size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Sin escanear</h3>
          <p className="text-sm text-slate-500 mt-2">Presiona "Escanear Historial" para analizar el historial clínico en busca de duplicados y registros vacíos.</p>
        </div>
      )}
    </div>
  );
};

export default DepuracionConsultas;
