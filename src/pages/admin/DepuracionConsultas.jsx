// src/pages/admin/DepuracionConsultas.jsx
//
// Vista de Auditoria de Duplicados. Reemplaza la antigua DepuracionConsultas.
// Mantiene el nombre del componente y el path /admin/depuracion para no romper rutas.
//
// 3 pestanas:
//   1. Pacientes  -> Detecta y fusiona pacientes duplicados (primary = mas antiguo, merge fisico).
//   2. Consultas  -> Detecta consultas duplicadas (por citaId o pacienteId+fecha) y vacias.
//   3. Huerfanos  -> Registros que apuntan a un pacienteId fusionado o inexistente.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldAlert,
  UserCheck,
  ClipboardList,
  Users,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Download,
  Trash2,
  GitMerge,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Hash,
  Star,
  ArrowRight,
  Eye,
  Sparkles,
  Activity,
  Link2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPatientDisplayName } from '../../utils/patientName';
import {
  loadAllPatients,
  buildDuplicateGroups,
  countChildDocs,
  mergePatients,
  scanConsultasDuplicates,
  unificarConsultas,
  eliminarConsultas,
  scanHuerfanos,
  repararHuerfanos,
  eliminarHuerfanosSinDestino,
  exportDuplicatesToCsv,
  MATCH_TYPES,
  PATIENT_LINKED_COLLECTIONS
} from '../../services/patientMergeService';
import useIsMobile from '../../hooks/useIsMobile';

// ─── Helpers UI ────────────────────────────────────────────────────────

const formatDate = (value) => {
  if (!value) return '—';
  try {
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString('es-MX');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX');
  } catch {
    return '—';
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString('es-MX');
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX');
  } catch {
    return '—';
  }
};

// Badges de tipo de coincidencia
const TYPE_BADGES = {
  curp:        '#111',
  idPaciente:  '#4b5563',
  idMigrado:   '#4b5563',
  phone:       '#4b5563',
  name_birth:  '#4b5563',
  fuzzy:       '#4b5563',
  phone_name:  '#4b5563'
};

// Campos que la UI permite cambiar entre primario y duplicado al consolidar.
const MERGE_FIELDS = [
  { id: 'curp', label: 'CURP', icon: CreditCard },
  { id: 'telefonoMovil', label: 'Teléfono móvil', icon: Phone },
  { id: 'telefonoFijo', label: 'Teléfono fijo', icon: Phone },
  { id: 'email', label: 'Correo', icon: Mail },
  { id: 'fechaNacimiento', label: 'Fecha de nacimiento', icon: Calendar },
  { id: 'sexo', label: 'Sexo', icon: UserCheck },
  { id: 'grupoSanguineo', label: 'Grupo sanguíneo', icon: Activity },
  { id: 'nombre', label: 'Nombre(s)', icon: UserCheck },
  { id: 'apellidoPaterno', label: 'Apellido paterno', icon: UserCheck },
  { id: 'apellidoMaterno', label: 'Apellido materno', icon: UserCheck },
  { id: 'calleNumero', label: 'Calle y número', icon: MapPin },
  { id: 'colonia', label: 'Colonia', icon: MapPin },
  { id: 'cp', label: 'CP', icon: MapPin },
  { id: 'municipioEstado', label: 'Municipio/Estado', icon: MapPin },
  { id: 'derechohabiente', label: 'Derechohabiencia', icon: Hash },
  { id: 'aseguradora', label: 'Aseguradora', icon: Hash },
  { id: 'empresa', label: 'Empresa', icon: Hash },
  { id: 'escolaridad', label: 'Escolaridad', icon: Hash },
  { id: 'notasPersonales', label: 'Notas personales', icon: ClipboardList }
];

// ─── Componente Principal ──────────────────────────────────────────────

const DepuracionConsultas = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('pacientes');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [kpiStats, setKpiStats] = useState(null); // cada tab reporta sus stats aqui

  const showToast = useCallback((msg, type = 'success', duration = 4500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f8f9fa' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, maxWidth: 560, width: '92vw' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff', color: '#111',
            fontSize: 13, fontWeight: 600, lineHeight: 1.4,
          }}>
            {toast.type === 'error' ? <AlertCircle size={18} style={{ color: '#111' }} />
              : toast.type === 'warning' ? <AlertTriangle size={18} style={{ color: '#111' }} />
              : <CheckCircle2 size={18} style={{ color: '#111' }} />}
            <span style={{ flex: 1 }}>{toast.msg}</span>
            <button onClick={() => setToast(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <Header tab={tab} onTabChange={setTab} isMobile={isMobile} kpiStats={kpiStats} />

      <div style={{ padding: isMobile ? '20px 16px 40px' : '30px 28px 48px' }}>
        {tab === 'pacientes' && <TabPacientes showToast={showToast} executedBy={user?.uid || user?.email || 'admin'} isMobile={isMobile} onStatsChange={setKpiStats} />}
        {tab === 'consultas' && <TabConsultas showToast={showToast} isMobile={isMobile} onStatsChange={setKpiStats} />}
        {tab === 'huerfanos' && <TabHuerfanos showToast={showToast} isMobile={isMobile} onStatsChange={setKpiStats} />}
      </div>
    </div>
  );
};

