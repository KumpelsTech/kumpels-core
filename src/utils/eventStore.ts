import { useSyncExternalStore } from 'react'
import type { DomainEventInput, DomainEventRecord, EventQuery } from '../types/domainEvent'
import { newId } from './ids'
import { PATIENTS } from '../data/patients'
import { getValidationRun } from '../data/review'
import { ORDERS, BASE_FULFILLMENTS } from '../data/fulfillment'
import { PREPARATION_ORDERS, SEED_INSTANCES } from '../data/preparation'

/**
 * Almacén de eventos APPEND-ONLY (en memoria, sesión). Fuente única de la
 * historia de dominio: alimenta la Actividad de Patient 360 y, en el futuro,
 * auditoría/analítica/integraciones. No se editan ni borran eventos.
 *
 * Es también el adaptador de persistencia in-memory del EventRepository
 * (repositories/inMemory.ts). Sustituible por una BD real sin tocar la UI.
 */
const events: DomainEventRecord[] = []
const listeners = new Set<() => void>()
let seq = 0
let version = 0
let seeded = false

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { ensureSeeded(); listeners.add(l); return () => listeners.delete(l) }

/** Añade un evento a la historia (asigna id/seq/version). Nunca modifica los previos. */
export function appendEvent(input: DomainEventInput): DomainEventRecord {
  ensureSeeded()
  seq += 1
  const record: DomainEventRecord = {
    ...input,
    id: newId('evt'),
    seq,
    occurredAt: input.occurredAt ?? nowLabel(),
    version: input.version ?? 1,
  }
  events.push(record)
  emit()
  return record
}

function nowLabel(): string {
  return `Hoy ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}

/* ---- consultas (append-only; solo lectura) ---- */
function matches(e: DomainEventRecord, q: EventQuery): boolean {
  if (q.patientId && e.patientId !== q.patientId) return false
  if (q.episodeId && e.episodeId !== q.episodeId) return false
  if (q.sourceDomain && e.sourceDomain !== q.sourceDomain) return false
  if (q.sourceEntityType && e.sourceEntityType !== q.sourceEntityType) return false
  if (q.sourceEntityId && e.sourceEntityId !== q.sourceEntityId) return false
  if (q.types && !q.types.includes(e.type)) return false
  if (q.since != null && e.seq < q.since) return false
  if (q.until != null && e.seq > q.until) return false
  return true
}

export function queryEvents(q: EventQuery = {}): DomainEventRecord[] {
  ensureSeeded()
  const out = events.filter((e) => matches(e, q))
  return q.limit != null ? out.slice(-q.limit) : out
}

/** Eventos de un paciente, más recientes primero. */
export function eventsForPatient(patientId: string, limit = 6): DomainEventRecord[] {
  return queryEvents({ patientId }).slice().reverse().slice(0, limit)
}

/** Eventos ligados a una entidad de origen (preparación, pendiente, etc.). */
export function eventsForEntity(sourceEntityType: string, sourceEntityId: string): DomainEventRecord[] {
  return queryEvents({ sourceEntityType, sourceEntityId })
}

export function allEvents(): readonly DomainEventRecord[] { ensureSeeded(); return events }

export function useEventStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { queryEvents, eventsForPatient, eventsForEntity }
}

/* ---- baseline: proyección de la historia existente hacia eventos ---- */
/**
 * Backfill de la historia desde los datos de dominio existentes (NO un dataset
 * de timeline aparte). Convierte corridas de validación, órdenes/dispensaciones,
 * pendientes y preparaciones sembradas en eventos canónicos, para que la
 * Actividad no arranque vacía. Las acciones de la sesión se anexan después.
 */
function ensureSeeded() {
  if (seeded) return
  seeded = true
  const add = (r: DomainEventInput) => { seq += 1; events.push({ ...r, id: newId('evt'), seq, occurredAt: r.occurredAt ?? 'Reciente', version: 1 }) }

  // Cumplimiento: orden → dispensaciones → pendiente → contactos
  for (const o of ORDERS) {
    if (!PATIENTS.some((p) => p.id === o.patientId)) continue
    const f = BASE_FULFILLMENTS[o.id]
    add({ type: 'MEDICATION_ORDER_CREATED', sourceDomain: 'fulfillment', sourceEntityType: 'MedicationOrder', sourceEntityId: o.id, patientId: o.patientId, occurredAt: o.createdAt, summary: o.medication })
    const dispensed = f.dispenses.reduce((s, d) => s + d.quantity, 0)
    for (const d of f.dispenses) {
      add({ type: d.kind === 'restante' ? 'DISPENSE_COMPLETED' : 'DISPENSE_PARTIAL', sourceDomain: 'fulfillment', sourceEntityType: 'MedicationDispense', sourceEntityId: d.id, patientId: o.patientId, occurredAt: d.at, actorId: d.by, summary: `${d.quantity} ${o.unitLabel}` })
    }
    if (o.orderedQuantity - dispensed > 0) {
      add({ type: 'MEDICATION_PENDING_CREATED', sourceDomain: 'fulfillment', sourceEntityType: 'MedicationFulfillment', sourceEntityId: o.id, patientId: o.patientId, occurredAt: f.pendingSince, summary: `${o.orderedQuantity - dispensed} ${o.unitLabel} pendiente(s)` })
    }
    for (const c of f.contacts) {
      add({ type: 'PATIENT_CONTACTED', sourceDomain: 'fulfillment', sourceEntityType: 'MedicationFulfillment', sourceEntityId: o.id, patientId: o.patientId, occurredAt: c.at, summary: `${c.channel} · ${c.result}` })
    }
  }

  // Revisión clínica: corrida de validación por paciente
  for (const p of PATIENTS) {
    const run = getValidationRun(p.id)
    if (!run) continue
    add({ type: 'CLINICAL_REVIEW_CREATED', sourceDomain: 'clinical-review', sourceEntityType: 'ValidationRun', sourceEntityId: p.id, patientId: p.id, occurredAt: run.ranAt, summary: run.summary.requierenRevision > 0 ? `${run.summary.requierenRevision} requieren revisión` : 'Sin hallazgos que requieran revisión' })
  }

  // Preparación estéril: orden e instancia sembrada
  for (const po of PREPARATION_ORDERS) {
    add({ type: 'PREPARATION_ORDER_CREATED', sourceDomain: 'preparation', sourceEntityType: 'PreparationOrder', sourceEntityId: po.id, patientId: po.patientId, occurredAt: po.events[0]?.at, summary: `${po.medication}${po.cycleDay ? ` · ${po.cycleDay}` : ''}` })
    const inst = SEED_INSTANCES[po.id]
    if (inst?.startedAt) add({ type: 'PREPARATION_STARTED', sourceDomain: 'preparation', sourceEntityType: 'PreparationInstance', sourceEntityId: po.id, patientId: po.patientId, occurredAt: inst.startedAt, actorId: inst.preparedBy })
    if (inst?.completedAt) add({ type: 'PREPARATION_COMPLETED', sourceDomain: 'preparation', sourceEntityType: 'PreparationInstance', sourceEntityId: po.id, patientId: po.patientId, occurredAt: inst.completedAt, actorId: inst.preparedBy })
  }
}
