---
name: srs-medic-domain
description: >-
  Referencia extendida SRS-Medic (estructura, auth, colecciones, funciones,
  Meilisearch, plataformas). El contexto base está en medical-domain.mdc.
  El mapa completo está en CONTEXTO_PROYECTO.md. Usar para tareas profundas
  en expediente, Firebase, SSA, enfermería o arquitectura.
---

# SRS-Medic Domain (referencia extendida)

> Siempre activo: `.cursor/rules/medical-domain.mdc`
> Mapa completo: `CONTEXTO_PROYECTO.md` (contraste 2026-09-04, v1.3.10)

## Colecciones Firestore principales

| Área | Colecciones |
|------|-------------|
| Clínico | `pacientes`, `historial_clinico`, `citas`, `consultas` (legacy), `estudios_previos`, `historico_embarazos` |
| Enfermería | `triage_enfermeria`, `notas_enfermeria`, `ordenes_enfermeria`, `bitacora_px_enfermeria`, `registros_krit`, `registros_autoclave`, `caducidades_almacen`, `bitacoras_operativas`, `bitacora_carro_rojo` |
| Catálogos | `catalogo_medicamentos`, `catalogo_estudios`, `catalogo_procedimientos`, `catalogo_procedimientos_enfermeria`, `catalogo_consultorios`, `catalogo_sucursales`, `catalogo_especialidades`, `catalogo_plantillas_documentos`, `catalogo_motivos_consulta`, `catalogo_sintomatologia`, `catalogo_sintomatologia_categorias`, `catalogo_referencias_medicas`, `catalogo_documentos_capacitacion`, `catalogo_documentos_capacitacion_medicos`, `catalogo_pedido_medicamentos`, `catalogo_categorias_pedido` |
| Operaciones | `users` (+ sub `documentos`), `inventario`, `horarios_bloqueados`, `asistencia_diaria`, `bitacorasLimpieza`, `auth_registro_permitido` |
| Comunicación | `canales`/`mensajes`, `chats_privados`/`mensajes`, `panic_alerts` |
| Compliance | `ssa_cuestionario`, `ssa_auditorias` |
| Compartir | `expedientes_compartidos`, `encuestas_satisfaccion`, `patient_links`, `resumenes_homologados` |
| Auditoría | `auditoria_movimientos_consultorio`, `auditoria_admin_usuarios`, `auditoria_historial_migrado`, `auditoria_expediente_clinico` (sin UI), `auditoria_password_resets` (solo CF), `pacientes_fusionados_log` |

Subcolección: `bitacora_carro_rojo/{sucursalId}/historial`

Reglas en repo: `firestore.rules`, `storage.rules`.

## Permisos → rutas (principales)

Tabla canónica: `PERMISSION_GROUPS` en `src/pages/admin/Usuarios.jsx`. Helper: `hasPermission` en `permissionService.js`. Admin siempre accede a `admin.*`.

| permissionId | Módulo |
|--------------|--------|
| `admin.dashboard` | Dashboard, inventario, agenda admin, SSA admin |
| `admin.usuarios` | Usuarios / personal |
| `admin.monitor` | Supervisión, monitor, depuración |
| `admin.catalogos` | Catálogos globales |
| `admin.plantillas` | Plantillas documentos |
| `admin.reportes` | Reportes, encuestas |
| `doctor.agenda` | Capacitación médicos; OR con `shared.agenda` para `/agenda` |
| `doctor.expediente` | Expediente clínico |
| `shared.agenda` | Agenda compartida `/agenda` |
| `shared.pacientes` | Pacientes |
| `enfermeria.dashboard` | Agenda enfermería, carro rojo, caducidades, capacitación, expediente enf. |
| `enfermeria.triage` | Triage + antecedentes rápidos |
| `enfermeria.hoja` | Hoja enfermería |
| `enfermeria.jefatura` | Jefatura + registros |
| `rh.dashboard` | RH dashboard |
| `intendencia.registro` | Bitácoras limpieza |

Roles de alta: `medico`, `enfermeria`, `jefa_enfermeria`, `intendencia`, `rh`, `admin`, `operativo`, `recepcion`.

Home: `/inicio`. `/portal` → `/inicio`. `/doctor/consulta` → `/agenda`. `/compartido/:token` público.

## Flujo expediente clínico

1. Paciente en `pacientes`
2. Entrada: `navigate('/doctor/expediente', { state: { pacienteId, citaId } })` (o `/enfermeria/expediente`)
3. Tabs: Resumen → Historial → Consulta (`SeccionResumen` / `SeccionAntecedentes` / `SeccionConsulta`)
4. Autosave 1.5 s (`autosave_draft_${citaId}`); finalizar → `historial_clinico` + cita `completada`
5. PDF vía `@react-pdf/renderer` en `src/components/pdf/*`
6. Sanitización: `limpiar()` / `deepSanitize()` en `src/utils/expedienteElectronico.js`
7. Compartir: `expedienteShareService.js` + QR → `/compartido/{token}`

No existen `Consultorio.jsx` ni `NotaMedicaRapida`.

## Cloud Functions

**Callable conectadas:** `askGemini`, `enviarWhatsAppNotificacion`, `generarBoletinMedicoSeguro`, `crearUsuarioStaff`, `resetUserPassword`

**Callable con UI desmontada:** `analizarBitacora` (`CapturaBitacora.jsx` no está en el router)

**No conectadas:** `analizarMedicamento`, `crearSesionMeet`, `enviarEncuestaWhatsApp` (comentada en ExpedienteClinico)

**Otros:** `webhookWhatsApp` (HTTP), `beforeUserCreatedBlockPublicSignup` (Auth blocking)

Secretos: `GEMINI_API_KEY`, `WHATSAPP_*`, `GOOGLE_CALENDAR_*`. Nunca hardcodear.

## Servicios clave (`src/services/`)

| Servicio | Uso |
|----------|-----|
| `permissionService.js` | RBAC |
| `asistenciaService.js` | `asistencia_diaria` |
| `patientSearchService.js` | Búsqueda pacientes (Firestore) |
| `patientMergeService.js` | Fusión duplicados |
| `expedienteShareService.js` | Links/QR expediente |
| `documentStorageService.js` | PDFs a Storage |
| `speechDictationService.js` | Dictado voz (web + Capacitor) |
| `meilisearchClient.js` | Cliente Meili (sync no cableado) |
| `clinicalAuditService.js` | Auditoría clínica **sin imports UI** |

Vacíos / muertos: `authService.js`, `inventoryService.js`, `patientService.js`, `patientMeiliSyncService.js`.

## PDFs

- Principal: `@react-pdf/renderer` → `src/components/pdf/`
- Fallback captura: `html2canvas` + `jspdf` en ExpedienteClinico / PlantillaDinamica
- Nativo Android: `nativePdfShare.js`

## Detalles adicionales

Ver [reference.md](reference.md) para carpetas, auth, Meilisearch, deploy y plataformas.
