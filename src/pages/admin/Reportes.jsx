import React, { useState } from 'react';
import { BarChart3, Stethoscope, FileText, ChevronRight } from 'lucide-react';
import ReporteSuive from './ReporteSuive';

const STYLES = `
  .rp { font-family: 'DM Sans', system-ui, sans-serif; padding: 20px; max-width: 1440px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
  .rp-hd { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .rp-hd-l h1 { font-family: 'Sora', sans-serif; font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px; }
  .rp-hd-l p { font-size: .72rem; color: #64748b; margin: 2px 0 0; }

  .rp-tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 0; }
  .rp-tab { display: flex; align-items: center; gap: 7px; padding: 8px 14px; border: 0; border-radius: 8px 8px 0 0; font-size: .76rem; font-weight: 600; cursor: pointer; transition: all .15s; font-family: inherit; color: #64748b; background: transparent; position: relative; margin-bottom: -1px; }
  .rp-tab svg { flex-shrink: 0; }
  .rp-tab:hover { color: #334155; background: #f1f5f9; }
  .rp-tab.active { color: #0077B6; background: #fff; border: 1px solid #e2e8f0; border-bottom-color: #fff; }
  .rp-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #0077B6; border-radius: 1px; }

  .rp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .rp-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 12px; }
  .rp-card:hover { border-color: #0077B6; box-shadow: 0 2px 8px rgba(0,119,182,.08); }
  .rp-card-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rp-card-info { flex: 1; min-width: 0; }
  .rp-card-info h3 { font-size: .78rem; font-weight: 600; color: #0f172a; margin: 0 0 2px; }
  .rp-card-info p { font-size: .66rem; color: #94a3b8; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rp-card-arrow { color: #cbd5e1; flex-shrink: 0; }

  .rp-content { animation: rpFadeIn .2s ease; }
  @keyframes rpFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 768px) {
    .rp { padding: 10px; }
    .rp-cards { grid-template-columns: 1fr; }
    .rp-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .rp-tab { white-space: nowrap; }
  }
`;

const REPORTES = [
  {
    id: 'suive',
    label: 'Reporte SUIVE',
    desc: 'Vigilancia epidemiológica · Matriz de morbilidad CIE-10',
    icon: <Stethoscope size={18} />,
    color: '#0077B6',
    bg: '#eff6ff',
    component: ReporteSuive,
  },
  // Placeholder para futuros reportes
  // { id: 'financiero', label: 'Reporte Financiero', desc: 'Ingresos, egresos y productividad', icon: <DollarSign size={18} />, color: '#059669', bg: '#ecfdf5', component: null },
  // { id: 'operativo', label: 'Reporte Operativo', desc: 'Citas, ocupación y tiempos de espera', icon: <Clock size={18} />, color: '#d97706', bg: '#fffbeb', component: null },
];

const Reportes = () => {
  const [activeTab, setActiveTab] = useState('suive');

  const activeReport = REPORTES.find((r) => r.id === activeTab);
  const ActiveComponent = activeReport?.component;

  return (
    <div className="rp">
      <style>{STYLES}</style>

      <div className="rp-hd">
        <div className="rp-hd-l">
          <h1><BarChart3 size={20} color="#0077B6" /> Reportes</h1>
          <p>Generación y exportación de reportes clínicos y administrativos</p>
        </div>
      </div>

      <div className="rp-tabs">
        {REPORTES.map((r) => (
          <button
            key={r.id}
            className={`rp-tab ${activeTab === r.id ? 'active' : ''}`}
            onClick={() => setActiveTab(r.id)}
          >
            {r.icon}
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      <div className="rp-content">
        {ActiveComponent ? <ActiveComponent /> : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            Reporte en desarrollo
          </div>
        )}
      </div>
    </div>
  );
};

export default Reportes;
