import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const C_TURQ = '#6b7280';
const C_DARK = '#374151';
const C_BORDER = '#d1d5db';

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 18,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.32
  },
  bandTop: { height: 10, backgroundColor: C_TURQ, marginBottom: 8 },
  title: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: C_DARK,
    marginBottom: 6
  },
  box: {
    borderWidth: 1,
    borderColor: C_BORDER,
    marginBottom: 8
  },
  boxHeader: {
    backgroundColor: C_TURQ,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: 8.8,
    paddingVertical: 3,
    paddingHorizontal: 6
  },
  boxBody: { paddingVertical: 7, paddingHorizontal: 8 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 150, fontWeight: 'bold', color: C_DARK },
  value: { flex: 1, color: '#111827' },
  auditInfo: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    padding: 7,
    marginBottom: 8
  },
  auditText: { fontSize: 8.3, color: '#4b5563', marginBottom: 2 },
  consultHeader: {
    backgroundColor: C_TURQ,
    color: '#fff',
    fontWeight: 'bold',
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8.8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    textTransform: 'uppercase'
  },
  lineTitle: {
    marginTop: 5,
    marginBottom: 2,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#374151'
  },
  lineRule: { borderBottomWidth: 1, borderBottomColor: '#9ca3af', marginBottom: 4 },
  p: { marginBottom: 3 },
  medItem: { marginLeft: 10, marginBottom: 2 },
  foot: {
    position: 'absolute',
    bottom: 8,
    left: 18,
    right: 18,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#94a3b8'
  }
});

const safe = (v, fallback = '--') => {
  const s = String(v || '').trim();
  return s || fallback;
};

const fmtDate = (input) => {
  const text = String(input || '').trim();
  if (!text) return '--';
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('es-MX');
  }
  return text;
};

const auditLabel = (status = '') => {
  if (status === 'aprobado') return 'Aprobado';
  if (status === 'incompleto') return 'Incompleto';
  if (status === 'critico') return 'Critico';
  return 'Sin auditoria';
};

const DocumentoHistoriaPDF = ({ paciente, historial, doctor, expedienteActual }) => {
  const consultas = Array.isArray(historial) ? historial : [];
  const ultimaAuditoria = consultas.find((c) => c?.auditSnapshot)?.auditSnapshot || null;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.bandTop} />
        <Text style={styles.title}>Historia Clinica General</Text>

        <View style={styles.box}>
          <Text style={styles.boxHeader}>Datos Paciente</Text>
          <View style={styles.boxBody}>
            <View style={styles.row}><Text style={styles.label}>ID del paciente:</Text><Text style={styles.value}>{safe(expedienteActual?.px_info?.id_receta)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Nombre:</Text><Text style={styles.value}>{safe(paciente?.nombre, 'Paciente')}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Fecha de nacimiento:</Text><Text style={styles.value}>{fmtDate(expedienteActual?.px_info?.fecha_nacimiento)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Edad:</Text><Text style={styles.value}>{safe(expedienteActual?.px_info?.edad)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Sexo:</Text><Text style={styles.value}>{safe(paciente?.sexo)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Grupo sanguineo:</Text><Text style={styles.value}>{safe(expedienteActual?.px_info?.grupo_sanguineo)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Medico responsable:</Text><Text style={styles.value}>{safe(doctor?.nombre, 'Medico General')}    Cedula: {safe(doctor?.cedulaProfesional || doctor?.cedula)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Fecha de emision:</Text><Text style={styles.value}>{new Date().toLocaleDateString('es-MX')}</Text></View>
          </View>
        </View>

        <View style={styles.auditInfo}>
          <Text style={styles.auditText}>AUDITORIA CLINICA</Text>
          <Text style={styles.auditText}>Estado: {auditLabel(ultimaAuditoria?.status)}</Text>
          <Text style={styles.auditText}>Puntaje de integridad: {typeof ultimaAuditoria?.score === 'number' ? `${ultimaAuditoria.score}%` : '--'}</Text>
          <Text style={styles.auditText}>Criticos pendientes: {Array.isArray(ultimaAuditoria?.missingCritical) && ultimaAuditoria.missingCritical.length ? ultimaAuditoria.missingCritical.join(', ') : 'Ninguno'}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxHeader}>Antecedentes y Alergias</Text>
          <View style={styles.boxBody}>
            <Text style={styles.lineTitle}>Patologicos</Text>
            <View style={styles.lineRule} />
            <Text style={styles.p}>{safe(expedienteActual?.antecedentes?.patologicos?.actuales, 'No se refieren.')}</Text>

            <Text style={styles.lineTitle}>Alergias</Text>
            <View style={styles.lineRule} />
            <Text style={styles.p}>
              {Array.isArray(expedienteActual?.antecedentes?.alergias?.lista) && expedienteActual.antecedentes.alergias.lista.length > 0
                ? expedienteActual.antecedentes.alergias.lista.map((a) => a?.sustancia).filter(Boolean).join(', ')
                : 'Negadas'}
            </Text>
          </View>
        </View>

        {consultas.map((c, idx) => (
          <View key={`${c?.id || 'c'}_${idx}`} style={styles.box} wrap={false}>
            <View style={styles.consultHeader}>
              <Text>Consulta</Text>
              <Text>{safe(c?.fecha, '--/--/----')}</Text>
            </View>
            <View style={styles.boxBody}>
              <Text style={styles.p}><Text style={{ fontWeight: 'bold' }}>Medico:</Text> {safe(c?.medicoNombre || doctor?.nombre)}    <Text style={{ fontWeight: 'bold' }}>Auditoria:</Text> {auditLabel(c?.auditSnapshot?.status)}{typeof c?.auditSnapshot?.score === 'number' ? ` (${c.auditSnapshot.score}%)` : ''}</Text>

              <Text style={styles.lineTitle}>Padecimiento</Text>
              <View style={styles.lineRule} />
              <Text style={styles.p}>{safe(c?.padecimiento, 'Sin descripcion clinica.')}</Text>

              <Text style={styles.lineTitle}>Exploracion</Text>
              <View style={styles.lineRule} />
              <Text style={styles.p}>TA: {safe(c?.signos?.ta)}   Temp: {safe(c?.signos?.temp)}   FC: {safe(c?.signos?.fc)}   FR: {safe(c?.signos?.fr)}   SpO2: {safe(c?.signos?.spo2)}</Text>

              <Text style={styles.lineTitle}>Diagnostico y Tratamiento</Text>
              <View style={styles.lineRule} />
              <Text style={styles.p}>{safe(c?.diagnostico, 'Sin diagnostico')}</Text>
              {Array.isArray(c?.receta) && c.receta.length > 0 ? (
                c.receta.map((med, medIdx) => (
                  <Text key={`${med?.nombre || 'm'}_${medIdx}`} style={styles.medItem}>- {safe(med?.nombre, 'Medicamento')} | {safe(med?.dosis, 'Dosis no especificada')}</Text>
                ))
              ) : (
                <Text style={styles.p}>Sin tratamiento registrado.</Text>
              )}

              <Text style={styles.lineTitle}>Indicaciones</Text>
              <View style={styles.lineRule} />
              <Text style={styles.p}>{safe(c?.indicaciones, 'Sin indicaciones registradas.')}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.foot} render={({ pageNumber, totalPages }) => `Expediente clinico profesional SRS | Pagina ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default DocumentoHistoriaPDF;
