# Kumpels Core — Modelo de dominio, relaciones y mapeo HL7/FHIR

Este documento describe el modelo canónico de Kumpels Core (MVP Oncología) y su
**intención de mapeo** a HL7/FHIR. Kumpels mantiene su propio modelo interno; el
mapeo a FHIR es de interoperabilidad, **no** convierte la base en "FHIR-only".

Estado del MVP: la persistencia es en memoria (stores con `useSyncExternalStore`)
sobre datos sintéticos en `src/data/`. Los tipos de dominio viven en `src/types/`,
las reglas en `src/utils/`, y ningún componente define modelos ni reglas de negocio.

## 1. Entidades y separación de conceptos

Conceptos distintos, **no** colapsados en objetos genéricos:

| Concepto | Tipo (`src/types`) | Datos (`src/data`) | Reglas (`src/utils`) |
|---|---|---|---|
| Patient | `patient.ts` `Patient` | `patients.ts` | `patient.ts` |
| Episode / Journey | `journey.ts` | `patients.ts` (`journey[]`) | `journey.ts` |
| WorkItem | `work.ts` | derivado | `workItems.ts` |
| TherapyPlan / Medication | `therapy.ts` | `therapy.ts` | `resumen.ts` |
| MedicationOrder / Fulfillment / Dispense | `fulfillment.ts` | `fulfillment.ts` | `fulfillmentStore.ts`, `continuity.ts` |
| ValidationRun / Finding / ProfessionalReview | `review.ts` | `review.ts` | `review.ts`, `reviewStore.ts` |
| PharmaceuticalCareEnrollment / FollowUpAssessment | `careFollowup.ts` | `careFollowup.ts` | `careStore.ts` |
| PreparationOrder / PreparationInstance / ComponentUsage | `preparation.ts`, `traceability.ts` | `preparation.ts`, `traceability.ts` | `preparationStore.ts`, `traceabilityStore.ts` |
| ProductPresentation / BatchLot | `traceability.ts` | `traceability.ts` | `traceabilityStore.ts` |
| DomainEvent (actividad/trazabilidad) | `event.ts` | embebido en cada agregado | — |
| AuditMeta / StateTransition | `provenance.ts` | — (scaffolding) | — |
| WorkspaceProfile / DemoPersona (nativo) | `config/workspaces.ts` | `config/workspaces.ts` | `personaStore.ts` |

## 2. Relaciones (por id, listas para persistencia)

```
Patient ──1:N── Episode(Journey stage[])
Patient ──1:1── TherapyPlan (getTherapy por patientId)          [MVP: 1 episodio activo]
TherapyPlan ──1:N── MedicationOrder (ORDERS.patientId)
MedicationOrder ──1:1── MedicationFulfillment ──1:N── MedicationDispense
MedicationOrder ──1:N── PreparationOrder (PreparationOrder.medicationOrderId?)
PreparationOrder ──1:1── PreparationInstance (por orderId)
PreparationInstance ──1:N── ComponentUsage ──N:1── BatchLot
BatchLot ──N:1── ProductPresentation
PreparationOrder ──1:N── PreparationComponent ──N:1── ProductPresentation
Patient ──1:1── ValidationRun ──1:N── Finding ──0:1── ProfessionalReview
Patient ──1:1── PharmaceuticalCareEnrollment ──0:N── FollowUpAssessment
WorkItem ──> {patientId, source workflow, href}   (derivado; nunca dueño del dato)
```

Reglas de integridad ya respetadas:
- Un solo dataset de pacientes (`data/patients.ts`) y de medicación; ninguna feature los duplica.
- `MedicationPending` es **derivado** (`remaining > 0`), no un registro aparte.
- La revisión clínica se **reutiliza** (no se duplica) en preparación (readiness) y en Hoy.
- Los workspaces por rol solo cambian visibilidad/acciones; no duplican registros.

## 3. Intención de mapeo HL7/FHIR

Conceptos clínicos estándar → recurso FHIR:

| Kumpels | FHIR | Nota |
|---|---|---|
| `Patient` | `Patient` | id estable `ONC-####` → `Patient.identifier` |
| Profesional / `ORG.user`, `team.*` | `Practitioner` + `PractitionerRole` | rol = `PractitionerRole.code` |
| Institución / `ORG` (tenant) | `Organization` | Asisfarma/IMAT son datos, no arquitectura |
| `ClinicalSnapshot` (labs, peso, TFG…) | `Observation` | por código LOINC |
| `MedicationOrder` | `MedicationRequest` | |
| `MedicationDispense` | `MedicationDispense` | parcial/restante → `whenHandedOver`, `quantity` |
| Administración (enfermería, scope demo) | `MedicationAdministration` | aún no persistida |
| `PreparationOrder` / `PreparationInstance` | `MedicationDispense` en preparación + `Task` | mezcla estéril como paso de dispensación |
| `WorkItem` | `Task` | `Task.code`, `Task.for`, `Task.owner`, `Task.businessStatus` |
| `TherapyPlan` / protocolo / ciclo | `CarePlan` (+ `PlanDefinition` para el protocolo) | |
| `Episode` / Journey | `EpisodeOfCare` | etapas → `EpisodeOfCare.status` history |
| `DomainEvent` / actividad | `AuditEvent` / `Provenance` | |
| `AuditMeta` | `Resource.meta` (+ `Provenance`) | |
| `StateTransition` | `Provenance` / `AuditEvent` | previous/new/actor/at/reason |
| `BatchLot` | `Medication.batch` (lotNumber, expirationDate) | |
| `ProductPresentation` | `Medication` (+ `code`, form/strength) | |
| `ComponentUsage` | `MedicationDispense` + `Provenance` (genealogía) | insumo→preparación→paciente |
| Autorización (`auth`) | `Coverage` / `ClaimResponse` | según pagador |

## 4. Conceptos nativos de Kumpels (sin mapeo forzado)

Se mantienen nativos porque FHIR no los modela limpiamente; se documenta su relación:

- **ValidationRun / Finding** — corrida del motor de reglas y sus hallazgos. Un
  `Finding` **no** es un error de medicación ni un PRM; la decisión es humana
  (`ProfessionalReview`). Relación FHIR: un Finding confirmado *podría* proyectarse a
  `DetectedIssue`, y la corrida a `AuditEvent`, pero el modelo de reglas es nativo.
- **ProfessionalReview** — decisión (Confirmado/Descartado/Pendiente) sobre un Finding.
  Proyección parcial a `DetectedIssue.status` + `Provenance`.
- **Preparación: genealogía componente↔lote↔paciente** — nativa; se expone a FHIR
  como cadena de `MedicationDispense` + `Provenance`, no como un recurso único.
- **WorkspaceProfile / DemoPersona** — configuración de UI por rol; sin equivalente
  FHIR (se relaciona con `PractitionerRole` solo para autorización futura).
- **Continuity risk** — señal determinística y explicable (no IA predictiva); nativa.
- **Supply forecasting / configuración de workflow** — nativos (no en este MVP).

## 5. Provenance, auditoría y eventos

- `provenance.ts` define `AuditMeta` (createdAt/updatedAt/createdBy/source/sourceSystem/version)
  y `StateTransition` (previousState/newState/actor/at/reason). Son scaffolding: las
  entidades pueden componerlos incrementalmente sin rediseño.
