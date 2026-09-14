import type { Category, DueKind, JourneyStage, Modality, Priority } from './patient'

/**
 * Modelo de vista del episodio/journey — DERIVADO del paciente compartido.
 * No es un registro independiente: un paciente tiene un episodio activo en
 * esta iteración. Vive en la capa de dominio (utils/journey), no en las vistas.
 */

/** Estado de un proceso que puede estar activo de forma independiente. */
export type ProcessState = 'done' | 'active' | 'warning' | 'blocked' | 'pending' | 'na'

export interface ProcessTrack {
  name: string
  state: ProcessState
  note?: string
}

export interface JourneyException {
  text: string
  kind: 'warn' | 'crit'
}

export interface JourneyView {
  patientId: string
  patientName: string
  initials: string
  dx?: string
  modality: Modality
  protocol?: string
  cycleLabel?: string
  facility: string
  payer: string
  priority: Priority
  category: Category

  /** Etapa actualmente en foco (current/warning/blocked). */
  currentStage: string
  currentStageState: JourneyStage['state']
  /** Hitos lineales del episodio (para el timeline). */
  stages: JourneyStage[]
  /** Procesos que pueden coexistir (no estrictamente secuenciales). */
  processes: ProcessTrack[]
  exception?: JourneyException

  next: string
  owner: string
  due?: string
  dueKind?: DueKind
}
