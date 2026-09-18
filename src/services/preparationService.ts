import type { ActorRef } from '../types/actor'
import type { RejectionReasonDef } from '../config/rejectionReasons'
import type { PreparationRepository, PrepActionResult } from '../repositories/types'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { MIXING_SCOPE } from '../data/admin'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Preparación estéril. Transiciones del flujo
 * (iniciar → finalizar → verificar → liberar) como acciones separadas y
 * trazables; cada una emite su evento de dominio y registra auditoría (actor,
 * antes→después, fecha+hora exactas). Verificar/liberar aplican la política de
 * segregación de funciones: si se bloquea, NO se emite evento ni auditoría.
 */
export function makePreparationService(repo: PreparationRepository) {
  const base = (orderId: string, patientId: string, by: string) => ({
    sourceDomain: 'preparation' as const, sourceEntityId: orderId, patientId,
    occurredAt: auditNow(), actorId: by, actorType: 'user' as const,
    source: 'preparation', sourceSystem: 'kumpels',
  })
  const audit = (orderId: string, patientId: string, by: string, action: string, previousState: string, newState: string) =>
    recordAudit({
      action, entityType: 'PreparationInstance', entityId: orderId, patientId,
      actorId: by, actorName: by, actorRole: 'Central de Mezclas',
      previousState, newState, source: 'preparation', sourceSystem: 'kumpels',
    })
  return {
    async start(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.start(orderId, by)
      emitEvent({ type: 'PREPARATION_STARTED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: before.status, newState: 'en-preparacion' })
      audit(orderId, before.order.patientId, by, 'PREPARATION_STARTED', before.status, 'en-preparacion')
    },
    async complete(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.complete(orderId)
      emitEvent({ type: 'PREPARATION_COMPLETED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: before.status, newState: 'pendiente-verificacion' })
      emitEvent({ type: 'COMPONENT_USAGE_RECORDED', sourceEntityType: 'ComponentUsage', ...base(orderId, before.order.patientId, by), summary: before.order.medication })
      audit(orderId, before.order.patientId, by, 'PREPARATION_COMPLETED', before.status, 'pendiente-verificacion')
    },
    async verify(orderId: string, by: string): Promise<PrepActionResult> {
      const before = await repo.get(orderId)
      const res = await repo.verify(orderId, by)
      if (!res.ok) return res
      emitEvent({ type: 'PREPARATION_VERIFIED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: 'pendiente-verificacion', newState: 'verificada' })
      audit(orderId, before.order.patientId, by, 'PREPARATION_VERIFIED', 'pendiente-verificacion', 'verificada')
      return res
    },
    async release(orderId: string, by: string): Promise<PrepActionResult> {
      const before = await repo.get(orderId)
      const res = await repo.release(orderId, by)
      if (!res.ok) return res
      emitEvent({ type: 'PREPARATION_RELEASED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: 'verificada', newState: 'liberada' })
      audit(orderId, before.order.patientId, by, 'PREPARATION_RELEASED', 'verificada', 'liberada')
      return res
    },

    /**
     * Reemplazo CONTROLADO de una preparación verificada/liberada. Requiere
     * capacidad PREPARATION_REPLACE + alcance de Central de Mezclas. Preserva la
     * genealogía de la anterior; crea una nueva preparación que la reemplaza.
     */
    async replace(oldOrderId: string, opts: { reason: string; correctedDose?: string; sourceChange?: string }, actor: ActorRef): Promise<{ ok: boolean; newId?: string; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'PREPARATION_REPLACE', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const before = await repo.get(oldOrderId)
      const res = await repo.supersede(oldOrderId, opts, { id: actor.id, name: actor.name, role: actor.role })
      if (!res.ok) return res
      emitEvent({
        type: 'PREPARATION_REPLACED', sourceDomain: 'preparation', sourceEntityType: 'PreparationOrder', sourceEntityId: oldOrderId,
        patientId: before.order.patientId, occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: `${oldOrderId} → ${res.newId}`, previousState: oldOrderId, newState: res.newId, reason: opts.reason,
        source: 'preparation', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PREPARATION_REPLACED', entityType: 'PreparationOrder', entityId: oldOrderId, patientId: before.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: oldOrderId, newState: res.newId, reason: opts.reason, source: 'preparation', sourceSystem: 'kumpels',
      })
      return res
    },

    /**
     * Rechazo de Enfermería (barrera final de seguridad) sobre una preparación
     * liberada. Requiere capacidad MEDICATION_ADMINISTRATION. No cancela: pasa a
     * HOLD y genera resolución para el equipo responsable según el motivo.
     */
    async rejectByNursing(orderId: string, reason: RejectionReasonDef, comment: string | undefined, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'MEDICATION_ADMINISTRATION' }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const before = await repo.get(orderId)
      const res = await repo.rejectByNursing(orderId, { reasonCode: reason.code, reasonLabel: reason.label, comment, ownerRole: reason.ownerRole, ownerLabel: reason.ownerLabel }, { id: actor.id, name: actor.name, role: actor.role })
      if (!res.ok) return res
      emitEvent({
        type: 'PREPARATION_REJECTED_BY_NURSING', sourceDomain: 'preparation', sourceEntityType: 'PreparationOrder', sourceEntityId: orderId,
        patientId: before.order.patientId, occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: reason.label, previousState: 'liberada', newState: 'rechazada-hold', reason: comment ?? reason.label,
        source: 'preparation', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PREPARATION_REJECTED_BY_NURSING', entityType: 'PreparationOrder', entityId: orderId, patientId: before.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: 'liberada', newState: `rechazada-hold (${reason.label})`, reason: comment ?? reason.label,
        source: 'preparation', sourceSystem: 'kumpels',
      })
      return res
    },
  }
}
export type PreparationService = ReturnType<typeof makePreparationService>
