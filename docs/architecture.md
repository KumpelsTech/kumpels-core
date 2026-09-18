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

---

## Trazabilidad operativa, handoffs y cierre de flujo (TASK 18)

Endurecimiento transversal para que toda acción sea atribuible, sellada con
fecha+hora exactas, auditable, explicable y conectada al siguiente responsable.
Sin nuevas dependencias; misma arquitectura UI → Servicios → Dominio →
Repositorios → Eventos/Auditoría.

**Fundación de trazabilidad.** `utils/datetime` (ISO tz-aware + etiqueta
"14 sep 2026 · 10:42"); `types/actor` (`ActorRef` desde `personaStore.getActor`);
`types/audit` + `utils/auditStore` (traza append-only). `services/eventBus`
expone `emitEvent` (hecho de flujo) y `recordAudit` (quién/qué/antes→después/
por qué) como canales SEPARADOS; un cambio crítico produce ambos.

**Historia sin reemplazo silencioso.** `reviewStore` y `careStore` pasan a
historia append-only (decisión/seguimiento vigente = último; se conserva el
previo). Drawer genérico `components/HistoryDrawer` ("Ver historial") reutilizado
por hallazgos, contactos, reprogramaciones, lotes y seguimientos — Patient 360
sigue continuo (sin pestaña de historial global).

**Cumplimiento / Dispensación.** `ContactEntry` enriquecido (método, con quién,
resultado, actor; no asume éxito); `ScheduleChange` (reprogramación con motivo,
preserva la previa); `MedicationDelivery` + `ReceiptEvidence` (quién recibió +
evidencia placeholder). Regla de cierre: entrega o "resolver sin contacto" con
motivo. Nueva persona **Farmacia / Dispensación** ejecuta; Coordinador supervisa.

**Administración.** Dominio nuevo `MedicationAdministration` (entidad canónica,
mapeable a FHIR `MedicationAdministration`) con `administrationStore` /
`administrationService` / `AdministrationDrawer` y panel en Patient 360.

**Preparación.** Sellos exactos en preparar/verificar/liberar; `PreparationPolicy`
(segregación de funciones configurable — preparar≠verificar ACTIVA, verificar≠
liberar relajada por config) prevé y explica acciones inválidas; auditoría de lote
con motivo de cambio e historial.

**Coordinador.** `utils/priorityQueue` (score determinista + nivel + razones
explicables, sin IA); `coordinatorStore`/`coordinatorService` para asignar,
reasignar, escalar, repriorizar (con motivo) y anotar — operativo, no clínico.
`WorkItem` gana owner (handoff), señales de priorización y estado de escalamiento;
los bloqueos se enrutan al rol responsable, no siempre a Central de Mezclas.

**Repositorios añadidos.** `AdministrationRepository`, `CoordinatorRepository`
(adaptadores in-memory). `DomainEventType` suma administración y WorkItem
(assigned/escalated/prioritized); `EventDomain` suma `administration`.

**Deuda diferida (nueva).** Persistencia real de administración/coordinación;
firma electrónica/OTP reales; "ahora" demo (12:02) para SLA reproducible.

---

## Responsabilidad, autorización y elegibilidad (TASK 18.2)

Capa de autorización ligera sobre TASK 18: una acción requiere un usuario
ELEGIBLE, no solo "otro usuario". Sin IAM/RBAC empresarial.

**Elegibilidad centralizada.** `config/capabilities` (catálogo + rol→capacidades);
`types/eligibility` + `utils/eligibility.evaluateEligibility/eligibleUsers`
evalúan activo → capacidad → sede → programa → segregación de funciones →
exclusión. La decisión vive fuera de la UI; los componentes solo listan elegibles
y muestran el motivo de denegación. `AdminUser` gana `capabilities?` (derivadas del
rol si se omite); se añaden un segundo QF de Mezclas (Laura Gómez) y el usuario de
Farmacia (Carolina Ruiz).

