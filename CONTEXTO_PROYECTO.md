# CONTEXTO COMPLETO DEL PROYECTO: SRS-Medic

> Documento generado para dar contexto a Claude Web. Cópialo y pégalo al inicio de tu conversación.

---

## 1. DESCRIPCIÓN GENERAL

**SRS-Medic** es un sistema web de gestión clínica integral (ERP médico) para clínicas y consultorios. Está orientado a pequeñas/medianas clínicas con múltiples roles de usuario. El proyecto está 100% en español (México).

---

## 2. STACK TECNOLÓGICO

### Frontend
- **React 19** + **Vite 7** — Framework y build tool
- **React Router DOM 7** — Navegación SPA
- **Tailwind CSS 3** — Estilos utility-first
- **lucide-react** — Iconografía

### Backend / Base de datos
- **Firebase 12** — Auth, Firestore (BD), Storage, Cloud Functions
- **Firestore** — Base de datos NoSQL en tiempo real
- **Firebase Auth** — Autenticación por email/password

### IA Integrada
- **Google Gemini 2.0 Flash** — Vía Firebase Cloud Functions
- Función `analizarMedicamento`: valida medicamentos contra alergias del paciente (respuesta JSON)

### Generación de documentos
- **@react-pdf/renderer** — Generación de PDFs desde React
- **docx + docxtemplater** — Documentos Word (.docx)
- **file-saver** — Descarga de archivos en navegador
- **react-to-print** — Impresión directa

### Gráficos / Utilerías
- **recharts** — Gráficos en React
- **date-fns** — Manejo de fechas

---

## 3. ESTRUCTURA DE CARPETAS

```
srs-medic/
├── src/
│   ├── App.jsx                    # Router principal (todas las rutas)
│   ├── context/
│   │   └── AuthContext.jsx        # Context de autenticación global
│   ├── config/
│   │   └── firebase.js            # Inicialización Firebase (auth, db, storage, functions)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx          # Página de login
│   │   │   └── PortalAcceso.jsx   # Portal intermedio de selección de rol
│   │   ├── admin/
│   │   │   ├── DashboardAdmin.jsx
│   │   │   ├── Inventario.jsx
│   │   │   ├── Usuarios.jsx
│   │   │   ├── Supervision.jsx
│   │   │   ├── Reportes.jsx
│   │   │   └── MonitorActividad.jsx  # "Torre de Control" de personal
│   │   ├── doctor/
│   │   │   ├── Consultorio.jsx       # Consulta rápida (modo simple)
│   │   │   ├── ExpedienteClinico.jsx # Expediente completo (módulo principal)
│   │   │   ├── NotaMedicaRapida.jsx
│   │   │   ├── Pacientes.jsx
│   │   │   └── expediente/
│   │   │       ├── SeccionConsulta.jsx      # Tab: Consulta actual
│   │   │       ├── SeccionAntecedentes.jsx  # Tab: Antecedentes del paciente
│   │   │       └── SeccionResumen.jsx       # Tab: Resumen/notas previas
│   │   └── enfermeria/
│   │       ├── AgendaEnfermeria.jsx   # Dashboard principal de enfermería
│   │       ├── Triage.jsx
│   │       └── HojaEnfermeria.jsx
│   ├── components/
│   │   ├── FormatoReceta.jsx          # Receta imprimible (print CSS)
│   │   ├── HistoriaClinicaModal.jsx   # Modal de historial clínico
│   │   ├── ModalPaciente.jsx          # Modal de datos del paciente
│   │   ├── DocumentosImagenesModal.jsx
│   │   ├── ExportarHistoriaModal.jsx
│   │   ├── ConsentimientoModal.jsx
│   │   ├── EstudioPrevioModal.jsx
│   │   ├── HistoricoEstudiosModal.jsx
│   │   ├── EnviarHistoriaModal.jsx
│   │   ├── HistoricoEmbarazosModal.jsx
│   │   ├── CartaBuenaSaludModal.jsx
│   │   ├── CartaPasaporteModal.jsx
│   │   ├── SolicitudDIFModal.jsx
│   │   ├── DengueModal.jsx
│   │   ├── PrenupcialesModal.jsx
│   │   ├── AvisoPrivacidadModal.jsx
│   │   ├── AntidopingModal.jsx
│   │   ├── CovidModal.jsx
│   │   ├── InfluenzaModal.jsx
│   │   └── pdf/                       # 13 componentes PDF con react-pdf/renderer
│   │       ├── AntidopingPDF.jsx
│   │       ├── AvisoPrivacidadPDF.jsx
│   │       ├── CartaBuenaSaludAdultoPDF.jsx
│   │       ├── CartaBuenaSaludMenorPDF.jsx
│   │       ├── CartaBuenaSaludPDF.jsx
│   │       ├── CartaPasaporteUniversalPDF.jsx
│   │       ├── ConsentimientoInformadoPDF.jsx
│   │       ├── CovidPDF.jsx
│   │       ├── DenguePDF.jsx
│   │       ├── DocumentoHistoriaPDF.jsx
│   │       ├── InfluenzaPDF.jsx
│   │       ├── PrenupcialesPDF.jsx
│   │       └── SolicitudDIFPDF.jsx
│   ├── shared/
│   │   ├── Agenda.jsx               # Agenda compartida (admin/doctor/enfermería)
│   │   ├── Pacientes.jsx            # Vista de pacientes compartida
│   │   └── Mensajeria.jsx           # (En desarrollo)
│   └── services/
│       ├── authService.js
│       ├── inventoryService.js
│       └── patientService.js
└── functions/
    └── index.js                     # Cloud Function: analizarMedicamento (Gemini IA)
```

