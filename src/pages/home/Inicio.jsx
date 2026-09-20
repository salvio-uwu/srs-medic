import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, BookOpen, Briefcase, Building2, CalendarDays, CheckCircle2,
  ChevronRight, Clipboard, ClipboardList, Crown, DollarSign, Eye, FileText,
  FlaskConical, HeartPulse, Home, KeyRound, LayoutDashboard, MapPin, MessageCircle,
  Moon, Package, Receipt, Shield, ShieldCheck, SprayCan, Stethoscope, Sun, Sunset,
  Syringe, Tag, UserCog, Users, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';
import { getNavItemsForUser, getQuickAccessItems } from '../../config/navigationCatalog';
import LocationSelector from '../../components/LocationSelector';
import useIsMobile from '../../hooks/useIsMobile';
import logoImg from '../../assets/logo_azul.png';
import { pickMotivationalPhrase } from '../../utils/motivationalPhrases';

const CLINIC_NAME = 'Centro Médico Santa Cruz';

const ICON_MAP = {
  Home, CalendarDays, Users, Stethoscope, FileText, BookOpen, LayoutDashboard,
  Syringe, Clipboard, Crown, ClipboardList, HeartPulse, Package, Receipt,
  UserCog, Tag, BarChart3, MessageCircle, Activity, Eye, FlaskConical,
  ShieldCheck, DollarSign, SprayCan
};

const ROLE_LABELS = {
  admin: 'Administrador',
  admin_maestro: 'Admin maestro',
  administrador: 'Administrador',
  medico: 'Médico',
  doctor: 'Médico',
  enfermeria: 'Enfermería',
  enfermera: 'Enfermería',
  enfermero: 'Enfermería',
  jefa_enfermeria: 'Jefa de enfermería',
  jefa: 'Jefa de enfermería',
  rh: 'Recursos Humanos',
  recepcion: 'Recepción',
  intendencia: 'Intendencia',
  limpieza: 'Intendencia',
  operativo: 'Operativo',
};

const ROLE_HELPERS = {
  admin: 'Gestión central, catálogos y configuración del sistema.',
  admin_maestro: 'Control total del sistema.',
  administrador: 'Control operativo del centro médico.',
  medico: 'Consulta médica y expediente clínico.',
  doctor: 'Consulta médica y expediente clínico.',
  enfermeria: 'Triage, hoja de enfermería y seguimiento de pacientes.',
  enfermera: 'Triage, hoja de enfermería y seguimiento de pacientes.',
  enfermero: 'Triage, hoja de enfermería y seguimiento de pacientes.',
  jefa_enfermeria: 'Supervisión y auditoría del área de enfermería.',
  jefa: 'Supervisión y auditoría del área de enfermería.',
  rh: 'Auditoría de personal, finanzas e inventario.',
  recepcion: 'Admisión de pacientes y agenda general.',
  intendencia: 'Bitácoras de limpieza y operaciones internas.',
  limpieza: 'Bitácoras de limpieza y operaciones internas.',
  operativo: 'Apoyo administrativo interno.',
};

const ROLE_ICONS = {
  admin: Shield,
  admin_maestro: Shield,
  administrador: Shield,
  medico: Stethoscope,
  doctor: Stethoscope,
  enfermeria: HeartPulse,
  enfermera: HeartPulse,
  enfermero: HeartPulse,
  jefa_enfermeria: Crown,
  jefa: Crown,
  rh: Briefcase,
  recepcion: Users,
  intendencia: SprayCan,
  limpieza: SprayCan,
  operativo: Activity,
};

const normalizeRole = (role = '') =>
  String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Buenos días', Icon: Sun };
  if (h < 19) return { text: 'Buenas tardes', Icon: Sunset };
  return { text: 'Buenas noches', Icon: Moon };
};

