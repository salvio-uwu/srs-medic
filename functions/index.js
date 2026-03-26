const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const firestoreDb = getFirestore();

// 1. Mandamos llamar el secreto que acabas de guardar en la terminal
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Secretos para WhatsApp Business Cloud API
const whatsappToken = defineSecret("WHATSAPP_TOKEN");
const whatsappPhoneId = defineSecret("WHATSAPP_PHONE_ID");
const whatsappWebhookVerifyToken = defineSecret("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

// Secretos para crear sesiones reales de Google Meet vía Calendar API
const googleCalendarClientEmail = defineSecret("GOOGLE_CALENDAR_CLIENT_EMAIL");
const googleCalendarPrivateKey = defineSecret("GOOGLE_CALENDAR_PRIVATE_KEY");
const googleCalendarId = defineSecret("GOOGLE_CALENDAR_ID");

const FUENTES_MEDICAS_OFICIALES = {
  OMS: { nombre: "Organización Mundial de la Salud", url: "https://www.who.int" },
  OPS: { nombre: "Organización Panamericana de la Salud", url: "https://www.paho.org" },
  CDC: { nombre: "CDC", url: "https://www.cdc.gov" },
  NIH: { nombre: "NIH", url: "https://www.nih.gov" },
  GOB_SALUD: { nombre: "Secretaría de Salud México", url: "https://www.gob.mx/salud" },
  COFEPRIS: { nombre: "COFEPRIS", url: "https://www.gob.mx/cofepris" },
  NEJM: { nombre: "New England Journal of Medicine", url: "https://www.nejm.org" },
  LANCET: { nombre: "The Lancet", url: "https://www.thelancet.com" },
  JAMA: { nombre: "JAMA Network", url: "https://jamanetwork.com" },
  BMJ: { nombre: "BMJ", url: "https://www.bmj.com" }
};

const BOLETIN_FALLBACK = [
  {
    titulo: "Refuerzo de vigilancia para infecciones respiratorias estacionales",
    resumen: "Se recomienda priorizar detección temprana de signos de alarma y cobertura vacunal en población vulnerable.",
    categoria: "Salud pública",
    impacto: "alto",
    sourceKey: "OPS"
  },
  {
    titulo: "Actualización en control integral de diabetes tipo 2",
    resumen: "Nuevos enfoques enfatizan ajuste individualizado y monitoreo continuo de riesgo cardiovascular.",
    categoria: "Endocrinología",
    impacto: "alto",
    sourceKey: "OMS"
  },
  {
    titulo: "Uso prudente de antibióticos en primer nivel",
    resumen: "Se mantiene la recomendación de prescripción basada en evidencia para reducir resistencia antimicrobiana.",
    categoria: "Infectología",
    impacto: "medio",
    sourceKey: "CDC"
  }
];

// ============================================================================
// FUNCIÓN 1: ANÁLISIS DE MEDICAMENTOS Y ALERGIAS (La que ya tenías, pero segura)
// ============================================================================
exports.analizarMedicamento = onCall(
  { secrets: [geminiApiKey], invoker: "public", cors: true }, // Le damos permiso de usar la clave secreta
  async (request) => {
    
    // CAPA DE SEGURIDAD: Si no están logueados en tu app, los bloqueamos
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
    }

    const { medicamento, historialAlergias, medicamentosActuales } = request.data;
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

      const contextoMedicamentosActuales =
        typeof medicamentosActuales === "string" && medicamentosActuales.trim() !== ""
          ? medicamentosActuales
          : "Ninguno";

      console.log("Analizando:", { medicamento, textoAlergias });

      const prompt = `
        Actúa como médico farmacólogo experto.
        PACIENTE ALÉRGICO A: "${textoAlergias}"
        MEDICAMENTOS ACTUALES: "${contextoMedicamentosActuales}"
        MEDICAMENTO A RECETAR: "${medicamento}"
        TAREA: Determina si existe riesgo clínicamente relevante de reacción alérgica directa/cruzada o interacción farmacológica grave.
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
  { secrets: [geminiApiKey], timeoutSeconds: 120, invoker: "public", cors: true }, 
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

exports.generarBoletinMedicoSeguro = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 90, invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para consultar el boletín.");
    }

    const limiteSolicitado = Number.parseInt(request.data?.limite, 10);
    const limite = Number.isFinite(limiteSolicitado)
      ? Math.min(Math.max(limiteSolicitado, 3), 8)
      : 5;

    const fuentesPermitidas = Object.keys(FUENTES_MEDICAS_OFICIALES);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `
        Eres un editor clínico para médicos generales en México.
        Genera ${limite} notas breves de actualización médica no sensacionalistas.

        REGLAS OBLIGATORIAS:
        1) Responde SOLO un arreglo JSON válido.
        2) No agregues markdown ni texto adicional.
        3) Cada nota debe incluir: titulo, resumen, categoria, impacto, sourceKey.
        4) sourceKey debe ser UNO de estos valores exactos:
           ${fuentesPermitidas.join(", ")}
        5) No inventes URLs ni fuentes fuera de esa lista.
        6) No des instrucciones de tratamiento individual ni dosis.

        Formato:
        [
          {
            "titulo": "",
            "resumen": "",
            "categoria": "",
            "impacto": "alto|medio|bajo",
            "sourceKey": "OMS"
          }
        ]
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        text = text.substring(start, end + 1);
      }

      let parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Formato inválido");

      parsed = parsed
        .slice(0, limite)
        .map((item, index) => {
          const sourceKey = typeof item.sourceKey === "string" ? item.sourceKey.trim() : "";
          const fuenteInfo = FUENTES_MEDICAS_OFICIALES[sourceKey] || null;
          if (!fuenteInfo) return null;

          const impactoRaw = (item.impacto || "medio").toString().toLowerCase();
          const impacto = ["alto", "medio", "bajo"].includes(impactoRaw) ? impactoRaw : "medio";

          return {
            id: `news-${Date.now()}-${index}`,
            titulo: (item.titulo || "Actualización médica").toString().slice(0, 180),
            resumen: (item.resumen || "Sin resumen disponible.").toString().slice(0, 600),
            categoria: (item.categoria || "General").toString().slice(0, 80),
            impacto,
            fuente: fuenteInfo.nombre,
            url: fuenteInfo.url,
            fuenteValidada: true,
            fechaGeneracion: new Date().toISOString()
          };
        })
        .filter(Boolean);

      if (parsed.length === 0) throw new Error("Sin notas válidas");

      return {
        items: parsed,
        generatedAt: new Date().toISOString(),
        safeMode: true
      };
    } catch (error) {
      console.error("Error generando boletín seguro:", error);

      const fallback = BOLETIN_FALLBACK.slice(0, limite).map((item, index) => {
        const fuenteInfo = FUENTES_MEDICAS_OFICIALES[item.sourceKey];
        return {
          id: `fallback-${Date.now()}-${index}`,
          titulo: item.titulo,
          resumen: item.resumen,
          categoria: item.categoria,
          impacto: item.impacto,
          fuente: fuenteInfo.nombre,
          url: fuenteInfo.url,
          fuenteValidada: true,
          fechaGeneracion: new Date().toISOString()
        };
      });

      return {
        items: fallback,
        generatedAt: new Date().toISOString(),
        safeMode: true,
        fallback: true
      };
    }
  }
);

