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
  curp:        'bg-purple-100 text-purple-700 border-purple-200',
  idPaciente:  'bg-green-100 text-green-700 border-green-200',
  idMigrado:   'bg-teal-100 text-teal-700 border-teal-200',
  phone:       'bg-orange-100 text-orange-700 border-orange-200',
  name_birth:  'bg-blue-100 text-blue-700 border-blue-200',
  fuzzy:       'bg-pink-100 text-pink-700 border-pink-200',
  phone_name:  'bg-amber-100 text-amber-700 border-amber-200'
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
  const [tab, setTab] = useState('pacientes');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

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
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-xl w-[92vw]">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-700'
                : toast.type === 'warning'
                  ? 'bg-amber-50/95 border-amber-200 text-amber-800'
                  : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={20} />
            ) : toast.type === 'warning' ? (
              <AlertTriangle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span className="text-sm font-semibold flex-1 leading-snug">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="p-1 rounded-md hover:bg-black/5">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <Header tab={tab} onTabChange={setTab} />

      <div className="px-8 pb-12 pt-6">
        {tab === 'pacientes' && <TabPacientes showToast={showToast} executedBy={user?.uid || user?.email || 'admin'} />}
        {tab === 'consultas' && <TabConsultas showToast={showToast} />}
        {tab === 'huerfanos' && <TabHuerfanos showToast={showToast} />}
      </div>
    </div>
  );
};

export default DepuracionConsultas;

// ─── Header con tabs ───────────────────────────────────────────────────

const TAB_THEMES = {
  pacientes: {
    activeText: 'text-violet-700',
    activeBg: 'bg-violet-50/80',
    underline: 'bg-violet-500'
  },
  consultas: {
    activeText: 'text-amber-700',
    activeBg: 'bg-amber-50/80',
    underline: 'bg-amber-500'
  },
  huerfanos: {
    activeText: 'text-rose-700',
    activeBg: 'bg-rose-50/80',
    underline: 'bg-rose-500'
  }
};

