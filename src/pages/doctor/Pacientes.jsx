import React, { useState } from 'react';
import { User, Search, Plus, Phone, MapPin, Edit, Trash2, ArrowLeft, FileText, X, AlertTriangle } from 'lucide-react';
// v2 — multi-token search fixed
import AvatarPaciente from '../../components/AvatarPaciente';
import PatientMobileCard from '../../components/PatientMobileCard';
import PatientSkeletonRow from '../../components/PatientSkeletonRow';
import { db } from "../../config/firebase";
import { deleteDoc, doc } from 'firebase/firestore';
import { searchPatients } from '../../services/patientSearchService';
import { useNavigate, useLocation } from 'react-router-dom';
import { goBackOr, resolvePacientesBackPath } from '../../utils/navigation';
import { getPatientDisplayName } from '../../utils/patientName';
import { calcularEdad } from '../../utils/patientAge';
import ModalPaciente from "../../components/ModalPaciente";
import ExpedienteElectronicoModal from "../../components/ExpedienteElectronicoModal";
import useIsMobile from '../../hooks/useIsMobile';

const Pacientes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const backPath = resolvePacientesBackPath(location.state?.from);

  const [pacienteExpediente, setPacienteExpediente] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);

  // Confirmación de eliminación
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, nombre }

  const sortPacientes = (rows = []) => [...rows].sort((a, b) => {
    const na = getPatientDisplayName(a);
    const nb = getPatientDisplayName(b);
    return na.localeCompare(nb, 'es', { sensitivity: 'base' });
  });

  const fetchPacientes = async (term) => {
    setLoading(true);
    setError('');
    try {
      const docs = await searchPatients(term, 50);
      setPacientes(sortPacientes(docs));
    } catch (err) {
      console.error("Error cargando pacientes:", err);
      setError('Error al buscar pacientes. Verifica tu conexión e intenta de nuevo.');
      setPacientes([]);
    }
    setLoading(false);
  };

  const handleBuscarPacientes = async () => {
    const term = busqueda.trim();
    setSearchAttempted(true);
    setError('');
    if (term.length < 2) return;
    await fetchPacientes(term);
  };

  const handleBusquedaKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleBuscarPacientes();
    }
  };

  const handleGuardado = (pacienteGuardado) => {
    if (pacienteGuardado?.id) {
      setPacientes((prev) => {
        const exists = prev.some((row) => row.id === pacienteGuardado.id);
        const merged = exists
          ? prev.map((row) => (row.id === pacienteGuardado.id ? { ...row, ...pacienteGuardado } : row))
          : [...prev, pacienteGuardado];
        return sortPacientes(merged);
      });
    }
    setShowModal(false);
    setPacienteAEditar(null);
  };

  const handleEditar = (paciente) => {
    setPacienteAEditar(paciente);
    setShowModal(true);
  };

  const handleSolicitarEliminar = (paciente) => {
    const nombre = getPatientDisplayName(paciente) || paciente.nombre || 'Paciente';
    setConfirmDelete({ id: paciente.id, nombre });
  };

  const handleConfirmarEliminar = async () => {
    if (!confirmDelete) return;
    setError('');
    try {
      await deleteDoc(doc(db, "pacientes", confirmDelete.id));
      setPacientes((prev) => prev.filter((row) => row.id !== confirmDelete.id));
    } catch (err) {
      setError(err.message || 'Error al eliminar el paciente.');
    }
    setConfirmDelete(null);
  };

  const pacientesVisibles = searchAttempted && busqueda.trim().length >= 2 ? pacientes : [];
  const mostrarResultados = searchAttempted && busqueda.trim().length >= 2;
  const hayBusquedaValida = busqueda.trim().length >= 2;

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '28px 24px 48px' }}>

        {/* ─── HEADER ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => goBackOr(navigate, backPath)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <User size={18} style={{ color: '#111', flexShrink: 0 }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>Directorio de Pacientes</h1>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Busca y administra expedientes clinicos</p>
            </div>
          </div>
          <button onClick={() => { setPacienteAEditar(null); setShowModal(true); }} style={{ border: '1px solid #111', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Nuevo paciente
          </button>
        </div>

        {/* ─── SEARCH ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, telefono o ID del paciente..."
                style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                value={busqueda}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setBusqueda(nextValue);
                  if (!nextValue.trim()) { setSearchAttempted(false); setError(''); }
                }}
                onKeyDown={handleBusquedaKeyDown}
                autoFocus
              />
              {busqueda && (
                <button onClick={() => { setBusqueda(''); setSearchAttempted(false); setError(''); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              onClick={handleBuscarPacientes}
              disabled={!hayBusquedaValida}
              style={{ border: '1px solid #111', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', background: '#111', cursor: hayBusquedaValida ? 'pointer' : 'not-allowed', opacity: hayBusquedaValida ? 1 : 0.4, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <Search size={14} /> Buscar
            </button>
          </div>
          {mostrarResultados && pacientesVisibles.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
              <span style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: '#111', background: '#fafafa' }}>{pacientesVisibles.length}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>paciente{pacientesVisibles.length !== 1 ? 's' : ''} encontrado{pacientesVisibles.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {/* Error de búsqueda */}
          {error && mostrarResultados && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #fef2f2', color: '#dc2626', fontSize: 12 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ─── RESULTS TABLE (desktop) ─── */}
        {mostrarResultados && (
          <div className="desktop-table" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Paciente</th>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Edad / Sexo</th>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Telefono</th>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ubicacion</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={5}><PatientSkeletonRow /></td></tr>
                    ))
                  ) : pacientesVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Search size={20} style={{ color: '#9ca3af' }} />
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>No se encontraron pacientes</p>
                          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Intenta con otro nombre o telefono</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pacientesVisibles.map((paciente) => {
                      const nombreCompleto = getPatientDisplayName(paciente);
                      return (
                        <tr key={paciente.id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background .1s' }}>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <AvatarPaciente sexo={paciente.sexo} fechaNacimiento={paciente.fechaNacimiento} size="sm" />
                              <div>
                                <div style={{ fontWeight: 600, color: '#111' }}>{nombreCompleto || 'Sin nombre'}</div>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>ID: {paciente.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: 12, color: '#4b5563' }}>
                              <span style={{ fontWeight: 700 }}>{calcularEdad(paciente.fechaNacimiento)}</span> anos
                              <span style={{ color: '#d1d5db', margin: '0 4px' }}>·</span>
                              {paciente.sexo || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4b5563' }}>
                              <Phone size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                              {paciente.telefonoMovil || paciente.telefono || <span style={{ color: '#9ca3af' }}>Sin registro</span>}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4b5563' }}>
                              <MapPin size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                              {paciente.municipioEstado || <span style={{ color: '#9ca3af' }}>Sin ubicacion</span>}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button onClick={() => setPacienteExpediente(paciente)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                <FileText size={11} /> Expediente
                              </button>
                              <button onClick={() => handleEditar(paciente)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', color: '#4b5563', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Edit size={11} /> Editar
                              </button>
                              <button onClick={() => handleSolicitarEliminar(paciente)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', color: '#ef4444', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Trash2 size={11} /> Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── RESULTS CARDS (mobile) ─── */}
        {mostrarResultados && (
          <div className="mobile-cards">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 14 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, background: '#f3f4f6' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '66%', marginBottom: 6 }} />
                        <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, width: '33%' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ height: 32, flex: 1, background: '#f3f4f6', borderRadius: 6 }} />
                      <div style={{ height: 32, width: 48, background: '#f3f4f6', borderRadius: 6 }} />
                      <div style={{ height: 32, width: 48, background: '#f3f4f6', borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : pacientesVisibles.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={20} style={{ color: '#9ca3af' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>No se encontraron pacientes</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Intenta con otro nombre o telefono</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pacientesVisibles.map((paciente) => (
                  <PatientMobileCard
                    key={paciente.id}
                    paciente={paciente}
                    onExpediente={setPacienteExpediente}
                    onEditar={handleEditar}
                    onEliminar={handleSolicitarEliminar}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── EMPTY STATE (no search yet) ─── */}
        {!mostrarResultados && (
          <>
            <div className="desktop-empty" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                      <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Paciente</th>
                      <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Edad / Sexo</th>
                      <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Telefono</th>
                      <th style={{ textAlign: 'left', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ubicacion</th>
                      <th style={{ textAlign: 'right', fontWeight: 700, color: '#4b5563', padding: '10px 20px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Search size={24} style={{ color: '#111' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0 }}>Buscar pacientes</p>
                            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>Escribe al menos 2 caracteres y presiona Enter o haz clic en Buscar</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mobile-empty" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={24} style={{ color: '#111' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0 }}>Buscar pacientes</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>Escribe al menos 2 caracteres y presiona Enter o haz clic en Buscar</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── RESPONSIVE CSS ─── */}
      <style>{`
        .desktop-table { display: none; }
        .desktop-empty { display: none; }
        .mobile-cards { display: block; }
        .mobile-empty { display: block; }
        @media (min-width: 768px) {
          .desktop-table { display: block; }
          .desktop-empty { display: block; }
          .mobile-cards { display: none; }
          .mobile-empty { display: none; }
        }
      `}</style>

      {/* ─── CONFIRM DELETE MODAL ─── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '28px 24px',
            maxWidth: 400, width: 'calc(100% - 48px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Eliminar paciente</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5 }}>
                  ¿Seguro que deseas eliminar el expediente de <strong style={{ color: '#111' }}>{confirmDelete.nombre}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%', paddingTop: 8 }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#4b5563', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarEliminar}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      {showModal && (
        <ModalPaciente 
            onClose={() => setShowModal(false)}
            onPacienteCreado={handleGuardado}
            pacienteAEditar={pacienteAEditar}
        />
      )}

      {pacienteExpediente && (
        <ExpedienteElectronicoModal
            paciente={pacienteExpediente}
            onClose={() => setPacienteExpediente(null)}
        />
      )}
    </div>
  );
};

export default Pacientes;
