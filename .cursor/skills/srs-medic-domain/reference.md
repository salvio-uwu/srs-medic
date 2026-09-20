# SRS-Medic — Referencia extendida

Contraste 2026-09-04. Mapa narrativo: `CONTEXTO_PROYECTO.md`.

## Estructura de carpetas

```
src/
├── pages/admin/       # Dashboard, inventario, usuarios, catálogos, reportes, SSA, monitor
├── pages/doctor/      # ExpedienteClinico, Pacientes, CapacitacionMedicos
├── pages/enfermeria/  # Agenda, triage, jefatura, caducidades, carro rojo, hoja, orden
├── pages/rh/          # DashboardRH
├── pages/intendencia/ # RegistroLimpiezaManual (ruta activa)
├── pages/ssa/         # Canvas, editor, evaluación, historial
├── pages/auth/        # Login (Bienvenida/PortalAcceso no montados)
├── pages/home/        # Inicio (hub post-login)
├── components/pdf/    # Plantillas PDF clínicas
├── services/          # Lógica de dominio reutilizable
├── shared/            # AppShell, AdminLayout, Agenda (monolito)
├── context/           # Auth, SessionLocation, FirebaseError
├── hooks/             # useAppVersion, useMonitorData, useToast, useIsMobile
└── utils/             # expedienteElectronico, citaStatus, patientName, ssaUtils, sessionIdle
```

No existen: `Consultorio.jsx`, `NotaMedicaRapida`, `shared/Pacientes.jsx`, `shared/Mensajeria.jsx`.
Vacíos sin ruta: `pages/doctor/Consulta.jsx`, `DashboardDoctor.jsx`.
No usar: `*.old.jsx` en enfermería.

## Datos estáticos (`public/data/`)

- `cie10.json` — catálogo CIE-10
- `estudios.json`, `medicamentos.json` — catálogos de referencia
- `inventario.csv` — insumo de importación

## Auth

1. `onAuthStateChanged` → usuario básico
2. `onSnapshot(users/{uid})` → perfil (rol, permissions, consultorio)
3. Cache `srs_auth_profile_cache_v1`; gracia logout 250 ms / 1500 ms con cache
4. Idle 30 min; heartbeat 2 min + `asistencia_diaria`
5. Signup público bloqueado (`beforeUserCreatedBlockPublicSignup` + `auth_registro_permitido`)
6. Alta staff: callable `crearUsuarioStaff`

## Session location

`SessionLocationContext` sincroniza sucursal/consultorio activo a `users/{uid}` (`sessionSucursal*`, `sessionConsultorio*`). Gate: `WelcomeLocationGate`.

## Errores Firebase

`FirebaseErrorContext` + `FirebasePermissionSupportModal` ante `permission-denied`.

## Agenda / citas

Fuente de estados: `src/utils/citaStatus.js`.
Flujo: `pendiente` → triage (`triageIniciadoAt`) → `en_espera` → `en_consulta` / `en_procedimiento` → `completada` | `cancelada`.

## Meilisearch

- Cliente: `src/services/meilisearchClient.js`
- Índice: `pacientes`
- Nodo deploy: `100.95.63.70` (`docker compose --profile meili`)
- `patientMeiliSyncService.js` existe pero **no** está integrado al CRUD

## Deploy y plataformas

- Web: `deploy.sh` → rsync Tailscale + Docker nginx (`Dockerfile.runtime`)
- Android: Capacitor 6, APK `releases/SRS-Medic.apk`, WebView a producción (`ANDROID.md`)
- Desktop: Tauri 2 (`src-tauri/`) — shell sin lógica Rust
- Versión: `package.json` → `public/version.json` → poll `useAppVersion` cada 2 min (`VERSIONADO.md`)

## Integraciones pendientes / muertas

- `analizarMedicamento` — función existe, frontend no la llama
- `crearSesionMeet` — función existe, frontend no la llama
- `enviarEncuestaWhatsApp` — función existe; llamada comentada en ExpedienteClinico
- Meili sync — servicio existe, no cableado
- `clinicalAuditService` — 0 imports UI
- `docxtemplater`, `react-to-print` — en package.json, sin uso claro en `src/`
- Páginas sin ruta: `Bienvenida`, `PortalAcceso`, `DashboardEnfermeria`, `DashboardIntendencia`, `CapturaBitacora`
