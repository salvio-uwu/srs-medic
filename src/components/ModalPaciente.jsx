// src/components/ModalPaciente.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, MapPin, Activity, Layers, Calendar, Phone, Mail, FileText, Briefcase, Shield, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AvatarPaciente from './AvatarPaciente';
import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, limit, query, where } from 'firebase/firestore';
import { buildPatientHumanId } from '../utils/patientId';
import { getPatientDisplayName, sanitizePatientNameFields } from '../utils/patientName';
import { normalizeForSearch } from '../utils/searchUtils';

const normalizeText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeUpper = (value = '') => normalizeText(value).toUpperCase();
const normalizeTitleCase = (value = '') =>
    normalizeText(value).replace(/(^|\s)(\S)/g, (_, space, char) => `${space}${char.toLocaleUpperCase('es-MX')}`);
const normalizeDigits = (value = '') => String(value || '').replace(/\D/g, '');
const normalizeDateIso = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return '';
    const y = String(parsed.getFullYear());
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const buildPatientName = (row = {}) => {
    return normalizeText(getPatientDisplayName(row));
};

const summarizeMatchNames = (rows = []) => rows
    .slice(0, 2)
    .map((row) => buildPatientName(row))
    .filter(Boolean)
    .join(', ');

const buildDuplicateFingerprint = (...groups) => groups
    .flat()
    .map((row) => String(row?.id || '').trim())
    .filter(Boolean)
    .sort()
    .join('|');