export default DepuracionConsultas;

const Header = ({ tab, onTabChange, isMobile, kpiStats }) => {
  const tabs = [
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'consultas', label: 'Consultas', icon: ClipboardList },
    { id: 'huerfanos', label: 'Huerfanos', icon: Link2 }
  ];

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ padding: isMobile ? '16px 16px 8px' : '18px 28px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={18} style={{ color: '#111' }} />
            </div>
            <div>
              <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>Auditoria de Duplicados</h1>
              {!isMobile && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Detecta y consolida pacientes, consultas y registros huerfanos en todo el expediente.
              </p>}
            </div>
          </div>

          {kpiStats && (
            <div style={{ display: 'flex', gap: isMobile ? 6 : 10, flexWrap: 'wrap', flexShrink: 0 }}>
              {kpiStats.map((s, i) => (
                <div key={i} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 6, padding: isMobile ? '6px 10px' : '8px 14px', textAlign: 'center', minWidth: isMobile ? 60 : 80 }}>
                  <p style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: isMobile ? 8 : 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', margin: '3px 0 0', whiteSpace: 'nowrap' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 1 }}>
          {tabs.map((t) => {
            const TabIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                style={{
                  padding: '10px 18px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  color: active ? '#111' : '#6b7280',
                  background: active ? '#f3f4f6' : 'transparent',
                  borderTopLeftRadius: 6, borderTopRightRadius: 6,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  position: 'relative',
                }}
              >
                <TabIcon size={15} />
                {t.label}
                {active && <span style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, borderRadius: '2px 2px 0 0', background: '#111' }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TAB 1: PACIENTES ─────────────────────────────────────────────────

const TabPacientes = ({ showToast, executedBy, isMobile, onStatsChange }) => {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [pacientes, setPacientes] = useState([]); // dataset crudo (sin merged)
  const [groups, setGroups] = useState([]);
  const [scanError, setScanError] = useState('');

  const [filters, setFilters] = useState({
    types: {
      name_birth: true,
      phone_name: true
    },
    search: ''
  });

  const [activeGroup, setActiveGroup] = useState(null); // {group, primaryId, duplicateId}

  // Recalcula grupos cada vez que cambian filtros (sin re-escanear Firestore).
  const filteredGroups = useMemo(() => {
    if (pacientes.length === 0) return [];
    const enabledTypes = Object.keys(filters.types).filter((k) => filters.types[k]);
    const recomputed = buildDuplicateGroups(pacientes, {
      types: enabledTypes
    });

    const q = filters.search.trim().toLowerCase();
    if (!q) return recomputed;
    return recomputed.filter((g) =>
      g.patients.some((px) => {
        const name = getPatientDisplayName(px).toLowerCase();
        const curp = (px.curp || '').toLowerCase();
        const idP = (px.idPaciente || '').toLowerCase();
        const tel = (px.telefonoMovil || '').toLowerCase();
        return name.includes(q) || curp.includes(q) || idP.includes(q) || tel.includes(q);
      })
    );
  }, [pacientes, filters]);

  useEffect(() => {
    setGroups(filteredGroups);
  }, [filteredGroups]);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setScanError('');
    setActiveGroup(null);
    setProgressMsg('Cargando directorio de pacientes...');
    try {
      const all = await loadAllPatients((n) => setProgressMsg(`Cargados ${n.toLocaleString()} pacientes...`));
      setPacientes(all);
      setProgressMsg('Analizando reglas de coincidencia...');
      setProgressMsg(`Listo. ${all.length.toLocaleString()} pacientes analizados.`);
      showToast(`Escaneo completado: ${all.length.toLocaleString()} pacientes analizados.`);
    } catch (err) {
      console.error(err);
      setScanError(`Error al escanear: ${err.message}`);
      showToast(`Error al escanear: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleExportCsv = useCallback(() => {
    if (groups.length === 0) {
      showToast('No hay grupos para exportar.', 'warning');
      return;
    }
    const csv = exportDuplicatesToCsv(groups);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_duplicados_pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado.');
  }, [groups, showToast]);

  const handleMergeDone = useCallback(
    async ({ duplicateId, counts }) => {
      const total = Object.values(counts || {}).reduce((acc, n) => acc + n, 0);
      showToast(`Fusión completa: ${total} docs migrados, duplicado eliminado.`);
      // Quitar localmente el duplicado del dataset para no reescanear.
      setPacientes((prev) => prev.filter((p) => p.id !== duplicateId));
      setActiveGroup(null);
    },
    [showToast]
  );

  // Stats agregadas
  const stats = useMemo(() => {
    const totalGrupos = groups.length;
    const totalPacientesDup = groups.reduce((acc, g) => acc + g.patients.length, 0);
    const totalDuplicadosPotenciales = groups.reduce((acc, g) => acc + g.candidates.length, 0);
    return { totalGrupos, totalPacientesDup, totalDuplicadosPotenciales };
  }, [groups]);

  // Reportar stats al header
  useEffect(() => {
    if (pacientes.length > 0 || stats.totalGrupos > 0) {
      onStatsChange([
        { label: 'Analizados', value: pacientes.length.toLocaleString() },
        { label: 'Grupos', value: stats.totalGrupos },
        { label: 'Duplicados', value: stats.totalDuplicadosPotenciales },
      ]);
    } else {
      onStatsChange(null);
    }
  }, [pacientes.length, stats.totalGrupos, stats.totalDuplicadosPotenciales, onStatsChange]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeGroup && !isMobile ? '7fr 5fr' : '1fr', gap: isMobile ? 12 : 20 }}>
      {/* Columna izquierda: filtros + lista */}
      <div>
          {/* Controles */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleScan}
                disabled={loading}
                style={{
                  border: '1px solid #111', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700,
                  color: '#fff', background: '#111', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                {loading ? 'Escaneando...' : 'Escanear pacientes'}
              </button>
              {progressMsg && !loading && <span style={{ fontSize: 11, color: '#6b7280' }}>{progressMsg}</span>}
              {loading && <span style={{ fontSize: 11, color: '#6b7280' }}>{progressMsg}</span>}
            </div>
            <button
              onClick={handleExportCsv}
              disabled={groups.length === 0}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 600, color: '#4b5563', background: '#fff', cursor: groups.length === 0 ? 'not-allowed' : 'pointer', opacity: groups.length === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={13} /> Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                Reglas de deteccion
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(MATCH_TYPES).map(([id, m]) => (
                  <button
                    key={id}
                    onClick={() => setFilters({ ...filters, types: { ...filters.types, [id]: !filters.types[id] } })}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '1px solid #d1d5db', cursor: 'pointer',
                      color: filters.types[id] ? '#fff' : '#6b7280',
                      background: filters.types[id] ? '#111' : '#fff',
                    }}
                    title={m.label}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                Buscar en resultados
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Nombre, CURP, ID, telefono..."
                  style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#111', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        </div>

        {scanError && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 20, background: '#fafafa' }}>
            <AlertCircle size={16} /> {scanError}
          </div>
        )}

        {/* Lista de grupos */}
        {!loading && pacientes.length === 0 && (
          <EmptyState
            icon={Search}
            title="Sin escanear todavia"
            message="Presiona Escanear pacientes para analizar la base completa y detectar duplicados con todas las reglas activas."
          />
        )}

        {!loading && pacientes.length > 0 && groups.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="No hay duplicados con los filtros actuales"
            message="Activa o desactiva reglas de deteccion para ampliar o reducir los resultados."
          />
        )}

        {groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map((group) => (
              <GroupCard
                key={group.key}
                group={group}
                activeKey={activeGroup?.group?.key}
                onOpen={(primaryId, duplicateId) => setActiveGroup({ group, primaryId, duplicateId })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Columna derecha: panel de comparación */}
      {activeGroup && (
        <div>
          <MergePanel
            key={`${activeGroup.primaryId}::${activeGroup.duplicateId}`}
            group={activeGroup.group}
            primaryId={activeGroup.primaryId}
            duplicateId={activeGroup.duplicateId}
            onClose={() => setActiveGroup(null)}
            onMerged={handleMergeDone}
            executedBy={executedBy}
            showToast={showToast}
          />
        </div>
      )}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon }) => {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
        {Icon && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={14} style={{ color: '#4b5563' }} />
          </div>
        )}
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: 0 }}>{value}</p>
    </div>
  );
};

const EmptyState = (props) => {
  const { icon: IconComp, title, message } = props;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <IconComp size={28} style={{ color: '#111' }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>{message}</p>
    </div>
  );
};

// ─── Group Card ──────────────────────────────────────────────────────

const GroupCard = ({ group, activeKey, onOpen }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
      ...(activeKey === group.key ? { border: '2px solid #111' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
        <button onClick={() => setExpanded((x) => !x)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
          {(group.types || [group.matchType]).map((t) => (
            <span key={t} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, color: '#4b5563', border: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {MATCH_TYPES[t]?.label || t}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getPatientDisplayName(group.primary)} · {group.patients.length} perfiles
            </p>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.reasonLabel} · mas antiguo: {formatDateTime(group.primary?.fechaRegistro)}
          </p>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {group.candidates.length} duplicado{group.candidates.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => onOpen(group.primary.id, group.candidates[0].id)}
            style={{ border: '1px solid #111', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Eye size={12} /> Comparar
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '14px 18px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' }}>
            Pacientes en el grupo
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.patients.map((px) => {
              const isPrimary = px.id === group.primary.id;
              return (
                <div key={px.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, background: isPrimary ? '#fafafa' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {isPrimary && <Star size={13} style={{ color: '#111', flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPatientDisplayName(px)}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2, fontSize: 10, color: '#6b7280' }}>
                        <span style={{ fontFamily: 'monospace' }}>{px.id.slice(0, 8)}…</span>
                        {px.curp && <span style={{ fontFamily: 'monospace' }}>{px.curp}</span>}
                        {px.fechaNacimiento && <span>Nac. {formatDate(px.fechaNacimiento)}</span>}
                        {px.telefonoMovil && <span>Tel. {px.telefonoMovil}</span>}
                        <span>Registro: {formatDateTime(px.fechaRegistro)}</span>
                      </div>
                    </div>
                  </div>
                  {!isPrimary && (
                    <button onClick={() => onOpen(group.primary.id, px.id)} style={{ border: '1px solid #111', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <GitMerge size={11} /> Fusionar en primario
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Merge Panel (comparación side-by-side) ──────────────────────────

const MergePanel = ({ group, primaryId: initialPrimaryId, duplicateId: initialDuplicateId, onClose, onMerged, executedBy, showToast }) => {
  const [primaryId, setPrimaryId] = useState(initialPrimaryId);
  const [duplicateId, setDuplicateId] = useState(initialDuplicateId);

  const primary = useMemo(() => group.patients.find((p) => p.id === primaryId), [group.patients, primaryId]);
  const duplicate = useMemo(() => group.patients.find((p) => p.id === duplicateId), [group.patients, duplicateId]);

  const [fieldsToCopy, setFieldsToCopy] = useState(() => {
    const init = {};
    for (const f of MERGE_FIELDS) {
      init[f.id] = 'primary';
    }
    return init;
  });

  useEffect(() => {
    if (!primary || !duplicate) return;
    setFieldsToCopy((prev) => {
      const next = { ...prev };
      for (const f of MERGE_FIELDS) {
        if (!primary[f.id] && duplicate[f.id]) next[f.id] = 'duplicate';
      }
      return next;
    });
  }, [primary, duplicate]);

  const [childCounts, setChildCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchCounts = async () => {
      if (!duplicateId) return;
      setLoadingCounts(true);
      try {
        const counts = await countChildDocs(duplicateId);
        if (alive) setChildCounts(counts);
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) setLoadingCounts(false);
      }
    };
    fetchCounts();
    return () => { alive = false; };
  }, [duplicateId]);

  const [merging, setMerging] = useState(false);
  const [logs, setLogs] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const swapPrimary = () => {
    setPrimaryId(duplicateId);
    setDuplicateId(primaryId);
    setLogs([]);
  };

  const handleExecute = async () => {
    if (!primaryId || !duplicateId) return;
    setMerging(true);
    setLogs([{ msg: 'Iniciando fusion...', kind: 'info', at: Date.now() }]);
    try {
      const result = await mergePatients({
        primaryId, duplicateId, fieldsToCopy, executedBy, dryRun: false,
        onLog: (entry) => setLogs((prev) => [...prev, { ...entry, at: Date.now() }])
      });
      setConfirmOpen(false);
      onMerged({ primaryId, duplicateId, counts: result.counts });
    } catch (err) {
      console.error(err);
      setLogs((prev) => [...prev, { msg: err.message, kind: 'error', at: Date.now() }]);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setMerging(false);
    }
  };

  if (!primary || !duplicate) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, position: 'sticky', top: 128 }}>
        <p style={{ fontSize: 13, color: '#6b7280' }}>No fue posible cargar el panel.</p>
        <button onClick={onClose} style={{ fontSize: 11, marginTop: 10, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cerrar</button>
      </div>
    );
  }

  const totalHijos = childCounts ? Object.values(childCounts).reduce((acc, n) => acc + n, 0) : null;

  return (
    <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', position: 'sticky', top: 128, maxHeight: 'calc(100vh - 9rem)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa' }}>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitMerge size={16} style={{ color: '#111' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>Comparar y fusionar</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{group.reasonLabel}</p>
        </div>
        <button onClick={onClose} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 4 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ProfileCard label="Primario (se conserva)" px={primary} />
          <ProfileCard label="Duplicado (se elimina)" px={duplicate} />
        </div>

        <button onClick={swapPrimary} style={{ padding: '10px', border: '1px dashed #d1d5db', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <RefreshCw size={12} /> Intercambiar primario / duplicado
        </button>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14, background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={13} style={{ color: '#4b5563' }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>Impacto de la fusion</p>
          </div>
          {loadingCounts && (
            <p style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Contando docs hijos…
            </p>
          )}
          {!loadingCounts && childCounts && (
            <>
              <p style={{ fontSize: 11, color: '#111', marginBottom: 8 }}>
                Se moveran <strong>{totalHijos}</strong> registros del duplicado al primario.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                {PATIENT_LINKED_COLLECTIONS.map((col) => (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 4, background: '#fff' }}>
                    <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</span>
                    <span style={{ fontWeight: 700, color: (childCounts[col] || 0) > 0 ? '#111' : '#d1d5db' }}>{childCounts[col] || 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' }}>
            Elegir que valor conservar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MERGE_FIELDS.map((field) => {
              const valPrim = primary[field.id];
              const valDup = duplicate[field.id];
              const FieldIcon = field.icon;
              const samevalue = String(valPrim || '').trim() === String(valDup || '').trim() && String(valPrim || '').trim() !== '';
              if (!valPrim && !valDup) return null;
              return (
                <div key={field.id} style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: samevalue ? '#fafafa' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FieldIcon size={10} style={{ color: '#9ca3af' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.05em' }}>{field.label}</span>
                    {samevalue && <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Identico</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => setFieldsToCopy({ ...fieldsToCopy, [field.id]: 'primary' })}
                      style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 4, fontSize: 11, border: fieldsToCopy[field.id] === 'primary' ? '2px solid #111' : '1px solid #e5e7eb', cursor: 'pointer', background: fieldsToCopy[field.id] === 'primary' ? '#fafafa' : '#fff' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 2px' }}>Primario</p>
                      <p style={{ fontFamily: 'monospace', color: '#4b5563', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(valPrim || '—')}</p>
                    </button>
                    <button onClick={() => setFieldsToCopy({ ...fieldsToCopy, [field.id]: 'duplicate' })}
                      style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 4, fontSize: 11, border: fieldsToCopy[field.id] === 'duplicate' ? '2px solid #111' : '1px solid #e5e7eb', cursor: 'pointer', background: fieldsToCopy[field.id] === 'duplicate' ? '#fafafa' : '#fff' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 2px' }}>Duplicado</p>
                      <p style={{ fontFamily: 'monospace', color: '#4b5563', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(valDup || '—')}</p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {logs.length > 0 && (
          <div style={{ background: '#111', borderRadius: 6, padding: 10, maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ color: log.kind === 'error' ? '#ef4444' : '#9ca3af' }}>
                <span style={{ color: '#6b7280' }}>[{new Date(log.at).toLocaleTimeString('es-MX')}]</span> {log.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} disabled={merging}
          style={{ padding: '10px 18px', borderRadius: 6, fontWeight: 700, color: '#6b7280', background: 'none', border: 'none', cursor: merging ? 'not-allowed' : 'pointer', opacity: merging ? 0.5 : 1, fontSize: 13 }}>
          Cancelar
        </button>
        <button onClick={() => setConfirmOpen(true)} disabled={merging}
          style={{ flex: 1, padding: '10px 18px', borderRadius: 6, fontWeight: 700, color: '#fff', background: '#111', border: 'none', cursor: merging ? 'not-allowed' : 'pointer', opacity: merging ? 0.5 : 1, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {merging ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <GitMerge size={14} />}
          {merging ? 'Fusionando...' : 'Ejecutar fusion'}
        </button>
      </div>

      {confirmOpen && !merging && (
        <ConfirmDialog
          title="Confirmar fusion"
          message={<>
            Vas a fusionar a <strong>{getPatientDisplayName(duplicate)}</strong> dentro de {' '}
            <strong>{getPatientDisplayName(primary)}</strong>. Se moveran {' '}
            <strong>{totalHijos || 0}</strong> registros y se eliminara fisicamente el duplicado. Esta accion no
            se puede deshacer (queda snapshot en pacientes_fusionados_log).
          </>}
          confirmLabel="Si, fusionar"
          danger
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleExecute}
        />
      )}
    </div>
  );
};

// ─── Profile mini-card ───────────────────────────────────────────────

const ProfileCard = ({ label, px }) => {
  return (
    <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', padding: 10, minWidth: 0, background: '#fafafa' }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{getPatientDisplayName(px)}</p>
      <div style={{ marginTop: 4, fontSize: 10, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <p style={{ fontFamily: 'monospace', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ID: {px.id.slice(0, 12)}…</p>
        {px.curp && <p style={{ fontFamily: 'monospace', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CURP: {px.curp}</p>}
        {px.fechaNacimiento && <p style={{ margin: 0 }}>Nac. {formatDate(px.fechaNacimiento)}</p>}
        {px.telefonoMovil && <p style={{ margin: 0 }}>Tel. {px.telefonoMovil}</p>}
        <p style={{ margin: 0, color: '#9ca3af' }}>Registro: {formatDateTime(px.fechaRegistro)}</p>
      </div>
    </div>
  );
};

const ConfirmDialog = ({ title, message, confirmLabel, danger, onCancel, onConfirm }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%', maxWidth: 440, overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 10px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} style={{ color: '#111' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ padding: '10px 20px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 6, fontWeight: 700, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: 6, fontWeight: 700, color: '#fff', background: danger ? '#111' : '#111', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB 2: CONSULTAS ─────────────────────────────────────────────────

const TabConsultas = ({ showToast, isMobile, onStatsChange }) => {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [operando, setOperando] = useState(false);
  const [expandedCita, setExpandedCita] = useState({});
  const [expandedPaciente, setExpandedPaciente] = useState({});

  const handleScan = useCallback(async () => {
    setLoading(true);
    setError('');
    setProgressMsg('Cargando historial clínico...');
    try {
      const result = await scanConsultasDuplicates((n) => setProgressMsg(`Cargados ${n.toLocaleString()} registros...`));
      setData(result);
      setProgressMsg(`Listo. ${result.total.toLocaleString()} consultas analizadas.`);
      showToast(`Escaneo completado: ${result.total.toLocaleString()} consultas.`);
    } catch (err) {
      console.error(err);
      setError(`Error: ${err.message}`);
      showToast(`Error al escanear: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleUnificar = useCallback(
    async (group, key) => {
      setOperando(true);
      try {
        const r = await unificarConsultas(group.records);
        showToast(`Unificadas ${r.eliminados} consultas, principal: ${r.principal.slice(0, 8)}…`);
        // Quitar localmente
        setData((prev) => {
          if (!prev) return prev;
          if (key.startsWith('cita:')) {
            return {
              ...prev,
              duplicadosPorCita: prev.duplicadosPorCita.filter((g) => g.key !== key)
            };
          }
          return {
            ...prev,
            duplicadosPorPaciente: prev.duplicadosPorPaciente.filter((g) => g.key !== key)
          };
        });
      } catch (err) {
        console.error(err);
        showToast(`Error al unificar: ${err.message}`, 'error');
      } finally {
        setOperando(false);
      }
    },
    [showToast]
  );

  const handleEliminarVacios = useCallback(async () => {
    if (!data?.vacios?.length) return;
    if (!window.confirm(`Eliminar ${data.vacios.length} consultas vacías? Esta acción no se puede deshacer.`)) return;
    setOperando(true);
    try {
      const ids = data.vacios.map((r) => r.id);
      const removed = await eliminarConsultas(ids);
      showToast(`${removed} consultas vacías eliminadas.`);
      setData({ ...data, vacios: [] });
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setOperando(false);
    }
  }, [data, showToast]);

  const handleEliminarUnaVacia = useCallback(
    async (id) => {
      if (!window.confirm('Eliminar esta consulta vacía?')) return;
      setOperando(true);
      try {
        await eliminarConsultas([id]);
        showToast('Consulta eliminada.');
        setData((prev) => ({ ...prev, vacios: prev.vacios.filter((r) => r.id !== id) }));
      } catch (err) {
        console.error(err);
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        setOperando(false);
      }
    },
    [showToast]
  );

  const stats = useMemo(() => {
    if (!data) return null;
    const totalEnGrupos =
      data.duplicadosPorCita.reduce((acc, g) => acc + g.records.length, 0) +
      data.duplicadosPorPaciente.reduce((acc, g) => acc + g.records.length, 0);
    return {
      total: data.total,
      gruposCita: data.duplicadosPorCita.length,
      gruposPaciente: data.duplicadosPorPaciente.length,
      vacios: data.vacios.length,
      totalEnGrupos
    };
  }, [data]);

  // Reportar stats al header
  useEffect(() => {
    if (stats) {
      onStatsChange([
        { label: 'Analizadas', value: stats.total.toLocaleString() },
        { label: 'Grupos cita', value: stats.gruposCita },
        { label: 'Grupos px', value: stats.gruposPaciente },
        { label: 'Vacias', value: stats.vacios },
      ]);
    } else {
      onStatsChange(null);
    }
  }, [stats, onStatsChange]);

  return (
    <div>
      {/* Controles */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={handleScan}
            disabled={loading || operando}
            style={{ border: '1px solid #111', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: (loading || operando) ? 'not-allowed' : 'pointer', opacity: (loading || operando) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {loading ? 'Escaneando...' : 'Escanear consultas'}
          </button>
          {progressMsg && <span style={{ fontSize: 11, color: '#6b7280' }}>{progressMsg}</span>}
        </div>
      </div>

      {error && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 20, background: '#fafafa' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !data && (
        <EmptyState icon={Search} title="Sin escanear todavia" message="Analiza el historial clinico completo para detectar consultas duplicadas y vacias." />
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionConsultas title="Duplicadas por cita (misma citaId)" count={data.duplicadosPorCita.length} description="Una misma cita medica genera varios registros. Se conservara el mas completo." empty="No hay duplicados por cita.">
            {data.duplicadosPorCita.map((g) => (
              <ConsultaGroupCard key={g.key} groupKey={g.key} title={`Cita ${g.citaId?.slice(0, 12)}… · ${g.records.length} registros`} subtitle={`Paciente: ${g.pacienteNombre || g.records[0]?.pacienteNombre || '—'}`} records={g.records} expanded={!!expandedCita[g.key]}
                onToggle={() => setExpandedCita({ ...expandedCita, [g.key]: !expandedCita[g.key] })}
                onUnificar={() => handleUnificar(g, g.key)} operando={operando} />
            ))}
          </SectionConsultas>

          <SectionConsultas title="Duplicadas por paciente + fecha (sin cita asociada)" count={data.duplicadosPorPaciente.length} description="Mismo paciente en el mismo dia con varios registros y sin citaId." empty="No hay duplicados por paciente+fecha.">
            {data.duplicadosPorPaciente.map((g) => (
              <ConsultaGroupCard key={g.key} groupKey={g.key} title={`${g.pacienteNombre || g.records[0]?.pacienteNombre || '—'} · ${g.records.length} registros`} subtitle={`Paciente: ${(g.pacienteId || '').slice(0, 10)}…`} records={g.records} expanded={!!expandedPaciente[g.key]}
                onToggle={() => setExpandedPaciente({ ...expandedPaciente, [g.key]: !expandedPaciente[g.key] })}
                onUnificar={() => handleUnificar(g, g.key)} operando={operando} />
            ))}
          </SectionConsultas>

          {data.vacios.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: 0 }}>
                    <Trash2 size={14} style={{ color: '#111' }} /> Consultas vacias ({data.vacios.length})
                  </h3>
                  <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Sin signos vitales, padecimiento, diagnostico, tratamiento, recetas ni documentos.</p>
                </div>
                <button onClick={handleEliminarVacios} disabled={operando}
                  style={{ border: '1px solid #111', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#111', cursor: operando ? 'not-allowed' : 'pointer', opacity: operando ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={12} /> Eliminar todos
                </button>
              </div>
              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {data.vacios.slice(0, 100).map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', color: '#9ca3af', flexShrink: 0 }}>{r.id.slice(0, 8)}…</span>
                      <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pacienteNombre || 'Sin nombre'}</span>
                      {r.soloAntecedentes && <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Solo antecedentes</span>}
                      {r.tipoNota === 'Carga de Estudio' && <span style={{ background: '#f3f4f6', color: '#111', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Carga estudio</span>}
                    </div>
                    <button onClick={() => handleEliminarUnaVacia(r.id)} disabled={operando} style={{ color: '#d1d5db', cursor: 'pointer', border: 'none', background: 'none', padding: 4, flexShrink: 0 }} title="Eliminar">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {data.vacios.length > 100 && (
                  <div style={{ padding: '10px 20px', textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
                    Mostrando 100 de {data.vacios.length}. Usa "Eliminar todos" para procesar el resto.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SectionConsultas = ({ title, count, description, empty, children }) => {
  if (count === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
        <h3 style={{ fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: 0 }}>
          <GitMerge size={14} style={{ color: '#111' }} /> {title} <span style={{ color: '#4b5563' }}>({count})</span>
        </h3>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{description}</p>
      </div>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {count === 0 ? <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>{empty}</div> : children}
      </div>
    </div>
  );
};

const ConsultaGroupCard = ({ title, subtitle, records, expanded, onToggle, onUnificar, operando }) => {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onToggle} style={{ color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
        </div>
        <button onClick={onUnificar} disabled={operando}
          style={{ border: '1px solid #111', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#111', cursor: operando ? 'not-allowed' : 'pointer', opacity: operando ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <GitMerge size={12} /> Unificar
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {records.map((r, idx) => (
            <div key={r.id} style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, background: idx === 0 ? '#fafafa' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {idx === 0 && <Star size={11} style={{ color: '#111' }} />}
                <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{r.id.slice(0, 10)}…</span>
                <span style={{ color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.medicoNombre || '—'} · {r.tipoNota || '—'} · {formatDateTime(r.fecha)}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10 }}>
                {(r.recetasGeneradas || []).length > 0 && (
                  <span style={{ background: '#f3f4f6', color: '#111', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    {r.recetasGeneradas.length} recetas
                  </span>
                )}
                {(r.documentosGenerados || []).length > 0 && (
                  <span style={{ background: '#f3f4f6', color: '#111', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    {r.documentosGenerados.length} docs
                  </span>
                )}
                {r.consulta?.diagnostico?.enfermedad_actual && (
                  <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                    Dx: {String(r.consulta.diagnostico.enfermedad_actual).slice(0, 40)}…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── TAB 3: HUÉRFANOS ─────────────────────────────────────────────────

const TabHuerfanos = ({ showToast, isMobile, onStatsChange }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [operando, setOperando] = useState(false);
  const [logs, setLogs] = useState([]);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setError('');
    setProgressMsg('Analizando colecciones...');
    setLogs([]);
    try {
      const result = await scanHuerfanos((n) => setProgressMsg(`Detectados ${n} huérfanos...`));
      setData(result);
      setProgressMsg(`Listo. ${result.summary.totalHuerfanos} huérfanos detectados.`);
      showToast(`Escaneo completado: ${result.summary.totalHuerfanos} huérfanos.`);
    } catch (err) {
      console.error(err);
      setError(`Error: ${err.message}`);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleReparar = useCallback(async () => {
    if (!data) return;
    if (!window.confirm(`Reasignar ${data.summary.redirectibles} registros redirigibles a su paciente primario?`))
      return;
    setOperando(true);
    setLogs([]);
    try {
      const result = await repararHuerfanos(data.items, (entry) =>
        setLogs((prev) => [...prev, { ...entry, at: Date.now() }])
      );
      showToast(`Reparados ${result.reasignados} registros.`);
      // Re-escanear
      await handleScan();
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setOperando(false);
    }
  }, [data, handleScan, showToast]);

  const handleEliminarSinDestino = useCallback(async () => {
    if (!data) return;
    if (
      !window.confirm(
        `Eliminar ${data.summary.sinDestino} registros huérfanos sin destino? Acción IRREVERSIBLE.`
      )
    )
      return;
    setOperando(true);
    try {
      const removed = await eliminarHuerfanosSinDestino(data.items);
      showToast(`${removed} huérfanos eliminados.`);
      await handleScan();
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setOperando(false);
    }
  }, [data, handleScan, showToast]);

  // Reportar stats al header
  useEffect(() => {
    if (data) {
      onStatsChange([
        { label: 'Tot. huerfanos', value: data.summary.totalHuerfanos },
        { label: 'Redirigibles', value: data.summary.redirectibles },
        { label: 'Sin destino', value: data.summary.sinDestino },
      ]);
    } else {
      onStatsChange(null);
    }
  }, [data, onStatsChange]);

  return (
    <div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleScan} disabled={loading || operando}
              style={{ border: '1px solid #111', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: (loading || operando) ? 'not-allowed' : 'pointer', opacity: (loading || operando) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {loading ? 'Escaneando...' : 'Escanear huerfanos'}
            </button>
            {progressMsg && <span style={{ fontSize: 11, color: '#6b7280' }}>{progressMsg}</span>}
          </div>
          {data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleReparar} disabled={operando || data.summary.redirectibles === 0}
                style={{ border: '1px solid #111', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#111', background: '#fff', cursor: (operando || data.summary.redirectibles === 0) ? 'not-allowed' : 'pointer', opacity: (operando || data.summary.redirectibles === 0) ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowRight size={12} /> Reparar redirigibles
              </button>
              <button onClick={handleEliminarSinDestino} disabled={operando || data.summary.sinDestino === 0}
                style={{ border: '1px solid #111', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#111', cursor: (operando || data.summary.sinDestino === 0) ? 'not-allowed' : 'pointer', opacity: (operando || data.summary.sinDestino === 0) ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={12} /> Eliminar sin destino
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 20, background: '#fafafa' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ background: '#111', borderRadius: 6, padding: 10, marginBottom: 20, maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ color: log.kind === 'error' ? '#ef4444' : '#9ca3af' }}>
              <span style={{ color: '#6b7280' }}>[{new Date(log.at).toLocaleTimeString('es-MX')}]</span> {log.msg}
            </div>
          ))}
        </div>
      )}

      {!loading && !data && (
        <EmptyState icon={Search} title="Sin escanear todavia" message="Detecta registros (citas, historial, triage, notas, ordenes, estudios, vinculos) que apuntan a pacientes inexistentes o fusionados." />
      )}

      {data && data.summary.totalHuerfanos === 0 && (
        <EmptyState icon={CheckCircle2} title="Todo en orden" message="No se detectaron registros huerfanos. Todos los docs hijos apuntan a pacientes activos." />
      )}

      {data && data.summary.totalHuerfanos > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(data.items).map(([col, items]) => {
            if (!items.length) return null;
            const redirigibles = items.filter((i) => i.redirectTo).length;
            const huerfanosPuros = items.length - redirigibles;
            return (
              <HuerfanosColeccionCard
                key={col}
                coleccion={col}
                items={items}
                redirigibles={redirigibles}
                huerfanosPuros={huerfanosPuros}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const HuerfanosColeccionCard = ({ coleccion, items, redirigibles, huerfanosPuros }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setExpanded((x) => !x)} style={{ color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111', fontFamily: 'monospace', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coleccion}</p>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            {items.length} huerfano{items.length === 1 ? '' : 's'} · {redirigibles} redirigible
            {redirigibles === 1 ? '' : 's'} · {huerfanosPuros} sin destino
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {redirigibles > 0 && (
            <span style={{ background: '#f3f4f6', color: '#111', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
              {redirigibles} redirige
            </span>
          )}
          {huerfanosPuros > 0 && (
            <span style={{ background: '#f3f4f6', color: '#111', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
              {huerfanosPuros} sin destino
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', maxHeight: 288, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
              <tr>
                {['Doc ID', 'pacienteId huerfano', 'Redirige a', 'Nombre', 'Fecha'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 700, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 100).map((it) => (
                <tr key={it.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#6b7280' }}>{it.id.slice(0, 10)}…</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#6b7280' }}>{(it.pacienteId || '').slice(0, 10)}…</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>
                    {it.redirectTo ? (
                      <span style={{ color: '#111' }}>{it.redirectTo.slice(0, 10)}…</span>
                    ) : (
                      <span style={{ color: '#111', fontWeight: 700, textTransform: 'uppercase' }}>Sin destino</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', color: '#4b5563', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.pacienteNombre || '—'}</td>
                  <td style={{ padding: '8px 14px', color: '#6b7280' }}>{formatDateTime(it.fecha)}</td>
                </tr>
              ))}
              {items.length > 100 && (
                <tr>
                  <td colSpan="5" style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, color: '#9ca3af' }}>
                    Mostrando 100 de {items.length}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
