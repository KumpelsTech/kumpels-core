import type { DemoPersona } from '../config/workspaces'
import type { Modality } from './patient'

/**
 * JOURNEY horizontal (proyección del episodio). NO es una segunda base de datos de
 * flujo: el Journey PROYECTA el estado de los dominios existentes (Revisión,
 * ProductionRequest, Preparación, Administración, Cumplimiento, Seguimiento). La
 * propiedad se deriva de los WorkItems + su ciclo de asignación, no de un sistema
 * paralelo.
 *
 * Separación de conceptos (no se fusionan):
 *   Patient (persona longitudinal) ≠ Episode (contexto de atención actual) ≠
 *   Journey (progresión legible del episodio).
 *
 * Mapeo FHIR: Journey/JourneyStage son NATIVOS de Kumpels (proyección). Referencias
 * mapeables a Patient, EpisodeOfCare, MedicationRequest, Task, MedicationAdministration,
 * Practitioner/PractitionerRole, Appointment/Encounter, AuditEvent/Provenance.
 */

export type JourneyType = 'oncology-iv' | 'oral' | 'fulfillment'

/** Vocabulario mínimo de estado de etapa (no docenas de estados). */
export type StageStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED' | 'SKIPPED' | 'CANCELLED'

/** Ciclo de vida de asignación (de los WorkItems), cuando aplica. */
export type StageAssignment = 'UNASSIGNED' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED'

/** Propietario actual del trabajo de una etapa (rol + equipo + usuario si asignado). */
export interface StageOwner {
  role?: DemoPersona
  team?: string
  /** Etiqueta legible: usuario asignado ("Laura Gómez") o equipo ("Central de Mezclas"). */
  label: string
  userId?: string
  assignment?: StageAssignment
}

/** Bloqueo explicable de una etapa. */
export interface StageBlocker {
  label: string
  responsible?: string
  since?: string
  nextAction?: string
}

/** Etapa DERIVADA del estado de dominio (no un registro independiente). */
export interface DerivedStage {
  id: string
  journeyId: string
  type: string
  label: string
  status: StageStatus
  startedAt?: string
  completedAt?: string
  /** Propietario actual (para etapas ACTIVE/BLOCKED). */
  owner?: StageOwner
  nextAction?: string
  blocker?: StageBlocker
  /** Entidad de dominio de origen (referencia, no copia). */
  sourceEntityType?: string
  sourceEntityId?: string
  dueAt?: string
}

/** Indicador de retraso DETERMINISTA (de dueAt/SLA/WorkItem; sin scoring predictivo). */
export interface JourneyDelay {
  text: string
  /** true → énfasis de advertencia fuerte (bloqueo/retraso activo). */
  severe: boolean
  /** Equipo/rol que posee el retraso (no un usuario, salvo que esté asignado). */
  ownerLabel?: string
  reason?: string
}

/** Contexto de handoff actual (sin ser un log de auditoría completo). */
export interface JourneyHandoff {
  sentByLabel?: string
  sentAt?: string
  acceptedByLabel?: string
  acceptedAt?: string
}

/** Proyección completa del episodio para la UI de Journeys. */
export interface EpisodeJourney {
  patientId: string
  patientName: string
  initials: string
  dx?: string
  modality: Modality
  protocol?: string
  cycleLabel?: string
  priority: import('./patient').Priority
  category: import('./patient').Category
  episodeId?: string
  journeyType: JourneyType
  stages: DerivedStage[]
  /** Etapa actual (primera ACTIVE o BLOCKED; última si todas completas). */
  currentStage?: DerivedStage
  currentOwner?: StageOwner
  /** Siguiente etapa y su propietario (quién recibe el proceso). */
  nextStage?: DerivedStage
  nextOwner?: StageOwner
  nextAction?: string
  blocked: boolean
  /** Retraso determinista de la etapa actual (cuando aplica). */
  delay?: JourneyDelay
  /** Contexto de handoff (envío/aceptación de producción) cuando aplica. */
  handoff?: JourneyHandoff
  /** WorkItem de la etapa actual (para navegar a la acción / asignación existente). */
  currentWorkItemId?: string
  /** Href de la acción de la etapa actual (flujo existente). */
  actionHref?: string
  /** Enlace al detalle del journey y al paciente. */
  href: string
  patientHref: string
}