- Cobertura parcial ya existente de actor+timestamp: `ProfessionalReview`,
  `ContactEntry`, `LotAuditEntry`, `ComponentUsage`, y los `DomainEvent[]` de cada agregado.
- **Sin reemplazo silencioso**: la corrección de lote conserva el valor previo en
  `LotAuditEntry` (acción `correccion`), consistente con `StateTransition`.
- `DomainEvent` (`event.ts`) es la forma única de línea de actividad/trazabilidad;
  antes estaba duplicada como `FulfillmentEvent` y `PrepEvent` (ahora alias).

Acciones que deben producir eventos consistentes (hoy en `events[]` de cada agregado):
revisión completada · seguimiento completado · dispensación parcial · pendiente creado ·
paciente contactado · pendiente resuelto · preparación iniciada/finalizada/verificada/liberada ·
lote seleccionado. Un `DomainEvent` unificado deja lista su futura consolidación en un
log de eventos único (no se construye analítica todavía).

## 6. Deuda técnica diferida (intencional)

- Persistencia real / API (hoy stores en memoria por sesión).
- Log de eventos unificado y `AuditMeta` cableado en todas las entidades.
- `Patient 1:N Episode` real (el MVP asume un episodio activo por paciente).
- Autorización real (los workspaces son solo visibilidad, no permisos).
- Eliminación de stubs `PatientTabs/ResumenTab/RevisionTab` (inertes; requiere borrado en el repo local).

---

## Administración / Configuración institucional (TASK 15)

Área nativa de Kumpels para que la institución gestione su configuración operativa
sin depender de Soporte Kumpels para el día a día. Sigue la frontera de TASK 12.1
(UI → `services.admin` → `AdminRepository` → adaptador in-memory) y emite eventos
auditables (TASK 13).

Conceptos separados: **User ≠ Role ≠ Permission ≠ Scope ≠ Workspace**.

| Concepto | Tipo (`types/admin.ts`) | FHIR (intención, no forzado) |
|---|---|---|
| `AdminUser` / profesional | `AdminUser` | `Practitioner` + `PractitionerRole` |
| `RoleId` (rol) | reusa `DemoPersona` | `PractitionerRole.code` |
| `Scope` (sede/programa) | `Scope` | `PractitionerRole.location` / `.organization` |
| `Facility` | `Facility` | `Location` / `Organization` |
| `Organization` | `Organization` | `Organization` |
| `Program` | `Program` | `HealthcareService` / `Location` |
| `ClinicalConfiguration` (protocolo) | `ClinicalConfiguration` | contenido de protocolo → `PlanDefinition` |
| `IntegrationConfig` | `IntegrationConfig` | nativo (endpoints → `Endpoint` si aplica) |
| `WorkspaceProfile` | `config/workspaces.ts` | **nativo** (sin equivalente FHIR) |
| `SupportSession` | `SupportSession` | **nativo** (acceso temporal con alcance) |

Eventos auditables de configuración: `USER_STATUS_CHANGED`, `USER_ROLE_ASSIGNED`,
`USER_TEAM_ASSIGNED`, `USER_SCOPE_ASSIGNED`, `SUPPORT_REQUESTED`, `SUPPORT_ENDED`
(cada uno con actor, timestamp, estado previo/nuevo y razón cuando aplica).

Gobernanza clínica: la **configuración clínica** (protocolos, rulesets, plantillas,
formularios) NO se muta desde la administración de TI. Es de solo lectura en este
MVP y sigue su ciclo de vida propio (Borrador → Revisión → Aprobado → Activo →
Retirado), versionado y trazable. Soporte Kumpels es una **SupportSession** temporal
y con alcance, nunca un superusuario permanente/oculto.

---

## Trazabilidad operativa, handoffs y cierre de flujo (TASK 18)

Toda acción clínica u operativa relevante es atribuible (actor), sellada con
**fecha + hora exactas** (`utils/datetime` → ISO tz-aware + etiqueta legible),
auditable, explicable y conectada al siguiente responsable.

### Tres registros DISTINTOS (no colapsados)

| Registro | Tipo | Responde |
|---|---|---|
| **AuditRecord** | `types/audit.ts` (`utils/auditStore`) | quién cambió qué, de qué a qué, cuándo, por qué |
| **DomainEvent** | `types/domainEvent.ts` (`utils/eventStore`) | qué hecho de flujo ocurrió |
| **ActivityItem** | `utils/activityProjection.ts` | proyección legible para la UI |

Ejemplo: Audit `REVIEW_DECISION_EDITED` (Pendiente→Confirmado, Ximena, 10:42) ·
DomainEvent `FINDING_CONFIRMED` · Activity "Hallazgo confirmado por Ximena · 10:42".

### Entidades nuevas / extendidas

| Concepto | Tipo | Reglas |
|---|---|---|
| `ActorRef` | `types/actor.ts` | id + nombre + rol; hoy desde `personaStore.getActor` |
| `AuditRecord` | `types/audit.ts` | append-only; `utils/auditStore` |
| `ContactEntry` (ext.) | `types/fulfillment.ts` | método · con quién · resultado · actor; no asume éxito; conserva intentos |
| `ScheduleChange` | `types/fulfillment.ts` | reprogramación con fecha/hora + motivo; preserva la previa |
| `MedicationDelivery` + `ReceiptEvidence` | `types/fulfillment.ts` | quién recibió + evidencia (placeholder); persistencia-ready |
| `MedicationAdministration` | `types/administration.ts` | resultado/tiempos/actor; `administrationStore` + `administrationService` |
| `PreparationPolicy` | `config/preparationPolicy.ts` | segregación de funciones configurable |
| `LotAuditEntry` (ext.) | `types/traceability.ts` | + motivo de cambio, cantidad, rol |
| `WorkItem` (ext.) | `types/work.ts` | + owner (handoff), dueMinutes, blockerReason, escalationState, signals |
| `CoordinatorOverride` | `utils/coordinatorStore.ts` | asignación/escalamiento/prioridad/nota (overlay, no duplica dominio) |
| `PrioritizedItem` | `utils/priorityQueue.ts` | score determinista + nivel + razones explicables |

### Handoffs (ownership de bloqueos)

`utils/workItems.ts` enruta cada bloqueo al rol RESPONSABLE, no siempre a Central
de Mezclas: revisión clínica / datos clínicos → **QF Clínico**; autorización /
acceso → **Farmacia / Dispensación**; datos de preparación → **Central de Mezclas**.
Central de Mezclas ve un item "en espera" (`Bloqueada — esperando: …`) que no debe
resolver. La resolución del bloqueo por su dueño reevalúa el readiness de la
preparación (no se duplica estado).

### Separación de responsabilidades (personas)

QF Clínico (revisión + seguimiento) · **Farmacia / Dispensación** (cumplimiento,
contacto, disponibilidad, entrega) · Central de Mezclas (preparación/lote/
verificación/liberación según política) · Enfermería (administración) ·
**Coordinador** (cola de prioridad, asignación, escalamiento — sin ejecutar
trabajo clínico) · Administrador institucional (configuración).

### Mapeo HL7/FHIR (intención, no forzado; sin FHIR crudo como fuente de verdad)

