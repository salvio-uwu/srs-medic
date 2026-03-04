import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Camera, CheckCircle, Clock, FileText, LogOut } from 'lucide-react';

export default function DashboardIntendencia() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorial = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, "bitacorasLimpieza"),
          where("uidIntendencia", "==", user.uid),
          orderBy("fechaSubida", "desc"),
          limit(10)
        );
        const snapshot = await getDocs(q);
        setHistorial(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error al obtener historial:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorial();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans pb-24">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Panel de Intendencia</h1>
            <p className="text-sm text-slate-500">{user?.nombre || user?.email}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={20} />
          </button>
        </div>

        {/* Acción Principal */}
        <button
          onClick={() => navigate('/intendencia/captura')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg shadow-blue-500/30 transition-transform active:scale-95 mb-8"
        >
          <Camera size={40} strokeWidth={1.5} />
          <span className="font-bold text-lg">Capturar Nueva Bitácora</span>
        </button>

        {/* Resumen / Historial */}
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-blue-500"/>
          Mis Registros Recientes
        </h2>

        {loading ? (
          <div className="text-center py-8 text-slate-400">Cargando registros...</div>
        ) : historial.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
            <Clock size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No hay bitácoras registradas</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historial.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Bitácora procesada</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.fechaSubida).toLocaleDateString('es-MX', { 
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}