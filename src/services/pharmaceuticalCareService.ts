import type { FollowUpAssessment } from '../types/careFollowup'
import type { FollowUpRepository } from '../repositories/types'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Atención Farmacéutica / Seguimiento. Registra la
 * evaluación del profesional; no genera intervenciones automáticas. Emite el
 * evento de dominio y registra auditoría (actor · momento · continuidad).
 */
export function makePharmaceuticalCareService(repo: FollowUpRepository) {
  return {
    async completeAssessment(patientId: string, assessment: FollowUpAssessment): Promise<void> {
      await repo.saveAssessment(patientId, assessment)
      emitEvent({
        // La entrevista inicial y el seguimiento comparten forma; el modo distingue el tipo.
        type: assessment.mode === 'entrevista-inicial' ? 'INITIAL_ASSESSMENT_COMPLETED' : 'FOLLOWUP_COMPLETED',
        sourceDomain: 'pharmaceutical-care', sourceEntityType: 'FollowUpAssessment', sourceEntityId: patientId, patientId,
        occurredAt: assessment.at || auditNow(), actorId: assessment.by, actorRole: assessment.role, actorType: 'user',
        summary: assessment.continuidad, source: 'pharmaceutical-care', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: assessment.mode === 'entrevista-inicial' ? 'INITIAL_ASSESSMENT' : 'FOLLOWUP_ASSESSMENT',
        entityType: 'FollowUpAssessment', entityId: patientId, patientId,
        actorId: assessment.by, actorName: assessment.by, actorRole: assessment.role ?? '—',
        at: assessment.at, atIso: assessment.atIso,
        previousState: assessment.previousAssessmentAt, newState: assessment.continuidad,
        source: 'pharmaceutical-care', sourceSystem: 'kumpels',
      })
    },
  }
}
export type PharmaceuticalCareService = ReturnType<typeof makePharmaceuticalCareService>
