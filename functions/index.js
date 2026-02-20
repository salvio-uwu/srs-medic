const { onCall } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Pega aquí TU API KEY (la que empieza con AIza...)
const API_KEY = "AIzaSyCW6JzQuMgVZDsT4p9EqwtZOYaUl47O4u8";

const genAI = new GoogleGenerativeAI(API_KEY);

// Usamos el modelo flash que es rápido
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
exports.analizarMedicamento = onCall(async (request) => {
  // 1. Extraer datos
  const { medicamento, historialAlergias } = request.data;

  // 2. Validación básica
  if (!medicamento) return { riesgo: false, mensaje: "Falta medicamento." };

  try {
    // 3. Preparar el texto de alergias
    // Si viene un array, lo convertimos a texto. Si es string, lo dejamos.
    let textoAlergias = "Ninguna conocida";
    
    if (Array.isArray(historialAlergias) && historialAlergias.length > 0) {
      textoAlergias = historialAlergias.join(", ");
    } else if (typeof historialAlergias === 'string' && historialAlergias.trim() !== "") {
      textoAlergias = historialAlergias;
    }

    console.log("Analizando:", { medicamento, textoAlergias });

    // 4. El Prompt para la IA
    const prompt = `
      Actúa como médico farmacólogo experto.
      
      PACIENTE ALÉRGICO A: "${textoAlergias}"
      MEDICAMENTO A RECETAR: "${medicamento}"
      
      TAREA:
      Determina si existe riesgo de reacción alérgica directa o cruzada (ej. Penicilina vs Ampicilina).
      
      RESPONDE ÚNICAMENTE ESTE JSON (sin markdown, sin comillas extra):
      { "riesgo": true/false, "mensaje": "Explicación breve de la alerta." }
    `;

    // 5. Llamar a la IA
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 6. Limpieza de JSON (A prueba de balas)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonInicio = text.indexOf('{');
    const jsonFin = text.lastIndexOf('}');
    if (jsonInicio !== -1 && jsonFin !== -1) {
        text = text.substring(jsonInicio, jsonFin + 1);
    }

    return JSON.parse(text);

  } catch (error) {
    console.error("Error en IA:", error);
    // Si falla, devolvemos un objeto seguro para que no truene el front
    return { 
      riesgo: true, 
      mensaje: "⚠️ Error de conexión con IA. Revisar manualmente." 
    };
  }
});