# CONTEXTO COMPLETO DEL PROYECTO: SRS-Medic

> Fuente canónica de cómo funciona la app **hoy**. Contraste contra el código: 2026-09-04 (versión `1.3.10`).
> Úsalo al pegar contexto en un chat nuevo. Las rules de Cursor (`.cursor/rules/medical-domain.mdc`) son el resumen siempre activo; este archivo es el mapa.

---

## 1. QUÉ ES

ERP clínico para clínicas en México (Centro Médico Santa Cruz). UI 100 % en español. Roles de personal (no hay portal de paciente). Tres superficies: **web** (Vite), **desktop** (Tauri 2, shell sin lógica Rust) y **Android** (Capacitor 6 WebView que carga producción).

---

## 2. STACK

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, Vite 7, React Router 7, Tailwind 3, JavaScript/JSX (sin TypeScript) |
| Iconos | `lucide-react` (principal), `@phosphor-icons/react` (admin) |
| Backend | Firebase 12 — Auth email/password, Firestore, Storage, Cloud Functions |
| IA | Gemini / Vertex AI vía Cloud Functions (`askGemini` y otras) |
| PDF | `@react-pdf/renderer` (principal); `html2canvas` + `jspdf` / `html-to-image` como fallback de captura |
| Excel | `xlsx` (reportes e importación) |
| Búsqueda | Meilisearch (cliente existe; **sync no cableado** al CRUD) |
| Móvil | Capacitor 6 (`Share`, `Filesystem`, `StatusBar`, speech recognition) |
| Desktop | Tauri 2 (`src-tauri/`) |

**No hay** React Query/SWR, tests automatizados ni `React.lazy`. Firestore se llama desde componentes con el SDK.

Proyecto Firebase: `srs-feacb`. Init: `src/config/firebase.js` exporta `auth`, `db`, `storage`, `functions`.

---

## 3. ENTRY POINTS

| Archivo | Rol |
|---------|-----|
| `src/main.jsx` | Providers **sin StrictMode** (bug Firestore `INTERNAL ASSERTION FAILED`). Decodifica URL ofuscada antes del router. |
| `src/App.jsx` | Router, `PermissionRoute`/`GuestRoute`, chat global, pánico, banner de versión |
| `src/config/firebase.js` | Init Firebase |
| `src/config/navigationCatalog.js` | Menú lateral por permisos |
| `functions/index.js` | Cloud Functions |
| `deploy.sh` | Build + rsync Tailscale + Docker |

Providers (`main.jsx`): `FirebaseErrorProvider` → `AuthProvider` → `SessionLocationProvider` → `App`.

---

## 4. ESTRUCTURA DE CARPETAS (`src/`)

```
src/
├── App.jsx, main.jsx
├── config/          firebase.js, navigationCatalog.js
├── context/         AuthContext, SessionLocationContext, FirebaseErrorContext
├── hooks/           useAppVersion, useMonitorData, useToast, useIsMobile
├── pages/
│   ├── auth/        Login (activo). Bienvenida y PortalAcceso: en disco, NO montados.
│   ├── home/        Inicio.jsx — hub post-login
│   ├── admin/       dashboard, inventario, usuarios, catálogos, plantillas, reportes, SSA, monitor…
│   ├── doctor/      ExpedienteClinico + tabs expediente/. Pacientes. Capacitación.
│   ├── enfermeria/  agenda, triage, jefatura, carro rojo, caducidades, hoja, orden, registros…
│   ├── rh/          DashboardRH
│   ├── intendencia/ RegistroLimpiezaManual (ruta activa). CapturaBitacora y DashboardIntendencia: NO montados.
│   └── ssa/         canvas, editor, evaluación, historial
├── components/      modales clínicos, chat, pánico, enfermería, pdf/
├── shared/          AppShell, AdminLayout, Agenda.jsx (monolito)
├── services/        RBAC, pacientes, share, catálogos, asistencia…
└── utils/           expedienteElectronico, citaStatus, patientName, routeObfuscator, sessionIdle, firebaseErrors
```

