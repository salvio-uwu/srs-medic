// src/components/pdf/InformeMonitorPDF.jsx
// Informe de actividad operativa — @react-pdf/renderer

import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const C = {
  black:  '#111827',
  gray800: '#1f2937',
  gray700: '#374151',
  gray600: '#4b5563',
  gray500: '#6b7280',
  gray300: '#d1d5db',
  gray200: '#e5e7eb',
  gray100: '#f3f4f6',
  white:  '#ffffff',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.black,
    backgroundColor: C.white,
    lineHeight: 1.35,
  },
  header: { marginBottom: 8 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 15, marginBottom: 2 },
  subtitle: { fontSize: 9, color: C.gray600 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metaItem: { flexDirection: 'row', gap: 4 },
  metaLabel: { fontSize: 8, color: C.gray600 },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray800 },
  sectionHeader: { marginTop: 8, marginBottom: 4 },
  sectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.gray700, textTransform: 'uppercase', letterSpacing: 0.3 },
  table: { borderWidth: 1, borderColor: C.gray200, marginBottom: 6 },
  thead: { flexDirection: 'row', backgroundColor: C.gray100, borderBottomWidth: 1, borderBottomColor: C.gray200 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.gray800, paddingVertical: 4, paddingHorizontal: 5, minWidth: 0 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.gray200 },
  td: { fontSize: 8, color: C.gray800, paddingVertical: 3, paddingHorizontal: 5, minWidth: 0 },
  tdNum: { fontSize: 8, color: C.gray800, paddingVertical: 3, paddingHorizontal: 5, textAlign: 'right', minWidth: 0 },
  tdCenter: { fontSize: 8, color: C.gray800, paddingVertical: 3, paddingHorizontal: 5, textAlign: 'center', minWidth: 0 },
  cellHeader: { minWidth: 0, flexShrink: 1 },
  cell: { minWidth: 0, flexShrink: 1 },
  noteList: { marginTop: 4 },
  noteRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  noteDash: { fontSize: 8, color: C.gray600 },
  noteText: { fontSize: 8, color: C.gray800, flex: 1 },
  summaryWrap: { borderWidth: 1, borderColor: C.gray200, padding: 6, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  barLabel: { width: 90, fontSize: 8, color: C.gray700 },
  barTrack: { flex: 1, height: 6, backgroundColor: C.gray200, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: C.gray600 },
  barValue: { width: 40, fontSize: 8, color: C.gray800, textAlign: 'right' },
  summaryFooter: { marginTop: 2, borderTopWidth: 1, borderTopColor: C.gray200, paddingTop: 4 },
  summaryText: { fontSize: 8, color: C.gray700 },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: C.gray500 },
});

const fmt$ = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
    .format(Number(n || 0));

const fmtFecha = (dateStr) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const fmtNow = () =>
  new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const fmtPct = (v) => (v == null ? '—' : `${Math.round(Number(v))}%`);

function Section({ label }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionLabel}>{label}</Text>
    </View>
  );
}