const StatLabel = ({ icon: Icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
    <Icon size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
    <span style={{
      fontSize: 10, fontWeight: 600, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.02em',
      fontFamily: "'Sora', system-ui, sans-serif",
    }}>
      {children}
    </span>
  </div>
);

const Inicio = () => {
  const { user } = useAuth();
  const {
    locationConfirmed,
    catalogosReady,
    sessionSucursal,
    sessionConsultorio,
    isDoctorRole,
  } = useSessionLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  const roleKey = normalizeRole(user?.rol);
  const roleLabel = ROLE_LABELS[roleKey] || user?.rol || 'Usuario';

  const motivationalPhrase = useMemo(() => pickMotivationalPhrase(roleKey, user?.uid), [roleKey, user?.uid]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const roleHelper = ROLE_HELPERS[roleKey] || 'Acceso según permisos asignados.';
  const RoleIcon = ROLE_ICONS[roleKey] || UserCog;

  const firstName = user?.nombre?.split(' ')[0] || 'Usuario';
  const greeting = getGreeting();
  const GreetingIcon = greeting.Icon;

  const sucursalActiva = sessionSucursal?.nombre
    || user?.sessionSucursalNombre
    || user?.sucursalActual
    || 'Sin sucursal';
  const consultorioActivo = isDoctorRole
    ? (sessionConsultorio?.nombre || user?.sessionConsultorioNombre || '')
    : '';
  const asignacion = user?.consultorioRecurrente || user?.areaRecurrente || '—';
  const permissionCount = getNavItemsForUser(user).filter((i) => !i.always).length;
  const quickAccess = useMemo(() => getQuickAccessItems(user, { limit: 8 }), [user]);

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pad = isMobile ? '20px 16px 40px' : '32px 28px 48px';
  const enter = (delay = 0) => `inicio-enter${mounted ? ' inicio-visible' : ''}${delay ? ` inicio-d${delay}` : ''}`;

  const cardHeader = {
    padding: '12px 18px',
    borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
    background: '#fff',
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: "'Sora', system-ui, sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <style>{`
        .inicio-page {
          font-family: 'DM Sans', 'Sora', system-ui, sans-serif;
          color: #0f172a;
        }
        @keyframes inicioFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .inicio-enter { opacity: 0; }
        .inicio-enter.inicio-visible { animation: inicioFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .inicio-d1.inicio-visible { animation-delay: 0.06s; }
        .inicio-d2.inicio-visible { animation-delay: 0.12s; }
        .inicio-d3.inicio-visible { animation-delay: 0.18s; }
        .inicio-d4.inicio-visible { animation-delay: 0.24s; }
        .inicio-d5.inicio-visible { animation-delay: 0.3s; }

        .inicio-stat-card {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .inicio-stat-card:hover {
          border-color: rgba(15, 23, 42, 0.1);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .inicio-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 10px;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
          font-family: inherit;
          opacity: 0;
        }
        .inicio-chips-visible.inicio-visible .inicio-chip {
          animation: inicioFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .inicio-chip:hover {
          color: #0f172a;
          background: rgba(15, 23, 42, 0.035);
          border-color: rgba(15, 23, 42, 0.12);
        }

        .inicio-row-enter { opacity: 0; }
        .inicio-rows-visible.inicio-visible .inicio-row-enter {
          animation: inicioFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .inicio-row-hover .inicio-row-chevron {
          transition: transform 0.18s ease, color 0.18s ease;
        }
        .inicio-row-hover:hover .inicio-row-chevron {
          transform: translateX(3px);
          color: #0f172a !important;
        }
        .inicio-row-hover:hover {
          background: rgba(15, 23, 42, 0.025) !important;
        }

        .inicio-panel {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }
      `}</style>

      <div className="inicio-page" style={{ maxWidth: 1280, margin: '0 auto', padding: pad }}>
        {/* Hero */}
        <div className={`${enter(0)}`} style={{ marginBottom: isMobile ? 28 : 32 }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 16 : 24,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: isMobile ? 26 : 32,
                fontWeight: 650,
                color: '#0f172a',
                fontFamily: 'Sora, system-ui, sans-serif',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}>
                <GreetingIcon size={isMobile ? 24 : 28} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <span>
                  {greeting.text},{' '}
                  <span style={{ color: '#0f172a' }}>{firstName}</span>
                </span>
              </h1>

              <p style={{
                fontSize: isMobile ? 14 : 15,
                color: '#64748b',
                margin: '10px 0 0',
                lineHeight: 1.55,
                maxWidth: 560,
                fontWeight: 400,
              }}>
                {motivationalPhrase}
              </p>

              <p style={{
                fontSize: 13,
                color: '#94a3b8',
                margin: '10px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textTransform: 'capitalize',
              }}>
                <CalendarDays size={14} style={{ flexShrink: 0 }} />
                {fechaHoy}
              </p>
            </div>

            {!isMobile && (
              <img
                src={logoImg}
                alt={CLINIC_NAME}
                style={{ height: 52, width: 'auto', objectFit: 'contain', flexShrink: 0, opacity: 0.92 }}
              />
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className={`${enter(2)}`} style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}>
          <div className="inicio-stat-card" style={{ padding: isMobile ? '14px 14px' : '18px 20px' }}>
            <StatLabel icon={RoleIcon}>Rol</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RoleIcon size={17} style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{roleLabel}</div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.4, paddingLeft: 25 }}>{roleHelper}</div>
          </div>
          <div className="inicio-stat-card" style={{ padding: isMobile ? '14px 14px' : '18px 20px' }}>
            <StatLabel icon={Building2}>Sucursal activa</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={17} style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{sucursalActiva}</div>
            </div>
          </div>
          <div className="inicio-stat-card" style={{ padding: isMobile ? '14px 14px' : '18px 20px' }}>
            <StatLabel icon={MapPin}>Asignación</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={17} style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{asignacion}</div>
            </div>
            {consultorioActivo ? (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 25 }}>{consultorioActivo}</div>
            ) : (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 25 }}>Perfil en personal</div>
            )}
          </div>
          <div className="inicio-stat-card" style={{ padding: isMobile ? '14px 14px' : '18px 20px' }}>
            <StatLabel icon={KeyRound}>Acceso</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={17} style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{permissionCount} módulos</div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 25, display: 'flex', alignItems: 'center', gap: 4 }}>
              {locationConfirmed ? (
                <><CheckCircle2 size={11} /> Ubicación confirmada</>
              ) : (
                <>Confirma ubicación en el menú</>
              )}
            </div>
          </div>
        </div>

        {/* Ubicación pendiente */}
        {catalogosReady && !locationConfirmed && (
          <div className={`inicio-panel ${enter(3)}`} style={{ marginBottom: 20 }}>
            <div style={cardHeader}>
              <MapPin size={15} style={{ color: '#94a3b8' }} />
              Confirmar sucursal de trabajo
            </div>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
                Selecciona tu sucursal antes de registrar actividad clínica.
              </p>
              <LocationSelector accentColor="#0f172a" />
            </div>
          </div>
        )}

        {/* Chips rápidos */}
        {quickAccess.length > 0 && (
          <div className={`${enter(3)} inicio-chips-visible`} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {quickAccess.slice(0, isMobile ? 4 : 6).map((item, idx) => {
              const Icon = ICON_MAP[item.icon] || Activity;
              return (
                <button
                  key={`chip-${item.id}`}
                  type="button"
                  className="inicio-chip"
                  style={{ animationDelay: `${0.05 * idx + 0.2}s` }}
                  onClick={() => navigate(item.path)}
                >
                  <Icon size={14} style={{ color: '#94a3b8' }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabla accesos */}
        <div className={`inicio-panel ${enter(4)} inicio-rows-visible`}>
          <div style={cardHeader}>
            <LayoutDashboard size={15} style={{ color: '#94a3b8' }} />
            Accesos rápidos
          </div>
          {quickAccess.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
              No tienes módulos asignados. Contacta a administración.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Módulo', 'Área', ''].map((h) => (
                    <th
                      key={h || 'action'}
                      style={{
                        textAlign: 'left',
                        padding: '10px 18px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
                        width: h === '' ? 48 : undefined,
                        fontFamily: "'Sora', system-ui, sans-serif",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quickAccess.map((item, idx) => {
                  const Icon = ICON_MAP[item.icon] || Activity;
                  return (
                    <tr
                      key={item.id}
                      className="inicio-row-hover inicio-row-enter"
                      style={{
                        borderBottom: '1px solid rgba(15, 23, 42, 0.04)',
                        cursor: 'pointer',
                        animationDelay: `${0.04 * idx + 0.15}s`,
                      }}
                      onClick={() => navigate(item.path)}
                    >
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Icon size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{item.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: '#64748b' }}>
                        {item.group}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <ChevronRight size={15} className="inicio-row-chevron" style={{ color: '#94a3b8' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{
          fontSize: 12,
          color: '#94a3b8',
          marginTop: 16,
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Activity size={13} />
          Usa el menú lateral para navegar entre módulos autorizados.
        </p>
      </div>
    </>
  );
};

export default Inicio;
