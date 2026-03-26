import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Activity, Building2, Calendar, DollarSign, Filter, Target } from 'lucide-react';

const ESTADOS_REALIZADA = new Set(['completada', 'finalizada', 'atendida']);

const toDateInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMoney = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));

const normalizeCita = (id, raw = {}) => {
  const fecha = raw.fecha || (raw.fechaHora ? String(raw.fechaHora).split('T')[0] : '');
  const estado = String(raw.estado || '').toLowerCase();
  const motivo = raw.motivo || 'Sin motivo';
  const motivoPrecio = Number(raw.motivoPrecio || 0);
  const sucursal = raw.sucursal || 'Sin sucursal';

  return {
    id,
    fecha,
    estado,
    motivo,
    motivoPrecio,
    sucursal,
    doctorNombre: raw.doctorNombre || 'Sin asignar',
    paciente: raw.paciente || 'Sin paciente',
    hora: raw.hora || (raw.fechaHora ? String(raw.fechaHora).split('T')[1]?.slice(0, 5) : '') || '--:--'
  };
};

const Reportes = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [selectedSucursal, setSelectedSucursal] = useState('todas');
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [citas, setCitas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const qSucursales = query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'));
    const unsub = onSnapshot(
      qSucursales,
      (snap) => {
        const sucursalesRows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.activo !== false && s.nombre);
        setSucursales(sucursalesRows);
        setIsLive(true);
      },
      (e) => {
        console.error(e);
        setError('No se pudieron cargar las sucursales en tiempo real.');
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');

    const qCitasDia = query(collection(db, 'citas'), where('fecha', '==', selectedDate));
    const unsub = onSnapshot(
      qCitasDia,
      (snap) => {
        const citasRows = snap.docs.map((d) => normalizeCita(d.id, d.data()));
        setCitas(citasRows);
        setIsLive(true);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError('No se pudieron cargar las citas en tiempo real. Verifica permisos y estructura de datos.');
        setCitas([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedDate]);

  const citasFiltradas = useMemo(() => {
    let rows = [...citas];
    if (selectedSucursal !== 'todas') {
      rows = rows.filter((c) => c.sucursal === selectedSucursal);
    }
    if (onlyCompleted) {
      rows = rows.filter((c) => ESTADOS_REALIZADA.has(c.estado));
    }
    return rows;
  }, [citas, selectedSucursal, onlyCompleted]);

  const metricas = useMemo(() => {
    const totalCitas = citasFiltradas.length;
    const ingresos = citasFiltradas.reduce((acc, c) => acc + Number(c.motivoPrecio || 0), 0);
    const ticketPromedio = totalCitas > 0 ? ingresos / totalCitas : 0;
    const medicosUnicos = new Set(citasFiltradas.map((c) => c.doctorNombre)).size;
    return { totalCitas, ingresos, ticketPromedio, medicosUnicos };
  }, [citasFiltradas]);

  const porSucursal = useMemo(() => {
    const map = new Map();
    citasFiltradas.forEach((cita) => {
      const key = cita.sucursal || 'Sin sucursal';
      if (!map.has(key)) map.set(key, { sucursal: key, citas: 0, ingresos: 0 });
      const curr = map.get(key);
      curr.citas += 1;
      curr.ingresos += Number(cita.motivoPrecio || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.citas - a.citas);
  }, [citasFiltradas]);

  const porMotivo = useMemo(() => {
    const map = new Map();
    citasFiltradas.forEach((cita) => {
      const key = cita.motivo || 'Sin motivo';
      if (!map.has(key)) map.set(key, { motivo: key, citas: 0, ingresos: 0, precioBase: Number(cita.motivoPrecio || 0) });
      const curr = map.get(key);
      curr.citas += 1;
      curr.ingresos += Number(cita.motivoPrecio || 0);
      if (!curr.precioBase && Number(cita.motivoPrecio || 0) > 0) curr.precioBase = Number(cita.motivoPrecio || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.ingresos - a.ingresos);
  }, [citasFiltradas]);

  const topCitas = useMemo(() => {
    return [...citasFiltradas]
      .sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
      .slice(0, 10);
  }, [citasFiltradas]);

  const chips = [
    { label: 'Citas realizadas', value: metricas.totalCitas, tone: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Activity size={13} /> },
    { label: 'Ingreso del dia', value: formatMoney(metricas.ingresos), tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <DollarSign size={13} /> },
    { label: 'Ticket promedio', value: formatMoney(metricas.ticketPromedio), tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Target size={13} /> },
    { label: 'Medicos activos', value: metricas.medicosUnicos, tone: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Building2 size={13} /> }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto pb-16 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
            Inteligencia de Negocios
          </h1>
          <p className="text-sm text-slate-500">Auditoria diaria de citas, sucursales y facturacion por motivo de consulta.</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          <Activity size={14} />
          {isLive ? 'Datos en tiempo real' : 'Conectando...'}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Fecha
            <div className="mt-1 relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Sucursal
            <select
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.target.value)}
              className="mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white min-w-[220px]"
            >
              <option value="todas">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyCompleted}
              onChange={(e) => setOnlyCompleted(e.target.checked)}
            />
            Solo realizadas
          </label>

          <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500">
            <Filter size={13} />
            {citasFiltradas.length} registro(s) auditables
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((item) => (
            <span key={item.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${item.tone}`}>
              {item.icon}
              <span>{item.label}:</span>
              <span>{item.value}</span>
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-sm">Cargando reportes...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Conteo de citas por sucursal</h2>
              <p className="text-xs text-slate-500">Cuantas citas realizadas e ingreso por cada sede del dia.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[520px]">
                <thead className="bg-slate-50">
                  <tr>
                    {['Sucursal', 'Citas', 'Ingreso', 'Ticket'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porSucursal.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-sm text-slate-500 text-center">Sin informacion para los filtros seleccionados.</td>
                    </tr>
                  )}
                  {porSucursal.map((row) => (
                    <tr key={row.sucursal} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{row.sucursal}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{row.citas}</td>
                      <td className="px-4 py-2.5 text-sm text-emerald-700 font-semibold">{formatMoney(row.ingresos)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{formatMoney(row.citas ? row.ingresos / row.citas : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Auditoria por motivo de consulta</h2>
              <p className="text-xs text-slate-500">Cuantos casos y cuanto ingreso genero cada motivo en el dia.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead className="bg-slate-50">
                  <tr>
                    {['Motivo', 'Precio base', 'Cantidad', 'Ingreso total'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porMotivo.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-sm text-slate-500 text-center">Sin motivos registrados para estos filtros.</td>
                    </tr>
                  )}
                  {porMotivo.map((row) => (
                    <tr key={row.motivo} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{row.motivo}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{formatMoney(row.precioBase)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{row.citas}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-emerald-700">{formatMoney(row.ingresos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Detalle operativo del dia</h2>
              <p className="text-xs text-slate-500">Muestra de citas auditadas para validacion administrativa.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[820px]">
                <thead className="bg-slate-50">
                  <tr>
                    {['Hora', 'Paciente', 'Motivo', 'Sucursal', 'Doctor', 'Estado', 'Monto'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topCitas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-sm text-slate-500 text-center">No hay citas para mostrar en el detalle.</td>
                    </tr>
                  )}
                  {topCitas.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-sm text-slate-600">{c.hora}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{c.paciente}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{c.motivo}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{c.sucursal}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{c.doctorNombre}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADOS_REALIZADA.has(c.estado) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {c.estado || 'sin estado'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-emerald-700">{formatMoney(c.motivoPrecio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Reportes;