exports.askGemini = onCall(
  { secrets: [geminiApiKey], invoker: "public", cors: true },
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

// ============================================================================
// FUNCIÓN 5: CREACIÓN DE SESIÓN REAL DE GOOGLE MEET
// ============================================================================
exports.crearSesionMeet = onCall(
  { secrets: [googleCalendarClientEmail, googleCalendarPrivateKey, googleCalendarId], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "No autorizado.");
    }

    const {
      fecha,
      hora,
      horaFin,
      pacienteNombre,
      motivo,
      doctorNombre,
      sucursalNombre,
      timezone
    } = request.data || {};

    if (!fecha || !hora || !horaFin) {
      throw new HttpsError("invalid-argument", "Faltan datos de fecha y horario para crear la teleconsulta.");
    }

    const clientEmail = googleCalendarClientEmail.value();
    const privateKeyRaw = googleCalendarPrivateKey.value();
    const calendarId = googleCalendarId.value();

    if (!clientEmail || !privateKeyRaw || !calendarId) {
      throw new HttpsError(
        "failed-precondition",
        "Calendar API no configurada. Configura GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY y GOOGLE_CALENDAR_ID."
      );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    const tz = timezone || "America/Mexico_City";
    const startDateTime = `${fecha}T${hora}:00`;
    const endDateTime = `${fecha}T${horaFin}:00`;

    try {
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/calendar"]
      });

      const calendar = google.calendar({ version: "v3", auth });

      const eventSummary = `Teleconsulta - ${pacienteNombre || "Paciente"}`;
      const eventDescription = [
        `Motivo: ${motivo || "Consulta"}`,
        `Doctor: ${doctorNombre || "Médico"}`,
        `Sucursal: ${sucursalNombre || "N/A"}`,
        "Generado automáticamente por SRS Medic"
      ].join("\n");

      const requestId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const response = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        sendUpdates: "none",
        requestBody: {
          summary: eventSummary,
          description: eventDescription,
          start: {
            dateTime: startDateTime,
            timeZone: tz
          },
          end: {
            dateTime: endDateTime,
            timeZone: tz
          },
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: {
                type: "hangoutsMeet"
              }
            }
          }
        }
      });

      const data = response?.data || {};
      const meetLink =
        data.hangoutLink ||
        data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ||
        "";

      if (!meetLink) {
        throw new HttpsError("internal", "Google Calendar no devolvió un enlace de Meet válido.");
      }

      return {
        success: true,
        meetLink,
        eventId: data.id || null,
        eventHtmlLink: data.htmlLink || null
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Error creando sesión de Google Meet:", error);
      throw new HttpsError("internal", "No se pudo crear la sesión real de Google Meet.");
    }
  }
);

