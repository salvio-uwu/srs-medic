import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 30, // Reducido de 40 a 30
    paddingBottom: 30,   
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10, // Bajamos ligeramente la fuente base de 11 a 10
    lineHeight: 1.3,
    backgroundColor: '#ffffff'
  },
  // ENCABEZADO
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20 // Reducido de 40 a 20
  },
  logo: {
    width: 140, 
    height: 'auto'
  },
  
  // FECHA
  date: {
    textAlign: 'right',
    marginBottom: 20, // Reducido de 30 a 20
    fontFamily: 'Helvetica-Bold',
    fontSize: 10
  },

  // DATOS PACIENTE
  patientInfoBlock: {
    marginBottom: 20, // Reducido de 30 a 20
    fontSize: 10
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 150
  },
  infoValue: {
    fontFamily: 'Helvetica-Bold', 
    textTransform: 'uppercase'
  },

  // TÍTULO CENTRAL
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  subTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'uppercase'
  },
  resultTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'uppercase'
  },

  // RESULTADOS (+ / -)
  resultsContainer: {
    marginLeft: 60, 
    marginBottom: 25 // Reducido
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  resultLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    width: 150
  },
  resultSymbol: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    width: 30
  },

  // TABLA DE INTERPRETACIÓN
  interpretationBlock: {
    marginLeft: 40,
    marginBottom: 20 // Reducido
  },
  interRow: {
    flexDirection: 'row',
    marginBottom: 2,
    fontSize: 9 // Letra más pequeña para la tabla técnica
  },
  interBold: {
    fontFamily: 'Helvetica-Bold'
  },

  // NOTA PIE
  noteText: {
    fontSize: 8, // Nota legal pequeña
    fontStyle: 'italic',
    textAlign: 'justify',
    marginTop: 10,
    marginBottom: 40, // Espacio antes de la firma
    color: '#333'
  },

  // FIRMA (Pegada al fondo si es necesario, o flotante)
  footerContainer: {
    alignItems: 'center',
    marginTop: 10
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 250,
    marginBottom: 5
  },
  drName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10
  },
  drInfo: {
    fontSize: 9,
    textAlign: 'center',
    fontFamily: 'Helvetica'
  }
});

const CovidPDF = ({ paciente, doctor, horaMuestra, resultado }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = `${paciente?.nombre || ''} ${paciente?.apellidoPaterno || ''} ${paciente?.apellidoMaterno || ''}`.trim().toUpperCase() || "PACIENTE";
  const edad = paciente?.edad ? `${paciente.edad} Años` : "___ Años";
  
  const nombreDoctor = doctor?.nombre || "DR. GENERAL";
  const cedulaDoctor = doctor?.cedulaProfesional || "PENDIENTE";
  const uniDoctor = doctor?.universidadEgreso || "";

  const simboloResultado = resultado === 'POSITIVO' ? '+' : '-';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* LOGO */}
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        {/* FECHA */}
        <Text style={styles.date}>{fechaHoy}</Text>

        {/* DATOS PACIENTE */}
        <View style={styles.patientInfoBlock}>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nombre:</Text>
                <Text style={styles.infoValue}>{nombrePaciente}</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Edad:</Text>
                <Text style={styles.infoValue}>{edad}</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Toma de Muestra:</Text>
                <Text style={styles.infoValue}>Nasofaríngea.</Text>
            </View>
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Horario de muestra:</Text>
                <Text style={styles.infoValue}>{horaMuestra} Hrs.</Text>
            </View>
        </View>

        {/* TÍTULOS */}
        <Text style={styles.mainTitle}>PRUEBA RÁPIDA PARA</Text>
        <Text style={styles.subTitle}>DETECCIÓN CUALITATIVA DEL ANTÍGENO DEL SARS CoV-2</Text>
        
        <Text style={styles.resultTitle}>RESULTADO</Text>

        {/* RESULTADOS (+/-) */}
        <View style={styles.resultsContainer}>
            <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>CONTROL</Text>
                <Text style={styles.resultSymbol}>+</Text>
            </View>
            <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Ag SARS CoV-2</Text>
                <Text style={styles.resultSymbol}>{simboloResultado}</Text>
            </View>
        </View>

        {/* TABLA DE INTERPRETACIÓN */}
        <View style={styles.interpretationBlock}>
            <View style={styles.interRow}>
                <Text style={styles.interBold}>CONTROL (-) / Ag SARS CoV-2 (-) INVALIDO</Text>
            </View>
            <View style={styles.interRow}>
                <Text style={styles.interBold}>CONTROL (-) / Ag SARS CoV-2 (+) INVALIDO</Text>
            </View>
            <View style={styles.interRow}>
                <Text style={styles.interBold}>CONTROL (+) / Ag SARS CoV-2 (-) NEGATIVO</Text>
            </View>
            <View style={styles.interRow}>
                <Text style={styles.interBold}>CONTROL (+) / Ag SARS CoV-2 (+) POSITIVO PARA DETECCIÓN DEL ANTÍGENO DEL SARS CoV-2.</Text>
            </View>
        </View>

        {/* NOTA LEGAL */}
        <Text style={styles.noteText}>
            Nota: Un resultado negativo de la prueba no elimina la posibilidad de infección por SARS CoV-2 y debe confirmarse mediante cultivo viral o un ensayo molecular "PCR para detección del coronavirus SARS CoV-2" o ELISA.
        </Text>

        {/* FIRMA */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {nombreDoctor}</Text>
            <Text style={styles.drInfo}>Médico Cirujano y Partero, {uniDoctor}</Text>
            <Text style={styles.drInfo}>Céd. Prof. {cedulaDoctor}</Text>
        </View>

      </Page>
    </Document>
  );
};

export default CovidPDF;