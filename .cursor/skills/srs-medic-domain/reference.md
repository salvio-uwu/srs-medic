# SRS-Medic — Referencia extendida

## Estructura de carpetas

```
src/
├── pages/admin/       # Dashboard, inventario, usuarios, catálogos, SSA admin
├── pages/doctor/      # Consultorio, ExpedienteClinico, Pacientes
├── pages/enfermeria/  # Agenda, triage, jefatura, caducidades
├── pages/rh/          # RH, finanzas, auditoría
├── pages/intendencia/ # Bitácoras limpieza
├── pages/ssa/         # Autoevaluación SSA
├── pages/auth/        # Login, portal
├── components/pdf/    # Plantillas PDF clínicas
├── services/          # Lógica de dominio reutilizable
├── shared/            # AdminLayout, Agenda (monolito)
├── context/           # AuthContext, SessionLocationContext
└── utils/             # expedienteElectronico, patientName, ssaUtils
```

## Datos estáticos (`public/data/`)

- `cie10.json` — catálogo CIE-10
- `estudios.json`, `medicamentos.json` — catálogos de referencia

## Auth

1. `onAuthStateChanged` → usuario básico
2. `onSnapshot(users/{uid})` → perfil (rol, permissions, consultorio)
3. Grace period 2.5s en logout para evitar redirect prematuro

## Session location

`SessionLocationContext` sincroniza sucursal/consultorio activo a `users/{uid}`.

## Meilisearch

- Cliente: `src/services/meilisearchClient.js`
- Índice: `pacientes`
- Prod default: `http://100.95.63.70:7700`
- `patientMeiliSyncService.js` existe pero no está integrado al CRUD

## Deploy

- Web: `deploy.sh` → rsync + Docker nginx
- Desktop: Tauri 2 (`src-tauri/`) — shell sin lógica Rust
- Versión: `package.json` → `public/version.json` → poll cliente

## Integraciones pendientes / muertas

- `analizarMedicamento` — función existe, frontend no la llama
- `crearSesionMeet` — función existe, frontend no la llama
- Meili sync — servicio existe, no cableado
- `docxtemplater`, `react-to-print` — en package.json, sin uso en `src/`
