import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 50,      
    paddingBottom: 50,   
    paddingHorizontal: 60,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.5,
    backgroundColor: '#ffffff'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    justifyContent: 'space-between'
  },
  logo: {
    width: 150, 
    height: 'auto'
  },
  headerTextContainer: {
    width: 250,
    alignItems: 'center'
  },
  headerAddress: {
    fontSize: 8,
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Times-Roman'
  },
  titleSection: {
    alignItems: 'flex-end',
    marginBottom: 30
  },
  title: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textAlign: 'right',
  },
  date: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 30
  },
  recipientTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 5
  },
  recipientBody: {
    fontSize: 11,
    marginBottom: 20
  },
  paragraph: {
    marginBottom: 15,
    fontSize: 11,
    textAlign: 'justify',
    lineHeight: 1.6,
    textIndent: 30
  },
  bold: {
    fontFamily: 'Times-Bold'
  },
  footerContainer: {
    marginTop: 60,
    alignItems: 'center'
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 250,
    marginBottom: 5
  },
  drName: {
    fontFamily: 'Times-Roman',
    fontSize: 11
  },
  drInfo: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Times-Roman'
  },
  footerBottom: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'center',
    width: '33%'
  }
});

const CartaPasaporteUniversalPDF = ({ paciente, doctor, datosPadres, esMenor }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  const nombrePaciente = `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno || ''}`.trim().toUpperCase();
  const edad = paciente.edad ? paciente.edad.toString().toUpperCase() : "___ AÑOS";

  // LOGICA DE TEXTO SEGÚN TIPO
  const renderCuerpo = () => {
    if (esMenor) {
        // --- TEXTO MENOR ---
        const madre = (datosPadres.madre || "______________________").toUpperCase();
        const padre = (datosPadres.padre || "______________________").toUpperCase();
        return (
            <View>
                <Text style={styles.paragraph}>
                    El que suscribe, Médico <Text style={styles.bold}>{doctor.nombre.toUpperCase()}</Text> legalmente autorizado para ejercer mi profesión tal como se desprende de mí cedula profesional número <Text style={styles.bold}>{doctor.cedulaProfesional || "PENDIENTE"}</Text>.
                </Text>
                <Text style={styles.paragraph}>
                    De la cual adjunto al presente una copia simple, hago constar que:
                </Text>
                <Text style={styles.paragraph}>
                    El menor <Text style={styles.bold}>{nombrePaciente}</Text> de <Text style={styles.bold}>{edad}</Text>, cuya fotografía aparece al margen, es hijo de la señora <Text style={styles.bold}>{madre}</Text> y del señor <Text style={styles.bold}>{padre}</Text>, siendo mi paciente desde el nacimiento.
                </Text>
                <Text style={styles.paragraph}>
                    Se extiende la presente a petición de la madre del menor, para los fines que a ellos convengan.
                </Text>
            </View>
        );
    } else {
        // --- TEXTO ADULTO ---
        return (
            <View>
                <Text style={styles.paragraph}>
                    El que suscribe, Médico <Text style={styles.bold}>{doctor.nombre.toUpperCase()}</Text> legalmente autorizado para ejercer mi profesión tal como se desprende de mí cedula profesional número <Text style={styles.bold}>{doctor.cedulaProfesional || "PENDIENTE"}</Text>.
                </Text>
                <Text style={styles.paragraph}>
                    Por medio de la presente hago constar que el paciente <Text style={styles.bold}>{nombrePaciente}</Text> de <Text style={styles.bold}>{edad}</Text>, acudió a consulta médica el día de hoy para valoración general.
                </Text>
                <Text style={styles.paragraph}>
                    Tras la revisión médica y la historia clínica, certifico que el paciente se encuentra clínicamente sano y apto para realizar sus trámites administrativos correspondientes.
                </Text>
                <Text style={styles.paragraph}>
                    Se extiende la presente a petición del interesado para los fines legales que a él convengan.
                </Text>
            </View>
        );
    }
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerAddress}>Cuajuco 120-A Infonavit Huasteca, Santa Catarina N.L</Text>
                <Text style={styles.headerAddress}>Tel 8139027690</Text>
            </View>
        </View>

        <View style={styles.titleSection}>
            <Text style={styles.title}>Constancia Médica para el</Text>
            <Text style={styles.title}>Tramite de Pasaporte</Text>
        </View>
        
        <Text style={styles.date}>{fechaHoy}, Santa Catarina, N.L.</Text>

        <Text style={styles.recipientTitle}>SECRETARIA DE RELACIONES EXTERIORES</Text>
        <Text style={styles.recipientBody}>Presente. -</Text>

        {/* CUERPO DINÁMICO */}
        {renderCuerpo()}

        <Text style={{ textAlign: 'center', fontFamily: 'Times-Bold', marginTop: 20, fontSize: 11 }}>ATENTAMENTE</Text>

        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {doctor.nombre}</Text>
            <Text style={styles.drInfo}>Médico Cirujano Partero</Text>
            <Text style={styles.drInfo}>{doctor.universidadEgreso || "UDEM"}</Text>
            <Text style={styles.drInfo}>Cédula Profesional. {doctor.cedulaProfesional}</Text>
        </View>

        <View style={styles.footerBottom}>
            <Text style={styles.footerText}>MAR ROJO #171 COLONIA AURORA, SANTA CATARINA, N.L. C.P. 66378</Text>
            <Text style={styles.footerText}>CUAJUCO #120-A, COL. INFONAVIT LA HUASTECA, SANTA CATARINA, N.L.</Text>
            <Text style={styles.footerText}>TEL (81) 2139 9910</Text>
        </View>

      </Page>
    </Document>
  );
};

export default CartaPasaporteUniversalPDF;