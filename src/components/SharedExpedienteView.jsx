import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, Download, Loader2, AlertTriangle, Building2, Shield,
  Calendar, User, FileBadge
} from 'lucide-react';
import { obtenerExpedienteCompartido } from '../services/expedienteShareService';
import { decodeToken } from '../utils/routeObfuscator';

const SharedExpedienteView = () => {
  const { token: tokenEncoded } = useParams();
  const [estado, setEstado] = useState('cargando');
  const [data, setData] = useState(null);
  const [fechaFormateada, setFechaFormateada] = useState('');

  useEffect(() => {
    const token = decodeToken(tokenEncoded);

    if (!token) { setEstado('noEncontrado'); return; }

    let cancelled = false;

    const cargar = async () => {
      try {
        const resultado = await obtenerExpedienteCompartido(token);
        if (cancelled) return;

        if (!resultado) {
          setEstado('noEncontrado');
        } else {
          setData(resultado);
          try {
            setFechaFormateada(
              new Date(resultado.createdAt).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric'
              })
            );
          } catch { setFechaFormateada(''); }
          setEstado('listo');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error al cargar expediente compartido:', err);
        setEstado('error');
      }
    };

    cargar();
    return () => { cancelled = true; };
  }, [tokenEncoded]);

  const descargar = () => {
    if (!data?.storageUrl) return;
    const link = document.createElement('a');
    link.href = data.storageUrl;
    link.download = `Expediente_Clinico_${(data.nombrePaciente || 'paciente').replace(/\s+/g, '_')}.pdf`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Estado: Cargando ────────────────────────────
  if (estado === 'cargando') {
    return (
      <div style={{ background: '#f8f9fa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '40px 28px', textAlign: 'center', maxWidth: 320, width: 'calc(100% - 48px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={24} style={{ color: '#111' }} className="animate-spin" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
                  Cargando expediente
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                  Preparando documento clínico...
                </p>
              </div>
            </div>
          </div>
        </div>
        <footer style={{ padding: '12px 0', textAlign: 'center', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#9ca3af' }}>
            <Building2 size={12} />
            <span>Centro Médico Santa Cruz</span>
          </div>
        </footer>
      </div>
    );
  }

  // ─── Estado: No encontrado o expirado ───────────
  if (estado === 'noEncontrado') {
    return (
      <div style={{ background: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, maxWidth: 440, width: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} style={{ color: '#d97706' }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: '0 0 6px' }}>
              Enlace no disponible
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              El enlace que intentas acceder ya no es válido o ha expirado. Por razones de seguridad, los expedientes compartidos tienen una vigencia limitada de 30 días.
            </p>
            <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 6, padding: '14px 16px', textAlign: 'left' }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                Si necesitas acceder al expediente, solicita un nuevo enlace a tu médico tratante en Centro Médico Santa Cruz.
              </p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Building2 size={14} style={{ color: '#9ca3af' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>Centro Médico Santa Cruz</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Estado: Error ──────────────────────────────
  if (estado === 'error') {
    return (
      <div style={{ background: '#f8f9fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, maxWidth: 440, width: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: '0 0 6px' }}>
              Error al cargar
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
              Ocurrió un error inesperado al intentar cargar el expediente. Por favor, intenta de nuevo en unos momentos.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ border: '1px solid #111', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Estado: Listo ──────────────────────────────
  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ─── HEADER ─── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={18} style={{ color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
                  Expediente Clínico Electrónico
                </h1>
                <span style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 8px', fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#fafafa', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={9} /> Oficial
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                {data?.nombrePaciente && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                    <User size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: '#111' }}>{data.nombrePaciente}</span>
                  </span>
                )}
                {data?.folio && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                    <FileBadge size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    Folio: <span style={{ fontWeight: 600, color: '#111' }}>{data.folio}</span>
                  </span>
                )}
                {fechaFormateada && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                    <Calendar size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    {fechaFormateada}
                  </span>
                )}
                {data?.generadoPor && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Expedido por: <span style={{ fontWeight: 600, color: '#4b5563' }}>{data.generadoPor}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={descargar}
            style={{ border: '1px solid #111', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <Download size={14} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* ─── PDF VIEWER ─── */}
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 'calc(100vh - 140px)', minHeight: 500 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', height: '100%' }}>
            {data?.storageUrl ? (
              <iframe
                src={data.storageUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Expediente Clínico Electrónico PDF"
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <FileText size={20} style={{ color: '#9ca3af' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>No se pudo cargar el documento.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '12px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af' }}>
            <Building2 size={12} />
            <span style={{ fontWeight: 600, color: '#6b7280' }}>Centro Médico Santa Cruz</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af' }}>
            <Shield size={11} />
            <span>Documento confidencial · NOM-004-SSA3-2012</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SharedExpedienteView;
