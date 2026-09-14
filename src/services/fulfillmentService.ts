import type { CommState, ContactEntry } from '../types/fulfillment'
import type { FulfillmentRepository } from '../repositories/types'
import { emitEvent, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Cumplimiento / Pendientes. Contacto con el paciente,
 * actualización de disponibilidad y resolución del pendiente. Emite eventos de
 * dominio hacia el almacén append-only.
 */
export function makeFulfillmentService(repo: FulfillmentRepository) {
  return {
    async registerContact(orderId: string, entry: Omit<ContactEntry, 'id' | 'at'>, state: CommState, actor: string): Promise<void> {
      const v = await repo.get(orderId)
      await repo.registerContact(orderId, entry, state)
      emitEvent({
        type: 'PATIENT_CONTACTED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: v.order.patientId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: `${entry.channel} · ${entry.result}`, newState: state,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },

    async updateAvailability(orderId: string, value: string, actor: string): Promise<void> {
      const v = await repo.get(orderId)
      await repo.updateAvailability(orderId, value)
      emitEvent({
        type: 'MEDICATION_AVAILABILITY_UPDATED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: v.order.patientId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: value, source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },

    async resolvePending(orderId: string, actor: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.resolvePending(orderId)
      const after = await repo.get(orderId)
      // El saldo entregado completa la dispensación, lo que resuelve el pendiente.
      emitEvent({
        type: 'DISPENSE_COMPLETED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationDispense', sourceEntityId: `${orderId}-restante`, patientId: before.order.patientId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: `${before.remaining} ${before.order.unitLabel}`, source: 'fulfillment', sourceSystem: 'kumpels',
      })
      emitEvent({
        type: 'MEDICATION_PENDING_RESOLVED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: before.order.patientId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        previousState: before.status, newState: after.status, source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },
  }
}
export type FulfillmentService = ReturnType<typeof makeFulfillmentService>