| Kumpels | FHIR |
|---|---|
| `MedicationAdministration` | `MedicationAdministration` (subject · performer · effectivePeriod · status · dosage.route/dose · statusReason) |
| `MedicationDelivery` / `ReceiptEvidence` | `MedicationDispense` (whenHandedOver, receiver) + `Provenance` |
| `ContactEntry` | `Communication` / `Provenance` |
| `ScheduleChange` | `Task.restriction` / `Provenance` (reprogramación) |
| `AuditRecord` | `AuditEvent` / `Provenance` |
| `ActorRef` | `Practitioner` + `PractitionerRole` |
| `PreparationPolicy` | gobernanza nativa (sin equivalente FHIR directo) |
| `WorkItem` / handoff | `Task` (`owner`, `businessStatus`, `for`) |

### Regla de cierre del pendiente (§8)

Un pendiente no se marca completo mientras el contacto sea incoherente. Se resuelve
por **entrega** (registra quién recibió — vía válida) o por la vía explícita
**"resolver sin contacto"** con motivo obligatorio. `contactSettled` distingue
ambos estados; el caso de Diana (ONC-2002) ya no se cierra a ciegas.

### Deuda diferida añadida

- `AdministrationRepository`/`CoordinatorRepository` in-memory (sin BD real).
- Firma electrónica / OTP reales (hoy `ReceiptEvidence` es placeholder).
- Cola de prioridad usa un "ahora" demo (12:02) para el SLA reproducible.

---

## Responsabilidad, autorización y elegibilidad (TASK 18.2)

Un flujo nunca avanza solo porque "existe otro usuario". Antes de permitir una
acción se determina: quién es responsable, quién es elegible, si tiene la
capacidad, si está en el alcance correcto, si la política lo permite, si el
trabajo fue asignado y aceptado, y si la transición es trazable.

### A. User vs Practitioner
`AdminUser` (types/admin) es el profesional/Practitioner: identidad estable con
nombre, correo, rol, equipo, alcance, estado y capacidades. La sesión demo elige
un USUARIO ("Ver como"); su rol determina el WorkspaceProfile. Un mismo
Practitioner puede tener distintos contextos de rol sin duplicar la persona
(arquitectura PractitionerRole-like).

### B. Role ≠ Capability ≠ Scope ≠ Workspace
- **Role** (`DemoPersona`): responsabilidad; agrupa capacidades por defecto.
- **Capability** (`config/capabilities`): permiso atómico de acción (CLINICAL_REVIEW,
  STERILE_PREPARATION_VERIFY, MEDICATION_FULFILLMENT, WORK_ASSIGN…).
- **Scope** (`Scope`): sedes + programas a los que aplica el acceso.
- **WorkspaceProfile**: configuración de UI (nav/secciones/acciones), no autoriza.

### C. Ciclo de vida de responsabilidad del WorkItem
`types/assignment.ts` (overlay en `utils/coordinatorStore`, no duplica el dominio):
`unassigned → assigned → acknowledged → in-progress → completed`, más
`reassigned`, `escalated`, `cancelled` y transferencia de turno. Historia
append-only: cada cambio agrega una entrada; nunca se sobreescribe. El trabajo
automático de fondo no requiere acuse; el trabajo humano delegado sí ("Tomar tarea").

### D. Orden de evaluación de elegibilidad (`utils/eligibility`)
activo → capacidad → sede → programa → **segregación de funciones** → exclusión
puntual. Centralizado; no se decide con `if role === …`. `eligibleUsers(ctx)`
lista los candidatos; `hasEligibleUser(ctx)` detecta callejones sin salida.

### E. La segregación de funciones supera al rol
El rol/capacidad no garantiza elegibilidad: la política de flujo se evalúa al
final. Ej.: Andrés tiene STERILE_PREPARATION_VERIFY pero preparó PREP-3301 →
`preparerCannotVerifyOwnWork` ⇒ DENY para esa instancia; Laura Gómez (mismo
alcance, no preparó) ⇒ ELIGIBLE. Si NO existe verificador elegible, se crea un
bloqueo operativo explícito ("Sin profesional elegible para verificación") y se
escala al Coordinador; nunca se omite la política.

### F/G/H. Mapeo HL7/FHIR (intención; sin FHIR crudo como fuente de verdad)

| Kumpels | FHIR |
|---|---|
| `AdminUser` (profesional) | `Practitioner` |
| rol + alcance (contexto) | `PractitionerRole` (code, organization, location) |
| `Organization` / `Facility` | `Organization` / `Location` |
| `WorkItem` + `Assignment` | `Task` (status, intent, for, focus, authoredOn, lastModified, requester, owner, restriction, executionPeriod, reasonCode, businessStatus) |
| `Capability` / política | nativo (gobernanza) — se relaciona con `PractitionerRole` para autorización futura |
| `AuditRecord` | `AuditEvent` / `Provenance` |
| asignación/acuse/reasignación/transferencia | `Provenance` (agentes, roles, momento, razón) |

Mapeo de estado Assignment → `Task.status`: unassigned→requested/ready,
assigned→received, acknowledged→accepted, in-progress→in-progress,
completed→completed, cancelled→cancelled, reassigned→(nuevo owner + Provenance).
Los WorkItems puramente técnicos NO se fuerzan a `Task`.

### I. Transferencia de responsabilidad
Transferencia ligera lista para cambios de turno: responsable actual → usuario
elegible → acuse del nuevo. Conserva previo/nuevo, razón, fecha/hora y estado.
Si una tarea crítica queda sin responsable activo, aflora en la Cola de Prioridad
del Coordinador (escalada). No hay planificador de turnos ni motor de
notificaciones todavía.

### Eventos añadidos
`WORKITEM_ACKNOWLEDGED`, `WORKITEM_STARTED`, `WORKITEM_REASSIGNED`,
`RESPONSIBILITY_TRANSFERRED`, `VERIFICATION_WORK_CREATED`, `VERIFICATION_ASSIGNED`,
`VERIFICATION_COMPLETED` (además de los WORKITEM_ASSIGNED/ESCALATED/PRIORITIZED de
TASK 18). Audit ≠ DomainEvent ≠ ActivityItem se mantienen distintos.

### Deuda diferida (nueva)
IAM/SSO/SCIM/LDAP empresarial, matriz de permisos UI, planificador de turnos,
motor de notificaciones, proveedor de identidad externo — fuera de alcance.

---

## Excepciones del ciclo de vida de medicación (TASK 19 · Parte 1)

Registros clínicamente relevantes nunca se sobreescriben en silencio; el trabajo
aguas abajo de un cambio se evalúa de forma determinista; Enfermería es la barrera
final. Todas las acciones sensibles validan elegibilidad (rol + capacidad +
alcance + política) y producen AuditRecord ≠ DomainEvent ≠ ActivityItem.

### 19.1 Correcciones controladas (append-only)
`CorrectionRecord` (`types/correction`, `utils/correctionStore`): conserva
previo→corregido, actor, motivo, momento, tipo (DATA_CORRECTION / AMENDMENT /
ENTERED_IN_ERROR). En administración: "Registrar corrección" (no "Editar");
ENTERED_IN_ERROR marca `enteredInError` (FHIR status = entered-in-error) sin
borrar el original. Capacidad `MEDICATION_ADMINISTRATION_CORRECT` (Enfermería;
ser administrador no basta). `ProfessionalReview` ya cumplía el patrón append-only
(historial en reviewStore). Evento `MEDICATION_ADMINISTRATION_CORRECTED`.

