// src/pages/admin/Usuarios.jsx
import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, MapPin, Clock, GraduationCap, Award } from 'lucide-react'; // Agregamos iconos para los nuevos campos
import { db, auth } from '../../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';

// --- CONFIGURACIÓN DE APP SECUNDARIA (Para crear usuarios sin cerrar sesión) ---
const firebaseConfig = {
  apiKey: "AIzaSyCIPnSQkdWm6YgdYlIZ8G5V4wu-oTFFTfg",
  authDomain: "srs-feacb.firebaseapp.com",
  projectId: "srs-feacb",
  storageBucket: "srs-feacb.firebasestorage.app",
  messagingSenderId: "568441727812",
  appId: "1:568441727812:web:ddc7f3ab84e2a5ab440511"
};

let secondaryApp;
if (getApps().some(app => app.name === 'Secondary')) {
  secondaryApp = getApp('Secondary');
} else {
  secondaryApp = initializeApp(firebaseConfig, 'Secondary');
}

const secondaryAuth = getAuth(secondaryApp);

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // --- 1. ESTADO DEL FORMULARIO AMPLIADO ---
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'enfermeria',
    sucursal: 'Sucursal Central',
    // Nuevos campos para Médicos 
    cedula: '',
    universidad: ''
  });

  const SUCURSALES = ["Sucursal Central", "Sucursal Norte", "Sucursal Sur", "Sucursal Este"];
  const ROLES = [
    { value: "medico", label: "Médico / Doctor" },
    { value: "enfermeria", label: "Enfermería" },
    { value: "recepcion", label: "Recepción" },
    { value: "operativo", label: "Operativo / Admin" }
  ];

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsuarios(usersList);
    } catch (error) { console.error("Error cargando usuarios:", error); }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
    const interval = setInterval(fetchUsuarios, 60000); 
    return () => clearInterval(interval);
  }, []);

  const isUserOnline = (userData) => {
      if (!userData.lastSeen) return false;
      const lastSeenDate = new Date(userData.lastSeen);
      const now = new Date();
      const diffMins = (now - lastSeenDate) / 1000 / 60; 
      return diffMins < 10; 
  };

  const calcularTiempoConectado = (lastLogin) => {
    if (!lastLogin) return "--";
    const loginDate = new Date(lastLogin);
    const now = new Date();
    const diffMs = now - loginDate;
    const diffHrs = Math.floor((diffMs % 86400000) / 3600000);
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
    return diffHrs === 0 ? `${diffMins} min` : `${diffHrs}h ${diffMins}m`;
  };

  // --- 2. LÓGICA DE REGISTRO CON CREDENCIALES MÉDICAS ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const newUser = userCredential.user;

      // Estructura de datos final
      const userData = {
        uid: newUser.uid,
        nombre: formData.nombre,
        email: formData.email,
        rol: formData.rol,
        sucursal: formData.sucursal,
        creadoPor: auth.currentUser.email,
        fechaCreacion: new Date().toISOString(),
        lastLogin: null, 
        lastSeen: null,
        isOnline: false
      };

      // Si es médico, incluimos las credenciales profesionales 
      if (formData.rol === 'medico') {
        userData.cedulaProfesional = formData.cedula;
        userData.universidadEgreso = formData.universidad;
      }

      await setDoc(doc(db, "users", newUser.uid), userData);

      alert(`Usuario ${formData.nombre} creado con éxito.`);
      setShowForm(false);
      setFormData({ 
        nombre: '', email: '', password: '', rol: 'enfermeria', 
        sucursal: 'Sucursal Central', cedula: '', universidad: '' 
      });
      fetchUsuarios();
      await secondaryAuth.signOut();

    } catch (error) {
      alert("Error creando usuario: " + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if(!window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) return;
    try {
      await deleteDoc(doc(db, "users", id));
      fetchUsuarios();
    } catch (error) { alert("Error al eliminar: " + error.message); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Personal Médico y Operativo</h1>
          <p className="text-slate-500 text-sm">Gestión de credenciales para recetas y accesos.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <UserPlus size={20} />
          {showForm ? 'Cancelar Registro' : 'Nuevo Empleado'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Registrar Nuevo Personal</h2>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
              <input type="text" required className="w-full p-2 border rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-blue-500" 
                value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sucursal Asignada</label>
              <select className="w-full p-2 border rounded-lg bg-white"
                value={formData.sucursal} onChange={e => setFormData({...formData, sucursal: e.target.value})}>
                {SUCURSALES.map(suc => <option key={suc} value={suc}>{suc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Institucional</label>
              <input type="email" required className="w-full p-2 border rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-blue-500" 
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol / Permisos</label>
              <select className="w-full p-2 border rounded-lg bg-white"
                value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                {ROLES.map(rol => <option key={rol.value} value={rol.value}>{rol.label}</option>)}
              </select>
            </div>

            {/* --- 3. CAMPOS DINÁMICOS PARA MÉDICOS  --- */}
            {formData.rol === 'medico' && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in zoom-in-95">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase mb-1">
                    <Award size={14}/> Cédula Profesional
                  </label>
                  <input type="text" required className="w-full p-2 border rounded-lg bg-white outline-none focus:border-blue-500" 
                    placeholder="Ej. 14107539"
                    value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase mb-1">
                    <GraduationCap size={14}/> Universidad de Egreso
                  </label>
                  <input type="text" required className="w-full p-2 border rounded-lg bg-white outline-none focus:border-blue-500" 
                    placeholder="Ej. Universidad Autónoma de Nuevo León"
                    value={formData.universidad} onChange={e => setFormData({...formData, universidad: e.target.value})} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña Temporal</label>
              <input type="text" required minLength="6" className="w-full p-2 border rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-blue-500" 
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold shadow-md active:scale-95 transition-all">
                Guardar Empleado
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TABLA DE USUARIOS --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Estado</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Nombre / Correo</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Rol</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Sucursal</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map(user => {
                const online = isUserOnline(user);
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 text-center">
                       <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${online ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                          {online ? 'Online' : 'Offline'}
                       </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700 text-sm group-hover:text-blue-600 transition-colors">{user.nombre}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                      {/* Mostrar Cédula en la tabla si existe */}
                      {user.cedulaProfesional && <p className="text-[10px] text-blue-500 font-bold mt-0.5">Ced. {user.cedulaProfesional}</p>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border uppercase ${
                        user.rol === 'medico' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin size={12}/> {user.sucursal}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {(user.rol !== 'admin_maestro' && user.rol !== 'admin') && (
                        <button onClick={() => handleDelete(user.id, user.nombre)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Usuarios;