**Identidad (Practitioner) vs rol.** `personaStore` separa usuario activo del rol:
"Ver como" selecciona un USUARIO (`setUser`); su rol determina el WorkspaceProfile.
`getActor()` deriva de la identidad activa.

**Ciclo de vida de responsabilidad.** `types/assignment` + `coordinatorStore`
(reescrito) llevan el overlay unassigned→assigned→acknowledged→in-progress→
completed (+reassigned/escalated/cancelled/transferred) con historia append-only.
`services.coordinator` (WorkAssignment/Responsibility) asigna solo a elegibles,
reasigna/transfiere con motivo, registra acuse y escala; cada acción emite evento
+ auditoría. Guard de elegibilidad en el servicio, no en JSX.

**Bandeja del asignado.** `components/AssignedInbox` en "Hoy" ("Asignado a ti"):
qué, por qué, prioridad (la misma de la cola), vencimiento, quién asignó y cuándo,
con "Tomar tarea" (acuse). El Coordinador ve el estado de acuse en la cola.

**Central de Mezclas — verificación.** La verificación se decide por elegibilidad
(capacidad + alcance + `preparerCannotVerifyOwnWork`). Si el usuario actual no es
elegible pero existe otro QF habilitado, se ofrece "Asignar verificación" a ese
usuario (VERIFICATION_ASSIGNED, aparece en su bandeja); si NO existe ninguno, se
muestra el bloqueo "Sin profesional elegible para verificación" con acción, rol,
alcance, política y escalamiento — nunca se omite la política.

**Configuración de usuarios.** Configuración → Usuarios muestra rol, equipo, sede,
programa, capacidades y estado (compacto; sin matriz IAM). Los roles clínicos no
obtienen administración de usuarios; Administrador ≠ autoridad clínica.

**Repositorio.** `CoordinatorRepository` ampliado (assign/reassign/acknowledge/
start/complete/transfer/escalate/priority/due/note). Sin lógica específica de
cliente: la elegibilidad es Core genérico (datos demo usan nombres reales, la
lógica no ramifica por tenant/sede/usuario).

---

## Excepciones del ciclo de vida de medicación (TASK 19 · Parte 1)

Cinco excepciones incrementales sobre la arquitectura existente (UI → Servicio →
Elegibilidad/Política → Dominio → Repositorio/Store → Auditoría → Evento → WorkItem/
Actividad). Nada sobreescrito en silencio; todo trazable y elegible.

- **19.1** `types/correction` + `utils/correctionStore`; `administrationService.recordCorrectionFor` (capacidad MEDICATION_ADMINISTRATION_CORRECT); `CorrectionModal` + "Ver historial" en `AdministrationPanel`; `enteredInError` en la administración.
- **19.2** `preparationStore.supersede()` (órdenes runtime + marca superado + `PreparationReplacement`), alias de componentes en `traceabilityStore` para conservar genealogía; `preparationService.replace` (capacidad PREPARATION_REPLACE); lock de lotes en verificada/liberada; `ReplaceModal` + banners.
- **19.3** `utils/orderChangeStore` + `utils/downstreamImpact.impactFor`; `orderChangeService` (capacidad MEDICATION_ORDER_CHANGE); `OrderChangeModal` + `ImpactBanner`; WorkItem "Afectado por cambio de tratamiento" en `workItems`.
- **19.4** `config/rejectionReasons` (enrutamiento por motivo); `preparationStore.rejectByNursing` + `preparationService.rejectByNursing` (capacidad MEDICATION_ADMINISTRATION); `RejectionModal` + banner; WorkItem de resolución.
- **19.5** `AdministrationResult` ampliado + `RemainderDisposition`; `AdministrationDrawer` con planificado/administrado/remanente + disposición.

