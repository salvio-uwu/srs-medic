/**
 * Script para probar qué modelos de Gemini responden correctamente.
 * Ejecutar con: node scripts/test-gemini.cjs
 * 
 * NOTA: necesita el secreto GEMINI_API_KEY seteado en el entorno.
 * Ejemplo: GEMINI_API_KEY="tu-key" node scripts/test-gemini.cjs
 */

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.log("❌ No se encontró GEMINI_API_KEY en el entorno.");
  console.log("   Exportala: export GEMINI_API_KEY='tu-key' y vuelve a ejecutar.");
  process.exit(1);
}

const MODELS_TO_TEST = [
  { name: "gemini-2.0-flash", description: "Flash 2.0 (el que usa la función)" },
  { name: "gemini-2.0-flash-lite", description: "Flash Lite 2.0" },
  { name: "gemini-2.5-pro", description: "Pro 2.5" },
  { name: "gemini-2.5-flash", description: "Flash 2.5" },
  { name: "gemini-1.5-flash", description: "Flash 1.5 (legacy, más compatible)" },
  { name: "gemini-1.5-pro", description: "Pro 1.5 (legacy)" },
  { name: "gemini-1.0-pro", description: "Pro 1.0 (muy legacy)" },
  { name: "gemini-pro", description: "Gemini Pro (original)" },
];

const prompt = "Di 'hola' en una sola palabra.";

async function testModel(genAI, modelName, desc) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    // Safety: bloque mínimo (solo lo alto) para no interferir
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ],
  });

  try {
    const result = await model.generateContent(prompt);
    const text = (result.response?.text?.() || "").trim();
    if (text) {
      console.log(`✅ ${modelName} (${desc}): "${text.slice(0, 40)}"`);
      return true;
    }
    console.log(`⚠️  ${modelName}: respondió pero vacío.`);
    return false;
  } catch (e) {
    const msg = String(e.message || e).slice(0, 120);
    const code = e.status || e.code || "¿?";
    console.log(`❌ ${modelName} (${desc}): [${code}] ${msg}`);
    return false;
  }
}

async function main() {
  console.log("🔍 Probando modelos Gemini con la API key...\n");

  const genAI = new GoogleGenerativeAI(apiKey);

  let firstWorking = null;

  for (const m of MODELS_TO_TEST) {
    const ok = await testModel(genAI, m.name, m.description);
    if (ok && !firstWorking) firstWorking = m.name;
  }

  console.log("\n──────────────────────────────────────────");
  if (firstWorking) {
    console.log(`✅ Primer modelo funcional: ${firstWorking}`);
    console.log(`   Úsalo en functions/index.js → model: "${firstWorking}"`);
  } else {
    console.log("❌ Ningún modelo funcionó.");
    console.log("   Verifica: API key válida, cuota disponible, facturación activa.");
    console.log("   URL: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com");
  }
}

main().catch(console.error);
