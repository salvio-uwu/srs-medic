import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    paddingTop: 50,      
    paddingBottom: 40,   
    paddingHorizontal: 60, // Márgenes formales
    fontFamily: 'Times-Roman', // Fuente Serif (Formal)
    fontSize: 11, // Tamaño 11 para asegurar que quepa todo
    lineHeight: 1.3,
    position: 'relative',
    backgroundColor: '#ffffff'
  },
  // Fecha Superior
  headerDate: { 
    textAlign: 'right', 
    marginBottom: 30, 
    fontSize: 11,
    fontFamily: 'Times-Bold'
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
  
  // Fila de Vitales (Alineación tipo Tabla)
  vitalsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 15 // Espacio entre elementos
  },
  vitalGroup: {
    flexDirection: 'row'
  },
  vitalLabel: { 
    fontFamily: 'Times-Bold',
    marginRight: 4 
  },

  // Lista de Exploración
  examItem: { 
    flexDirection: 'row', 
    marginBottom: 4, 
    textAlign: 'justify' 
  },
  examLabel: { 
    fontFamily: 'Times-Bold',
    width: 120, 
    flexShrink: 0 
  },
  examText: { 
    flex: 1 
  },

  // Pie de Página Fijo (Absoluto)
  footerContainer: {
    position: 'absolute',
    bottom: 50,
    left: 60,
    right: 60,
    alignItems: 'center'
  },
  signatureLine: { 
    borderTopWidth: 1, 
    borderTopColor: '#000', 
    width: 220, 
    marginBottom: 5 
  },
  drName: { 
    fontFamily: 'Times-Bold',
    fontSize: 11,
    marginTop: 2
  },
  drInfo: { 
    fontSize: 10, 
    textAlign: 'center',
    marginTop: 1
  },
  bottomDate: {
    position: 'absolute',
    bottom: 30,
    right: 60,
    fontSize: 10,
    fontFamily: 'Times-Bold',
    textAlign: 'right'
  }
});

const CartaBuenaSaludAdultoPDF = ({ expediente, doctor }) => {
  const { px_info } = expediente;
  const { exploracion } = expediente.consulta;
  
  // Fecha formateada (Ej: 23 DE DICIEMBRE DEL 2024)
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* Fecha Superior Derecha */}
        <Text style={styles.headerDate}>{fechaHoy}</Text>
        
        <Text style={styles.recipient}>A quien corresponda:</Text>

        {/* Párrafo Principal */}
        <Text style={styles.bodyText}>
          Por medio de la presente y para lo que al interesado convenga, hago constar que, <Text style={styles.bold}>{(expediente.pacienteNombre || '').toUpperCase()}</Text> de <Text style={styles.bold}>{px_info.edad || '--'} EDAD</Text> se encuentra gozando de buena salud, esto en conclusión después de hacerle una exploración física de rutina, donde no se detectaron anomalías y/o discapacidades físicas.
        </Text>

        <Text style={styles.bodyText}>
          Cabe mencionar que {expediente.meta?.anexarEstudios ? "se anexaron" : "no se realizaron"} estudios de laboratorio para descartar otras patologías.
        </Text>

        <Text style={styles.sectionTitle}>Exploración Física:</Text>

        {/* Vitales en dos líneas limpias */}
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

        {/* Lista de Exploración */}
        <View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Neurológicamente:</Text>
                <Text style={styles.examText}>{exploracion.fisica.habitus || "consciente, orientado en 3 esferas."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Cabeza y Cuello:</Text>
                <Text style={styles.examText}>{exploracion.fisica.cabeza || "normocéfalo, con pupilas isocóricas y reactivas a la luz, orofaringe sin datos patológicos, membranas timpánicas integras, cuello cilíndrico sin ganglios ni masas palpables."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Tórax:</Text>
                <Text style={styles.examText}>{exploracion.fisica.torax || "Campos pulmonares limpios y ventilados sin estertores ni crepitantes. Ruidos cardiacos rítmicos, sin soplos, ni ruidos agregados."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Abdomen:</Text>
                <Text style={styles.examText}>{exploracion.fisica.abdomen || "Blando, depresible, no doloroso a la palpación, sin masas ni visceromegalias palpables, peristalsis presente."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Extremidades:</Text>
                <Text style={styles.examText}>{exploracion.fisica.extremidades || "eutróficas, con reflejos osteotendinosos normales, sin ninguna discapacidad física."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Piel y tegumentos:</Text>
                <Text style={styles.examText}>{exploracion.fisica.piel || "sin anomalías en piel y mucosas, con adecuado estado de hidratación."}</Text>
            </View>
        </View>

        <Text style={{ marginTop: 20 }}>Quedo a su disposición para cualquier duda y/o aclaración.</Text>

        {/* Bloque de Firma Centrado */}
        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {doctor.nombre}</Text>
            <Text style={styles.drInfo}>Ced. Prof. {doctor.cedulaProfesional}</Text>
            <Text style={styles.drInfo}>{doctor.universidadEgreso}</Text>
        </View>

        {/* Fecha inferior derecha repetida */}
        <Text style={styles.bottomDate}>{fechaHoy}</Text>

      </Page>
    </Document>
  );
};

export default CartaBuenaSaludAdultoPDF;