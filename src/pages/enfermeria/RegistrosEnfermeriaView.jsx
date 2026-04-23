import React from 'react';
import { useNavigate } from 'react-router-dom';
import RegistrosEnfermeriaModal from '../../components/RegistrosEnfermeriaModal';
import { useAuth } from '../../context/AuthContext';

const RegistrosEnfermeriaView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <RegistrosEnfermeriaModal
      standalone
      onClose={() => navigate('/enfermeria/jefatura')}
      enfermeraNombre={user?.nombre || 'Jefatura Enfermeria'}
      sucursal={user?.sucursal || ''}
    />
  );
};

export default RegistrosEnfermeriaView;
