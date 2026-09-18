import { useSyncExternalStore } from 'react'
import type { FollowUpAssessment } from '../types/careFollowup'

/**
 * Historia APPEND-ONLY de evaluaciones de seguimiento registradas por el
 * profesional, indexada por patientId. Persiste durante la sesión. Separada del
 * enrollment (dato base) y del paciente. NO crea intervenciones automáticamente.
 *
 * `getAssessment` devuelve el seguimiento vigente (último); `getAssessmentHistory`
 * la traza completa (distinguir actual vs anterior).
 */
const histories = new Map<string, FollowUpAssessment[]>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getAssessment(patientId: string): FollowUpAssessment | undefined {
  const h = histories.get(patientId)
  return h && h.length ? h[h.length - 1] : undefined
}
export function getAssessmentHistory(patientId: string): FollowUpAssessment[] {
  return histories.get(patientId) ?? []
}
export function setAssessment(patientId: string, a: FollowUpAssessment) {
  const prev = getAssessment(patientId)
  const entry: FollowUpAssessment = prev ? { ...a, previousAssessmentAt: prev.at } : a
  histories.set(patientId, [...(histories.get(patientId) ?? []), entry])
  emit()
}

/** Read model reactivo. Mutaciones vía services.pharmaceuticalCare; setAssessment
 * queda a nivel de módulo para el adaptador de repositorio, no para la UI. */
export function useCareStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getAssessment, getAssessmentHistory }
}
