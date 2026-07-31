import React, { useMemo } from 'react';
import { HeartPulse, Moon, Sun, Sunset } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSessionLocation } from '../context/SessionLocationContext';
import LocationSelector from './LocationSelector';
import { pickMotivationalPhrase } from '../utils/motivationalPhrases';

const normalizeRole = (role = '') =>
  String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Buenos días', Icon: Sun };
  if (h < 19) return { text: 'Buenas tardes', Icon: Sunset };
  return { text: 'Buenas noches', Icon: Moon };
};

const STYLES = `
  .welcome-gate {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 18px;
    background: #f7f8fa;
    overflow-y: auto;
  }
  .welcome-panel {
    width: 100%;
    max-width: 520px;
    margin: auto;
    animation: welcome-in .35s cubic-bezier(.22, 1, .36, 1);
  }
  @keyframes welcome-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .welcome-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 28px;
  }
  .welcome-brand svg { color: #0f172a; }
  .welcome-greeting {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .welcome-greeting-icon {
    color: #94a3b8;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .welcome-greeting h1 {
    font-family: 'Sora', system-ui, sans-serif;
    font-size: clamp(26px, 5vw, 34px);
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.03em;
    line-height: 1.15;
    margin: 0;
  }
  .welcome-phrase {
    font-size: 15px;
    line-height: 1.55;
    color: #64748b;
    font-weight: 500;
    margin: 0 0 28px;
    max-width: 440px;
  }
  .welcome-card {
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 16px;
    padding: 18px 18px 16px;
    overflow: visible;
    position: relative;
    z-index: 2;
  }
  .welcome-card-title {
    font-size: 13px;
    font-weight: 650;
    color: #0f172a;
    margin: 0 0 4px;
  }
  .welcome-card-sub {
    font-size: 12px;
    color: #94a3b8;
    margin: 0 0 12px;
    line-height: 1.4;
  }
  @media (prefers-reduced-motion: reduce) {
    .welcome-panel { animation: none; }
  }
`;

const WelcomeLocationGate = () => {
  const { user } = useAuth();
  const { isDoctorRole } = useSessionLocation();

  const firstName = user?.nombre?.split(' ')[0] || 'Usuario';
  const greeting = useMemo(() => getGreeting(), []);
  const GreetingIcon = greeting.Icon;
  const roleKey = normalizeRole(user?.rol);
  const phrase = useMemo(() => pickMotivationalPhrase(roleKey), [roleKey]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="welcome-gate" role="dialog" aria-modal="true" aria-labelledby="welcome-gate-title">
        <div className="welcome-panel">
          <div className="welcome-brand">
            <HeartPulse size={16} strokeWidth={1.75} />
            Centro Médico Santa Cruz
          </div>

          <div className="welcome-greeting">
            <GreetingIcon className="welcome-greeting-icon" size={28} strokeWidth={1.75} />
            <h1 id="welcome-gate-title">
              {greeting.text}, {firstName}
            </h1>
          </div>

          <p className="welcome-phrase">{phrase}</p>

          <div className="welcome-card">
            <p className="welcome-card-title">Ubicación de trabajo</p>
            <p className="welcome-card-sub">
              {isDoctorRole
                ? 'Elige el consultorio donde vas a trabajar para continuar.'
                : 'Elige la sucursal donde vas a trabajar para continuar.'}
            </p>
            <LocationSelector accentColor="#0f172a" required inlineMenu />
          </div>
        </div>
      </div>
    </>
  );
};

export default WelcomeLocationGate;
