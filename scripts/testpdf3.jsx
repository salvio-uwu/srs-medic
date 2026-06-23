import React from 'react';
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page: { paddingTop: 96, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: 'Helvetica' },
  header: { position: 'absolute', top: 28, left: 48, right: 48 },
  footer: { position: 'absolute', bottom: 26, left: 48, right: 48 },
  secTitle: { backgroundColor: '#e5e7eb', borderWidth: 0.8, borderColor: '#000', padding: 3, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'Helvetica-Bold' },
  secBox: { borderWidth: 0.8, borderTopWidth: 0, borderColor: '#000', padding: 6, marginBottom: 11 },
  line: { flexDirection: 'row', marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999', paddingBottom: 1.5 },
  card: { marginBottom: 10, backgroundColor: '#fafafa' },
  head: { backgroundColor: '#eee', padding: 4, flexDirection: 'row', justifyContent: 'space-between' },
  body: { padding: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  cell: { width: '25%', padding: 2 },
  box: { backgroundColor: '#f1f1f1', padding: 3 }
});

const section = (i) => React.createElement(View, { key: 's' + i, wrap: false },
  React.createElement(Text, { style: s.secTitle }, 'SECCION ' + i),
  React.createElement(View, { style: s.secBox },
    ...Array.from({ length: 6 }, (_, k) => React.createElement(View, { key: k, style: s.line },
      React.createElement(Text, null, 'Etiqueta ' + k + ': valor de prueba'))
    )
  )
);

const card = (i) => React.createElement(View, { key: i, style: s.card, wrap: false },
  React.createElement(View, { style: s.head },
    React.createElement(Text, null, 'Nota ' + i),
    React.createElement(Text, null, '08 jun 2026')
  ),
  React.createElement(View, { style: s.body },
    React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 } }, 'Padecimiento actual'),
    React.createElement(Text, { style: { textAlign: 'justify', marginBottom: 2 } }, 'Padecimiento de prueba con texto suficiente para ocupar algo de espacio en la nota clinica y forzar el justificado del parrafo en varias lineas seguidas.'),
    React.createElement(View, { style: s.grid },
      ...Array.from({ length: 8 }, (_, k) => React.createElement(View, { key: k, style: s.cell },
        React.createElement(View, { style: s.box },
          React.createElement(Text, null, 'L' + k),
          React.createElement(Text, null, '123')
        )
      ))
    )
  )
);

const run = async () => {
  for (const n of [3, 10, 20]) {
    try {
      const doc = React.createElement(Document, null,
        React.createElement(Page, { size: 'LETTER', style: s.page },
          React.createElement(View, { style: s.header, fixed: true }, React.createElement(Text, null, 'ENCABEZADO')),
          React.createElement(View, { style: s.footer, fixed: true }, React.createElement(Text, null, 'PIE')),
          ...Array.from({ length: 5 }, (_, i) => section(i)),
          ...Array.from({ length: n }, (_, i) => card(i))
        )
      );
      const buf = await renderToBuffer(doc);
      console.log('n=' + n, 'OK', buf.length);
    } catch (e) {
      console.log('n=' + n, 'FAIL:', e.message);
    }
  }
};
run();