// ============================================================================
// FUNCIÓN 6: ENVÍO AUTOMÁTICO DE WHATSAPP VIA META CLOUD API
// ============================================================================
exports.enviarWhatsAppNotificacion = onCall(
  { secrets: [whatsappToken, whatsappPhoneId], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "No autorizado.");
    }

    const { telefono, nombrePaciente, consultorio, nombreDoctor, nombreClinica, motivo, templateName } = request.data;

    if (!telefono || !nombrePaciente) {
      throw new HttpsError("invalid-argument", "Faltan datos: teléfono y nombre del paciente son obligatorios.");
    }

    // Normalizar número: quitar caracteres no numéricos, agregar código de país MX
    let phone = telefono.replace(/\D/g, "");
    if (phone.length === 10) phone = `52${phone}`;
    // Normalizar a formato WhatsApp México: 521XXXXXXXXXX
    if (phone.length === 12 && phone.startsWith("52") && !phone.startsWith("521")) {
      phone = "521" + phone.substring(2);
    }
    if (!/^\d{12,15}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "Número de teléfono inválido.");
    }

    const token = whatsappToken.value();
    const phoneId = whatsappPhoneId.value();

    if (!token || !phoneId) {
      throw new HttpsError("failed-precondition", "WhatsApp Business API no configurada. Configura WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.");
    }

    // Permitir plantilla dedicada (ej. teleconsulta_turno) y fallback automático a plantilla general.
    const templateCandidates = Array.from(
      new Set([
        templateName,
        "notificacio_turno"
      ].filter(Boolean))
    );
    const languageCodes = ["es_MX", "es", "es_ES", "es_LA", "es_AR", "en_US"];
    const parameters = [
      { type: "text", text: nombrePaciente },
      { type: "text", text: consultorio || "el consultorio" },
      { type: "text", text: nombreDoctor || "su médico" },
      { type: "text", text: nombreClinica || "la clínica" },
      { type: "text", text: motivo || "Consulta" }
    ];

    try {
      let data = null;
      let sent = false;
      let lastErrorMessage = "Error al enviar WhatsApp.";

      for (const template of templateCandidates) {
        for (const langCode of languageCodes) {
          const body = {
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: template,
              language: { code: langCode },
              components: [
                {
                  type: "body",
                  parameters
                }
              ]
            }
          };

          const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(body)
            }
          );

          data = await response.json();

          if (response.ok) {
            sent = true;
            break;
          }

          lastErrorMessage = data.error?.message || lastErrorMessage;
          const errorCode = data.error?.code;

          // Si no existe traducción de plantilla en ese idioma, probar el siguiente idioma/template.
          if (errorCode === 132001) {
            continue;
          }

          console.error("Error de WhatsApp API:", JSON.stringify(data));
          throw new HttpsError("internal", lastErrorMessage);
        }

        if (sent) break;
      }

      if (!sent) {
        console.error("Error de WhatsApp API (sin traducción disponible):", JSON.stringify(data));
        throw new HttpsError(
          "failed-precondition",
          `No hay plantilla activa/traducción disponible en ${templateCandidates.join(", ")} para es_MX/es/en_US. Verifica aprobación e idiomas en Meta.`
        );
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id || null,
        telefono: phone
      };

    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Error enviando WhatsApp:", error);
      throw new HttpsError("internal", "No se pudo enviar el mensaje de WhatsApp.");
    }
  }
);

