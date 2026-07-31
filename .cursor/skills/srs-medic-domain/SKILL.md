---
name: srs-medic-domain
description: >-
  Referencia extendida SRS-Medic (estructura carpetas, integraciones muertas,
  Meilisearch, auth). El contexto base ya está en la rule medical-domain.mdc.
  Usar para tareas profundas en expediente, Firebase, SSA o arquitectura.
---

# SRS-Medic Domain (referencia extendida)

> Contexto esencial siempre activo en `.cursor/rules/medical-domain.mdc`

## Colecciones Firestore principales

| Área | Colecciones |
|------|-------------|
| Clínico | `pacientes`, `historial_clinico`, `citas`, `consultas`, `estudios_previos`, `historico_embarazos` |
| Enfermería | `triage_enfermeria`, `notas_enfermeria`, `ordenes_enfermeria`, `bitacora_px_enfermeria`, `registros_krit`, `registros_autoclave`, `caducidades_almacen` |
| Catálogos | `catalogo_medicamentos`, `catalogo_estudios`, `catalogo_procedimientos`, `catalogo_consultorios`, `catalogo_sucursales`, `catalogo_especialidades`, `catalogo_plantillas_documentos`, `catalogo_motivos_consulta`, `catalogo_sintomatologia*` |
| Operaciones | `users` (+ sub `documentos`), `inventario`, `horarios_bloqueados` |
| Comunicación | `canales`/`mensajes`, `chats_privados`/`mensajes`, `panic_alerts` |
| Compliance | `ssa_cuestionario`, `ssa_auditorias` |
| Compartir | `expedientes_compartidos`, `encuestas_satisfaccion`, `patient_links` |
| Auditoría | `auditoria_movimientos_consultorio`, `auditoria_admin_usuarios`, `pacientes_fusionados_log` |

Subcolección: `bitacora_carro_rojo/{sucursalId}/historial`

## Permisos → rutas (principales)

| permissionId | Módulo |
|--------------|--------|
| `admin.dashboard` | Dashboard, inventario, agenda admin |
| `admin.usuarios` | Usuarios |
| `admin.monitor` | Supervisión, monitor, depuración |
| `admin.catalogos` | Catálogos globales |
| `admin.plantillas` | Plantillas documentos |
| `admin.reportes` | Reportes, encuestas |
| `doctor.agenda` | Consulta, capacitación médicos |
| `shared.agenda` | Agenda compartida `/agenda` |
| `shared.pacientes` | Pacientes |
| `enfermeria.dashboard` | Dashboard enfermería |
| `enfermeria.triage` | Triage |
| `enfermeria.hoja` | Hoja enfermería |
| `enfermeria.jefatura` | Jefatura |
| `rh.dashboard` | RH dashboard |
| `intendencia.registro` | Bitácoras limpieza |

Helper: `hasPermission(user, permissionId, fallbackRoles)` en `src/services/permissionService.js`

## Flujo expediente clínico

1. Paciente en `pacientes`
2. Consulta SOAP → `historial_clinico` con `pacienteId`
3. PDF vía `@react-pdf/renderer` en `src/components/pdf/*`
4. Sanitización: `limpiar()` en `src/utils/expedienteElectronico.js`
5. Compartir: `expedienteShareService.js` + QR

## Cloud Functions

**Callable (frontend):** `askGemini`, `enviarWhatsAppNotificacion`, `enviarEncuestaWhatsApp`, `generarBoletinMedicoSeguro`, `analizarBitacora`

**Backend only:** `analizarMedicamento`, `crearSesionMeet`, `webhookWhatsApp`

## Servicios clave (`src/services/`)

| Servicio | Uso |
|----------|-----|
| `permissionService.js` | RBAC |
| `patientSearchService.js` | Búsqueda pacientes (Firestore) |
| `patientMergeService.js` | Fusión duplicados |
| `expedienteShareService.js` | Links/QR expediente |
| `documentStorageService.js` | PDFs a Storage |
| `meilisearchClient.js` | Búsqueda Meili (sync no cableado) |
| `clinicalAuditService.js` | Auditoría clínica |

## PDFs

- Principal: `@react-pdf/renderer` → `src/components/pdf/`
- Fallback captura: `html2canvas` + `jspdf` en ExpedienteClinico/PlantillaDinamica

## Detalles adicionales

Ver [reference.md](reference.md) para estructura de carpetas y datos estáticos.
