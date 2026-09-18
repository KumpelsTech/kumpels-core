import type { ActorRef } from '../types/actor'
import type { OrderChangeType } from '../types/orderChange'
import { ORDER_CHANGE_LABEL } from '../types/orderChange'
import { setOrderChange } from '../utils/orderChangeStore'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { ORDERS } from '../data/fulfillment'
import { emitEvent, recordAudit } from './eventBus'

/**
 * Servicio de aplicación: cambio de orden de medicación. Requiere capacidad
 * MEDICATION_ORDER_CHANGE (autoridad clínica/coordinación). Registra el cambio,
 * emite evento y auditoría; el impacto aguas abajo lo evalúa DownstreamImpact
 * (utils/downstreamImpact) de forma determinista.
 */
export function makeOrderChangeService() {
  return {
    async registerChange(orderId: string, input: { changeType: OrderChangeType; reason: string }, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const user = getUser(actor.id)
      const el = user ? evaluateEligibility(user, { capability: 'MEDICATION_ORDER_CHANGE' }) : { eligible: false, reason: 'Usuario no encontrado' as string }
      if (!el.eligible) return { ok: false, reason: el.reason }
      const rec = setOrderChange(orderId, { ...input, actorId: actor.id, actorName: actor.name, actorRole: actor.role })
      const order = ORDERS.find((o) => o.id === orderId)
      emitEvent({
        type: 'MEDICATION_ORDER_CHANGED', sourceDomain: 'fulfillment', sourceEntityType: 'MedicationOrder', sourceEntityId: orderId,
        patientId: order?.patientId, occurredAt: rec.at, actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: ORDER_CHANGE_LABEL[input.changeType], newState: ORDER_CHANGE_LABEL[input.changeType], reason: input.reason,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'MEDICATION_ORDER_CHANGED', entityType: 'MedicationOrder', entityId: orderId, patientId: order?.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        newState: ORDER_CHANGE_LABEL[input.changeType], reason: input.reason, source: 'fulfillment', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },
  }
}
export type OrderChangeService = ReturnType<typeof makeOrderChangeService>
