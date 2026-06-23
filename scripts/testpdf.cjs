var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/testpdf.jsx
var import_react2 = __toESM(require("react"), 1);
var import_renderer2 = require("@react-pdf/renderer");

// src/components/pdf/ExpedienteElectronicoPDF.jsx
var import_react = __toESM(require("react"), 1);
var import_renderer = require("@react-pdf/renderer");

// src/utils/expedienteElectronico.js
var ETIQUETAS_FAMILIA = {
  mama: "Mam\xE1",
  papa: "Pap\xE1",
  hermanos: "Hermanos",
  tios: "T\xEDos",
  primos: "Primos",
  abuelos: "Abuelos"
};
var ETIQUETAS_HEREDO = {
  diabetes: "Diabetes",
  hipertension: "Hipertensi\xF3n",
  cardiopatia: "Cardiopat\xEDa",
  hepatopatia: "Hepatopat\xEDa",
  nefropatia: "Nefropat\xEDa",
  mentales: "Enf. mentales",
  alergicas: "Al\xE9rgicas",
  endocrinas: "Endocrinas",
  asma: "Asma",
  cancer: "C\xE1ncer",
  obesidad: "Obesidad"
};
var limpiar = (v, fallback = "") => {
  const s = String(v ?? "").trim();
  return s || fallback;
};
var calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return "";
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime())) return "";
  const hoy = /* @__PURE__ */ new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  if (mesDiff < 0 || mesDiff === 0 && hoy.getDate() < fecha.getDate()) edad -= 1;
  return edad >= 0 ? String(edad) : "";
};
var formatHeredofamiliares = (hereditarios = {}) => {
  const resultado = [];
  Object.entries(ETIQUETAS_HEREDO).forEach(([key, label]) => {
    const grupo = hereditarios[key];
    if (grupo && typeof grupo === "object") {
      const familiares = Object.keys(ETIQUETAS_FAMILIA).filter((m) => grupo[m]).map((m) => ETIQUETAS_FAMILIA[m]);
      if (familiares.length) resultado.push({ label, valor: familiares.join(", ") });
    }
  });
  if (hereditarios.otros && String(hereditarios.otros).trim()) {
    resultado.push({ label: "Otros", valor: String(hereditarios.otros).trim() });
  }
  return resultado;
};
var formatAdicciones = (adicciones = {}) => {
  const partes = [];
  if (adicciones.tabaquismo) partes.push("Tabaquismo");
  if (adicciones.alcohol) partes.push("Alcoholismo");
  if (adicciones.drogas) partes.push("Drogas");
  let texto = partes.join(", ");
  if (adicciones.detalle && String(adicciones.detalle).trim()) {
    texto = texto ? `${texto} (${String(adicciones.detalle).trim()})` : String(adicciones.detalle).trim();
  }
  return texto;
};
var formatAlergias = (alergias = {}) => {
  if (alergias.preguntados_y_negados) return "Preguntadas y negadas";
  const lista = Array.isArray(alergias.lista) ? alergias.lista.map((a) => typeof a === "string" ? a : a?.sustancia || a?.nombre || "").filter(Boolean) : [];
  const otros = String(alergias.otros || alergias.otras || "").trim();
  const todo = [...lista, otros].filter(Boolean);
  return todo.length ? todo.join(", ") : "Sin alergias registradas";
};
var nombrePaciente = (paciente = {}) => {
  const completo = String(paciente.nombreCompleto || "").trim();
  if (completo) return completo;
  return [paciente.nombre, paciente.apellidoPaterno, paciente.apellidoMaterno].filter(Boolean).join(" ").trim() || "Paciente";
};
var direccionPaciente = (paciente = {}) => {
  return [paciente.calleNumero, paciente.colonia, paciente.cp, paciente.municipioEstado, paciente.pais].map((p) => String(p || "").trim()).filter(Boolean).join(", ");
};

