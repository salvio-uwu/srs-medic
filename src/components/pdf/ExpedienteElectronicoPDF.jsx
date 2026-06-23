import React from 'react';
import { Document, Page, Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  limpiar,
  calcularEdad,
  nombrePaciente,
  direccionPaciente,
  formatHeredofamiliares,
  formatAdicciones,
  formatAlergias,
  formatEspecificos,
  safeDateStr
} from '../../utils/expedienteElectronico';

const INSTITUCION = 'CENTRO MÉDICO SANTA CRUZ';

const toSafePDFData = (value) => {
  try {
    const json = JSON.stringify(value, (_, val) => {
      if (typeof val === 'function') return undefined;
      if (val === undefined) return null;
      if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString();
      if (typeof val === 'object' && val !== null && typeof val.toDate === 'function') {
        try { return val.toDate().toISOString(); } catch (_) { return null; }
      }
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) return '0';
        if (Math.abs(val) > Number.MAX_SAFE_INTEGER) return '0';
        return String(val);
      }
      return val;
    });
    return JSON.parse(json) ?? (Array.isArray(value) ? [] : {});
  } catch (_) {
    return Array.isArray(value) ? [] : (typeof value === 'object' && value !== null ? {} : '');
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111827',
    lineHeight: 1.5
  },
  header: { marginBottom: 12, alignItems: 'center' },
  headerWithQR: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  qrBox: { width: 48, height: 48, marginLeft: 8 },
  headerLine: { width: '60%', height: 1, backgroundColor: '#111827', marginTop: 3, marginBottom: 3 },
  institucion: { fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textAlign: 'center' },
  docTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 5, textTransform: 'uppercase', letterSpacing: 1.8, textAlign: 'center' },
  metaBar: { flexDirection: 'row', borderTopWidth: 0.8, borderBottomWidth: 0.8, borderColor: '#111827', marginBottom: 14 },
  metaCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 7 },
  metaCellMiddle: { flex: 1, paddingVertical: 4, paddingHorizontal: 7, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: '#111827' },
  metaLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  metaValue: { fontSize: 8.5 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.8, borderColor: '#111827' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  fieldHalf: { width: '50%', flexDirection: 'row', paddingRight: 12, paddingVertical: 2 },
  fieldThird: { width: '33.33%', flexDirection: 'column', paddingRight: 12, paddingVertical: 2 },
  fieldFull: { width: '100%', flexDirection: 'row', paddingRight: 12, paddingVertical: 2 },
  fLabel: { fontFamily: 'Helvetica-Bold', marginRight: 3 },
  fLabelThird: { fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  aLine: { flexDirection: 'row', paddingVertical: 2, marginBottom: 0 },
  aLabel: { width: 100, fontFamily: 'Helvetica-Bold' },
  aValue: { flex: 1 },
  consultaBreak: { borderTopWidth: 1, borderColor: '#111827', marginTop: 10, marginBottom: 0 },
  consultaHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 3 },
  consultaNum: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  consultaFecha: { fontSize: 8.5 },
  consultaMetaLine: { fontSize: 7.5, marginBottom: 3 },
  subTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 5, marginBottom: 1 },
  medBlock: { marginLeft: 10, marginTop: 2, marginBottom: 3 },
  medName: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 0.5 },
  medMeta: { fontSize: 7.5, marginBottom: 1 },
  medDosisView: { marginTop: 1, paddingLeft: 6, borderLeftWidth: 1, borderColor: '#111827' },
  medDosisLine: { fontSize: 8, marginBottom: 0.5, paddingRight: 8 },
  p: { marginBottom: 1 },
  empty: { fontFamily: 'Helvetica-Oblique', color: '#64748b' },
  closing: { marginTop: 16 },
  closingRule: { height: 1, backgroundColor: '#111827', marginBottom: 8 },
  legal: { fontSize: 6.5, marginBottom: 16, textAlign: 'justify', color: '#64748b' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between' },
  signBlock: { width: '42%', alignItems: 'center' },
  signLine: { width: '100%', height: 0.8, backgroundColor: '#111827', marginBottom: 3 },
  signName: { fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
  signRole: { fontSize: 7, color: '#64748b', textAlign: 'center' },
  footer: { marginTop: 18 },
  footerRule: { height: 0.8, backgroundColor: '#111827', marginBottom: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: '#64748b' }
});

