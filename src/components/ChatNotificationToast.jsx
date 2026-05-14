import { useState, useEffect, useCallback } from 'react';
import { X, MessageCircle } from 'lucide-react';

const MAX_TOASTS = 5;

const getIniciales = (name) => {
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
      const nueva = { id, nombre: nombre || 'Usuario', texto: texto || 'Nuevo mensaje', rol: rol || '', visible: false };
      setNotificaciones((prev) => [nueva, ...prev.slice(0, MAX_TOASTS - 1)]);
    };

    window.addEventListener('show-chat-notification', handler);
    return () => window.removeEventListener('show-chat-notification', handler);
  }, []);

  useEffect(() => {
    if (isChatOpen) setNotificaciones([]);
  }, [isChatOpen]);

  if (notificaciones.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes ct-slide-in {
          0% { transform: translateX(120%) scale(0.92); opacity: 0; }
          60% { transform: translateX(-4px) scale(1.02); opacity: 1; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes ct-fade-out {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to { transform: translateX(80%) scale(0.88); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {notificaciones.map((n, i) => (
          <div
            key={n.id}
            onClick={() => {
              window.dispatchEvent(new Event('open-global-chat'));
              eliminarNotificacion(n.id);
            }}
            style={{
              pointerEvents: 'auto',
              width: 340,
              maxWidth: 'calc(100vw - 32px)',
              background: 'rgba(255,255,255,0.42)',
              backdropFilter: 'blur(34px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(34px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 16,
              padding: '13px 14px',
              boxShadow: [
                '0 8px 32px rgba(15,23,42,.07)',
                '0 2px 6px rgba(15,23,42,.03)',
                'inset 0 1px 0 rgba(255,255,255,.55)',
              ].join(', '),
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              cursor: 'pointer',
              animation: n.saliendo
                ? 'ct-fade-out .25s ease forwards'
                : `ct-slide-in .45s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms both`,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s, background .25s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.68)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(15,23,42,.1), 0 3px 10px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.65)';
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.42)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03), inset 0 1px 0 rgba(255,255,255,.55)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(226,232,240,0.6)',
                color: '#475569',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: "'Sora', system-ui, sans-serif",
              }}
            >
              {getIniciales(n.nombre)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0f172a',
                    fontFamily: "'Sora', system-ui, sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 140,
                  }}
                >
                  {n.nombre}
                </span>
                {n.rol && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: '#64748b',
                      background: 'rgba(241,245,249,0.7)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: 5,
                      padding: '1px 6px',
                      textTransform: 'uppercase',
                      letterSpacing: '.02em',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      border: '1px solid rgba(226,232,240,0.5)',
                    }}
                  >
                    {n.rol.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <MessageCircle
                  size={11}
                  style={{ color: 'rgba(148,163,184,0.6)', flexShrink: 0, marginTop: 3 }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: '#475569',
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
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotificaciones((prev) =>
                  prev.map((notif) => (notif.id === n.id ? { ...notif, saliendo: true } : notif))
                );
                setTimeout(() => eliminarNotificacion(n.id), 250);
              }}
              style={{
                flexShrink: 0,
                width: 26,
                height: 26,
                borderRadius: 8,
                border: 'none',
                background: 'rgba(241,245,249,0.4)',
                backdropFilter: 'blur(4px)',
                cursor: 'pointer',
                color: 'rgba(148,163,184,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'background .15s, color .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(15,23,42,0.06)';
                e.currentTarget.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(241,245,249,0.4)';
                e.currentTarget.style.color = 'rgba(148,163,184,0.7)';
              }}
              title="Cerrar"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default ChatNotificationToast;