const ModalPaciente = ({ onClose, onPacienteCreado, pacienteAEditar }) => {
  const [activeTab, setActiveTab] = useState('ficha'); // 'ficha' | 'interes'
  const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'error' });
    const [duplicateBypass, setDuplicateBypass] = useState({ fingerprint: '', expiresAt: 0 });
    const toastTimerRef = useRef(null);
    // Keep a stable ref to the latest onPacienteCreado so the async handleGuardar
    // always calls the most recent version even if the parent re-renders mid-save.
    const onPacienteCreadoRef = useRef(onPacienteCreado);
    useEffect(() => { onPacienteCreadoRef.current = onPacienteCreado; }, [onPacienteCreado]);

  // Estado inicial
  const initialState = {
    // --- FICHA DEL PACIENTE ---
    nombre: '', apellidoPaterno: '', apellidoMaterno: '', 
    fechaNacimiento: '', lugarNacimiento: '', sexo: '', grupoSanguineo: '',
    estadoCivil: '', ocupacion: '', religion: '',
    telefonoMovil: '', telefonoFijo: '', email: '',
    personaResponsable: '',
    pais: 'México',
    // Dirección — nuevos campos separados (NOM-004)
    calle: '', numeroExterior: '', numeroInterior: '',
    colonia: '', cp: '', municipio: '', estado: '',
    // Campos legacy para compatibilidad
    calleNumero: '', municipioEstado: '',
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
            const normalizedNames = sanitizePatientNameFields(pacienteAEditar);
            // Retrocompatibilidad: si no hay campos nuevos, derivar de los legacy
            const calle = pacienteAEditar.calle || (pacienteAEditar.calleNumero || '').replace(/\s+\d+.*$/, '');
            const numExt = pacienteAEditar.numeroExterior || ((pacienteAEditar.calleNumero || '').match(/\d+[\w-]*/) || [''])[0];
            const municipio = pacienteAEditar.municipio || (pacienteAEditar.municipioEstado || '').replace(/,.*$/, '').trim();
            const estadoFromLegacy = pacienteAEditar.estado || ((pacienteAEditar.municipioEstado || '').match(/,\s*(.+)/) || ['', ''])[1];
      setFormData(prev => ({
        ...prev, 
        ...pacienteAEditar,
                nombre: normalizedNames.nombre,
                apellidoPaterno: normalizedNames.apellidoPaterno,
                apellidoMaterno: normalizedNames.apellidoMaterno,
                nombreCompleto: normalizedNames.nombreCompleto,
        notasPersonales: pacienteAEditar.notasPersonales || pacienteAEditar.resumenClinico?.notas_previas || '',
        // Poblar campos nuevos desde legacy si no existen
        calle: calle.trim(),
        numeroExterior: numExt.trim(),
        numeroInterior: pacienteAEditar.numeroInterior || '',
        municipio,
        estado: estadoFromLegacy || '',
        ocupacion: pacienteAEditar.ocupacion || '',
        estadoCivil: pacienteAEditar.estadoCivil || '',
        lugarNacimiento: pacienteAEditar.lugarNacimiento || '',
        religion: pacienteAEditar.religion || '',
        personaResponsable: pacienteAEditar.personaResponsable || ''
      }));
    }
  }, [pacienteAEditar]);

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        setDuplicateBypass({ fingerprint: '', expiresAt: 0 });
    }, [formData.nombre, formData.apellidoPaterno, formData.apellidoMaterno, formData.fechaNacimiento, formData.telefonoMovil, formData.curp]);

    const showToast = (msg, type = 'error', duration = 5000) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }

        setToast({ show: true, msg, type });

        toastTimerRef.current = setTimeout(() => {
            setToast({ show: false, msg: '', type: 'error' });
            toastTimerRef.current = null;
        }, duration);
    };

    const buscarPosiblesDuplicados = async ({ nombreCompleto, fechaNacimiento, curp, idPaciente, telefonoMovil, excludeDocId = '' }) => {
        const pacientesRef = collection(db, 'pacientes');
        const rowsById = new Map();

        const pushSnapRows = (snap) => {
            snap.docs.forEach((docSnap) => {
                if (docSnap.id === excludeDocId) return;
                rowsById.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
            });
        };

        const normalizedCurp = normalizeUpper(curp);
        const normalizedNombre = normalizeUpper(nombreCompleto);
        const normalizedFecha = normalizeDateIso(fechaNacimiento);
        const normalizedIdPaciente = normalizeUpper(idPaciente);
        const normalizedTelefono = normalizeDigits(telefonoMovil);

        if (normalizedCurp) {
            const curpSnap = await getDocs(query(pacientesRef, where('curp', '==', normalizedCurp), limit(8)));
            pushSnapRows(curpSnap);
        }

        if (normalizeText(nombreCompleto)) {
            const nombreSnap = await getDocs(query(pacientesRef, where('nombreCompleto', '==', normalizeText(nombreCompleto)), limit(15)));
            pushSnapRows(nombreSnap);
        }

        if (normalizedIdPaciente) {
            const idSnap = await getDocs(query(pacientesRef, where('idPaciente', '==', normalizedIdPaciente), limit(8)));
            pushSnapRows(idSnap);

            const idMigradoSnap = await getDocs(query(pacientesRef, where('idPacienteMigrado', '==', normalizedIdPaciente), limit(8)));
            pushSnapRows(idMigradoSnap);
        }

        const rows = Array.from(rowsById.values());

        const curpMatches = rows.filter((row) => {
            const rowCurp = normalizeUpper(row.curp);
            return normalizedCurp && rowCurp && rowCurp === normalizedCurp;
        });

        const nameBirthMatches = rows.filter((row) => {
            const rowNombre = normalizeUpper(buildPatientName(row));
            const rowFecha = normalizeDateIso(row.fechaNacimiento);
            return normalizedNombre && normalizedFecha && rowNombre === normalizedNombre && rowFecha === normalizedFecha;
        });

        const idMatches = rows.filter((row) => {
            const rowId = normalizeUpper(row.idPaciente || row.idPacienteMigrado || '');
            return normalizedIdPaciente && rowId === normalizedIdPaciente;
        });

        const phoneNameMatches = rows.filter((row) => {
            const rowNombre = normalizeUpper(buildPatientName(row));
            const rowTelefono = normalizeDigits(row.telefonoMovil || row.telefono || '');
            return normalizedNombre && normalizedTelefono && rowNombre === normalizedNombre && rowTelefono === normalizedTelefono;
        });

        return {
            curpMatches,
            nameBirthMatches,
            idMatches,
            phoneNameMatches
        };
    };

  const handleGuardar = async (e) => {
    e.preventDefault();
        const normalizedNames = sanitizePatientNameFields({
            nombre: normalizeTitleCase(formData.nombre),
            apellidoPaterno: normalizeTitleCase(formData.apellidoPaterno),
            apellidoMaterno: normalizeTitleCase(formData.apellidoMaterno),
            nombreCompleto: normalizeTitleCase(formData.nombreCompleto)
        });

        if (!normalizedNames.nombre || !normalizedNames.apellidoPaterno) {
        showToast('Nombre y apellido paterno son obligatorios.', 'error');
        return;
    }
        if (!pacienteAEditar && !normalizeDateIso(formData.fechaNacimiento)) {
            showToast('La fecha de nacimiento es obligatoria para crear un paciente nuevo.', 'error');
            return;
        }
        if (!formData.sexo) {
            showToast('El sexo del paciente es obligatorio.', 'error');
            return;
        }
    
    setLoading(true);
    try {
            const nombreCompleto = normalizedNames.nombreCompleto;
            const fechaReferencia = formData.fechaNacimiento || pacienteAEditar?.fechaNacimiento || null;
            const idPaciente = buildPatientHumanId(nombreCompleto, fechaReferencia);
            const curpNormalizada = normalizeUpper(formData.curp);

            const duplicates = await buscarPosiblesDuplicados({
                nombreCompleto,
                fechaNacimiento: fechaReferencia,
                curp: curpNormalizada,
                idPaciente,
                telefonoMovil: formData.telefonoMovil,
                excludeDocId: pacienteAEditar?.id || ''
            });

            if (!pacienteAEditar && duplicates.curpMatches.length > 0) {
                const nombres = summarizeMatchNames(duplicates.curpMatches);
                showToast(
                    `CURP duplicada detectada${nombres ? ` con: ${nombres}` : ''}. Abre el expediente existente para actualizarlo.`,
                    'error',
                    7000
                );
                return;
            }

            if (!pacienteAEditar) {
                const softMatchRows = [
                    ...duplicates.nameBirthMatches,
                    ...duplicates.idMatches,
                    ...duplicates.phoneNameMatches
                ];

                if (softMatchRows.length > 0) {
                    const fingerprint = buildDuplicateFingerprint(
                        duplicates.nameBirthMatches,
                        duplicates.idMatches,
                        duplicates.phoneNameMatches
                    );

                    const now = Date.now();
                    const bypassActivo =
                        duplicateBypass.fingerprint === fingerprint &&
                        duplicateBypass.expiresAt > now;

                    if (!bypassActivo) {
                        const razones = [];
                        if (duplicates.nameBirthMatches.length > 0) razones.push('mismo nombre y fecha');
                        if (duplicates.idMatches.length > 0) razones.push('idPaciente repetido');
                        if (duplicates.phoneNameMatches.length > 0) razones.push('mismo nombre y teléfono');

                        const nombres = summarizeMatchNames(softMatchRows);

                        setDuplicateBypass({
                            fingerprint,
                            expiresAt: now + 12000
                        });

                        showToast(
                            `Posible duplicado (${razones.join(', ')}). ${nombres ? `Coincide con: ${nombres}. ` : ''}Presiona Guardar otra vez en 12s solo si confirmas homónimo.`,
                            'warning',
                            9000
                        );
                        return;
                    }
                }
            }

      // Computar campos legacy para retrocompatibilidad
      const calleLegacy = [formData.calle, formData.numeroExterior].filter(Boolean).join(' ') || formData.calleNumero || '';
      const municipioEstadoLegacy = [formData.municipio, formData.estado].filter(Boolean).join(', ') || formData.municipioEstado || '';

      const datosFinales = { 
                ...formData,
        nombre: normalizedNames.nombre,
        apellidoPaterno: normalizedNames.apellidoPaterno,
        apellidoMaterno: normalizedNames.apellidoMaterno,
        nombreCompleto,
        searchName: normalizeForSearch(nombreCompleto),
                idPaciente,
                curp: curpNormalizada,
                fechaNacimiento: normalizeDateIso(formData.fechaNacimiento) || '',
        fechaActualizacion: new Date().toISOString(),
        // Campos legacy computados para compatibilidad
        calleNumero: calleLegacy,
        municipioEstado: municipioEstadoLegacy
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

      setDuplicateBypass({ fingerprint: '', expiresAt: 0 });

      // Notificamos al padre (Agenda o Pacientes)
      if (onPacienteCreadoRef.current) {
        onPacienteCreadoRef.current({ id: docId, ...datosFinales });
      } else {
        onClose();
      }

    } catch (error) {
      console.error(error);
            showToast(`Error al guardar: ${error.message}`, 'error', 6500);
        } finally {
            setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {toast.show && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[180] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg backdrop-blur-sm max-w-[92vw] ${
                    toast.type === 'error'
                        ? 'bg-rose-50/95 border-rose-200 text-rose-700'
                        : toast.type === 'warning'
                            ? 'bg-amber-50/95 border-amber-200 text-amber-800'
                            : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
                }`}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : toast.type === 'warning' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                    <span className="text-sm font-semibold leading-snug">{toast.msg}</span>
                    <button
                        onClick={() => setToast({ show: false, msg: '', type: 'error' })}
                        className="ml-1 p-1 rounded-md hover:bg-black/5 transition-colors"
                        aria-label="Cerrar notificación"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

       {/* Backdrop */}
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={loading ? undefined : onClose} />
       
       {/* Modal Card */}
       <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        {pacienteAEditar ? 'Editar Expediente' : 'Nuevo Paciente'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        {pacienteAEditar ? `ID: ${pacienteAEditar.idPaciente || pacienteAEditar.idPacienteMigrado || pacienteAEditar.id.slice(0,8) + '...'}` : 'Ingresar datos del paciente'}
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
                                <div>
                                    <label className="label-style">Nacimiento {!pacienteAEditar ? '*' : ''}</label>
                                    <input type="date" required={!pacienteAEditar} className="input-style text-slate-500" value={formData.fechaNacimiento} onChange={e => setFormData({...formData, fechaNacimiento: e.target.value})} />
                                    {formData.fechaNacimiento && (() => {
                                        const d = new Date(formData.fechaNacimiento + 'T00:00:00');
                                        if (isNaN(d.getTime())) return null;
                                        const hoy = new Date();
                                        let years = hoy.getFullYear() - d.getFullYear();
                                        let months = hoy.getMonth() - d.getMonth();
                                        if (hoy.getDate() < d.getDate()) months -= 1;
                                        if (months < 0) { years -= 1; months += 12; }
                                        if (years < 0) return null;
                                        return (
                                            <p className="text-[11px] font-semibold text-blue-600 mt-1">
                                                {years > 0 ? `${years} año${years !== 1 ? 's' : ''}` : ''}{years > 0 && months > 0 ? ', ' : ''}{months > 0 ? `${months} mes${months !== 1 ? 'es' : ''}` : ''}{years === 0 && months === 0 ? 'Recién nacido' : ''}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <label className="label-style">Sexo *</label>
                                    <select className="input-style" required value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})}>
                                        <option value="">Seleccionar</option><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option>
                                    </select>
                                </div>
                                <div><label className="label-style">Tipo Sangre</label><input type="text" className="input-style" placeholder="Ej. O+" value={formData.grupoSanguineo} onChange={e => setFormData({...formData, grupoSanguineo: e.target.value})} /></div>
                                <div><label className="label-style">Estado Civil</label><select className="input-style" value={formData.estadoCivil} onChange={e => setFormData({...formData, estadoCivil: e.target.value})}><option value="">Seleccione</option><option value="Soltero">Soltero(a)</option><option value="Casado">Casado(a)</option><option value="Union Libre">Unión Libre</option><option value="Divorciado">Divorciado(a)</option><option value="Viudo">Viudo(a)</option></select></div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 mt-3">
                                <div><label className="label-style">Lugar de Nacimiento</label><input type="text" className="input-style" placeholder="Ciudad, Estado" value={formData.lugarNacimiento} onChange={e => setFormData({...formData, lugarNacimiento: e.target.value})} /></div>
                                <div><label className="label-style">Ocupación</label><input type="text" className="input-style" placeholder="Profesión u oficio actual" value={formData.ocupacion} onChange={e => setFormData({...formData, ocupacion: e.target.value})} /></div>
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
                            </div>

                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-4">Dirección</h4>
                            <div className="grid grid-cols-1 gap-3">
                                <div><label className="label-style">Calle</label><input type="text" className="input-style" value={formData.calle} onChange={e => setFormData({...formData, calle: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="label-style">Núm. Exterior</label><input type="text" className="input-style" value={formData.numeroExterior} onChange={e => setFormData({...formData, numeroExterior: e.target.value})} /></div>
                                    <div><label className="label-style">Núm. Interior</label><input type="text" className="input-style" placeholder="Opcional" value={formData.numeroInterior} onChange={e => setFormData({...formData, numeroInterior: e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="label-style">Colonia</label><input type="text" className="input-style" value={formData.colonia} onChange={e => setFormData({...formData, colonia: e.target.value})} /></div>
                                    <div><label className="label-style">C.P.</label><input type="text" className="input-style" maxLength="5" value={formData.cp} onChange={e => setFormData({...formData, cp: e.target.value})} /></div>
                                    <div><label className="label-style">País</label><input type="text" className="input-style" value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="label-style">Municipio</label><input type="text" className="input-style" value={formData.municipio} onChange={e => setFormData({...formData, municipio: e.target.value})} /></div>
                                    <div><label className="label-style">Estado</label><input type="text" className="input-style" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} /></div>
                                </div>
                            </div>

                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2">Información Complementaria</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-style">Religión</label><select className="input-style" value={formData.religion} onChange={e => setFormData({...formData, religion: e.target.value})}><option value="">Seleccione</option><option>Católica</option><option>Cristiana</option><option>Judía</option><option>Testigo de Jehová</option><option>Mormona</option><option>Ninguna</option><option>Otra</option></select></div>
                                <div><label className="label-style">Persona Responsable</label><input type="text" className="input-style" placeholder="Nombre y parentesco" value={formData.personaResponsable} onChange={e => setFormData({...formData, personaResponsable: e.target.value})} /></div>
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
                                <div className="col-span-2"><label className="label-style">CURP</label><input type="text" className="input-style font-mono uppercase tracking-widest" maxLength="18" value={formData.curp} onChange={e => setFormData({...formData, curp: normalizeUpper(e.target.value)})} /></div>
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