const InformeMonitorPDF = ({
  fecha,
  filtros = {},
  generadoPor = '',
  kpis = {},
  medicos = [],
  enfermeria = [],
  citasPorSucursal = [],
  flujoPorHora = [],
}) => {
  const generadoEn = fmtNow();
  const fechaLabel = fmtFecha(fecha);

  const medicosActivos = medicos
    .filter(m => (m.asigF ?? m.asignadas ?? 0) > 0)
    .sort((a, b) => (b.realF ?? b.realizadas ?? 0) - (a.realF ?? a.realizadas ?? 0));

  const enfActivos = enfermeria
    .filter(e => (e.triagesCount + e.notasCount + e.ordenesCount + (e.realizadas ?? 0)) > 0)
    .sort((a, b) => (b.triagesCount + b.notasCount + b.ordenesCount) - (a.triagesCount + a.notasCount + a.ordenesCount));

  const pctGlobal = kpis.totalCitas > 0
    ? Math.round(((kpis.citasRealizadas ?? 0) / kpis.totalCitas) * 100)
    : null;

  const obs = [];
  if (pctGlobal != null) {
    if (pctGlobal >= 80) obs.push(`Cumplimiento global ${pctGlobal}% (por encima del umbral recomendado).`);
    else if (pctGlobal >= 60) obs.push(`Cumplimiento global ${pctGlobal}% (rango aceptable, con oportunidad de mejora).`);
    else obs.push(`Cumplimiento global ${pctGlobal}% (por debajo del umbral minimo).`);
  }
  const bajoCumplimiento = medicosActivos.filter(m => {
    const t = m.tasaF ?? m.tasaCumplimiento;
    return t != null && t < 60;
  });
  if (bajoCumplimiento.length > 0) {
    const nombres = bajoCumplimiento.slice(0, 3).map(m => m.nombre.split(' ').slice(0, 2).join(' ')).join(', ');
    obs.push(`${bajoCumplimiento.length} medico(s) con cumplimiento menor al 60%: ${nombres}${bajoCumplimiento.length > 3 ? ' y otros.' : '.'}`);
  }
  const altasCancelaciones = medicosActivos.filter(m => {
    const canc = m.cancF ?? m.canceladas ?? 0;
    const asig = m.asigF ?? m.asignadas ?? 1;
    return canc > 0 && (canc / asig) >= 0.2;
  });
  if (altasCancelaciones.length > 0)
    obs.push(`${altasCancelaciones.length} medico(s) con tasa de cancelacion >= 20% en el periodo.`);
  if ((kpis.totalRotaciones ?? 0) > 5)
    obs.push(`Se registraron ${kpis.totalRotaciones} rotaciones de consultorio (nivel elevado).`);
  else if ((kpis.totalRotaciones ?? 0) > 0)
    obs.push(`${kpis.totalRotaciones} rotacion(es) de consultorio registradas (nivel normal).`);
  if (flujoPorHora.length > 0) {
    const horaPico = [...flujoPorHora].sort((a, b) => b.realizadas - a.realizadas)[0];
    if (horaPico?.realizadas > 0)
      obs.push(`Mayor concentracion en el horario ${horaPico.hora} con ${horaPico.realizadas} atenciones realizadas.`);
  }
  if (obs.length === 0) obs.push('Sin observaciones relevantes para este periodo.');

  const sucursalLabel = filtros.sucursal && filtros.sucursal !== 'all' ? filtros.sucursal : 'Todas las sucursales';
  const medicoLabel = filtros.medico && filtros.medico !== 'all' ? filtros.medico : 'Todos';
  const consultorioLabel = filtros.consultorio && filtros.consultorio !== 'all' ? filtros.consultorio : 'Todos';

  const resumenRows = [
    { label: 'Total de citas', value: kpis.totalCitas ?? 0 },
    { label: 'Realizadas', value: kpis.citasRealizadas ?? 0 },
    { label: 'En consulta', value: kpis.citasEnCurso ?? 0 },
    { label: 'Canceladas', value: kpis.citasCanceladas ?? 0 },
    { label: 'Cumplimiento promedio', value: fmtPct(kpis.eficienciaPromedio) },
    { label: 'Ingresos totales', value: fmt$(kpis.ingresoTotal) },
    { label: 'Triajes', value: kpis.totalTriajes ?? 0 },
    { label: 'Rotaciones', value: kpis.totalRotaciones ?? 0 },
  ];

  const resumenGrafico = [
    { label: 'Total', value: kpis.totalCitas ?? 0 },
    { label: 'Realizadas', value: kpis.citasRealizadas ?? 0 },
    { label: 'En consulta', value: kpis.citasEnCurso ?? 0 },
    { label: 'Canceladas', value: kpis.citasCanceladas ?? 0 },
  ];

  const maxResumen = Math.max(...resumenGrafico.map(r => r.value), 1);
  const cumplimientoPct = pctGlobal ?? (kpis.eficienciaPromedio ?? 0);

  const horasConDatos = flujoPorHora.filter(h => h.realizadas + h.canceladas + h.otras > 0);

  return (
    <Document>
      <Page size="LETTER" style={s.page} orientation="landscape">
        <View style={s.header}>
          <Text style={s.title}>Informe de Actividad Operativa</Text>
          <Text style={s.subtitle}>{fechaLabel}</Text>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaItem}><Text style={s.metaLabel}>Sucursal:</Text><Text style={s.metaValue}>{sucursalLabel}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Consultorio:</Text><Text style={s.metaValue}>{consultorioLabel}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Medico:</Text><Text style={s.metaValue}>{medicoLabel}</Text></View>
          {generadoPor ? (
            <View style={s.metaItem}><Text style={s.metaLabel}>Generado por:</Text><Text style={s.metaValue}>{generadoPor}</Text></View>
          ) : null}
          <View style={[s.metaItem, { marginLeft: 'auto' }]}>
            <Text style={s.metaLabel}>Emision:</Text>
            <Text style={s.metaValue}>{generadoEn}</Text>
          </View>
        </View>

        <Section label="Resumen ejecutivo" />
        <View style={s.table}>
          <View style={s.thead}>
            <View style={[s.cellHeader, { flexGrow: 70, flexBasis: 0 }]}>
              <Text style={s.th}>Metrica</Text>
            </View>
            <View style={[s.cellHeader, { flexGrow: 30, flexBasis: 0 }]}>
              <Text style={[s.th, { textAlign: 'right' }]}>Valor</Text>
            </View>
          </View>
          {resumenRows.map((r, i) => (
            <View key={i} style={s.tr}>
              <View style={[s.cell, { flexGrow: 70, flexBasis: 0 }]}>
                <Text style={s.td}>{r.label}</Text>
              </View>
              <View style={[s.cell, { flexGrow: 30, flexBasis: 0 }]}>
                <Text style={s.tdNum}>{r.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {citasPorSucursal.length > 0 && (
          <>
            <Section label="Citas e ingresos por sucursal" />
            <View style={s.table}>
              <View style={s.thead}>
                <View style={[s.cellHeader, { flexGrow: 32, flexBasis: 0 }]}>
                  <Text style={s.th}>Sucursal</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 10, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'right' }]}>Total</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'right' }]}>Realizadas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'right' }]}>Canceladas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 16, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'right' }]}>Ingresos</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 18, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Cumplimiento</Text>
                </View>
              </View>
              {citasPorSucursal.map((row, i) => {
                const pct = row.total > 0 ? Math.round((row.realizadas / row.total) * 100) : 0;
                return (
                  <View key={row.name || i} style={s.tr}>
                    <View style={[s.cell, { flexGrow: 32, flexBasis: 0 }]}>
                      <Text style={s.td}>{row.name}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 10, flexBasis: 0 }]}>
                      <Text style={s.tdNum}>{row.total}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                      <Text style={s.tdNum}>{row.realizadas}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                      <Text style={s.tdNum}>{row.canceladas ?? 0}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 16, flexBasis: 0 }]}>
                      <Text style={s.tdNum}>{fmt$(row.ingresos ?? 0)}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 18, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{fmtPct(pct)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {medicosActivos.length > 0 && (
          <>
            <Section label={`Rendimiento medico (${medicosActivos.length})`} />
            <View style={s.table}>
              <View style={s.thead}>
                <View style={[s.cellHeader, { flexGrow: 24, flexBasis: 0 }]}>
                  <Text style={s.th}>Nombre</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 14, flexBasis: 0 }]}>
                  <Text style={s.th}>Sucursal</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 8, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Asig.</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 10, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Realizadas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 8, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Canc.</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Cumplimiento</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 24, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'right' }]}>Ingresos</Text>
                </View>
              </View>
              {medicosActivos.map((m, i) => {
                const asig = m.asigF ?? m.asignadas ?? 0;
                const real = m.realF ?? m.realizadas ?? 0;
                const canc = m.cancF ?? m.canceladas ?? 0;
                const ingr = m.ingrF ?? m.ingresos ?? 0;
                const tasa = m.tasaF ?? m.tasaCumplimiento ?? null;
                return (
                  <View key={m.uid || i} style={s.tr}>
                    <View style={[s.cell, { flexGrow: 24, flexBasis: 0 }]}>
                      <Text style={s.td}>{m.nombre}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 14, flexBasis: 0 }]}>
                      <Text style={s.td}>{m.sucursal !== '—' ? m.sucursal : ''}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 8, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{asig}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 10, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{real}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 8, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{canc}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{fmtPct(tasa)}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 24, flexBasis: 0 }]}>
                      <Text style={s.tdNum}>{fmt$(ingr)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {enfActivos.length > 0 && (
          <>
            <Section label={`Actividad de enfermeria (${enfActivos.length})`} />
            <View style={s.table}>
              <View style={s.thead}>
                <View style={[s.cellHeader, { flexGrow: 28, flexBasis: 0 }]}>
                  <Text style={s.th}>Nombre</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 16, flexBasis: 0 }]}>
                  <Text style={s.th}>Sucursal</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Triajes</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Notas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 12, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Ordenes</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 20, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Citas realizadas</Text>
                </View>
              </View>
              {enfActivos.map((e, i) => (
                <View key={e.uid || i} style={s.tr}>
                  <View style={[s.cell, { flexGrow: 28, flexBasis: 0 }]}>
                    <Text style={s.td}>{e.nombre}</Text>
                  </View>
                  <View style={[s.cell, { flexGrow: 16, flexBasis: 0 }]}>
                    <Text style={s.td}>{e.sucursal !== '—' ? e.sucursal : ''}</Text>
                  </View>
                  <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                    <Text style={s.tdCenter}>{e.triagesCount ?? 0}</Text>
                  </View>
                  <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                    <Text style={s.tdCenter}>{e.notasCount ?? 0}</Text>
                  </View>
                  <View style={[s.cell, { flexGrow: 12, flexBasis: 0 }]}>
                    <Text style={s.tdCenter}>{e.ordenesCount ?? 0}</Text>
                  </View>
                  <View style={[s.cell, { flexGrow: 20, flexBasis: 0 }]}>
                    <Text style={s.tdCenter}>{e.realizadas ?? 0}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {horasConDatos.length > 0 && (
          <>
            <Section label="Flujo de citas por hora" />
            <View style={s.table}>
              <View style={s.thead}>
                <View style={[s.cellHeader, { flexGrow: 15, flexBasis: 0 }]}>
                  <Text style={s.th}>Hora</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 17, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Realizadas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 17, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Canceladas</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 17, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Otras</Text>
                </View>
                <View style={[s.cellHeader, { flexGrow: 34, flexBasis: 0 }]}>
                  <Text style={[s.th, { textAlign: 'center' }]}>Total</Text>
                </View>
              </View>
              {horasConDatos.map((h, i) => {
                const total = h.realizadas + h.canceladas + h.otras;
                return (
                  <View key={h.hora || i} style={s.tr}>
                    <View style={[s.cell, { flexGrow: 15, flexBasis: 0 }]}>
                      <Text style={s.td}>{h.hora}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 17, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{h.realizadas}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 17, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{h.canceladas || 0}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 17, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{h.otras || 0}</Text>
                    </View>
                    <View style={[s.cell, { flexGrow: 34, flexBasis: 0 }]}>
                      <Text style={s.tdCenter}>{total}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Section label="Observaciones" />
        <View style={s.noteList}>
          {obs.map((o, i) => (
            <View key={i} style={s.noteRow}>
              <Text style={s.noteDash}>-</Text>
              <Text style={s.noteText}>{o}</Text>
            </View>
          ))}
        </View>

        <Section label="Resumen final" />
        <View style={s.summaryWrap} wrap={false}>
          {resumenGrafico.map((item) => {
            const pct = maxResumen > 0 ? Math.min(100, Math.round((item.value / maxResumen) * 100)) : 0;
            return (
              <View key={item.label} style={s.barRow}>
                <Text style={s.barLabel}>{item.label}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.barValue}>{item.value}</Text>
              </View>
            );
          })}
          <View style={s.barRow}>
            <Text style={s.barLabel}>Cumplimiento</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.min(100, Math.round(cumplimientoPct))}%` }]} />
            </View>
            <Text style={s.barValue}>{fmtPct(cumplimientoPct)}</Text>
          </View>
          <View style={s.summaryFooter}>
            <Text style={s.summaryText}>Ingresos totales: {fmt$(kpis.ingresoTotal)}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SRS Medic · Informe de Actividad Operativa · Confidencial</Text>
          <Text style={s.footerText}>{fechaLabel} · {sucursalLabel}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default InformeMonitorPDF;