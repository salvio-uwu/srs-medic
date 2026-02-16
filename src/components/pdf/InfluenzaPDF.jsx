import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 30,      
    paddingBottom: 30,   
    paddingHorizontal: 60,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.3,
    backgroundColor: '#ffffff'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  logo: {
    width: 140, 
    height: 'auto'
  },
  dateContainer: {
    alignItems: 'flex-end',
    marginBottom: 20
  },
  dateText: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2
  },
  patientInfo: {
    marginBottom: 15,
    fontSize: 11
  },
  patientRow: {
    marginBottom: 8
  },
  bold: {
    fontFamily: 'Helvetica-Bold'
  },
  noteContainer: {
    marginTop: 10,
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 10
  },
  noteText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'left'
  },
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 30,
    textTransform: 'uppercase'
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    alignItems: 'center',
    height: 35
  },
  tableHeader: {
    backgroundColor: '#fff',
    height: 25
  },
  cellPrueba: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#000',
    paddingLeft: 10,
    justifyContent: 'center',
    fontSize: 11
  },
  cellNormal: {
    width: '30%',
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 11
  },
  cellResult: {
    width: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 'bold'
  },
  highlight: {
    backgroundColor: '#FFFF00',
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold'
  },
  footerContainer: {
    marginTop: 80,
    alignItems: 'center'
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 250,
    marginBottom: 5,
    marginTop: 40
  },
  drName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase'
  },
  drInfo: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Helvetica',
    marginBottom: 2 // Espacio entre cada línea de info
  },
  footerText: {
    position: 'absolute',
    bottom: 30,
    left: 60,
    right: 60,
    fontSize: 7,
    textAlign: 'center',
    color: '#666'
  }
});

const InfluenzaPDF = ({ paciente, doctor, resultados }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = `${paciente?.nombre || ''} ${paciente?.apellidoPaterno || ''} ${paciente?.apellidoMaterno || ''}`.trim().toUpperCase() || "PACIENTE";
  
  // --- CORRECCIÓN DE EDAD ---
  // Limpiamos "años" si ya viene en el string para evitar "24 AÑOS AÑOS"
  const edadNum = paciente?.edad ? paciente.edad.toString().toLowerCase().replace('años', '').trim() : "___";
  const edad = `${edadNum} AÑOS`;
  
  // --- DATOS DEL MÉDICO DINÁMICOS ---
  const nombreDoctor = doctor?.nombre || "DR. GENERAL";
  const cedulaDoctor = doctor?.cedulaProfesional || "PENDIENTE";
  const uniDoctor = doctor?.universidadEgreso || "UNIVERSIDAD";
  
  // Aquí tomamos la especialidad del perfil. Si no existe, usamos el default.
  // Nota: Si en tu base de datos el campo se llama diferente (ej: 'titulo'), cámbialo aquí.
  const especialidadDoctor = doctor?.especialidad || doctor?.titulo || "MÉDICO GENERAL";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{fechaHoy}</Text>
        </View>

        <View style={styles.patientInfo}>
            <Text style={styles.patientRow}>Paciente: <Text style={styles.bold}>{nombrePaciente}</Text></Text>
            <Text style={styles.patientRow}>Edad: {edad}</Text>
        </View>

        <View style={styles.noteContainer}>
            <Text style={styles.noteText}>NOTA: En caso de prueba positiva realizar PCR como prueba confirmatoria.</Text>
        </View>

        <Text style={styles.mainTitle}>PRUEBA RAPIDA CONTRA INFLUENZA</Text>

        <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={styles.cellPrueba}><Text style={styles.bold}>Prueba</Text></View>
                <View style={styles.cellNormal}><Text style={styles.bold}>Valores Normales</Text></View>
                <View style={styles.cellResult}><Text style={styles.bold}>Resultado</Text></View>
            </View>

            <View style={styles.tableRow}>
                <View style={styles.cellPrueba}><Text>Influenza B</Text></View>
                <View style={styles.cellNormal}><Text>NEGATIVO</Text></View>
                <View style={styles.cellResult}>
                    <Text style={styles.highlight}>{resultados.influenzaB}</Text>
                </View>
            </View>

            <View style={styles.tableRow}>
                <View style={styles.cellPrueba}><Text>Influenza A</Text></View>
                <View style={styles.cellNormal}><Text>NEGATIVO</Text></View>
                <View style={styles.cellResult}>
                    <Text style={styles.highlight}>{resultados.influenzaA}</Text>
                </View>
            </View>

            <View style={[styles.tableRow, {borderBottomWidth: 0}]}>
                <View style={styles.cellPrueba}><Text>Influenza A (H1N1)</Text></View>
                <View style={styles.cellNormal}><Text>NEGATIVO</Text></View>
                <View style={styles.cellResult}>
                    <Text style={styles.highlight}>{resultados.h1n1}</Text>
                </View>
            </View>
        </View>

        {/* FIRMA ORDENADA VERTICALMENTE */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            
            {/* 1. Nombre */}
            <Text style={styles.drName}>Dr. {nombreDoctor}</Text>
            
            {/* 2. Especialidad / Título (Dinámico) */}
            <Text style={styles.drInfo}>{especialidadDoctor.toUpperCase()}</Text>
            
            {/* 3. Universidad */}
            <Text style={styles.drInfo}>{uniDoctor}</Text>
            
            {/* 4. Cédula */}
            <Text style={styles.drInfo}>Cédula Profesional. {cedulaDoctor}</Text>
        </View>

        <Text style={styles.footerText}>
            Av. Luis Donaldo Colosio #460, Col. Tepeyac. Santa Catarina, Nuevo León, México, C.P. 66366 | Teléfono (81) 13391006
        </Text>

      </Page>
    </Document>
  );
};

export default InfluenzaPDF;