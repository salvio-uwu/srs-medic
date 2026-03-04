const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Mandamos llamar el secreto que acabas de guardar en la terminal
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ============================================================================
// FUNCIÓN 1: ANÁLISIS DE MEDICAMENTOS Y ALERGIAS (La que ya tenías, pero segura)
// ============================================================================
exports.analizarMedicamento = onCall(
  { secrets: [geminiApiKey] }, // Le damos permiso de usar la clave secreta
  async (request) => {
    
    // CAPA DE SEGURIDAD: Si no están logueados en tu app, los bloqueamos
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const { medicamento, historialAlergias } = request.data;
    if (!medicamento) return { riesgo: false, mensaje: "Falta medicamento." };

    try {
      // 2. Inicializamos la IA *adentro* de la función usando el secreto
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      let textoAlergias = "Ninguna conocida";
      if (Array.isArray(historialAlergias) && historialAlergias.length > 0) {
        textoAlergias = historialAlergias.join(", ");
      } else if (typeof historialAlergias === 'string' && historialAlergias.trim() !== "") {
        textoAlergias = historialAlergias;
      }

      console.log("Analizando:", { medicamento, textoAlergias });

      const prompt = `
        Actúa como médico farmacólogo experto.
        PACIENTE ALÉRGICO A: "${textoAlergias}"
        MEDICAMENTO A RECETAR: "${medicamento}"
        TAREA: Determina si existe riesgo de reacción alérgica directa o cruzada.
        RESPONDE ÚNICAMENTE ESTE JSON (sin markdown, sin comillas extra):
        { "riesgo": true/false, "mensaje": "Explicación breve de la alerta." }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Limpieza de JSON
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonInicio = text.indexOf('{');
      const jsonFin = text.lastIndexOf('}');
      if (jsonInicio !== -1 && jsonFin !== -1) {
          text = text.substring(jsonInicio, jsonFin + 1);
      }

      return JSON.parse(text);

    } catch (error) {
      console.error("Error en IA:", error);
      return { riesgo: true, mensaje: "⚠️ Error de conexión con IA. Revisar manualmente." };
    }
  }
);


exports.analizarBitacora = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 120 }, 
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const { base64Image, mimeType, tipoBitacora } = request.data;
    
    if (!base64Image || !tipoBitacora) {
      throw new HttpsError("invalid-argument", "Faltan datos de la imagen o el tipo de bitácora.");
    }

    let esquemaJSON = "";
    
    switch (tipoBitacora) {
      case "recepcion":
        esquemaJSON = `[{ "fecha": "", "factura": "", "compuesto": "", "presentacion": "", "forma_farmaceutica": "", "lote": "", "cantidad": "", "fecha_caducidad": "", "criterio_empaque": "", "criterio_etiqueta": "", "aprobado": "", "recibio": "", "observaciones": "" }]`;
        break;
      case "entradas_salidas":
        esquemaJSON = `[{ "fecha": "", "factura": "", "compuesto": "", "presentacion": "", "forma_farmaceutica": "", "lote": "", "cantidad": "", "fecha_caducidad": "", "tipo_movimiento": "", "realizo": "", "observaciones": "" }]`;
        break;
      case "temperaturas":
        esquemaJSON = `[{ "fecha": "", "8am_T_Ext": "", "8am_Hum": "", "8am_T_Ref": "", "4pm_T_Ext": "", "4pm_Hum": "", "4pm_T_Ref": "", "10pm_T_Ext": "", "10pm_Hum": "", "10pm_T_Ref": "" }]`;
        break;
      case "cloro_ph":
        esquemaJSON = `[{ "fecha": "", "lavamanos1_PH": "", "lavamanos1_Cloro": "", "lavamanos2_PH": "", "lavamanos2_Cloro": "", "realizo": "" }]`;
        break;
      case "limpieza_general":
        // Abarca consultorios, sanitarios, observación, rayos x, etc.
        esquemaJSON = `[{ "fecha": "", "limpieza_mobiliario_y_areas": "Completado/Pendiente", "piso_barrido_y_trapeado": "Completado/Pendiente", "recoleccion_de_basura": "Completado/Pendiente", "realizo": "" }]`;
        break;
      default:
        throw new HttpsError("invalid-argument", "Tipo de bitácora desconocido.");
    }

    // 2. PROMPT DINÁMICO
    const prompt = `
      Eres un auditor estricto de la COFEPRIS en México. Analiza la siguiente foto de una bitácora médica.
      Extrae los datos de la tabla y devuélvelos ESTRICTAMENTE como un arreglo JSON válido, usando este esquema para las claves:
      
      ${esquemaJSON}

      INSTRUCCIONES IMPORTANTES:
      - NO devuelvas texto en formato Markdown (sin \`\`\`json).
      - Si una celda está vacía, con rayones o es ilegible, coloca la palabra "Vacío".
      - Las firmas tradúcelas como el nombre de quien firma o "Firma Ilegible".
      - Procesa TODAS las filas legibles de la tabla.
    `;

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const imagePart = {
        inlineData: { data: base64Image, mimeType: mimeType || "image/jpeg" }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();

      return { result: text };

    } catch (error) {
      console.error("Error analizando imagen:", error);
      throw new HttpsError("internal", "Error al procesar la imagen de la bitácora.");
    }
  }
);

exports.askGemini = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "No autorizado.");
    }

    const { prompt } = request.data;
    if (!prompt) throw new HttpsError("invalid-argument", "Falta el prompt.");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent(prompt);
      return { result: result.response.text() };
      
    } catch (error) {
      console.error("Error en Gemini:", error);
      throw new HttpsError("internal", "Fallo al consultar a Gemini.");
    }
});