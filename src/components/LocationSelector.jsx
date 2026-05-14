// src/components/LocationSelector.jsx
// Selector de ubicación que se integra en el portal de login.
// - Médicos: seleccionan consultorio (la sucursal se infiere automáticamente)
// - Otros roles: seleccionan sucursal
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionLocation } from '../context/SessionLocationContext';

/* ── SVG Icons ── */
const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>
  </svg>
);
const IconDoor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/>
  </svg>
);
const IconChevDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CSS = `
  .loc-selector { margin-top: 12px; margin-bottom: 6px; }
  .loc-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    margin-bottom: 8px; padding-left: 2px;
  }
  .loc-dropdown-wrap { position: relative; }
  .loc-trigger {
    width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 13px; padding: 12px 40px 12px 14px;
    font-size: 13px; font-weight: 600; color: #0f172a;
    cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    font-family: 'Inter', sans-serif; position: relative;
  }
  .loc-trigger:hover { border-color: #94a3b8; }
  .loc-trigger.open { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,0.10); }
  .loc-trigger .loc-chev {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    color: #94a3b8; display: flex; transition: transform 0.2s;
  }
  .loc-trigger.open .loc-chev { transform: translateY(-50%) rotate(180deg); }
  .loc-trigger-placeholder { color: #94a3b8; font-weight: 500; }

  .loc-trigger-info {
    display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;
  }
  .loc-trigger-main { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loc-trigger-sub { font-size: 10px; font-weight: 600; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .loc-list {
    position: fixed;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
    box-shadow: 0 16px 40px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.06);
    max-height: 240px; overflow-y: auto; z-index: 9999; padding: 6px;
  }
  .loc-list::-webkit-scrollbar { width: 5px; }
  .loc-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }

  .loc-group-label {
    font-size: 9px; font-weight: 700; color: #94a3b8;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 8px 10px 4px; display: flex; align-items: center; gap: 5px;
  }

  .loc-opt {
    width: 100%; background: transparent; border: none; cursor: pointer;
    padding: 10px 12px; border-radius: 10px; text-align: left;
    display: flex; align-items: center; gap: 10px;
    transition: background 0.12s;
    font-family: 'Inter', sans-serif;
  }
  .loc-opt:hover { background: #f1f5f9; }
  .loc-opt.selected { background: #eff6ff; }
  .loc-opt-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .loc-opt-text { flex: 1; min-width: 0; }
  .loc-opt-name { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loc-opt-detail { font-size: 10px; font-weight: 500; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loc-opt-check {
    width: 20px; height: 20px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .loc-confirmed-badge {
    display: flex; align-items: center; gap: 6px;
    background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
    padding: 8px 14px; margin-top: 8px;
    font-size: 11px; font-weight: 600; color: #166534;
  }
`;

