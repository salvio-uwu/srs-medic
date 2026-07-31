# SRS-Medic — Guía para agentes

## Contexto
- Resumen del dominio: `CONTEXTO_PROYECTO.md`
- Reglas de mutación originales: `.opencode.md`
- **No leer** `contextoproyecto.txt` salvo que el usuario lo pida (muy largo, puede estar desactualizado)
- Contexto de dominio: siempre activo vía rule `medical-domain.mdc`
- Referencia extendida: `.cursor/skills/srs-medic-domain/SKILL.md` (opcional)

## Stack
React 19 + Vite 7 + Firebase 12 + Tailwind 3. JavaScript/JSX. Sin tests automatizados aún.

## Archivos críticos (no refactorizar sin permiso)
- `src/shared/Agenda.jsx`
- `src/pages/doctor/ExpedienteClinico.jsx`
- `src/pages/admin/CatalogosGlobales.jsx`
- `src/components/PlantillaDinamicaModal.jsx`
- `src/App.jsx`

## Entry points
- `src/main.jsx` — providers (sin StrictMode)
- `src/App.jsx` — router y layout global
- `src/config/firebase.js` — Firebase init
- `functions/index.js` — Cloud Functions

## Cloud Functions usadas por el frontend
`askGemini`, `enviarWhatsAppNotificacion`, `enviarEncuestaWhatsApp`, `generarBoletinMedicoSeguro`, `analizarBitacora`

## Cloud Functions NO conectadas
`analizarMedicamento`, `crearSesionMeet`, `webhookWhatsApp` (HTTP, no callable)

## Deploy
Ver `VERSIONADO.md` y `deploy.sh`
