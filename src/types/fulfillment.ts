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
export interface ContactEntry {
  id: string
  at: string
  channel: string
  result: string
  nextStep?: string
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
  events: FulfillmentEvent[]
}