### 19.2 Bloqueo y reemplazo de preparaciones verificadas/liberadas
Verificada o liberada ⇒ inmutable (sin edición de lotes/parámetros). Un cambio
clínico usa reemplazo controlado: la anterior queda SUPERSEDED (marca) y se crea
una nueva (`supersede()` en preparationStore) que la reemplaza. `PreparationReplacement`
guarda oldId/newId/reason/sourceChange/actor/fecha. La genealogía lote/componente
de la anterior se conserva (alias de componentes). Capacidad `PREPARATION_REPLACE`
+ alcance de Mezclas. Evento `PREPARATION_REPLACED`. FHIR: relación replaces/basedOn
entre dos MedicationDispense/Task + Provenance.

### 19.3 Impacto de cambio de orden (DownstreamImpactService)
`OrderChange` (`types/orderChange`, `utils/orderChangeStore`) + `impactFor()`
(`utils/downstreamImpact`) evalúan determinísticamente prep/entrega/administración:
prep no iniciada → revisar/recrear; en curso → bloquear/revisar; liberada no
administrada → administración bloqueada + WorkItem; ya administrada → conservar
historia, la nueva orden rige el futuro. Banner "Afectado por cambio de tratamiento"
+ WorkItem enrutado por rol/capacidad/alcance. Capacidad `MEDICATION_ORDER_CHANGE`
(QF Clínico / Coordinador). Evento `MEDICATION_ORDER_CHANGED`. FHIR: MedicationRequest.status.

### 19.4 Rechazo de Enfermería (barrera final)
`NursingRejection`: RELEASED → REJECTED/HOLD (no "Cancelada"). Motivo estructurado
(`config/rejectionReasons`) enruta la resolución al equipo responsable
(etiqueta/integridad/conservación → Central de Mezclas; clínico/orden → QF Clínico;
horario/otro → Coordinación) vía elegibilidad. WorkItem "Resolver preparación
rechazada". Capacidad `MEDICATION_ADMINISTRATION`. Evento `PREPARATION_REJECTED_BY_NURSING`.

### 19.5 Administración parcial / interrumpida + remanente
`AdministrationResult`: administrada (completed) · parcial · detenida (stopped) ·
no-administrada (not-done); entered-in-error vía corrección. Distingue NO
ADMINISTRADA (nunca inició) de PARCIAL/DETENIDA (inició sin completar). Captura
planificado vs administrado vs remanente + `RemainderDisposition`
(RETURNED/DISCARDED/HELD_FOR_REVIEW/REUSABLE_PER_POLICY/DESTROYED/UNKNOWN/OTHER),
motivo estructurado, tiempos. NO genera evento adverso (tarea futura). FHIR
MedicationAdministration mapeable: subject/medication/request/performer/occurrence/
status/dosage/route/reason/note.

### Corrección de atribución (segregación de funciones)
Las acciones de preparación (preparar/verificar/liberar/lote) se atribuyen al
USUARIO ACTIVO (Practitioner), no al nombre estático del workspace — así la
segregación preparador≠verificador distingue correctamente (p. ej. Andrés prepara,
Laura Gómez verifica).

---

## Planeación de Enfermería y liberación a producción (TASK 20.1)

Enfermería es la **compuerta operativa**: confirma los tratamientos oncológicos
próximos y los **envía explícitamente** a Central de Mezclas. Central de Mezclas
**no** inicia producción solo porque exista una orden de medicación.

### Prescripción vs Solicitud de producción (dos conceptos distintos)
- `MedicationOrder` / `MedicationRequest` — orden CLÍNICA de un prescriptor
  autorizado. Enfermería **no** obtiene autoridad de prescripción.
- `ProductionRequest` (`types/production.ts`) — solicitud OPERATIVA a Central de
  Mezclas basada en una orden válida existente. Una por `preparationOrderId`. No
  copia el payload clínico: referencia paciente/episodio/orden/plan por id
  (`patientId`, `episodeId`, `medicationOrderId`, `therapyPlanId`,
  `preparationOrderId`, `scheduledTreatmentAt`, `requestedBy*`, `facility`,
  `program`, `status`, `note`). Historia de estado **append-only** (no se borra al
  cancelar).

### Estados (`ProductionRequestStatus`)
`DRAFT → READY_TO_SEND → SENT_TO_PRODUCTION → ACCEPTED_BY_COMPOUNDING`; `CANCELLED`
desde cualquier estado previo a producción (conserva historia).

### Compuerta de Central de Mezclas (gate)
`preparationStore.statusOf(inst, readiness, productionSent)`: una preparación con
readiness listo pero **no enviada** queda `bloqueada` con bloqueo explicable
"Pendiente de envío por Enfermería" (responsable: Enfermería · siguiente: Enviar a
producción). `iniciarPreparacion` re-evalúa el gate: **no** inicia si no está
enviada. La vista expone `productionGate` para el banner en el detalle de caso.
Producción puede iniciar solo cuando (A) `ProductionRequest` SENT/ACCEPTED **y**
(B) el readiness de preparación está satisfecho.

### Readiness de Enfermería (reutilizado, no duplicado)
`nursingPlanItems()` (`utils/nursingPlanning`) deriva "Pacientes próximos"
(Hoy/Mañana) reutilizando el readiness de preparación existente (orden válida,
programado, revisión clínica resuelta, datos basales, autorización, dosis, info de
preparación). No duplica "Medication Intelligence": muestra el **porqué** cuando no
está listo (revisión clínica pendiente, autorización no completada, dosis final no
confirmada, perfil basal pendiente).

### Handoff → Central de Mezclas
El envío deriva un WorkItem "Enviada a producción" (`sendItems()` en `utils/workItems`)
propiedad de Central de Mezclas (rol + equipo), con paciente/tratamiento/programado/
solicitante. Las preparaciones con `productionGate` se **excluyen** de la cola normal
de Mezclas (no son trabajo suyo aún) y se enrutan como trabajo de Enfermería
(capacidad `PRODUCTION_REQUEST_SEND`, visible también para Coordinación).

### Elegibilidad (no `role === "Enfermería"`)
Capacidades nuevas: `NURSING_TREATMENT_PLAN_VIEW`, `PRODUCTION_REQUEST_CREATE`,
`PRODUCTION_REQUEST_SEND`, `PRODUCTION_REQUEST_CANCEL`. Enviar/cancelar pasan por
`evaluateEligibility` (activo + capacidad); `productionService` es guardado. QF
Clínico también puede cancelar (`PRODUCTION_REQUEST_CANCEL`).