**No existen:** `Consultorio.jsx`, `NotaMedicaRapida.jsx`, `shared/Pacientes.jsx`, `shared/Mensajeria.jsx`.
**Vacíos y sin ruta:** `pages/doctor/Consulta.jsx`, `pages/doctor/DashboardDoctor.jsx`.
**Backups:** `*.old.jsx` en enfermería (carro rojo) — no usar.

Datos estáticos: `public/data/cie10.json`, `estudios.json`, `medicamentos.json`, `inventario.csv`.

---

## 5. AUTENTICACIÓN Y SESIÓN

### AuthContext (`src/context/AuthContext.jsx`)

Expone: `{ user, login, logout, loading, profileError, retryProfile, cambiarEstadoOperativo }`.

1. `signInWithEmailAndPassword`
2. Perfil `users/{uid}` con `getDoc` (timeout 4 s) + `onSnapshot`
3. `user` = Firebase Auth **más** todo el documento Firestore (`rol`, `permissions` / `permissionList`, `statusOperativo`, `isOnline`, `lastSeen`, `sessionSucursal*`, `sessionConsultorio*`, etc.)
4. Cache `localStorage` `srs_auth_profile_cache_v1`
5. Hidratado si hay `rol` o permisos
6. Logout: gracia 250 ms sin cache / **1500 ms** con cache (no 2.5 s)
7. Idle **30 min** (`src/utils/sessionIdle.js`); heartbeat cada **2 min** (`lastSeen`, `isOnline`, `asistencia_diaria`)
8. Splash hard-stop 8 s

Signup público bloqueado: Cloud Function `beforeUserCreatedBlockPublicSignup` + allowlist `auth_registro_permitido`. Alta de staff: `crearUsuarioStaff`.

### SessionLocationContext

Sucursal/consultorio de sesión. Catálogos `catalogo_sucursales` + `catalogo_consultorios`. Persistencia en `users/{uid}` y `sessionStorage` `srs_loc_confirmed_{uid}`. Gate: `WelcomeLocationGate`.

### FirebaseErrorContext

Errores `permission-denied` → `FirebasePermissionSupportModal`.

### Rutas

- `GuestRoute`: login; si hay sesión → `/inicio`
- `PermissionRoute`: `hasPermission(user, permissionId, fallbackRoles)`; si no → `/inicio`. `permissionId` puede ser array (OR).
- `RequireAuth`: solo sesión hidratada (`/inicio`, `/ssa/evaluar/:templateId`)
- `/compartido/:token`: **público** (expediente compartido)

Home de todos: `/inicio` (`resolveUserHomePath`). `/portal` redirige a `/inicio`. `/doctor/consulta` redirige a `/agenda`.

---

## 6. PERMISOS Y ROLES

Helper: `hasPermission` en `src/services/permissionService.js`. Admin (`admin` | `admin_maestro` | `administrador`) **siempre** accede a `admin.*`. Si el usuario tiene `permissionList` o mapa `permissions`, manda eso; si no, `fallbackRoles`.

Tabla canónica UI: `PERMISSION_GROUPS` en `src/pages/admin/Usuarios.jsx`.

| id | Módulo |
|----|--------|
| `admin.dashboard` | Dashboard, inventario, agenda admin, SSA admin |
| `admin.usuarios` | Usuarios / personal |
| `admin.catalogos` | Catálogos globales |
| `admin.plantillas` | Plantillas de documentos |
| `admin.reportes` | Reportes + encuestas |
| `admin.monitor` | Monitor, supervisión, depuración |
| `admin.supervision` | En matriz RH (la ruta `/admin/supervision` usa `admin.monitor`) |
| `doctor.agenda` | Capacitación médicos; también abre `/agenda` (OR con `shared.agenda`) |
| `doctor.expediente` | Expediente clínico médico |
| `doctor.notaRapida` | Default de rol médico; **no hay ruta** |
| `enfermeria.dashboard` | Agenda enfermería, carro rojo, caducidades, capacitación, expediente enfermería |
| `enfermeria.triage` | Triage + antecedentes rápidos |
| `enfermeria.hoja` | Hoja de enfermería |
| `enfermeria.jefatura` | Jefatura + registros |
| `rh.dashboard` | Dashboard RH |
| `intendencia.registro` | Bitácora limpieza |
| `shared.agenda` | Agenda compartida `/agenda` |
| `shared.pacientes` | Pacientes |

