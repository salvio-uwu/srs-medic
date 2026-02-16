import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 30,   
    paddingHorizontal: 50, 
    fontFamily: 'Helvetica', 
    fontSize: 10,        
    lineHeight: 1.4,     
    position: 'relative' 
  },
  headerDate: { 
    textAlign: 'right', 
    marginBottom: 20, 
    fontSize: 10,
    fontWeight: 'bold' 
  },
  recipient: { 
    marginBottom: 10, 
    fontWeight: 'bold', 
    fontSize: 11 
  },
  bodyText: { 
    textAlign: 'justify', 
    marginBottom: 8 
  },
  bold: { 
    fontWeight: 'bold' 
  },
  sectionTitle: { 
    fontWeight: 'bold', 
    marginTop: 10, 
    marginBottom: 6, 
    textDecoration: 'underline',
    fontSize: 11
  },
  
  vitalsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 10,
    gap: 10
  },
  vitalItem: { 
    flexDirection: 'row',
    alignItems: 'center'
  },
  vitalLabel: { 
    fontWeight: 'bold', 
    marginRight: 4 
  },

  examList: {
    marginLeft: 5,
    marginBottom: 10
  },
  examItem: { 
    flexDirection: 'row', 
    marginBottom: 4, 
    textAlign: 'justify' 
  },
  examLabel: { 
    fontWeight: 'bold', 
    width: 110, 
    flexShrink: 0 
  },
  examText: { 
    flex: 1 
  },

  footerContainer: {
    position: 'absolute',
    bottom: 50, 
    left: 50,
    right: 50,
    alignItems: 'center'
  },
  signatureLine: { 
    borderTopWidth: 1, 
    borderTopColor: '#000', 
    width: 240, 
    marginBottom: 5 
  },
  drName: { 
    fontWeight: 'bold', 
    fontSize: 11,
    textTransform: 'uppercase'
  },
  drInfo: { 
    fontSize: 9, 
    color: '#333',
    marginTop: 2,
    textTransform: 'uppercase'
  }
});

const CartaBuenaSaludAdultoPDF = ({ expediente, doctor }) => {
  const { px_info } = expediente;
  const { exploracion } = expediente.consulta;
  
  const fechaHoy = new Date().toLocaleDateString('es-MX', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }).toUpperCase();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        <Text style={styles.headerDate}>{fechaHoy}</Text>
        
        <Text style={styles.recipient}>A quien corresponda:</Text>

        <Text style={styles.bodyText}>
          Por medio de la presente y para lo que al interesado convenga, hago constar que, <Text style={styles.bold}>{(expediente.pacienteNombre || '').toUpperCase()}</Text> de <Text style={styles.bold}>{px_info.edad || '--'} DE EDAD</Text> se encuentra gozando de buena salud, esto en conclusión después de hacerle una exploración física de rutina, donde no se detectaron anomalías y/o discapacidades físicas.
        </Text>

        <Text style={styles.bodyText}>
          Cabe mencionar que {expediente.meta?.anexarEstudios ? "se anexaron" : "no se realizaron"} estudios de laboratorio para descartar otras patologías.
        </Text>

        <Text style={styles.sectionTitle}>Exploración Física:</Text>

        <View style={styles.vitalsContainer}>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Peso:</Text><Text>{exploracion.antropometria.peso || '--'} kg</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Talla:</Text><Text>{exploracion.antropometria.talla || '--'} m</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>Temp:</Text><Text>{exploracion.signos.temp || '--'} °C</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>F.R.:</Text><Text>{exploracion.signos.fr || '--'} x min</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>F.C.:</Text><Text>{exploracion.signos.fc || '--'} x min</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>SaO2:</Text><Text>{exploracion.signos.spo2 || '--'}%</Text></View>
            <View style={styles.vitalItem}><Text style={styles.vitalLabel}>T/A:</Text><Text>{exploracion.signos.ta || '--'}</Text></View>
        </View>

        <View style={styles.examList}>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Neurológicamente:</Text>
                <Text style={styles.examText}>{exploracion.fisica.habitus || "Consciente, orientado en 3 esferas."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Cabeza y Cuello:</Text>
                <Text style={styles.examText}>{exploracion.fisica.cabeza || "Normocéfalo, pupilas isocóricas reactivas, orofaringe sin datos patológicos, cuello cilíndrico sin adenomegalias."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Tórax:</Text>
                <Text style={styles.examText}>{exploracion.fisica.torax || "Campos pulmonares limpios y ventilados. Ruidos cardiacos rítmicos sin soplos."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Abdomen:</Text>
                <Text style={styles.examText}>{exploracion.fisica.abdomen || "Blando, depresible, no doloroso, sin visceromegalias, peristalsis presente."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Extremidades:</Text>
                <Text style={styles.examText}>{exploracion.fisica.extremidades || "Eutróficas, reflejos normales, sin discapacidad física aparente."}</Text>
            </View>
            <View style={styles.examItem}>
                <Text style={styles.examLabel}>- Piel y tegumentos:</Text>
                <Text style={styles.examText}>{exploracion.fisica.piel || "Adecuada hidratación, sin lesiones dermatológicas activas."}</Text>
            </View>
        </View>

        <Text style={{ marginTop: 15 }}>Quedo a su disposición para cualquier duda y/o aclaración.</Text>

        <View style={styles.footerContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.drName}>Dr. {doctor.nombre}</Text>
            <Text style={styles.drInfo}>Ced. Prof. {doctor.cedulaProfesional}</Text>
            <Text style={styles.drInfo}>{doctor.universidadEgreso}</Text>
        </View>

      </Page>
    </Document>
  );
};

export default CartaBuenaSaludAdultoPDF;