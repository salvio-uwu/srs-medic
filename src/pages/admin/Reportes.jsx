import React from 'react';
import { BarChart3 } from 'lucide-react';
import ReporteSuive from './ReporteSuive';

const STYLES = `
  .rp { font-family: 'DM Sans', system-ui, sans-serif; padding: 24px; max-width: 1440px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
  .rp-hd { margin-bottom: 22px; }
  .rp-hd h1 { font-family: 'Sora', sans-serif; font-size: 1.35rem; font-weight: 700; color: #0f172a; margin: 0 0 3px; display: flex; align-items: center; gap: 10px; }
  .rp-hd p { font-size: .8rem; color: #64748b; margin: 0; }
  @media (max-width: 768px) { .rp { padding: 14px; } }
`;

const Reportes = () => {
  return (
    <div className="rp">
      <style>{STYLES}</style>

      {/* Page Header */}
      <div className="rp-hd">
        <h1><BarChart3 size={22} color="#0077B6" /> Reportes</h1>
        <p>Generación y exportación de reportes clínicos y administrativos</p>
      </div>

      <ReporteSuive />
    </div>
  );
};

export default Reportes;
