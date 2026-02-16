import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// IMPORTANTE: Asegúrate de que la ruta a tu logo sea correcta.
// Si tu logo se llama diferente, cambia 'logo_azul.png' por el nombre real.
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 40,   
    paddingHorizontal: 60,
    fontFamily: 'Times-Roman', // Fuente Formal
    fontSize: 11,
    lineHeight: 1.3,
    position: 'relative',
    backgroundColor: '#ffffff'
  },
  // ENCABEZADO CON LOGO Y FECHA
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    height: 60 // Altura fija para el encabezado
  },
  logo: {
    width: 130, // Ajusta este ancho según tu logo real
    height: 'auto',
    objectFit: 'contain'
  },
  headerDate: { 
    textAlign: 'right', 
    width: 200,
    fontSize: 11,
    fontFamily: 'Times-Bold',
    marginTop: 10
  },
  
  recipient: { 
    marginBottom: 15, 
    fontFamily: 'Times-Bold', 
    fontSize: 11,
    textAlign: 'left'
  },
  bodyText: { 
    textAlign: 'justify', 
    marginBottom: 10,
    fontSize: 11
  },
  bold: { 
    fontFamily: 'Times-Bold'
  },
  sectionTitle: { 
    fontFamily: 'Times-Bold',
    marginTop: 15, 
    marginBottom: 8, 
    textDecoration: 'underline',
    fontSize: 11
  },
  
  // Vitales (Igual que adulto)
  vitalsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 15
  },
  vitalGroup: { flexDirection: 'row' },
  vitalLabel: { fontFamily: 'Times-Bold', marginRight: 4 },

  // Exploración
  examItem: { flexDirection: 'row', marginBottom: 4, textAlign: 'justify' },
  examLabel: { fontFamily: 'Times-Bold', width: 120, flexShrink: 0 },
  examText: { flex: 1 },

  // Footer Fijo
  footerContainer: {
    position: 'absolute',
    bottom: 50,
    left: 60,
    right: 60,
    alignItems: 'center'
  },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#000', width: 220, marginBottom: 5 },
  drName: { fontFamily: 'Times-Bold', fontSize: 11, marginTop: 2 },
  drInfo: { fontSize: 10, textAlign: 'center', marginTop: 1 },
  bottomDate: {
    position: 'absolute',
    bottom: 30,
    right: 60,
    fontSize: 10,
    fontFamily: 'Times-Bold',
    textAlign: 'right'
  }
});

const CartaBuenaSaludMenorPDF = ({ expediente, doctor, tutorNombre, tutorParentesco }) => {
  const { px_info } = expediente;
  const { exploracion } = expediente.consulta;
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  // Valores por defecto si no se capturaron
  const nombreTutorFinal = tutorNombre || '___________________';
  const parentescoFinal = tutorParentesco || 'PADRE/MADRE/TUTOR';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* ENCABEZADO: LOGO A LA IZQUIERDA, FECHA A LA DERECHA */}
        <View style={styles.headerContainer}>
            <Image style={styles.logo} src={logoImg} />
            <Text style={styles.headerDate}>{fechaHoy}</Text>
        </View>
        
        <Text style={styles.recipient}>A quien corresponda:</Text>

        {/* PÁRRAFO PRINCIPAL ADAPTADO PARA MENOR Y TUTOR */}
        <Text style={styles.bodyText}>
          Por medio de la presente y para lo que al interesado convenga, hago constar que el menor: <Text style={styles.bold}>{(expediente.pacienteNombre || '').toUpperCase()}</Text> de <Text style={styles.bold}>{px_info.edad || '--'} EDAD</Text> quien viene acompañado de su <Text style={styles.bold}>{parentescoFinal.toUpperCase()}</Text> el/la Sr./Sra. <Text style={styles.bold}>{nombreTutorFinal.toUpperCase()}</Text>, se encuentra gozando de buena salud, esto en conclusión después de hacerle una exploración física de rutina, donde no se detectaron anomalías y/o discapacidades físicas.
        </Text>

        <Text style={styles.bodyText}>
          Cabe mencionar que {expediente.meta?.anexarEstudios ? "se anexaron" : "no se realizaron"} estudios de laboratorio para descartar otras patologías.
        </Text>

        <Text style={styles.sectionTitle}>Exploración Física:</Text>

        {/* SIGNOS VITALES */}
        <View style={styles.vitalsRow}>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>Peso:</Text><Text>{exploracion.antropometria.peso || '--'} kg</Text></View>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>Talla:</Text><Text>{exploracion.antropometria.talla || '--'} m</Text></View>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>Temp:</Text><Text>{exploracion.signos.temp || '--'} °C</Text></View>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>F.R.:</Text><Text>{exploracion.signos.fr || '--'} x min</Text></View>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>F.C.:</Text><Text>{exploracion.signos.fc || '--'} x min</Text></View>
        </View>
        <View style={styles.vitalsRow}>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>SaO2:</Text><Text>{exploracion.signos.spo2 || '--'}%</Text></View>
            <View style={styles.vitalGroup}><Text style={styles.vitalLabel}>T/A:</Text><Text>{exploracion.signos.ta || '--'}</Text></View>
        </View>

        <View style={{ marginBottom: 10 }}></View>

        {/* DETALLE EXPLORACIÓN */}
        <View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Neurológicamente:</Text><Text style={styles.examText}>{exploracion.fisica.habitus || "consciente, reactivo a estímulos."}</Text></View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Cabeza y Cuello:</Text><Text style={styles.examText}>{exploracion.fisica.cabeza || "normocéfalo, fontanelas normotensas (si aplica), faringe sin alteraciones, cuello sin adenomegalias."}</Text></View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Tórax:</Text><Text style={styles.examText}>{exploracion.fisica.torax || "Campos pulmonares con adecuada entrada y salida de aire, sin ruidos agregados. Ruidos cardiacos rítmicos."}</Text></View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Abdomen:</Text><Text style={styles.examText}>{exploracion.fisica.abdomen || "Blando, depresible, no doloroso a la palpación, sin visceromegalias."}</Text></View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Extremidades:</Text><Text style={styles.examText}>{exploracion.fisica.extremidades || "simétricas, eutróficas, con arcos de movilidad completos."}</Text></View>
            <View style={styles.examItem}><Text style={styles.examLabel}>- Piel y tegumentos:</Text><Text style={styles.examText}>{exploracion.fisica.piel || "adecuada coloración e hidratación, sin lesiones aparentes."}</Text></View>
        </View>

        <Text style={{ marginTop: 20 }}>Quedo a su disposición para cualquier duda y/o aclaración.</Text>

        {/* FIRMA */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {doctor.nombre}</Text>
            <Text style={styles.drInfo}>Ced. Prof. {doctor.cedulaProfesional}</Text>
            <Text style={styles.drInfo}>{doctor.universidadEgreso}</Text>
        </View>
        <Text style={styles.bottomDate}>{fechaHoy}</Text>

      </Page>
    </Document>
  );
};

export default CartaBuenaSaludMenorPDF;