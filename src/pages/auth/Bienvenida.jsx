// src/pages/auth/Bienvenida.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo_azul.png';

const IconCross = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2v20M2 12h20"/>
  </svg>
);

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="13 6 19 12 13 18"/>
  </svg>
);

const HeartbeatLine = () => {
  const path = "M0,30 L40,30 L50,30 L60,5 L70,55 L80,15 L90,30 L110,30 L120,30 L160,30";
  return (
    <svg viewBox="0 0 160 60" style={{width:'100%',height:'100%'}} preserveAspectRatio="none">
      <defs>
        <linearGradient id="hbGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0"/>
          <stop offset="40%" stopColor="#3b82f6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#hbGrad2)" strokeWidth="2" className="hb-path"/>
    </svg>
  );
};

const DotGrid = ({ rows = 6, cols = 8 }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.25 }}>
    {Array.from({ length: rows }).map((_, r) =>
      Array.from({ length: cols }).map((_, c) => (
        <span key={`${r}-${c}`} style={{
          position: 'absolute',
          width: 3, height: 3,
          borderRadius: '50%',
          background: '#94a3b8',
          top: `${(r + 1) * (100 / (rows + 1))}%`,
          left: `${(c + 1) * (100 / (cols + 1))}%`,
        }}/>
      ))
    )}
  </div>
);

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
  :root {
    --c-bg: #f0f4f8; --c-surface: #ffffff;
    --c-blue: #2563eb; --c-blue-lt: #dbeafe;
    --c-teal: #0d9488; --c-ink: #0f172a;
    --c-muted: #64748b; --c-border: #cbd5e1; --c-accent: #f1f5f9;
  }
  .bv-shell { min-height:100vh; background:var(--c-bg); display:flex; align-items:center; justify-content:center; padding:24px; position:relative; overflow:hidden; font-family:'Inter',sans-serif; }
  .bv-bg-grad { position:absolute; inset:0; pointer-events:none; background: radial-gradient(ellipse 80% 60% at 20% 0%, rgba(219,234,254,0.55) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(204,251,241,0.35) 0%, transparent 55%); }
  .bv-cross { position:absolute; color:rgba(37,99,235,0.12); animation:bv-float 6s ease-in-out infinite; }
  @keyframes bv-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  .bv-card { position:relative; background:var(--c-surface); border-radius:32px; box-shadow:0 24px 80px -16px rgba(15,23,42,0.12),0 0 0 1px rgba(15,23,42,0.06); padding:56px 52px 52px; width:100%; max-width:460px; text-align:center; overflow:hidden; }
  .bv-badge { display:inline-flex; align-items:center; gap:6px; background:var(--c-accent); border:1px solid var(--c-border); border-radius:50px; padding:5px 14px; font-size:10px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--c-muted); margin-bottom:32px; }
  .bv-badge-dot { width:6px; height:6px; border-radius:50%; background:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.2); animation:bv-pulse 2s infinite; }
  @keyframes bv-pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.2)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0.08)} }
  .bv-logo { height:58px; width:auto; object-fit:contain; margin-bottom:28px; }
  .bv-title { font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:28px; font-weight:700; color:var(--c-ink); letter-spacing:-0.025em; line-height:1.2; margin-bottom:12px; }
  .bv-divider { width:40px; height:2px; background:var(--c-blue); border-radius:2px; margin:0 auto 28px; opacity:0.5; }
  .bv-subtitle { font-size:14px; color:var(--c-muted); line-height:1.6; margin-bottom:40px; font-weight:400; }
  .bv-btn { width:100%; background:var(--c-ink); color:#fff; border:none; border-radius:14px; padding:16px 24px; font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; overflow:hidden; position:relative; transition:background 0.2s,transform 0.15s,box-shadow 0.2s; box-shadow:0 8px 32px -8px rgba(15,23,42,0.35); font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  .bv-btn:hover { background:#1e3a5f; box-shadow:0 12px 40px -8px rgba(15,23,42,0.45); }
  .bv-btn:active { transform:scale(0.985); }
  .bv-btn .arr { transition:transform 0.2s; }
  .bv-btn:hover .arr { transform:translateX(4px); }
  .bv-btn::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 50%,transparent 100%); transform:translateX(-100%); transition:transform 0.5s; }
  .bv-btn:hover::after { transform:translateX(100%); }
  .bv-hb { width:100%; height:36px; margin:36px 0 0; opacity:0.6; }
  .hb-path { stroke-dasharray:260; stroke-dashoffset:260; animation:bv-draw 2.4s cubic-bezier(.4,0,.2,1) infinite; }
  @keyframes bv-draw { 0%{stroke-dashoffset:260;opacity:0} 10%{opacity:1} 60%{stroke-dashoffset:0;opacity:1} 85%{stroke-dashoffset:0;opacity:0.6} 100%{stroke-dashoffset:-260;opacity:0} }
  .bv-footer { margin-top:24px; font-size:11px; color:var(--c-muted); font-weight:400; opacity:0.7; }
  .bv-fade { opacity:0; transform:translateY(20px); transition:opacity 0.6s ease,transform 0.6s ease; }
  .bv-fade.bv-in { opacity:1; transform:translateY(0); }
  .d1{transition-delay:0.05s} .d2{transition-delay:0.15s} .d3{transition-delay:0.25s} .d4{transition-delay:0.35s} .d5{transition-delay:0.45s}
  ::selection{background:var(--c-blue-lt)}
`;

const Bienvenida = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user?.uid) navigate('/inicio', { replace: true });
  }, [user, navigate]);

  const cls = (...extra) => ['bv-fade', ...extra, mounted ? 'bv-in' : ''].join(' ');

  return (
    <>
      <style>{CSS}</style>
      <div className="bv-shell">
        <div className="bv-bg-grad"/>

        {/* cruces medicas flotantes */}
        <div className="bv-cross" style={{top:'10%',left:'6%',animationDelay:'0s'}}><IconCross/></div>
        <div className="bv-cross" style={{top:'72%',left:'4%',animationDelay:'2.1s',opacity:0.5}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>
        <div className="bv-cross" style={{top:'18%',right:'7%',animationDelay:'1.2s',opacity:0.7}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>
        <div className="bv-cross" style={{bottom:'14%',right:'5%',animationDelay:'3s',opacity:0.45}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>

        <div className="bv-card">
          <DotGrid/>
          <div style={{position:'relative',zIndex:1}}>

            <div className={cls('d1')} style={{display:'flex',justifyContent:'center'}}>
              <span className="bv-badge">
                <span className="bv-badge-dot"/>
                Sistema en linea
              </span>
            </div>

            <div className={cls('d2')}>
              <img src={logoImg} alt="SRS Medic" className="bv-logo"/>
            </div>

            <div className={cls('d3')}>
              <h1 className="bv-title">Portal de Acceso Clinico</h1>
              <div className="bv-divider"/>
              <p className="bv-subtitle">
                Acceso restringido al personal autorizado.<br/>
                Ingrese sus credenciales institucionales para continuar.
              </p>
            </div>

            <div className={cls('d4')}>
              <button className="bv-btn" onClick={() => navigate('/login')}>
                Iniciar sesion
                <span className="arr"><IconArrow/></span>
              </button>
            </div>

            <div className={cls('d5') + ' bv-hb'}>
              <HeartbeatLine/>
            </div>

            <p className={cls('d5') + ' bv-footer'}>
              SRS Medic &middot; Uso exclusivo del personal de salud autorizado
            </p>

          </div>
        </div>
      </div>
    </>
  );
};

export default Bienvenida;
