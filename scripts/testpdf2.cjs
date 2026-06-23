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

// scripts/testpdf2.jsx
var import_react = __toESM(require("react"), 1);
var import_renderer = require("@react-pdf/renderer");
var s = import_renderer.StyleSheet.create({
  page: { paddingTop: 90, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: "Helvetica" },
  header: { position: "absolute", top: 28, left: 48, right: 48 },
  footerBottom: { position: "absolute", bottom: 26, left: 48, right: 48 },
  footerTop: { position: "absolute", top: 760, left: 48, right: 48 },
  line: { marginBottom: 6 }
});
var make = (footerStyle) => import_react.default.createElement(
  import_renderer.Document,
  null,
  import_react.default.createElement(
    import_renderer.Page,
    { size: "LETTER", style: s.page },
    import_react.default.createElement(import_renderer.View, { style: s.header, fixed: true }, import_react.default.createElement(import_renderer.Text, null, "ENCABEZADO FIJO")),
    import_react.default.createElement(import_renderer.View, { style: footerStyle, fixed: true }, import_react.default.createElement(import_renderer.Text, null, "PIE FIJO")),
    ...Array.from({ length: 120 }, (_, i) => import_react.default.createElement(import_renderer.Text, { key: i, style: s.line }, "Linea de contenido numero " + i))
  )
);
var run = async () => {
  for (const [name, st] of [["bottom", s.footerBottom], ["top", s.footerTop]]) {
    try {
      const buf = await (0, import_renderer.renderToBuffer)(make(st));
      console.log(name, "OK bytes:", buf.length);
    } catch (e) {
      console.log(name, "FAIL:", e.message);
    }
  }
};
run();
