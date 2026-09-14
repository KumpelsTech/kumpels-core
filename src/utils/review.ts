import type { Finding } from '../types/review'
import type { Priority } from '../types/patient'
import { getValidationRun } from '../data/review'
import { getReview } from './reviewStore'

/**
 * Selectores CANÓNICOS de revisión clínica. Combinan la detección automática
 * (ValidationRun → Finding, en data/review) con la decisión profesional
 * (ProfessionalReview, en reviewStore). Antes esta regla estaba duplicada en
 * preparationReadiness y workItems; ahora vive aquí y ambos la reutilizan.
 *
 * Un hallazgo está "sin resolver" cuando exige revisión profesional y aún no
 * tiene decisión (Confirmado/Descartado) — es decir, sin review o Pendiente.
 */
function isUnresolved(findingId: string): boolean {
  const r = getReview(findingId)
  return !r || r.outcome === 'Pendiente'
}

/** Hallazgos que requieren revisión profesional y siguen sin resolver. */
export function unresolvedReviewFindings(patientId: string): Finding[] {
  const run = getValidationRun(patientId)
  if (!run) return []
  return run.findings.filter((f) => f.status === 'Revisión profesional requerida' && isUnresolved(f.id))
}

/** ¿La revisión clínica del paciente está pendiente? (para readiness de preparación). */
export function clinicalReviewPending(patientId: string): { pending: boolean; count: number } {
  const u = unresolvedReviewFindings(patientId)
  return { pending: u.length > 0, count: u.length }
}

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, ACTION: 1, MONITOR: 2 }

/** Peor severidad entre los hallazgos sin resolver (o 'MONITOR' por defecto). */
export function reviewPriority(patientId: string): Priority {
  return unresolvedReviewFindings(patientId).reduce<Priority>(
    (acc, f) => (f.severity && PRIORITY_RANK[f.severity] < PRIORITY_RANK[acc] ? f.severity : acc),
    'MONITOR',
  )
}