Repositorios ampliados: `AdministrationRepository` (getById/applyCorrection),
`PreparationRepository` (supersede/rejectByNursing). Nuevos eventos:
MEDICATION_ADMINISTRATION_CORRECTED, PREPARATION_REPLACED, MEDICATION_ORDER_CHANGED,
PREPARATION_REJECTED_BY_NURSING. Nuevas capacidades:
MEDICATION_ADMINISTRATION_CORRECT, PREPARATION_REPLACE, MEDICATION_ORDER_CHANGE.

Corrección de bug: las acciones de preparación se atribuyen al usuario activo
(no al `userName` estático del workspace), para que la segregación de funciones
distinga preparador de verificador.

---

## Planeación de Enfermería y liberación a producción (TASK 20.1)

Enfermería como **compuerta operativa** hacia Central de Mezclas, sobre la misma
arquitectura (UI → Servicio → Elegibilidad → Dominio/Store → Auditoría → Evento →
WorkItem/Actividad). Central de Mezclas no inicia producción por la mera existencia
de una orden de medicación.

**Dominio.** `types/production.ts` (`ProductionRequest` + `ProductionRequestStatus`,
una por `preparationOrderId`, historia append-only). `utils/productionStore.ts`
(store reactivo: `sendToProduction`/`acceptProduction`/`cancelProduction`,
`isProductionSent`, `getProductionRequest`). Referencia las entidades canónicas por
id; no copia payload clínico (sin segunda fuente de verdad).

**Compuerta (gate).** `preparationStore.statusOf(inst, readiness, productionSent)`
mantiene la preparación `bloqueada` con bloqueo "Pendiente de envío por Enfermería"
mientras no esté enviada; `iniciarPreparacion` re-evalúa y no inicia sin envío. La
vista expone `productionGate` (banner en el detalle de caso). Sin ciclo de imports:
`preparationStore` importa `isProductionSent`; `productionStore` no referencia de
vuelta.

**Derivación de planeación.** `utils/nursingPlanning.nursingPlanItems()` arma
"Pacientes próximos" (Hoy/Mañana) **reutilizando** el readiness de preparación
(no duplica reglas); expone motivos legibles de bloqueo.

**Servicio.** `services/productionService.ts` (`send`/`accept`/`cancel`), guardado
por `evaluateEligibility` (capacidad `PRODUCTION_REQUEST_SEND` / `_CANCEL`); cada
acción emite `DomainEvent` (dominio `production`) + `recordAudit`. Registrado en
`services.production` con `ProductionRepository` (repos in-memory).

**WorkItems.** `utils/workItems.sendItems()`: (a) listo-no-enviado → propiedad de
Enfermería (`PRODUCTION_REQUEST_SEND`, visible a Coordinación); (b) enviado-no-
aceptado → visible a Central de Mezclas ("Enviadas a producción por Enfermería") y
Coordinación. `preparationItems()` **omite** las preparaciones con `productionGate`.
Señales de demora deterministas en `priorityQueue` (`readyNotSent`,
`sentNotAccepted`/`sentAgoMinutes`).

**UI.** `components/NursingPlanning.tsx` (montado en "Hoy" de Enfermería): tabs
Hoy/Mañana, readiness con motivos, "Enviar a producción" / "Cancelar envío" (modal
con motivo). Banner de compuerta en `PreparacionEsterilWorkstream` (detalle de caso).
Sección "Enviadas a producción por Enfermería" en "Hoy" de Central de Mezclas.

Nuevas capacidades: `NURSING_TREATMENT_PLAN_VIEW`, `PRODUCTION_REQUEST_CREATE`,
`PRODUCTION_REQUEST_SEND`, `PRODUCTION_REQUEST_CANCEL`. Nuevos eventos:
`PRODUCTION_REQUEST_SENT` / `_ACCEPTED` / `_CANCELLED`. `ProductionRequest` mapea a
`Task` FHIR (operativo), separado de `MedicationRequest` (prescripción) — detalle en
`domain-model.md`.

**No construido (diferido explícitamente):** comunicaciones WhatsApp, Journeys
horizontales, calendario/agenda completo, retiro/impacto de lotes, motor de alertas,
staffing, integración EHR/servidor FHIR/BD de producción.