---

## 4. RUTAS DE LA APLICACIÓN (App.jsx)

```
/                        → Login
/portal                  → PortalAcceso (selección de rol)

/admin/dashboard         → DashboardAdmin
/admin/inventario        → Inventario
/admin/usuarios          → Usuarios
/admin/supervision       → Supervision
/admin/reportes          → Reportes
/admin/monitor           → MonitorActividad (Torre de Control)

/doctor/consulta         → Consultorio (consulta rápida)
/doctor/expediente       → ExpedienteClinico (expediente completo)
/doctor/nota-rapida      → NotaMedicaRapida

/enfermeria/dashboard    → AgendaEnfermeria
/enfermeria/triage       → Triage
/enfermeria/hoja-enfermeria → HojaEnfermeria

/agenda                  → Agenda (compartida)
/pacientes               → Pacientes (compartida)
```

---

## 5. SISTEMA DE AUTENTICACIÓN (AuthContext.jsx)

El `AuthContext` es el proveedor global de autenticación. Expone:

```js
const { user, login, logout, loading, cambiarEstadoOperativo } = useAuth();
```

### Objeto `user`
Combina datos de **Firebase Auth** + datos del documento en **Firestore `users/{uid}`**:
```js
user = {
  uid,
  email,
  nombre,          // campo de Firestore
  rol,             // 'admin' | 'doctor' | 'enfermeria' | 'paciente'
  sucursal,        // campo de Firestore
  isOnline,        // true/false
  statusOperativo, // 'disponible' | 'ocupado' | 'comida' | 'administrativo' | 'offline'
  lastLogin,
  lastSeen,
  ...otrosDatosDeFirestore
}
```

### Funciones
- **`login(email, password)`** — Login con Firebase Auth, actualiza `isOnline: true` y `statusOperativo: 'disponible'` en Firestore.
- **`logout()`** — Cierra sesión y marca `isOnline: false` en Firestore.
- **`cambiarEstadoOperativo(estado, datosExtra)`** — Permite al médico/enfermera cambiar su estado en tiempo real (integrado con la Torre de Control del admin).

### Heartbeat
Cada 2 minutos actualiza `lastSeen` e `isOnline: true` en Firestore para mantener presencia en tiempo real.

---

## 6. MÓDULO PRINCIPAL: EXPEDIENTE CLÍNICO (ExpedienteClinico.jsx)

Es el módulo más complejo. Se accede desde la agenda pasando state de navegación:
```js
navigate('/doctor/expediente', { state: { pacienteId, citaId, motivo } })
```

### Tabs del expediente
1. **Consulta** (`SeccionConsulta`) — Padecimiento actual, exploración física, diagnóstico, receta, estudios
2. **Resumen** (`SeccionResumen`) — Notas previas y resumen del paciente
3. **Historial/Antecedentes** (`SeccionAntecedentes`) — Antecedentes hereditarios, no patológicos, patológicos, aparatos, alergias, vacunas, cirugías, CIE-10