const F = ({ label, value, size = 'half' }) => {
  const w = size === 'third' ? styles.fieldThird : size === 'full' ? styles.fieldFull : styles.fieldHalf;
  const lbl = size === 'third' ? styles.fLabelThird : styles.fLabel;
  return <View style={w}><Text style={lbl}>{label}:</Text><Text>{limpiar(value, '—')}</Text></View>;
};

const AL = ({ label, value }) => (
  <View style={styles.aLine}><Text style={styles.aLabel}>{label}</Text><Text style={styles.aValue}>{limpiar(value, 'No referido')}</Text></View>
);

/** Texto multilínea: cada línea en <Text> dentro de <View> para altura correcta */
const Parrafo = ({ value, fallback = '', style: textStyle }) => {
  const texto = limpiar(value, fallback);
  if (!texto) return null;
  const lineas = String(texto).split(/\r?\n/);
  return <View>{lineas.map((ln, i) => <Text key={i} style={textStyle}>{ln.trim() === '' ? ' ' : ln}</Text>)}</View>;
};

const ExpedienteElectronicoPDF = ({
  paciente: pacienteRaw = {},
  antecedentes: antecedentesRaw = {},
  consultas: consultasRaw = [],
  generadoPor = '',
  folio = '',
  qrDataUrl = ''
}) => {
  const paciente = toSafePDFData(pacienteRaw) || {};
  const antecedentes = toSafePDFData(antecedentesRaw) || {};
  const consultas = toSafePDFData(consultasRaw) || [];
  const heredo = formatHeredofamiliares(antecedentes.hereditarios || {});
  const noPat = antecedentes.no_patologicos || {};
  const pat = antecedentes.patologicos || {};
  const adicciones = formatAdicciones(pat.adicciones || {});
  const especificosTexto = formatEspecificos(pat.especificos || {});
  const otroEsp = String(pat.especificos?.otro || '').trim();
  const otroEspVisible = otroEsp && !String(pat.especificos?.otro_negado).toUpperCase().startsWith('NEGAD') ? otroEsp : '';
  const edad = calcularEdad(paciente.fechaNacimiento);
  const fechaEmision = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const folioFinal = limpiar(folio || paciente.idPaciente || paciente.id, '—');
  const alergiasTexto = formatAlergias(antecedentes.alergias || {});

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* ENCABEZADO */}
        {qrDataUrl ? (
          <View style={styles.headerWithQR}>
            {/* Espaciador izquierdo para centrar el texto */}
            <View style={{ width: 56 }} />
            <View style={styles.headerCenter}>
              <Text style={styles.institucion}>{INSTITUCION}</Text>
              <Text style={styles.docTitle}>Expediente Clínico Electrónico</Text>
              <View style={styles.headerLine} />
            </View>
            <View style={styles.qrBox}>
              <Image src={qrDataUrl} style={{ width: 48, height: 48 }} />
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Text style={styles.institucion}>{INSTITUCION}</Text>
            <Text style={styles.docTitle}>Expediente Clínico Electrónico</Text>
            <View style={styles.headerLine} />
          </View>
        )}

        {/* BARRA DE METADATOS */}
        <View style={styles.metaBar}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Folio / Expediente</Text>
            <Text style={styles.metaValue}>{folioFinal}</Text>
          </View>
          <View style={styles.metaCellMiddle}>
            <Text style={styles.metaLabel}>Fecha y hora de emisión</Text>
            <Text style={styles.metaValue}>{fechaEmision}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Expedido por</Text>
            <Text style={styles.metaValue}>{limpiar(generadoPor, 'Administración')}</Text>
          </View>
        </View>

        {/* I. FICHA */}
        <Text style={styles.sectionTitle}>I. Ficha de Identificación del Paciente</Text>
        <View style={styles.grid}>
          <F label="Nombre completo" value={nombrePaciente(paciente)} size="full" />
          <F label="Sexo" value={paciente.sexo} size="third" />
          <F label="Edad" value={edad ? `${edad} años` : ''} size="third" />
          <F label="Fecha de nacimiento" value={safeDateStr(paciente.fechaNacimiento)} size="third" />
          <F label="CURP" value={paciente.curp} size="third" />
          <F label="Grupo sanguíneo" value={paciente.grupoSanguineo} size="third" />
          <F label="Estado civil" value={paciente.estadoCivil} size="third" />
          <F label="Teléfono móvil" value={paciente.telefonoMovil} size="third" />
          <F label="Teléfono fijo" value={paciente.telefonoFijo} size="third" />
          <F label="Correo electrónico" value={paciente.email} size="third" />
          <F label="Ocupación" value={paciente.ocupacion} size="third" />
          <F label="Escolaridad" value={paciente.escolaridad} size="third" />
          <F label="Lengua" value={paciente.lengua} size="third" />
          <F label="Domicilio" value={direccionPaciente(paciente)} size="full" />
        </View>

        {/* II. HEREDOFAMILIARES */}
        <Text style={styles.sectionTitle}>II. Antecedentes Heredofamiliares</Text>
        {heredo.length
          ? heredo.map((h) => <AL key={h.label} label={h.label} value={h.valor} />)
          : <Text style={styles.empty}>Interrogados y negados.</Text>}

        {/* III. NO PATOLÓGICOS */}
        <Text style={styles.sectionTitle}>III. Antecedentes Personales No Patológicos</Text>
        <AL label="Alimentación" value={noPat.alimentacion} />
        <AL label="Higiene / baño" value={noPat.bano} />
        <AL label="Lavado dental" value={noPat.lavado_dientes} />
        <AL label="Habitación" value={noPat.habitacion} />
        <AL label="Sedentarismo" value={noPat.sedentarismo} />
        {String(noPat.otros || '').trim() ? <AL label="Otros" value={noPat.otros} /> : null}

        {/* IV. PATOLÓGICOS */}
        <Text style={styles.sectionTitle}>IV. Antecedentes Personales Patológicos</Text>
        <AL label="Padecimientos" value={pat.actuales} />
        <AL label="Quirúrgicos" value={pat.quirurgicos} />
        <AL label="Hospitalizaciones" value={pat.hospitalizaciones} />
        <AL label="Transfusionales" value={pat.transfusionales} />
        <AL label="Traumáticos" value={pat.traumaticos} />
        <AL label="Adicciones" value={adicciones || 'Negadas'} />
        {especificosTexto ? <AL label="Específicos" value={especificosTexto} /> : null}
        {otroEspVisible ? <AL label="Otros" value={otroEspVisible} /> : null}

        {/* V. ALERGIAS */}
        <Text style={styles.sectionTitle}>V. Alergias</Text>
        <Text style={styles.p}>{alergiasTexto}</Text>

        {/* VI. CONSULTAS */}
        <Text style={styles.sectionTitle}>VI. Notas de Evolución y Consultas ({consultas.length})</Text>

        {consultas.length === 0 ? (
          <Text style={styles.empty}>El paciente no cuenta con consultas registradas.</Text>
        ) : (
          consultas.map((c, idx) => {
            const num = consultas.length - idx;
            const vit = [
              { l: 'Peso', v: c.antropometria.peso, u: 'kg' },
              { l: 'Talla', v: c.antropometria.talla, u: 'm' },
              { l: 'IMC', v: c.antropometria.imc },
              { l: 'Temp.', v: c.signos.temp, u: '°C' },
              { l: 'T/A', v: c.signos.ta },
              { l: 'F.C.', v: c.signos.fc, u: 'lpm' },
              { l: 'F.R.', v: c.signos.fr, u: 'rpm' },
              { l: 'SpO₂', v: c.signos.spo2, u: '%' }
            ].filter((s) => String(s.v || '').trim());
            const hayFisica = Object.values(c.fisica).some((v) => String(v || '').trim());
            const estudios = [
              ...(c.estudios.paquetes || []),
              ...c.estudios.seleccionados.map((e) => (typeof e === 'string' ? e : (e?.nombre || '')))
            ].filter(Boolean);
            const procs = c.procedimientos.seleccionados
              .map((p) => (typeof p === 'string' ? p : (p?.nombre || p?.procedimiento || p?.descripcion || '')))
              .filter(Boolean);

            const metaTexto = (() => {
              const parts = [];
              parts.push(limpiar(c.medicoNombre, 'Médico'));
              if (c.medicoPerfil?.cedula) parts.push(`Céd. Prof. ${c.medicoPerfil.cedula}`);
              if (c.medicoPerfil?.universidadEgreso) parts.push(`Univ. ${c.medicoPerfil.universidadEgreso}`);
              if (c.medicoPerfil?.especialidad) parts.push(c.medicoPerfil.especialidad);
              if (c.folioReceta) parts.push(`Folio: ${c.folioReceta}`);
              if (c.consultorioNombre) parts.push(`Consultorio: ${c.consultorioNombre}`);
              if (c.sucursalDireccion) parts.push(c.sucursalDireccion);
              return parts.join('  ·  ');
            })();

            return (
              <View key={c.id || idx}>
                <View style={styles.consultaBreak} />
                <View style={styles.consultaHead}>
                  <Text style={styles.consultaNum}>Nota {num} · {c.tipoNota}</Text>
                  <Text style={styles.consultaFecha}>{c.fechaFormato}{c.horaFormato ? ` · ${c.horaFormato} hrs` : ''}</Text>
                </View>
                <Text style={styles.consultaMetaLine}>{metaTexto}</Text>

                {c.padecimiento ? <><Text style={styles.subTitle}>Padecimiento actual</Text><Parrafo value={c.padecimiento} style={styles.p} /></> : null}

                {vit.length > 0 && <><Text style={styles.subTitle}>Signos vitales y somatometría</Text><Text style={styles.p}>{vit.map((s) => `${s.l}: ${s.v}${s.u ? ` ${s.u}` : ''}`).join('  |  ')}</Text></>}

                {hayFisica ? <><Text style={styles.subTitle}>Exploración física</Text>{Object.entries(c.fisica).map(([k, v]) => { const val = limpiar(v, ''); if (!String(val).trim()) return null; return <Text key={k} style={styles.p}><Text style={{ fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' }}>{k}: </Text>{val}</Text>; })}</> : null}

                <Text style={styles.subTitle}>Diagnóstico</Text>
                <Parrafo value={c.diagnostico} fallback="Sin diagnóstico registrado" style={styles.p} />
                {c.cie10.length ? <Text style={styles.p}><Text style={{ fontFamily: 'Helvetica-Bold' }}>CIE-10: </Text>{c.cie10.map((item) => [item?.codigo, item?.descripcion].filter(Boolean).join(' ')).join('; ')}</Text> : null}

                {c.tratamiento.length > 0 && <><Text style={styles.subTitle}>Plan terapéutico ({c.tratamiento.length} med.)</Text>
                  {c.tratamiento.map((m, i) => {
                    const metaMeds = [];
                    if (m?.presentacion) metaMeds.push(m.presentacion);
                    if (m?.sustanciasActivas) metaMeds.push(`Sust. activa: ${m.sustanciasActivas}`);
                    if (m?.grupo || m?.marca) metaMeds.push(`Grupo: ${m.grupo || m.marca}`);
                    if (m?.numeroAcomodo) metaMeds.push(`Acomodo #${m.numeroAcomodo}`);
                    const tieneDosis = m?.dosis && String(m.dosis).trim();
                    return (
                      <View key={i} style={styles.medBlock}>
                        <Text style={styles.medName}>{i + 1}. {limpiar(m?.nombre, 'Medicamento')}</Text>
                        {metaMeds.length > 0 && <Text style={styles.medMeta}>{metaMeds.join(' · ')}</Text>}
                        {tieneDosis && <View style={styles.medDosisView}><Parrafo value={m.dosis} style={styles.medDosisLine} /></View>}
                      </View>
                    );
                  })}
                </>}

                {c.indicaciones ? <><Text style={styles.subTitle}>Indicaciones generales</Text><Parrafo value={c.indicaciones} style={styles.p} /></> : null}
                {c.pronostico ? <><Text style={styles.subTitle}>Pronóstico</Text><Parrafo value={c.pronostico} style={styles.p} /></> : null}

                {estudios.length > 0 && <><Text style={styles.subTitle}>Estudios solicitados</Text><Text style={styles.p}>{estudios.join(' · ')}</Text></>}
                {procs.length > 0 && <><Text style={styles.subTitle}>Procedimientos</Text><Text style={styles.p}>{procs.join(' · ')}</Text></>}
              </View>
            );
          })
        )}

        {/* CIERRE */}
        <View style={styles.closing}>
          <View style={styles.closingRule} />
          <Text style={styles.legal}>El presente documento constituye una reproducción fiel del expediente clínico electrónico resguardado por {INSTITUCION}. Su contenido es confidencial y está protegido conforme a la NOM-004-SSA3-2012 y a la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados. Queda prohibida su reproducción o divulgación parcial o total sin autorización.</Text>
          <View style={styles.signRow}>
            <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signName}>{limpiar(generadoPor, 'Administración')}</Text><Text style={styles.signRole}>Responsable de la expedición</Text></View>
            <View style={styles.signBlock}><View style={styles.signLine} /><Text style={styles.signName}>Sello de la institución</Text><Text style={styles.signRole}>{INSTITUCION}</Text></View>
          </View>
        </View>

        {/* PIE DE PÁGINA */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text>{INSTITUCION} · Folio {folioFinal}</Text>
            <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </View>

      </Page>
    </Document>
  );
};

export default ExpedienteElectronicoPDF;