// src/components/pdf/ExpedienteElectronicoPDF.jsx
var INSTITUCION = "CENTRO M\xC9DICO SANTA CRUZ";
var C_INK = "#111827";
var C_MUTED = "#374151";
var C_LINE = "#000000";
var C_SOFT = "#9ca3af";
var styles = import_renderer.StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: C_INK,
    lineHeight: 1.35
  },
  /* ENCABEZADO (fijo en cada página) */
  header: { position: "absolute", top: 28, left: 48, right: 48, lineHeight: 1.2 },
  institucion: { textAlign: "center", fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  subInstitucion: { textAlign: "center", fontSize: 8.5, color: C_MUTED, marginTop: 2, letterSpacing: 0.5 },
  docTitle: { textAlign: "center", fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 6, textTransform: "uppercase", letterSpacing: 1.2 },
  headerRuleThick: { height: 1.4, backgroundColor: C_LINE, marginTop: 6 },
  headerRuleThin: { height: 0.5, backgroundColor: C_LINE, marginTop: 1.5 },
  /* BARRA DE FOLIO / METADATOS */
  metaBar: { flexDirection: "row", borderWidth: 0.8, borderColor: C_LINE, marginBottom: 12 },
  metaCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 7, borderRightWidth: 0.8, borderRightColor: C_LINE },
  metaCellLast: { flex: 1, paddingVertical: 4, paddingHorizontal: 7 },
  metaLabel: { fontSize: 6.8, color: C_MUTED, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Helvetica-Bold" },
  metaValue: { fontSize: 9, color: C_INK, marginTop: 1 },
  /* SECCIONES */
  sectionTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    backgroundColor: "#e5e7eb",
    borderWidth: 0.8,
    borderColor: C_LINE,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 4
  },
  sectionBox: { borderWidth: 0.8, borderTopWidth: 0, borderColor: C_LINE, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 11 },
  // Contenedor sin borde para secciones largas que deben fluir entre páginas
  // (un borde que se parte entre páginas hace fallar a @react-pdf en clipBorderTop).
  sectionBoxOpen: { paddingTop: 5, marginBottom: 11 },
  /* FICHA: cuadrícula tipo formulario */
  grid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", marginBottom: 3.5, paddingRight: 10, borderBottomWidth: 0.5, borderBottomColor: C_SOFT, paddingBottom: 1.5 },
  fieldThird: { width: "33.33%", marginBottom: 3.5, paddingRight: 10, borderBottomWidth: 0.5, borderBottomColor: C_SOFT, paddingBottom: 1.5 },
  fieldFull: { width: "100%", marginBottom: 3.5, borderBottomWidth: 0.5, borderBottomColor: C_SOFT, paddingBottom: 1.5 },
  fLabel: { fontFamily: "Helvetica-Bold", color: C_MUTED },
  /* RENGLONES DE ANTECEDENTES */
  line: { flexDirection: "row", marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: C_SOFT, paddingBottom: 1.5 },
  lineLabel: { width: 120, fontFamily: "Helvetica-Bold", color: C_MUTED },
  lineValue: { flex: 1, color: C_INK },
  /* CONSULTAS — sin bordes de elemento (se usan líneas rellenas para evitar
     el fallo de @react-pdf al reubicar nodos con borde entre páginas) */
  consulta: { marginBottom: 10, backgroundColor: "#fbfbfc" },
  consultaTopRule: { height: 1.2, backgroundColor: C_LINE },
  consultaHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#eceef1",
    paddingVertical: 3,
    paddingHorizontal: 7
  },
  consultaHeadRule: { height: 0.6, backgroundColor: C_LINE },
  consultaNo: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  consultaFecha: { fontSize: 9 },
  consultaBody: { paddingVertical: 5, paddingHorizontal: 8 },
  subTitle: { fontFamily: "Helvetica-Bold", fontSize: 8.4, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4, marginBottom: 1, color: C_MUTED },
  rule: { height: 0.6, backgroundColor: C_SOFT, marginBottom: 2.5 },
  p: { marginBottom: 1.5, textAlign: "justify" },
  bold: { fontFamily: "Helvetica-Bold" },
  vitalsTable: { flexDirection: "row", flexWrap: "wrap", marginTop: 1 },
  vitalCell: { width: "25%", paddingVertical: 1.5, paddingHorizontal: 1.5 },
  vitalBox: { backgroundColor: "#f1f3f5", paddingVertical: 3, paddingHorizontal: 4 },
  vitalLabel: { fontSize: 6.6, color: C_MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  vitalValue: { fontSize: 9, marginTop: 0.5 },
  med: { marginLeft: 8, marginBottom: 1.5 },
  inlineList: { color: C_INK },
  empty: { fontFamily: "Helvetica-Oblique", color: C_MUTED },
  /* CIERRE / FIRMA */
  closing: { marginTop: 6 },
  legal: { fontSize: 7.5, color: C_MUTED, textAlign: "justify", fontFamily: "Helvetica-Oblique", marginBottom: 22 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  signBlock: { width: "45%", alignItems: "center" },
  signLine: { height: 0.8, backgroundColor: C_LINE, width: "100%", marginBottom: 3 },
  signName: { fontFamily: "Helvetica-Bold", fontSize: 8.6, textAlign: "center", textTransform: "uppercase" },
  signRole: { fontSize: 7.6, color: C_MUTED, textAlign: "center" },
  /* PIE DE PÁGINA (fijo) */
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    lineHeight: 1.2
  },
  footerRule: { height: 0.8, backgroundColor: C_LINE, marginBottom: 4 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C_MUTED }
});
var Field = ({ label, value, size = "half" }) => {
  const wrap = size === "third" ? styles.fieldThird : size === "full" ? styles.fieldFull : styles.field;
  return /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: wrap }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.fLabel }, label, ": "), limpiar(value, "\u2014")));
};
var Linea = ({ label, value }) => /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.line }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.lineLabel }, label, ":"), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.lineValue }, limpiar(value, "No referido")));
var Section = ({ title, children }) => /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { wrap: false }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.sectionTitle }, title), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.sectionBox }, children));
var ExpedienteElectronicoPDF = ({
  paciente = {},
  antecedentes = {},
  consultas = [],
  generadoPor = "",
  folio = ""
}) => {
  const heredo = formatHeredofamiliares(antecedentes.hereditarios || {});
  const noPat = antecedentes.no_patologicos || {};
  const pat = antecedentes.patologicos || {};
  const adicciones = formatAdicciones(pat.adicciones || {});
  const esp = pat.especificos || {};
  const especificosTexto = Object.entries(esp).filter(([k, v]) => k !== "otro" && String(v || "").trim()).map(([k, v]) => `${k}: ${v}`).join(" \xB7 ");
  const edad = calcularEdad(paciente.fechaNacimiento);
  const fechaEmision = (/* @__PURE__ */ new Date()).toLocaleString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const folioFinal = limpiar(folio || paciente.idPaciente || paciente.id, "\u2014");
  return /* @__PURE__ */ import_react.default.createElement(import_renderer.Document, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Page, { size: "LETTER", style: styles.page }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.header, fixed: true }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.institucion }, INSTITUCION), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.docTitle }, "Expediente Cl\xEDnico Electr\xF3nico"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.headerRuleThick }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.headerRuleThin })), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.metaBar }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.metaCell }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaLabel }, "Folio / Expediente"), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaValue }, folioFinal)), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.metaCell }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaLabel }, "Fecha y hora de emisi\xF3n"), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaValue }, fechaEmision)), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.metaCellLast }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaLabel }, "Expedido por"), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.metaValue }, limpiar(generadoPor, "Administraci\xF3n")))), /* @__PURE__ */ import_react.default.createElement(Section, { title: "I. Ficha de Identificaci\xF3n del Paciente" }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.grid }, /* @__PURE__ */ import_react.default.createElement(Field, { label: "Nombre completo", value: nombrePaciente(paciente), size: "full" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Sexo", value: paciente.sexo, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Edad", value: edad ? `${edad} a\xF1os` : "", size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Fecha de nacimiento", value: paciente.fechaNacimiento ? new Date(paciente.fechaNacimiento).toLocaleDateString("es-MX") : "", size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "CURP", value: paciente.curp, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Grupo sangu\xEDneo", value: paciente.grupoSanguineo, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Estado civil", value: paciente.estadoCivil, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Tel\xE9fono m\xF3vil", value: paciente.telefonoMovil, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Tel\xE9fono fijo", value: paciente.telefonoFijo, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Correo electr\xF3nico", value: paciente.email, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Ocupaci\xF3n", value: paciente.ocupacion, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Escolaridad", value: paciente.escolaridad, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Lengua", value: paciente.lengua, size: "third" }), /* @__PURE__ */ import_react.default.createElement(Field, { label: "Domicilio", value: direccionPaciente(paciente), size: "full" }))), /* @__PURE__ */ import_react.default.createElement(Section, { title: "II. Antecedentes Heredofamiliares" }, heredo.length ? heredo.map((h) => /* @__PURE__ */ import_react.default.createElement(Linea, { key: h.label, label: h.label, value: h.valor })) : /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.empty }, "Interrogados y negados.")), /* @__PURE__ */ import_react.default.createElement(Section, { title: "III. Antecedentes Personales No Patol\xF3gicos" }, /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Alimentaci\xF3n", value: noPat.alimentacion }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Higiene / ba\xF1o", value: noPat.bano }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Lavado dental", value: noPat.lavado_dientes }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Habitaci\xF3n", value: noPat.habitacion }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Sedentarismo", value: noPat.sedentarismo }), String(noPat.otros || "").trim() ? /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Otros", value: noPat.otros }) : null), /* @__PURE__ */ import_react.default.createElement(Section, { title: "IV. Antecedentes Personales Patol\xF3gicos" }, /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Padecimientos", value: pat.actuales }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Quir\xFArgicos", value: pat.quirurgicos }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Hospitalizaciones", value: pat.hospitalizaciones }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Transfusionales", value: pat.transfusionales }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Traum\xE1ticos", value: pat.traumaticos }), /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Adicciones", value: adicciones || "Negadas" }), especificosTexto ? /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Espec\xEDficos", value: especificosTexto }) : null, String(esp.otro || "").trim() ? /* @__PURE__ */ import_react.default.createElement(Linea, { label: "Otros", value: esp.otro }) : null), /* @__PURE__ */ import_react.default.createElement(Section, { title: "V. Alergias" }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, formatAlergias(antecedentes.alergias || {}))), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.sectionTitle }, "VI. Notas de Evoluci\xF3n y Consultas (", consultas.length, ")"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: { height: 5 } }), consultas.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.empty }, "El paciente no cuenta con consultas registradas en el sistema.") : consultas.map((c, idx) => {
    const vitales = [
      { l: "Peso", v: c.antropometria.peso, u: "kg" },
      { l: "Talla", v: c.antropometria.talla, u: "m" },
      { l: "IMC", v: c.antropometria.imc, u: "" },
      { l: "Temp.", v: c.signos.temp, u: "\xB0C" },
      { l: "T/A", v: c.signos.ta, u: "" },
      { l: "F.C.", v: c.signos.fc, u: "lpm" },
      { l: "F.R.", v: c.signos.fr, u: "rpm" },
      { l: "SpO2", v: c.signos.spo2, u: "%" }
    ];
    const hayFisica = Object.values(c.fisica).some((v) => String(v || "").trim());
    const estudios = [
      ...c.estudios.paquetes || [],
      ...c.estudios.seleccionados.map((e) => typeof e === "string" ? e : e?.nombre || "")
    ].filter(Boolean);
    const procs = c.procedimientos.seleccionados.map((p) => typeof p === "string" ? p : p?.nombre || p?.procedimiento || p?.descripcion || "").filter(Boolean);
    return /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { key: c.id || idx, style: styles.consulta }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.consultaTopRule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.consultaHead }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.consultaNo }, "Nota No. ", consultas.length - idx, " \xB7 ", c.tipoNota), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.consultaFecha }, c.fechaFormato, c.horaFormato ? ` \xB7 ${c.horaFormato} hrs` : "")), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.consultaHeadRule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.consultaBody }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.bold }, "M\xE9dico tratante: "), limpiar(c.medicoNombre, "No especificado")), c.padecimiento ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Padecimiento actual"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, c.padecimiento)) : null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Signos vitales y somatometr\xEDa"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.vitalsTable }, vitales.map((s) => /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { key: s.l, style: styles.vitalCell }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.vitalBox }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.vitalLabel }, s.l), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.vitalValue }, limpiar(s.v, "\u2014"), s.v && s.u ? ` ${s.u}` : ""))))), hayFisica ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Exploraci\xF3n f\xEDsica"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), Object.entries(c.fisica).map(([k, v]) => String(v || "").trim() ? /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { key: k, style: styles.p }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: [styles.bold, { textTransform: "capitalize" }] }, k, ": "), v) : null)) : null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Diagn\xF3stico"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, limpiar(c.diagnostico, "Sin diagn\xF3stico registrado")), c.cie10.length ? /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.bold }, "CIE-10: "), c.cie10.map((item) => [item?.codigo, item?.descripcion].filter(Boolean).join(" ")).join("; ")) : null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Plan terap\xE9utico"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), c.tratamiento.length ? c.tratamiento.map((m, i) => /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { key: i, style: styles.med }, i + 1, ". ", /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.bold }, limpiar(m?.nombre, "Medicamento")), m?.presentacion ? ` (${m.presentacion})` : "", m?.dosis ? ` \u2014 ${m.dosis}` : "")) : /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, "Sin medicamentos prescritos."), c.indicaciones ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Indicaciones"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, c.indicaciones)) : null, c.pronostico ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Pron\xF3stico"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.p }, c.pronostico)) : null, estudios.length ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Estudios solicitados"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.inlineList }, estudios.join(" \xB7 "))) : null, procs.length ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.subTitle }, "Procedimientos"), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.rule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.inlineList }, procs.join(" \xB7 "))) : null));
  }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.closing, wrap: false }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.legal }, "El presente documento constituye una reproducci\xF3n fiel del expediente cl\xEDnico electr\xF3nico resguardado por ", INSTITUCION, ". Su contenido es confidencial y est\xE1 protegido conforme a la NOM-004-SSA3-2012 y a la Ley General de Protecci\xF3n de Datos Personales en Posesi\xF3n de Sujetos Obligados. Queda prohibida su reproducci\xF3n o divulgaci\xF3n parcial o total sin autorizaci\xF3n."), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.signRow }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.signBlock }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.signLine }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.signName }, limpiar(generadoPor, "Administraci\xF3n")), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.signRole }, "Responsable de la expedici\xF3n")), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.signBlock }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.signLine }), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.signName }, "Sello de la instituci\xF3n"), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { style: styles.signRole }, INSTITUCION)))), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.footer, fixed: true }, /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.footerRule }), /* @__PURE__ */ import_react.default.createElement(import_renderer.View, { style: styles.footerRow }, /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, null, INSTITUCION, " \xB7 Folio ", folioFinal), /* @__PURE__ */ import_react.default.createElement(import_renderer.Text, { render: ({ pageNumber, totalPages }) => `P\xE1gina ${pageNumber} de ${totalPages}` })))));
};
var ExpedienteElectronicoPDF_default = ExpedienteElectronicoPDF;

