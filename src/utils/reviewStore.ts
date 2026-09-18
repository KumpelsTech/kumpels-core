import { useSyncExternalStore } from 'react'
import type { ProfessionalReview } from '../types/review'

/**
 * Historia APPEND-ONLY de decisiones profesionales, indexada por finding id.
 * La detección automática (Finding) vive en data/review; la decisión humana
 * (ProfessionalReview) se registra aquí, separada. Persiste durante la sesión.
 *
 * No hay reemplazo silencioso: editar una decisión AÑADE un registro nuevo que
 * conserva el previo (previousOutcome). `getReview` devuelve la decisión vigente
 * (última); `getReviewHistory`, la traza completa.
 */
const histories = new Map<string, ProfessionalReview[]>()
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

/** Decisión vigente (la más reciente) sobre un hallazgo. */
export function getReview(findingId: string): ProfessionalReview | undefined {
  const h = histories.get(findingId)
  return h && h.length ? h[h.length - 1] : undefined
}

/** Historia completa de decisiones sobre un hallazgo (más antigua → más reciente). */
export function getReviewHistory(findingId: string): ProfessionalReview[] {
  return histories.get(findingId) ?? []
}

/** Registra una decisión NUEVA (no sobreescribe): conserva la anterior. */
export function setReview(findingId: string, review: ProfessionalReview) {
  const prev = getReview(findingId)
  const entry: ProfessionalReview = prev ? { ...review, previousOutcome: prev.outcome } : review
  histories.set(findingId, [...(histories.get(findingId) ?? []), entry])
  emit()
}

/**
 * Read model reactivo. Solo lectura: las mutaciones pasan por la capa de
 * servicios (services.clinicalReview). setReview sigue exportado a nivel de
 * módulo para el adaptador de repositorio in-memory, no para la UI.
 */
export function useReviewStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { getReview, getReviewHistory }
}
