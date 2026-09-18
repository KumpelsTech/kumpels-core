import type { ActorRef } from '../types/actor'
import type { ProductionRepository } from '../repositories/types'
import type { ProductionRequestInput } from '../utils/productionStore'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: SOLICITUD DE PRODUCCIÓN (handoff Enfermería → Central de
 * Mezclas). Enviar/cancelar requieren capacidad + elegibilidad; NO crean una
 * prescripción. Cada acción emite evento de dominio y registra auditoría.
 */
export function makeProductionService(repo: ProductionRepository) {
  return {
    async send(input: ProductionRequestInput, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'PRODUCTION_REQUEST_SEND', facilityId: undefined, programId: undefined }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const before = await repo.get(input.preparationOrderId)
      const r = await repo.send(input, { id: actor.id, name: actor.name, role: actor.role })
      emitEvent({
        type: 'PRODUCTION_REQUEST_SENT', sourceDomain: 'production', sourceEntityType: 'ProductionRequest', sourceEntityId: r.id,
        patientId: input.patientId, occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: 'Enviado a Central de Mezclas', previousState: before?.status ?? 'DRAFT', newState: 'SENT_TO_PRODUCTION', reason: input.note,
        source: 'production', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PRODUCTION_REQUEST_SENT', entityType: 'ProductionRequest', entityId: r.id, patientId: input.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: before?.status ?? 'READY_TO_SEND', newState: 'SENT_TO_PRODUCTION', reason: input.note,
        source: 'production', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },

    /**
     * Central de Mezclas ACEPTA (acuse). Requiere capacidad PRODUCTION_REQUEST_ACCEPT.
     * `auto` = aceptación implícita al iniciar la preparación: NO salta la propiedad,
     * produce la MISMA historia de auditoría/evento. No re-guarda si `auto` (el guard
     * de la acción de preparación ya aplica).
     */
    async accept(preparationOrderId: string, patientId: string, actor: ActorRef, auto = false): Promise<{ ok: boolean; reason?: string }> {
      if (!auto) {
        const user = getUser(actor.id)
        const el = user ? evaluateEligibility(user, { capability: 'PRODUCTION_REQUEST_ACCEPT' }) : { eligible: false, reason: 'Usuario no encontrado' as string }
        if (!el.eligible) return { ok: false, reason: el.reason }
      }
      const r = await repo.accept(preparationOrderId, { id: actor.id, name: actor.name, role: actor.role }, auto)
      if (!r) return { ok: false, reason: 'La solicitud no está en estado enviado' }
      emitEvent({
        type: 'PRODUCTION_REQUEST_ACCEPTED', sourceDomain: 'production', sourceEntityType: 'ProductionRequest', sourceEntityId: r.id,
        patientId, occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: auto ? 'Aceptación automática al iniciar preparación' : 'Solicitud de producción aceptada',
        previousState: 'SENT_TO_PRODUCTION', newState: 'ACCEPTED_BY_COMPOUNDING', reason: auto ? 'Aceptación automática al iniciar preparación' : undefined,
        source: 'production', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PRODUCTION_REQUEST_ACCEPTED', entityType: 'ProductionRequest', entityId: r.id, patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: 'SENT_TO_PRODUCTION', newState: 'ACCEPTED_BY_COMPOUNDING', reason: auto ? 'Aceptación automática al iniciar preparación' : undefined,
        source: 'production', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },

    async cancel(preparationOrderId: string, patientId: string, reason: string, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'PRODUCTION_REQUEST_CANCEL' }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const before = await repo.get(preparationOrderId)
      const res = await repo.cancel(preparationOrderId, reason, { id: actor.id, name: actor.name, role: actor.role })
      if (!res.ok) return res
      emitEvent({
        type: 'PRODUCTION_REQUEST_CANCELLED', sourceDomain: 'production', sourceEntityType: 'ProductionRequest', sourceEntityId: before?.id ?? preparationOrderId,
        patientId, occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        previousState: before?.status, newState: 'CANCELLED', reason, source: 'production', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PRODUCTION_REQUEST_CANCELLED', entityType: 'ProductionRequest', entityId: before?.id ?? preparationOrderId, patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role, previousState: before?.status, newState: 'CANCELLED', reason,
        source: 'production', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },
  }
}
export type ProductionService = ReturnType<typeof makeProductionService>
