import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import logoImg from '../../assets/logo_azul.png'; 

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,      
    paddingBottom: 40,   
    paddingHorizontal: 50,
    fontFamily: 'Times-Roman',
    fontSize: 10,
    lineHeight: 1.4,
    backgroundColor: '#ffffff'
  },
  // ENCABEZADO CON LOGO
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between'
  },
  logo: {
    width: 140, 
    height: 'auto'
  },
  
  // TÍTULO
  titleContainer: {
    textAlign: 'center',
    marginBottom: 20
  },
  title: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  subtitle: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 5
  },

  // CUERPO
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
    fontSize: 10
  },
  bold: {
    fontFamily: 'Times-Bold'
  },
  
  // LISTA DE RIESGOS
  listContainer: {
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 5
  },
  listItem: {
    fontSize: 9,
    fontStyle: 'italic',
    marginBottom: 2,
    color: '#333'
  },

  // FIRMA Y FECHA FINAL
  footerSection: {
    marginTop: 30,
  },
  dateText: {
    marginBottom: 40,
    textAlign: 'justify'
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 300,
    marginTop: 40,
    marginBottom: 5,
    alignSelf: 'center' // Centrar la línea de firma
  },
  signatureText: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    textAlign: 'center'
  }
});

const ConsentimientoInformadoPDF = ({ datos }) => {
  
  // Fechas dinámicas
  const hoy = new Date();
  const dia = hoy.getDate();
  const mes = hoy.toLocaleDateString('es-MX', { month: 'long' });
  const anio = hoy.getFullYear();

  // Nombre a mostrar (Paciente o Responsable)
  const nombreFirma = (datos.nombreResponsable || datos.nombrePaciente || "").toUpperCase();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* LOGO */}
        <View style={styles.headerRow}>
            <Image src={logoImg} style={styles.logo} />
        </View>

        {/* TÍTULO */}
        <View style={styles.titleContainer}>
            <Text style={styles.title}>CONSENTIMIENTO INFORMADO</Text>
            <Text style={styles.subtitle}>AUTORIZACIÓN PARA DIAGNOSTICO Y TRATAMIENTOS MÉDICOS.</Text>
        </View>

        {/* CUERPO TEXTO LEGAL */}
        <View>
            <Text style={styles.paragraph}>
                El que suscribe la presente con carácter de "Paciente" <Text style={styles.bold}>{datos.nombrePaciente.toUpperCase()}</Text> de manera voluntaria y en plena conciencia, autorizo al personal del <Text style={styles.bold}>"Centro Médico Santa Cruz"</Text> o a quien se considere pertinente, para que me practiquen (le practiquen al paciente) los procedimientos indicados por el personal de salud.
            </Text>

            <Text style={styles.paragraph}>
                Así mismo, otorgo en forma libre mi consentimiento al personal médico y de enfermería, para que en ejercicio legal de su profesión y de acuerdo al procedimiento establecido, me practique la administración de medicamento por vía parenteral (inyectología) en cumplimiento al tratamiento farmacológico indicado por el Médico.
            </Text>

            <Text style={styles.paragraph}>
                La vía de administración puede ser aplicada de la siguiente manera:
                INTRAMUSCULAR, INTRAVENOSA, INTRADERMICA o SUBCUTANEA.
            </Text>

            {/* Lista de Riesgos */}
            <View style={styles.listContainer}>
                <Text style={styles.listItem}>
                    • (Entiendo que este procedimiento puede causar algunas reacciones no deseadas o complicaciones inherentes a la aplicación del medicamento, tales como: equimosis, hematomas, neuropatías, intolerancia al medicamento, reacciones alérgicas o reacciones propias del medicamento.)
                </Text>
            </View>

            <Text style={styles.paragraph}>
                De igual manera autorizo que se me practiquen (se le practiquen al paciente), toma de imágenes radiológicas, exámenes o procedimientos con objeto de diagnóstico o terapéuticos que sean necesarios.
            </Text>

            <Text style={styles.paragraph}>
                Se me ha explicado con un lenguaje simple en qué consisten los tratamientos, y procedimientos médicos que se me practicarán (se le practicarán al paciente) y los riesgos inherentes, por lo que bajo ese entendido reconozco haber sido debidamente informado de los riesgos más comunes, incluyendo hemorragias, infecciones, reacciones alérgicas y otras asociadas a la práctica de cualquier procedimiento médico. También he sido informado de algunos otros riesgos que entrañan los procedimientos médicos que me practicarán (que le practicarán al paciente).
            </Text>

            <Text style={styles.paragraph}>
                Comprendo que la práctica de la medicina no es una ciencia exacta y reconozco que no me han asegurado ni garantizado que los resultados de los procedimientos arriba mencionados necesariamente alcancen los beneficios esperados.
            </Text>

            <Text style={styles.paragraph}>
                Consiento que se me administre (se administre al paciente) medicamentos y la terapia que, a juicio del personal de salud arriba indicado, sus asociados, colaboradores o médicos interconsultantes.
            </Text>

            <Text style={styles.paragraph}>
                Se me ha explicado ampliamente que durante los procedimientos antes mencionados pueden presentarse imprevistos que obliguen a los médicos tratantes a variar los procedimientos originales, por consiguiente ante cualquier complicación o efecto adverso durante dicho procedimiento, especialmente frente a una urgencia médica, autorizo y solicito al personal al principio mencionado, sus asociados, colaboradores o médicos interconsultantes que realicen los procedimientos médicos que consideren necesarios conforme a su juicio y experiencia profesional para la protección de mi salud (la salud del paciente), en la inteligencia que la presente autorización también será aplicada a cualquier condición que requiera de procedimientos médicos que sean desconocidos por los facultativos y surjan durante el procedimiento.
            </Text>
        </View>

        {/* PIE DE PÁGINA: FECHA Y FIRMA */}
        <View style={styles.footerSection}>
            <Text style={styles.dateText}>
                Entiendo el contenido del presente documento y conforme al mismo, lo firmo en la ciudad de Santa Catarina, Nuevo León, México el día de <Text style={styles.bold}>{dia}</Text> de <Text style={styles.bold}>{mes.toUpperCase()}</Text> de <Text style={styles.bold}>{anio}</Text>.
            </Text>

            <View style={styles.signatureLine}></View>
            <Text style={styles.signatureText}>{nombreFirma}</Text>
            <Text style={{textAlign: 'center', fontSize: 9, marginTop: 2}}>Nombre y firma del Paciente o Responsable</Text>
        </View>

      </Page>
    </Document>
  );
};

export default ConsentimientoInformadoPDF;