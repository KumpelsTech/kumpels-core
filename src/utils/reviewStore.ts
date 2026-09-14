import { useSyncExternalStore } from 'react'
import type { ProfessionalReview } from '../types/review'

/**
 * Store en memoria de decisiones profesionales, indexado por finding id.
 * La detección automática (Finding) vive en data/review; la decisión humana
 * (ProfessionalReview) se registra aquí, separada. Persiste durante la sesión.
 */
const outcomes = new Map<string, ProfessionalReview>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getReview(findingId: string): ProfessionalReview | undefined {
  return outcomes.get(findingId)
}

export function setReview(findingId: string, review: ProfessionalReview) {
  outcomes.set(findingId, review)
  emit()
}

/**
 * Read model reactivo. Solo lectura: las mutaciones pasan por la capa de
 * servicios (services.clinicalReview). setReview sigue exportado a nivel de
 * módulo para el adaptador de repositorio in-memory, no para la UI.
 */
export function useReviewStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getReview }
}