// ============================================================================
// FUNCIÓN 6: ENVÍO DE ENCUESTA DE SATISFACCIÓN POST-CONSULTA
// ============================================================================
exports.enviarEncuestaWhatsApp = onCall(
  { secrets: [whatsappToken, whatsappPhoneId], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "No autorizado.");
    }

    const { telefono, nombrePaciente, nombreDoctor, citaId, pacienteId } = request.data;

    if (!telefono || !nombrePaciente) {
      throw new HttpsError("invalid-argument", "Faltan datos: tel\u00e9fono y nombre del paciente.");
    }

    let phone = telefono.replace(/\D/g, "");
    if (phone.length === 10) phone = `52${phone}`;
    // Normalizar a formato WhatsApp México: 521XXXXXXXXXX
    if (phone.length === 12 && phone.startsWith("52") && !phone.startsWith("521")) {
      phone = "521" + phone.substring(2);
    }
    if (!/^\d{12,15}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "N\u00famero de tel\u00e9fono inv\u00e1lido.");
    }

    const token = whatsappToken.value();
    const phoneId = whatsappPhoneId.value();

    if (!token || !phoneId) {
      throw new HttpsError("failed-precondition", "WhatsApp Business API no configurada.");
    }

    const template = "encuesta_satisfaccion";
    const languageCodes = ["es_MX", "es", "es_ES", "es_LA", "es_AR", "en_US"];
    const parameters = [
      { type: "text", text: nombrePaciente },
      { type: "text", text: nombreDoctor || "su m\u00e9dico" }
    ];

    try {
      let data = null;
      let sent = false;
      let lastErrorMessage = "Error al enviar encuesta.";

      for (const langCode of languageCodes) {
        const body = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template,
            language: { code: langCode },
            components: [
              {
                type: "body",
                parameters
              }
            ]
          }
        };

        const response = await fetch(
          `https://graph.facebook.com/v21.0/${phoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }
        );

        data = await response.json();

        if (response.ok) {
          sent = true;
          break;
        }

        lastErrorMessage = data.error?.message || lastErrorMessage;
        const errorCode = data.error?.code;

        if (errorCode === 132001) {
          continue;
        }

        console.error("Error de WhatsApp API (encuesta):", JSON.stringify(data));
        throw new HttpsError("internal", lastErrorMessage);
      }

      if (!sent) {
        console.error("Error de WhatsApp API (encuesta, sin traducción disponible):", JSON.stringify(data));
        throw new HttpsError(
          "failed-precondition",
          `La plantilla '${template}' no tiene traducción disponible en es_MX/es/en_US. Verifica los idiomas en Meta.`
        );
      }

      // Registrar la encuesta como enviada en Firestore
      await firestoreDb.collection("encuestas_satisfaccion").add({
        citaId: citaId || null,
        pacienteId: pacienteId || null,
        pacienteNombre: nombrePaciente,
        doctorNombre: nombreDoctor || "",
        telefono: phone,
        whatsappMessageId: data.messages?.[0]?.id || null,
        estado: "enviada",
        paso: 1,
        enviadaAt: FieldValue.serverTimestamp(),
        calificacionGeneral: null,
        calificacionNumerica: null,
        aspectoDestacado: null,
        aspectoTexto: null,
        recomendaria: null,
        respondidaAt: null,
        descuentoCodigo: null,
        descuentoPorcentaje: 10,
        descuentoAplicado: false
      });

      return {
        success: true,
        messageId: data.messages?.[0]?.id || null
      };

    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("Error enviando encuesta:", error);
      throw new HttpsError("internal", "No se pudo enviar la encuesta.");
    }
  }
);

// ============================================================================
// FUNCIÓN 7: WEBHOOK MULTI-PASO PARA ENCUESTAS DE SATISFACCIÓN (CON IA)
// Usa Gemini para generar respuestas personalizadas y naturales.
// Paso 1: Recibe calificación general (Excelente/Buena/Regular)
// Paso 2: Envía lista interactiva de aspectos → recibe selección
// Paso 3: Envía pregunta de recomendación → recibe respuesta
// Cierre: Envía agradecimiento + código de descuento
// ============================================================================
exports.webhookWhatsApp = onRequest(
  { secrets: [whatsappWebhookVerifyToken, whatsappToken, whatsappPhoneId, geminiApiKey] },
  async (req, res) => {
    // Verificación del webhook (Meta envía GET para validar)
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const verifyToken = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && verifyToken === whatsappWebhookVerifyToken.value()) {
        console.log("Webhook verificado correctamente.");
        return res.status(200).send(challenge);
      }
      return res.status(403).send("Token de verificación inválido.");
    }

    // Procesar mensajes entrantes (POST)
    if (req.method === "POST") {
      try {
        console.log("Webhook POST recibido:", JSON.stringify(req.body).substring(0, 1000));

        const entry = req.body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (!messages || messages.length === 0) {
          console.log("Sin mensajes en el webhook (posible status update)");
          return res.status(200).send("OK");
        }

        const msg = messages[0];
        const from = msg.from;
        console.log(`Mensaje de ${from}, tipo: ${msg.type}, contenido:`, JSON.stringify(msg).substring(0, 500));

        // Extraer respuesta según tipo de mensaje
        const respuestaId = msg.interactive?.button_reply?.id
          || msg.interactive?.list_reply?.id
          || msg.button?.payload
          || null;
        const respuestaTexto = msg.interactive?.button_reply?.title
          || msg.interactive?.list_reply?.title
          || msg.button?.text
          || msg.text?.body
          || null;

        console.log(`Respuesta extraída - ID: ${respuestaId}, Texto: ${respuestaTexto}`);

        if (!respuestaId && !respuestaTexto) {
          console.log("Sin respuesta válida, ignorando.");
          return res.status(200).send("OK");
        }

        // Buscar encuesta activa (no completada) de este teléfono
        console.log(`Buscando encuesta para telefono: ${from}`);
        const snapshot = await firestoreDb.collection("encuestas_satisfaccion")
          .where("telefono", "==", from)
          .orderBy("enviadaAt", "desc")
          .limit(1)
          .get();

        if (snapshot.empty) {
          console.log(`No se encontró encuesta para ${from}`);
          return res.status(200).send("OK");
        }
        console.log(`Encuesta encontrada: ${snapshot.docs[0].id}, estado: ${snapshot.docs[0].data().estado}, paso: ${snapshot.docs[0].data().paso}`);

        const encuestaDoc = snapshot.docs[0];
        const encuesta = encuestaDoc.data();

        if (encuesta.estado === "completada") {
          return res.status(200).send("OK");
        }

        const pasoActual = encuesta.paso || 1;
        const tkn = whatsappToken.value();
        const phId = whatsappPhoneId.value();
        const nombrePaciente = (encuesta.pacienteNombre || "").split(" ")[0] || "Paciente";
        const nombreDoctor = encuesta.doctorNombre || "su médico";

        // Helper para enviar mensajes de WhatsApp
        const enviarMsg = async (msgBody) => {
          const r = await fetch(`https://graph.facebook.com/v21.0/${phId}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${tkn}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: from, ...msgBody })
          });
          if (!r.ok) console.error("Error enviando msg WhatsApp:", await r.text());
        };

        // Helper para generar texto con Gemini
        const generarTextoIA = async (prompt) => {
          try {
            const genAI = new GoogleGenerativeAI(geminiApiKey.value());
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 200, temperature: 0.8 }
            });
            return result.response.text().trim();
          } catch (err) {
            console.error("Error Gemini en webhook:", err.message);
            return null;
          }
        };

        const SYSTEM_CONTEXT = `Eres el asistente virtual del Centro Médico Santa Cruz (CMSC). 
Hablas en español mexicano, de forma cálida, breve y profesional. 
Usa formato de WhatsApp: *negritas*, _cursivas_. 
NO uses emojis excesivos (máximo 1-2 por mensaje). 
El paciente se llama ${nombrePaciente} y fue atendido por ${nombreDoctor}.
Tus respuestas deben ser CORTAS (máximo 2-3 oraciones). Solo el texto, sin saludo ni despedida adicional.`;

        // ── PASO 1: Calificación general ──────────────────────────────
        if (pasoActual === 1) {
          const payload = (respuestaId || respuestaTexto || "").toLowerCase();
          const calMap = { "excelente": 5, "buena": 4, "regular": 3 };
          const calificacion = calMap[payload] || 0;
          if (calificacion === 0) return res.status(200).send("OK");

          await encuestaDoc.ref.update({
            estado: "en_progreso",
            paso: 2,
            calificacionGeneral: payload,
            calificacionNumerica: calificacion
          });

          // Generar texto personalizado con IA
          const esPositiva = calificacion >= 4;
          const iaPrompt = esPositiva
            ? `${SYSTEM_CONTEXT}\nEl paciente calificó su consulta como "${payload}". Genera un mensaje breve agradeciendo su calificación positiva y pídele que seleccione qué aspecto destacó más de su visita. Menciona que le aparecerá una lista para elegir.`
            : `${SYSTEM_CONTEXT}\nEl paciente calificó su consulta como "${payload}". Genera un mensaje breve, empático, agradeciendo su honestidad y pídele que seleccione qué aspecto podría mejorar. Menciona que le aparecerá una lista para elegir.`;
          const textoIA = await generarTextoIA(iaPrompt);
          const textoFallback = esPositiva
            ? `Gracias por tu valoración, ${nombrePaciente}. Nos da gusto que tu experiencia haya sido positiva.\n\n¿Qué fue lo que más destacó de tu visita? Selecciona de la lista:`
            : `Agradecemos tu honestidad, ${nombrePaciente}. Tu opinión nos ayuda a mejorar.\n\n¿Qué aspecto consideras que podemos mejorar? Selecciona de la lista:`;

          await enviarMsg({
            type: "interactive",
            interactive: {
              type: "list",
              body: { text: textoIA || textoFallback },
              action: {
                button: "Seleccionar aspecto",
                sections: [{
                  title: "Aspectos de la consulta",
                  rows: [
                    { id: "atencion_medica", title: "Atención médica", description: "Trato y profesionalismo del doctor" },
                    { id: "tiempo_espera", title: "Tiempo de espera", description: "Puntualidad y duración de la consulta" },
                    { id: "instalaciones", title: "Instalaciones", description: "Limpieza y comodidad del consultorio" },
                    { id: "trato_personal", title: "Trato del personal", description: "Amabilidad de recepción y enfermería" },
                    { id: "explicacion_tratamiento", title: "Tratamiento", description: "Claridad sobre diagnóstico y medicamentos" }
                  ]
                }]
              }
            }
          });

          console.log(`Encuesta paso 1 completado por ${from}: ${payload} (${calificacion}/5)`);
        }

        // ── PASO 2: Aspecto destacado / a mejorar ────────────────────
        else if (pasoActual === 2) {
          const aspectoId = respuestaId || (respuestaTexto || "").toLowerCase().replace(/\s+/g, "_");
          const aspectoLabel = respuestaTexto || aspectoId;

          await encuestaDoc.ref.update({
            paso: 3,
            aspectoDestacado: aspectoId,
            aspectoTexto: aspectoLabel
          });

          const calAnterior = encuesta.calificacionGeneral || "";
          const esPositiva = (encuesta.calificacionNumerica || 0) >= 4;

          const iaPrompt = esPositiva
            ? `${SYSTEM_CONTEXT}\nEl paciente calificó "${calAnterior}" y destacó el aspecto "${aspectoLabel}". Genera un mensaje breve validando su elección y hazle la última pregunta: si recomendaría el Centro Médico Santa Cruz a familiares o amigos. Menciona que le aparecerán botones para responder.`
            : `${SYSTEM_CONTEXT}\nEl paciente calificó "${calAnterior}" y señaló que "${aspectoLabel}" debe mejorar. Genera un mensaje breve, empático, asegurando que tomarás nota para mejorar, y hazle la última pregunta: si recomendaría el Centro Médico Santa Cruz a familiares o amigos. Menciona que le aparecerán botones para responder.`;
          const textoIA = await generarTextoIA(iaPrompt);
          const textoFallback = `Gracias por compartir eso, ${nombrePaciente}.\n\nÚltima pregunta: ¿recomendarías el *Centro Médico Santa Cruz* a familiares o amigos?`;

          await enviarMsg({
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: textoIA || textoFallback },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "si_definitivamente", title: "Sí, seguro" } },
                  { type: "reply", reply: { id: "tal_vez", title: "Tal vez" } },
                  { type: "reply", reply: { id: "no_recomendaria", title: "No" } }
                ]
              }
            }
          });

          console.log(`Encuesta paso 2 completado por ${from}: ${aspectoId}`);
        }

        // ── PASO 3: Recomendación → cierre con descuento ─────────────
        else if (pasoActual === 3) {
          const recomId = (respuestaId || "").toLowerCase();
          const recomendaria = recomId === "si_definitivamente" ? "si" : recomId === "tal_vez" ? "tal_vez" : "no";
          const codigo = "CMSC-" + Math.random().toString(36).substring(2, 7).toUpperCase();

          await encuestaDoc.ref.update({
            estado: "completada",
            paso: 4,
            recomendaria,
            respondidaAt: FieldValue.serverTimestamp(),
            descuentoCodigo: codigo
          });

          const calAnterior = encuesta.calificacionGeneral || "";
          const aspectoAnterior = encuesta.aspectoTexto || "";
          const recomLabel = recomendaria === "si" ? "sí nos recomendaría" : recomendaria === "tal_vez" ? "tal vez nos recomendaría" : "no nos recomendaría";

          const iaPrompt = `${SYSTEM_CONTEXT}
El paciente completó la encuesta:
- Calificación: "${calAnterior}"
- Aspecto destacado: "${aspectoAnterior}"
- Recomendaría: ${recomLabel}

Genera un mensaje de cierre personalizado. Agradece su tiempo, menciona que su opinión será tomada en cuenta, e infórmale que como agradecimiento tiene un *10% de descuento* en su próxima compra de medicamentos en la farmacia del CMSC. Su código es *${codigo}* y es válido por 30 días. Debe mostrarlo al momento de la compra. Cierra con una frase cálida del Centro Médico Santa Cruz.`;
          const textoIA = await generarTextoIA(iaPrompt);
          const textoFallback = `Muchas gracias por tu tiempo, ${nombrePaciente}.\n\nTu opinión nos ayuda a seguir mejorando cada día.\n\nComo agradecimiento, tienes un *10% de descuento* en tu próxima compra de medicamentos en nuestra farmacia.\n\nCódigo: *${codigo}*\n\nMuéstralo al momento de tu compra. Válido por 30 días.\n\n_Centro Médico Santa Cruz — Tu salud es nuestra prioridad_`;

          await enviarMsg({
            type: "text",
            text: { body: textoIA || textoFallback }
          });

          console.log(`Encuesta completada por ${from}: recomienda=${recomendaria}, código=${codigo}`);
        }

        return res.status(200).send("OK");
      } catch (error) {
        console.error("Error procesando webhook:", error);
        return res.status(200).send("OK");
      }
    }

    return res.status(405).send("Método no soportado.");
  }
);
