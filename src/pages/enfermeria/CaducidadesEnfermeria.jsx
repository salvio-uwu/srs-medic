import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import RegistroCaducidades from '../../components/RegistroCaducidades';

const CaducidadesEnfermeria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/enfermeria/dashboard')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <ArrowLeft size={18}/>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-slate-800">Caducidades de Almacén</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user?.sucursal || 'Sucursal'}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <RegistroCaducidades sucursal={user?.sucursal || ''} />
      </div>
    </div>
  );
};

export default CaducidadesEnfermeria;
