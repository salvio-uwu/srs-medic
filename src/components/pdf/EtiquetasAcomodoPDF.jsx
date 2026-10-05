// Etiquetas de acomodo — colometría del PDF de referencia ETIQUETAS MEDICAMENTO 2025
// Dos apartados: venta libre (1→∞) y antibióticos (1→∞)
import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const COLS = 3;
const ROWS = 10;
const PER_PAGE = COLS * ROWS;

/**
 * Colores muestreados del PDF original (no los del UI).
 * nivel 1=azul, 2=verde, 3=amarillo, 4=naranja, 5=rojo
 */
const LABEL_BG = {
  1: '#38b4fc',
  2: '#00bc60',
  3: '#fcec00',
  4: '#fcbc58',
  5: '#fc3030',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  sectionBanner: {
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#111827',
  },
  sectionBannerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionSub: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#d1d5db',
    marginTop: 2,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    flexDirection: 'column',
  },
  cell: {
    flex: 1,
    margin: 1,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 7,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellEmpty: {
    flex: 1,
    margin: 1,
    backgroundColor: '#f8fafc',
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.2,
    marginBottom: 4,
  },
  detail: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.25,
  },
  number: {
    position: 'absolute',
    left: 7,
    bottom: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#000000',
  },
});

const chunkPages = (items) => {
  const pages = [];
  for (let i = 0; i < items.length; i += PER_PAGE) {
    pages.push(items.slice(i, i + PER_PAGE));
  }
  return pages;
};

/** Llena columna por columna (como el PDF de referencia). */
const buildColumns = (pageItems) => {
  const columns = Array.from({ length: COLS }, () => []);
  pageItems.forEach((item, idx) => {
    const col = Math.floor(idx / ROWS);
    if (col < COLS) columns[col].push(item);
  });
  columns.forEach((col) => {
    while (col.length < ROWS) col.push(null);
  });
  return columns;
};

const EtiquetaCell = ({ med }) => {
  if (!med) return <View style={s.cellEmpty} />;

  const nivel = Number(med.nivel) || 3;
  const bg = LABEL_BG[nivel] || LABEL_BG[3];
  const name = String(med.medicamento || '').trim().toUpperCase();
  const detail = String(med.presentacion || '').trim().toUpperCase();
  const num = String(med.numeroAcomodo ?? '').replace(/^#/, '').trim() || '—';

  return (
    <View style={[s.cell, { backgroundColor: bg }]}>
      <Text style={s.name}>{name || 'SIN NOMBRE'}</Text>
      {detail ? <Text style={s.detail}>{detail}</Text> : null}
      <Text style={s.number}>{num}</Text>
    </View>
  );
};

const SectionPages = ({ title, subtitle, items, keyPrefix }) => {
  if (!items.length) return null;
  const pages = chunkPages(items);

  return pages.map((pageItems, pageIdx) => {
    const columns = buildColumns(pageItems);
    return (
      <Page key={`${keyPrefix}-${pageIdx}`} size="LETTER" style={s.page}>
        {pageIdx === 0 ? (
          <View style={s.sectionBanner}>
            <Text style={s.sectionBannerText}>{title}</Text>
            {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
          </View>
        ) : null}
        <View style={s.grid}>
          {columns.map((colItems, colIdx) => (
            <View key={`${keyPrefix}-c-${pageIdx}-${colIdx}`} style={s.column}>
              {colItems.map((med, rowIdx) => (
                <EtiquetaCell
                  key={med?.id || `${keyPrefix}-e-${pageIdx}-${colIdx}-${rowIdx}`}
                  med={med}
                />
              ))}
            </View>
          ))}
        </View>
      </Page>
    );
  });
};

const EtiquetasAcomodoPDF = ({
  ventaLibre = [],
  antibioticos = [],
  // compat: si alguien pasa medicamentos planos, se tratan como venta libre
  medicamentos = [],
}) => {
  const libre = ventaLibre.length ? ventaLibre : medicamentos.filter((m) => !m.antibiotico);
  const abx = antibioticos.length
    ? antibioticos
    : medicamentos.filter((m) => !!m.antibiotico);

  const hasAny = libre.length > 0 || abx.length > 0;

  return (
    <Document
      title="Documento de acomodo"
      author="SRS-Medic"
      subject="Etiquetas de anaquel: venta libre y antibióticos"
    >
      {!hasAny ? (
        <Page size="LETTER" style={s.page}>
          <View style={s.sectionBanner}>
            <Text style={s.sectionBannerText}>Sin medicamentos para etiquetar</Text>
          </View>
        </Page>
      ) : null}

      <SectionPages
        keyPrefix="vl"
        title="Venta libre"
        subtitle={`Anaquel general · ${libre.length} etiqueta(s) · numeración propia 1 → ∞`}
        items={libre}
      />
      <SectionPages
        keyPrefix="abx"
        title="Antibióticos"
        subtitle={`Estante aparte · ${abx.length} etiqueta(s) · numeración propia 1 → ∞`}
        items={abx}
      />
    </Document>
  );
};

export default EtiquetasAcomodoPDF;
export { COLS, ROWS, PER_PAGE, LABEL_BG };
