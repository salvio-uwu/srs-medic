import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Pill, ChevronDown, ChevronUp, ShieldAlert, Info } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

/* ─── ESTILOS DEL MODAL (Design System: Clinical Cerulean) ─── */
const MODAL_STYLES = `
  .cat-overlay {
    position: fixed; inset: 0; z-index: 100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .cat-backdrop {
    position: absolute; inset: 0;
    background: rgba(15,23,42,.55); backdrop-filter: blur(6px);
  }
  .cat-modal {
    position: relative; background: white;
    border-radius: 16px; box-shadow: 0 20px 60px rgba(15,23,42,.18);
    width: 100%; max-width: 960px; height: 82vh;
    display: flex; flex-direction: column; overflow: hidden;
    border: 1px solid rgba(226,232,240,.8);
    animation: cat-in .2s ease;
  }
  @keyframes cat-in {
    from { opacity: 0; transform: scale(.97) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* Header */
  .cat-header {
    padding: 20px 28px; border-bottom: 1px solid #f1f5f9;
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
  }
  .cat-header-left { display: flex; align-items: center; gap: 12px; }
  .cat-header-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg, #2998C6, #005B8E);
    display: flex; align-items: center; justify-content: center;
    color: white; box-shadow: 0 2px 8px rgba(0,119,182,.2);
    flex-shrink: 0;
  }
  .cat-title {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700;
    color: #0f172a; line-height: 1.2;
  }
  .cat-subtitle { font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px; }
  .cat-close {
    width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0;
    background: white; display: flex; align-items: center; justify-content: center;
    color: #94a3b8; cursor: pointer; transition: all .15s;
  }
  .cat-close:hover { color: #e11d48; border-color: #fecdd3; background: #fff1f2; }

  /* Search */
  .cat-search-bar { padding: 14px 28px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
  .cat-search-wrap { position: relative; }
  .cat-search-icon {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    color: #94a3b8; pointer-events: none;
  }
  .cat-search {
    width: 100%; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 10px 14px 10px 40px;
    font-size: 13px; font-weight: 500; color: #334155;
    font-family: inherit; outline: none; transition: all .18s;
  }
  .cat-search:focus { background: white; border-color: #8CCAE4; box-shadow: 0 0 0 3px rgba(41,152,198,.1); }
  .cat-search-clear {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    width: 22px; height: 22px; border-radius: 6px; border: none;
    background: #e2e8f0; color: #64748b; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .12s;
  }
  .cat-search-clear:hover { background: #cbd5e1; }

  /* Counter */
  .cat-counter {
    padding: 8px 28px; font-size: 11px; font-weight: 600;
    color: #94a3b8; border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  }
  .cat-counter strong { color: #334155; }

  /* Table */
  .cat-body { flex: 1; overflow-y: auto; }
  .cat-body::-webkit-scrollbar { width: 6px; }
  .cat-body::-webkit-scrollbar-track { background: transparent; }
  .cat-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
  .cat-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  .cat-table { width: 100%; border-collapse: collapse; }
  .cat-table thead { position: sticky; top: 0; z-index: 5; }
  .cat-table th {
    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    padding: 10px 16px; text-align: left;
    font-size: 9px; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: .08em;
    white-space: nowrap;
  }
  .cat-table th:first-child { padding-left: 28px; }
  .cat-table td {
    padding: 12px 16px; border-bottom: 1px solid #f1f5f9;
    font-size: 12px; color: #475569; vertical-align: top;
  }
  .cat-table td:first-child { padding-left: 28px; }
  .cat-table tr { transition: background .12s; }
  .cat-table tbody tr:hover { background: #F2F8FB; }
  .cat-table tbody tr.cat-row-expanded { background: #F2F8FB; }

  /* Cell styles */
  .cat-med-name {
    font-weight: 700; color: #1e293b; font-size: 12px;
    display: flex; align-items: center; gap: 6px;
  }
  .cat-med-sa { font-size: 10px; color: #64748b; font-weight: 500; margin-top: 3px; line-height: 1.3; }
  .cat-badge-ctrl {
    display: inline-flex; align-items: center; gap: 3px;
    background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48;
    font-size: 8px; font-weight: 800; padding: 2px 6px;
    border-radius: 4px; text-transform: uppercase; letter-spacing: .05em;
    flex-shrink: 0;
  }
  .cat-color-dot {
    width: 10px; height: 10px; border-radius: 4px;
    flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,.15);
  }

  /* Expanded row */
  .cat-expand-btn {
    width: 24px; height: 24px; border-radius: 6px; border: 1px solid #e2e8f0;
    background: white; display: flex; align-items: center; justify-content: center;
    color: #94a3b8; cursor: pointer; transition: all .15s; flex-shrink: 0;
  }
  .cat-expand-btn:hover { border-color: #8CCAE4; color: #0077B6; background: #F2F8FB; }
  .cat-expand-btn.open { border-color: #BCE0EF; color: #0077B6; background: #DFF0F7; }

  .cat-detail-row td { padding: 0 !important; border-bottom: 1px solid #e2e8f0; }
  .cat-detail-inner {
    padding: 14px 28px 18px; background: #f8fafc;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;
  }
  .cat-detail-item {}
  .cat-detail-label {
    font-size: 9px; font-weight: 800; color: #94a3b8;
    text-transform: uppercase; letter-spacing: .08em; margin-bottom: 3px;
  }
  .cat-detail-value { font-size: 12px; color: #334155; font-weight: 500; line-height: 1.4; }
  .cat-detail-value.warn { color: #e11d48; }

  /* Empty */
  .cat-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 260px; gap: 10px; color: #94a3b8;
  }
  .cat-empty-icon {
    width: 56px; height: 56px; border-radius: 16px;
    background: #f8fafc; border: 1px solid #f1f5f9;
    display: flex; align-items: center; justify-content: center;
    color: #cbd5e1;
  }
  .cat-empty-text { font-size: 13px; font-weight: 600; color: #64748b; }
`;