Alta de roles (`ROLE_OPTIONS`): `medico`, `enfermeria`, `jefa_enfermeria`, `intendencia`, `rh`, `admin`, `operativo`, `recepcion`.

Aliases en fallbacks: `doctor`/`medico`, `enfermera`/`enfermero`, `jefa`, `administrador`/`admin_maestro`, `recursos_humanos`, `limpieza`.

---

## 7. RUTAS (`src/App.jsx`)

### Públicas / guest
| Path | Destino |
|------|---------|
| `/`, `/login` | Login |
| `/portal` | → `/inicio` |
| `/compartido/:token` | Vista pública de expediente |
| `/app/*` | Decodifica ruta ofuscada |

### Auth
| Path | Página |
|------|--------|
| `/inicio` | Hub (`Inicio`) |
| `/ssa/evaluar/:templateId` | Evaluación SSA (solo auth) |

### Admin (`AdminLayout`)
`/admin/dashboard`, `inventario`, `usuarios`, `usuarios/:userId`, `supervision`, `catalogos`, `plantillas`, `reportes`, `encuestas`, `monitor`, `depuracion`, `agenda`, `pacientes`, `ssa`, `ssa/editor/:templateId`, `ssa/historial`.

### Otros
| Path | Página |
|------|--------|
| `/rh/dashboard` | DashboardRH |
| `/intendencia/registro` | RegistroLimpiezaManual |
| `/doctor/expediente` | ExpedienteClinico |
| `/expediente-electronico` | ExpedienteClinico (admin) |
| `/doctor/capacitacion` | CapacitacionMedicos |
| `/enfermeria/dashboard` | AgendaEnfermeria |
| `/enfermeria/jefatura` | DashboardJefaEnfermeria |
| `/enfermeria/registros` | RegistrosEnfermeriaView |
| `/enfermeria/carro-rojo` | Carro rojo (jefa vs piso) |
| `/enfermeria/triage` | Triage |
| `/enfermeria/antecedentes` | AntecedentesRapidos |
| `/enfermeria/hoja-enfermeria` | HojaEnfermeria |
| `/enfermeria/capacitacion` | CapacitacionEnfermeria |
| `/enfermeria/caducidades` | CaducidadesEnfermeria |
| `/enfermeria/expediente` | ExpedienteClinico (no en menú; desde agenda) |
| `/enfermeria/orden-servicio` | OrdenServicioEnfermeria |
| `/agenda` | Agenda compartida |
| `/pacientes` | Pacientes |
| `*` | → `/inicio` |

Globales en `App`: chat (`ChatPanel`), pánico (`PanicButton`), poll de versión (`useAppVersion`).

---

## 8. EXPEDIENTE CLÍNICO

Monolito: `src/pages/doctor/ExpedienteClinico.jsx`. Archivo crítico: no refactorizar sin permiso.

### Entrada
```js
navigate('/doctor/expediente', { state: { pacienteId, citaId, motivo } })
```
Enfermería: `/enfermeria/expediente`. Admin: `/expediente-electronico` o modal `ExpedienteElectronicoModal`. Al abrir cita activa: `citas.estado = 'en_consulta'`.

### Tabs
1. **Resumen** (`SeccionResumen`) — default: notas previas, gráficas, IA, documentos
2. **Historial** (`SeccionAntecedentes`) — heredofamiliares, no patológicos, patológicos, aparatos, alergias, vacunas, cirugías, CIE-10
3. **Consulta** (`SeccionConsulta`) — padecimiento, exploración, diagnóstico, Rx, estudios, procedimientos, referencias; dictado de voz

