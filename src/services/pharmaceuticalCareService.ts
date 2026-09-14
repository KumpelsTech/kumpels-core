import type { FollowUpAssessment } from '../types/careFollowup'
import type { FollowUpRepository } from '../repositories/types'
import { emitEvent, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Atención Farmacéutica / Seguimiento. Registra la
 * evaluación del profesional; no genera intervenciones automáticas.
 */
export function makePharmaceuticalCareService(repo: FollowUpRepository) {
  return {
    async completeAssessment(patientId: string, assessment: FollowUpAssessment): Promise<void> {
      await repo.saveAssessment(patientId, assessment)
      emitEvent({
        // La entrevista inicial y el seguimiento comparten forma; el modo distingue el tipo.
        type: assessment.mode === 'entrevista-inicial' ? 'INITIAL_ASSESSMENT_COMPLETED' : 'FOLLOWUP_COMPLETED',
        sourceDomain: 'pharmaceutical-care', sourceEntityType: 'FollowUpAssessment', sourceEntityId: patientId, patientId,
        occurredAt: assessment.at || auditNow(), actorId: assessment.by, actorType: 'user',
        summary: assessment.continuidad, source: 'pharmaceutical-care', sourceSystem: 'kumpels',
      })
    },
  }
}
export type PharmaceuticalCareService = ReturnType<typeof makePharmaceuticalCareService>