const LocationSelector = ({ accentColor = '#2563eb' }) => {
  const {
    isDoctorRole,
    catalogoSucursales,
    catalogoConsultorios,
    sessionSucursal,
    sessionConsultorio,
    locationConfirmed,
    confirmLocation
  } = useSessionLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      // Check if click is outside trigger AND outside the dropdown itself
      const dropdownEl = document.getElementById('loc-dropdown-portal');
      const isOutsideTrigger = wrapRef.current && !wrapRef.current.contains(e.target);
      const isOutsideDropdown = dropdownEl && !dropdownEl.contains(e.target);
      
      if (isOutsideTrigger && isOutsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // ── Para médicos: consultorios agrupados por sucursal ──
  const consultoriosGrouped = useMemo(() => {
    if (!isDoctorRole) return [];
    const groups = {};
    catalogoConsultorios.forEach((c) => {
      const sucId = c.sucursalId || 'sin-sucursal';
      const sucNombre = catalogoSucursales.find((s) => s.id === sucId)?.nombre || c.sucursal || 'Sin sucursal';
      if (!groups[sucId]) groups[sucId] = { sucursalId: sucId, sucursalNombre: sucNombre, items: [] };
      groups[sucId].items.push(c);
    });
    return Object.values(groups);
  }, [isDoctorRole, catalogoConsultorios, catalogoSucursales]);

  const handleSelect = (option) => {
    if (isDoctorRole) {
      confirmLocation({ consultorioId: option.id });
    } else {
      confirmLocation({ sucursalId: option.id });
    }
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  const selectedLabel = isDoctorRole
    ? (sessionConsultorio?.nombre || null)
    : (sessionSucursal?.nombre || null);

  const selectedSub = isDoctorRole && sessionConsultorio
    ? (catalogoSucursales.find((s) => s.id === sessionConsultorio.sucursalId)?.nombre || sessionConsultorio.sucursal || '')
    : null;

  const labelText = isDoctorRole ? 'Consultorio de trabajo' : 'Sucursal de trabajo';
  const placeholderText = isDoctorRole ? 'Selecciona tu consultorio...' : 'Selecciona tu sucursal...';
  const LabelIcon = isDoctorRole ? IconDoor : IconBuilding;

  return (
    <>
      <style>{CSS}</style>
      <div className="loc-selector">
        <div className="loc-label" style={{ color: accentColor }}>
          <IconMapPin />
          {labelText}
        </div>
        <div className="loc-dropdown-wrap" ref={wrapRef}>
          <button
            type="button"
            ref={triggerRef}
            className={'loc-trigger' + (isOpen ? ' open' : '')}
            onClick={handleToggle}
          >
            <LabelIcon />
            {selectedLabel ? (
              <div className="loc-trigger-info">
                <div className="loc-trigger-main">{selectedLabel}</div>
                {selectedSub && <div className="loc-trigger-sub">{selectedSub}</div>}
              </div>
            ) : (
              <span className="loc-trigger-placeholder">{placeholderText}</span>
            )}
            <span className="loc-chev"><IconChevDown /></span>
          </button>

          {isOpen && createPortal(
            <div id="loc-dropdown-portal" className="loc-list" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
              {isDoctorRole ? (
                // ── Consultorios agrupados por sucursal ──
                consultoriosGrouped.length === 0 ? (
                  <div style={{ padding: '16px 12px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No hay consultorios activos
                  </div>
                ) : (
                  consultoriosGrouped.map((group) => (
                    <div key={group.sucursalId}>
                      <div className="loc-group-label">
                        <IconBuilding /> {group.sucursalNombre}
                      </div>
                      {group.items.map((c) => {
                        const isSelected = sessionConsultorio?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={'loc-opt' + (isSelected ? ' selected' : '')}
                            onClick={() => handleSelect(c)}
                          >
                            <div className="loc-opt-icon" style={{
                              background: isSelected ? `${accentColor}15` : '#f1f5f9',
                              color: isSelected ? accentColor : '#64748b'
                            }}>
                              <IconDoor />
                            </div>
                            <div className="loc-opt-text">
                              <div className="loc-opt-name">{c.nombre}</div>
                              <div className="loc-opt-detail">
                                {c.ubicacion || c.especialidad || 'Sin ubicación'}
                              </div>
                            </div>
                            <div className="loc-opt-check" style={{
                              background: isSelected ? accentColor : 'transparent',
                              color: isSelected ? '#fff' : 'transparent'
                            }}>
                              <IconCheck />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )
              ) : (
                // ── Sucursales ──
                catalogoSucursales.length === 0 ? (
                  <div style={{ padding: '16px 12px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No hay sucursales activas
                  </div>
                ) : (
                  catalogoSucursales.map((s) => {
                    const isSelected = sessionSucursal?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={'loc-opt' + (isSelected ? ' selected' : '')}
                        onClick={() => handleSelect(s)}
                      >
                        <div className="loc-opt-icon" style={{
                          background: isSelected ? `${accentColor}15` : '#f1f5f9',
                          color: isSelected ? accentColor : '#64748b'
                        }}>
                          <IconBuilding />
                        </div>
                        <div className="loc-opt-text">
                          <div className="loc-opt-name">{s.nombre}</div>
                          <div className="loc-opt-detail">
                            {s.ubicacion || s.telefono || 'Sin ubicación'}
                          </div>
                        </div>
                        <div className="loc-opt-check" style={{
                          background: isSelected ? accentColor : 'transparent',
                          color: isSelected ? '#fff' : 'transparent'
                        }}>
                          <IconCheck />
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>,
            document.body
          )}
        </div>

        {locationConfirmed && selectedLabel && (
          <div className="loc-confirmed-badge">
            <IconCheck /> Ubicación confirmada
          </div>
        )}
      </div>
    </>
  );
};

export default LocationSelector;