### Estado `expediente` (forma real)

```js
{
  px_info: { edad, id_receta, telefono, alergias_base, grupo_sanguineo, fum, fpp, sdg, es_embarazada, requiere_cirugia, fecha_nacimiento },
  control_embarazo: { num_embarazo, num_bebes, riesgo, acido_folico, fondo_uterino, fcf, num_consulta_prenatal, complicaciones },
  resumen: { notas_previas, resumen_paciente },
  antecedentes: { hereditarios, no_patologicos, patologicos, aparatos, alergias, vacunas, cirugias, cie10 },
  consulta: {
    padecimiento,
    exploracion: { signos, antropometria, colesterol, fisica, glucosa },
    diagnostico: { enfermedad_actual, tratamiento_lista, indicaciones, pronostico },
    estudios, procedimientos, referencias_medicas
  },
  meta: { costo, segunda_opinion }
}
```

`updateCampo('consulta.diagnostico.indicaciones', valor)` actualiza por path.

### Guardado
- Autosave debounce **1.5 s** → `localStorage` `autosave_draft_${citaId}` y a veces `citas.consultaDraft`
- **Finalizar** → `historial_clinico` + actualiza `pacientes` + cita `completada` + limpia draft
- Sanitizar: `limpiar()` / `deepSanitize()` en `src/utils/expedienteElectronico.js`
- PDF: `src/components/pdf/ExpedienteElectronicoPDF.jsx`
- Compartir: `expedienteShareService` → Storage + `expedientes_compartidos` → `/compartido/{token}` (30 días)

Temporizador de consulta: cuenta regresiva (Web Audio + UI).

---

## 9. AGENDA

`src/shared/Agenda.jsx` — monolito crítico (~5.7k líneas). Citas, filtros sucursal/consultorio, teleconsulta, unificar pacientes, WhatsApp, entrada a expediente.

Estados (`src/utils/citaStatus.js`):

| UI | Firestore |
|----|-----------|
| Esperando triage | `pendiente` sin `triageIniciadoAt` |
| En triage | tiene `triageIniciadoAt` |
| Esperando consulta | `en_espera` |
| En consulta | `en_consulta` |
| En procedimiento | `en_procedimiento` |
| Finalizada | `completada` |
| Cancelada | `cancelada` |

WhatsApp (`enviarWhatsAppNotificacion`): siguiente paciente, teleconsulta al agendar, recordatorio. Flags: `notificadoWhatsApp`, `notificadoWhatsAppAt`, `recordatorioEnviado`. Boletín: `generarBoletinMedicoSeguro`.

Bloqueos: `horarios_bloqueados`.

---

## 10. MÓDULOS POR ÁREA

### Admin
Dashboard, inventario, usuarios (alta vía `crearUsuarioStaff`, reset password), catálogos (`CatalogosGlobales`), plantillas (`PlantillaDinamicaModal`), reportes, encuestas, monitor, supervisión, depuración (merge duplicados), agenda admin, SSA.

Reportes: Consultas, Pediátricas, Estudios, Medicamentos recetados, Tiempos de atención, Embarazadas (NOM-007), SUIVE.

### Médico
Agenda + expediente + capacitación (`catalogo_documentos_capacitacion_medicos`).

### Enfermería
Agenda/torre, triage → `triage_enfermeria`, hoja → `notas_enfermeria`, orden de servicio → `ordenes_enfermeria` + `historial_clinico`, jefatura (almacén, KRIT, autoclave, caducidades, carro rojo, pedidos), registros.

### RH / Intendencia / SSA / Chat
RH: `/rh/dashboard`. Intendencia: `/intendencia/registro` → `bitacorasLimpieza`. SSA: `ssa_cuestionario`, `ssa_auditorias`. Chat: `canales`, `chats_privados`. Pánico: `panic_alerts`.

---

## 11. COLECCIONES FIRESTORE

