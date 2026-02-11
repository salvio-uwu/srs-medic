import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#333', paddingBottom: 10 },
  drName: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  drInfo: { fontSize: 9, color: '#555', marginBottom: 2 },
  title: { fontSize: 16, color: '#666', textTransform: 'uppercase', marginTop: 10, marginBottom: 5, letterSpacing: 1 },
  patientGrid: { marginBottom: 15, backgroundColor: '#f8fafc', padding: 10, borderRadius: 5 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 120, fontSize: 9, fontWeight: 'bold', color: '#64748b' },
  value: { flex: 1, fontSize: 9, textTransform: 'uppercase', fontWeight: 'bold' },
  cyanBar: { backgroundColor: '#00C2CB', padding: 6, marginTop: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  cyanBarText: { color: 'white', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },
  contentBlock: { marginLeft: 10, marginBottom: 15 },
  subHeader: { fontSize: 9, fontWeight: 'bold', marginTop: 8, marginBottom: 4, textTransform: 'uppercase', color: '#0e7490', borderBottomWidth: 0.5, borderBottomColor: '#bae6fd' },
  textData: { fontSize: 9, marginBottom: 2, lineHeight: 1.4 },
  pageNumber: { position: 'absolute', fontSize: 9, bottom: 30, left: 0, right: 0, textAlign: 'center', color: 'grey' },
});

const DocumentoHistoriaPDF = ({ paciente, historial, doctor, expedienteActual }) => {
  const fechaImpresion = new Date().toLocaleDateString('es-MX');
  
  // Validaciones de seguridad para evitar el crash
  const pxNombre = paciente?.nombre || 'Paciente';
  const pxEdad = expedienteActual?.px_info?.edad || '--';
  const docNombre = doctor?.nombre || 'Médico General';
  const docCedula = doctor?.cedulaProfesional || '---';
  const listaHistorial = Array.isArray(historial) ? historial : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* CABECERA */}
        <View style={styles.headerContainer}>
            <Text style={styles.drName}>Dr(a). {docNombre}</Text>
            <Text style={styles.drInfo}>MEDICINA GENERAL • Ced. Prof: {docCedula}</Text>
            <Text style={styles.drInfo}>Centro Médico Santa Cruz</Text>
            <Text style={styles.title}>Historia Clínica General</Text>
            <Text style={{fontSize: 8, color: '#999'}}>Fecha de emisión: {fechaImpresion}</Text>
        </View>

        {/* DATOS DEL PACIENTE */}
        <View style={styles.patientGrid}>
            <View style={styles.row}><Text style={styles.label}>ID PACIENTE:</Text><Text style={styles.value}>{expedienteActual?.px_info?.id_receta || '---'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>NOMBRE COMPLETO:</Text><Text style={styles.value}>{pxNombre}</Text></View>
            <View style={styles.row}><Text style={styles.label}>EDAD / SEXO:</Text><Text style={styles.value}>{pxEdad} • {paciente?.sexo || '--'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>GRUPO SANGUÍNEO:</Text><Text style={styles.value}>{expedienteActual?.px_info?.grupo_sanguineo || '---'}</Text></View>
        </View>

        {/* ANTECEDENTES */}
        <View style={styles.cyanBar}><Text style={styles.cyanBarText}>Antecedentes y Alergias</Text></View>
        <View style={styles.contentBlock}>
            <Text style={styles.subHeader}>Patológicos:</Text>
            <Text style={styles.textData}>{expedienteActual?.antecedentes?.patologicos?.actuales || 'No se refieren.'}</Text>
            <Text style={styles.subHeader}>Alergias:</Text>
            <Text style={styles.textData}>
               {expedienteActual?.antecedentes?.alergias?.lista?.length > 0 
                 ? expedienteActual.antecedentes.alergias.lista.map(a => a.sustancia || '').join(', ')
                 : 'Negadas.'}
            </Text>
        </View>

        {/* CONSULTAS */}
        {listaHistorial.map((c, i) => (
            <View key={i} wrap={false}>
                <View style={styles.cyanBar}>
                    <Text style={styles.cyanBarText}>{i + 1}. CONSULTA MÉDICA - {c.fecha || '--/--/----'}</Text>
                </View>
                <View style={styles.contentBlock}>
                    <Text style={styles.subHeader}>Motivo / Padecimiento</Text>
                    <Text style={styles.textData}>{c.padecimiento || 'Sin descripción'}</Text>

                    <Text style={styles.subHeader}>Exploración y Signos</Text>
                    <Text style={styles.textData}>
                        TA: {c.signos?.ta || '--'} | Temp: {c.signos?.temp || '--'}°C | FC: {c.signos?.fc || '--'} | SpO2: {c.signos?.spo2 || '--'}%
                    </Text>

                    <Text style={styles.subHeader}>Diagnóstico y Plan</Text>
                    <Text style={{...styles.textData, fontWeight: 'bold'}}>{c.diagnostico || 'Sin diagnóstico'}</Text>
                    
                    {Array.isArray(c.receta) && c.receta.map((m, idx) => (
                        <Text key={idx} style={{...styles.textData, marginLeft: 10}}>• {m.nombre || ''}: {m.dosis || ''}</Text>
                    ))}
                    
                    {c.indicaciones && <Text style={{...styles.textData, marginTop: 4, fontStyle: 'italic'}}>Nota: {c.indicaciones}</Text>}
                </View>
            </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default DocumentoHistoriaPDF;