import React from 'react';
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page: { paddingTop: 90, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: 'Helvetica' },
  header: { position: 'absolute', top: 28, left: 48, right: 48 },
  footerBottom: { position: 'absolute', bottom: 26, left: 48, right: 48 },
  footerTop: { position: 'absolute', top: 760, left: 48, right: 48 },
  line: { marginBottom: 6 }
});

const make = (footerStyle) => React.createElement(
  Document, null,
  React.createElement(Page, { size: 'LETTER', style: s.page },
    React.createElement(View, { style: s.header, fixed: true }, React.createElement(Text, null, 'ENCABEZADO FIJO')),
    React.createElement(View, { style: footerStyle, fixed: true }, React.createElement(Text, null, 'PIE FIJO')),
    ...Array.from({ length: 120 }, (_, i) => React.createElement(Text, { key: i, style: s.line }, 'Linea de contenido numero ' + i))
  )
);

const run = async () => {
  for (const [name, st] of [['bottom', s.footerBottom], ['top', s.footerTop]]) {
    try {
      const buf = await renderToBuffer(make(st));
      console.log(name, 'OK bytes:', buf.length);
    } catch (e) {
      console.log(name, 'FAIL:', e.message);
    }
  }
};
run();