Nombres en español de prod: **no renombrar**.

### Clínico
`pacientes`, `historial_clinico`, `citas`, `consultas` (legacy, p. ej. SUIVE), `estudios_previos`, `historico_embarazos`

### Enfermería / ops clínicas
`triage_enfermeria`, `notas_enfermeria`, `ordenes_enfermeria`, `bitacora_px_enfermeria`, `registros_krit`, `registros_autoclave`, `caducidades_almacen`, `bitacoras_operativas`, `bitacora_carro_rojo` + sub `/{sucursalId}/historial`

### Catálogos
`catalogo_sucursales`, `catalogo_consultorios`, `catalogo_especialidades`, `catalogo_motivos_consulta`, `catalogo_medicamentos`, `catalogo_estudios`, `catalogo_procedimientos`, `catalogo_procedimientos_enfermeria`, `catalogo_referencias_medicas`, `catalogo_sintomatologia`, `catalogo_sintomatologia_categorias`, `catalogo_plantillas_documentos`, `catalogo_documentos_capacitacion`, `catalogo_documentos_capacitacion_medicos`, `catalogo_pedido_medicamentos`, `catalogo_categorias_pedido`

### Operaciones
`users` (+ sub `documentos`), `inventario`, `horarios_bloqueados`, `asistencia_diaria`, `bitacorasLimpieza`, `auth_registro_permitido`

### Comunicación
`canales` / `mensajes`, `chats_privados` / `mensajes`, `panic_alerts`

### Compliance / share / auditoría
`ssa_cuestionario`, `ssa_auditorias`, `encuestas_satisfaccion`, `expedientes_compartidos`, `patient_links`, `resumenes_homologados`, `pacientes_fusionados_log`, `auditoria_admin_usuarios`, `auditoria_movimientos_consultorio`, `auditoria_historial_migrado`, `auditoria_expediente_clinico` (servicio sin UI), `auditoria_password_resets` (solo CF)

Reglas en repo: `firestore.rules`, `storage.rules` (verificar si ya están desplegadas).

Storage (entre otros): `expedientes_compartidos/`, `expedientes/{pacienteId}/documentos/`, `chat_files/`, `estudios_previos/`, `capacitacion/`, `usuarios/`.

---

## 12. CLOUD FUNCTIONS (`functions/index.js`)

Secretos: `GEMINI_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `GOOGLE_CALENDAR_*`. Nunca hardcodear.

| Función | Tipo | Frontend |
|---------|------|----------|
| `askGemini` | onCall | Sí — consulta, resumen, capacitaciones, chat admin, registros |
| `enviarWhatsAppNotificacion` | onCall | Sí — Agenda, AgendaEnfermeria |
| `generarBoletinMedicoSeguro` | onCall | Sí — Agenda |
| `analizarBitacora` | onCall | Sí — CapturaBitacora (página no montada; el callable existe) |
| `crearUsuarioStaff` | onCall | Sí — Usuarios |
| `resetUserPassword` | onCall | Sí — Usuarios |
| `enviarEncuestaWhatsApp` | onCall | **No** (código comentado en ExpedienteClinico) |
| `analizarMedicamento` | onCall | **No** |
| `crearSesionMeet` | onCall | **No** |
| `webhookWhatsApp` | HTTP | N/A |
| `beforeUserCreatedBlockPublicSignup` | Auth blocking | N/A |

---

## 13. SERVICIOS (`src/services/`)

**Cableados:** `permissionService`, `asistenciaService`, `patientSearchService`, `patientLinkService`, `patientMergeService`, `patientNameRepairService`, `migrationService`, `expedienteShareService`, `documentStorageService`, `nativePdfShare`, `enfermeriaPatientLogService`, `studyCatalogService`, `procedureCatalogService`, `symptomCatalogService`, `referenciaMedicaService`, `homologationService`, `speechDictationService`.

**Muertos:** `clinicalAuditService` (0 imports UI), `patientMeiliSyncService` + `meilisearchClient` (sync no al CRUD), `authService.js` / `inventoryService.js` / `patientService.js` (archivos vacíos).

---

## 14. PDFs (`src/components/pdf/`)

Expediente electrónico, historia, consentimiento, aviso de privacidad, cartas de buena salud (adulto/menor/genérica), pasaporte, DIF, COVID, dengue, influenza, antidoping, prenupciales, informe monitor.

Plantillas dinámicas: `catalogo_plantillas_documentos` + `PlantillaDinamicaModal`.

---

## 15. PLATAFORMAS, DEPLOY, VERSIÓN

- **Web:** `deploy.sh` → bump versión, `npm run build`, rsync a nodos Tailscale (`prometeo@…/srs-medic`), Docker (`Dockerfile.runtime`). Meilisearch en `100.95.63.70` (`docker compose --profile meili`).
- **Android:** `ANDROID.md`. APK `releases/SRS-Medic.apk`. WebView apunta a `https://centromedicosantacruz.com`. Descarga: `/descargas/`.
- **Tauri:** `src-tauri/` — wrapper desktop; versión propia en `tauri.conf.json`.
- **Versión:** `package.json` → `__BUILD_VERSION__` + `public/version.json`. Cliente: `useAppVersion` (poll 2 min). Ver `VERSIONADO.md`.

