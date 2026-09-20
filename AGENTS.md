# SRS-Medic — Guía para agentes

## Contexto (leer en este orden)

1. Resumen siempre activo: `.cursor/rules/medical-domain.mdc`
2. Mapa completo de la app: `CONTEXTO_PROYECTO.md` (canónico; contraste 2026-09-04)
3. Referencia extendida: `.cursor/skills/srs-medic-domain/SKILL.md` + `reference.md`
4. Mutación: `.opencode.md` y `.cursor/rules/scope-discipline.mdc`
5. `contextoproyecto.txt` es el mismo mapa en texto plano. **No** es un dump de código.

No inventar colecciones Firestore ni Cloud Functions. Si el código y los docs discrepan, gana el código.

## Stack

React 19 + Vite 7 + Firebase 12 + Tailwind 3. JavaScript/JSX. Sin tests automatizados. Sin StrictMode (`src/main.jsx`).

Plataformas: web (`deploy.sh`), Android Capacitor 6 (`ANDROID.md`), Tauri 2 (`src-tauri/`).

## Archivos críticos (no refactorizar sin permiso)

- `src/shared/Agenda.jsx`
- `src/pages/doctor/ExpedienteClinico.jsx`
- `src/pages/admin/CatalogosGlobales.jsx`
- `src/components/PlantillaDinamicaModal.jsx`
- `src/App.jsx`

## Entry points

- `src/main.jsx` — providers (sin StrictMode)
- `src/App.jsx` — router, chat, pánico, versión
- `src/config/firebase.js` — Firebase init
- `src/config/navigationCatalog.js` — menú
- `functions/index.js` — Cloud Functions

## Cloud Functions usadas por el frontend

`askGemini`, `enviarWhatsAppNotificacion`, `generarBoletinMedicoSeguro`, `crearUsuarioStaff`, `resetUserPassword`

`analizarBitacora` tiene callable; la página `CapturaBitacora` no está montada en el router.

## Cloud Functions NO conectadas al UI

`analizarMedicamento`, `crearSesionMeet`, `enviarEncuestaWhatsApp` (llamada comentada), `webhookWhatsApp` (HTTP)

## Deploy

Ver `VERSIONADO.md`, `ANDROID.md` y `deploy.sh`.
