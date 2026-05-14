import React, { useState } from 'react';
import { User, Search, Plus, Phone, MapPin, Edit, Trash2, ArrowLeft } from 'lucide-react';
import AvatarPaciente from '../../components/AvatarPaciente';
import { db } from "../../config/firebase";
import { deleteDoc, doc } from 'firebase/firestore';
import { searchPatients } from '../../services/patientSearchService';
import { useNavigate } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import { getPatientDisplayName } from '../../utils/patientName';
import ModalPaciente from "../../components/ModalPaciente";

const Pacientes = () => {
  const navigate = useNavigate();

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);

  const sortPacientes = (rows = []) => [...rows].sort((a, b) => {
    const na = getPatientDisplayName(a);
    const nb = getPatientDisplayName(b);
    return na.localeCompare(nb, 'es', { sensitivity: 'base' });
  });

  const fetchPacientes = async (term) => {
    setLoading(true);
    try {
      const docs = await searchPatients(term, 50);
      setPacientes(sortPacientes(docs));
    } catch (error) { console.error("Error cargando pacientes:", error); }
    setLoading(false);
  };

  const handleBuscarPacientes = async () => {
    const term = busqueda.trim();
    setSearchAttempted(true);
    if (term.length < 2) return;
    await fetchPacientes(term);
  };

  const handleBusquedaKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleBuscarPacientes();
    }
  };

  const handleGuardado = (pacienteGuardado) => {
    if (pacienteGuardado?.id) {
      setPacientes((prev) => {
        const exists = prev.some((row) => row.id === pacienteGuardado.id);
        const merged = exists
          ? prev.map((row) => (row.id === pacienteGuardado.id ? { ...row, ...pacienteGuardado } : row))
          : [...prev, pacienteGuardado];
        return sortPacientes(merged);
      });
    }
    setShowModal(false);
    setPacienteAEditar(null);
  };

  const handleEditar = (paciente) => {
    setPacienteAEditar(paciente);
    setShowModal(true);
  };

  const handleEliminar = async (id, nombre) => {
    if(window.confirm(`¿Seguro que deseas eliminar el expediente de ${nombre}? Esta acción no se puede deshacer.`)) {
        try {
            await deleteDoc(doc(db, "pacientes", id));
            setPacientes((prev) => prev.filter((row) => row.id !== id));
        } catch (error) { alert(error.message); }
    }
  };

  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return '-';
    const fecha = new Date(fechaNacimiento);
    if (Number.isNaN(fecha.getTime())) return '-';
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mesDiff = hoy.getMonth() - fecha.getMonth();
    if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
    return edad >= 0 ? edad : '-';
  };

  const pacientesVisibles = searchAttempted && busqueda.trim().length >= 2 ? pacientes : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => goBackOr(navigate, '/agenda')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Volver">
                <ArrowLeft size={20} className="text-slate-500" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <User size={18} />
              </div>
              <h1 className="text-xl font-black text-slate-800" style={{ fontFamily: 'Sora, sans-serif' }}>Directorio de Pacientes</h1>
            </div>

            <button
              onClick={() => { setPacienteAEditar(null); setShowModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo paciente
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o ID..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                value={busqueda}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setBusqueda(nextValue);
                  if (!nextValue.trim()) setSearchAttempted(false);
                }}
                onKeyDown={handleBusquedaKeyDown}
              />
            </div>

            <button
              onClick={handleBuscarPacientes}
              className="border border-blue-200 bg-blue-50 text-blue-700 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              Buscar
            </button>
          </div>

          {pacientesVisibles.length > 0 && (
            <p className="text-xs text-slate-400 mt-3">{pacientesVisibles.length} paciente{pacientesVisibles.length !== 1 ? 's' : ''} encontrado{pacientesVisibles.length !== 1 ? 's' : ''}</p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="text-left font-bold px-4 py-3">Paciente</th>
                  <th className="text-left font-bold px-4 py-3">Edad / Sexo</th>
                  <th className="text-left font-bold px-4 py-3">Teléfono</th>
                  <th className="text-left font-bold px-4 py-3">Ubicación</th>
                  <th className="text-right font-bold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">Cargando pacientes...</td>
                  </tr>
                )}

                {!loading && (!searchAttempted || busqueda.trim().length < 2) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">Escribe al menos 2 caracteres y presiona Buscar para consultar pacientes.</td>
                  </tr>
                )}

                {!loading && searchAttempted && busqueda.trim().length >= 2 && pacientesVisibles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">No se encontraron pacientes.</td>
                  </tr>
                )}

                {!loading && pacientesVisibles.map((paciente) => {
                  const nombreCompleto = getPatientDisplayName(paciente);
                  return (
                    <tr key={paciente.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AvatarPaciente sexo={paciente.sexo} fechaNacimiento={paciente.fechaNacimiento} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-800">{nombreCompleto || 'Sin nombre'}</div>
                            <div className="text-xs text-slate-500">Registro: {paciente.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {calcularEdad(paciente.fechaNacimiento)} años / {paciente.sexo || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400" />
                          {paciente.telefonoMovil || paciente.telefono || 'Sin registro'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" />
                          {paciente.municipioEstado || 'Sin ubicación'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditar(paciente)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 bg-white"
                          >
                            <Edit size={13} /> Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(paciente.id, nombreCompleto || paciente.nombre || 'Paciente')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 bg-white"
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <ModalPaciente 
            onClose={() => setShowModal(false)}
            onPacienteCreado={handleGuardado}
            pacienteAEditar={pacienteAEditar}
        />
      )}
    </div>
  );
};

export default Pacientes;