### Señales de demora (deterministas, sin motor de notificaciones)
En `priorityQueue`: `readyNotSent` ("Programado en N min y aún no enviado a
producción"), `sentNotAccepted` / `sentAgoMinutes` ("Enviada hace N min y Central de
Mezclas no la ha aceptado"). Coordinación ve no-enviados, enviados y cercanos al
horario en su cola de prioridad.

### Trazabilidad
Enviar/aceptar/cancelar emiten `DomainEvent` (`PRODUCTION_REQUEST_SENT` /
`_ACCEPTED` / `_CANCELLED`, dominio `production`) + `AuditRecord` + proyección de
`Activity` ("Tratamiento enviado a Central de Mezclas"), con fecha/hora exactas.
Cancelación exige motivo + actor + fecha/hora; no elimina.

### Mapeo HL7/FHIR (intención; sin FHIR crudo como fuente de verdad)

| Kumpels | FHIR |
|---|---|
| `ProductionRequest` | **`Task`** (operativo) — `Task.for` (paciente), `Task.focus` (MedicationRequest/preparación), `Task.requester` (PractitionerRole Enfermería), `Task.owner` (Central de Mezclas), `Task.businessStatus`, `authoredOn`. **No** se fuerza a `MedicationRequest`: es una solicitud operativa, no una prescripción. |
| `ProductionRequestStatus` | `Task.status` (draft→requested→in-progress/accepted; cancelled) + `businessStatus` |
| envío/aceptación/cancelación | `Provenance` + `AuditEvent` |
| tratamiento programado | `Appointment` / `Encounter` (contexto, referenciado por id) |

`ProductionRequest` permanece **nativo de Kumpels** (mapea a `Task`), separado de
la prescripción (`MedicationRequest`). No hay segunda fuente de verdad: referencia
las entidades canónicas por id.

---

## Propiedad y escalamiento de la solicitud de producción (TASK 20.1.1)

Cierra la brecha de propiedad Enfermería → Central de Mezclas → Coordinación. No
añade persistencia; reutiliza el overlay de asignación (TASK 18.2) y la
elegibilidad.

### Aceptación (acuse del handoff)
Nueva capacidad `PRODUCTION_REQUEST_ACCEPT` (rol Central de Mezclas). Un QF elegible
puede "Aceptar solicitud": `SENT_TO_PRODUCTION → ACCEPTED_BY_COMPOUNDING`. Captura
`acceptedBy` (id/nombre), `acceptedByRole`, fecha/hora exactas (`acceptedAt`/ISO),
facility/program (en la solicitud) y `acceptedAuto`. Emite `DomainEvent`
`PRODUCTION_REQUEST_ACCEPTED` + `AuditRecord` + proyección de `Activity`
("Solicitud de producción aceptada por … · fecha · hora"). El WorkItem de handoff
(`wi-sent-*`), si el Coordinador lo asignó, avanza `ASSIGNED → ACKNOWLEDGED →
IN_PROGRESS` (`utils/productionActions.acceptProductionRequest`).

### Aceptación automática al iniciar
Si un QF inicia la preparación mientras la solicitud sigue solo `SENT_TO_PRODUCTION`,
el flujo la acepta primero (`auto = true`) y luego inicia: **misma** historia de
auditoría/evento (motivo "Aceptación automática al iniciar preparación"). No se
salta la propiedad en silencio.

### Acciones del Coordinador (sin ejecutar la acción clínica)
- **Listo pero no enviado (retraso de Enfermería):** asignar/reasignar el WorkItem
  de Enfermería (`PRODUCTION_REQUEST_SEND`, solo elegibles), escalar, prioridad con
  motivo, `dueAt`, nota.
- **Enviado pero no aceptado (retraso de Central de Mezclas):** asignar/reasignar a
  un usuario **elegible** de Central de Mezclas (`PRODUCTION_REQUEST_ACCEPT` +
  alcance de Mezclas), escalar, prioridad con motivo, `dueAt`, nota.
El Coordinador **no** puede enviar ni aceptar sin la capacidad correspondiente en el
alcance correcto: la cola solo ofrece gestión (asignación/escalamiento/prioridad),
nunca los botones de acción de otro rol.

### Visibilidad del asignado ("Asignado a ti")
El usuario asignado ve paciente, tratamiento, prioridad, vencimiento, quién asignó,
cuándo, instrucción y la próxima acción: "Enviar a producción" (Enfermería) o
"Aceptar solicitud" / "Abrir preparación" (Central de Mezclas).

### Señales de demora (deterministas)
Se conservan: `readyNotSent` (retraso de Enfermería) y `sentNotAccepted` /
`sentAgoMinutes` (retraso de Central de Mezclas), reflejadas en la cola de prioridad
del Coordinador. Sin motor de notificaciones.

### Trazabilidad — tres registros distintos
Toda asignación/reasignación/escalamiento/acuse/aceptación conserva quién, rol,
fecha/hora, estado/propietario anterior→nuevo, motivo, paciente, ProductionRequest y
WorkItem. `AuditRecord` (registro legal append-only) ≠ `DomainEvent` (hecho de
integración) ≠ `ActivityItem` (proyección legible).

### HL7/FHIR
`ProductionRequest` sigue siendo nativo (mapea a `Task` operativo; aceptación →
`Task.status = accepted`/`in-progress` + `Provenance`/`AuditEvent`). No se convierte
en `MedicationRequest`. Nurse/QF → `Practitioner`/`PractitionerRole`; paciente →
`Patient`; orden clínica → `MedicationRequest`.

---

## Modelo de preparación multi-componente e identidad final (TASK 20.2A)

Representa una preparación oncológica hecha de VARIOS medicamentos/componentes
fuente que convergen en UNA preparación final con identidad estable.

### Lote fuente ≠ lote de preparación final (conceptos distintos)
- `BatchLot` = lote fuente/fabricante de un producto/presentación. No se reutiliza
  para la mezcla final.
- `PreparationBatch` (`types/traceability`) = lote de la MEZCLA COMPUESTA final
  cuando el flujo institucional lo requiere: `id`, `preparationId`, `batchNumber`
  (p. ej. CMP-20260915-004), `createdAt`, `createdBy`, `facilityId`, `status`
  (`preparado`/`liberado`/`reemplazado`/`anulado`), `beyondUseAt`, `expirationAt`,
  `version`. Configurable vía `PREPARATION_POLICY.requireCompoundingBatch`.

### Múltiples componentes y múltiples lotes por componente
`ComponentUsage` referencia `medicationConceptId` + `presentationId` + `lotId` +
`quantityUsed`/`unit` + `componentType` + `recordedBy`/`recordedAt` (no solo texto
libre del medicamento). Una `PreparationInstance` admite VARIOS ComponentUsage.
Un mismo componente puede usar VARIOS lotes (p. ej. Carboplatino: CBP77 450 mg +
CBP80 150 mg) → varias `LotAllocation` y varios ComponentUsage al finalizar.
No se asume un medicamento = un lote.

### Identidad de la preparación final
Cada `PreparationInstance`/orden tiene un id estable único (p. ej. `PREP-3303`), NO
derivado del nombre del paciente. Opcionalmente lleva un lote de mezcla final
(`PreparationBatch`) según la política institucional.

### Validación de lotes (reutilizada)
Un lote no se puede asignar si está en cuarentena, bloqueado, vencido o retirado
(solo `disponible` es utilizable). Sin análisis de impacto retrospectivo.

### Bloqueo tras verificación (TASK 19)
Verificada o liberada ⇒ inmutable: no se editan directamente componentes, lotes
fuente, cantidades ni la identidad de la preparación final. Cambio = reemplazo
controlado.

### Reemplazos
`PREP-3303-R1` que reemplaza a `PREP-3303` tiene su PROPIA `PreparationInstance`,
sus propios `ComponentUsage`, su propia genealogía de lotes fuente y su propio lote
de mezcla final. `aliasOrder` comparte solo la PLANTILLA del plan (componentes
requeridos), nunca la genealogía física.

### Autorización
Seleccionar/añadir/cambiar/quitar lotes y confirmar el lote de mezcla final
requieren elegibilidad de Central de Mezclas (Rol + Capacidad `STERILE_PREPARATION`
+ Sede + Programa + alcance + política), evaluada en `traceabilityService`. No basta
con poder ver el caso.

### Mapeo HL7/FHIR (intención; sin FHIR crudo como fuente de verdad)

| Kumpels | FHIR |
|---|---|
| `ProductPresentation` (`medicationConceptId`) | `Medication` |
| `BatchLot` (lote fuente) | `Medication.batch` |
| `ComponentUsage` | ingrediente / `MedicationDispense` compuesto (nativo) |
| `PreparationBatch` (mezcla final) | propio de Kumpels (relación con `MedicationDispense`/`Task` del producto compuesto + `Provenance`) |
| `MedicationOrder` | `MedicationRequest` |
| profesional | `Practitioner`/`PractitionerRole` |
| selección/uso/confirmación de lote | `Provenance`/`AuditEvent` |

`PreparationInstance`, `ComponentUsage` y `PreparationBatch` permanecen nativos de
Kumpels. Eventos nuevos: `LOT_ADDED`, `LOT_REMOVED`, `PREPARATION_BATCH_CONFIRMED`.

---

## Genealogía compuesta bidireccional y trazabilidad (TASK 20.2B)

Hace la genealogía de la preparación multi-componente trazable en AMBOS sentidos,
sin duplicar la fuente (mismos selectores canónicos).

### Hacia adelante (desde un lote fuente)
`getLotTrace(lotId)` reconstruye producto → `BatchLot` → `ComponentUsage`/selección
→ preparación → `PreparationBatch` (mezcla final) → paciente. `LotTraceEntry` gana
`finalBatch` y `presentationLabel`. La vista de lote (`LotDetail`) muestra por cada
preparación: paciente, orden, cantidad, estado y lote de mezcla final.

### Hacia atrás (desde paciente/preparación)
`getPreparationTrace(orderId)` devuelve los componentes (cada uno con sus lotes
fuente y cantidades) + el lote de mezcla final. Todo lote fuente permanece visible,
incluidos los componentes multi-lote.

### UI de trazabilidad
Árbol de genealogía compuesta (`TraceTree`): Preparación final (id + lote de mezcla)
→ Componentes (producto → lote(s) fuente con cantidad/vencimiento/estado) → Paciente.
Legible, no un panel de inventario.

### Actual vs historial
El caso de preparación queda conciso (árbol + resumen). El detalle completo vive en
un drawer "Ver trazabilidad completa" (`TraceabilityDrawer`): cadena, firmas y
tiempos (preparado/verificado/liberado por + fecha/hora, lote de mezcla, beyond-use)
e historial append-only de lotes/componentes (acción, previo→nuevo, cantidad, actor,
rol, fecha/hora, motivo). Sin nueva pestaña de Patient 360.

### Patient 360
Resumen conciso "Trazabilidad completa" (preparación, lote de mezcla, nº de
componentes) + botón "Ver trazabilidad" que abre el drawer in situ. No se muestra la
genealogía de lotes completa directamente en Patient 360.

### HL7/FHIR
Genealogía nativa de Kumpels; referencias mapeables a `Patient`, `MedicationRequest`,
`Medication`(+`.batch`), `MedicationAdministration`, `Practitioner`/`PractitionerRole`,
`Task`, `Provenance`/`AuditEvent`. No se fuerza la genealogía a un único recurso FHIR.

---

## Journey horizontal del episodio y próximo responsable (TASK 20.3A)

El Journey deja de ser un directorio de pacientes: representa la PROGRESIÓN
OPERATIVA de un episodio (dónde está, qué pasó, qué ocurre ahora, quién es el
responsable actual, qué sigue y quién lo recibe). Es una PROYECCIÓN del estado de
los dominios, no una segunda base de datos de flujo.

### Conceptos distintos (no se fusionan)
`Patient` (persona longitudinal) ≠ `Episode` (contexto de atención actual) ≠
`Journey` (progresión legible del episodio).

### Modelo de etapa (`types/journeyStage`)
`DerivedStage`: id, journeyId, type, label, `status`, startedAt/completedAt,
`owner` (rol/equipo/usuario + `assignment`), nextAction, `blocker`
(label/responsible/since/nextAction), sourceEntityType/sourceEntityId, dueAt.
`StageStatus`: PENDING · ACTIVE · COMPLETED · BLOCKED · SKIPPED · CANCELLED.
`EpisodeJourney`: stages + currentStage/currentOwner + nextStage/nextOwner +
nextAction + blocked. Nativo de Kumpels (proyección).

### Etapas DERIVADAS (sin flujo duplicado)
`utils/episodeJourney.deriveEpisodeJourney` proyecta: Revisión clínica ←
ProfessionalReview; Enfermería/readiness ← ProductionRequest readiness/gate;
Enviado a producción ← ProductionRequest; Preparación/Verificación/Liberación ←
PreparationInstance; Administración ← MedicationAdministration; Seguimiento ←
PharmaceuticalCare/FollowUp; Dispensación ← Fulfillment. No crea registros nuevos.

### Definiciones configurables (`config/journeys`)
`JOURNEY_DEFS` por tipo (para Solution Packs):
- **oncology-iv** (9): Programado → Revisión clínica → Enfermería/readiness →
  Enviado a producción → Preparación → Verificación → Liberación → Administración →
  Seguimiento.
- **oral** (4): Tratamiento activo → Dispensación/acceso → Seguimiento
  farmacoterapéutico → Próximo seguimiento (sin Central de Mezclas/verificación/
  liberación).
- **fulfillment** (6): Orden → Disponibilidad → Dispensación → Contacto → Entrega →
  Completo (el "pendiente" reutiliza el estado de cumplimiento, no se inventa).
Selección de tipo: con orden de preparación → oncology-iv; modalidad Oral → oral;
con pendiente de cumplimiento → fulfillment.

### Responsable actual y siguiente (vía WorkItems)
La propiedad se deriva de los WorkItems + su ciclo de asignación (misma fuente que
"Hoy"), NO de un sistema paralelo: `UNASSIGNED/ASSIGNED/ACKNOWLEDGED/IN_PROGRESS/
COMPLETED`. Si hay usuario asignado se muestra ("Laura Gómez · QF Central de
Mezclas"); si no, el equipo + "Sin asignar". El siguiente propietario es el equipo
de la etapa siguiente (quién recibe el proceso). La `nextAction` proviene del mismo
WorkItem que alimenta Hoy (sin acciones contradictorias).

### Etapa bloqueada
Una etapa actual bloqueada muestra motivo, responsable (rol/equipo), desde cuándo y
próxima acción — nunca aparece como simplemente "inactiva".

### Autorización
La visualización del Journey NO otorga permiso: las acciones abiertas desde el
Journey siguen evaluando Rol + Capacidad + Sede + Programa + alcance + política.

### HL7/FHIR
Journey/JourneyStage nativos (proyección). Referencias mapeables a Patient,
EpisodeOfCare, MedicationRequest, Task, MedicationAdministration, Practitioner/
PractitionerRole, Appointment/Encounter, AuditEvent/Provenance. No se fuerza el
Journey a `CarePlan`. Los eventos/auditoría siguen a nivel de dominio de origen (el
Journey no emite eventos "de etapa" falsos).

---

## UI horizontal del Journey, visibilidad de retraso y handoff (TASK 20.3B)

Presentación operativa sobre la proyección de 20.3A (`deriveEpisodeJourney`); sin
cambiar los flujos clínicos ni duplicar entidades.

### Timeline horizontal + estados visuales
Stepper horizontal (`JourneyStepper`): estados distinguidos por ÍCONO + etiqueta +
énfasis (no solo color): COMPLETED (check) · ACTIVE (punto lleno + anillo) · PENDING
(anillo) · BLOCKED (! con énfasis fuerte, rojo reservado a bloqueos activos) ·
SKIPPED (tachado). En pantallas angostas hace scroll horizontal; la columna
actual/siguiente se apila.

### Retraso determinista + propietario del retraso
`EpisodeJourney.delay` (de dueAt/SLA/señales del WorkItem, sin scoring predictivo):
"Retrasada N min", "Vence en N min", "Esperando aceptación hace N min",
"Administración pendiente". Incluye el EQUIPO que posee el retraso (no un usuario,
salvo asignación) + motivo (p. ej. "Solicitud enviada hace 31 min sin aceptación";
"Preparación liberada; administración aún no iniciada").

### Handoff actual
`EpisodeJourney.handoff` (de ProductionRequest): "Enviado por · Enfermería · 10:12",
"Aceptado por · Laura Gómez · 10:18". El detalle completo sigue en "Ver historial"
(actividad/auditoría existente), no se convierte en log.

### Trabajo sin responsable
Cuando la etapa actual requiere acción y no tiene responsable asignado, se muestra
"Sin responsable asignado" con énfasis y un botón que navega al flujo de asignación
del Coordinador EXISTENTE (Hoy) — no hay un segundo modal de asignación.

### Vista según persona (misma data)
`EpisodeJourneyView` resalta las etapas relevantes por persona (Coordinador:
propiedad/retraso/sin asignar/SLA; QF Clínico: revisión/bloqueos clínicos; Central de
Mezclas: producción/verificación/liberación; Enfermería: readiness/envío/
administración; Farmacia: cumplimiento/acceso/entrega). No hay data de journey por
rol: es la misma proyección con distinto énfasis.

### Acciones (orquestación, no duplicación)
Desde la etapa actual se navega al flujo EXISTENTE (revisión clínica, envío a
producción, preparación, administración) usando el `href` del WorkItem. El Journey
orquesta la navegación; no reconstruye los flujos.

### Consistencia con Patient 360
Patient 360 y la página de Journeys renderizan la MISMA proyección
(`deriveEpisodeJourney` vía `EpisodeJourneyView`): coinciden en etapa actual, próxima
acción, responsable y bloqueo (validado). No se calculan valores distintos por página.

### HL7/FHIR
Sin nuevos recursos FHIR (tarea de UI). Journey/JourneyStage siguen nativos;
referencias alineadas con EpisodeOfCare, Task, MedicationRequest,
MedicationAdministration, PractitionerRole, Appointment/Encounter, Provenance.

---

## Tablero de planeación de Enfermería (TASK 20.4A)

Vista operativa de pacientes oncológicos próximos: quién viene hoy/mañana, a qué
hora, qué tratamiento, si está listo, qué lo bloquea, si se envió a Central de
Mezclas y qué debe hacer Enfermería.

### Proyección (no fuente de verdad)
`ScheduledTreatmentView` (`utils/scheduledTreatments`) DERIVA de Paciente +
Orden/Instancia de preparación + `ProductionRequest` + `MedicationAdministration` +
Journey (`deriveEpisodeLourney`) + WorkItems. No es un calendario nuevo ni duplica
estado; las etiquetas son proyecciones del estado de dominio/Journey.

### Orden cronológico + buckets
Ordenado por hora (Hoy antes que Mañana; luego por minutos). Buckets:
`overdue` (atrasada) · `soon` (próxima, ≤60 min) · `today` (más tarde hoy) ·
`tomorrow` (mañana). Sin drag-and-drop.

### Readiness (proyección de estado)
`LISTO · BLOQUEADO · ENVIADO_A_PRODUCCION · EN_PRODUCCION · LISTO_PARA_ADMINISTRAR ·
ADMINISTRADO` — derivadas de estado de preparación + ProductionRequest +
administración. No es un modelo de estado separado.

### Contexto de producción (granular)
`Pendiente de envío · Enviada a producción · Aceptada por Mezclas · En preparación ·
Pendiente de verificación · Verificada · Liberada` — de `ProductionRequest` + estado
de preparación (sin duplicar).

### Bloqueos + propietario actual/siguiente
Un tratamiento no listo muestra motivo + responsable (rol/equipo). El propietario
actual/siguiente y la próxima acción se toman del Journey (misma proyección que
Journeys/Patient 360), no se recalculan aquí.

### Acciones de Enfermería (elegibilidad)
Solo se muestran acciones que Enfermería puede ejecutar según capacidad:
[Enviar a producción] (`PRODUCTION_REQUEST_SEND` + productionGate), [Registrar
administración] (`MEDICATION_ADMINISTRATION` + liberada), [Abrir paciente]. No se
muestran verificar/liberar/revisión clínica salvo capacidad adicional. Reutiliza los
servicios existentes (no reconstruye flujos).

### Listo para administrar (visibilidad, sin push)
Cuando Central de Mezclas libera, el tablero refleja "Listo para administrar" con id
de preparación, liberado por/cuándo y hora de administración. Solo visibilidad de
workspace.

### Alcance (Role + Capability + Facility + Program + Scope)
El tablero filtra por el alcance (sede) del usuario: una enfermera solo ve pacientes
de su sede/programa. Reutiliza la arquitectura de elegibilidad.

### HL7/FHIR
`ScheduledTreatmentView` / tablero son NATIVOS de Kumpels (proyección). Referencias
mapeables a Patient, Appointment/Encounter (programación), MedicationRequest,
Practitioner/PractitionerRole, Task (producción), MedicationAdministration. No se
fuerza el tablero a FHIR.

---

## Retraso, propiedad y escalamiento (TASK 20.4B)

Detecta y expone de forma DETERMINISTA cuándo el journey se está retrasando y quién
posee la próxima acción. El retraso es estado DERIVADO (no un score predictivo, no un
recurso FHIR, no eventos por minuto).

### DelaySignal (proyección, fuente única)
`utils/delaySignals.DelaySignal` — `sourceEntityType/Id`, `patientId`, `journeyId`,
`stageId/Label`, `severity`, `reason`, `ownerRole/Team/UserId/Label/Assignment`,
`workItemId`, `startedAt`, `dueAt`, `minutesLate`, `nextAction`, `assignedNotAcked`,
`noAssignee`, `waitingForNext`, `notificationLabel`. `deriveDelaySignal(patient)`
REUTILIZA `deriveEpisodeJourney` (etapa/propietario/motivo) y añade severidad,
minutos y estado del ciclo de asignación — no recalcula el motivo/propietario.
`listDelaySignals(user, ownerRole?)` filtra por alcance y rol.

### Severidad (operativa, no clínica)
`ON_TIME · ATTENTION · LATE · CRITICAL` (de `minutesLate` + bloqueo + sin-asignar +
sin-acuse). Prioridad y retraso se relacionan pero no son idénticos.

### Reglas deterministas
- Programado pronto + Enfermería no envió → retraso de Enfermería.
- Enviado + Central de Mezclas no aceptó → retraso de Central de Mezclas.
- Preparación finalizada + verificación pendiente demasiado → retraso de verificación.
- Liberada + administración próxima/pasada + Enfermería no inició → retraso de
  Enfermería (`waitingForNext`).
- WorkItem crítico asignado sin acuse → "Asignada, pendiente de aceptación" (`assignedNotAcked`).
- Trabajo crítico sin asignado → "Sin responsable asignado" (`noAssignee`).

### Propiedad (sin culpar a un individuo)
Si hay usuario asignado, se muestra la persona + equipo; si es solo del equipo,
`ownerLabel` = equipo + "Sin asignar". Nunca se atribuye a una persona un trabajo
solo asignado al equipo.

### Integración (misma fuente, presentación por rol)
- **Journey** (`EpisodeJourneyView`): indicador conciso en la etapa actual
  (severidad + responsable + "Esperando a …").
- **Nursing Planning** (`NursingPlanningBoard`): "RETRASADA N MIN" solo para retrasos
  de Enfermería (no muestra retrasos de otros roles como acción de Enfermería).
- **Coordinador** (`CoordinatorDelays` en Hoy): journeys demorados, con Ver Journey /
  Asignar/Reasignar / Escalar (reutiliza las acciones existentes del Coordinador).
El CÁLCULO es único (`deriveDelaySignal`); cada workspace filtra por `ownerRole`.

### Escalamiento / auditoría
El escalamiento reutiliza `services.coordinator.escalate` (AuditRecord + DomainEvent
`WORKITEM_ESCALATED`). El retraso en sí NO emite eventos repetitivos ("sigue
retrasada al minuto 18"); solo escalamiento/reasignación/acuse/resolución generan
registros.

### Resolución automática
Cuando ocurre la acción del dominio responsable (p. ej. Enfermería administra), la
etapa avanza y `deriveDelaySignal` deja de devolver la señal — el retraso desaparece
sin intervención manual del Coordinador.

### Preparado para notificación (TASK 20.6)
`DelaySignal.notificationLabel` ("Laura Martínez — Administración · retraso 18 min")
permite proyectar señales seleccionadas a la campana más adelante. Sin UI de
notificación en esta tarea.

### HL7/FHIR
`DelaySignal` nativo de Kumpels; sin recurso "Delay" FHIR. Referencias mapeables
(WorkItem→Task, Patient, EpisodeOfCare, Appointment/Encounter,
MedicationAdministration, Practitioner/PractitionerRole).

## Comunicaciones y seguimiento al paciente (TASK 20.5)

Modelo canónico de comunicación como **fuente de verdad** (no objetos React). Base
para WhatsApp Business futuro sin rediseñar el dominio.

### Entidades (`types/communication`)
- **CommunicationThread**: hilo por paciente (`status`: active / pending-response /
  needs-attention / resolved; `unreadCount`, `assignedUserId/Name`).
- **CommunicationMessage**: mensaje inmutable (`direction` inbound/outbound,
  `channel` WHATSAPP_SIMULATED, `messageType`, `content`, `senderType/Id/Name/Role`,
  `deliveryStatus` + `statusHistory[]`, referencias `relatedMedicationOrderId` /
  `relatedFollowUpId` / `relatedQuestionnaireId` / `relatedReportId`, `attachment?`,
  `options?`). Historia cronológica inmutable: se agregan mensajes, nunca se editan.
- **CommunicationRequest**: seguimiento programado (`status` Programado / Enviado /
  Cancelado). "Programado" es una intención, no ejecución en background.
- **MessageTemplate**: plantilla revisable antes de enviar (`requiresMedication?`,
  `options?`). No hay mensajería clínica automática.
- **PatientReportedData**: dato reportado por el paciente
  (`ADHERENCE`/`SYMPTOM`/`PAIN_SCORE`/`INTERRUPTION`) con `rawText` preservado.
- **AttentionSignal**: señal de atención derivada (`severity` NONE/ATTENTION/HIGH,
  `ownerRole`, `sourceLabel` "Reportado por el paciente vía WhatsApp", `workItemId?`).

### Ciclo de vida del mensaje
`DRAFT → QUEUED → SENT → DELIVERED → READ` (saliente) · `RECEIVED` (entrante) ·
`FAILED` → estado "No enviado" + "Reintentar". Tipos: TEXT, MEDICATION_REMINDER,
ADHERENCE_CHECK, SYMPTOM_CHECK, PAIN_CHECK, EDUCATION, DOCUMENT, FOLLOWUP_REQUEST.

### Reglas de interpretación (`utils/responseRules`)
Determinísticas, sin auto-diagnóstico. `interpretResponse(questionType, text)`:
- Adherencia: sí → NONE · parcial → ATTENTION · no → ATTENTION.
- Síntoma: negación → NONE · afirmación → ATTENTION (conserva texto literal).
- Dolor: parse 0–10; `≥ PAIN_ATTENTION_THRESHOLD` (7) → ATTENTION.
- Interrupción de tratamiento (sí / suspendí / dejé) → HIGH.
El dato reportado se etiqueta como reportado por el paciente; NUNCA como evento
adverso / PRM confirmado / diagnóstico.

### Proyección a Atención Farmacéutica / Patient 360
Las respuestas con atención generan `AttentionSignal` (owner `qf-clinico`) que se
muestra en Patient 360 (`PatientReported`) bajo "Reportado por el paciente vía
WhatsApp", pendiente de revisión profesional. Las respuestas significativas derivan
un WorkItem (`workItems.communicationItems`, `requiredCapability`
PATIENT_FOLLOWUP_REVIEW) — sin QF hardcodeado; reutiliza el ciclo de asignación de
TASK 18.

### Auditoría ≠ Evento ≠ Actividad
Sin evento por mensaje. Solo respuestas significativas emiten:
`PATIENT_ADHERENCE_CONCERN_REPORTED`, `PATIENT_SYMPTOM_REPORTED`,
`PATIENT_PAIN_REPORTED`, `PATIENT_TREATMENT_INTERRUPTION_REPORTED`,
`FOLLOWUP_RESPONSE_REQUIRES_REVIEW` (+ AuditRecord).

### Autorización (privacidad / mínimo necesario)
Capacidades PATIENT_COMMUNICATION_VIEW / PATIENT_COMMUNICATION_SEND /
PATIENT_FOLLOWUP_REVIEW con rol + capacidad + facility + programa + scope. El
**Administrador institucional NO ve conversaciones clínicas** (admin ≠ autoridad
clínica). El composer no expone hallazgos internos ni cálculos de riesgo al paciente.

### HL7/FHIR (mapeable, no fuente de verdad)
CommunicationMessage → Communication; CommunicationRequest → CommunicationRequest;
plantilla estructurada → Questionnaire; respuesta del paciente →
QuestionnaireResponse; PatientReportedData → Observation (patient-reported);
attachment → DocumentReference. FHIR nunca es la fuente de verdad interna.
