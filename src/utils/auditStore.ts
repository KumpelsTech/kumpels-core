import { useSyncExternalStore } from 'react'
import type { AuditInput, AuditRecord } from '../types/audit'
import { newId } from './ids'
import { now } from './datetime'

/**
 * Almacén de AUDITORÍA APPEND-ONLY (en memoria, sesión). Traza de cambios
 * "quién/qué/antes→después/cuándo/por qué", separada del EventRepository
 * (hechos de flujo) y de la proyección de actividad (UI). No se edita ni borra.
 *
 * Es el adaptador in-memory del AuditRepository futuro; sustituible por una BD
 * real sin tocar la UI. Preserva ids estables y orden (seq).
 */
const records: AuditRecord[] = []
const listeners = new Set<() => void>()
let seq = 0
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

/** Añade un registro de auditoría (asigna id/seq/at/version). Nunca modifica los previos. */
export function recordAudit(input: AuditInput): AuditRecord {
  seq += 1
  const stamp = now()
  const rec: AuditRecord = {
    ...input,
    id: newId('aud'),
    seq,
    at: input.at ?? stamp.label,
    atIso: input.atIso ?? stamp.iso,
    version: input.version ?? 1,
  }
  records.push(rec)
  emit()
  return rec
}

/* ---- consultas (append-only; solo lectura, más recientes primero) ---- */
export function auditForEntity(entityType: string, entityId: string): AuditRecord[] {
  return records.filter((r) => r.entityType === entityType && r.entityId === entityId).slice().reverse()
}
export function auditForPatient(patientId: string): AuditRecord[] {
  return records.filter((r) => r.patientId === patientId).slice().reverse()
}
export function allAudit(): readonly AuditRecord[] { return records }

export function useAuditStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { auditForEntity, auditForPatient }
}
