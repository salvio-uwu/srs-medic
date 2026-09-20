// Etiquetas de acomodo — colometría del PDF de referencia ETIQUETAS MEDICAMENTO 2025
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
  if (!pages.length) pages.push([]);
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

const EtiquetasAcomodoPDF = ({ medicamentos = [] }) => {
  const pages = chunkPages(medicamentos);

  return (
    <Document
      title="Documento de acomodo"
      author="SRS-Medic"
      subject="Etiquetas de anaquel por número de acomodo"
    >
      {pages.map((pageItems, pageIdx) => {
        const columns = buildColumns(pageItems);
        return (
          <Page key={`p-${pageIdx}`} size="LETTER" style={s.page}>
            <View style={s.grid}>
              {columns.map((colItems, colIdx) => (
                <View key={`c-${pageIdx}-${colIdx}`} style={s.column}>
                  {colItems.map((med, rowIdx) => (
                    <EtiquetaCell key={med?.id || `e-${pageIdx}-${colIdx}-${rowIdx}`} med={med} />
                  ))}
                </View>
              ))}
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default EtiquetasAcomodoPDF;
export { COLS, ROWS, PER_PAGE, LABEL_BG };
