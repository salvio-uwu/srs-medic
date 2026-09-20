/**
 * Shell visual compartido: login, splash y páginas públicas.
 * Alineado con AppShell (DM Sans + Sora, #f7f8fa, tarjetas blancas).
 */
export const PUBLIC_SHELL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  .ac-shell, .as-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
    background: #f7f8fa;
    font-family: 'DM Sans', 'Sora', system-ui, sans-serif;
    color: #0f172a;
  }

  .ac-card, .as-card {
    position: relative;
    width: 100%;
    max-width: 420px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 16px;
    padding: 40px 36px 32px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
    overflow: hidden;
    text-align: center;
  }

  .ac-card { opacity: 0; transform: translateY(12px); transition: opacity 0.45s ease, transform 0.45s ease; }
  .ac-card.in { opacity: 1; transform: translateY(0); }

  .as-card { opacity: 0; transform: translateY(12px); transition: opacity 0.45s ease, transform 0.45s ease; }
  .as-card.in { opacity: 1; transform: translateY(0); }

  .ac-brand {
    overflow: hidden;
    transition: max-height 0.42s cubic-bezier(.4,0,.2,1), opacity 0.3s ease, margin-bottom 0.42s;
    max-height: 180px; opacity: 1; margin-bottom: 0;
  }
  .ac-brand.gone { max-height: 0; opacity: 0; margin-bottom: 0; }
  .ac-logo, .as-logo {
    height: 56px; width: auto; object-fit: contain; display: block;
    margin: 0 auto 14px;
    transition: height 0.42s cubic-bezier(.4,0,.2,1), margin-bottom 0.42s;
  }
  .ac-brand.compact .ac-logo { height: 40px; margin-bottom: 8px; }
  .ac-clinica, .as-clinica {
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 20px; font-weight: 650; color: #0f172a;
    letter-spacing: -0.02em; line-height: 1.25; margin: 0;
    transition: font-size 0.42s cubic-bezier(.4,0,.2,1), color 0.3s ease;
  }
  .ac-brand.compact .ac-clinica { font-size: 14px; color: #64748b; font-weight: 600; }

  .ac-welcome {
    max-height: 260px; opacity: 1; overflow: hidden;
    transition: max-height 0.38s cubic-bezier(.4,0,.2,1), opacity 0.28s ease;
  }
  .ac-welcome.off { max-height: 0; opacity: 0; }
  .ac-subtitle, .as-sub {
    font-size: 13px; color: #64748b; line-height: 1.65;
    margin: 14px 0 24px;
  }

  .ac-form-area {
    max-height: 0; opacity: 0; overflow: hidden;
    transition: max-height 0.52s cubic-bezier(.4,0,.2,1) 0.14s, opacity 0.38s ease 0.16s;
  }
  .ac-form-area.open { max-height: 540px; opacity: 1; }

  .ac-portal {
    max-height: 0; opacity: 0; overflow: hidden;
    transition: max-height 0.58s cubic-bezier(.4,0,.2,1) 0.18s, opacity 0.42s ease 0.22s;
  }
  .ac-portal.open { max-height: 860px; opacity: 1; overflow: visible; }

  .ac-pulse {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    background: #0f172a;
    animation: pub-pulse 2s ease infinite;
  }
  @keyframes pub-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.92); }
  }

  @keyframes ac-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ap0 { animation: ac-up 0.45s ease both 0.28s; }
  .ap1 { animation: ac-up 0.45s ease both 0.38s; }
  .ap2 { animation: ac-up 0.45s ease both 0.46s; }
  .ap3 { animation: ac-up 0.45s ease both 0.54s; }
  .ap4 { animation: ac-up 0.45s ease both 0.62s; }

  .ac-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8;
    margin-bottom: 6px; text-align: left; padding-left: 2px;
  }
  .ac-field { margin-bottom: 14px; }
  .ac-input {
    width: 100%; background: #fff; border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 10px; padding: 12px 16px 12px 42px;
    font-size: 14px; font-weight: 500; color: #0f172a; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: 'DM Sans', system-ui, sans-serif;
  }
  .ac-input::placeholder { color: #94a3b8; font-weight: 400; }
  .ac-input:focus {
    border-color: rgba(15, 23, 42, 0.22);
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
  }
  .ac-icon {
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
    color: #94a3b8; pointer-events: none; display: flex; align-items: center;
  }

  .ac-btn {
    width: 100%; background: #0f172a; color: #fff;
    border: none; border-radius: 10px; padding: 13px 20px;
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background 0.2s, transform 0.15s;
    font-family: 'Sora', system-ui, sans-serif;
  }
  .ac-btn:hover { background: #1e293b; }
  .ac-btn:active { transform: scale(0.99); }
  .ac-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ac-btn .arr { transition: transform 0.2s; }
  .ac-btn:hover .arr { transform: translateX(3px); }

  .ac-btn-role {
    width: 100%; background: #0f172a; color: #fff;
    border: none; border-radius: 10px; padding: 13px 20px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background 0.2s, opacity 0.2s, transform 0.15s;
    font-family: 'Sora', system-ui, sans-serif;
  }
  .ac-btn-role:hover:not(:disabled) { background: #1e293b; }
  .ac-btn-role:active:not(:disabled) { transform: scale(0.99); }
  .ac-btn-role:disabled { opacity: 0.55; cursor: not-allowed; background: #94a3b8; }

  .ac-ghost {
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 12px; font-weight: 500; color: #64748b;
    transition: color 0.2s, background 0.2s; padding: 8px 12px; border-radius: 10px;
    font-family: 'DM Sans', system-ui, sans-serif; width: 100%; margin-top: 10px;
  }
  .ac-ghost:hover { color: #0f172a; background: rgba(15, 23, 42, 0.04); }
  .ac-ghost.danger:hover { color: #b91c1c; background: rgba(185, 28, 28, 0.04); }

  .ac-footer, .as-footer {
    margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(15, 23, 42, 0.06);
    font-size: 11px; color: #94a3b8;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  .ac-toast {
    position: fixed; top: 20px; left: 50%;
    transform: translateX(-50%) translateY(-12px);
    z-index: 999; display: flex; align-items: center; gap: 10px;
    padding: 11px 18px; border-radius: 12px;
    font-size: 13px; font-weight: 600;
    border: 1px solid;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s, transform 0.35s;
    white-space: nowrap; font-family: 'DM Sans', system-ui, sans-serif;
    background: #fff;
  }
  .ac-toast.vis { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
  .ac-toast.error { border-color: #fecaca; color: #b91c1c; }
  .ac-toast.success { border-color: #bbf7d0; color: #047857; }

  .ac-warn {
    margin-top: 12px; padding: 10px 12px; border-radius: 10px;
    background: #fffbeb; border: 1px solid #fde68a;
    font-size: 12px; color: #92400e; text-align: left;
  }

  .as-bar-track {
    height: 4px; border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    overflow: hidden; position: relative;
  }
  .as-bar-fill {
    position: absolute; top: 0; bottom: 0; width: 36%;
    border-radius: inherit; background: #0f172a;
    animation: as-sweep 1.15s cubic-bezier(.45,.15,.35,.85) infinite;
  }
  @keyframes as-sweep {
    from { left: -40%; }
    to   { left: 104%; }
  }

  .as-status {
    margin-top: 14px; font-size: 12px; font-weight: 500; color: #94a3b8;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .as-status .spin { animation: pub-spin 0.8s linear infinite; }
  @keyframes pub-spin { to { transform: rotate(360deg); } }

  .as-actions { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
  .as-btn {
    appearance: none; border: none; cursor: pointer;
    border-radius: 10px; padding: 12px 16px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    transition: background 0.15s ease, transform 0.15s ease;
  }
  .as-btn:active { transform: scale(0.99); }
  .as-btn-primary { background: #0f172a; color: #fff; }
  .as-btn-primary:hover { background: #1e293b; }
  .as-btn-ghost {
    background: transparent; color: #64748b;
    border: 1px solid rgba(15, 23, 42, 0.1);
  }
  .as-btn-ghost:hover { background: rgba(15, 23, 42, 0.04); color: #0f172a; }

  .spin { animation: pub-spin 0.8s linear infinite; }

  .ac-avatar {
    width: 72px; height: 72px; border-radius: 50%;
    background: rgba(15, 23, 42, 0.06);
    border: 1px solid rgba(15, 23, 42, 0.1);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto;
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; color: #0f172a;
  }
  .ac-role-badge {
    background: #f8fafc;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 12px; padding: 12px 14px;
    display: flex; align-items: center; gap: 12px; margin-bottom: 4px;
    text-align: left;
  }

  @media (max-width: 480px) {
    .ac-card, .as-card { padding: 32px 22px 26px; border-radius: 14px; }
    .ac-logo, .as-logo { height: 48px; }
    .ac-clinica, .as-clinica { font-size: 18px; }
  }
`;
