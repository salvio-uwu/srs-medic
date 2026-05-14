import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, MapPin, Building2, User, Clock, Stethoscope } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSessionLocation } from '../context/SessionLocationContext';

// ── Sonido robusto: Web Audio API + fallback HTMLAudioElement ──
const BEEP_DURATION = 0.25;
const BEEP_GAP = 0.18;
const CYCLE_PAUSE = 1.8;
const CYCLE_TOTAL = (BEEP_DURATION + BEEP_GAP) * 3 + CYCLE_PAUSE;

// Fallback audio (for Safari, older browsers)
const fallbackAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIwsAAACAAADY2xpcmtzAAAAABAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAB');
fallbackAudio.volume = 0.3;

const playAlertCycle = (ctx, startTime) => {
  try {
    if (!ctx || ctx.state === 'suspended') {
      // Try to resume first
      if (ctx?.state === 'suspended') {
        ctx.resume().catch(e => {
          console.warn('[PÁNICO] AudioContext resume falló, usando fallback:', e);
          fallbackAudio.currentTime = 0;
          fallbackAudio.play().catch(() => {});
          return;
        });
      }
    }
    
    if (ctx?.state !== 'running') {
      console.warn('[PÁNICO] AudioContext no está running aún, usando fallback');
      fallbackAudio.currentTime = 0;
      fallbackAudio.play().catch(() => {});
      return;
    }
    
    const freq = 880;
    const vol = 0.75;
    console.log('[PÁNICO] Reproduciendo ciclo de alerta a', freq, 'Hz');
    
    for (let i = 0; i < 3; i++) {
      const t = startTime + i * (BEEP_DURATION + BEEP_GAP);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.01);
      gain.gain.setValueAtTime(vol, t + BEEP_DURATION * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, t + BEEP_DURATION);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + BEEP_DURATION + 0.02);
    }
  } catch (e) {
    console.error('[PÁNICO] Error en playAlertCycle:', e);
    // Fallback final
    fallbackAudio.currentTime = 0;
    fallbackAudio.play().catch(() => {});
  }
};

// ── Botón de pánico (brújula) ──
export const PanicLauncherButton = ({ showLauncherMenu, onActivate, hasActiveAlert }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (hasActiveAlert) {
            onActivate(); // Already active → dismiss
          } else {
            setShowConfirm(true);
          }
        }}
        title="Activar alerta de emergencia (P×5)"
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          border: hasActiveAlert ? '1px solid #dc2626' : '1px solid #fecaca',
          background: hasActiveAlert
            ? 'linear-gradient(180deg, #fff1f2 0%, #fee2e2 100%)'
            : 'linear-gradient(180deg, #fff1f2 0%, #fff5f5 100%)',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hasActiveAlert ? '0 8px 22px rgba(220,38,38,.30)' : '0 8px 16px rgba(15,23,42,.12)',
          cursor: 'pointer',
          position: 'relative',
          transform: showLauncherMenu ? 'translateY(0) scale(1)' : 'translateY(8px) scale(.92)',
          opacity: showLauncherMenu ? 1 : 0,
          transition: 'all .26s ease',
          animation: hasActiveAlert ? 'panic-pulse 1.2s infinite' : 'none',
        }}
      >
        <AlertTriangle size={19} />
        {hasActiveAlert && (
          <span
            style={{
              position: 'absolute', top: -4, right: -4,
              width: 12, height: 12, borderRadius: '999px',
              background: '#dc2626', border: '2px solid #ffffff',
            }}
          />
        )}
      </button>

      {/* Confirmación glassmorphism */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(14px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
          }}
        >
          <div
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(28px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
              border: '1px solid rgba(255,255,255,0.65)',
              borderRadius: 24,
              padding: '28px 26px 24px',
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 24px 64px rgba(220,38,38,.12), 0 0 0 1px rgba(220,38,38,.05), inset 0 1px 0 rgba(255,255,255,0.95)',
              overflow: 'hidden',
            }}
          >
            {/* Orb decorativo */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(239,68,68,0.10)',
              filter: 'blur(44px)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -30, left: -20,
              width: 110, height: 110, borderRadius: '50%',
              background: 'rgba(251,113,133,0.08)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
            }} />

            {/* Icono + título */}
            <div style={{ textAlign: 'center', marginBottom: 14, position: 'relative' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 54, height: 54, borderRadius: '50%',
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.78)',
                boxShadow: '0 4px 16px rgba(220,38,38,.14), inset 0 1px 0 rgba(255,255,255,.85)',
                marginBottom: 14,
              }}>
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Activar alerta de emergencia
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6', marginBottom: 22, textAlign: 'center', position: 'relative' }}>
              Esta alerta sonará en todos los dispositivos conectados y notificará a todo el personal.
            </p>

            <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 12,
                  border: '1px solid rgba(203,213,225,0.7)',
                  background: 'rgba(241,245,249,0.65)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { onActivate(); setShowConfirm(false); }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  letterSpacing: '.04em',
                  boxShadow: '0 6px 20px rgba(220,38,38,.32), inset 0 1px 0 rgba(255,255,255,.18)',
                }}
              >
                ACTIVAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Overlay glassmorphism ──
