import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 40,   
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 9, // Letra pequeña para documentos legales extensos
    lineHeight: 1.4,
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between'
  },
  logo: {
    width: 120, 
    height: 'auto'
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'right',
    color: '#1e293b'
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 4,
    color: '#0f172a'
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
    color: '#334155'
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a'
  },
  list: {
    marginLeft: 15,
    marginBottom: 8
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 2
  },
  bullet: {
    width: 10,
    fontSize: 10
  },
  listText: {
    flex: 1
  },
  table: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
    marginBottom: 10
  },
  tableRow: { 
    flexDirection: "row" 
  },
  tableColHeader: { 
    width: "33%", 
    borderStyle: "solid", 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    padding: 5
  },
  tableCol: { 
    width: "33%", 
    borderStyle: "solid", 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    padding: 5
  },
  tableCellHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold'
  },
  tableCell: {
    fontSize: 8
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    textAlign: 'center',
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10
  }
});

const AvisoPrivacidadPDF = () => {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
            <Image src={logoImg} style={styles.logo} />
            <Text style={styles.title}>AVISO DE PRIVACIDAD</Text>
        </View>

        {/* CONTENIDO LEGAL */}
        <View>
            <Text style={styles.paragraph}>
                <Text style={styles.bold}>Centro de Servicios y Atención Médica SE, S. de R.L. de C.V.</Text>, con domicilio en <Text style={styles.bold}>MAR ROJO #171 COL. AURORA, SANTA CATARINA, NUEVO LEÓN, MÉXICO C.P. 66378</Text>, es el responsable del uso y protección de sus datos personales, y al respecto le informamos lo siguiente:
            </Text>

            <Text style={styles.sectionTitle}>¿Para qué fines utilizaremos sus datos personales?</Text>
            <Text style={styles.paragraph}>Los datos personales que recabamos de usted, los utilizaremos para las siguientes finalidades que son necesarias para el servicio que solicita:</Text>
            <View style={styles.list}>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Mantener actualizados los datos del expediente clínico.</Text></View>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Localización de los pacientes o familiares en caso de ser necesario para cuestiones médicas.</Text></View>
            </View>

            <Text style={styles.paragraph}>De manera adicional, utilizaremos su información personal para las siguientes finalidades que no son necesarias para el servicio solicitado, pero que nos permiten y facilitan brindarle una mejor atención:</Text>
            <View style={styles.list}>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Reportar resultados de Laboratorio de manera oportuna.</Text></View>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Concretar, confirmar o cancelación de citas.</Text></View>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Brindar información o solicitar información extra y necesaria para los servicios solicitados.</Text></View>
                <View style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>Envió de documentos, facturas o información pertinente a los servicios.</Text></View>
            </View>
            <Text style={styles.paragraph}>
                En caso de que no desee que sus datos personales sean tratados para estos fines adicionales, puede comunicarlo directamente en recepción o marcando la opción correspondiente en su registro. La negativa para el uso de sus datos personales para estas finalidades no podrá ser un motivo para que le neguemos los servicios.
            </Text>

            <Text style={styles.sectionTitle}>¿Qué datos personales utilizaremos para estos fines?</Text>
            <Text style={styles.paragraph}>
                Para llevar a cabo las finalidades descritas, utilizaremos: Nombre completo, sexo, fecha de nacimiento, nacionalidad, CURP, INE, dirección, teléfonos y correo electrónico.
            </Text>
            <Text style={styles.paragraph}>
                Además, utilizaremos <Text style={styles.bold}>datos personales sensibles</Text> que requieren especial protección: Antecedentes heredo-familiares, patológicos y no patológicos, enfermedades existentes, alergias, imágenes de laboratorio/gabinete, religión y estatus socioeconómico.
            </Text>

            <Text style={styles.sectionTitle}>¿Con quién compartimos su información personal?</Text>
            <View style={styles.table}>
                <View style={styles.tableRow}>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Destinatario</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>País</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Finalidad</Text></View>
                </View>
                <View style={styles.tableRow}>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>Secretaría de Salud N.L. / COFEPRIS</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>México</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>Verificación de expedientes clínicos.</Text></View>
                </View>
                <View style={styles.tableRow}>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>Laboratorios y Gabinetes Subrogados</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>México</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>Análisis de Laboratorios, Radiografías e interpretación.</Text></View>
                </View>
                <View style={styles.tableRow}>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>*Personal Médico Ajeno</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>MX/Ext.</Text></View>
                    <View style={styles.tableCol}><Text style={styles.tableCell}>Interconsulta o segunda opinión.</Text></View>
                </View>
            </View>
            <Text style={{fontSize: 8, fontStyle: 'italic', marginBottom: 10}}>* Para transferencias con asterisco requerimos su consentimiento explícito.</Text>

            <Text style={styles.sectionTitle}>Derechos ARCO</Text>
            <Text style={styles.paragraph}>
                Usted tiene derecho a conocer qué datos tenemos de usted (Acceso), solicitar corrección (Rectificación), eliminación (Cancelación) u oponerse al uso (Oposición). Para ejercer estos derechos, envíe un correo a <Text style={styles.bold}>dr.mariosanchez@outlook.com</Text> con el asunto "DERECHOS ARCO" o llame al <Text style={styles.bold}>81 2139-9910</Text>.
            </Text>

            <Text style={styles.sectionTitle}>Revocación de Consentimiento</Text>
            <Text style={styles.paragraph}>
                Puede revocar el consentimiento para el tratamiento de sus datos presentando su solicitud en el correo mencionado anteriormente. Considere que para ciertos fines, la revocación implicará que no podamos seguir prestándole el servicio.
            </Text>

            <Text style={styles.sectionTitle}>Cambios al Aviso de Privacidad</Text>
            <Text style={styles.paragraph}>
                Nos comprometemos a mantenerlo informado sobre cambios en este aviso a través de nuestra página web <Text style={styles.bold}>www.centromedicosantacruz.com</Text>.
            </Text>

        </View>

        <Text style={styles.footer}>
            Última actualización: 22 de Mayo de 2024  |  Centro Médico Santa Cruz
        </Text>

      </Page>
    </Document>
  );
};

export default AvisoPrivacidadPDF;