const ModalCatalogoMedicamentos = ({ onClose }) => {
  const [medicamentos, setMedicamentos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'catalogo_medicamentos'), orderBy('nombreComercial', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMedicamentos(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return medicamentos.filter(m => {
      if (m.activo === false) return false;
      return !term || `${m.nombreComercial || ''} ${m.sustanciasActivas || ''} ${m.marca || ''} ${m.laboratorio || ''} ${m.indicacion || ''}`
        .toLowerCase().includes(term);
    });
  }, [medicamentos, searchTerm]);

  const totalActivos = medicamentos.filter(m => m.activo !== false).length;

  return (
    <>
      <style>{MODAL_STYLES}</style>
      <div className="cat-overlay">
        <div className="cat-backdrop" onClick={onClose} />
        <div className="cat-modal">

          {/* Header */}
          <div className="cat-header">
            <div className="cat-header-left">
              <div className="cat-header-icon"><Pill size={20}/></div>
              <div>
                <div className="cat-title">Catálogo de Medicamentos</div>
                <div className="cat-subtitle">Consulta de medicamentos registrados en el sistema</div>
              </div>
            </div>
            <button className="cat-close" onClick={onClose}><X size={16}/></button>
          </div>

          {/* Search */}
          <div className="cat-search-bar">
            <div className="cat-search-wrap">
              <Search size={16} className="cat-search-icon" />
              <input
                type="text"
                className="cat-search"
                placeholder="Buscar por nombre, sustancia activa, marca o laboratorio..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button className="cat-search-clear" onClick={() => setSearchTerm('')}>
                  <X size={12}/>
                </button>
              )}
            </div>
          </div>

          {/* Counter */}
          <div className="cat-counter">
            <span><strong>{filtered.length}</strong> medicamento{filtered.length !== 1 ? 's' : ''}{searchTerm ? ` encontrado${filtered.length !== 1 ? 's' : ''}` : ''}</span>
            <span>{totalActivos} en catálogo</span>
          </div>

          {/* Table body */}
          <div className="cat-body">
            {loading ? (
              <div className="cat-empty">
                <div className="cat-empty-icon"><Pill size={24}/></div>
                <div className="cat-empty-text">Cargando catálogo...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="cat-empty">
                <div className="cat-empty-icon"><Search size={24}/></div>
                <div className="cat-empty-text">No se encontraron medicamentos</div>
              </div>
            ) : (
              <table className="cat-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Medicamento</th>
                    <th>Presentación</th>
                    <th>Dosis</th>
                    <th>Laboratorio</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(med => {
                    const isOpen = expandedId === med.id;
                    return (
                      <React.Fragment key={med.id}>
                        <tr className={isOpen ? 'cat-row-expanded' : ''} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : med.id)}>
                          <td style={{ width: 28, paddingRight: 0 }}>
                            <div className="cat-color-dot" style={{ background: med.color || '#0077B6' }} />
                          </td>
                          <td>
                            <div className="cat-med-name">
                              {med.nombreComercial}
                              {med.controlado && <span className="cat-badge-ctrl"><ShieldAlert size={8}/> Ctrl</span>}
                            </div>
                            <div className="cat-med-sa">{med.sustanciasActivas || '—'}</div>
                          </td>
                          <td>{med.presentacion || '—'}</td>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{med.dosis || '—'}</td>
                          <td>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{med.marca || '—'}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{med.laboratorio || ''}</div>
                          </td>
                          <td>
                            <button className={`cat-expand-btn ${isOpen ? 'open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedId(isOpen ? null : med.id); }}>
                              {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="cat-detail-row">
                            <td colSpan={6}>
                              <div className="cat-detail-inner">
                                <div className="cat-detail-item">
                                  <div className="cat-detail-label">Indicación</div>
                                  <div className="cat-detail-value">{med.indicacion || 'No especificada'}</div>
                                </div>
                                <div className="cat-detail-item">
                                  <div className="cat-detail-label">N° de Acomodo</div>
                                  <div className="cat-detail-value">{med.numeroAcomodo || '—'}</div>
                                </div>
                                <div className="cat-detail-item">
                                  <div className="cat-detail-label">Advertencia</div>
                                  <div className="cat-detail-value warn">{med.advertencia || 'Ninguna'}</div>
                                </div>
                                <div className="cat-detail-item">
                                  <div className="cat-detail-label">Riesgo en Embarazo</div>
                                  <div className="cat-detail-value warn">{med.embarazo || 'No especificado'}</div>
                                </div>
                                {med.opcion2 && (
                                  <div className="cat-detail-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="cat-detail-label">Información adicional</div>
                                    <div className="cat-detail-value">{med.opcion2}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default ModalCatalogoMedicamentos;
