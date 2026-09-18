import { useSyncExternalStore } from 'react'
import type { CorrectionRecord } from '../types/correction'
import { newId } from './ids'
import { now } from './datetime'

/**
 * Almacén de CORRECCIONES APPEND-ONLY (en memoria, sesión). Traza de correcciones
 * controladas sobre registros clínicos (administración, revisión…). Separado del
 * registro original: conserva previo → corregido, actor, motivo y momento. No se
 * edita ni borra. Es el adaptador in-memory del CorrectionRepository futuro.
 */
const records: CorrectionRecord[] = []
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export type CorrectionInput = Omit<CorrectionRecord, 'id' | 'occurredAt' | 'occurredAtIso' | 'version'>

export function recordCorrection(input: CorrectionInput): CorrectionRecord {
  const stamp = now()
  const rec: CorrectionRecord = { ...input, id: newId('corr'), occurredAt: stamp.label, occurredAtIso: stamp.iso, version: 1 }
  records.push(rec)
  emit()
  return rec
}

/** Correcciones de una entidad, más recientes primero. */
export function correctionsFor(targetEntityType: string, targetEntityId: string): CorrectionRecord[] {
  return records.filter((r) => r.targetEntityType === targetEntityType && r.targetEntityId === targetEntityId).slice().reverse()
}

export function useCorrectionStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { correctionsFor }
}
