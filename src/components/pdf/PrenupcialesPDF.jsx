import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 50,      
    paddingBottom: 50,   
    paddingHorizontal: 60,
    fontFamily: 'Helvetica', 
    fontSize: 11,
    lineHeight: 1.5,
    backgroundColor: '#ffffff'
  },
  header: {
    marginBottom: 40
  },
  logo: {
    width: 180, 
    height: 'auto',
    marginBottom: 20
  },
  date: {
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 40,
    fontWeight: 'bold'
  },
  paragraph: {
    marginBottom: 20,
    fontSize: 11,
    textAlign: 'justify',
    lineHeight: 1.6
  },
  bold: {
    fontWeight: 'bold', 
    fontFamily: 'Helvetica-Bold'
  },
  footerContainer: {
    marginTop: 80, 
    alignItems: 'flex-end', 
    paddingRight: 20
  },
  signatureText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 50,
    alignSelf: 'flex-start' 
  },
  // Bloque de Firma
  qcbBlock: {
    alignItems: 'center',
    width: 250
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: '100%',
    marginBottom: 5
  },
  drName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase'
  },
  drInfo: {
    fontSize: 9,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 2
  },
  bottomLogo: {
    position: 'absolute',
    bottom: 40,
    left: 60,
    width: 120,
    height: 'auto',
    opacity: 0.8
  }
});

const PrenupcialesPDF = ({ paciente, datos }) => {
  
  // Fecha actual (Encabezado)
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  // Fecha de estudios seleccionada en el modal
  const fechaEstudiosObj = new Date(datos.fechaEstudios + 'T12:00:00'); 
  const fechaEstudiosTexto = fechaEstudiosObj.toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno || ''}`.trim().toUpperCase();
  const edad = paciente.edad ? paciente.edad : "___ AÑOS";

  // Prefijo
  const prefijo = paciente.sexo === 'Femenino' ? 'LA SRITA.' : 'AL SR.';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* LOGO */}
        <View style={styles.header}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        {/* FECHA */}
        <Text style={styles.date}>Monterrey N.L, {fechaHoy}</Text>

        {/* CUERPO */}
        <View>
            <Text style={styles.paragraph}>
                Por medio de la presente hago constar que en los estudios de laboratorio realizados el día <Text style={styles.bold}>{fechaEstudiosTexto}</Text> a <Text style={styles.bold}>{prefijo} {nombrePaciente}</Text> con <Text style={styles.bold}>{edad}</Text> de edad, no se encontró ninguna anomalía.
            </Text>
            
            <Text style={styles.paragraph}>
                Así mismo, dadas las evidencias mostradas, certifico que <Text style={styles.bold}>{nombrePaciente}</Text> se encuentra al día de hoy completamente {paciente.sexo === 'Femenino' ? 'apta' : 'apto'} para contraer matrimonio.
            </Text>

            <Text style={styles.paragraph}>
                Para los fines que al interesado convenga extiendo la presente y anexo los exámenes clínicos (prenupciales).
            </Text>
        </View>

        <Text style={{ marginTop: 20, marginBottom: 20 }}>QUEDO DE USTED:</Text>

        <Text style={styles.signatureText}>A T E N T A M E N T E</Text>

        {/* FIRMA DINÁMICA (Toma los datos del perfil del médico) */}
        <View style={styles.footerContainer}>
            <View style={styles.qcbBlock}>
                {/* Espacio para firma autógrafa */}
                <View style={{height: 40}}></View> 
                <View style={styles.signatureLine} />
                <Text style={styles.drName}>{datos.responsableNombre.toUpperCase()}</Text>
                <Text style={styles.drInfo}>CED. PROF. {datos.responsableCedula}</Text>
            </View>
        </View>

        <Image src={logoImg} style={styles.bottomLogo} />

      </Page>
    </Document>
  );
};

export default PrenupcialesPDF;