Comandos:

```bash
npm run dev          # Vite :5173
npm run build
npm run android:sync / android:apk / android:run
./deploy.sh          # producción
```

---

## 16. ARCHIVOS CRÍTICOS (cambios mínimos)

- `src/shared/Agenda.jsx`
- `src/pages/doctor/ExpedienteClinico.jsx`
- `src/pages/admin/CatalogosGlobales.jsx`
- `src/components/PlantillaDinamicaModal.jsx`
- `src/App.jsx`

Regla: no extraer/refactorizar salvo petición explícita. UI y comentarios en español (México). No inventar colecciones ni Cloud Functions.

---

## 17. INTEGRACIONES MUERTAS / DEUDA REAL

- `analizarMedicamento`, `crearSesionMeet`: CF existen, UI no las llama
- `enviarEncuestaWhatsApp`: CF existe; llamada en expediente **comentada**
- Meili sync: servicio existe, no integrado al CRUD de pacientes
- `docxtemplater` / `react-to-print`: en `package.json`; sin uso claro en `src/`
- `clinicalAuditService`: escribe colección, nadie lo importa
- Páginas en disco sin ruta: `Bienvenida`, `PortalAcceso`, `DashboardEnfermeria`, `DashboardIntendencia`, `CapturaBitacora`, `Consulta.jsx` vacío, `DashboardDoctor.jsx` vacío

**Ya no aplica** (el `.md` viejo lo decía): inventario mock de Consultorio; servicios vacíos como único estado; ausencia de protección de rutas; API Key de Gemini hardcodeada (ahora `defineSecret`).

---

## 18. CONVENCIONES

- Componentes funcionales + hooks
- Tailwind + estilos inline/CSS variables (no unificar sin pedirlo)
- Modales con boolean `useState`
- Navegación con `navigate('/ruta', { state })` + `useLocation().state`
- `onSnapshot` siempre con cleanup
- Creates Firestore: preferir `serverTimestamp()`
- Queries `in` / `__name__`: máximo 10 IDs por chunk

---

## 19. OTROS DOCS DEL REPO

| Archivo | Uso |
|---------|-----|
| `AGENTS.md` | Cómo deben trabajar los agentes |
| `.cursor/rules/medical-domain.mdc` | Dominio siempre activo |
| `.cursor/skills/srs-medic-domain/` | Referencia extendida para agentes |
| `VERSIONADO.md` | Poll de versión |
| `ANDROID.md` | APK Capacitor |
| `contextoproyecto.txt` | Puntero a este archivo (el dump de 16k líneas estaba desactualizado) |

*Fin. Si el código y este documento discrepan, gana el código; actualiza este archivo.*
