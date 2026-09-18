/**
 * Dominio de CUMPLIMIENTO de medicación (Core reutilizable, no atado a Asisfarma).
 *   MedicationOrder → MedicationFulfillment → MedicationDispense(s)
 *   remainingQuantity = orderedQuantity − fulfilledQuantity
 *   remainingQuantity > 0  ⇒  pendiente (MedicationPending = fulfillment sin resolver).
 * TASKS 7–8 añaden: disponibilidad/reabastecimiento, comunicación con el paciente
 * y una señal determinística de impacto en continuidad (no IA predictiva).
 */
import type { DomainEvent } from './event'

export type DispenseKind = 'inicial' | 'parcial' | 'restante'
export interface MedicationDispense {
  id: string
  quantity: number
  at: string
  by: string
  kind: DispenseKind
}

/** Estado de comunicación con el paciente. */
export type CommState = 'pendiente' | 'contactado' | 'informado' | 'coordinado'

/** Medio del contacto. */
export type ContactMethod = 'telefono' | 'whatsapp' | 'sms' | 'presencial' | 'otro'
/** Con quién se contactó (no siempre es el paciente). */
export type ContactedParty = 'paciente' | 'familiar' | 'cuidador' | 'representante' | 'otro'
/** Resultado real del intento (no asume contacto exitoso). */
export type ContactResult = 'contactado' | 'sin-respuesta' | 'reprogramado' | 'reintentar' | 'otro'

/**
 * Intento de contacto con el paciente — trazable y con actor. Se PRESERVAN todos
 * los intentos (no se sobreescribe). Cuando el contactado no es el paciente, se
 * conserva nombre/parentesco/referencia. `channel`/`result` son etiquetas legibles
 * derivadas (compatibilidad con la línea de tiempo existente).
 */
export interface ContactEntry {
  id: string
  at: string
  atIso?: string
  method: ContactMethod
  party: ContactedParty
  outcome: ContactResult
  channel: string
  result: string
  comment?: string
  nextStep?: string
  actorId?: string
  actorName?: string
  actorRole?: string
  /** Cuando el contactado no es el paciente. */
  partyName?: string
  relationship?: string
  reference?: string
}

/** Cambio de programación de disponibilidad (reprogramación) — preserva el previo. */
export interface ScheduleChange {
  id: string
  at: string
  atIso?: string
  previousDate?: string
  newDate: string
  newTime?: string
  reason?: string
  actorId?: string
  actorName?: string
  actorRole?: string
}

/** Tipo de quien recibe el medicamento en la entrega. */
export type RecipientType = 'paciente' | 'familiar' | 'cuidador' | 'representante' | 'otro'
/** Evidencia de recepción (placeholder — sin infraestructura de firma todavía). */
export type ReceiptEvidenceType = 'firma' | 'otp' | 'acuse-electronico' | 'documento' | 'ninguno'
export interface ReceiptEvidence {
  type: ReceiptEvidenceType
  reference?: string
  note?: string
}

/**
 * Entrega / acuse de recibo de medicación. El cumplimiento no termina solo con
 * "remaining = 0": se registra QUIÉN recibió realmente. Persistencia-ready.
 * Mapeo FHIR: MedicationDispense (whenHandedOver, receiver) + Provenance.
 */
export interface MedicationDelivery {
  id: string
  orderId: string
  patientId: string
  episodeId?: string
  medication: string
  quantity: number
  unitLabel: string
  at: string
  atIso?: string
  recipientType: RecipientType
  recipientName?: string
  relationship?: string
  reference?: string
  deliveredBy: string
  deliveredByRole?: string
  facility: string
  comment?: string
  evidence: ReceiptEvidence
  version: number
}

/** Estado de disponibilidad / reabastecimiento. */
export type AvailabilityStatus = 'sin-fecha' | 'estimada' | 'disponible' | 'resuelto'

/** Señal (operativa/clínica) de impacto en continuidad. NO es una decisión clínica. */
export type ContinuityRisk = 'sin-riesgo' | 'en-riesgo' | 'retrasado'
export interface Continuity { risk: ContinuityRisk; explain: string }

// Evento consolidado: FulfillmentEvent es el DomainEvent canónico (ver types/event.ts).
export type { EventState } from './event'
export type FulfillmentEvent = DomainEvent

export interface MedicationOrder {
  id: string
  patientId: string
  patientName: string
  medication: string
  unitLabel: string
  orderedQuantity: number
  facility: string
  createdAt: string
}

export interface MedicationFulfillment {
  orderId: string
  dispenses: MedicationDispense[]
  /** Etiqueta legible de disponibilidad esperada (p. ej. "Sep 13", "Tras autorización"). */
  expectedAvailability?: string
  /** Día del mes de la disponibilidad esperada (para el cálculo determinístico). */
  expectedDay?: number
  availabilityUpdatedAt?: string
  /** Dispensación bloqueada (p. ej. por autorización) — sin fecha posible aún. */
  blocked?: boolean
  communication: CommState
  contacts: ContactEntry[]
  responsible: string
  pendingSince: string
  daysPending: number
  /** Próxima necesidad de la terapia (aplicación/dispensación) para evaluar continuidad. */
  nextNeedLabel?: string
  nextNeedDay?: number
  nextApplication?: string
  lot?: string
  /** Historial de reprogramaciones de disponibilidad (append-only). */
  scheduleHistory?: ScheduleChange[]
  /** Entregas registradas con acuse de recibo (append-only). */
  deliveries?: MedicationDelivery[]
  /** Razón cuando el pendiente se resolvió sin contacto exitoso (vía explícita). */
  resolvedWithoutContactReason?: string
  events: FulfillmentEvent[]
}

export type FulfillmentStatus = 'completo' | 'parcial' | 'pendiente'

/** Vista derivada (MedicationPending cuando remaining > 0). */
export interface FulfillmentView {
  order: MedicationOrder
  ordered: number
  fulfilled: number
  remaining: number
  status: FulfillmentStatus
  isPending: boolean
  /** Dispensación bloqueada (p. ej. por autorización) — sin fecha posible aún. */
  blocked?: boolean
  expectedAvailability?: string
  expectedDay?: number
  availability: AvailabilityStatus
  availabilityUpdatedAt?: string
  communication: CommState
  contacts: ContactEntry[]
  continuity: Continuity
  responsible: string
  pendingSince: string
  daysPending: number
  nextNeedLabel?: string
  nextApplication?: string
  lot?: string
  scheduleHistory: ScheduleChange[]
  deliveries: MedicationDelivery[]
  /** Coherencia de contacto: true si el paciente fue contactado con éxito. */
  contactSettled: boolean
  resolvedWithoutContactReason?: string
  events: FulfillmentEvent[]
}
