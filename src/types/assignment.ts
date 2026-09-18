import type { Priority } from './patient'
import type { DemoPersona } from '../config/workspaces'

/**
 * Ciclo de vida de RESPONSABILIDAD de un WorkItem (overlay, no duplica el estado
 * del dominio de origen). El trabajo humano delegado explícitamente admite
 * asignación y acuse; las tareas automáticas de fondo no lo requieren.
 *
 * Mapeo FHIR: Assignment ↔ campos de Task (status/owner/requester/authoredOn/
 * lastModified/executionPeriod/reasonCode/businessStatus). Ver docs.
 */
export type AssignmentStatus =
  | 'unassigned' | 'assigned' | 'acknowledged' | 'in-progress' | 'completed'
  | 'reassigned' | 'escalated' | 'cancelled'

export type AssignmentAction =
  | 'assigned' | 'acknowledged' | 'started' | 'completed'
  | 'reassigned' | 'escalated' | 'cancelled' | 'transferred'

/** Entrada append-only de la historia de responsabilidad (nunca se sobreescribe). */
export interface AssignmentEntry {
  id: string
  at: string
  atIso?: string
  action: AssignmentAction
  byId?: string
  byName?: string
  byRole?: string
  toId?: string
  toName?: string
  toRole?: DemoPersona
  fromId?: string
  fromName?: string
  reason?: string
}

export interface Assignment {
  workItemId: string
  status: AssignmentStatus
  assignedToId?: string
  assignedToName?: string
  assignedToRole?: DemoPersona
  assignedById?: string
  assignedByName?: string
  createdAt?: string
  assignedAt?: string
  acknowledgedAt?: string
  startedAt?: string
  completedAt?: string
  acknowledgedById?: string
  acknowledgedByName?: string
  dueAt?: string
  instruction?: string
  priorityOverride?: Priority
  escalated?: boolean
  note?: string
  history: AssignmentEntry[]
}