// scripts/testpdf.jsx
var run = async () => {
  const consulta = {
    id: "c1",
    fechaFormato: "08 de junio de 2026",
    horaFormato: "14:00",
    tipoNota: "Consulta general",
    medicoNombre: "Dr. House",
    padecimiento: "Dolor abdominal de 3 dias de evolucion, intermitente.",
    signos: { ta: "120/80", temp: "36.5", fc: "72", fr: "16", spo2: "98" },
    antropometria: { peso: "70", talla: "1.70", imc: "24.2" },
    colesterol: {},
    fisica: { habitus: "Integro", abdomen: "Blando, depresible, doloroso en epigastrio" },
    diagnostico: "Gastritis aguda",
    cie10: [{ codigo: "K29.7", descripcion: "Gastritis no especificada" }],
    tratamiento: [{ nombre: "Omeprazol", presentacion: "Capsula 20mg", dosis: "1 cada 24h por 14 dias" }],
    indicaciones: "Dieta blanda, evitar irritantes.",
    pronostico: "Bueno para la vida y la funcion.",
    estudios: { paquetes: ["Quimica sanguinea"], seleccionados: ["Biometria hematica", { nombre: "USG abdominal" }], notas: "" },
    procedimientos: { seleccionados: [{ nombre: "Toma de signos" }], notas: "" },
    pxInfo: {}
  };
  const antecedentes = {
    hereditarios: { diabetes: { mama: true, papa: false }, hipertension: { abuelos: true }, otros: "Ninguno" },
    no_patologicos: { alimentacion: "Regular", bano: "Diario", sedentarismo: "Si" },
    patologicos: { actuales: "Gastritis", quirurgicos: "Apendicectomia", adicciones: { tabaquismo: true, detalle: "5 al dia" }, especificos: { reflujo: "Si", otro: "" } },
    alergias: { lista: [{ sustancia: "Penicilina" }], otros: "" }
  };
  const keep = process.env.KEEP || "all";
  if (keep !== "all") {
    consulta.fisica = {};
    consulta.cie10 = [];
    consulta.estudios = { paquetes: [], seleccionados: [], notas: "" };
    consulta.procedimientos = { seleccionados: [], notas: "" };
    consulta.indicaciones = "";
    consulta.pronostico = "";
    consulta.tratamiento = [];
    if (keep === "fisica") consulta.fisica = { habitus: "Integro", abdomen: "Blando" };
    if (keep === "cie") consulta.cie10 = [{ codigo: "K29.7", descripcion: "Gastritis" }];
    if (keep === "trat") consulta.tratamiento = [{ nombre: "Omeprazol", presentacion: "Cap 20mg", dosis: "1 c/24h" }];
    if (keep === "est") consulta.estudios = { paquetes: ["Quimica"], seleccionados: ["BH", { nombre: "USG" }], notas: "" };
    if (keep === "proc") consulta.procedimientos = { seleccionados: [{ nombre: "Toma signos" }], notas: "" };
    if (keep === "ind") consulta.indicaciones = "Dieta blanda.";
    if (keep === "pron") consulta.pronostico = "Bueno.";
  }
  const doc = import_react2.default.createElement(ExpedienteElectronicoPDF_default, {
    paciente: { nombre: "PACIENTE PRUEBA SAVANT", sexo: "Masculino", fechaNacimiento: "1990-01-01", curp: "XAXX010101HNEXXXA4", grupoSanguineo: "O+", telefonoMovil: "8112345678", email: "a@b.com", calleNumero: "Calle 1", colonia: "Centro", cp: "64000", municipioEstado: "Monterrey, NL" },
    antecedentes,
    consultas: Array.from({ length: 20 }, (_, i) => ({ ...consulta, id: "c" + i })),
    generadoPor: "Admin Test",
    folio: "ABC123"
  });
  try {
    const buf = await (0, import_renderer2.renderToBuffer)(doc);
    console.log("OK bytes:", buf.length);
  } catch (e) {
    console.error("FAIL:", e && e.stack ? e.stack : e);
  }
};
run();