---

## Propiedad y escalamiento de la solicitud de producción (TASK 20.1.1)

Cierra el ciclo de propiedad sobre la arquitectura existente, sin persistencia nueva.

- **Capacidad** `PRODUCTION_REQUEST_ACCEPT` (rol Central de Mezclas) en
  `config/capabilities`.
- **Dominio/Store** `productionStore.acceptProduction(orderId, actor, auto)` captura
  `acceptedBy*`/fecha-hora/`acceptedAuto`; `isPendingAcceptance()`. Campos de
  aceptación añadidos a `types/production.ProductionRequest`.
- **Servicio** `productionService.accept` guardado por elegibilidad
  (`PRODUCTION_REQUEST_ACCEPT`); emite evento + auditoría; `auto` conserva la misma
  historia sin re-guardar. `send` captura facility/program (alcance de Mezclas).
- **Acción compuesta** `utils/productionActions.acceptProductionRequest`: acepta la
  solicitud y avanza el WorkItem de handoff asignado (`ASSIGNED → ACKNOWLEDGED →
  IN_PROGRESS`) vía el overlay de asignación (TASK 18.2).
- **WorkItems** (`utils/workItems.sendItems`): el item enviado-no-aceptado
  (`wi-sent-*`) lleva `requiredCapability PRODUCTION_REQUEST_ACCEPT` + alcance de
  Mezclas + `actionKey 'aceptar-solicitud'` + `refId`; el item listo-no-enviado
  (`wi-send-*`) lleva `PRODUCTION_REQUEST_SEND` + `actionKey 'enviar-produccion'` +
  `refId`. Nuevo campo `WorkItem.refId`. Nuevos ActionKeys `enviar-produccion` /
  `aceptar-solicitud`.
- **UI.** `AssignedInbox` y `WorkItemRow` muestran "Aceptar solicitud" al QF elegible
  (Hoy de Central de Mezclas, sección "Enviadas a producción por Enfermería"); el
  detalle de caso muestra el estado de aceptación (aceptada por / al iniciar) y acepta
  automáticamente al iniciar la preparación. `CoordinatorQueue` gana control de
  `dueAt`; asigna/reasigna solo a elegibles (ya existente), sin exponer los botones de
  acción de otros roles.

Auto-aceptación al iniciar: el detalle de caso llama `acceptProductionRequest(..., true)`
antes de `preparation.start` cuando la solicitud está `SENT_TO_PRODUCTION`. Sin
callejones sin salida entre `SENT_TO_PRODUCTION` y el inicio de producción.

---

## Modelo de preparación multi-componente e identidad final (TASK 20.2A)

Sobre el dominio de trazabilidad existente, sin motor de inventario ni retiro de lotes.

- **Tipos** (`types/traceability`): `LotAllocation` (lote fuente + cantidad por
  componente), `PreparationBatch` (+`PreparationBatchStatus`), `ComponentUsage`
  enriquecido (`medicationConceptId`, `componentType`, `recordedBy`/`recordedAt`),
  `ComponentLotView` y `ComponentView.lots[]`, `medicationConceptId` en
  `ProductPresentation`, `componentType` en `PreparationComponent`.
- **Store** (`utils/traceabilityStore`): overlay `allocations` (multi-lote) +
  `batches`; `allocationsOf` materializa (overlay o selección principal);
  `addLotAllocation`/`changeLotAllocation`/`removeLotAllocation` (solo lotes
  utilizables, audit append-only), `confirmPreparationBatch`/`getPreparationBatch`;
  `getComponentViews` deriva `lots[]`; `recordUsage` emite VARIOS `ComponentUsage`
  (uno por lote) enriquecidos; `principalLot`/`getLotTrace` honran el overlay.