const Header = ({ tab, onTabChange }) => {
  const tabs = [
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'consultas', label: 'Consultas', icon: ClipboardList },
    { id: 'huerfanos', label: 'Huérfanos', icon: Link2 }
  ];

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="px-8 pt-6 pb-3">
        <div className="flex items-start justify-between gap-6 mb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-500/30">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Auditoría de Duplicados</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Detecta y consolida pacientes, consultas y registros huérfanos en todo el expediente.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {tabs.map((t) => {
            const TabIcon = t.icon;
            const active = tab === t.id;
            const theme = TAB_THEMES[t.id] || TAB_THEMES.pacientes;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`relative px-5 py-3 text-sm font-bold transition-all flex items-center gap-2 rounded-t-xl ${
                  active
                    ? `${theme.activeText} ${theme.activeBg}`
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <TabIcon size={16} />
                {t.label}
                {active && (
                  <span className={`absolute -bottom-[1px] left-3 right-3 h-[3px] rounded-t-full ${theme.underline}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TAB 1: PACIENTES ─────────────────────────────────────────────────

const TabPacientes = ({ showToast, executedBy }) => {
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

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Columna izquierda: filtros + lista */}
      <div className={`col-span-12 ${activeGroup ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Pacientes analizados"
            value={pacientes.length.toLocaleString()}
            color="slate"
            icon={Users}
          />
          <StatCard
            label="Grupos detectados"
            value={stats.totalGrupos}
            color={stats.totalGrupos > 0 ? 'amber' : 'emerald'}
            icon={GitMerge}
          />
          <StatCard
            label="Duplicados potenciales"
            value={stats.totalDuplicadosPotenciales}
            color={stats.totalDuplicadosPotenciales > 0 ? 'rose' : 'emerald'}
            icon={AlertTriangle}
          />
        </div>

        {/* Controles */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleScan}
                disabled={loading}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-violet-500/20"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {loading ? 'Escaneando...' : 'Escanear pacientes'}
              </button>
              {progressMsg && !loading && (
                <span className="text-xs text-slate-500 font-medium">{progressMsg}</span>
              )}
              {loading && <span className="text-xs text-slate-500 font-medium">{progressMsg}</span>}
            </div>
            <button
              onClick={handleExportCsv}
              disabled={groups.length === 0}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Reglas de detección
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MATCH_TYPES).map(([id, m]) => (
                  <button
                    key={id}
                    onClick={() =>
                      setFilters({ ...filters, types: { ...filters.types, [id]: !filters.types[id] } })
                    }
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      filters.types[id]
                        ? 'bg-violet-100 border-violet-300 text-violet-700'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                    title={m.label}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Buscar en resultados
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Nombre, CURP, ID, teléfono..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {scanError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-sm font-semibold mb-6">
            <AlertCircle size={18} /> {scanError}
          </div>
        )}

        {/* Lista de grupos */}
        {!loading && pacientes.length === 0 && (
          <EmptyState
            icon={Search}
            title="Sin escanear todavía"
            message="Presiona “Escanear pacientes” para analizar la base completa y detectar duplicados con todas las reglas activas."
          />
        )}

        {!loading && pacientes.length > 0 && groups.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="No hay duplicados con los filtros actuales"
            message="Activa o desactiva reglas de detección para ampliar o reducir los resultados. Si activaste todas y sigue vacío, la base está limpia de duplicados."
            tone="emerald"
          />
        )}

        {groups.length > 0 && (
          <div className="space-y-3">
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
        <div className="col-span-12 lg:col-span-5">
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

const StatCard = ({ label, value, color = 'slate', icon: Icon }) => {
  const palettes = {
    slate: { bg: 'bg-white', text: 'text-slate-700', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' },
    violet: { bg: 'bg-violet-50/60', text: 'text-violet-700', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
    amber: { bg: 'bg-amber-50/60', text: 'text-amber-700', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    rose: { bg: 'bg-rose-50/60', text: 'text-rose-700', iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
    emerald: { bg: 'bg-emerald-50/60', text: 'text-emerald-700', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' }
  };
  const p = palettes[color] || palettes.slate;
  return (
    <div className={`${p.bg} rounded-2xl border border-slate-200/80 p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        {Icon && (
          <div className={`w-7 h-7 ${p.iconBg} rounded-lg flex items-center justify-center`}>
            <Icon size={14} className={p.iconColor} />
          </div>
        )}
      </div>
      <p className={`text-2xl font-black ${p.text}`}>{value}</p>
    </div>
  );
};

// ─── EmptyState ───────────────────────────────────────────────────────

const EmptyState = (props) => {
  const { icon: IconComp, title, message, tone = 'slate' } = props;
  const tones = {
    slate: { iconBg: 'bg-slate-100', iconColor: 'text-slate-400' },
    emerald: { iconBg: 'bg-emerald-100', iconColor: 'text-emerald-500' }
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
      <div className={`w-16 h-16 ${t.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
        <IconComp size={28} className={t.iconColor} />
      </div>
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{message}</p>
    </div>
  );
};

// ─── Group Card ──────────────────────────────────────────────────────

const GroupCard = ({ group, activeKey, onOpen }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        activeKey === group.key ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        <button onClick={() => setExpanded((x) => !x)} className="text-slate-400 hover:text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        {/* Badges de tipos de coincidencia */}
        <div className="flex flex-wrap gap-1 shrink-0">
          {(group.types || [group.matchType]).map((t) => {
            const badge = TYPE_BADGES[t] || TYPE_BADGES.curp;
            return (
              <span
                key={t}
                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badge}`}
              >
                {MATCH_TYPES[t]?.label || t}
              </span>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-800 truncate">
              {getPatientDisplayName(group.primary)} · {group.patients.length} perfiles
            </p>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {group.reasonLabel} · más antiguo: {formatDateTime(group.primary?.fechaRegistro)}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:inline">
            {group.candidates.length} duplicado{group.candidates.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => onOpen(group.primary.id, group.candidates[0].id)}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          >
            <Eye size={13} /> Comparar
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Pacientes en el grupo
          </p>
          <div className="space-y-2">
            {group.patients.map((px) => {
              const isPrimary = px.id === group.primary.id;
              return (
                <div
                  key={px.id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                    isPrimary ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isPrimary && <Star size={14} className="text-emerald-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{getPatientDisplayName(px)}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-[10px] text-slate-500">
                        <span className="font-mono">{px.id.slice(0, 8)}…</span>
                        {px.curp && <span className="font-mono">{px.curp}</span>}
                        {px.fechaNacimiento && <span>Nac. {formatDate(px.fechaNacimiento)}</span>}
                        {px.telefonoMovil && <span>Tel. {px.telefonoMovil}</span>}
                        <span>Registro: {formatDateTime(px.fechaRegistro)}</span>
                      </div>
                    </div>
                  </div>
                  {!isPrimary && (
                    <button
                      onClick={() => onOpen(group.primary.id, px.id)}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-md font-bold text-[10px] flex items-center gap-1 shrink-0 ml-2"
                    >
                      <GitMerge size={12} />
                      Fusionar en primario
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

  // fieldsToCopy[campo] = 'primary' | 'duplicate'
  const [fieldsToCopy, setFieldsToCopy] = useState(() => {
    const init = {};
    for (const f of MERGE_FIELDS) {
      // Por default mantener primario; si primario vacio y duplicado tiene, prellenar 'duplicate'.
      init[f.id] = 'primary';
    }
    return init;
  });

  // Auto-prefill: si el primario tiene vacio el campo y el duplicado tiene valor, sugiere duplicate.
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
    return () => {
      alive = false;
    };
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
    setLogs([{ msg: 'Iniciando fusión...', kind: 'info', at: Date.now() }]);
    try {
      const result = await mergePatients({
        primaryId,
        duplicateId,
        fieldsToCopy,
        executedBy,
        dryRun: false,
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-32">
        <p className="text-sm text-slate-500">No fue posible cargar el panel.</p>
        <button onClick={onClose} className="text-xs mt-3 text-slate-500 underline">
          Cerrar
        </button>
      </div>
    );
  }

  const totalHijos = childCounts ? Object.values(childCounts).reduce((acc, n) => acc + n, 0) : null;

  return (
    <div className="bg-white rounded-2xl border border-violet-200 shadow-xl overflow-hidden sticky top-32 max-h-[calc(100vh-9rem)] flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
          <GitMerge size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800">Comparar y fusionar</p>
          <p className="text-[11px] text-slate-500">{group.reasonLabel}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {/* Cabecera de los 2 perfiles */}
        <div className="grid grid-cols-2 gap-3">
          <ProfileCard label="Primario (se conserva)" tone="emerald" px={primary} />
          <ProfileCard label="Duplicado (se elimina)" tone="rose" px={duplicate} />
        </div>

        {/* Intercambiar */}
        <button
          onClick={swapPrimary}
          className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2 transition-all"
        >
          <RefreshCw size={12} /> Intercambiar primario / duplicado
        </button>

        {/* Impacto */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Impacto de la fusión</p>
          </div>
          {loadingCounts && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Contando docs hijos…
            </p>
          )}
          {!loadingCounts && childCounts && (
            <>
              <p className="text-xs text-amber-800 mb-2">
                Se moverán <strong>{totalHijos}</strong> registros del duplicado al primario.
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {PATIENT_LINKED_COLLECTIONS.map((col) => (
                  <div key={col} className="flex items-center justify-between bg-white/70 px-2 py-1 rounded-md">
                    <span className="text-slate-600 truncate">{col}</span>
                    <span
                      className={`font-bold ${
                        (childCounts[col] || 0) > 0 ? 'text-amber-700' : 'text-slate-300'
                      }`}
                    >
                      {childCounts[col] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Selector campo por campo */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Elegir qué valor conservar
          </p>
          <div className="space-y-1.5">
            {MERGE_FIELDS.map((field) => {
              const valPrim = primary[field.id];
              const valDup = duplicate[field.id];
              const FieldIcon = field.icon;
              const samevalue =
                String(valPrim || '').trim() === String(valDup || '').trim() &&
                String(valPrim || '').trim() !== '';
              if (!valPrim && !valDup) return null;
              return (
                <div
                  key={field.id}
                  className={`px-3 py-2 rounded-lg border ${
                    samevalue ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FieldIcon size={11} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {field.label}
                    </span>
                    {samevalue && (
                      <span className="text-[9px] font-black text-slate-400 uppercase">Idéntico</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFieldsToCopy({ ...fieldsToCopy, [field.id]: 'primary' })}
                      className={`text-left px-2.5 py-1.5 rounded-md text-[11px] border transition-all ${
                        fieldsToCopy[field.id] === 'primary'
                          ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">
                        Primario
                      </p>
                      <p className="font-mono text-slate-700 truncate">
                        {String(valPrim || '—')}
                      </p>
                    </button>
                    <button
                      onClick={() => setFieldsToCopy({ ...fieldsToCopy, [field.id]: 'duplicate' })}
                      className={`text-left px-2.5 py-1.5 rounded-md text-[11px] border transition-all ${
                        fieldsToCopy[field.id] === 'duplicate'
                          ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-0.5">
                        Duplicado
                      </p>
                      <p className="font-mono text-slate-700 truncate">
                        {String(valDup || '—')}
                      </p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-3 max-h-44 overflow-y-auto font-mono text-[10px] space-y-0.5">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.kind === 'error'
                    ? 'text-rose-300'
                    : log.kind === 'success'
                      ? 'text-emerald-300'
                      : 'text-slate-300'
                }
              >
                <span className="text-slate-500">[{new Date(log.at).toLocaleTimeString('es-MX')}]</span> {log.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <button
          onClick={onClose}
          disabled={merging}
          className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 text-sm transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={merging}
          className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-violet-500/20"
        >
          {merging ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
          {merging ? 'Fusionando...' : 'Ejecutar fusión'}
        </button>
      </div>

      {confirmOpen && !merging && (
        <ConfirmDialog
          title="Confirmar fusión"
          message={
            <>
              Vas a fusionar a <strong>{getPatientDisplayName(duplicate)}</strong> dentro de{' '}
              <strong>{getPatientDisplayName(primary)}</strong>. Se moverán{' '}
              <strong>{totalHijos || 0}</strong> registros y se eliminará físicamente el duplicado. Esta acción no
              se puede deshacer (queda snapshot en pacientes_fusionados_log).
            </>
          }
          confirmLabel="Sí, fusionar"
          danger
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleExecute}
        />
      )}
    </div>
  );
};

// ─── Profile mini-card ───────────────────────────────────────────────

const ProfileCard = ({ label, tone, px }) => {
  const palettes = {
    emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50/60', label: 'text-emerald-600' },
    rose: { border: 'border-rose-200', bg: 'bg-rose-50/60', label: 'text-rose-500' }
  };
  const p = palettes[tone];
  return (
    <div className={`rounded-xl border-2 ${p.border} ${p.bg} p-3 min-w-0`}>
      <p className={`text-[9px] font-black uppercase tracking-widest ${p.label} mb-1.5`}>{label}</p>
      <p className="text-sm font-bold text-slate-800 truncate">{getPatientDisplayName(px)}</p>
      <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
        <p className="font-mono truncate">ID: {px.id.slice(0, 12)}…</p>
        {px.curp && <p className="font-mono truncate">CURP: {px.curp}</p>}
        {px.fechaNacimiento && <p>Nac. {formatDate(px.fechaNacimiento)}</p>}
        {px.telefonoMovil && <p>Tel. {px.telefonoMovil}</p>}
        <p className="text-slate-400">Registro: {formatDateTime(px.fechaRegistro)}</p>
      </div>
    </div>
  );
};

// ─── Confirm dialog ───────────────────────────────────────────────────

const ConfirmDialog = ({ title, message, confirmLabel, danger, onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="px-6 pt-6 pb-3 flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-rose-100 text-rose-600' : 'bg-violet-100 text-violet-600'
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="px-6 pb-5 pt-3 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white font-bold text-sm shadow-md transition-all active:scale-95 ${
              danger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/30'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB 2: CONSULTAS ─────────────────────────────────────────────────

const TabConsultas = ({ showToast }) => {
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

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Consultas analizadas" value={stats.total.toLocaleString()} color="slate" icon={ClipboardList} />
          <StatCard label="Grupos por cita" value={stats.gruposCita} color={stats.gruposCita ? 'amber' : 'emerald'} icon={GitMerge} />
          <StatCard label="Grupos px+fecha" value={stats.gruposPaciente} color={stats.gruposPaciente ? 'amber' : 'emerald'} icon={GitMerge} />
          <StatCard label="Vacías" value={stats.vacios} color={stats.vacios ? 'rose' : 'emerald'} icon={Trash2} />
          <StatCard label="Total en grupos" value={stats.totalEnGrupos} color="violet" icon={Activity} />
        </div>
      )}

      {/* Controles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={handleScan}
            disabled={loading || operando}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-amber-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {loading ? 'Escaneando...' : 'Escanear consultas'}
          </button>
          {progressMsg && <span className="text-xs text-slate-500 font-medium">{progressMsg}</span>}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-sm font-semibold mb-6">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {!loading && !data && (
        <EmptyState
          icon={Search}
          title="Sin escanear todavía"
          message="Analiza el historial clínico completo para detectar consultas duplicadas y vacías."
        />
      )}

      {data && (
        <div className="space-y-6">
          {/* Grupos por cita */}
          <SectionConsultas
            title="Duplicadas por cita (misma citaId)"
            count={data.duplicadosPorCita.length}
            description="Una misma cita médica genera varios registros. Se conservará el más completo."
            color="amber"
            empty="No hay duplicados por cita."
          >
            {data.duplicadosPorCita.map((g) => (
              <ConsultaGroupCard
                key={g.key}
                groupKey={g.key}
                title={`Cita ${g.citaId?.slice(0, 12)}… · ${g.records.length} registros`}
                subtitle={`Paciente: ${g.pacienteNombre || g.records[0]?.pacienteNombre || '—'}`}
                records={g.records}
                expanded={!!expandedCita[g.key]}
                onToggle={() => setExpandedCita({ ...expandedCita, [g.key]: !expandedCita[g.key] })}
                onUnificar={() => handleUnificar(g, g.key)}
                operando={operando}
              />
            ))}
          </SectionConsultas>

          {/* Grupos por px + fecha */}
          <SectionConsultas
            title="Duplicadas por paciente + fecha (sin cita asociada)"
            count={data.duplicadosPorPaciente.length}
            description="Mismo paciente en el mismo día con varios registros y sin citaId."
            color="amber"
            empty="No hay duplicados por paciente+fecha."
          >
            {data.duplicadosPorPaciente.map((g) => (
              <ConsultaGroupCard
                key={g.key}
                groupKey={g.key}
                title={`${g.pacienteNombre || g.records[0]?.pacienteNombre || '—'} · ${g.records.length} registros`}
                subtitle={`Paciente: ${(g.pacienteId || '').slice(0, 10)}…`}
                records={g.records}
                expanded={!!expandedPaciente[g.key]}
                onToggle={() => setExpandedPaciente({ ...expandedPaciente, [g.key]: !expandedPaciente[g.key] })}
                onUnificar={() => handleUnificar(g, g.key)}
                operando={operando}
              />
            ))}
          </SectionConsultas>

          {/* Vacías */}
          {data.vacios.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                    <Trash2 size={16} className="text-rose-600" /> Consultas vacías ({data.vacios.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sin signos vitales, padecimiento, diagnóstico, tratamiento, recetas ni documentos.
                  </p>
                </div>
                <button
                  onClick={handleEliminarVacios}
                  disabled={operando}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 size={13} /> Eliminar todos
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-[40vh] overflow-y-auto">
                {data.vacios.slice(0, 100).map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-rose-50/30">
                    <div className="flex items-center gap-2 text-xs min-w-0">
                      <span className="font-mono text-slate-400 shrink-0">{r.id.slice(0, 8)}…</span>
                      <span className="text-slate-500 truncate">{r.pacienteNombre || 'Sin nombre'}</span>
                      {r.soloAntecedentes && (
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                          Solo antecedentes
                        </span>
                      )}
                      {r.tipoNota === 'Carga de Estudio' && (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                          Carga estudio
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleEliminarUnaVacia(r.id)}
                      disabled={operando}
                      className="text-slate-300 hover:text-rose-500 p-1 shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {data.vacios.length > 100 && (
                  <div className="px-5 py-3 text-center text-xs text-slate-400">
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

const SectionConsultas = ({ title, count, description, color, empty, children }) => {
  const palettes = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600', border: 'border-amber-100' }
  };
  const p = palettes[color] || palettes.amber;
  if (count === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`px-5 py-4 ${p.bg} border-b ${p.border}`}>
        <h3 className={`font-black text-slate-800 flex items-center gap-2 text-sm`}>
          <GitMerge size={16} className={p.icon} /> {title} <span className={`${p.text}`}>({count})</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
        {count === 0 ? <div className="p-6 text-center text-xs text-slate-400">{empty}</div> : children}
      </div>
    </div>
  );
};

const ConsultaGroupCard = ({ title, subtitle, records, expanded, onToggle, onUnificar, operando }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        </div>
        <button
          onClick={onUnificar}
          disabled={operando}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <GitMerge size={13} /> Unificar
        </button>
      </div>
      {expanded && (
        <div className="mt-3 ml-8 space-y-2">
          {records.map((r, idx) => (
            <div
              key={r.id}
              className={`p-3 rounded-lg text-xs ${
                idx === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {idx === 0 && <Star size={12} className="text-emerald-500" />}
                <span className="font-mono text-slate-400">{r.id.slice(0, 10)}…</span>
                <span className="text-slate-600 truncate">
                  {r.medicoNombre || '—'} · {r.tipoNota || '—'} · {formatDateTime(r.fecha)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {(r.recetasGeneradas || []).length > 0 && (
                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                    {r.recetasGeneradas.length} recetas
                  </span>
                )}
                {(r.documentosGenerados || []).length > 0 && (
                  <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold">
                    {r.documentosGenerados.length} docs
                  </span>
                )}
                {r.consulta?.diagnostico?.enfermedad_actual && (
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
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

const TabHuerfanos = ({ showToast }) => {
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

  return (
    <div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total huérfanos"
            value={data.summary.totalHuerfanos}
            color={data.summary.totalHuerfanos ? 'rose' : 'emerald'}
            icon={Link2}
          />
          <StatCard label="Redirigibles" value={data.summary.redirectibles} color="amber" icon={ArrowRight} />
          <StatCard label="Sin destino" value={data.summary.sinDestino} color="rose" icon={AlertCircle} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleScan}
              disabled={loading || operando}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-rose-500/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {loading ? 'Escaneando...' : 'Escanear huérfanos'}
            </button>
            {progressMsg && <span className="text-xs text-slate-500 font-medium">{progressMsg}</span>}
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReparar}
                disabled={operando || data.summary.redirectibles === 0}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowRight size={13} /> Reparar redirigibles
              </button>
              <button
                onClick={handleEliminarSinDestino}
                disabled={operando || data.summary.sinDestino === 0}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={13} /> Eliminar sin destino
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-sm font-semibold mb-6">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-3 mb-6 max-h-44 overflow-y-auto font-mono text-[10px] space-y-0.5">
          {logs.map((log, idx) => (
            <div key={idx} className={log.kind === 'error' ? 'text-rose-300' : 'text-slate-300'}>
              <span className="text-slate-500">[{new Date(log.at).toLocaleTimeString('es-MX')}]</span> {log.msg}
            </div>
          ))}
        </div>
      )}

      {!loading && !data && (
        <EmptyState
          icon={Search}
          title="Sin escanear todavía"
          message="Detecta registros (citas, historial, triage, notas, órdenes, estudios, vínculos) que apuntan a pacientes inexistentes o fusionados."
        />
      )}

      {data && data.summary.totalHuerfanos === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="Todo en orden"
          message="No se detectaron registros huérfanos. Todos los docs hijos apuntan a pacientes activos."
          tone="emerald"
        />
      )}

      {data && data.summary.totalHuerfanos > 0 && (
        <div className="space-y-3">
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3">
        <button onClick={() => setExpanded((x) => !x)} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 font-mono truncate">{coleccion}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} huérfano{items.length === 1 ? '' : 's'} · {redirigibles} redirigible
            {redirigibles === 1 ? '' : 's'} · {huerfanosPuros} sin destino
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {redirigibles > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">
              {redirigibles} redirige
            </span>
          )}
          {huerfanosPuros > 0 && (
            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">
              {huerfanosPuros} sin destino
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest">
                  Doc ID
                </th>
                <th className="text-left px-4 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest">
                  pacienteId huérfano
                </th>
                <th className="text-left px-4 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest">
                  Redirige a
                </th>
                <th className="text-left px-4 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest">
                  Nombre
                </th>
                <th className="text-left px-4 py-2 font-black text-[10px] text-slate-500 uppercase tracking-widest">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 100).map((it) => (
                <tr key={it.id} className="border-t border-slate-100 hover:bg-white">
                  <td className="px-4 py-2 font-mono text-slate-500">{it.id.slice(0, 10)}…</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{(it.pacienteId || '').slice(0, 10)}…</td>
                  <td className="px-4 py-2 font-mono">
                    {it.redirectTo ? (
                      <span className="text-amber-700">{it.redirectTo.slice(0, 10)}…</span>
                    ) : (
                      <span className="text-rose-500 font-black uppercase">Sin destino</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600 truncate max-w-xs">{it.pacienteNombre || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDateTime(it.fecha)}</td>
                </tr>
              ))}
              {items.length > 100 && (
                <tr>
                  <td colSpan="5" className="px-4 py-3 text-center text-[10px] text-slate-400">
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
