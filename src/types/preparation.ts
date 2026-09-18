/**
 * Dominio de PREPARACIÓN DE MEDICAMENTOS ESTÉRILES (Core reutilizable).
 * NO es un "módulo IMAT": sirve para oncología, antibióticos, nutrición
 * parenteral u otros flujos estériles. El MVP actual se enfoca en oncología.
 *
 * Cadena conceptual (no se duplican Paciente, Episodio, Terapia ni Orden de
 * medicación; se enlazan por id):
 *   PreparationOrder → PreparationReadiness (derivada) → PreparationInstance
 *
 * La preparación NO duplica la lógica de Revisión Clínica: consume su estado.
 * Preparar, verificar y liberar son acciones SEPARADAS y trazables.
 */
import type { DomainEvent, EventState } from './event'

export type PrepDomainKind = 'oncologia' | 'antibioticos' | 'nutricion-parenteral' | 'otro'

/** Estados del flujo de preparación (buckets de la cola). */
export type PrepStatus =
  | 'pendiente-validacion' // Revisión clínica sin resolver
  | 'bloqueada' // requisito operativo/clínico sin cumplir
  | 'lista' // lista para preparar
  | 'en-preparacion' // preparación iniciada
  | 'pendiente-verificacion' // preparada, a la espera de verificación
  | 'verificada' // verificada, a la espera de liberación
  | 'liberada' // liberada para administración

/** Requisito de readiness (un dato/condición previo a preparar). */
export interface PrepRequirement {
  key: string
  label: string
  met: boolean
  /** Equipo/rol responsable cuando el requisito no se cumple. */
  responsible?: string
  nextAction?: string
}

// Evento consolidado: PrepEvent es el DomainEvent canónico (ver types/event.ts).
export type PrepEventState = EventState
export type PrepEvent = DomainEvent

/** Bloqueo explicable (nunca "Error" ni "No disponible" genérico). */
export interface PrepBlocker {
  label: string
  responsible?: string
  nextAction?: string
}

/**
 * Orden de preparación — estructura reutilizable. Los campos oncológicos
 * (protocolo, ciclo/día) son OPCIONALES: no toda preparación futura usa ciclos.
 */
export interface PreparationOrder {
  id: string
  patientId: string
  patientName: string
  episodeId?: string
  /** Enlace a la orden de medicación (dominio de cumplimiento) cuando existe. */
  medicationOrderId?: string
  domainKind: PrepDomainKind

  medication: string
  prescribedDose: string
  /** Dosis final aprobada, cuando está disponible. */
  approvedDose?: string
  route: string
  protocol?: string
  /** Ciclo / día (aplica en oncología; opcional). */
  cycleDay?: string
  presentation?: string
  diluent?: string
  finalVolume?: string
  /** Tiempo/velocidad de administración. */
  administrationTime?: string
  /** Hora programada de administración (etiqueta legible). */
  scheduledAt: string
  /** Minutos desde medianoche (para ordenar por hora de administración). */
  scheduledMinutes: number

  responsible: string
  container?: string
  /** Paciente cuyo estado de revisión clínica aplica (por defecto patientId). */
  reviewPatientId?: string
  /** Preparación a la que reemplaza (cuando es un reemplazo controlado). */
  supersedes?: string
  /** Requisitos explícitos (la revisión clínica se DERIVA aparte, no aquí). */
  requirements: PrepRequirement[]
  events: PrepEvent[]
}

/**
 * Reemplazo CONTROLADO de una preparación verificada/liberada (no se edita in
 * situ): la anterior queda SUPERSEDED/CANCELLED y se crea una nueva. Preserva la
 * genealogía lote/componente de la anterior. Mapeo FHIR: relación entre dos
 * MedicationDispense/Task (basedOn/replaces) + Provenance.
 */
export interface PreparationReplacement {
  id: string
  oldPreparationId: string
  newPreparationId: string
  reason: string
  sourceChange?: string
  actorId: string
  actorName: string
  actorRole: string
  at: string
  atIso: string
}

/** Marca de reemplazo aplicada a una preparación superada. */
export interface SupersededMark {
  byId: string
  reason: string
  at: string
  by: string
}

/**
 * Rechazo de Enfermería sobre una preparación liberada (barrera final de
 * seguridad). RELEASED → REJECTED/HOLD (no "Cancelada"): genera trabajo de
 * resolución para el equipo responsable según el motivo.
 */
export interface NursingRejection {
  orderId: string
  reasonCode: string
  reasonLabel: string
  comment?: string
  nurseId: string
  nurseName: string
  nurseRole: string
  patientId: string
  medication: string
  ownerRole: string
  ownerLabel: string
  at: string
  atIso: string
}

/** Estado de preparación derivado (readiness). */
export interface PreparationReadiness {
  ready: boolean
  requirements: PrepRequirement[]
  pendingCount: number
  blocker?: PrepBlocker
}

/**
 * Instancia de preparación — se crea al iniciar. Guarda solo lo mínimo de esta
 * iteración. NO incluye genealogía completa componente↔lote todavía.
 */
export interface PreparationInstance {
  id: string
  orderId: string
  patientId: string
  medication: string
  finalDose: string
  concentration?: string
  volume?: string
  container?: string
  preparedBy?: string
  startedAt?: string
  completedAt?: string
  verifiedBy?: string
  verifiedAt?: string
  releasedBy?: string
  releasedAt?: string
}

/** Vista derivada consumida por la UI. */
export interface PreparationView {
  order: PreparationOrder
  status: PrepStatus
  readiness: PreparationReadiness
  instance?: PreparationInstance
  blocker?: PrepBlocker
  nextAction: string
  /** true si el bloqueo proviene de la revisión clínica sin resolver. */
  reviewBlocked: boolean
  /** Reemplazada por otra preparación (inmutable). */
  superseded?: SupersededMark
  /** Preparación anterior a la que reemplaza. */
  supersedes?: string
  /** Rechazo de Enfermería (HOLD hasta resolución). */
  rejection?: NursingRejection
  /** Requisitos listos pero pendiente de envío a producción por Enfermería. */
  productionGate?: boolean
}