- **Servicio + autorización** (`traceabilityService`): `selectLot`/`addLot`/
  `changeLot`/`removeLot`/`confirmBatch` con `ActorRef`, guardados por
  `evaluateEligibility(STERILE_PREPARATION, MIXING_SCOPE)`; cada acción emite evento
  + auditoría (`LOT_SELECTED`/`LOT_ADDED`/`LOT_REMOVED`/`PREPARATION_BATCH_CONFIRMED`).
  Repositorio `TraceabilityRepository` ampliado.
- **Política** (`config/preparationPolicy`): `requireCompoundingBatch` (configurable).
- **UI** (`PreparacionEsterilWorkstream`): sección `Componentes` multi-lote (por lote:
  número, cantidad, vencimiento, estado; añadir/cambiar/quitar); sección
  `Preparación final` (id estable, lote de mezcla, paciente, régimen, dosis, volumen,
  contenedor, preparado por/cuándo, beyond-use/vencimiento) + `BatchModal`. Edición
  gobernada por elegibilidad de Central de Mezclas; bloqueo tras verificación/liberación.

Reemplazo (TASK 19 + §9): `aliasOrder` comparte solo la plantilla del plan; las
asignaciones, usos y lote de mezcla final se guardan por id de orden, de modo que un
reemplazo obtiene genealogía física independiente.

**No construido (diferido explícitamente):** retiro/cuarentena con impacto
retrospectivo, deducción de inventario, mermas, escaneo de códigos de barras.

---

## Genealogía compuesta bidireccional y trazabilidad (TASK 20.2B)

Solo genealogía/historial/UI de trazabilidad; sin cambios en el modelo de datos núcleo.

- **Selectores** (`utils/traceabilityStore`): `getLotTrace` enriquecido con
  `finalBatch`/`presentationLabel` (hacia adelante lote→preparación→mezcla→paciente);
  nuevo `getPreparationTrace(orderId)` (componentes + lote de mezcla). Tipos:
  `LotTraceEntry.finalBatch/presentationLabel`, `PreparationTrace`.
- **Componentes** (`components/ops/TraceabilityDrawer`): `TraceTree` (árbol compuesto
  reutilizable) y `TraceabilityDrawer` (cadena + firmas/tiempos + historial
  append-only). Fuente única: leen `getComponentViews`/`getPreparationBatch`/
  `getAudit` (sin duplicar registros).
- **Cableado**: caso de preparación muestra `TraceTree` + "Ver trazabilidad completa";
  `LotDetail` muestra el lote de mezcla final por preparación; `PreparationStatus`
  (Patient 360) da un resumen conciso + drawer in situ (sin nueva pestaña). Se retiró
  la genealogía lineal previa (`buildGenealogy` permanece disponible).

**No construido (diferido):** análisis de impacto retrospectivo (retiro/cuarentena),
inventario, mermas, escaneo.

---

## Journey horizontal del episodio y próximo responsable (TASK 20.3A)

Proyección sobre los dominios existentes; sin segundo flujo ni sistema de asignación paralelo.

- **Modelo/config**: `types/journeyStage` (`DerivedStage`, `EpisodeJourney`,
  `StageStatus`, `StageOwner`, `StageAssignment`); `config/journeys.JOURNEY_DEFS`
  (oncology-iv / oral / fulfillment, con propietario por defecto por etapa —
  configurable para Solution Packs).
- **Derivación** (`utils/episodeJourney`): `deriveEpisodeJourney(patient)` elige el
  tipo (prep → iv, Oral → oral, pendiente → fulfillment) y calcula la etapa actual
  desde `clinicalReviewPending`, `getPatientPreparation`, `getProductionRequest`,
  `getAdministrationForOrder`, `getPatientPending`/`nextFulfillmentAction`, `getCare`/
  `getAssessment`. La propiedad y la `nextAction` se toman de `buildWorkItems` +
  `applyOverrides` + `getAssignment` (misma fuente que Hoy). Sin registros nuevos.
