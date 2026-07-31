// src/components/LocationSelector.jsx
// Selector de ubicación que se integra en el portal de login y el shell.
// - Médicos: seleccionan consultorio (la sucursal se infiere automáticamente)
// - Otros roles: seleccionan sucursal
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionLocation } from '../context/SessionLocationContext';

/* ── SVG Icons ── */
const IconMapPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>
  </svg>
);
const IconDoor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/>
  </svg>
);
const IconChevDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CSS = `
  .loc-selector { margin-top: 4px; margin-bottom: 4px; }
  .loc-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em; color: #94a3b8;
    margin-bottom: 8px; padding-left: 1px;
  }
  .loc-dropdown-wrap { position: relative; }
  .loc-trigger {
    width: 100%; background: #fff; border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 10px; padding: 11px 36px 11px 12px;
    font-size: 13px; font-weight: 500; color: #0f172a;
    cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    font-family: inherit; position: relative;
  }
  .loc-trigger:hover { border-color: rgba(15, 23, 42, 0.22); }
  .loc-trigger.open {
    border-color: #0f172a;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06);
  }
  .loc-trigger .loc-chev {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    color: #94a3b8; display: flex; transition: transform 0.2s ease;
  }
  .loc-trigger.open .loc-chev { transform: translateY(-50%) rotate(180deg); color: #0f172a; }
  .loc-trigger-placeholder { color: #94a3b8; font-weight: 500; }
  .loc-trigger-icon { color: #64748b; display: flex; flex-shrink: 0; }

  .loc-trigger-info {
    display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;
  }
  .loc-trigger-main { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loc-trigger-sub { font-size: 11px; font-weight: 500; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .loc-list {
    position: fixed;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    max-height: min(280px, 45vh);
    overflow-y: auto;
    overscroll-behavior: contain;
    z-index: 9999;
    padding: 4px 0;
    -webkit-overflow-scrolling: touch;
  }
  .loc-list.inline {
    position: absolute;
    top: auto;
    bottom: calc(100% + 4px);
    left: 0;
    right: 0;
    width: auto !important;
    z-index: 30;
    max-height: min(280px, 40vh);
  }
  .loc-list::-webkit-scrollbar { width: 4px; }
  .loc-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }

  .loc-group-label {
    font-size: 10px; font-weight: 600; color: #94a3b8;
    letter-spacing: 0.02em;
    padding: 8px 14px 4px;
    display: flex; align-items: center; gap: 6px;
  }

  .loc-opt {
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 10px 14px;
    border-radius: 0;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: background 0.15s ease;
    font-family: inherit;
  }
  .loc-opt:hover { background: rgba(15, 23, 42, 0.04); }
  .loc-opt.selected { background: rgba(15, 23, 42, 0.06); }
  .loc-opt-icon {
    width: 18px; height: 18px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: #94a3b8;
    background: none;
  }
  .loc-opt.selected .loc-opt-icon { color: #0f172a; }
  .loc-opt-text { flex: 1; min-width: 0; }
  .loc-opt-name {
    font-size: 13px; font-weight: 600; color: #0f172a;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .loc-opt-detail {
    font-size: 11px; font-weight: 500; color: #94a3b8; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .loc-opt-check {
    width: 16px; height: 16px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: transparent;
    background: none;
  }
  .loc-opt.selected .loc-opt-check { color: #0f172a; }

  .loc-confirmed-badge {
    display: flex; align-items: center; gap: 6px;
    margin-top: 8px;
    font-size: 11px; font-weight: 600; color: #166534;
  }
  .loc-hint {
    margin-top: 8px;
    font-size: 11px;
    font-weight: 500;
    color: #b45309;
  }
  .loc-confirm-btn {
    margin-top: 10px;
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 11px 14px;
    background: #0f172a;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .loc-confirm-btn:hover { background: #1e293b; }
  .loc-confirm-btn:active { transform: scale(0.99); }
`;

