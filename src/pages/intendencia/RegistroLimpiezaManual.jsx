import React, { useState } from 'react';
import { Camera, Save, X, ClipboardCheck, LogOut, MapPin } from 'lucide-react';
import { db, storage } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function RegistroLimpiezaManual() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  const [formData, setFormData] = useState({
    sanitarios: 'Limpio',
    laboratorio: 'Limpio',
    consultorios: 'Limpio',
    comedor: 'Limpio',
    farmacia: 'Limpio',
    salaEspera: 'Limpio',
    rayos: 'Limpio',
    almacen: 'Limpio',
    observaciones: ''
  });

  const esHuasteca = user?.sucursal?.toLowerCase().includes('huasteca');

  const areas = [
    { id: 'sanitarios', label: 'Sanitarios' },
    { id: 'laboratorio', label: 'Laboratorio' },
    { id: 'consultorios', label: 'Consultorios' },
    { id: 'comedor', label: 'Comedor' },
    { id: 'farmacia', label: 'Farmacia' },
    { id: 'salaEspera', label: 'Sala de Espera' },
    ...(esHuasteca ? [
      { id: 'rayos', label: 'Rayos X' },
      { id: 'almacen', label: 'Almacén' }
    ] : [])
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleGuardar = async () => {
    if (!file) return alert("Es obligatorio subir una foto de la bitácora física.");
    setLoading(true);
    try {
      const storageRef = ref(storage, `bitacoras_limpieza/${user.uid}/${Date.now()}_${file.name}`);
      const upload = await uploadBytes(storageRef, file);
      const fotoUrl = await getDownloadURL(upload.ref);

      await addDoc(collection(db, "bitacorasLimpieza"), {
        ...formData,
        usuarioNombre: user.nombre,
        usuarioUid: user.uid,
        sucursal: user.sucursal,
        fotoUrl,
        fecha: serverTimestamp(),
        estado: 'Finalizado'
      });

      alert("Registro guardado con éxito.");
      setFile(null);
      setPreview(null);
      setFormData({ sanitarios: 'Limpio', laboratorio: 'Limpio', consultorios: 'Limpio', comedor: 'Limpio', farmacia: 'Limpio', salaEspera: 'Limpio', rayos: 'Limpio', almacen: 'Limpio', observaciones: '' });
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Header Estilo Enfermería */}
      <div className="bg-white px-6 py-6 border-b border-slate-200 sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Bitácora de Higiene</h1>
          <div className="flex items-center gap-1 text-blue-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">
            <MapPin size={10}/> {user?.sucursal}
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} className="p-2 bg-slate-50 text-slate-400 rounded-xl">
          <LogOut size={20} />
        </button>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4 mt-2">
        {/* Captura de Evidencia */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Evidencia Fotográfica</h2>
          {!preview ? (
            <label className="w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50 transition-colors cursor-pointer">
              <Camera size={32} />
              <span className="text-xs font-bold">Tomar foto de bitácora</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="relative">
              <img src={preview} className="w-full h-48 object-cover rounded-2xl border border-slate-200" alt="Preview" />
              <button onClick={() => { setPreview(null); setFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Listado de Áreas */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Estado por Área</h2>
          {areas.map(area => (
            <div key={area.id} className="flex flex-col gap-1.5 border-b border-slate-50 pb-3 last:border-0">
              <label className="text-sm font-bold text-slate-700">{area.label}</label>
              <select 
                name={area.id}
                value={formData[area.id]}
                onChange={handleInputChange}
                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              >
                <option value="Limpio">✓ Limpio y Desinfectado</option>
                <option value="Pendiente">⚠ Pendiente / En Proceso</option>
                <option value="No Aplica">N/A</option>
              </select>
            </div>
          ))}
          
          <div className="pt-2">
            <label className="text-sm font-bold text-slate-700 block mb-2">Observaciones</label>
            <textarea 
              name="observaciones"
              value={formData.observaciones}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-medium text-slate-600 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Detalles adicionales de la limpieza..."
            />
          </div>
        </div>

        {/* Botón Guardar */}
        <button 
          onClick={handleGuardar}
          disabled={loading}
          className={`w-full py-5 rounded-3xl font-bold text-white shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
            loading ? 'bg-slate-400' : 'bg-blue-600 shadow-blue-200'
          }`}
        >
          {loading ? 'Guardando...' : <><Save size={20} /> Finalizar Registro</>}
        </button>
      </div>
    </div>
  );
}
