import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 
import { getPatientDisplayName } from '../../utils/patientName';

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 40,   
    paddingHorizontal: 50,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    backgroundColor: '#ffffff'
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logo: { width: 140, height: 'auto', marginRight: 20 },
  mainTitle: { fontFamily: 'Times-Bold', fontSize: 12, textTransform: 'uppercase', textAlign: 'center', marginBottom: 20 },
  patientInfoRow: { flexDirection: 'row', marginBottom: 8, fontSize: 10 },
  infoLabel: { fontFamily: 'Times-Roman' },
  infoValue: { fontFamily: 'Times-Bold', marginLeft: 5, marginRight: 20, textTransform: 'uppercase' },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, fontSize: 10, paddingRight: 40 },
  tableContainer: { marginLeft: 40, marginBottom: 60 },
  tableHeader: { flexDirection: 'row', marginBottom: 15 },
  headerCell1: { width: 200, fontFamily: 'Times-Bold', fontSize: 11, textAlign: 'center' },
  headerCell2: { width: 150, fontFamily: 'Times-Bold', fontSize: 11, textAlign: 'left', paddingLeft: 20 },
  tableRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
  cellLabel: { width: 200, fontFamily: 'Times-Bold', fontSize: 11, textAlign: 'right', paddingRight: 40 },
  
  // --- AQUÍ ESTABA EL ERROR ---
  // Cambiamos 'Times-Bold' + fontStyle:'italic' por 'Times-BoldItalic' directo.
  cellValue: { 
    width: 150, 
    fontFamily: 'Times-BoldItalic', // <--- CORRECCIÓN CLAVE
    fontSize: 11, 
    textAlign: 'left', 
    paddingLeft: 20 
  },

  footerContainer: { marginTop: 80, alignItems: 'center' },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#000', width: 300, marginBottom: 5 },
  drName: { fontFamily: 'Times-Roman', fontSize: 11 },
  drInfo: { fontSize: 10, textAlign: 'center', fontFamily: 'Times-Roman' },
  bottomTitle: { marginTop: 40, fontFamily: 'Times-Roman', fontSize: 10, textAlign: 'center', textTransform: 'uppercase' }
});

const AntidopingPDF = ({ paciente, doctor, motivo, resultados }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = getPatientDisplayName(paciente || {}).toUpperCase() || "PACIENTE SIN NOMBRE";
  const edad = paciente?.edad ? paciente.edad : "___ AÑOS";
  
  const nombreDoctor = doctor?.nombre || "DR. NO IDENTIFICADO";
  const cedulaDoctor = doctor?.cedulaProfesional || "PENDIENTE";
  const universidadDoctor = doctor?.universidadEgreso || "";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        <Text style={styles.mainTitle}>PRUEBA DE ANTIDOPING EN ORINA</Text>

        <View style={styles.patientInfoRow}>
            <Text style={styles.infoLabel}>Nombre de (EL) paciente:</Text>
            <Text style={styles.infoValue}>{nombrePaciente}</Text>
            <Text style={styles.infoLabel}>Edad:</Text>
            <Text style={styles.infoValue}>{edad}</Text>
        </View>

        <View style={styles.detailsRow}>
            <View style={{flexDirection: 'row'}}>
                <Text style={styles.infoLabel}>Motivo del Estudio:</Text>
                <Text style={{...styles.infoValue, marginLeft: 30}}>{motivo}</Text>
            </View>
            <View style={{flexDirection: 'row'}}>
                <Text style={styles.infoLabel}>Fecha:</Text>
                <Text style={styles.infoValue}>{fechaHoy}</Text>
            </View>
        </View>

        <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
                <Text style={styles.headerCell1}>PRUEBA</Text>
                <Text style={styles.headerCell2}>RESULTADO</Text>
            </View>
            <View style={styles.tableRow}><Text style={styles.cellLabel}>COC “COCAINA”</Text><Text style={styles.cellValue}>{resultados.cocaina}</Text></View>
            <View style={styles.tableRow}><Text style={styles.cellLabel}>THC “MARIHUANA”</Text><Text style={styles.cellValue}>{resultados.marihuana}</Text></View>
            <View style={styles.tableRow}><Text style={styles.cellLabel}>AMP “ANFETAMINAS”</Text><Text style={styles.cellValue}>{resultados.anfetaminas}</Text></View>
            <View style={styles.tableRow}><Text style={styles.cellLabel}>OPI “OPIACEOS “</Text><Text style={styles.cellValue}>{resultados.opiaceos}</Text></View>
            <View style={styles.tableRow}><Text style={styles.cellLabel}>MET “METANFETAMINAS”</Text><Text style={styles.cellValue}>{resultados.metanfetaminas}</Text></View>
        </View>

        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {nombreDoctor}</Text>
            <Text style={styles.drInfo}>Médico Cirujano Partero</Text>
            <Text style={styles.drInfo}>{universidadDoctor} Cédula Profesional. {cedulaDoctor}</Text>
        </View>

        <Text style={styles.bottomTitle}>PRUEBA DE ANTIDOPING EN ORINA</Text>

      </Page>
    </Document>
  );
};

export default AntidopingPDF;