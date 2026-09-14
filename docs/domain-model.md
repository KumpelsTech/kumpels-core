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