### Estructura del estado `expediente`
```js
{
  px_info: {
    edad, id_receta, telefono, alergias_base,
    grupo_sanguineo, fum, fpp, sdg,
    es_embarazada, requiere_cirugia: { general, ginecologica },
    fecha_nacimiento
  },
  control_embarazo: {
    num_embarazo, num_bebes, riesgo, acido_folico,
    complicaciones: { diabetes, infeccion_urinaria, preeclampsia, hemorragia, sospecha_covid, hipertension }
  },
  resumen: { notas_previas, resumen_paciente },
  antecedentes: {
    hereditarios: { diabetes, hipertension, cardiopatia, ... }, // por familiar (mama, papa, hermanos, tios, primos, abuelos)
    no_patologicos: { bano, lavado_dientes, habitacion, alimentacion, sedentarismo, otros },
    patologicos: {
      actuales, quirurgicos, transfusionales, traumaticos, hospitalizaciones,
      adicciones: { tabaquismo, alcohol, drogas, detalle },
      especificos: { glaucoma, calculo, reflujo, incontinencia, dislipidemias, otro }
    },
    aparatos: { digestivo, cardiovascular, respiratorio, urinario, genital, hematologico, endocrino, osteomuscular, nervioso, sensorial, psicosomatico, otro },
    alergias: { tipo, lista: [{sustancia}], otras },
    vacunas: { lista, otras },
    cirugias: { lista: [{procedimiento, operacion, nota, unidad, fechaRegistro, diagnostico, medico}] },
    cie10: []
  },
  consulta: {
    padecimiento,
    exploracion: {
      signos: { ta, temp, fc, fr, spo2 },
      antropometria: { peso, talla, cintura, cadera, imc, peso_ideal },
      colesterol: { trigliceridos, colesterol, hba1c },
      fisica: { habitus, cabeza, cuello, torax, genitales, extremidades, columna, abdomen },
      glucosa: { lista }
    },
    diagnostico: { enfermedad_actual, tratamiento_lista: [{nombre, dosis}], indicaciones, pronostico },
    estudios: { paquetes_seleccionados, estudios_seleccionados, notas_generales }
  },
  meta: { costo, segunda_opinion }
}
```

### Funciones importantes
- **`updateCampo(path, value)`** — Actualiza el estado de forma profunda con path de puntos. Ej: `updateCampo('consulta.diagnostico.indicaciones', 'texto')`
- **`handleGuardar()`** — Guarda en Firestore colección `historial_clinico`, actualiza el estado de la cita a `completada`, limpia el borrador local.
- **Auto-guardado local** — Cada 1 segundo guarda borrador en `localStorage`. Al entrar, si existe un borrador reciente (<24h) muestra modal para restaurarlo.
- **Temporizador de consulta** — Cuenta regresiva de 3 minutos con alertas sonoras (Web Audio API) y alertas visuales.

### Colección Firestore: `historial_clinico`
```js
{
  ...expediente,
  pacienteId,
  pacienteNombre,
  medicoNombre,
  medicoId,
  fecha: serverTimestamp()
}
```

---

## 7. COLECCIONES FIRESTORE

| Colección | Descripción |
|-----------|-------------|
| `users` | Perfiles de usuarios (médicos, admin, enfermería). Contiene `rol`, `nombre`, `sucursal`, `isOnline`, `statusOperativo`, `lastSeen` |
| `pacientes` | Datos de pacientes: `nombreCompleto`, `apellidoPaterno`, `apellidoMaterno`, `fechaNacimiento`, `sexo`, `telefonoMovil`, `email`, `grupoSanguineo`, `notasPersonales` |
| `historial_clinico` | Registro de cada consulta guardada (ver estructura de `expediente` arriba) |
| `citas` | Citas/agenda: `estado` ('pendiente', 'completada'), `pacienteId`, `pacienteNombre`, `signos_vitales`, `triage_motivo`, `triage_alergias` |
| `consultas` | Consultas rápidas del módulo Consultorio |
| `inventario` | Medicamentos e insumos del inventario |

---

## 8. FUNCIÓN DE IA (functions/index.js)

