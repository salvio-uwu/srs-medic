import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 60_000;

const getInitials = (name) => {
  if (!name) return '??';
  return name.substring(0, 2).toUpperCase();
};

const ChatNotificationToast = ({ isChatOpen }) => {
  const [notificaciones, setNotificaciones] = useState([]);

  const eliminarNotificacion = useCallback((id) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { nombre, texto, rol } = e.detail || {};
      const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const nueva = { id, nombre: nombre || 'Usuario', texto: texto || 'Nuevo mensaje', rol: rol || '' };
      setNotificaciones((prev) => [nueva, ...prev.slice(0, MAX_TOASTS - 1)]);

      setTimeout(() => {
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === id ? { ...n, saliendo: true } : n))
        );
        setTimeout(() => eliminarNotificacion(id), 280);
      }, AUTO_DISMISS_MS);
    };

    window.addEventListener('show-chat-notification', handler);
    return () => window.removeEventListener('show-chat-notification', handler);
  }, [eliminarNotificacion]);

  useEffect(() => {
    if (isChatOpen) setNotificaciones([]);
  }, [isChatOpen]);

  if (notificaciones.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes ct-slide-in {
          0%   { transform: translateX(120%) scale(0.9); opacity: 0; }
          55%  { transform: translateX(-4px) scale(1.01); opacity: 1; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes ct-fade-out {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to   { transform: translateX(40%) scale(0.92); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {notificaciones.map((n, i) => {
          const saliendo = !!n.saliendo;

          return (
            <div
              key={n.id}
              onClick={() => {
                window.dispatchEvent(new Event('open-global-chat'));
                eliminarNotificacion(n.id);
              }}
              style={{
                pointerEvents: 'auto',
                width: 300,
                maxWidth: 'calc(100vw - 40px)',
                background: '#ffffff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(15,23,42,0.12), 0 1px 3px rgba(15,23,42,0.06)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 11,
                padding: '14px 15px',
                cursor: 'pointer',
                animation: saliendo
                  ? 'ct-fade-out .24s ease forwards'
                  : `ct-slide-in .45s cubic-bezier(.34,1.56,.64,1) ${i * 55}ms both`,
                fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
                transition: 'box-shadow .2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.12), 0 1px 3px rgba(15,23,42,0.06)';
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
                }}
              >
                {getInitials(n.nombre)}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1e293b',
                      fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 130,
                    }}
                  >
                    {n.nombre}
                  </span>
                  {n.rol && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '.03em',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {n.rol.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.5,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {n.texto}
                </p>
              </div>

              {/* Close */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNotificaciones((prev) =>
                    prev.map((notif) => (notif.id === n.id ? { ...notif, saliendo: true } : notif))
                  );
                  setTimeout(() => eliminarNotificacion(n.id), 280);
                }}
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  marginTop: 2,
                  transition: 'color .15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title="Cerrar"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ChatNotificationToast;
