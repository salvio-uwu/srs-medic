import React from 'react';
import { Document, Page, Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  limpiar,
  calcularEdad,
  nombrePaciente,
  direccionPaciente,
  formatHeredofamiliares,
  formatAdicciones,
  formatAlergias,
  safeDateStr,
  docUsaArchivoOriginal
} from '../../utils/expedienteElectronico';

const INSTITUCION = 'CENTRO MÉDICO SANTA CRUZ';

const toSafePDFData = (value) => {
  try {
    const json = JSON.stringify(value, (_, val) => {
      if (typeof val === 'function') return undefined;
      if (val === undefined) return null;
      if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString();
      if (typeof val === 'object' && val !== null && typeof val.toDate === 'function') {
        try { return val.toDate().toISOString(); } catch (_) { return null; }
      }
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) return '0';
        if (Math.abs(val) > Number.MAX_SAFE_INTEGER) return '0';
        return String(val);
      }
      return val;
    });
    return JSON.parse(json) ?? (Array.isArray(value) ? [] : {});
  } catch (_) {
    return Array.isArray(value) ? [] : (typeof value === 'object' && value !== null ? {} : '');
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111827',
    lineHeight: 1.5
  },
  header: { marginBottom: 12, alignItems: 'center' },
  headerWithQR: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  qrBox: { width: 48, height: 48, marginLeft: 8 },
  headerLine: { width: '60%', height: 1, backgroundColor: '#111827', marginTop: 3, marginBottom: 3 },
  institucion: { fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textAlign: 'center' },
  docTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 5, textTransform: 'uppercase', letterSpacing: 1.8, textAlign: 'center' },
  metaBar: { flexDirection: 'row', borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: '#111827', marginBottom: 14 },
  metaCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 7 },
  metaCellMiddle: { flex: 1, paddingVertical: 4, paddingHorizontal: 7, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: '#111827' },
  metaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  metaValue: { fontSize: 8.5 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.8, borderColor: '#111827' },
  fieldHalf: { width: '50%', flexDirection: 'row', paddingRight: 12, paddingVertical: 2 },
  fieldThird: { width: '33.33%', flexDirection: 'column', paddingRight: 12, paddingVertical: 2 },
  fieldFull: { width: '100%', flexDirection: 'row', paddingRight: 12, paddingVertical: 2 },
  fLabel: { fontFamily: 'Helvetica-Bold', marginRight: 3 },
  fLabelThird: { fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  // Línea de antecedente (interlineado corregido: 3px padding = 6px entre líneas)
  aLine: { flexDirection: 'row', paddingVertical: 3, marginBottom: 0 },
  aLabel: { width: '35%', fontFamily: 'Helvetica-Bold', paddingRight: 6 },
  aValue: { width: '65%' },
  consultaBreak: { borderTopWidth: 1, borderColor: '#111827', marginTop: 10, marginBottom: 0 },
  consultaHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 3 },
  consultaNum: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  consultaFecha: { fontSize: 8.5 },
  consultaMetaLine: { fontSize: 7.5, marginBottom: 3 },
  subTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 6, marginBottom: 2 },
  medBlock: { marginLeft: 10, marginTop: 2, marginBottom: 3 },
  medName: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 0.5 },
  medMeta: { fontSize: 7.5, marginBottom: 1 },
  medDosisView: { marginTop: 1, paddingLeft: 6, borderLeftWidth: 1, borderColor: '#111827' },
  medDosisLine: { fontSize: 8, marginBottom: 0.5, paddingRight: 8 },
  // Documentos expedidos durante la consulta (recetas/plantillas con contenido resuelto)
  docSubTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 8, marginBottom: 4 },
  docCard: { marginTop: 6, marginBottom: 6 },
  docCardHead: { backgroundColor: '#f1f5f9', borderLeftWidth: 2, borderColor: '#111827', paddingVertical: 4, paddingHorizontal: 8 },
  docCardName: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  docCardMeta: { fontSize: 7, color: '#64748b', marginTop: 1.5 },
  docCardBody: { borderLeftWidth: 1, borderColor: '#cbd5e1', paddingVertical: 6, paddingLeft: 8, paddingRight: 8 },
  // Bloques de contenido formateado dentro del documento
  docH1: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 3, marginBottom: 3 },
  docH2: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 3, marginBottom: 2.5 },
  docH3: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 2.5, marginBottom: 2 },
  docPara: { fontSize: 8.5, lineHeight: 1.45, marginBottom: 3 },
  docListRow: { flexDirection: 'row', marginBottom: 2, paddingRight: 8 },
  docListBullet: { width: 14, fontSize: 8.5 },
  docListText: { flex: 1, fontSize: 8.5, lineHeight: 1.4 },
  docRule: { height: 0.8, backgroundColor: '#94a3b8', marginVertical: 5 },
  docTable: { borderWidth: 0.5, borderColor: '#94a3b8', marginVertical: 4 },
  docTableRow: { flexDirection: 'row' },
  docTableCell: { borderWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2.5, paddingHorizontal: 4 },
  docTableCellText: { fontSize: 8 },
  docArchivoPage: { width: '100%', marginBottom: 8 },
  p: { marginBottom: 1 },
  empty: { fontFamily: 'Helvetica-Oblique', color: '#64748b' },
  closing: { marginTop: 16 },
  closingRule: { height: 1, backgroundColor: '#111827', marginBottom: 8 },
  legal: { fontSize: 6.5, marginBottom: 16, textAlign: 'justify', color: '#64748b' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between' },
  signBlock: { width: '42%', alignItems: 'center' },
  signLine: { width: '100%', height: 0.8, backgroundColor: '#111827', marginBottom: 3 },
  signName: { fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
  signRole: { fontSize: 7, color: '#64748b', textAlign: 'center' },
  footer: { marginTop: 18 },
  footerRule: { height: 0.8, backgroundColor: '#111827', marginBottom: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: '#64748b' }
});

