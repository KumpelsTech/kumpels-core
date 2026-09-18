/**
 * DomainEvent CANÓNICO de Kumpels — concepto NATIVO (no un recurso FHIR).
 * Un DomainEvent = "algo relevante ocurrió en el flujo clínico/operativo".
 * Es distinto de un Audit Record (quién cambió qué; ver types/provenance.ts):
 * pueden referenciarse pero no son el mismo objeto.
 *
 * Historia append-only: los eventos no se editan; una corrección genera un
 * evento nuevo (p. ej. otro LOT_SELECTED) que referencia al anterior.
 *
 * Mapeo FHIR (documentado, no forzado): provenance clínico → Provenance;
 * actividad de seguridad/acceso → AuditEvent. Los eventos referencian entidades
 * canónicas (MedicationRequest/Dispense/Administration, Task, Observation…) por id.
 */

/** Dominio de origen del evento. */
export type EventDomain =
  | 'clinical-review' | 'pharmaceutical-care' | 'fulfillment' | 'preparation' | 'traceability'
  | 'administration' | 'production' | 'workitem' | 'admin' | 'communication'

export type ActorType = 'user' | 'system'

/** Taxonomía estable (solo acciones que el producto usa hoy o usará pronto). */
export type DomainEventType =
  | 'CLINICAL_REVIEW_CREATED' | 'CLINICAL_REVIEW_COMPLETED' | 'FINDING_CONFIRMED' | 'FINDING_DISMISSED'
  | 'PHARMACEUTICAL_CARE_ENROLLED' | 'INITIAL_ASSESSMENT_COMPLETED' | 'FOLLOWUP_COMPLETED'
  | 'MEDICATION_ORDER_CREATED' | 'MEDICATION_ORDER_CHANGED' | 'DISPENSE_PARTIAL' | 'DISPENSE_COMPLETED'
  | 'MEDICATION_PENDING_CREATED' | 'MEDICATION_AVAILABILITY_UPDATED' | 'PATIENT_CONTACTED' | 'MEDICATION_PENDING_RESOLVED'
  | 'PREPARATION_ORDER_CREATED' | 'PREPARATION_STARTED' | 'PREPARATION_COMPLETED' | 'PREPARATION_VERIFIED' | 'PREPARATION_RELEASED'
  | 'PREPARATION_REPLACED' | 'PREPARATION_REJECTED_BY_NURSING'
  | 'PRODUCTION_REQUEST_SENT' | 'PRODUCTION_REQUEST_ACCEPTED' | 'PRODUCTION_REQUEST_CANCELLED'
  | 'LOT_SELECTED' | 'LOT_ADDED' | 'LOT_REMOVED' | 'COMPONENT_USAGE_RECORDED' | 'PREPARATION_BATCH_CONFIRMED'
  | 'MEDICATION_ADMINISTERED' | 'MEDICATION_ADMINISTRATION_INCOMPLETE' | 'MEDICATION_ADMINISTRATION_CORRECTED'
  | 'WORKITEM_CREATED' | 'WORKITEM_COMPLETED' | 'WORKITEM_ASSIGNED' | 'WORKITEM_ESCALATED' | 'WORKITEM_PRIORITIZED'
  | 'WORKITEM_ACKNOWLEDGED' | 'WORKITEM_STARTED' | 'WORKITEM_REASSIGNED' | 'RESPONSIBILITY_TRANSFERRED'
  | 'VERIFICATION_WORK_CREATED' | 'VERIFICATION_ASSIGNED' | 'VERIFICATION_COMPLETED'
  // Administración / configuración institucional (auditable)
  | 'USER_STATUS_CHANGED' | 'USER_ROLE_ASSIGNED' | 'USER_TEAM_ASSIGNED' | 'USER_SCOPE_ASSIGNED'
  | 'SUPPORT_REQUESTED' | 'SUPPORT_ENDED'
  // Comunicaciones con el paciente (solo respuestas significativas, no cada mensaje)
  | 'PATIENT_ADHERENCE_CONCERN_REPORTED' | 'PATIENT_SYMPTOM_REPORTED' | 'PATIENT_PAIN_REPORTED'
  | 'PATIENT_TREATMENT_INTERRUPTION_REPORTED' | 'FOLLOWUP_RESPONSE_REQUIRES_REVIEW'

/** Registro de evento canónico (una sola forma para todos los dominios). */
export interface DomainEventRecord {
  id: string
  type: DomainEventType
  occurredAt: string
  /** Secuencia monotónica: preserva el orden de la historia. */
  seq: number

  patientId?: string
  episodeId?: string

  actorId?: string
  actorRole?: string
  actorType?: ActorType

  sourceDomain: EventDomain
  sourceEntityType?: string
  sourceEntityId?: string

  /** Título/resumen técnicos opcionales; la UI en español la produce la proyección. */
  title?: string
  summary?: string

  metadata?: Record<string, unknown>

  previousState?: string
  newState?: string
  reason?: string

  source?: string
  sourceSystem?: string
  version: number

  /** Evento que este corrige/enmienda (append-only; no se edita el original). */
  correctsEventId?: string
}

/** Entrada para emitir un evento (id/seq/occurredAt/version los asigna el bus). */
export type DomainEventInput =
  Omit<DomainEventRecord, 'id' | 'seq' | 'version'> & { occurredAt?: string; version?: number }

/** Consulta de eventos (para auditoría/analítica futura y proyecciones). */
export interface EventQuery {
  patientId?: string
  episodeId?: string
  sourceDomain?: EventDomain
  sourceEntityType?: string
  sourceEntityId?: string
  types?: DomainEventType[]
  since?: number
  until?: number
  limit?: number
}
