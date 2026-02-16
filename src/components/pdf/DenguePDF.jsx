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
  // ENCABEZADO
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  logo: {
    width: 140, 
    height: 'auto'
  },
  
  // FECHA
  dateContainer: {
    alignItems: 'flex-end',
    marginBottom: 30
  },
  dateText: {
    fontFamily: 'Helvetica-Bold', // Fecha en negrita
    fontSize: 11
  },

  // DATOS PACIENTE
  patientInfo: {
    marginBottom: 30,
    fontSize: 11
  },
  patientRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    width: 150
  },
  value: {
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase'
  },

  // TÍTULO
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase'
  },

  // TABLA
  tableContainer: {
    width: '60%', // La tabla no ocupa todo el ancho en la imagen
    marginLeft: 'auto', // Centrado (aprox) o alineado izquierda
    marginRight: 'auto',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 40
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    alignItems: 'center',
    height: 35
  },
  tableHeader: {
    height: 30
  },
  // Celdas
  cellConcepto: {
    width: '50%',
    borderRightWidth: 1,
    borderRightColor: '#000',
    paddingLeft: 10,
    justifyContent: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12
  },
  cellResultadoHeader: {
    width: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12
  },
  cellResultado: {
    width: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 14 // El signo + o - es grande
  },

  // FIRMA VERTICAL
  footerContainer: {
    marginTop: 100, // Espacio amplio antes de la firma
    alignItems: 'center'
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 250,
    marginBottom: 5
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
    marginBottom: 2
  },

  // PIE DE PÁGINA
  footerText: {
    position: 'absolute',
    bottom: 30,
    left: 60,
    right: 60,
    fontSize: 7,
    textAlign: 'center',
    color: '#999'
  }
});

const DenguePDF = ({ paciente, doctor, resultados, horaMuestra }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = `${paciente?.nombre || ''} ${paciente?.apellidoPaterno || ''} ${paciente?.apellidoMaterno || ''}`.trim().toUpperCase() || "PACIENTE";
  
  // Limpieza de edad
  const edadNum = paciente?.edad ? paciente.edad.toString().toLowerCase().replace('años', '').trim() : "___";
  const edad = `${edadNum} AÑOS`;
  
  // Datos Médico
  const nombreDoctor = doctor?.nombre || "DR. GENERAL";
  const cedulaDoctor = doctor?.cedulaProfesional || "PENDIENTE";
  const uniDoctor = doctor?.universidadEgreso || "UNIVERSIDAD";
  const especialidad = doctor?.especialidad || doctor?.titulo || "MÉDICO CIRUJANO PARTERO";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* LOGO */}
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        {/* FECHA */}
        <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{fechaHoy}</Text>
        </View>

        {/* DATOS PACIENTE */}
        <View style={styles.patientInfo}>
            <View style={styles.patientRow}>
                <Text style={styles.label}>Nombre:</Text>
                <Text style={styles.value}>{nombrePaciente}</Text>
            </View>
            <View style={styles.patientRow}>
                <Text style={styles.label}>Edad:</Text>
                <Text style={styles.value}>{edad}</Text>
            </View>
            <View style={styles.patientRow}>
                <Text style={styles.label}>Toma de Muestra:</Text>
                <Text style={styles.value}>Sangre completa</Text>
            </View>
            <View style={styles.patientRow}>
                <Text style={styles.label}>Horario de muestra:</Text>
                <Text style={styles.value}>{horaMuestra} HRS</Text>
            </View>
        </View>

        {/* TÍTULO */}
        <Text style={styles.mainTitle}>PRUEBA RAPIDA PARA DENGUE</Text>

        {/* TABLA */}
        <View style={styles.tableContainer}>
            {/* HEADER */}
            <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.cellConcepto, {borderRightWidth:0}]}><Text> </Text></View>
                <View style={[styles.cellResultadoHeader, {borderLeftWidth:1, borderLeftColor:'#000'}]}>
                    <Text>RESULTADO</Text>
                </View>
            </View>

            {/* CONTROL */}
            <View style={styles.tableRow}>
                <View style={styles.cellConcepto}><Text>CONTROL</Text></View>
                <View style={styles.cellResultado}>
                    <Text>{resultados.control === 'POSITIVO' ? '+' : '-'}</Text>
                </View>
            </View>

            {/* 1 (IgM) */}
            <View style={styles.tableRow}>
                <View style={styles.cellConcepto}><Text>1 (IgM)</Text></View>
                <View style={styles.cellResultado}>
                    <Text>{resultados.igm === 'POSITIVO' ? '+' : '-'}</Text>
                </View>
            </View>

            {/* 2 (IgG) */}
            <View style={styles.tableRow}>
                <View style={styles.cellConcepto}><Text>2 (IgG)</Text></View>
                <View style={styles.cellResultado}>
                    <Text>{resultados.igg === 'POSITIVO' ? '+' : '-'}</Text>
                </View>
            </View>

            {/* ANTIGENO */}
            <View style={[styles.tableRow, {borderBottomWidth: 0}]}>
                <View style={styles.cellConcepto}><Text>ANTIGENO</Text></View>
                <View style={styles.cellResultado}>
                    <Text>{resultados.antigeno === 'POSITIVO' ? '+' : '-'}</Text>
                </View>
            </View>
        </View>

        {/* FIRMA VERTICAL */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {nombreDoctor}</Text>
            <Text style={styles.drInfo}>{especialidad.toUpperCase()}</Text>
            <Text style={styles.drInfo}>{uniDoctor}</Text>
            <Text style={styles.drInfo}>Céd. Prof. {cedulaDoctor}</Text>
        </View>

        {/* PIE DE PÁGINA */}
        <Text style={styles.footerText}>
            Av. Luis Donaldo Colosio #460, Col. Tepeyac. Santa Catarina, Nuevo León, México, C.P. 66366 | Teléfono (81) 13391006
        </Text>

      </Page>
    </Document>
  );
};

export default DenguePDF;