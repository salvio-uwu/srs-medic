// src/shared/Pacientes.jsx
import React, { useState, useEffect } from 'react';
import { User, Search, Plus, Phone, MapPin, Edit, Trash2, FileText, ArrowLeft } from 'lucide-react';
import { db } from "../../config/firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// Reutilizamos el mismo componente visual
import ModalPaciente from "../../components/ModalPaciente";

const Pacientes = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS ---
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Estado para el Modal (Crear o Editar)
  const [showModal, setShowModal] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);

  // --- CARGA DE DATOS ---
  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "pacientes"), orderBy("nombre"));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPacientes(docs);
    } catch (error) { console.error("Error cargando pacientes:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchPacientes(); }, []);

  // --- ACCIONES ---
  const handleGuardado = () => {
    fetchPacientes();
    setShowModal(false);
    setPacienteAEditar(null);
  };

  const handleEditar = (paciente) => {
    setPacienteAEditar(paciente); // Guardamos al paciente seleccionado
    setShowModal(true); // Abrimos el modal con sus datos
  };

  const handleEliminar = async (id, nombre) => {
    if(window.confirm(`¿Seguro que deseas eliminar el expediente de ${nombre}? Esta acción no se puede deshacer.`)) {
        try {
            await deleteDoc(doc(db, "pacientes", id));
            fetchPacientes(); // Recargar lista
        } catch (error) { alert(error.message); }
    }
  };

  const pacientesFiltrados = pacientes.filter(p => 
    (p.nombreCompleto || p.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-teal-100 pb-10">
      
      {/* HEADER TIPO AGENDA (Sticky) */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="flex items-center gap-3 w-full md:w-auto">
               <button onClick={() => navigate('/agenda')} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Volver a Agenda">
                 <ArrowLeft size={20} className="text-slate-500"/>
               </button>
               <div className="bg-teal-600 text-white p-2.5 rounded-xl shadow-lg shadow-teal-600/20">
                 <User size={20} />
               </div>
               <div>
                 <h1 className="text-lg font-bold text-slate-800 leading-tight">Directorio de Pacientes</h1>
                 <p className="text-xs text-slate-500 font-medium">{pacientes.length} Expedientes activos</p>
               </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    <input 
                        type="text" placeholder="Buscar por nombre..." 
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all"
                        value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => { setPacienteAEditar(null); setShowModal(true); }}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2"
                >
                    <Plus size={18} /> <span className="hidden md:inline">Nuevo</span>
                </button>
            </div>
         </div>
      </div>

      {/* GRID DE TARJETAS */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        {loading ? (
             <div className="text-center py-20 text-slate-400">Cargando base de datos...</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pacientesFiltrados.map(paciente => (
                    <div key={paciente.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group relative">
                        {/* Cabecera Tarjeta */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex gap-3 items-center">
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                    {(paciente.nombre || "A").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 leading-tight group-hover:text-teal-600 transition-colors">
                                        {paciente.nombre} {paciente.apellidoPaterno}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        {(new Date().getFullYear()) - (new Date(paciente.fechaNacimiento).getFullYear())} Años • {paciente.sexo}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Datos Rápidos */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                                <Phone size={14} className="text-teal-500" /> 
                                {paciente.telefonoMovil || 'Sin registro'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                                <MapPin size={14} className="text-teal-500" /> 
                                <span className="truncate">{paciente.municipioEstado || 'Sin ubicación'}</span>
                            </div>
                        </div>

                        {/* Botones de Acción (Editar / Borrar) */}
                        <div className="flex gap-2 pt-3 border-t border-slate-100">
                             <button onClick={() => handleEditar(paciente)} className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600 text-xs font-bold transition-colors flex items-center justify-center gap-1">
                                <Edit size={14} /> Editar
                             </button>
                             <button onClick={() => handleEliminar(paciente.id, paciente.nombre)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:border-red-500 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* MODAL (Reutilizado para Crear Y Editar) */}
      {showModal && (
        <ModalPaciente 
            onClose={() => setShowModal(false)}
            onPacienteCreado={handleGuardado} // Se llama igual al terminar
            pacienteAEditar={pacienteAEditar} // <-- ESTA ES LA CLAVE
        />
      )}

    </div>
  );
};

export default Pacientes;