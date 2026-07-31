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
    <Icon size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
    <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>
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

  const pad = isMobile ? '24px 18px 48px' : '48px 44px 64px';
  const enter = (delay = 0) => `inicio-enter${mounted ? ' inicio-visible' : ''}${delay ? ` inicio-d${delay}` : ''}`;

  const cardHeader = {
    padding: '12px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    fontSize: 13,
    fontWeight: 700,
    color: '#111',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <style>{`
        @keyframes inicioFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes inicioLogoIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes inicioSoftFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes inicioIconSway {
          0%, 100% { transform: rotate(0deg); }
          33% { transform: rotate(-6deg); }
          66% { transform: rotate(6deg); }
        }
        .inicio-enter { opacity: 0; }
        .inicio-enter.inicio-visible { animation: inicioFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .inicio-d1.inicio-visible { animation-delay: 0.08s; }
        .inicio-d2.inicio-visible { animation-delay: 0.16s; }
        .inicio-d3.inicio-visible { animation-delay: 0.24s; }
        .inicio-d4.inicio-visible { animation-delay: 0.32s; }
        .inicio-d5.inicio-visible { animation-delay: 0.4s; }

        .inicio-logo-wrap.inicio-visible {
          animation: inicioLogoIn 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .inicio-logo-wrap.inicio-visible img {
          animation: inicioSoftFloat 5s ease-in-out 0.8s infinite;
        }
        .inicio-greeting-icon {
          opacity: 0;
          display: inline-block;
          vertical-align: middle;
        }
        .inicio-greeting-icon.inicio-visible {
          opacity: 1;
          animation: inicioIconSway 4s ease-in-out 1s infinite;
        }
        .inicio-motivo.inicio-visible {
          animation: inicioFadeUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards;
          opacity: 0;
        }

        .inicio-stat-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .inicio-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          z-index: 1;
          position: relative;
        }

        .inicio-chip {
          opacity: 0;
        }
        .inicio-chips-visible.inicio-visible .inicio-chip {
          animation: inicioFadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .inicio-row-enter { opacity: 0; }
        .inicio-rows-visible.inicio-visible .inicio-row-enter {
          animation: inicioFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .inicio-row-hover .inicio-row-chevron {
          transition: transform 0.18s ease, color 0.18s ease;
        }
        .inicio-row-hover:hover .inicio-row-chevron {
          transform: translateX(3px);
          color: #111 !important;
        }
        .inicio-row-hover:hover {
          background: #fafafa !important;
        }

        .inicio-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #fafafa;
          font-size: 12px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
          font-family: inherit;
        }
        .inicio-chip:hover {
          border-color: #111;
          background: #fff;
          transform: translateY(-1px);
        }

      `}</style>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: pad }}>
        {/* Hero — texto agrupado + logo centrado al bloque */}
        <div className={`${enter(0)}`} style={{ marginBottom: isMobile ? 36 : 48 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
              gridTemplateRows: 'auto auto auto',
              columnGap: isMobile ? 0 : 40,
              rowGap: isMobile ? 0 : 0,
              alignItems: 'center',
            }}
          >
            <h1 style={{
              gridColumn: 1,
              gridRow: 1,
              fontSize: isMobile ? 28 : 38,
              fontWeight: 800,
              color: '#111',
              fontFamily: 'Sora, system-ui, sans-serif',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}>
              <GreetingIcon
                className={`inicio-greeting-icon ${mounted ? 'inicio-visible' : ''}`}
                size={isMobile ? 28 : 32}
                style={{ color: '#6b7280', flexShrink: 0 }}
              />
              <span>
                {greeting.text},{' '}
                <span style={{ color: '#111' }}>{firstName}</span>
              </span>
            </h1>

            <p
              className={`inicio-motivo inicio-enter ${mounted ? 'inicio-visible' : ''}`}
              style={{
                gridColumn: 1,
                gridRow: 2,
                fontSize: isMobile ? 15 : 17,
                color: '#4b5563',
                margin: '10px 0 0',
                lineHeight: 1.5,
                maxWidth: 560,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <span>{motivationalPhrase}</span>
            </p>

            <p style={{
              gridColumn: 1,
              gridRow: 3,
              fontSize: 14,
              color: '#9ca3af',
              margin: '8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textTransform: 'capitalize',
            }}>
              <CalendarDays size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />
              {fechaHoy}
            </p>

            <div
              className={`inicio-logo-wrap inicio-enter ${mounted ? 'inicio-visible' : ''}`}
              style={{
                gridColumn: isMobile ? 1 : 2,
                gridRow: isMobile ? 4 : '1 / 4',
                justifySelf: isMobile ? 'start' : 'end',
                alignSelf: 'center',
                marginTop: isMobile ? 20 : -16,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <img
                src={logoImg}
                alt={CLINIC_NAME}
                style={{
                  height: isMobile ? 96 : 148,
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className={`${enter(2)}`} style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 1,
          background: '#e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 28,
        }}>
          <div className="inicio-stat-card" style={{ background: '#fff', padding: isMobile ? '16px 16px' : '20px 24px' }}>
            <StatLabel icon={RoleIcon}>Rol</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RoleIcon size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{roleLabel}</div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.4, paddingLeft: 26 }}>{roleHelper}</div>
          </div>
          <div className="inicio-stat-card" style={{ background: '#fff', padding: isMobile ? '16px 16px' : '20px 24px' }}>
            <StatLabel icon={Building2}>Sucursal activa</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{sucursalActiva}</div>
            </div>
          </div>
          <div className="inicio-stat-card" style={{ background: '#fff', padding: isMobile ? '16px 16px' : '20px 24px' }}>
            <StatLabel icon={MapPin}>Asignación</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{asignacion}</div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, paddingLeft: 26 }}>Perfil en personal</div>
          </div>
          <div className="inicio-stat-card" style={{ background: '#fff', padding: isMobile ? '16px 16px' : '20px 24px' }}>
            <StatLabel icon={KeyRound}>Acceso</StatLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{permissionCount} módulos</div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, paddingLeft: 26, display: 'flex', alignItems: 'center', gap: 4 }}>
              {locationConfirmed ? (
                <><CheckCircle2 size={11} style={{ color: '#6b7280' }} /> Ubicación confirmada</>
              ) : (
                <>Confirma ubicación en el menú</>
              )}
            </div>
          </div>
        </div>

        {/* Ubicación pendiente */}
        {catalogosReady && !locationConfirmed && (
          <div className={`${enter(3)}`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
            <div style={cardHeader}>
              <MapPin size={15} style={{ color: '#6b7280' }} />
              Confirmar sucursal de trabajo
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
                Selecciona tu sucursal antes de registrar actividad clínica.
              </p>
              <LocationSelector accentColor="#111" />
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
                  <Icon size={14} style={{ color: '#6b7280' }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabla accesos */}
        <div className={`${enter(4)} inicio-rows-visible`} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={cardHeader}>
            <LayoutDashboard size={15} style={{ color: '#6b7280' }} />
            Accesos rápidos
          </div>
          {quickAccess.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
              No tienes módulos asignados. Contacta a administración.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Módulo', 'Área', ''].map((h) => (
                    <th
                      key={h || 'action'}
                      style={{
                        textAlign: 'left',
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '.06em',
                        borderBottom: '1px solid #e5e7eb',
                        width: h === '' ? 48 : undefined,
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
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        animationDelay: `${0.04 * idx + 0.15}s`,
                      }}
                      onClick={() => navigate(item.path)}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Icon size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{item.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280' }}>
                        {item.group}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <ChevronRight size={15} className="inicio-row-chevron" style={{ color: '#9ca3af' }} />
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
          color: '#9ca3af',
          marginTop: 20,
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
