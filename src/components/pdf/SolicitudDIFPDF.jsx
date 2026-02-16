import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 40,   
    paddingHorizontal: 60,
    fontFamily: 'Times-Roman',
    fontSize: 11, // Tamaño estándar legal
    lineHeight: 1.15, // <--- CAMBIO CLAVE: Espaciado compacto tipo Word
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
  
  // FECHA (Alineada a la derecha, debajo del header)
  date: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 20,
    marginBottom: 30
  },

  // DESTINATARIO
  recipient: {
    fontSize: 11,
    marginBottom: 15, // Espacio antes del cuerpo
    fontFamily: 'Times-Roman'
  },

  // CUERPO TEXTO (Compacto)
  paragraph: {
    marginBottom: 8, // <--- CAMBIO CLAVE: Párrafos más pegados (antes 15)
    fontSize: 11,
    textAlign: 'justify',
    textIndent: 0 // En tu imagen no hay sangría francesa, es bloque
  },
  bold: {
    fontFamily: 'Times-Bold'
  },

  // LISTA DE APOYOS
  listContainer: {
    marginLeft: 30, // Indentación de la lista
    marginBottom: 15,
    marginTop: 5
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 2, // <--- CAMBIO CLAVE: Items pegados entre sí
    alignItems: 'flex-start'
  },
  bullet: {
    width: 15,
    fontSize: 14,
    lineHeight: 1
  },
  itemText: {
    fontSize: 11,
    fontFamily: 'Times-Roman'
  },

  // FIRMA
  footerContainer: {
    marginTop: 60, // Espacio para firmar
    alignItems: 'center'
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 240,
    marginBottom: 5
  },
  drName: {
    fontFamily: 'Times-Bold', 
    fontSize: 11
  },
  drInfo: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Times-Bold',
    marginTop: 1
  }
});

const SolicitudDIFPDF = ({ paciente, doctor, apoyos }) => {
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }); 

  const nombrePaciente = `${paciente.nombre} ${paciente.apellidoPaterno} ${paciente.apellidoMaterno || ''}`.trim().toUpperCase();
  // Validar edad para que no salga "undefined"
  const edad = paciente.edad ? paciente.edad : "___ años";

  const listaApoyos = [];
  if (apoyos.sillaRuedas) listaApoyos.push("Silla de Ruedas.");
  if (apoyos.sillaTraslado) listaApoyos.push("Silla de Traslado.");
  if (apoyos.camaHospitalaria) listaApoyos.push("Cama tipo Hospitalaria.");
  if (apoyos.colchonAntiLlagas) listaApoyos.push("Colchón Anti llagas.");
  if (apoyos.revisionDomicilio) listaApoyos.push("Revisión medica en su domicilio.");
  if (apoyos.otro) listaApoyos.push(apoyos.otro);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* LOGO */}
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        {/* FECHA */}
        <Text style={styles.date}>{fechaHoy}</Text>

        <Text style={styles.recipient}>A quien corresponda:</Text>

        {/* CUERPO PRINCIPAL - TEXTO CORRIDO Y COMPACTO */}
        <View>
            <Text style={styles.paragraph}>
                Por medio de la presente y para lo que al interesado convenga, hago constar que la paciente <Text style={styles.bold}>{nombrePaciente}</Text> de <Text style={styles.bold}>{edad}</Text> de edad.
            </Text>
            <Text style={styles.paragraph}>
                Debido a su avanzada edad, ha perdido gran parte de su movilidad y tiene dificultades para realizar actividades cotidianas como bañarse, vestirse y alimentarse. Además, no cuenta con los recursos económicos necesarios para costear artículos que le ayuden a mejorar su calidad de vida.
            </Text>
            <Text style={styles.paragraph}>
                Por esta razón, le solicito su apoyo para que pueda recibir la ayuda que necesita.
            </Text>
        </View>

        {/* LISTA COMPACTA */}
        <View style={styles.listContainer}>
            {listaApoyos.map((item, index) => (
                <View style={styles.listItem} key={index}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.itemText}>{item}</Text>
                </View>
            ))}
            {listaApoyos.length === 0 && (
                <Text style={{fontSize: 10, color: '#999', fontStyle: 'italic'}}>(No seleccionó requerimientos específicos)</Text>
            )}
        </View>

        <Text style={{ marginTop: 10, fontFamily: 'Times-Roman', fontSize: 11 }}>
            Sin más por el momento me pongo a su disposición para cualquier duda o aclaraciones.
        </Text>

        {/* FIRMA */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {doctor.nombre}</Text>
            <Text style={styles.drInfo}>Ced. Prof. {doctor.cedulaProfesional}</Text>
            <Text style={styles.drInfo}>{doctor.universidadEgreso || 'MCP'}</Text>
        </View>

      </Page>
    </Document>
  );
};

export default SolicitudDIFPDF;