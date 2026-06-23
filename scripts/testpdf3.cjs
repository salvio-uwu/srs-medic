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

// scripts/testpdf3.jsx
var import_react = __toESM(require("react"), 1);
var import_renderer = require("@react-pdf/renderer");
var s = import_renderer.StyleSheet.create({
  page: { paddingTop: 96, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: "Helvetica" },
  header: { position: "absolute", top: 28, left: 48, right: 48 },
  footer: { position: "absolute", bottom: 26, left: 48, right: 48 },
  secTitle: { backgroundColor: "#e5e7eb", borderWidth: 0.8, borderColor: "#000", padding: 3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  secBox: { borderWidth: 0.8, borderTopWidth: 0, borderColor: "#000", padding: 6, marginBottom: 11 },
  line: { flexDirection: "row", marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#999", paddingBottom: 1.5 },
  card: { marginBottom: 10, backgroundColor: "#fafafa" },
  head: { backgroundColor: "#eee", padding: 4, flexDirection: "row", justifyContent: "space-between" },
  body: { padding: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  cell: { width: "25%", padding: 2 },
  box: { backgroundColor: "#f1f1f1", padding: 3 }
});
var section = (i) => import_react.default.createElement(
  import_renderer.View,
  { key: "s" + i, wrap: false },
  import_react.default.createElement(import_renderer.Text, { style: s.secTitle }, "SECCION " + i),
  import_react.default.createElement(
    import_renderer.View,
    { style: s.secBox },
    ...Array.from(
      { length: 6 },
      (_, k) => import_react.default.createElement(
        import_renderer.View,
        { key: k, style: s.line },
        import_react.default.createElement(import_renderer.Text, null, "Etiqueta " + k + ": valor de prueba")
      )
    )
  )
);
var card = (i) => import_react.default.createElement(
  import_renderer.View,
  { key: i, style: s.card, wrap: false },
  import_react.default.createElement(
    import_renderer.View,
    { style: s.head },
    import_react.default.createElement(import_renderer.Text, null, "Nota " + i),
    import_react.default.createElement(import_renderer.Text, null, "08 jun 2026")
  ),
  import_react.default.createElement(
    import_renderer.View,
    { style: s.body },
    import_react.default.createElement(import_renderer.Text, { style: { fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 } }, "Padecimiento actual"),
    import_react.default.createElement(import_renderer.Text, { style: { textAlign: "justify", marginBottom: 2 } }, "Padecimiento de prueba con texto suficiente para ocupar algo de espacio en la nota clinica y forzar el justificado del parrafo en varias lineas seguidas."),
    import_react.default.createElement(
      import_renderer.View,
      { style: s.grid },
      ...Array.from({ length: 8 }, (_, k) => import_react.default.createElement(
        import_renderer.View,
        { key: k, style: s.cell },
        import_react.default.createElement(
          import_renderer.View,
          { style: s.box },
          import_react.default.createElement(import_renderer.Text, null, "L" + k),
          import_react.default.createElement(import_renderer.Text, null, "123")
        )
      ))
    )
  )
);
var run = async () => {
  for (const n of [3, 10, 20]) {
    try {
      const doc = import_react.default.createElement(
        import_renderer.Document,
        null,
        import_react.default.createElement(
          import_renderer.Page,
          { size: "LETTER", style: s.page },
          import_react.default.createElement(import_renderer.View, { style: s.header, fixed: true }, import_react.default.createElement(import_renderer.Text, null, "ENCABEZADO")),
          import_react.default.createElement(import_renderer.View, { style: s.footer, fixed: true }, import_react.default.createElement(import_renderer.Text, null, "PIE")),
          ...Array.from({ length: 5 }, (_, i) => section(i)),
          ...Array.from({ length: n }, (_, i) => card(i))
        )
      );
      const buf = await (0, import_renderer.renderToBuffer)(doc);
      console.log("n=" + n, "OK", buf.length);
    } catch (e) {
      console.log("n=" + n, "FAIL:", e.message);
    }
  }
};
run();
