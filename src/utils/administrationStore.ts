import { useSyncExternalStore } from 'react'
import type { AdministrationResult, MedicationAdministration } from '../types/administration'

/**
 * Estado de ADMINISTRACIÓN de medicación (en memoria, sesión). Fuente única para
 * Patient 360 y la actividad. Registro append-oriented por administración; se
 * indexa la última por orden de preparación para la vista operativa.
 */
const admins = new Map<string, MedicationAdministration>()
const byOrder = new Map<string, string>()
const listeners = new Set<() => void>()
let version = 0
let seeded = false

/** Administración sembrada — un tratamiento ya COMPLETADO (Andrés · PREP-3306). */
function seed() {
  if (seeded) return
  seeded = true
  const a: MedicationAdministration = {
    id: 'ADM-3306', preparationOrderId: 'PREP-3306', medicationOrderId: 'ORD-2055', patientId: 'ONC-2055',
    medication: 'Pembrolizumab', dose: '200 mg', route: 'IV (infusión)', preparationRef: 'PREP-3306',
    scheduledAt: 'Hoy 15:30', startedAt: 'Hoy 14:40', completedAt: 'Hoy 15:12',
    result: 'administrada', performerId: 'USR-4', performerName: 'Equipo de Enfermería', performerRole: 'Enfermería',
    at: 'Hoy 15:12', atIso: '2026-09-15T15:12:00-05:00', source: 'administration', sourceSystem: 'kumpels', version: 1,
  }
  admins.set(a.id, a); byOrder.set(a.preparationOrderId!, a.id)
}

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { seed(); listeners.add(l); return () => listeners.delete(l) }

export function getAdministration(id: string): MedicationAdministration | undefined { seed(); return admins.get(id) }
export function getAdministrationForOrder(preparationOrderId: string): MedicationAdministration | undefined {
  seed()
  const id = byOrder.get(preparationOrderId)
  return id ? admins.get(id) : undefined
}

export function recordAdministration(a: MedicationAdministration) {
  admins.set(a.id, a)
  if (a.preparationOrderId) byOrder.set(a.preparationOrderId, a.id)
  emit()
}

/**
 * Aplica una corrección a la proyección vigente de una administración (el previo
 * queda conservado en el CorrectionRecord). No es una edición silenciosa: sube la
 * versión y, para "registrado por error", marca enteredInError.
 */
export function applyAdministrationCorrection(id: string, patch: Partial<MedicationAdministration>): MedicationAdministration | undefined {
  const a = admins.get(id)
  if (!a) return undefined
  const updated: MedicationAdministration = { ...a, ...patch, version: a.version + 1 }
  admins.set(id, updated)
  emit()
  return updated
}

export function useAdministrationStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getAdministration, getAdministrationForOrder }
}

export const ADMIN_RESULT_LABEL: Record<AdministrationResult, string> = {
  administrada: 'Administrada', parcial: 'Parcial', detenida: 'Detenida / interrumpida', 'no-administrada': 'No administrada',
}

export const REMAINDER_STATUS_LABEL: Record<string, string> = {
  RETURNED: 'Devuelto', DISCARDED: 'Descartado', HELD_FOR_REVIEW: 'Retenido para revisión',
  REUSABLE_PER_POLICY: 'Reutilizable según política', DESTROYED: 'Destruido', UNKNOWN: 'Desconocido', OTHER: 'Otro',
}