- **UI**: `JourneysPage` deriva y se suscribe a los stores; `JourneyCard` muestra el
  rail de etapas (estados), "Etapa actual" + responsable (usuario/equipo + asignación),
  "Siguiente" + próximo responsable, panel BLOQUEADA (motivo/responsable/desde/
  próxima acción). Se retiró la proyección estática previa (`utils/journey`,
  `types/journey`, `JourneyTimeline`).

Autorización sin cambios: el Journey no otorga permisos; las acciones evalúan
elegibilidad en su servicio. **No construido:** campana/notificaciones, WhatsApp,
analítica avanzada, TASK 20.4.

---

## UI horizontal del Journey, retraso y handoff (TASK 20.3B)

Capa de presentación + enriquecimiento de la proyección; sin tocar flujos clínicos.

- **Proyección** (`utils/episodeJourney` + `types/journeyStage`): `EpisodeJourney`
  gana `delay` (de `slaMinutesOf`/señales del WorkItem), `handoff` (de
  ProductionRequest), `currentWorkItemId`, `actionHref` (href del WorkItem),
  `href` (detalle) / `patientHref`. `DerivedStage.startedAt` para la etapa activa.
- **Componentes** (`components/journey`): `JourneyStepper` (stepper horizontal,
  estados por ícono+etiqueta+énfasis, scroll en angosto); `EpisodeJourneyView` (vista
  continua: stepper -> actual/siguiente -> retraso -> bloqueo -> sin-asignar -> handoff
  -> WorkItems del episodio -> actividad; resalte segun persona); `JourneyCard`
  reescrita (compacta: stepper sm + etapa/responsable + proxima accion + chip de
  retraso + linea de bloqueo). Reutiliza `RecentActivity` y `buildWorkItems`.
- **Rutas/paginas**: nueva `journeys/:patientId` -> `JourneyDetailPage` (contexto +
  `EpisodeJourneyView`). `Patient360Page` incluye `EpisodeJourneyView` (compacto) —
  misma proyeccion para consistencia. Las tarjetas abren el detalle.
- **Asignacion/acciones**: reutilizan el flujo del Coordinador (Hoy) y los `href` de
  los WorkItems; sin logica de asignacion duplicada.

Autorizacion sin cambios: la visualizacion no otorga permisos. **No construido:**
campana/notificaciones, WhatsApp, TASK 20.4.

---

## Tablero de planeación de Enfermería (TASK 20.4A)

Proyección sobre los dominios existentes; sin fuente de verdad nueva.

- **Proyección** (`utils/scheduledTreatments`): `ScheduledTreatmentView` +
  `nursingScheduledTreatments(user)` — deriva de `listPreparationViews`,
  `getProductionRequest`, `getAdministrationForOrder`, `deriveEpisodeJourney`;
  etiquetas readiness/producción; orden cronológico; filtro de alcance por sede.
- **UI** (`components/NursingPlanningBoard`, `pages/NursingPlanningPage`): tabs
  Hoy/Mañana, filtros (Todos/Requieren acción/Bloqueados/Listos), filas cronológicas
  (hora, paciente, terapia/modalidad, etapa+propietario del Journey, badge de
  readiness, contexto de producción/administración, bloqueo, acciones de Enfermería
  segun capacidad). Ruta `nursing-planning` + nav de Enfermería.
- **Seed demo**: Julián IPS-48 (listo para enviar), Camilo liberado (listo para
  administrar), Andrés liberado+administrado (completado, con seed de
  MedicationAdministration), Sofía en producción, Laura/Patricia bloqueados. Cubre
  los estados de validación.

Autorización sin cambios: las acciones evalúan capacidad/alcance; la visibilidad no
otorga permisos. **No construido:** campana/notificaciones, WhatsApp, agendamiento
avanzado, TASK 20.4B.

---

## Retraso, propiedad y escalamiento (TASK 20.4B)

Proyección derivada; sin segundo cálculo por workspace ni eventos por minuto.

