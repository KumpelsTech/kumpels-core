import type { Priority } from './patient'
import type { ActionKey, DemoPersona } from '../config/workspaces'

/**
 * WorkItem — unidad de trabajo compartida y ligera. NO es un dataset nuevo:
 * se DERIVA de Revisión Clínica, Seguimiento, Cumplimiento y Preparación.
 * Alimenta la página "Hoy" según la persona/rol activa.
 */
export type WorkItemType = 'revision' | 'seguimiento' | 'pendiente' | 'preparacion' | 'administracion'
export type WorkTone = 'crit' | 'warn' | 'info' | 'ok'

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
  dueLabel?: string
  nextAction: string
  actionKey: ActionKey
  /** Workflow de origen (para trazar de dónde viene el trabajo). */
  source: string
  href: string
}
