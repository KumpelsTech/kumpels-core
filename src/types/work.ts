import type { Priority } from './patient'
import type { ActionKey, DemoPersona } from '../config/workspaces'
import type { Capability } from '../config/capabilities'
import type { ContinuityRisk } from './fulfillment'

/**
 * WorkItem — unidad de trabajo compartida y ligera. NO es un dataset nuevo:
 * se DERIVA de Revisión Clínica, Seguimiento, Cumplimiento y Preparación.
 * Alimenta la página "Hoy" y la cola de prioridad del Coordinador.
 *
 * Soporta HANDOFFS explícitos entre equipos: cada item declara su propietario
 * (rol/equipo responsable de la próxima acción) además de las personas para las
 * que es visible. No duplica el estado de dominio de origen (lo referencia).
 */
export type WorkItemType = 'revision' | 'seguimiento' | 'pendiente' | 'preparacion' | 'administracion' | 'bloqueo'
export type WorkTone = 'crit' | 'warn' | 'info' | 'ok'
export type EscalationState = 'none' | 'escalated'

/** Propietario responsable de resolver un WorkItem (rol + equipo/fuente). */
export interface WorkOwner {
  role: DemoPersona
  team?: string
  label: string
}

/**
 * Señales DETERMINISTAS y explicables para priorizar (no IA predictiva). La cola
 * de prioridad las traduce en el "por qué" de cada item.
 */
export interface WorkSignals {
  continuityRisk?: ContinuityRisk
  daysPending?: number
  /** Hora de administración (min desde medianoche) para SLA/urgencia temporal. */
  scheduledMinutes?: number
  unresolvedFinding?: boolean
  pendingContact?: boolean
  blocked?: boolean
  missingOwner?: boolean
  /** Requisitos listos pero Enfermería aún no envió a producción. */
  readyNotSent?: boolean
  /** Enviada a producción pero Central de Mezclas aún no la acepta. */
  sentNotAccepted?: boolean
  /** Minutos transcurridos desde el envío (para señal de demora de aceptación). */
  sentAgoMinutes?: number
}

export interface WorkItem {
  id: string
  type: WorkItemType
  patientId?: string
  patientName: string
  episodeId?: string
  priority: Priority | 'none'
  statusLabel: string
  tone: WorkTone
  /** Personas para las que este trabajo es relevante (visibilidad de workspace). */
  roles: DemoPersona[]
  /** Rol/equipo responsable de la próxima acción (handoff explícito). */
  owner?: WorkOwner
  dueLabel?: string
  /** Minutos desde medianoche para ordenar por hora de administración/SLA. */
  dueMinutes?: number
  /** Motivo del bloqueo cuando el trabajo está detenido esperando a otro equipo. */
  blockerReason?: string
  escalationState?: EscalationState
  nextAction: string
  actionKey: ActionKey
  /** Capacidad requerida para ejecutar la próxima acción (elegibilidad). */
  requiredCapability?: Capability
  /** Alcance del trabajo (para validación de sede/programa). */
  facilityId?: string
  programId?: string
  /** Workflow de origen (para trazar de dónde viene el trabajo). */
  source: string
  /** Id de la entidad de dominio referenciada (p. ej. orden de preparación). */
  refId?: string
  href: string
  /** Señales para la cola de prioridad (explicables). */
  signals?: WorkSignals
}
