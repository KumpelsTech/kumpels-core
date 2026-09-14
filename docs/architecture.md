# Kumpels Core — Arquitectura de capas y frontera de persistencia

Complementa `docs/domain-model.md` (entidades, relaciones y mapeo FHIR). Aquí se
describe el **flujo por capas** introducido en TASK 12.1 para que el frontend se
comporte como si consumiera un backend real, manteniendo la demo funcional.

## 1. Flujo

```
UI (React: pages/components)
  → application/services   (src/services/*)        acciones async + eventos + auditoría
    → domain               (src/utils/*, src/types/*) reglas puras (readiness, continuity, review…)
      → repositories       (src/repositories/types.ts) contratos de persistencia (async)
        → adaptador actual  (src/repositories/inMemory.ts) envuelve stores/datos demo
        → adaptador futuro  (API / base de datos)          — no implementado aún
```

Regla clave: **la UI ya no muta el dominio directamente**. Toda mutación pasa por
un servicio async. Los stores (`useSyncExternalStore`) siguen siendo el **read
model reactivo** (lectura/suscripción); sus funciones de mutación quedaron a nivel
de módulo únicamente para el adaptador de repositorio, no para los componentes.

## 2. Servicios (capa de aplicación)

| Servicio | Métodos (async) | Evento(s) emitido(s) |
|---|---|---|
| `clinicalReview` | `recordDecision(findingId, review)` | `CLINICAL_REVIEW_COMPLETED` |
| `pharmaceuticalCare` | `completeAssessment(patientId, a)` | `FOLLOWUP_COMPLETED` |
| `fulfillment` | `registerContact`, `updateAvailability`, `resolvePending` | `PATIENT_CONTACTED`, `MEDICATION_AVAILABILITY_UPDATED`, `MEDICATION_PENDING_RESOLVED` |
| `preparation` | `start`, `complete`, `verify`, `release` | `PREPARATION_STARTED/COMPLETED/VERIFIED/RELEASED` |
| `traceability` | `selectLot(orderId, componentKey, lotId, actor)` | `LOT_SELECTED` |

Composición e inyección en `src/services/index.ts` (`services.*`). Cambiar el
adaptador de repositorio es cambiar una sola línea de wiring.

`DISPENSE_PARTIAL` y `PENDING_CREATED` son estados de datos sembrados (no acciones
de usuario en el MVP); el tipo de evento existe para cuando esas acciones se creen.

## 3. Repositorios (frontera de persistencia)

Interfaces en `src/repositories/types.ts`: `PatientRepository`,
`EpisodeRepository`, `MedicationOrderRepository`, `ValidationRepository`,
`FollowUpRepository`, `FulfillmentRepository`, `PreparationRepository`,
`TraceabilityRepository`. Todos async.

Adaptador vigente: **in-memory** (`src/repositories/inMemory.ts`), que delega en
los stores/datos demo actuales. Es el único punto que conoce el almacenamiento;
sin lógica específica de cliente.

## 4. Eventos y auditoría

- `src/services/eventBus.ts`: `emitEvent` / `getEventLog` + `auditNow`. Es el punto
  único de emisión; publica en el almacén append-only (ver "Event & Activity Layer").
- `src/types/provenance.ts`: `AuditMeta` (createdAt/updatedAt/createdBy/updatedBy/
  source/sourceSystem/version) y `StateTransition` (previousState/newState/actor/at/reason).
  Los servicios adjuntan `meta` y `transition` a cada evento de forma consistente.
- IDs estables: entidades creadas en runtime usan `src/utils/ids.ts` (`newId`),
  nunca índices de arreglo. `ContactEntry` y `LotAuditEntry` ahora llevan `id`;
  la dispensación restante usa `${orderId}-restante`.

## 5. Dominios que hoy usan adaptador mock

Todos: Revisión Clínica, Atención Farmacéutica, Cumplimiento/Pendientes,
Preparación estéril y Trazabilidad — sobre datos sintéticos en `src/data/`,
estado en memoria por sesión. Ningún dominio tiene persistencia real todavía.

## 6. Mapeo FHIR (resumen; detalle en domain-model.md)

Patient→Patient · Practitioner/PractitionerRole · Observation · MedicationRequest ·
MedicationDispense · MedicationAdministration · Task (WorkItem) · CarePlan/PlanDefinition ·
EpisodeOfCare · Medication.batch (BatchLot) · Provenance/AuditEvent (DomainEvent + eventBus).
Nativos (sin forzar): ValidationRun, Finding, WorkspaceProfile, genealogía de preparación,
continuity risk.

## 7. Frontera de integración futura (no implementada)

Para conectar un backend real:
1. Escribir un adaptador que implemente las interfaces de `repositories/types.ts`
   contra la API/BD (emitiendo IDs de servidor y `AuditMeta` reales).
2. Sustituir `inMemoryRepositories` por ese adaptador en `services/index.ts`.
3. Convertir el read model: los stores pasarían a hidratarse desde el repositorio
   (hoy leen datos demo). Servicios, eventos y UI no cambian.

