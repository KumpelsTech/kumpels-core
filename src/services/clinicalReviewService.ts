import type { ProfessionalReview } from '../types/review'
import type { ValidationRepository } from '../repositories/types'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Revisión Clínica. Orquesta la decisión profesional
 * sobre un hallazgo, la persiste vía repositorio y emite el evento de dominio.
 * Sin comportamiento de UI.
 */
export function makeClinicalReviewService(repo: ValidationRepository) {
  return {
    async recordDecision(findingId: string, review: ProfessionalReview, patientId?: string): Promise<void> {
      const prev = await repo.getDecision(findingId)
      await repo.saveDecision(findingId, review)
      // Auditoría: quién decidió, de qué a qué, cuándo y por qué (traza separada
      // del evento de flujo; una edición NO sobreescribe la decisión previa).
      recordAudit({
        action: prev ? 'REVIEW_DECISION_EDITED' : 'REVIEW_DECISION',
        entityType: 'Finding', entityId: findingId, patientId,
        actorId: review.by, actorName: review.by, actorRole: review.role ?? '—',
        at: review.at, atIso: review.atIso,
        previousState: prev?.outcome, newState: review.outcome, reason: review.comment,
        source: 'clinical-review', sourceSystem: 'kumpels',
      })
      // Evento del ciclo de vida de la revisión + evento específico del resultado.
      emitEvent({
        type: 'CLINICAL_REVIEW_COMPLETED', sourceDomain: 'clinical-review',
        sourceEntityType: 'Finding', sourceEntityId: findingId, patientId,
        occurredAt: review.at || auditNow(), actorId: review.by, actorRole: review.role, actorType: 'user',
        summary: review.outcome,
        previousState: prev?.outcome, newState: review.outcome, reason: review.comment,
        source: 'clinical-review', sourceSystem: 'kumpels',
      })
      if (review.outcome === 'Confirmado' || review.outcome === 'Descartado') {
        emitEvent({
          type: review.outcome === 'Confirmado' ? 'FINDING_CONFIRMED' : 'FINDING_DISMISSED',
          sourceDomain: 'clinical-review', sourceEntityType: 'Finding', sourceEntityId: findingId, patientId,
          occurredAt: review.at || auditNow(), actorId: review.by, actorRole: review.role, actorType: 'user',
          reason: review.comment, source: 'clinical-review', sourceSystem: 'kumpels',
        })
      }
    },
  }
}
export type ClinicalReviewService = ReturnType<typeof makeClinicalReviewService>
