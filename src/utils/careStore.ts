import { useSyncExternalStore } from 'react'
import type { FollowUpAssessment } from '../types/careFollowup'

/**
 * Store en memoria de evaluaciones de seguimiento registradas por el profesional,
 * indexado por patientId. Persiste durante la sesión. Separado del enrollment
 * (dato base) y del paciente. NO crea intervenciones automáticamente.
 */
const assessments = new Map<string, FollowUpAssessment>()
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getAssessment(patientId: string): FollowUpAssessment | undefined {
  return assessments.get(patientId)
}
export function setAssessment(patientId: string, a: FollowUpAssessment) {
  assessments.set(patientId, a)
  emit()
}

/** Read model reactivo. Mutaciones vía services.pharmaceuticalCare; setAssessment
 * queda a nivel de módulo para el adaptador de repositorio, no para la UI. */
export function useCareStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getAssessment }
}