export const PanicAlertOverlay = ({ alert, onDismiss, currentUserId }) => {
  if (!alert) return null;

  const isOwnAlert = alert.userId === currentUserId;
  const createdAt = alert.createdAt?.toDate
    ? alert.createdAt.toDate()
    : alert.createdAt instanceof Date
      ? alert.createdAt
      : alert.createdAt
        ? new Date(alert.createdAt)
        : new Date();
  const isValid = !isNaN(createdAt.getTime());
  const timeStr = isValid
    ? createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const dateStr = isValid
    ? createdAt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '--/--/----';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        animation: 'panic-in .4s ease',
        padding: 16,
      }}
    >
      {/* Tarjeta glass */}
      <div
        style={{
          position: 'relative',
          background: 'rgba(255,248,248,0.90)',
          backdropFilter: 'blur(40px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.7)',
          border: '1px solid rgba(255,255,255,0.68)',
          borderRadius: 28,
          padding: '32px 28px 28px',
          maxWidth: 460,
          width: '100%',
          boxShadow: '0 32px 72px rgba(239,68,68,.22), 0 0 0 1px rgba(239,68,68,.07), inset 0 1px 0 rgba(255,255,255,0.92)',
          animation: 'panic-bounce .5s cubic-bezier(.36,.07,.19,.97)',
          color: '#1e293b',
          overflow: 'hidden',
        }}
      >
        {/* Orbs líquidos decorativos */}
        <div style={{
          position: 'absolute', top: -60, right: -50,
          width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(239,68,68,0.13)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -50, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(251,113,133,0.10)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '45%', left: -30,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(253,186,116,0.08)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }} />

        {/* Badge pill */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(220,38,38,0.10)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(220,38,38,0.20)',
            borderRadius: 99,
            padding: '6px 16px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            color: '#dc2626',
            textTransform: 'uppercase',
            animation: 'panic-pulse 2s infinite',
          }}>
            <AlertTriangle size={12} />
            ALERTA ACTIVA
          </div>
        </div>

        {/* Icono en burbuja glass */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px rgba(239,68,68,.18), inset 0 1px 0 rgba(255,255,255,.85)',
          }}>
            <AlertTriangle size={38} color="#dc2626" />
          </div>
        </div>

        {/* Título */}
        <h2 style={{
          margin: '0 0 6px', textAlign: 'center',
          fontSize: 20, fontWeight: 800, letterSpacing: '.02em',
          color: '#dc2626',
        }}>
          ALERTA DE EMERGENCIA
        </h2>
        <p style={{
          margin: '0 0 22px', textAlign: 'center',
          fontSize: 13, color: '#991b1b', fontWeight: 600,
        }}>
          {isOwnAlert ? 'Tú activaste esta alerta' : 'Un compañero necesita ayuda'}
        </p>

        {/* Panel de contexto — glass interno */}
        <div style={{
          background: 'rgba(255,255,255,0.50)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.68)',
          borderRadius: 18,
          padding: '16px 18px',
          marginBottom: 24,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.80)',
        }}>
          <h3 style={{
            fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 14,
            textAlign: 'center', letterSpacing: '.09em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <MapPin size={11} /> Contexto de la alerta
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 12px',
            fontSize: 13, lineHeight: '1.4',
          }}>
            <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center' }}><User size={13} /></span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{alert.userName || 'Usuario desconocido'}</span>

            <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center' }}><Building2 size={13} /></span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{alert.sucursalNombre || 'Sucursal no especificada'}</span>

            <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center' }}><Stethoscope size={13} /></span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{alert.consultorioNombre || 'Consultorio no especificado'}</span>

            <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center' }}><Clock size={13} /></span>
            <span style={{ color: '#64748b', fontWeight: 400 }}>{dateStr} · {timeStr}</span>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            border: 'none',
            boxShadow: '0 8px 28px rgba(220,38,38,.32), inset 0 1px 0 rgba(255,255,255,.18)',
            transition: 'all .2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
            e.currentTarget.style.boxShadow = '0 10px 34px rgba(220,38,38,.44), inset 0 1px 0 rgba(255,255,255,.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(220,38,38,.32), inset 0 1px 0 rgba(255,255,255,.18)';
          }}
        >
          {isOwnAlert ? 'DETENER SONIDO Y DESACTIVAR ALERTA' : 'RECONOCER Y CERRAR'}
        </button>

        <p style={{
          marginTop: 14,
          fontSize: 11,
          color: '#94a3b8',
          textAlign: 'center',
          fontWeight: 500,
        }}>
          Esta acción detiene el sonido y notifica a todos los dispositivos conectados.
        </p>
      </div>
    </div>
  );
};