Firebase Cloud Function `analizarMedicamento`:

**Entrada:**
```js
{ medicamento: "Amoxicilina", historialAlergias: ["Penicilina", "Polen"] }
```

**Lógica:** Llama a Gemini 2.0 Flash con un prompt de farmacólogo experto para detectar reacciones alérgicas directas o cruzadas.

**Salida JSON:**
```js
{ riesgo: true, mensaje: "Riesgo de reacción cruzada: Amoxicilina es una penicilina semisintética..." }
```

---

## 9. MÓDULO CONSULTORIO (Consultorio.jsx)

Módulo de consulta rápida/simple (diferente al Expediente Clínico completo).
- Ficha del paciente: nombre, edad, peso, alergias (campos locales, no vinculados a Firestore por pacienteId directamente)
- Cronómetro de consulta (15 min por defecto)
- Integración con Torre de Control: al iniciar consulta cambia `statusOperativo` a `ocupado`, al finalizar a `disponible`
- Receta con buscador de inventario (mock data por ahora)
- Al finalizar: guarda en colección `consultas` y lanza `window.print()` para imprimir receta

---

## 10. DOCUMENTOS PDF DISPONIBLES

Generados con `@react-pdf/renderer`. Se abren desde el **Centro de Documentación** dentro del Expediente Clínico:

**Certificados Médicos:**
- Carta de Buena Salud (Adulto)
- Carta de Buena Salud (Menor)
- Carta Pasaporte Universal (menor/mayor)
- Solicitud DIF
- Prenupciales

**Legal y Privacidad:**
- Consentimiento Informado
- Aviso de Privacidad

**Pruebas Rápidas:**
- Antidoping (Orina)
- COVID-19 (Ag)
- Influenza A+B
- Prueba Dengue
- (Panel Viral y Panel VSR — pendientes)

---

## 11. SISTEMA DE ESTADOS OPERATIVOS (Torre de Control)

El admin puede ver en tiempo real el estado de cada médico/enfermera en `MonitorActividad`.

**Estados posibles:** `disponible` | `ocupado` | `comida` | `administrativo` | `offline`

El estado se actualiza en Firestore `users/{uid}.statusOperativo` y se lee en tiempo real con listeners de Firestore.

---

## 12. PATRONES Y CONVENCIONES DE CÓDIGO

- **Componentes funcionales** con hooks de React
- **Tailwind CSS** para todos los estilos (sin CSS modules ni styled-components)
- **No hay TypeScript** — Todo en JSX/JS
- **Sin React Query/SWR** — Fetching directo con funciones de Firestore
- **Modales con estado booleano** — Ej: `const [showModal, setShowModal] = useState(false)`
- **Navegación con state** — `navigate('/ruta', { state: { datos } })`; se lee con `useLocation().state`
- **`updateCampo(path, value)`** — Patrón de actualización profunda de estado por string de path
- **Diseño visual:** Glassmorphism + Tailwind (bordes suaves, backdrop-blur, sombras suaves)
- **Iconos:** `lucide-react` exclusivamente

---

## 13. COSAS IMPORTANTES / DEUDA TÉCNICA CONOCIDA

- `Consultorio.jsx` usa un inventario **mock** (datos locales hardcoded), no conectado a Firestore real
- `src/services/` existen los archivos pero pueden estar **vacíos o sin implementar**
- `Mensajeria.jsx` está en desarrollo, sin funcionalidad completa
- La función IA tiene la **API Key de Gemini hardcodeada** en el código (deuda de seguridad)
- El `AuthContext` no tiene **protección de rutas** (PrivateRoute) — cualquiera puede acceder a las rutas sin estar autenticado
- El módulo `Pacientes` existe tanto en `pages/doctor/Pacientes.jsx` como en `shared/Pacientes.jsx`

---

## 14. COMANDOS DE DESARROLLO

```bash
npm run dev        # Inicia servidor de desarrollo (puerto 5173)
npm run build      # Build de producción
npm run lint       # Linting con ESLint

# Firebase
firebase deploy --only functions   # Deploy Cloud Functions
firebase deploy                    # Deploy completo

# Docker
docker-compose up                  # Levanta con Docker (watchPolling activo)
```

---

*Fin del documento de contexto. El proyecto está en desarrollo activo.*
