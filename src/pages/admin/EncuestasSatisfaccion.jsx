import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Star, MessageCircle, TrendingUp,
  CheckCircle, Clock, Send, Award, Search, BarChart3, Tag,
  User, Stethoscope, Heart, Zap
} from 'lucide-react';

const parseDateSafe = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatFechaCorta = (v) => {
  const d = parseDateSafe(v);
  if (!d) return '\u2014';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

const ASPECTOS_LABEL = {
  atencion_medica: 'Atenci\u00f3n m\u00e9dica',
  tiempo_espera: 'Tiempo de espera',
  instalaciones: 'Instalaciones',
  trato_personal: 'Trato del personal',
  explicacion_tratamiento: 'Tratamiento'
};

const isInPeriod = (fecha, periodo) => {
  const d = parseDateSafe(fecha);
  if (!d) return false;
  const now = new Date();
  const diff = (now - d) / 864e5;
  if (periodo === 'hoy') return diff < 1 && d.toDateString() === now.toDateString();
  if (periodo === '7dias') return diff <= 7;
  if (periodo === '30dias') return diff <= 30;
  return true;
};

const DOC_COLORS = ['#0077B6', '#059669', '#8b5cf6', '#dc2626', '#d97706', '#0891b2', '#6366f1', '#be185d'];
const ASP_COLORS = ['#0077B6', '#059669', '#8b5cf6', '#d97706', '#dc2626'];
const ASP_ICONS = [Heart, Stethoscope, Award, User, Zap];

const S = `
.es{font-family:'Sora','DM Sans',sans-serif;padding:28px;max-width:1440px;margin:0 auto;background:#f8fafc;min-height:100vh}
.es-hd{margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px}
.es-hd h1{font-size:1.35rem;font-weight:700;color:#0f172a;margin:0 0 3px;display:flex;align-items:center;gap:10px}
.es-hd p{font-size:.8rem;color:#64748b;margin:0}
.es-hd-r{display:flex;gap:8px;flex-wrap:wrap}
.es-sel{font-size:.78rem;padding:7px 32px 7px 11px;border:1px solid #e2e8f0;border-radius:8px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3l3 4 3-4'/%3E%3C/svg%3E") no-repeat right 10px center;color:#334155;font-family:inherit;cursor:pointer;appearance:none;-webkit-appearance:none;transition:border .15s}
.es-sel:hover{border-color:#94a3b8}
.es-sel:focus{outline:none;border-color:#0077B6;box-shadow:0 0 0 3px rgba(0,119,182,.07)}

.es-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:24px}
.es-k{background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;transition:box-shadow .2s}
.es-k:hover{box-shadow:0 4px 12px rgba(15,23,42,.05)}
.es-kr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.es-ki{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center}
.es-kl{font-size:.68rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px}
.es-kv{font-size:1.6rem;font-weight:800;color:#0f172a;margin:0;line-height:1.1}
.es-kv small{font-size:.75rem;color:#94a3b8;font-weight:400}
.es-ks{font-size:.7rem;color:#94a3b8;margin-top:3px}

.es-dt{font-size:.88rem;font-weight:700;color:#0f172a;margin:0 0 14px;display:flex;align-items:center;gap:8px}
.es-dg{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;margin-bottom:24px}
.es-dc{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:18px;cursor:pointer;transition:all .2s}
.es-dc:hover{border-color:#0077B6;box-shadow:0 4px 12px rgba(0,119,182,.07)}
.es-dc.on{border-color:#0077B6;background:linear-gradient(135deg,#f0f9ff,#fff);box-shadow:0 4px 12px rgba(0,119,182,.1)}
.es-dc-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.es-dc-av{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;color:#fff;flex-shrink:0}
.es-dc-nm{font-size:.83rem;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.es-dc-ct{font-size:.7rem;color:#94a3b8}
.es-dc-sg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.es-dc-sv{text-align:center;background:#f8fafc;border-radius:8px;padding:8px 4px}
.es-dc-sv b{font-size:1rem;font-weight:800;display:block;line-height:1.2}
.es-dc-sv small{font-size:.6rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px}

.es-cg{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.es-cc{background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0}
.es-ct{font-size:.82rem;font-weight:600;color:#0f172a;margin:0 0 16px;display:flex;align-items:center;gap:8px}

.es-br{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.es-bl{font-size:.78rem;color:#475569;min-width:90px;font-weight:500;display:flex;align-items:center;gap:5px}
.es-bt{flex:1;height:28px;background:#f1f5f9;border-radius:7px;overflow:hidden}
.es-bf{height:100%;border-radius:7px;display:flex;align-items:center;padding:0 10px;transition:width .5s}
.es-bf span{font-size:.68rem;font-weight:600;color:#fff;white-space:nowrap}
.es-bc{font-size:.78rem;color:#64748b;min-width:30px;text-align:right;font-weight:600}

.es-ai{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}
.es-ai:last-child{border-bottom:none}
.es-aicon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.es-ainfo{flex:1}
.es-anm{font-size:.8rem;font-weight:500;color:#334155}
.es-abar{height:4px;background:#f1f5f9;border-radius:2px;margin-top:4px;overflow:hidden}
.es-abf{height:100%;border-radius:2px;transition:width .5s}
.es-apct{font-size:.78rem;font-weight:700;min-width:40px;text-align:right}

.es-rg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px}
.es-ri{text-align:center;padding:14px 8px;border-radius:10px}
.es-rv{font-size:1.3rem;font-weight:800;display:block;line-height:1;margin-bottom:2px}
.es-rl{font-size:.66rem;color:#64748b;font-weight:500}

.es-dr{display:flex;gap:16px;padding-top:8px}
.es-di{flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:10px}
.es-dv{font-size:1.2rem;font-weight:800;display:block;margin-bottom:2px}
.es-dl{font-size:.66rem;color:#94a3b8}

.es-sep{font-size:.75rem;font-weight:600;color:#94a3b8;margin:20px 0 12px;padding-top:16px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:6px}

.es-tw{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden}
.es-th{padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.es-th h3{font-size:.85rem;font-weight:600;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px}
.es-th h3 span{font-weight:400;color:#94a3b8;font-size:.75rem}
.es-si{display:flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;transition:border .15s}
.es-si:focus-within{border-color:#0077B6;background:#fff}
.es-si input{border:none;background:transparent;font-size:.78rem;outline:none;width:200px;font-family:inherit;color:#334155}
table.es-tb{width:100%;border-collapse:collapse}
.es-tb th{font-size:.66rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;text-align:left;padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#fafbfc}
.es-tb td{font-size:.78rem;color:#334155;padding:11px 16px;border-bottom:1px solid #f1f5f9}
.es-tb tr:hover td{background:#f8fafc}
.es-bg{display:inline-flex;align-items:center;gap:4px;font-size:.68rem;font-weight:600;padding:3px 9px;border-radius:6px}
.es-dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.es-cd{font-family:'SF Mono','Fira Code',monospace;font-size:.72rem;background:#f0fdf4;color:#059669;padding:3px 8px;border-radius:5px;font-weight:600;letter-spacing:.4px}
.es-em{text-align:center;padding:60px 20px;color:#94a3b8}
.es-em p{font-size:.82rem;margin-top:8px}

@media(max-width:1200px){.es-kpis{grid-template-columns:repeat(3,1fr)}.es-cg{grid-template-columns:1fr}}
@media(max-width:768px){.es-kpis{grid-template-columns:repeat(2,1fr)}.es-dg{grid-template-columns:1fr}.es{padding:16px}}
@media(max-width:480px){.es-kpis{grid-template-columns:1fr}}
`;

const EncuestasSatisfaccion = () => {
  const [encuestas, setEncuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroDoctor, setFiltroDoctor] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('30dias');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'encuestas_satisfaccion'), orderBy('enviadaAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEncuestas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filtradas = useMemo(() => {
    return encuestas.filter(e => {
      if (!isInPeriod(e.enviadaAt, filtroPeriodo)) return false;
      if (filtroDoctor !== 'todos' && e.doctorNombre !== filtroDoctor) return false;
      if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!(e.pacienteNombre || '').toLowerCase().includes(q) &&
            !(e.doctorNombre || '').toLowerCase().includes(q) &&
            !(e.descuentoCodigo || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [encuestas, filtroPeriodo, filtroDoctor, filtroEstado, busqueda]);

  const doctorStats = useMemo(() => {
    const map = {};
    const en = encuestas.filter(e => isInPeriod(e.enviadaAt, filtroPeriodo));
    en.forEach(e => {
      const d = e.doctorNombre || 'Sin asignar';
      if (!map[d]) map[d] = { total: 0, completadas: 0, suma: 0, conC: 0, rSi: 0, rNo: 0 };
      map[d].total++;
      if (e.estado === 'completada') map[d].completadas++;
      if (e.calificacionNumerica > 0) { map[d].suma += e.calificacionNumerica; map[d].conC++; }
      if (e.recomendaria === 'si') map[d].rSi++;
      if (e.recomendaria === 'no') map[d].rNo++;
    });
    return Object.entries(map).map(([nombre, s]) => ({
      nombre, ...s,
      prom: s.conC > 0 ? s.suma / s.conC : 0,
      tasa: s.total > 0 ? Math.round((s.completadas / s.total) * 100) : 0,
      nps: s.completadas > 0 ? Math.round(((s.rSi - s.rNo) / s.completadas) * 100) : 0
    })).sort((a, b) => b.prom - a.prom);
  }, [encuestas, filtroPeriodo]);

  const stats = useMemo(() => {
    const total = filtradas.length;
    const comp = filtradas.filter(e => e.estado === 'completada');
    const conC = filtradas.filter(e => e.calificacionNumerica > 0);
    const tasa = total > 0 ? Math.round((comp.length / total) * 100) : 0;
    const prom = conC.length > 0 ? conC.reduce((s, e) => s + e.calificacionNumerica, 0) / conC.length : 0;
    const rSi = comp.filter(e => e.recomendaria === 'si').length;
    const rNo = comp.filter(e => e.recomendaria === 'no').length;
    const rTv = comp.filter(e => e.recomendaria === 'tal_vez').length;
    const nps = comp.length > 0 ? Math.round(((rSi - rNo) / comp.length) * 100) : 0;
    const cal = { excelente: 0, buena: 0, regular: 0 };
    conC.forEach(e => { if (cal[e.calificacionGeneral] !== undefined) cal[e.calificacionGeneral]++; });
    const maxC = Math.max(...Object.values(cal), 1);
    const asp = {};
    filtradas.forEach(e => { if (e.aspectoDestacado) asp[e.aspectoDestacado] = (asp[e.aspectoDestacado] || 0) + 1; });
    const totAsp = Object.values(asp).reduce((a, b) => a + b, 0) || 1;
    const aspArr = Object.entries(asp).sort((a, b) => b[1] - a[1]);
    return {
      total, comp: comp.length, tasa, prom, nps, rSi, rNo, rTv,
      cal, maxC, aspArr, totAsp,
      codes: filtradas.filter(e => e.descuentoCodigo).length,
      used: filtradas.filter(e => e.descuentoAplicado).length
    };
  }, [filtradas]);

  const npsC = stats.nps >= 50 ? '#059669' : stats.nps >= 0 ? '#d97706' : '#dc2626';

  if (loading) return (
    <div className="es" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <style>{S}</style>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <Clock size={28} style={{ marginBottom: 8, opacity: .5 }} />
        <p style={{ fontSize: '.82rem', margin: 0 }}>Cargando encuestas...</p>
      </div>
    </div>
  );

  return (
    <div className="es">
      <style>{S}</style>

      {/* Header */}
      <div className="es-hd">
        <div>
          <h1><MessageCircle size={22} color="#0077B6" /> Encuestas de Satisfacci&oacute;n</h1>
          <p>Resultados post-consulta por WhatsApp &middot; Tiempo real</p>
        </div>
        <div className="es-hd-r">
          <select className="es-sel" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="7dias">&Uacute;ltimos 7 d&iacute;as</option>
            <option value="30dias">&Uacute;ltimos 30 d&iacute;as</option>
            <option value="todo">Todo el historial</option>
          </select>
          <select className="es-sel" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="enviada">Enviadas</option>
            <option value="en_progreso">En progreso</option>
            <option value="completada">Completadas</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="es-kpis">
        <div className="es-k">
          <div className="es-kr">
            <span className="es-kl">Encuestas</span>
            <div className="es-ki" style={{ background: '#eff6ff' }}><Send size={16} color="#3b82f6" /></div>
          </div>
          <p className="es-kv">{stats.total}</p>
          <p className="es-ks">{stats.comp} completadas</p>
        </div>
        <div className="es-k">
          <div className="es-kr">
            <span className="es-kl">Tasa respuesta</span>
            <div className="es-ki" style={{ background: '#ecfdf5' }}><CheckCircle size={16} color="#059669" /></div>
          </div>
          <p className="es-kv">{stats.tasa}<small>%</small></p>
          <p className="es-ks">de enviadas</p>
        </div>
        <div className="es-k">
          <div className="es-kr">
            <span className="es-kl">Calificaci&oacute;n</span>
            <div className="es-ki" style={{ background: '#fffbeb' }}><Star size={16} color="#d97706" /></div>
          </div>
          <p className="es-kv">{stats.prom.toFixed(1)}<small>/5</small></p>
          <p className="es-ks">promedio general</p>
        </div>
        <div className="es-k">
          <div className="es-kr">
            <span className="es-kl">&Iacute;ndice NPS</span>
            <div className="es-ki" style={{ background: stats.nps >= 50 ? '#ecfdf5' : stats.nps >= 0 ? '#fffbeb' : '#fef2f2' }}>
              <TrendingUp size={16} color={npsC} />
            </div>
          </div>
          <p className="es-kv" style={{ color: npsC }}>{stats.nps > 0 ? '+' : ''}{stats.nps}</p>
          <p className="es-ks">{stats.nps >= 50 ? 'Excelente' : stats.nps >= 0 ? 'Bueno' : 'Necesita mejora'}</p>
        </div>
        <div className="es-k">
          <div className="es-kr">
            <span className="es-kl">Descuentos</span>
            <div className="es-ki" style={{ background: '#faf5ff' }}><Tag size={16} color="#8b5cf6" /></div>
          </div>
          <p className="es-kv">{stats.codes}</p>
          <p className="es-ks">{stats.used} canjeados</p>
        </div>
      </div>

      {/* Doctor cards */}
      {doctorStats.length > 0 && (
        <>
          <h3 className="es-dt"><Stethoscope size={16} color="#0077B6" /> Rendimiento por m&eacute;dico</h3>
          <div className="es-dg">
            {doctorStats.map((doc, i) => {
              const c = DOC_COLORS[i % DOC_COLORS.length];
              const ini = doc.nombre.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('');
              const on = filtroDoctor === doc.nombre;
              return (
                <div key={doc.nombre} className={`es-dc ${on ? 'on' : ''}`} onClick={() => setFiltroDoctor(on ? 'todos' : doc.nombre)}>
                  <div className="es-dc-top">
                    <div className="es-dc-av" style={{ background: c }}>{ini || 'Dr'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="es-dc-nm">{doc.nombre}</div>
                      <div className="es-dc-ct">{doc.total} encuestas &middot; {doc.tasa}% respuesta</div>
                    </div>
                    {on && <CheckCircle size={18} color="#0077B6" />}
                  </div>
                  <div className="es-dc-sg">
                    <div className="es-dc-sv">
                      <b style={{ color: c }}>{doc.prom.toFixed(1)}</b>
                      <small>Calif.</small>
                    </div>
                    <div className="es-dc-sv">
                      <b style={{ color: doc.nps >= 50 ? '#059669' : doc.nps >= 0 ? '#d97706' : '#dc2626' }}>
                        {doc.nps > 0 ? '+' : ''}{doc.nps}
                      </b>
                      <small>NPS</small>
                    </div>
                    <div className="es-dc-sv">
                      <b>{doc.completadas}</b>
                      <small>Completas</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Charts */}
      <div className="es-cg">
        {/* Calificaciones */}
        <div className="es-cc">
          <h3 className="es-ct"><BarChart3 size={16} color="#0077B6" /> Distribuci&oacute;n de calificaciones</h3>
          {[
            { k: 'excelente', l: 'Excelente', c: '#059669' },
            { k: 'buena', l: 'Buena', c: '#d97706' },
            { k: 'regular', l: 'Regular', c: '#dc2626' }
          ].map(it => {
            const n = stats.cal[it.k];
            const pct = stats.maxC > 0 ? (n / stats.maxC) * 100 : 0;
            return (
              <div key={it.k} className="es-br">
                <span className="es-bl">
                  <span className="es-dot" style={{ background: it.c }} /> {it.l}
                </span>
                <div className="es-bt">
                  <div className="es-bf" style={{ width: `${Math.max(pct, 3)}%`, background: it.c }}>
                    {pct > 15 && <span>{n}</span>}
                  </div>
                </div>
                <span className="es-bc">{n}</span>
              </div>
            );
          })}

          <div className="es-sep"><TrendingUp size={14} /> Recomendaci&oacute;n</div>
          <div className="es-rg">
            <div className="es-ri" style={{ background: '#ecfdf5' }}>
              <span className="es-rv" style={{ color: '#059669' }}>{stats.rSi}</span>
              <span className="es-rl">S&iacute;, seguro</span>
            </div>
            <div className="es-ri" style={{ background: '#fffbeb' }}>
              <span className="es-rv" style={{ color: '#d97706' }}>{stats.rTv}</span>
              <span className="es-rl">Tal vez</span>
            </div>
            <div className="es-ri" style={{ background: '#fef2f2' }}>
              <span className="es-rv" style={{ color: '#dc2626' }}>{stats.rNo}</span>
              <span className="es-rl">No</span>
            </div>
          </div>
        </div>

        {/* Aspectos */}
        <div className="es-cc">
          <h3 className="es-ct"><Award size={16} color="#8b5cf6" /> Aspectos destacados</h3>
          {stats.aspArr.length === 0 ? (
            <p style={{ fontSize: '.8rem', color: '#94a3b8', textAlign: 'center', padding: 30 }}>
              Sin datos de aspectos a&uacute;n
            </p>
          ) : stats.aspArr.map(([key, count], i) => {
            const Ic = ASP_ICONS[i % ASP_ICONS.length];
            const co = ASP_COLORS[i % ASP_COLORS.length];
            const pct = Math.round((count / stats.totAsp) * 100);
            return (
              <div key={key} className="es-ai">
                <div className="es-aicon" style={{ background: co + '12' }}>
                  <Ic size={15} color={co} />
                </div>
                <div className="es-ainfo">
                  <div className="es-anm">{ASPECTOS_LABEL[key] || key}</div>
                  <div className="es-abar">
                    <div className="es-abf" style={{ width: `${pct}%`, background: co }} />
                  </div>
                </div>
                <span className="es-apct" style={{ color: co }}>{pct}%</span>
              </div>
            );
          })}

          <div className="es-sep"><Tag size={14} /> Descuentos generados</div>
          <div className="es-dr">
            <div className="es-di">
              <span className="es-dv" style={{ color: '#059669' }}>{stats.codes}</span>
              <span className="es-dl">C&oacute;digos emitidos</span>
            </div>
            <div className="es-di">
              <span className="es-dv" style={{ color: '#0077B6' }}>{stats.used}</span>
              <span className="es-dl">C&oacute;digos canjeados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="es-tw">
        <div className="es-th">
          <h3>
            <MessageCircle size={15} color="#0077B6" />
            Detalle de encuestas <span>({filtradas.length})</span>
          </h3>
          <div className="es-si">
            <Search size={14} color="#94a3b8" />
            <input
              placeholder="Buscar paciente, doctor o c&oacute;digo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="es-em">
            <MessageCircle size={36} strokeWidth={1.5} />
            <p>Sin encuestas para los filtros seleccionados</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="es-tb">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Doctor</th>
                  <th>Calificaci&oacute;n</th>
                  <th>Aspecto</th>
                  <th>Recomienda</th>
                  <th>C&oacute;digo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 100).map(e => {
                  const cc = e.calificacionNumerica >= 5 ? '#059669'
                    : e.calificacionNumerica >= 4 ? '#d97706'
                    : e.calificacionNumerica >= 3 ? '#dc2626' : '#94a3b8';
                  const cl = e.calificacionGeneral
                    ? e.calificacionGeneral.charAt(0).toUpperCase() + e.calificacionGeneral.slice(1)
                    : null;
                  const ec = e.estado === 'completada' ? '#059669'
                    : e.estado === 'en_progreso' ? '#d97706' : '#3b82f6';
                  const eb = e.estado === 'completada' ? '#ecfdf5'
                    : e.estado === 'en_progreso' ? '#fffbeb' : '#eff6ff';
                  const el = e.estado === 'completada' ? 'Completada'
                    : e.estado === 'en_progreso' ? 'En progreso' : 'Enviada';
                  const rc = e.recomendaria === 'si' ? '#059669'
                    : e.recomendaria === 'no' ? '#dc2626'
                    : e.recomendaria === 'tal_vez' ? '#d97706' : null;
                  const rl = e.recomendaria === 'si' ? 'S\u00ed'
                    : e.recomendaria === 'no' ? 'No'
                    : e.recomendaria === 'tal_vez' ? 'Tal vez' : null;

                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 500 }}>{e.pacienteNombre || '\u2014'}</td>
                      <td>{e.doctorNombre || '\u2014'}</td>
                      <td>
                        {cl ? (
                          <span className="es-bg" style={{ background: cc + '14', color: cc }}>
                            <Star size={11} fill={cc} /> {cl}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td style={{ fontSize: '.73rem' }}>
                        {ASPECTOS_LABEL[e.aspectoDestacado] || e.aspectoTexto || '\u2014'}
                      </td>
                      <td>
                        {rl ? (
                          <span style={{ color: rc, fontWeight: 600, fontSize: '.78rem' }}>{rl}</span>
                        ) : '\u2014'}
                      </td>
                      <td>
                        {e.descuentoCodigo
                          ? <span className="es-cd">{e.descuentoCodigo}</span>
                          : '\u2014'}
                      </td>
                      <td>
                        <span className="es-bg" style={{ background: eb, color: ec }}>{el}</span>
                      </td>
                      <td style={{ fontSize: '.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatFechaCorta(e.enviadaAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EncuestasSatisfaccion;