const Row = ({ icon, label, badge, muted }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{
      color: muted ? 'rgba(252,165,165,.55)' : '#f87171',
      flexShrink: 0, display: 'flex',
    }}>
      {icon}
    </span>
    <span style={{
      fontSize: 13, fontWeight: 500,
      color: muted ? 'rgba(255,255,255,.55)' : '#fecaca',
    }}>
      {label}
    </span>
    {badge && (
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: 'rgba(254,202,202,.8)',
        background: 'rgba(254,202,202,.1)',
        borderRadius: 5, padding: '1px 7px',
        textTransform: 'uppercase', letterSpacing: '.05em',
        border: '1px solid rgba(254,202,202,.15)',
      }}>
        {badge}
      </span>
    )}
  </div>
);

// ── Hook principal ──
export const usePanicSystem = () => {
  const { user } = useAuth();
  const { sessionSucursal, sessionConsultorio } = useSessionLocation();
  const [activeAlert, setActiveAlert] = useState(null);
  const audioCtxRef = useRef(null);
  const pPressesRef = useRef([]);
  const soundTimerRef = useRef(null);
  const alertActiveRef = useRef(false);
  const triggerRef = useRef(null);
  const userRef = useRef(user);
  const sucursalRef = useRef(sessionSucursal);
  const consultorioRef = useRef(sessionConsultorio);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { sucursalRef.current = sessionSucursal; }, [sessionSucursal]);
  useEffect(() => { consultorioRef.current = sessionConsultorio; }, [sessionConsultorio]);

  // ── Función que detiene TODO el sonido ──
  const stopAllSound = useCallback(() => {
    alertActiveRef.current = false;
    if (soundTimerRef.current) {
      clearTimeout(soundTimerRef.current);
      soundTimerRef.current = null;
    }
  }, []);

  // ── Loop de sonido controlado por alertActiveRef ──
  const startSoundLoop = useCallback(() => {
    stopAllSound();
    alertActiveRef.current = true;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[PÁNICO] AudioContext creado, estado:', audioCtxRef.current.state);
    }

    const ensureRunning = () => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        console.log('[PÁNICO] AudioContext suspendido, intentando resume()');
        ctx.resume().then(() => {
          console.log('[PÁNICO] AudioContext resume exitoso, estado:', ctx.state);
        }).catch((e) => {
          console.warn('[PÁNICO] Error al resumir AudioContext:', e);
        });
      }
    };

    ensureRunning();

    const tick = () => {
      if (!alertActiveRef.current) return;
      ensureRunning();
      playAlertCycle(audioCtxRef.current, audioCtxRef.current.currentTime);
      soundTimerRef.current = setTimeout(tick, CYCLE_TOTAL * 1000);
    };

    tick();
  }, [stopAllSound]);

  // Desbloquear AudioContext
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Disparar alerta ──
  const triggerPanic = useCallback(async () => {
    const u = userRef.current;
    if (!u?.uid) {
      console.warn('[PÁNICO] No hay usuario autenticado');
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'panic_alerts'), {
        activo: true,
        userId: u.uid,
        userName: u.nombre || u.displayName || u.email || 'Usuario',
        userRole: u.rol || '',
        sucursalId: sucursalRef.current?.id || '',
        sucursalNombre: sucursalRef.current?.nombre || '',
        consultorioId: consultorioRef.current?.id || '',
        consultorioNombre: consultorioRef.current?.nombre || '',
        createdAt: serverTimestamp(),
        dismissedBy: null,
        dismissedAt: null,
      });
      console.log('[PÁNICO] Alerta creada:', docRef.id);
    } catch (err) {
      console.error('[PÁNICO] Error activando alerta:', err);
    }
  }, []);

  useEffect(() => { triggerRef.current = triggerPanic; }, [triggerPanic]);

  // ── Listener tecla P × 5 ──
  useEffect(() => {
    if (!user?.uid) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key !== 'p' && e.key !== 'P') return;

      const now = Date.now();
      const filtered = pPressesRef.current.filter((t) => now - t < 2500);
      filtered.push(now);
      pPressesRef.current = filtered;

      if (filtered.length >= 5) {
        pPressesRef.current = [];
        triggerRef.current?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user?.uid]);

  // ── Listener Firestore en tiempo real ──
  useEffect(() => {
    if (!user?.uid) {
      setActiveAlert(null);
      stopAllSound();
      return;
    }

    const q = query(collection(db, 'panic_alerts'), where('activo', '==', true));

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setActiveAlert(null);
        stopAllSound();
        return;
      }

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      const latest = docs[0];

      setActiveAlert(latest);
      // Iniciar sonido solo si es una alerta nueva (id distinto)
      if (!alertActiveRef.current) {
        startSoundLoop();
      }
    }, (error) => {
      console.error('[PÁNICO] Error en listener:', error);
    });

    return () => {
      unsub();
      stopAllSound();
    };
  }, [user?.uid, stopAllSound, startSoundLoop]);

  // ── Descartar alerta ──
  const dismissAlert = useCallback(async () => {
    if (!activeAlert || !user?.uid) return;
    try {
      await updateDoc(doc(db, 'panic_alerts', activeAlert.id), {
        activo: false,
        dismissedBy: { userId: user.uid, userName: user.nombre || user.email },
        dismissedAt: serverTimestamp(),
      });
      stopAllSound();
      console.log('[PÁNICO] Alerta desactivada:', activeAlert.id);
    } catch (err) {
      console.error('[PÁNICO] Error desactivando alerta:', err);
    }
  }, [activeAlert, user, stopAllSound]);

  return {
    activeAlert,
    triggerPanic,
    dismissAlert,
    hasActiveAlert: Boolean(activeAlert),
  };
};
