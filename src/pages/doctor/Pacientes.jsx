import React, { useEffect, useMemo, useState } from 'react';
import { User, Search, Plus, Phone, MapPin, Edit, Trash2, ArrowLeft } from 'lucide-react';
import AvatarPaciente from '../../components/AvatarPaciente';
import { db } from "../../config/firebase";
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import { useAuth } from '../../context/AuthContext';
import { buildPatientHumanId } from '../../utils/patientId';

// Reutilizamos el mismo componente visual
import ModalPaciente from "../../components/ModalPaciente";

const Pacientes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [filtroSexo, setFiltroSexo] = useState('todos');
  const [filtroUbicacion, setFiltroUbicacion] = useState('todas');
  const [filtroGrupoSanguineo, setFiltroGrupoSanguineo] = useState('todos');
  const [filtroIdPaciente, setFiltroIdPaciente] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [soloConTelefono, setSoloConTelefono] = useState(false);
  const [soloConCorreo, setSoloConCorreo] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);

  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "pacientes"));
      const docs = snapshot.docs
        .map((docRef) => ({ id: docRef.id, ...docRef.data() }))
        .sort((a, b) => {
          const na = String(a.nombreCompleto || a.nombre || '').trim();
          const nb = String(b.nombreCompleto || b.nombre || '').trim();
          return na.localeCompare(nb, 'es', { sensitivity: 'base' });
        });
      setPacientes(docs);
    } catch (error) { console.error("Error cargando pacientes:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchPacientes(); }, []);

  const isAdmin = useMemo(() => {
    const rol = String(user?.rol || '').toLowerCase();
    return rol === 'admin' || rol === 'admin_maestro' || rol === 'administrador';
  }, [user?.rol]);

  const obtenerFechaRegistro = (paciente) => {
    const base = paciente?.fechaRegistro || paciente?.fechaActualizacion || null;
    if (!base) return null;
    const fecha = new Date(base);
    if (Number.isNaN(fecha.getTime())) return null;
    return fecha;
  };

  const obtenerIdPaciente = (paciente) => {
    if (paciente.idPaciente) return paciente.idPaciente;
    const nombreCompleto = `${paciente.nombre || ''} ${paciente.apellidoPaterno || ''} ${paciente.apellidoMaterno || ''}`.replace(/\s+/g, ' ').trim();
    return buildPatientHumanId(nombreCompleto, paciente.fechaNacimiento);
  };

  const handleGuardado = () => {
    fetchPacientes();
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
            fetchPacientes();
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

  const ubicacionesDisponibles = useMemo(() => {
    const valores = pacientes
      .map((p) => String(p.municipioEstado || '').trim())
      .filter(Boolean);
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [pacientes]);

  const gruposSanguineosDisponibles = useMemo(() => {
    const valores = pacientes
      .map((p) => String(p.grupoSanguineo || '').trim())
      .filter(Boolean);
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [pacientes]);

  const pacientesFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return pacientes.filter((p) => {
      const nombre = `${p.nombre || ''} ${p.apellidoPaterno || ''} ${p.apellidoMaterno || ''}`.trim();
      const telefono = String(p.telefonoMovil || p.telefono || '').toLowerCase();
      const correo = String(p.email || '').toLowerCase();
      const ubicacion = String(p.municipioEstado || '').trim();
      const sexo = String(p.sexo || '').toLowerCase();
      const grupoSanguineo = String(p.grupoSanguineo || '').trim();
      const idPaciente = obtenerIdPaciente(p).toLowerCase();
      const fechaRegistro = obtenerFechaRegistro(p);

      const coincideBusqueda = !term ||
        nombre.toLowerCase().includes(term) ||
        telefono.includes(term) ||
        ubicacion.toLowerCase().includes(term) ||
        idPaciente.includes(term);

      const coincideSexo = filtroSexo === 'todos' || sexo === filtroSexo;
      const coincideUbicacion = filtroUbicacion === 'todas' || ubicacion === filtroUbicacion;
      const coincideGrupo = filtroGrupoSanguineo === 'todos' || grupoSanguineo === filtroGrupoSanguineo;
      const coincideTelefono = !soloConTelefono || Boolean(String(p.telefonoMovil || p.telefono || '').trim());
      const coincideCorreo = !soloConCorreo || Boolean(correo.trim());
      const coincideIdPaciente = !filtroIdPaciente.trim() || idPaciente.includes(filtroIdPaciente.trim().toLowerCase());

      let coincideFecha = true;
      if (isAdmin && (filtroFechaDesde || filtroFechaHasta)) {
        if (!fechaRegistro) {
          coincideFecha = false;
        } else {
          const fechaDoc = new Date(fechaRegistro.getFullYear(), fechaRegistro.getMonth(), fechaRegistro.getDate());
          if (filtroFechaDesde) {
            const desde = new Date(filtroFechaDesde);
            coincideFecha = coincideFecha && fechaDoc >= desde;
          }
          if (filtroFechaHasta) {
            const hasta = new Date(filtroFechaHasta);
            coincideFecha = coincideFecha && fechaDoc <= hasta;
          }
        }
      }

      return coincideBusqueda && coincideSexo && coincideUbicacion && coincideGrupo && coincideTelefono && coincideCorreo && coincideIdPaciente && coincideFecha;
    }).sort((a, b) => {
      const na = `${a.nombre || ''} ${a.apellidoPaterno || ''}`.trim();
      const nb = `${b.nombre || ''} ${b.apellidoPaterno || ''}`.trim();
      return na.localeCompare(nb, 'es');
    });
  }, [pacientes, busqueda, filtroSexo, filtroUbicacion, filtroGrupoSanguineo, soloConTelefono, soloConCorreo, filtroIdPaciente, filtroFechaDesde, filtroFechaHasta, isAdmin]);

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
              <div>
                <h1 className="text-xl font-black text-slate-800" style={{ fontFamily: 'Sora, sans-serif' }}>Directorio de Pacientes</h1>
                <p className="text-xs text-slate-500">Vista homologada para gestión clínica y administrativa</p>
              </div>
            </div>

            <button
              onClick={() => { setPacienteAEditar(null); setShowModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo paciente
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-800">{pacientes.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Filtrados</p>
              <p className="text-xl font-bold text-slate-800">{pacientesFiltrados.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Con teléfono</p>
              <p className="text-xl font-bold text-slate-800">{pacientes.filter((p) => Boolean(String(p.telefonoMovil || p.telefono || '').trim())).length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Ubicaciones</p>
              <p className="text-xl font-bold text-slate-800">{ubicacionesDisponibles.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o ubicación..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={filtroSexo}
              onChange={(e) => setFiltroSexo(e.target.value)}
            >
              <option value="todos">Sexo: Todos</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
            </select>

            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={filtroUbicacion}
              onChange={(e) => setFiltroUbicacion(e.target.value)}
            >
              <option value="todas">Ubicación: Todas</option>
              {ubicacionesDisponibles.map((ubicacion) => (
                <option key={ubicacion} value={ubicacion}>{ubicacion}</option>
              ))}
            </select>

            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={filtroGrupoSanguineo}
              onChange={(e) => setFiltroGrupoSanguineo(e.target.value)}
            >
              <option value="todos">Sangre: Todos</option>
              {gruposSanguineosDisponibles.map((grupo) => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Filtrar por ID paciente (nombre+fecha)..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={filtroIdPaciente}
                onChange={(e) => setFiltroIdPaciente(e.target.value)}
              />

              <input
                type="date"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
              />

              <input
                type="date"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={soloConTelefono}
                onChange={(e) => setSoloConTelefono(e.target.checked)}
              />
              Mostrar solo pacientes con teléfono
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={soloConCorreo}
                onChange={(e) => setSoloConCorreo(e.target.checked)}
              />
              Mostrar solo pacientes con correo
            </label>

            <button
              onClick={() => {
                setBusqueda('');
                setFiltroSexo('todos');
                setFiltroUbicacion('todas');
                setFiltroGrupoSanguineo('todos');
                setFiltroIdPaciente('');
                setFiltroFechaDesde('');
                setFiltroFechaHasta('');
                setSoloConTelefono(false);
                setSoloConCorreo(false);
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="text-left font-bold px-4 py-3">Paciente</th>
                  <th className="text-left font-bold px-4 py-3">ID PX</th>
                  <th className="text-left font-bold px-4 py-3">Edad</th>
                  <th className="text-left font-bold px-4 py-3">Sexo</th>
                  <th className="text-left font-bold px-4 py-3">Teléfono</th>
                  <th className="text-left font-bold px-4 py-3">Ubicación</th>
                  <th className="text-right font-bold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">Cargando pacientes...</td>
                  </tr>
                )}

                {!loading && pacientesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No hay resultados con los filtros actuales.</td>
                  </tr>
                )}

                {!loading && pacientesFiltrados.map((paciente) => {
                  const nombreCompleto = `${paciente.nombre || ''} ${paciente.apellidoPaterno || ''} ${paciente.apellidoMaterno || ''}`.replace(/\s+/g, ' ').trim();
                  const idPaciente = obtenerIdPaciente(paciente);
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
                      <td className="px-4 py-3 text-slate-700 font-mono text-xs">{idPaciente}</td>
                      <td className="px-4 py-3 text-slate-700">{calcularEdad(paciente.fechaNacimiento)}</td>
                      <td className="px-4 py-3 text-slate-700">{paciente.sexo || '-'}</td>
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
                            onClick={() => handleEliminar(paciente.id, paciente.nombre || nombreCompleto)}
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