const LocationSelector = ({ accentColor = '#0f172a', required = false, inlineMenu = false, onOpenChange }) => {
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (inlineMenu) {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setIsOpen(false);
        return;
      }
      const dropdownEl = document.getElementById('loc-dropdown-portal');
      const isOutsideTrigger = wrapRef.current && !wrapRef.current.contains(e.target);
      const isOutsideDropdown = dropdownEl ? !dropdownEl.contains(e.target) : true;
      if (isOutsideTrigger && isOutsideDropdown) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);

    if (!inlineMenu) {
      const onScrollOrResize = (e) => {
        const dropdownEl = document.getElementById('loc-dropdown-portal');
        // No cerrar al hacer scroll DENTRO del propio listado
        if (e?.type === 'scroll' && dropdownEl && (e.target === dropdownEl || dropdownEl.contains(e.target))) {
          return;
        }
        setIsOpen(false);
      };
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      return () => {
        document.removeEventListener('mousedown', handler);
        window.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
      };
    }

    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, inlineMenu]);

  useEffect(() => {
    onOpenChangeRef.current?.(isOpen);
    return () => { onOpenChangeRef.current?.(false); };
  }, [isOpen]);

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

  const handleConfirmCurrent = () => {
    if (isDoctorRole && sessionConsultorio?.id) {
      confirmLocation({ consultorioId: sessionConsultorio.id });
      return;
    }
    if (!isDoctorRole && sessionSucursal?.id) {
      confirmLocation({ sucursalId: sessionSucursal.id });
    }
  };

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setDropdownPos({
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        width: Math.max(rect.width, 220),
        maxHeight,
      });
    }
    setIsOpen(!isOpen);
  };

  const selectedLabel = isDoctorRole
    ? (sessionConsultorio?.nombre || null)
    : (sessionSucursal?.nombre || null);

  const selectedSub = isDoctorRole && sessionConsultorio
    ? (catalogoSucursales.find((s) => s.id === sessionConsultorio.sucursalId)?.nombre || sessionConsultorio.sucursal || '')
    : (sessionSucursal?.ubicacion || null);

  const labelText = isDoctorRole ? 'Consultorio de trabajo' : 'Sucursal de trabajo';
  const placeholderText = isDoctorRole ? 'Selecciona tu consultorio...' : 'Selecciona tu sucursal...';
  const LabelIcon = isDoctorRole ? IconDoor : IconBuilding;

  const menuContent = (
    <>
      {isDoctorRole ? (
        consultoriosGrouped.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
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
                    role="option"
                    aria-selected={isSelected}
                    className={'loc-opt' + (isSelected ? ' selected' : '')}
                    onClick={() => handleSelect(c)}
                  >
                    <div className="loc-opt-icon"><IconDoor /></div>
                    <div className="loc-opt-text">
                      <div className="loc-opt-name">{c.nombre}</div>
                      <div className="loc-opt-detail">
                        {c.ubicacion || c.especialidad || 'Sin ubicación'}
                      </div>
                    </div>
                    <div className="loc-opt-check"><IconCheck /></div>
                  </button>
                );
              })}
            </div>
          ))
        )
      ) : (
        catalogoSucursales.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            No hay sucursales activas
          </div>
        ) : (
          catalogoSucursales.map((s) => {
            const isSelected = sessionSucursal?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={'loc-opt' + (isSelected ? ' selected' : '')}
                onClick={() => handleSelect(s)}
              >
                <div className="loc-opt-icon"><IconBuilding /></div>
                <div className="loc-opt-text">
                  <div className="loc-opt-name">{s.nombre}</div>
                  <div className="loc-opt-detail">
                    {s.ubicacion || s.telefono || 'Sin ubicación'}
                  </div>
                </div>
                <div className="loc-opt-check"><IconCheck /></div>
              </button>
            );
          })
        )
      )}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="loc-selector">
        <div className="loc-label" style={{ color: accentColor === '#2563eb' ? '#94a3b8' : undefined }}>
          <IconMapPin />
          {labelText}
          {required && !locationConfirmed && <span style={{ color: '#b45309' }}>· obligatorio</span>}
        </div>
        <div className="loc-dropdown-wrap" ref={wrapRef}>
          <button
            type="button"
            ref={triggerRef}
            className={'loc-trigger' + (isOpen ? ' open' : '')}
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <span className="loc-trigger-icon"><LabelIcon /></span>
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

          {isOpen && (
            inlineMenu ? (
              <div className="loc-list inline" role="listbox">
                {menuContent}
              </div>
            ) : createPortal(
              <div
                id="loc-dropdown-portal"
                className="loc-list"
                role="listbox"
                style={{
                  top: dropdownPos.top,
                  bottom: dropdownPos.bottom,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  maxHeight: dropdownPos.maxHeight,
                }}
              >
                {menuContent}
              </div>,
              document.body
            )
          )}
        </div>

        {locationConfirmed && selectedLabel ? (
          <div className="loc-confirmed-badge">
            <IconCheck /> Ubicación confirmada
          </div>
        ) : required ? (
          <>
            {selectedLabel ? (
              <button type="button" className="loc-confirm-btn" onClick={handleConfirmCurrent}>
                Confirmar {isDoctorRole ? 'consultorio' : 'sucursal'}
              </button>
            ) : (
              <div className="loc-hint">Debes elegir tu ubicación para continuar</div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
};

export default LocationSelector;
