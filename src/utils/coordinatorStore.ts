import { useSyncExternalStore } from 'react'
import type { Priority } from '../types/patient'
import type { WorkItem } from '../types/work'
import type { DemoPersona } from '../config/workspaces'
import type { Assignment, AssignmentEntry } from '../types/assignment'
import { newId } from './ids'
import { now } from './datetime'

/**
 * Overlay de RESPONSABILIDAD y gestión operativa sobre los WorkItems: asignación,
 * acuse, progreso, reasignación, transferencia de turno, escalamiento, prioridad
 * manual y nota. NO duplica el estado de dominio de origen — solo superpone quién
 * es responsable y en qué punto del ciclo de vida está. Keyed por WorkItem id.
 *
 * Historia append-only: cada cambio agrega una entrada; nunca se sobreescribe.
 */
const assignments = new Map<string, Assignment>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

function ensure(id: string): Assignment {
  let a = assignments.get(id)
  if (!a) { a = { workItemId: id, status: 'unassigned', createdAt: now().label, history: [] }; assignments.set(id, a) }
  return a
}
function record(a: Assignment, entry: Omit<AssignmentEntry, 'id' | 'at' | 'atIso'>) {
  const stamp = now()
  a.history = [...a.history, { ...entry, id: newId('asg'), at: stamp.label, atIso: stamp.iso }]
}

export function getAssignment(id: string): Assignment | undefined { return assignments.get(id) }
export function listAssignments(): Assignment[] { return [...assignments.values()] }
/** Asignaciones vigentes para un usuario (bandeja "Asignado a ti"). */
export function assignmentsForUser(userId: string): Assignment[] {
  return [...assignments.values()].filter((a) => a.assignedToId === userId && a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'reassigned')
}

export interface AssignInput {
  toId: string; toName: string; toRole: DemoPersona
  byId?: string; byName?: string
  dueAt?: string; instruction?: string; priority?: Priority
}
export function assignTo(id: string, i: AssignInput) {
  const a = ensure(id)
  const stamp = now()
  a.status = 'assigned'
  a.assignedToId = i.toId; a.assignedToName = i.toName; a.assignedToRole = i.toRole
  a.assignedById = i.byId; a.assignedByName = i.byName
  a.assignedAt = stamp.label
  if (i.dueAt) a.dueAt = i.dueAt
  if (i.instruction) a.instruction = i.instruction
  if (i.priority) a.priorityOverride = i.priority
  a.acknowledgedAt = undefined; a.acknowledgedById = undefined; a.acknowledgedByName = undefined
  record(a, { action: 'assigned', byId: i.byId, byName: i.byName, toId: i.toId, toName: i.toName, toRole: i.toRole, reason: i.instruction })
  emit()
}
export function acknowledge(id: string, byId: string, byName: string, byRole: string) {
  const a = assignments.get(id); if (!a || a.status !== 'assigned') return
  a.status = 'acknowledged'; a.acknowledgedAt = now().label; a.acknowledgedById = byId; a.acknowledgedByName = byName
  record(a, { action: 'acknowledged', byId, byName, byRole })
  emit()
}
export function startWork(id: string) {
  const a = assignments.get(id); if (!a || (a.status !== 'acknowledged' && a.status !== 'assigned')) return
  a.status = 'in-progress'; a.startedAt = now().label
  record(a, { action: 'started', byId: a.assignedToId, byName: a.assignedToName })
  emit()
}
export function completeWork(id: string) {
  const a = assignments.get(id); if (!a) return
  a.status = 'completed'; a.completedAt = now().label
  record(a, { action: 'completed', byId: a.assignedToId, byName: a.assignedToName })
  emit()
}
export interface ReassignInput { toId: string; toName: string; toRole: DemoPersona; byId?: string; byName?: string; reason: string }
export function reassign(id: string, i: ReassignInput) {
  const a = ensure(id)
  const fromId = a.assignedToId, fromName = a.assignedToName
  record(a, { action: 'reassigned', byId: i.byId, byName: i.byName, fromId, fromName, toId: i.toId, toName: i.toName, toRole: i.toRole, reason: i.reason })
  a.status = 'assigned'
  a.assignedToId = i.toId; a.assignedToName = i.toName; a.assignedToRole = i.toRole
  a.assignedById = i.byId; a.assignedByName = i.byName; a.assignedAt = now().label
  a.acknowledgedAt = undefined; a.acknowledgedById = undefined; a.acknowledgedByName = undefined
  emit()
}
/** Transferencia de responsabilidad (p. ej. cambio de turno). */
export function transfer(id: string, i: ReassignInput) {
  const a = ensure(id)
  const fromId = a.assignedToId, fromName = a.assignedToName
  record(a, { action: 'transferred', byId: i.byId, byName: i.byName, fromId, fromName, toId: i.toId, toName: i.toName, toRole: i.toRole, reason: i.reason })
  a.status = 'assigned'
  a.assignedToId = i.toId; a.assignedToName = i.toName; a.assignedToRole = i.toRole
  a.assignedAt = now().label
  a.acknowledgedAt = undefined; a.acknowledgedById = undefined; a.acknowledgedByName = undefined
  emit()
}
export function escalate(id: string, byId?: string, byName?: string) {
  const a = ensure(id)
  a.escalated = true
  record(a, { action: 'escalated', byId, byName })
  emit()
}
export function setManualPriority(id: string, priority: Priority) { const a = ensure(id); a.priorityOverride = priority; emit() }
export function setDue(id: string, dueAt: string) { const a = ensure(id); a.dueAt = dueAt; emit() }
export function addNote(id: string, note: string) { const a = ensure(id); a.note = note; emit() }

/** Aplica el overlay de responsabilidad a los WorkItems (owner/prioridad/escalamiento/due). */
export function applyOverrides(items: WorkItem[]): WorkItem[] {
  return items.map((it) => {
    const a = assignments.get(it.id)
    if (!a) return it
    const roleForLabel = a.assignedToRole
    return {
      ...it,
      owner: a.assignedToName
        ? { role: roleForLabel ?? it.owner?.role ?? 'coordinador', team: a.assignedToRole ? undefined : it.owner?.team, label: a.assignedToName }
        : it.owner,
      escalationState: a.escalated ? 'escalated' : it.escalationState,
      priority: a.priorityOverride ?? it.priority,
      dueLabel: a.dueAt ?? it.dueLabel,
    }
  })
}

export function useCoordinatorStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { applyOverrides, getAssignment, listAssignments, assignmentsForUser }
}