No se implementa la base de datos en esta iteración.

---

# Event & Activity Layer (TASK 13)

## Flujo

```
Acción de dominio → Service → DomainEvent → EventRepository → Proyección → UI
```

- **Service**: emite el evento vía `services/eventBus.emitEvent` (nunca desde React).
- **DomainEvent** (`types/domainEvent.ts`): registro canónico, nativo de Kumpels.
- **EventRepository** (`repositories/types.ts` → adaptador `utils/eventStore.ts`):
  append-only, ids estables, orden preservado (`seq`), async. Sustituible por BD.
- **Proyección** (`utils/activityProjection.ts`): DomainEvent → ítem de actividad
  en español (título, resumen, ícono, énfasis). Las etiquetas de UI viven aquí,
  no en el modelo de dominio.
- **UI**: Patient 360 "Actividad reciente" (`RecentActivity`) se proyecta desde el
  EventRepository; no hay timeline handcrafted (se retiró `deriveRecentActivity`).

## Campos canónicos del DomainEvent

`id, type, occurredAt, seq, patientId, episodeId, actorId, actorRole, actorType,
sourceDomain, sourceEntityType, sourceEntityId, title, summary, metadata,
previousState, newState, reason, source, sourceSystem, version, correctsEventId`.
No todos los eventos llenan todos los campos.

## Taxonomía actual

`CLINICAL_REVIEW_CREATED/COMPLETED`, `FINDING_CONFIRMED/DISMISSED`,
`PHARMACEUTICAL_CARE_ENROLLED`, `INITIAL_ASSESSMENT_COMPLETED`, `FOLLOWUP_COMPLETED`,
`MEDICATION_ORDER_CREATED`, `DISPENSE_PARTIAL/COMPLETED`,
`MEDICATION_PENDING_CREATED`, `MEDICATION_AVAILABILITY_UPDATED`, `PATIENT_CONTACTED`,
`MEDICATION_PENDING_RESOLVED`, `PREPARATION_ORDER_CREATED`,
`PREPARATION_STARTED/COMPLETED/VERIFIED/RELEASED`, `LOT_SELECTED`,
`COMPONENT_USAGE_RECORDED`, `WORKITEM_CREATED/COMPLETED`.

## Eventos emitidos hoy por cada dominio

| Dominio | Servicio | Emite |
|---|---|---|
| Revisión Clínica | `clinicalReview.recordDecision` | `CLINICAL_REVIEW_COMPLETED` (+ `FINDING_CONFIRMED`/`FINDING_DISMISSED`) |
| Atención Farmacéutica | `pharmaceuticalCare.completeAssessment` | `FOLLOWUP_COMPLETED` / `INITIAL_ASSESSMENT_COMPLETED` |
| Cumplimiento | `fulfillment.*` | `PATIENT_CONTACTED`, `MEDICATION_AVAILABILITY_UPDATED`, `DISPENSE_COMPLETED` + `MEDICATION_PENDING_RESOLVED` |
| Preparación | `preparation.*` | `PREPARATION_STARTED/COMPLETED/VERIFIED/RELEASED` (+ `COMPONENT_USAGE_RECORDED`) |
| Trazabilidad | `traceability.selectLot` | `LOT_SELECTED` |

Baseline: `eventStore.ensureSeeded()` proyecta la historia existente (corridas de
validación, órdenes, dispensaciones, pendientes, preparaciones sembradas) a eventos
canónicos — no un dataset de timeline aparte. `MEDICATION_ORDER_CREATED`,
`DISPENSE_PARTIAL`, `MEDICATION_PENDING_CREATED`, `PREPARATION_ORDER_CREATED` y
`CLINICAL_REVIEW_CREATED` provienen del baseline; `WORKITEM_*` quedan definidos en la
taxonomía para uso futuro.

## Relaciones consultables

`EventRepository.query({ patientId | episodeId | sourceDomain | sourceEntityType |
sourceEntityId | types | since/until (seq) | limit })`, más helpers
`forPatient` y `forEntity`. Permite: todos los eventos de un paciente/episodio,
los de una preparación (`PreparationOrder`/`PreparationInstance` + id) o de un
pendiente (`MedicationFulfillment` + id), y por rango temporal (seq).

## DomainEvent vs Audit (distintos)

- **DomainEvent** = algo relevante ocurrió (negocio/clínico). Es la historia
  append-only del negocio.
- **Audit Record** = quién cambió qué, cuándo y cómo (`types/provenance.ts`:
  `AuditMeta`, `StateTransition`).
- Se referencian (el DomainEvent lleva `previousState/newState/actor/reason` para
  contexto) pero **no son el mismo objeto**. Ej.: DomainEvent `PREPARATION_RELEASED`
  ↔ Audit "usuario X cambió estado VERIFICADA → LIBERADA en T".

## Inmutabilidad

El almacén es append-only: `appendEvent` únicamente; sin update/delete. Una
corrección genera un evento nuevo (`correctsEventId` opcional) — el original se
conserva. Ej.: corregir un lote emite otro `LOT_SELECTED`.