- **Modelo** (`utils/delaySignals`): `DelaySignal` + `deriveDelaySignal(patient)`
  (reutiliza `deriveEpisodeJourney` + `getAssignment` + `getPreparationOrder`;
  añade severidad, `minutesLate`, `assignedNotAcked`, `noAssignee`, `waitingForNext`,
  `notificationLabel`) + `listDelaySignals(user, ownerRole?)` + `delaySignalFor(id)`.
  Umbral de acuse; contexto horario demo 12:02 alineado con priorityQueue.
- **Integración**: `EpisodeJourneyView` (indicador de severidad en etapa actual);
  `NursingPlanningBoard` (badge "RETRASADA N MIN" solo Enfermería);
  `CoordinatorQueue` (chip de retraso por fila) + `CoordinatorDelays` (panel de Hoy
  del Coordinador con Ver Journey / Asignar / Escalar, reutiliza
  `services.coordinator.escalate`).
- **Sin duplicación**: el cálculo vive en `deriveDelaySignal`; cada superficie filtra
  por `ownerRole`. El retraso es estado derivado (no persiste, no emite eventos);
  se auto-resuelve cuando el dominio avanza.

**No construido:** campana/notificaciones, mensajería automática, IA predictiva,
TASK 20.5.

## Comunicaciones al paciente (TASK 20.5)

Flujo: **UI → CommunicationService → reglas → repositorio → WorkItem /
PharmaceuticalCare → Audit/Event**, con un **límite de adaptador MessagingProvider**
para aislar el canal (WhatsApp futuro) del dominio.

- **Modelo canónico** (`types/communication`): Thread / Message / Request / Template /
  PatientReportedData / AttentionSignal como fuente de verdad (no objetos React).
- **Repositorio** (`utils/communicationStore`): stores reactivos
  (`useSyncExternalStore`) de hilos, mensajes, requests, datos reportados y señales;
  plantillas (`TEMPLATES`) y documentos educativos (`EDUCATION_DOCS`). Semilla demo:
  Carlos (recordatorio + chequeo de adherencia + respuesta "No he podido tomar…" →
  señal de atención) y Marta (hilo tranquilo).
- **Adaptador** (`services/messagingProvider`): interfaz `MessagingProvider` +
  `simulatedProvider` (canal WHATSAPP_SIMULATED; simula ciclo QUEUED→SENT→DELIVERED o
  FAILED). Punto único para conectar la API real más adelante.
- **Servicio** (`services/communicationService`): `send` (gate
  PATIENT_COMMUNICATION_SEND → DRAFT → provider → setDelivery por transición),
  `retry`, `schedule` (CommunicationRequest "Programado"), `simulateInbound`
  (interpreta con `responseRules`, agrega PatientReportedData, y si hay atención:
  AttentionSignal + evento específico + FOLLOWUP_RESPONSE_REQUIRES_REVIEW + Audit).
- **Interpretación** (`utils/responseRules`): determinística, umbral de dolor 7, sin
  auto-diagnóstico.
- **Integración**: `workItems.communicationItems` (señal → WorkItem derivado, sin
  segunda verdad clínica; reutiliza asignación de TASK 18); `PatientReported` en
  Patient 360 ("Reportado por el paciente vía WhatsApp"); nav `comunicaciones`
  (`/communications`) para qf-clínico y coordinador.
- **UI** (`pages/ComunicacionesPage`): workspace de 3 columnas (inbox / conversación /
  contexto paciente+medicación). Gate PATIENT_COMMUNICATION_VIEW + scope por facility;
  composer con previsualización antes de enviar; acciones rápidas por plantilla;
  estado de fallo "No enviado" + "Reintentar"; estado vacío de primer contacto.

**Autorización:** Administrador institucional NO ve conversaciones clínicas
(capacidad no asignada → "Sin acceso a comunicaciones"). Coordinador: solo lectura
(composer deshabilitado). QF clínico: ver + enviar + revisar seguimiento.

**No construido:** API real de WhatsApp Business, decisión clínica autónoma,
plataforma de campañas de marketing, TASK 20.6.
