import React from 'react';
import { Phone, MapPin, Edit, Trash2, FileText } from 'lucide-react';
import AvatarPaciente from './AvatarPaciente';
import { getPatientDisplayName } from '../utils/patientName';
import { calcularEdad } from '../utils/patientAge';

const PatientMobileCard = ({ paciente, onExpediente, onEditar, onEliminar }) => {
  const nombreCompleto = getPatientDisplayName(paciente);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AvatarPaciente sexo={paciente.sexo} fechaNacimiento={paciente.fechaNacimiento} size="sm" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 700, color: '#111', fontSize: 13, margin: 0 }}>{nombreCompleto || 'Sin nombre'}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
            {calcularEdad(paciente.fechaNacimiento)} anos · {paciente.sexo || '—'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {paciente.telefonoMovil || paciente.telefono ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4b5563' }}>
            <Phone size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paciente.telefonoMovil || paciente.telefono}</span>
          </div>
        ) : null}
        {paciente.municipioEstado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4b5563' }}>
            <MapPin size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paciente.municipioEstado}</span>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={() => onExpediente(paciente)}
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <FileText size={13} /> Expediente
        </button>
        <button onClick={() => onEditar(paciente)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', color: '#4b5563', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Edit size={13} />
        </button>
        <button onClick={() => onEliminar(paciente)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', color: '#ef4444', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default PatientMobileCard;