// ── Components ───────────────────────────────────────────────────────────────

const F = ({ label, value, size = 'half' }) => {
  const w = size === 'third' ? styles.fieldThird : size === 'full' ? styles.fieldFull : styles.fieldHalf;
  const lbl = size === 'third' ? styles.fLabelThird : styles.fLabel;
  return <View style={w}><Text style={lbl}>{label}:</Text><Text>{limpiar(value, 'No refiere')}</Text></View>;
};

/** Línea label: valor a ancho completo */
const AL = ({ label, value }) => (
  <View style={styles.aLine}>
    <Text style={styles.aLabel}>{label}</Text>
    <Text style={styles.aValue}>{limpiar(value, 'No referido')}</Text>
  </View>
);

const Parrafo = ({ value, fallback = '', style: textStyle }) => {
  const texto = limpiar(value, fallback);
  if (!texto) return null;
  const lineas = String(texto).split(/\r?\n/);
  return <View>{lineas.map((ln, i) => <Text key={i} style={textStyle}>{ln.trim() === '' ? ' ' : ln}</Text>)}</View>;
};

const formatHoraEvento = (val) => {
  if (!val) return '';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

// Selecciona la variante de Helvetica según negrita/itálica.
const fontFor = (bold, italic) => {
  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
};

// Renderiza una lista de "runs" (fragmentos con negrita/itálica) como un único
// Text con hijos en línea, respetando saltos de línea embebidos.
const Runs = ({ runs = [], baseStyle, align }) => {
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const styleList = (Array.isArray(baseStyle) ? baseStyle : [baseStyle]).filter(Boolean);
  if (align) styleList.push({ textAlign: align });
  return (
    <Text style={styleList}>
      {runs.map((r, i) => (
        <Text key={i} style={{ fontFamily: fontFor(r.bold, r.italic) }}>{r.text}</Text>
      ))}
    </Text>
  );
};

// Renderiza un bloque estructurado (encabezado, párrafo, lista, tabla, regla).
const DocBlock = ({ block }) => {
  if (!block || !block.type) return null;

  if (block.type === 'rule') return <View style={styles.docRule} />;

  if (block.type === 'heading') {
    const level = Number(block.level) || 1;
    const hStyle = level <= 1 ? styles.docH1 : level === 2 ? styles.docH2 : styles.docH3;
    return <Runs runs={block.runs} baseStyle={hStyle} align={block.align} />;
  }

  if (block.type === 'paragraph') {
    return <Runs runs={block.runs} baseStyle={styles.docPara} align={block.align} />;
  }

  if (block.type === 'list') {
    return (
      <View>
        {(block.items || []).map((items, i) => (
          <View key={i} style={styles.docListRow} wrap={false}>
            <Text style={styles.docListBullet}>{block.ordered ? `${i + 1}.` : '•'}</Text>
            <Runs runs={items} baseStyle={styles.docListText} />
          </View>
        ))}
      </View>
    );
  }

  if (block.type === 'table') {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const cols = rows.reduce((max, r) => Math.max(max, r.length), 0) || 1;
    const cellWidth = `${100 / cols}%`;
    return (
      <View style={styles.docTable}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.docTableRow} wrap={false}>
            {row.map((cell, ci) => (
              <View key={ci} style={[styles.docTableCell, { width: cellWidth }]}>
                <Runs
                  runs={cell.runs}
                  baseStyle={[styles.docTableCellText, cell.header ? { fontFamily: 'Helvetica-Bold' } : null]}
                  align={cell.align}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return null;
};

/**
 * Renderiza un documento expedido durante la consulta (receta o documento de
 * plantilla) con su contenido completo ya resuelto y formateado, dentro de una
 * tarjeta con encabezado que lo diferencia claramente de otros documentos.
 */
const DocExpedido = ({ doc, num }) => {
  const esReceta = doc?.tipo === 'receta';
  const titulo = limpiar(doc?.nombre, esReceta ? 'Receta médica' : 'Documento clínico');
  const etiquetaTipo = doc?.plantillaNombre
    || (doc?.formato === 'clinico' ? 'Formato clínico' : limpiar(doc?.formato, ''))
    || (esReceta ? 'Receta' : 'Documento');
  const meta = [
    etiquetaTipo,
    doc?.totalMedicamentos ? `${doc.totalMedicamentos} medicamento(s)` : '',
    formatHoraEvento(doc?.generadoAt)
  ].filter(Boolean).join('  ·  ');
  const bloques = Array.isArray(doc?.contentBlocks) ? doc.contentBlocks : [];
  const paginasArchivo = Array.isArray(doc?.archivoPaginas) ? doc.archivoPaginas.filter(Boolean) : [];
  const usaArchivo = docUsaArchivoOriginal(doc);

  return (
    <View style={styles.docCard}>
      <View style={styles.docCardHead} wrap={false}>
        <Text style={styles.docCardName}>{num}. {titulo}</Text>
        {meta ? <Text style={styles.docCardMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.docCardBody}>
        {usaArchivo && paginasArchivo.length > 0 ? (
          paginasArchivo.map((src, i) => (
            <Image key={i} src={src} style={styles.docArchivoPage} />
          ))
        ) : usaArchivo ? (
          <Text style={styles.empty}>
            Documento archivado no disponible para incrustar en este expediente.
          </Text>
        ) : bloques.length > 0 ? (
          bloques.map((b, i) => <DocBlock key={i} block={b} />)
        ) : (
          <Parrafo value={doc?.resolvedContent} style={styles.docPara} />
        )}
      </View>
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const v = (val, fb = 'No referido') => limpiar(val, fb);

const sistemaKey = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '_');

/**
 * Renderiza una lista de campos en UNA sola columna (label a la izquierda,
 * valor a la derecha). Una columna evita la confusión de lectura que generaba
 * el layout de dos columnas y no sufre los solapamientos del `flexWrap`.
 */
const TwoCol = ({ items = [] }) => (
  <>
    {items.map((it, i) => (
      <View key={i} style={styles.aLine}>
        <Text style={styles.aLabel}>{it.label}</Text>
        <Text style={styles.aValue}>{limpiar(it.value, it.fallback || 'No referido')}</Text>
      </View>
    ))}
  </>
);

/** Renderiza campos en UNA sola columna (label en negrita seguido del valor). */
const ThreeCol = ({ items = [] }) => (
  <>
    {items.map((it, i) => (
      <View key={i} style={styles.aLine}>
        <Text style={styles.aLabel}>{it.label}</Text>
        <Text style={styles.aValue}>{limpiar(it.value, it.fallback || 'No refiere')}</Text>
      </View>
    ))}
  </>
);

// ── Componente principal ─────────────────────────────────────────────────────

const ExpedienteElectronicoPDF = ({
  paciente: pacienteRaw = {},
  antecedentes: antecedentesRaw = {},
  consultas: consultasRaw = [],
  pxInfo: pxInfoRaw = {},
  generadoPor = '',
  folio = '',
  qrDataUrl = ''
}) => {
  const paciente = toSafePDFData(pacienteRaw) || {};
  const antecedentes = toSafePDFData(antecedentesRaw) || {};
  const consultas = toSafePDFData(consultasRaw) || [];
  const pxInfo = toSafePDFData(pxInfoRaw) || {};

  // ── Datos pre-calculados ────────────────────────────────────────────────

  const edad = calcularEdad(paciente.fechaNacimiento);
  const edadNumerica = Number(edad) || 0;
  const esMenor = edadNumerica > 0 && edadNumerica < 18;
  const esFemenino = String(paciente.sexo || '').toLowerCase() === 'femenino';

  const fechaEmision = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const folioFinal = limpiar(folio || paciente.idPaciente || paciente.id, '—');
  const grupoSanguineo = limpiar(pxInfo.grupo_sanguineo || paciente.grupoSanguineo, 'No refiere');
  const padecimientosCronicos = [
    paciente.padecimientoHipertension && 'Hipertensión',
    paciente.padecimientoDiabetes && 'Diabetes',
    paciente.padecimientoObesidad && 'Obesidad',
    paciente.padecimientoArtritis && 'Artritis'
  ].filter(Boolean).join(', ');

  // Heredofamiliares
  const heredo = formatHeredofamiliares(antecedentes.hereditarios || {});
  const otrosHeredo = String(antecedentes.hereditarios?.otros || '').trim();

  // No Patológicos
  const noPat = antecedentes.no_patologicos || {};

  // Patológicos
  const pat = antecedentes.patologicos || {};
  const esp = pat.especificos || {};
  const adicciones = formatAdicciones(pat.adicciones || {});
  const otroEsp = String(esp.otro || '').trim();
  const otroEspNegado = String(esp.otro_negado || '').toUpperCase().startsWith('NEGAD');

  // Alergias
  const alergiasTexto = formatAlergias(antecedentes.alergias || {});

  // CIE-10
  const cies = Array.isArray(antecedentes.cie10) ? antecedentes.cie10 : [];
  const ciesNegadas = antecedentes.cie10_preguntados_y_negados === true;

  // Vacunas
  const vacs = antecedentes.vacunas || {};
  const vacsLista = Array.isArray(vacs.lista) ? vacs.lista : [];
  const vacsCompleto = vacs.completo_para_la_edad === true;

  // Cirugías
  const cirs = antecedentes.cirugias || {};
  const cirsLista = Array.isArray(cirs.lista) ? cirs.lista : [];
  const cirsNegadas = cirs.preguntados_y_negados === true;

  // Aparatos
  const SISTEMAS = ['Digestivo', 'Cardiovascular', 'Respiratorio', 'Urinario', 'Genital',
    'Hematológico', 'Endocrino', 'Osteomuscular', 'Nervioso', 'Sensorial', 'Psicosomático', 'Otro'];
  const ap = antecedentes.aparatos || {};

  // ── Padres (pre-calculado) ──────────────────────────────────────────────
  const padresNegados = antecedentes.padres?.preguntados_y_negados === true;

  // ── Perinatales (pre-calculado) ─────────────────────────────────────────
  const per = antecedentes.perinatales || {};
  const perNegados = per.preguntados_y_negados === true;
  const perCursoNormal = per.curso_normal === true ? 'Sí' : per.curso_normal === false ? 'No' : null;

  // ── Psicomotor (pre-calculado) ──────────────────────────────────────────
  const psi = antecedentes.psicomotor || {};
  const psiNegados = psi.preguntados_y_negados === true;
  const hitosPsicomotor = [
    { k: 'sostuvo_cabeza', l: 'Sostuvo la cabeza', u: 'meses' },
    { k: 'rodamiento', l: 'Rodamiento', u: 'meses' },
    { k: 'sedestacion', l: 'Sedestación', u: 'meses' },
    { k: 'gateo', l: 'Gateó', u: 'meses' },
    { k: 'sonrio', l: 'Sonrió', u: 'meses' },
    { k: 'siguio_objetos', l: 'Siguió objetos', u: 'meses' },
    { k: 'bisilabos', l: 'Bisílabos', u: 'meses' },
    { k: 'lenguaje_fluido', l: 'Lenguaje fluido', u: 'años' },
    { k: 'camino', l: 'Caminó', u: 'meses' },
    { k: 'correr', l: 'Correr', u: 'meses' },
    { k: 'bipedestacion', l: 'Bipedestación', u: 'meses' },
    { k: 'subir_escaleras', l: 'Subir escaleras', u: 'meses' },
    { k: 'control_esfinteres', l: 'Control de esfínteres', u: 'meses' }
  ];

  // ── Gineco (pre-calculado) ──────────────────────────────────────────────
  const gin = antecedentes.gineco_obstetricos || {};
  const ginNegados = gin.preguntados_y_negados === true;
  const metodos = gin.metodos_anticonceptivos || {};
  const metodosLista = [];
  if (metodos.implante) metodosLista.push('Implante');
  if (metodos.mirena) metodosLista.push('Mirena');
  if (metodos.kyleena) metodosLista.push('Kyleena');
  if (metodos.diu_plata) metodosLista.push('DIU plata');
  if (metodos.diu_cobre) metodosLista.push('DIU cobre');
  const metodosTexto = metodosLista.length > 0
    ? metodosLista.join(', ')
    : (gin.metodos_anticonceptivos_texto || '');

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* ENCABEZADO */}
        {qrDataUrl ? (
          <View style={styles.headerWithQR}>
            <View style={{ width: 56 }} />
            <View style={styles.headerCenter}>
              <Text style={styles.institucion}>{INSTITUCION}</Text>
              <Text style={styles.docTitle}>Expediente Clínico Electrónico</Text>
              <View style={styles.headerLine} />
            </View>
            <View style={styles.qrBox}>
              <Image src={qrDataUrl} style={{ width: 48, height: 48 }} />
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Text style={styles.institucion}>{INSTITUCION}</Text>
            <Text style={styles.docTitle}>Expediente Clínico Electrónico</Text>
            <View style={styles.headerLine} />
          </View>
        )}

        {/* BARRA DE METADATOS */}
        <View style={styles.metaBar}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Folio / Expediente</Text>
            <Text style={styles.metaValue}>{folioFinal}</Text>
          </View>
          <View style={styles.metaCellMiddle}>
            <Text style={styles.metaLabel}>Fecha y hora de emisión</Text>
            <Text style={styles.metaValue}>{fechaEmision}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Expedido por</Text>
            <Text style={styles.metaValue}>{limpiar(generadoPor, 'Administración')}</Text>
          </View>
        </View>

        {/* I. FICHA */}
        <Text style={styles.sectionTitle}>I. Ficha de Identificación del Paciente</Text>
        <F label="Nombre completo" value={nombrePaciente(paciente)} size="full" />
        <ThreeCol items={[
          { label: 'Sexo', value: paciente.sexo },
          { label: 'Edad', value: edad ? `${edad} años` : '' },
          { label: 'Fecha de nacimiento', value: safeDateStr(paciente.fechaNacimiento) },
          { label: 'Lugar de nacimiento', value: paciente.lugarNacimiento },
          { label: 'CURP', value: paciente.curp },
          { label: 'Grupo sanguíneo', value: grupoSanguineo },
          { label: 'Estado civil', value: paciente.estadoCivil },
          { label: 'Teléfono móvil', value: paciente.telefonoMovil },
          { label: 'Teléfono fijo', value: paciente.telefonoFijo },
          { label: 'Correo electrónico', value: paciente.email },
          { label: 'Ocupación', value: paciente.ocupacion },
          { label: 'Religión', value: paciente.religion },
          { label: 'Escolaridad', value: paciente.escolaridad },
          { label: 'Lengua', value: paciente.lengua },
          { label: 'Derechohabiencia', value: paciente.derechohabiente },
          { label: 'Aseguradora', value: paciente.aseguradora },
          { label: 'Empresa', value: paciente.empresa },
          { label: 'Persona responsable', value: paciente.personaResponsable }
        ]} />
        <F label="Domicilio" value={direccionPaciente(paciente)} size="full" />
        {padecimientosCronicos ? (
          <F label="Padecimientos crónicos" value={padecimientosCronicos} size="full" />
        ) : null}
        {String(paciente.notasPersonales || '').trim() ? (
          <>
            <Text style={styles.subTitle}>Notas personales</Text>
            <Parrafo value={paciente.notasPersonales} style={styles.p} />
          </>
        ) : null}

        {/* II. HEREDOFAMILIARES */}
        <Text style={styles.sectionTitle}>II. Antecedentes Heredofamiliares</Text>
        {heredo.length ? (
          <>
            {heredo.map((h) => <AL key={h.label} label={h.label} value={h.valor} />)}
            {otrosHeredo ? <AL label="Otros" value={otrosHeredo} /> : null}
          </>
        ) : (
          <Text style={styles.empty}>Interrogados y negados. Niega antecedentes heredofamiliares de relevancia clínica.</Text>
        )}

        {/* III. NO PATOLÓGICOS */}
        <Text style={styles.sectionTitle}>III. Antecedentes Personales No Patológicos</Text>
        <AL label="Alimentación" value={v(noPat.alimentacion, 'Sin particularidades')} />
        <AL label="Higiene / baño" value={v(noPat.bano, 'Sin particularidades')} />
        <AL label="Lavado dental" value={v(noPat.lavado_dientes, 'Sin particularidades')} />
        <AL label="Habitación" value={v(noPat.habitacion, 'Sin particularidades')} />
        <AL label="Sedentarismo" value={v(noPat.sedentarismo, 'Sin particularidades')} />
        <AL label="Otros" value={v(noPat.otros, 'Sin particularidades')} />

        {/* IV. PATOLÓGICOS */}
        <Text style={styles.sectionTitle}>IV. Antecedentes Personales Patológicos</Text>
        <AL label="Padecimientos" value={pat.actuales_negado ? 'Negado' : v(pat.actuales, 'Niega antecedentes')} />
        <AL label="Quirúrgicos" value={pat.quirurgicos_negado ? 'Negado' : v(pat.quirurgicos, 'Niega antecedentes')} />
        <AL label="Hospitalizaciones" value={pat.hospitalizaciones_negado ? 'Negado' : v(pat.hospitalizaciones, 'Niega antecedentes')} />
        <AL label="Transfusionales" value={pat.transfusionales_negado ? 'Negado' : v(pat.transfusionales, 'Niega antecedentes')} />
        <AL label="Traumáticos" value={pat.traumaticos_negado ? 'Negado' : v(pat.traumaticos, 'Niega antecedentes')} />
        <AL label="Adicciones" value={v(adicciones, 'Niega adicciones')} />
        <Text style={styles.subTitle}>Antecedentes específicos</Text>
        <AL label="Glaucoma" value={esp.glaucoma_negado ? 'Negado' : v(esp.glaucoma, 'S/P')} />
        <AL label="Cálculo biliar" value={esp.calculo_negado ? 'Negado' : v(esp.calculo, 'S/P')} />
        <AL label="Reflujo" value={esp.reflujo_negado ? 'Negado' : v(esp.reflujo, 'S/P')} />
        <AL label="Incontinencia" value={esp.incontinencia_negado ? 'Negado' : v(esp.incontinencia, 'S/P')} />
        <AL label="Dislipidemias" value={esp.dislipidemias_negado ? 'Negado' : v(esp.dislipidemias, 'S/P')} />
        <AL label="Otro" value={otroEspNegado ? 'Negado' : (otroEsp && !otroEspNegado ? otroEsp : 'S/P')} />

        {/* V. ALERGIAS */}
        <Text style={styles.sectionTitle}>V. Alergias</Text>
        <Text style={styles.p}>{alergiasTexto}</Text>

        {/* VI. CIE-10 */}
        <Text style={styles.sectionTitle}>VI. Enfermedades CIE-10</Text>
        {ciesNegadas
          ? <Text style={styles.empty}>Interrogados y negados.</Text>
          : cies.length
            ? cies.map((item, i) => (
                <AL key={i} label={item.code || '—'} value={item.description || '—'} />
              ))
            : <Text style={styles.empty}>Interrogados y negados. Sin antecedentes de relevancia clínica.</Text>
        }

        {/* VII. PADRES (solo menores) */}
        {esMenor && (
          <>
            <Text style={styles.sectionTitle}>VII. Datos de los Padres</Text>
            {padresNegados ? (
              <Text style={styles.empty}>Interrogados y negados.</Text>
            ) : (
              <>
                <AL label="Madre" value={v(antecedentes.padres?.madre_nombre, 'Desconocidos')} />
                <AL label="Padre" value={v(antecedentes.padres?.padre_nombre, 'Desconocidos')} />
                <AL label="Edad de la madre al embarazo" value={antecedentes.padres?.edad_madre_embarazo ? `${antecedentes.padres.edad_madre_embarazo} años` : 'Desconocidos'} />
                <AL label="Embarazo No." value={v(antecedentes.padres?.numero_embarazo, 'Desconocidos')} />
                <AL label="Semanas de gestación" value={v(antecedentes.padres?.semanas_gestacion, 'Desconocidos')} />
              </>
            )}
          </>
        )}

        {/* VIII. PERINATALES (solo menores, 2 columnas) */}
        {esMenor && (
          <>
            <Text style={styles.sectionTitle}>VIII. Antecedentes Perinatales</Text>
            {perNegados ? (
              <Text style={styles.empty}>Interrogados y negados.</Text>
            ) : (
              <TwoCol items={[
                { label: 'Anestesia', value: v(per.anestesia, 'Desconocidos') },
                { label: 'Sitio de atención', value: v(per.sitio_atencion, 'Desconocidos') },
                { label: 'Curso normal', value: perCursoNormal || 'Desconocidos' },
                { label: 'Tipo de nacimiento', value: v(per.tipo_nacimiento, 'Desconocidos') },
                { label: 'Duración del parto', value: v(per.duracion_parto, 'Desconocidos') },
                { label: 'Peso del bebé', value: per.peso ? `${per.peso} kg` : 'Desconocidos' },
                { label: 'Talla del bebé', value: per.talla ? `${per.talla} cm` : 'Desconocidos' },
                { label: 'APGAR', value: v(per.apgar, 'Desconocidos') },
                { label: 'Silverman-Anderson', value: v(per.silverman, 'Desconocidos') },
                { label: 'Tamiz metabólico', value: v(per.tamiz_metabolico, 'Desconocidos') },
                { label: 'Tamiz auditivo', value: v(per.tamiz_auditivo, 'Desconocidos') },
                { label: 'Reanimación', value: v(per.reanimacion, 'Sin datos de interés') },
                { label: 'Otros', value: v(per.otros, 'Sin particularidades') }
              ]} />
            )}
          </>
        )}

        {/* IX. PSICOMOTOR (solo menores, 2 columnas) */}
        {esMenor && (
          <>
            <Text style={styles.sectionTitle}>IX. Desarrollo Psicomotor</Text>
            {psiNegados ? (
              <Text style={styles.empty}>Interrogados y negados.</Text>
            ) : (
              <>
                <TwoCol items={hitosPsicomotor.map(h => ({
                  label: h.l,
                  value: psi[h.k] ? `${psi[h.k]} ${h.u}` : 'Desconocido'
                }))} />
                <AL label="Desempeño escolar" value={v(psi.desempeno_escolar, 'Sin datos de interés')} />
                <AL label="Otros hallazgos" value={v(psi.otros_psicomotor, 'Sin particularidades')} />
              </>
            )}
          </>
        )}

        {/* X. GINECO-OBSTÉTRICOS (solo femenino, sub-secciones con columnas) */}
        {esFemenino && (
          <>
            <Text style={styles.sectionTitle}>X. Antecedentes Gineco-obstétricos</Text>
            {ginNegados ? (
              <Text style={styles.empty}>Interrogados y negados.</Text>
            ) : (
              <>
                <Text style={styles.subTitle}>Menstruación</Text>
                <TwoCol items={[
                  { label: 'Menarca', value: gin.menarca ? `${gin.menarca} años` : 'No refiere' },
                  { label: 'F.U.M.', value: safeDateStr(gin.fum) || 'No refiere' },
                  { label: 'Características', value: v(gin.caracteristicas_menstruacion, 'No refiere') },
                  { label: 'I.V.S.A.', value: gin.ivsa ? `${gin.ivsa} años` : 'No refiere' },
                  { label: 'Menopausia', value: gin.menopausia ? `${gin.menopausia} años` : 'No refiere' }
                ]} />
                <AL label="Otros menstruales" value={v(gin.menstruacion_otros, 'Sin particularidades')} />

                <Text style={styles.subTitle}>Historial de embarazos</Text>
                <TwoCol items={[
                  { label: 'Gestaciones', value: v(gin.gestas, 'S/A') },
                  { label: 'Partos', value: v(gin.partos, 'S/A') },
                  { label: 'Cesáreas', value: v(gin.cesareas, 'S/A') },
                  { label: 'Abortos', value: v(gin.abortos, 'S/A') },
                  { label: 'Nacidos vivos', value: v(gin.nacidos_vivos, 'S/A') },
                  { label: 'Vivos actuales', value: v(gin.vivos_actuales, 'S/A') }
                ]} />
                <AL label="Otros embarazos" value={v(gin.embarazos_otros, 'Sin particularidades')} />

                <Text style={styles.subTitle}>Salud sexual y estudios</Text>
                <TwoCol items={[
                  { label: 'Parejas sexuales', value: v(gin.parejas_sexuales, 'No refiere') },
                  { label: 'Métodos anticonceptivos', value: v(metodosTexto, 'Niega antecedentes') },
                  { label: 'VPH', value: v(gin.vph, 'S/P') },
                  { label: 'Papanicolaou', value: gin.papanicolaou_check ? (safeDateStr(gin.fecha_papanicolaou) || 'Realizado') : v(gin.papanicolaou, 'S/P') },
                  { label: 'Colposcopia', value: gin.colposcopia_check ? (safeDateStr(gin.fecha_colposcopia) || 'Realizada') : 'S/P' },
                  { label: 'Mastografía', value: gin.mamografia_check ? (safeDateStr(gin.fecha_mamografia) || 'Realizada') : v(gin.mastografia, 'S/P') }
                ]} />
                <AL label="Procedimientos ginecológicos" value={v(gin.procedimientos_ginecologicos, 'Niega antecedentes')} />
                <AL label="Hábitos" value={v(gin.habitos, 'No refiere')} />
                <AL label="Flujos vaginales" value={v(gin.flujos_vaginales, 'No refiere')} />
                <AL label="Otros ginecológicos" value={v(gin.otros_ginecologicos, 'Sin particularidades')} />
              </>
            )}
          </>
        )}

        {/* XI. VACUNAS */}
        <Text style={styles.sectionTitle}>XI. Esquema de Vacunación</Text>
        {vacsLista.length > 0 ? (
          vacsLista.map((vac, i) => (
            <AL key={i} label={vac.nombre || 'Vacuna'} value={[vac.fecha, vac.nota].filter(Boolean).join(' — ') || '—'} />
          ))
        ) : vacsCompleto ? (
          <Text style={styles.empty}>Esquema completo para la edad.</Text>
        ) : (
          <Text style={styles.empty}>Niega antecedentes de vacunación.</Text>
        )}

        {/* XII. CIRUGÍAS */}
        <Text style={styles.sectionTitle}>XII. Cirugías Previas</Text>
        {cirsNegadas ? (
          <Text style={styles.empty}>Interrogadas y negadas.</Text>
        ) : cirsLista.length > 0 ? (
          cirsLista.map((c, i) => {
            const detalle = [c.operacion !== c.procedimiento ? c.operacion : null, c.fechaRegistro, c.unidad, c.nota]
              .filter(Boolean).join(' · ');
            return <AL key={i} label={c.procedimiento || 'Procedimiento'} value={detalle || '—'} />;
          })
        ) : (
          <Text style={styles.empty}>Niega antecedentes quirúrgicos.</Text>
        )}

        {/* XIII. APARATOS Y SISTEMAS */}
        <Text style={styles.sectionTitle}>XIII. Interrogatorio por Aparatos y Sistemas</Text>
        {SISTEMAS.map(s => (
          <AL key={s} label={s} value={v(ap[sistemaKey(s)], 'Sin datos de interés')} />
        ))}

        {/* XIV. CONSULTAS */}
        <Text style={styles.sectionTitle}>XIV. Notas de Evolución y Consultas ({consultas.length})</Text>
        {consultas.length === 0 ? (
          <Text style={styles.empty}>El paciente no cuenta con consultas registradas en esta institución.</Text>
        ) : (
          consultas.map((c, idx) => {
            const num = consultas.length - idx;
            const vit = [
              { l: 'Peso', v: c.antropometria.peso, u: 'kg' },
              { l: 'Talla', v: c.antropometria.talla, u: 'm' },
              { l: 'IMC', v: c.antropometria.imc },
              { l: 'Temp.', v: c.signos.temp, u: '°C' },
              { l: 'T/A', v: c.signos.ta },
              { l: 'F.C.', v: c.signos.fc, u: 'lpm' },
              { l: 'F.R.', v: c.signos.fr, u: 'rpm' },
              { l: 'SpO₂', v: c.signos.spo2, u: '%' }
            ].filter((s) => String(s.v || '').trim());
            const hayFisica = Object.values(c.fisica).some((v) => String(v || '').trim());
            const estudios = [
              ...(c.estudios.paquetes || []),
              ...c.estudios.seleccionados.map((e) => (typeof e === 'string' ? e : (e?.nombre || '')))
            ].filter(Boolean);
            const procs = c.procedimientos.seleccionados
              .map((p) => (typeof p === 'string' ? p : (p?.nombre || p?.procedimiento || p?.descripcion || '')))
              .filter(Boolean);
            // Documentos expedidos con contenido de plantilla resuelto. Se omiten
            // los que no tienen contenido (p. ej. receta de formato clínico que
            // solo duplica el Plan terapéutico o adjuntos sin plantilla).
            const docsExpedidos = [
              ...(Array.isArray(c.recetasGeneradas) ? c.recetasGeneradas : []),
              ...(Array.isArray(c.documentosGenerados) ? c.documentosGenerados : [])
            ].filter((d) => docUsaArchivoOriginal(d)
              || (Array.isArray(d?.archivoPaginas) && d.archivoPaginas.length > 0)
              || (Array.isArray(d?.contentBlocks) && d.contentBlocks.length > 0)
              || String(limpiar(d?.resolvedContent, '')).trim());

            const metaTexto = [
              limpiar(c.medicoNombre, 'Médico'),
              c.medicoPerfil?.cedula ? `Céd. Prof. ${c.medicoPerfil.cedula}` : null,
              c.medicoPerfil?.universidadEgreso ? `Univ. ${c.medicoPerfil.universidadEgreso}` : null,
              c.medicoPerfil?.especialidad || null,
              c.folioReceta ? `Folio: ${c.folioReceta}` : null,
              c.consultorioNombre ? `Consultorio: ${c.consultorioNombre}` : null,
              c.sucursalDireccion || null
            ].filter(Boolean).join('  ·  ');

            return (
              <View key={c.id || idx}>
                <View style={styles.consultaBreak} />
                <View style={styles.consultaHead}>
                  <Text style={styles.consultaNum}>Nota {num} · {c.tipoNota}</Text>
                  <Text style={styles.consultaFecha}>{c.fechaFormato}{c.horaFormato ? ` · ${c.horaFormato} hrs` : ''}</Text>
                </View>
                <Text style={styles.consultaMetaLine}>{metaTexto}</Text>

                {c.padecimiento ? <><Text style={styles.subTitle}>Padecimiento actual</Text><Parrafo value={c.padecimiento} style={styles.p} /></> : null}

                {vit.length > 0 && <><Text style={styles.subTitle}>Signos vitales y somatometría</Text><Text style={styles.p}>{vit.map((s) => `${s.l}: ${s.v}${s.u ? ` ${s.u}` : ''}`).join('  |  ')}</Text></>}

                {hayFisica ? <><Text style={styles.subTitle}>Exploración física</Text>{Object.entries(c.fisica).map(([k, v]) => { const val = limpiar(v, ''); if (!String(val).trim()) return null; return <Text key={k} style={styles.p}><Text style={{ fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' }}>{k}: </Text>{val}</Text>; })}</> : null}

                <Text style={styles.subTitle}>Diagnóstico</Text>
                <Parrafo value={c.diagnostico} fallback="Sin diagnóstico registrado en esta consulta" style={styles.p} />
                {c.cie10.length ? <Text style={styles.p}><Text style={{ fontFamily: 'Helvetica-Bold' }}>CIE-10: </Text>{c.cie10.map((item) => [item?.codigo, item?.descripcion].filter(Boolean).join(' ')).join('; ')}</Text> : null}

                {c.tratamiento.length > 0 && <><Text style={styles.subTitle}>Plan terapéutico ({c.tratamiento.length} med.)</Text>
                  {c.tratamiento.map((m, i) => {
                    const metaMeds = [];
                    if (m?.presentacion) metaMeds.push(m.presentacion);
                    if (m?.sustanciasActivas) metaMeds.push(`Sust. activa: ${m.sustanciasActivas}`);
                    if (m?.grupo || m?.marca) metaMeds.push(`Grupo: ${m.grupo || m.marca}`);
                    if (m?.numeroAcomodo) metaMeds.push(`Acomodo #${m.numeroAcomodo}`);
                    const tieneDosis = m?.dosis && String(m.dosis).trim();
                    return (
                      <View key={i} style={styles.medBlock}>
                        <Text style={styles.medName}>{i + 1}. {limpiar(m?.nombre, 'Medicamento')}</Text>
                        {metaMeds.length > 0 && <Text style={styles.medMeta}>{metaMeds.join(' · ')}</Text>}
                        {tieneDosis && <View style={styles.medDosisView}><Parrafo value={m.dosis} style={styles.medDosisLine} /></View>}
                      </View>
                    );
                  })}
                </>}

                {c.indicaciones ? <><Text style={styles.subTitle}>Indicaciones generales</Text><Parrafo value={c.indicaciones} style={styles.p} /></> : null}
                {c.pronostico ? <><Text style={styles.subTitle}>Pronóstico</Text><Parrafo value={c.pronostico} style={styles.p} /></> : null}

                {estudios.length > 0 && <><Text style={styles.subTitle}>Estudios solicitados</Text><Text style={styles.p}>{estudios.join(' · ')}</Text></>}
                {procs.length > 0 && <><Text style={styles.subTitle}>Procedimientos</Text><Text style={styles.p}>{procs.join(' · ')}</Text></>}

                {docsExpedidos.length > 0 && (
                  <>
                    <Text style={styles.docSubTitle}>Documentos expedidos en esta consulta</Text>
                    {docsExpedidos.map((d, i) => <DocExpedido key={i} doc={d} num={i + 1} />)}
                  </>
                )}
              </View>
            );
          })
        )}

        {/* CIERRE */}
        <View style={styles.closing}>
          <View style={styles.closingRule} />
          <Text style={styles.legal}>El presente documento constituye una reproducción fiel del expediente clínico electrónico resguardado por {INSTITUCION}. Su contenido es confidencial y está protegido conforme a la NOM-004-SSA3-2012 y a la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados. Queda prohibida su reproducción o divulgación parcial o total sin autorización.</Text>
          <View style={styles.signRow}>
            <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signName}>{limpiar(generadoPor, 'Administración')}</Text><Text style={styles.signRole}>Responsable de la expedición</Text></View>
            <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signName}>Sello de la institución</Text><Text style={styles.signRole}>{INSTITUCION}</Text></View>
          </View>
        </View>

        {/* PIE DE PÁGINA */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text>{INSTITUCION} · Folio {folioFinal}</Text>
            <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </View>

      </Page>
    </Document>
  );
};

export default ExpedienteElectronicoPDF;
