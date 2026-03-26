// src/components/ModalPaciente.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, User, MapPin, Activity, Layers, Calendar, Phone, Mail, FileText, Briefcase, Shield } from 'lucide-react';
import AvatarPaciente from './AvatarPaciente';
import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { buildPatientHumanId } from '../utils/patientId';

const ModalPaciente = ({ onClose, onPacienteCreado, pacienteAEditar }) => {
  const [activeTab, setActiveTab] = useState('ficha'); // 'ficha' | 'interes'
  const [loading, setLoading] = useState(false);

  // Estado inicial
  const initialState = {
    // --- FICHA DEL PACIENTE ---
    nombre: '', apellidoPaterno: '', apellidoMaterno: '', 
    fechaNacimiento: '', sexo: '', grupoSanguineo: '',
    telefonoMovil: '', telefonoFijo: '', email: '',
    pais: 'México', calleNumero: '', cp: '', colonia: '', municipioEstado: '',
    notasPersonales: '',
    // Padecimientos
    padecimientoHipertension: false, padecimientoDiabetes: false,
    padecimientoObesidad: false, padecimientoArtritis: false,
    
    // --- INFORMACIÓN DE INTERÉS ---
    escolaridad: '', lengua: '', curp: '', 
    derechohabiente: 'Ninguno', programaProspera: 'No', cruzadaHambre: 'No',
    esIndigena: 'No', esAfromexicano: 'No',
    empresa: '', aseguradora: ''
  };

  const [formData, setFormData] = useState(initialState);

  // Si recibimos un paciente para editar, llenamos el formulario
  useEffect(() => {
    if (pacienteAEditar) {
      setFormData(prev => ({ ...prev, ...pacienteAEditar }));
    }
  }, [pacienteAEditar]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.apellidoPaterno) return alert("Nombre y Apellido son obligatorios");
    
    setLoading(true);
    try {
      const nombreCompleto = `${formData.nombre} ${formData.apellidoPaterno} ${formData.apellidoMaterno || ''}`.trim();
            const fechaReferencia = formData.fechaNacimiento || pacienteAEditar?.fechaNacimiento || null;
            const idPaciente = buildPatientHumanId(nombreCompleto, fechaReferencia);
      const datosFinales = { 
        ...formData, 
        nombreCompleto,
                idPaciente,
        fechaActualizacion: new Date().toISOString()
      };

      let docId;
      
      if (pacienteAEditar) {
        // MODO EDICIÓN
        const docRef = doc(db, "pacientes", pacienteAEditar.id);
        await updateDoc(docRef, datosFinales);
        docId = pacienteAEditar.id;
      } else {
        // MODO CREACIÓN
                datosFinales.fechaRegistro = new Date().toISOString();
        const docRef = await addDoc(collection(db, "pacientes"), datosFinales);
        docId = docRef.id;
      }

      // Notificamos al padre (Agenda o Pacientes)
      if (onPacienteCreado) {
        onPacienteCreado({ id: docId, ...datosFinales });
      } else {
        onClose();
      }

    } catch (error) {
      console.error(error);
      alert("Error al guardar: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       {/* Backdrop */}
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
       
       {/* Modal Card */}
       <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        {pacienteAEditar ? 'Editar Expediente' : 'Nuevo Paciente'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        {pacienteAEditar ? `ID: ${pacienteAEditar.id.slice(0,8)}...` : 'Ingresar datos del paciente'}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                    <X size={24}/>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-8 border-b border-slate-100 bg-white">
                <button 
                    onClick={() => setActiveTab('ficha')}
                    className={`mr-8 py-4 text-sm font-bold border-b-[3px] transition-all flex items-center gap-2 ${activeTab === 'ficha' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <User size={18} /> Ficha del paciente
                </button>
                <button 
                    onClick={() => setActiveTab('interes')}
                    className={`py-4 text-sm font-bold border-b-[3px] transition-all flex items-center gap-2 ${activeTab === 'interes' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <Layers size={18} /> Información de interés
                </button>
            </div>

            {/* Formulario Scrollable */}
            <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                {activeTab === 'ficha' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* COLUMNA IZQUIERDA: Datos Personales */}
                        <div className="lg:col-span-5 space-y-5">
                            <h3 className="section-title">Datos Generales</h3>
                            
                            <div className="flex gap-4 items-start mb-4">
                                <AvatarPaciente
                                    sexo={formData.sexo}
                                    fechaNacimiento={formData.fechaNacimiento}
                                    size="xl"
                                    showLabel
                                />
                                <div className="w-full space-y-3">
                                    <div><label className="label-style">Nombre(s) *</label><input required type="text" className="input-style" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                                    <div><label className="label-style">Apellido Paterno *</label><input required type="text" className="input-style" value={formData.apellidoPaterno} onChange={e => setFormData({...formData, apellidoPaterno: e.target.value})} /></div>
                                </div>
                            </div>
                            
                            <div><label className="label-style">Apellido Materno</label><input type="text" className="input-style" value={formData.apellidoMaterno} onChange={e => setFormData({...formData, apellidoMaterno: e.target.value})} /></div>

                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="label-style">Nacimiento</label><input type="date" className="input-style text-slate-500" value={formData.fechaNacimiento} onChange={e => setFormData({...formData, fechaNacimiento: e.target.value})} /></div>
                                <div>
                                    <label className="label-style">Sexo</label>
                                    <select className="input-style" value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})}>
                                        <option value="">Seleccionar</option><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option>
                                    </select>
                                </div>
                                <div><label className="label-style">Tipo Sangre</label><input type="text" className="input-style" placeholder="Ej. O+" value={formData.grupoSanguineo} onChange={e => setFormData({...formData, grupoSanguineo: e.target.value})} /></div>
                            </div>
                            
                            {/* Checkboxes Enfermedades */}
                            <div className="bg-white border border-slate-200 p-4 rounded-xl mt-2 shadow-sm">
                                <label className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase mb-3">
                                    <Activity size={14}/> Padecimientos Crónicos
                                </label>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                    {['Hipertension', 'Diabetes', 'Obesidad', 'Artritis'].map((enf) => (
                                        <label key={enf} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                                            <input type="checkbox" className="accent-teal-500 w-4 h-4 rounded border-slate-300" checked={formData[`padecimiento${enf}`]} onChange={e => setFormData({...formData, [`padecimiento${enf}`]: e.target.checked})} />
                                            <span className="text-xs font-medium text-slate-600">{enf}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: Contacto y Dirección */}
                        <div className="lg:col-span-7 space-y-5">
                            <h3 className="section-title flex items-center gap-2"><MapPin size={14}/> Contacto y Ubicación</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-style">Teléfono Móvil</label><input type="tel" className="input-style" value={formData.telefonoMovil} onChange={e => setFormData({...formData, telefonoMovil: e.target.value})} /></div>
                                <div><label className="label-style">Teléfono Fijo</label><input type="tel" className="input-style" value={formData.telefonoFijo} onChange={e => setFormData({...formData, telefonoFijo: e.target.value})} /></div>
                                <div className="col-span-2"><label className="label-style">Correo Electrónico</label><input type="email" className="input-style" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                                
                                <div className="col-span-2"><label className="label-style">Calle y Número</label><input type="text" className="input-style" value={formData.calleNumero} onChange={e => setFormData({...formData, calleNumero: e.target.value})} /></div>
                                <div><label className="label-style">Código Postal</label><input type="text" className="input-style" value={formData.cp} onChange={e => setFormData({...formData, cp: e.target.value})} /></div>
                                <div><label className="label-style">Colonia</label><input type="text" className="input-style" value={formData.colonia} onChange={e => setFormData({...formData, colonia: e.target.value})} /></div>
                                <div className="col-span-2"><label className="label-style">Municipio / Estado</label><input type="text" className="input-style" value={formData.municipioEstado} onChange={e => setFormData({...formData, municipioEstado: e.target.value})} /></div>
                            </div>
                            
                            <div className="mt-4">
                                <label className="label-style">Notas Personales</label>
                                <textarea rows="3" className="input-style resize-none" value={formData.notasPersonales} onChange={e => setFormData({...formData, notasPersonales: e.target.value})} placeholder="Información adicional..."></textarea>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'interes' && (
                    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
                        
                        {/* Grupo 1: Socio-demográfico */}
                        <div>
                             <h3 className="section-title mb-4 flex items-center gap-2"><FileText size={14}/> Datos Sociodemográficos</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div><label className="label-style">Escolaridad</label><select className="input-style" value={formData.escolaridad} onChange={e => setFormData({...formData, escolaridad: e.target.value})}><option value="">Seleccione</option><option>Primaria</option><option>Secundaria</option><option>Bachillerato</option><option>Licenciatura</option><option>Posgrado</option></select></div>
                                <div><label className="label-style">Lengua Indígena</label><input type="text" className="input-style" value={formData.lengua} onChange={e => setFormData({...formData, lengua: e.target.value})} /></div>
                                <div className="col-span-2"><label className="label-style">CURP</label><input type="text" className="input-style font-mono uppercase tracking-widest" maxLength="18" value={formData.curp} onChange={e => setFormData({...formData, curp: e.target.value})} /></div>
                             </div>
                        </div>

                        {/* Grupo 2: Seguro y Etnia */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="section-title mb-4 flex items-center gap-2"><Briefcase size={14}/> Afiliación y Trabajo</h3>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div><label className="label-style">Derechohabiencia</label><select className="input-style" value={formData.derechohabiente} onChange={e => setFormData({...formData, derechohabiente: e.target.value})}><option value="Ninguno">Ninguno</option><option value="IMSS">IMSS</option><option value="ISSSTE">ISSSTE</option><option value="PEMEX">PEMEX</option><option value="Privado">Seguro Privado</option></select></div>
                                    <div><label className="label-style">Aseguradora</label><input type="text" className="input-style" value={formData.aseguradora} onChange={e => setFormData({...formData, aseguradora: e.target.value})} /></div>
                                    <div><label className="label-style">Empresa</label><input type="text" className="input-style" value={formData.empresa} onChange={e => setFormData({...formData, empresa: e.target.value})} /></div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="section-title mb-4 flex items-center gap-2"><Shield size={14}/> Programas y Etnicidad</h3>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="label-style">¿Indígena?</label><select className="input-style" value={formData.esIndigena} onChange={e => setFormData({...formData, esIndigena: e.target.value})}><option value="No">No</option><option value="Si">Si</option></select></div>
                                        <div><label className="label-style">¿Afromexicano?</label><select className="input-style" value={formData.esAfromexicano} onChange={e => setFormData({...formData, esAfromexicano: e.target.value})}><option value="No">No</option><option value="Si">Si</option></select></div>
                                    </div>
                                    <div><label className="label-style">Programa PROSPERA</label><select className="input-style" value={formData.programaProspera} onChange={e => setFormData({...formData, programaProspera: e.target.value})}><option value="No">No</option><option value="Si">Si</option></select></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </form>

            {/* Footer */}
            <div className="p-5 bg-white border-t border-slate-100 flex justify-end gap-3 z-10">
                 <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors text-sm">
                    Cancelar
                 </button>
                 <button disabled={loading} onClick={handleGuardar} className="px-8 py-2.5 bg-teal-500 text-white rounded-xl font-bold shadow-lg shadow-teal-500/30 hover:bg-teal-600 transition-all active:scale-95 text-sm flex items-center gap-2">
                    {loading ? 'Guardando...' : <><Save size={18} /> {pacienteAEditar ? 'Actualizar Expediente' : 'Guardar Paciente'}</>}
                 </button>
            </div>
       </div>

      <style>{`
        .section-title { color: #115e59; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #ccfbf1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
        .label-style { display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.3rem; }
        .input-style { width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 0.6rem; background-color: #f8fafc; color: #334155; font-size: 0.85rem; outline: none; transition: all 0.2s; font-weight: 500; }
        .input-style:focus { background-color: #fff; border-color: #14b8a6; box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1); }
      `}</style>
    </div>
  );
};

export default ModalPaciente;