## Alineación HL7/FHIR (documentada, no forzada)

El DomainEvent es un concepto **nativo de Kumpels**; no se fuerza a un único
recurso FHIR ni se guardan blobs FHIR como fuente de verdad.

- Provenance clínico/origen del dato → **FHIR Provenance**.
- Actividad de seguridad/acceso/auditoría → **FHIR AuditEvent**.
- Los eventos referencian entidades canónicas por id, que luego mapean a
  `MedicationRequest` (MedicationOrder), `MedicationDispense`, `MedicationAdministration`,
  `Task` (WorkItem), `Observation` (labs), etc. Ver `docs/domain-model.md`.

---

# Cierre de arquitectura (TASK 17)

Estado tras la limpieza previa a la auditoría final del MVP.

## Capas y dirección de dependencias

```
UI (pages / components)          React; solo lee estado, renderiza e invoca servicios
  → application/services          async; muta + emite DomainEvents; sin etiquetas de UI
    → domain (types + utils puras) reglas framework-agnósticas (continuity, review, resumen, workItems, journey…)
    → repositories (interfaces)    contrato de persistencia async; sin React/UI
      → adaptador in-memory        envuelve stores/datos demo
  ↕ read model reactivo (utils/*Store)  useSyncExternalStore: única capa de utils acoplada a React
```

Verificado en TASK 17: `types/` y `data/` son framework-agnósticos (sin `react`);
`repositories/` y `services/` no importan React ni UI; la UI **no** muta stores
directamente (solo vía `services.*`); 0 usos de `any`/`as any`. La única utils
acoplada a React es la capa de stores (read model), por diseño.

## Núcleo (Core) vs Oncology Pack

Sin framework de plugins todavía; la separación es conceptual y las abstracciones
Core no asumen oncología:

- **Core (reutilizable):** Patient, Episode/Journey, Workflow/WorkItem, TherapyPlan,
  MedicationOrder/Fulfillment/Dispense, ValidationRun/Finding/ProfessionalReview,
  PharmaceuticalCare/FollowUp, PreparationOrder/Instance/ComponentUsage (`PrepDomainKind`
  admite oncología/antibióticos/nutrición-parenteral/otro), ProductPresentation/BatchLot,
  DomainEvent/Audit, User/Role/Scope/WorkspaceProfile, Facility/Program/Team,
  ClinicalConfiguration/IntegrationConfig/SupportSession, continuity risk, readiness.
- **Oncology Pack (dato/semántica, no lógica Core):** ciclo/día (`cycleDay`, `CycleState`),
  etiquetas de protocolo (AC, R-CHOP…), contexto antineoplásico y de mezcla estéril,
  BSA/dosis por superficie. Viven en `data/*` (seeds) y en campos opcionales del dominio,
  no en ramas de comportamiento. `showsCycle()` ya evita mostrar ciclos en terapia continua.

No existe ramificación por cliente/paciente (`if tenant===`, `if patient.name===`):
Asisfarma es tenant en `data/org.ts`; los nombres de paciente son seed. El comportamiento
de dominio es genérico (verificado por búsqueda en TASK 17).

## Estado de los repositorios

Todos usan hoy el **adaptador in-memory** (`repositories/inMemory.ts`) sobre seeds de
`src/data/` y estado de sesión en los stores. Contratos async y IDs estables ya listos
para sustituir por un adaptador de API/BD sin tocar servicios ni UI:

| Repositorio | Estado actual | Backing futuro |
|---|---|---|
| Patient / Episode / MedicationOrder | in-memory (seed) | BD/API |
| Validation / FollowUp / Fulfillment / Preparation / Traceability | in-memory (mutable en sesión) | BD/API |
| Event | in-memory append-only (`utils/eventStore`) | BD/stream |
| Admin (usuarios/soporte) | in-memory (mutable en sesión) | BD/API |

## Vocabularios de estado canónicos (una fuente por dominio)

`PrepStatus`, `FulfillmentStatus`/`CommState`/`AvailabilityStatus`/`ContinuityRisk`,
`FindingStatus`/`ReviewOutcome`, `FollowUpStatusKind`, `ClinicalConfigStatus`,
`IntegrationStatus`, `SupportStatus`, `DomainEventType`. Las etiquetas en español son
**proyecciones** (mapas `*_LABEL` / `activityProjection`), nunca estado de dominio.

## Deuda técnica diferida (para después de la auditoría)

- Persistencia real detrás de los repositorios (mayor pendiente estructural).
- `AuditMeta` cableado en todas las entidades (hoy scaffolding + cobertura parcial).
- Autorización real (los WorkspaceProfile son visibilidad, no permisos).
- `Patient 1:N Episode` real (el MVP asume un episodio activo por paciente).
- Framework de Solution Packs (hoy la separación Core/Pack es convención).
- Archivos muertos que requieren borrado manual en el repo local (no eliminables desde
  esta sesión): `src/components/patient/{PatientTabs,ResumenTab,RevisionTab}.tsx` (stubs)
  y `src/utils/preparationReadiness.ts` (reexport de compatibilidad ya sin importadores).
