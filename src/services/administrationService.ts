import type { MedicationAdministration, AdministrationResult } from '../types/administration'
import type { CorrectionType } from '../types/correction'
import type { ActorRef } from '../types/actor'
import type { AdministrationRepository, AdministrationInput } from '../repositories/types'
import { newId } from '../utils/ids'
import { now } from '../utils/datetime'
import { ADMIN_RESULT_LABEL } from '../utils/administrationStore'
import { recordCorrection } from '../utils/correctionStore'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { emitEvent, recordAudit, auditNow } from './eventBus'

export interface AdministrationCorrectionInput {
  correctionType: CorrectionType
  corrected?: { result?: AdministrationResult; dose?: string; observation?: string }
  reason: string
  comment?: string
}

function adminSnapshot(a: MedicationAdministration): string {
  return `${ADMIN_RESULT_LABEL[a.result]} · ${a.dose}${a.observation ? ` · ${a.observation}` : ''}`
}

/**
 * Servicio de aplicación: Administración de medicación (enfermería). Crea la
 * entidad canónica MedicationAdministration, emite el evento de dominio y
 * registra la auditoría (actor · resultado · motivo si no se completó).
 */
export function makeAdministrationService(repo: AdministrationRepository) {
  return {
    async record(input: AdministrationInput, actor: ActorRef): Promise<MedicationAdministration> {
      const stamp = now()
      const admin: MedicationAdministration = {
        ...input,
        id: newId('adm'),
        performerId: actor.id, performerName: actor.name, performerRole: actor.role,
        at: stamp.label, atIso: stamp.iso, version: 1,
        source: 'administration', sourceSystem: 'kumpels',
      }
      await repo.record(admin)
      const incomplete = admin.result !== 'administrada'
      emitEvent({
        type: incomplete ? 'MEDICATION_ADMINISTRATION_INCOMPLETE' : 'MEDICATION_ADMINISTERED',
        sourceDomain: 'administration', sourceEntityType: 'MedicationAdministration', sourceEntityId: admin.id,
        patientId: admin.patientId, occurredAt: admin.at, actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: `${admin.medication} · ${ADMIN_RESULT_LABEL[admin.result]}`,
        newState: ADMIN_RESULT_LABEL[admin.result], reason: admin.reason,
        source: 'administration', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'MEDICATION_ADMINISTRATION', entityType: 'MedicationAdministration', entityId: admin.id, patientId: admin.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        newState: ADMIN_RESULT_LABEL[admin.result], reason: admin.reason,
        source: 'administration', sourceSystem: 'kumpels',
      })
      return admin
    },

    /**
     * Corrección CONTROLADA de una administración (no "Editar"): conserva el
     * original en un CorrectionRecord y actualiza la proyección vigente. Requiere
     * capacidad MEDICATION_ADMINISTRATION_CORRECT (ser administrador no basta).
     */
    async recordCorrectionFor(id: string, input: AdministrationCorrectionInput, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'MEDICATION_ADMINISTRATION_CORRECT' }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const before = await repo.getById(id)
      if (!before) return { ok: false, reason: 'Administración no encontrada' }

      const isError = input.correctionType === 'ENTERED_IN_ERROR'
      const patch: Partial<MedicationAdministration> = isError
        ? { enteredInError: true }
        : { ...(input.corrected?.result ? { result: input.corrected.result } : {}), ...(input.corrected?.dose ? { dose: input.corrected.dose } : {}), ...(input.corrected?.observation ? { observation: input.corrected.observation } : {}) }
      const after = await repo.applyCorrection(id, patch)
      const previousValue = adminSnapshot(before)
      const correctedValue = isError ? 'Registrado por error (anulada)' : adminSnapshot(after ?? before)

      recordCorrection({
        targetEntityType: 'MedicationAdministration', targetEntityId: id, correctionType: input.correctionType,
        previousValue, correctedValue, reason: input.reason, comment: input.comment,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        patientId: before.patientId, episodeId: before.episodeId,
      })
      emitEvent({
        type: 'MEDICATION_ADMINISTRATION_CORRECTED', sourceDomain: 'administration',
        sourceEntityType: 'MedicationAdministration', sourceEntityId: id, patientId: before.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: correctedValue, previousState: previousValue, newState: correctedValue, reason: input.reason,
        source: 'administration', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'MEDICATION_ADMINISTRATION_CORRECTED', entityType: 'MedicationAdministration', entityId: id, patientId: before.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: previousValue, newState: correctedValue, reason: input.reason,
        source: 'administration', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },
  }
}
export type AdministrationService = ReturnType<typeof makeAdministrationService>
