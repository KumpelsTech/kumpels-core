import type { ActorRef } from '../types/actor'
import type { FulfillmentRepository, ContactInput, DeliveryInput, ScheduleInput } from '../repositories/types'
import { emitEvent, recordAudit, auditNow } from './eventBus'
import { CONTACT_METHOD_LABEL, CONTACT_RESULT_LABEL, RECIPIENT_LABEL } from '../utils/fulfillmentStore'

/**
 * Servicio de aplicación: Cumplimiento / Dispensación. Contacto con el paciente,
 * reprogramación de disponibilidad, entrega con acuse de recibo y resolución del
 * pendiente. Emite eventos de dominio y registra auditoría (actor · antes→después).
 *
 * Regla de resolución (TASK 18 §8): un pendiente solo se completa vía entrega
 * (registra quién recibió) o por la vía explícita "sin contacto" con motivo.
 */
export function makeFulfillmentService(repo: FulfillmentRepository) {
  return {
    async registerContact(orderId: string, entry: ContactInput, actor: ActorRef): Promise<void> {
      const v = await repo.get(orderId)
      const withActor: ContactInput = { ...entry, actorId: actor.id, actorName: actor.name, actorRole: actor.role }
      await repo.registerContact(orderId, withActor)
      const success = entry.outcome === 'contactado' || entry.outcome === 'reprogramado'
      emitEvent({
        type: 'PATIENT_CONTACTED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: v.order.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: `${CONTACT_METHOD_LABEL[entry.method]} · ${CONTACT_RESULT_LABEL[entry.outcome]}`,
        newState: success ? 'contactado' : 'pendiente',
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PATIENT_CONTACT_ATTEMPT', entityType: 'MedicationFulfillment', entityId: orderId, patientId: v.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        newState: CONTACT_RESULT_LABEL[entry.outcome], reason: entry.comment,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },

    async reprogram(orderId: string, change: ScheduleInput, actor: ActorRef): Promise<void> {
      const v = await repo.get(orderId)
      const withActor: ScheduleInput = { ...change, actorId: actor.id, actorName: actor.name, actorRole: actor.role }
      await repo.reprogram(orderId, withActor)
      const label = change.newTime ? `${change.newDate} · ${change.newTime}` : change.newDate
      emitEvent({
        type: 'MEDICATION_AVAILABILITY_UPDATED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: v.order.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: label, previousState: v.expectedAvailability, newState: label, reason: change.reason,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'AVAILABILITY_RESCHEDULED', entityType: 'MedicationFulfillment', entityId: orderId, patientId: v.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: v.expectedAvailability, newState: label, reason: change.reason,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },

    async registerDelivery(orderId: string, delivery: DeliveryInput, actor: ActorRef): Promise<void> {
      const before = await repo.get(orderId)
      const withActor: DeliveryInput = { ...delivery, deliveredBy: actor.name, deliveredByRole: actor.role }
      await repo.registerDelivery(orderId, withActor)
      const after = await repo.get(orderId)
      emitEvent({
        type: 'DISPENSE_COMPLETED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationDelivery', sourceEntityId: orderId, patientId: before.order.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        summary: `${RECIPIENT_LABEL[delivery.recipientType]}${delivery.recipientName ? ` · ${delivery.recipientName}` : ''}`,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
      emitEvent({
        type: 'MEDICATION_PENDING_RESOLVED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: before.order.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        previousState: before.status, newState: after.status, source: 'fulfillment', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'MEDICATION_DELIVERED', entityType: 'MedicationFulfillment', entityId: orderId, patientId: before.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: before.status, newState: after.status,
        reason: `Receptor: ${RECIPIENT_LABEL[delivery.recipientType]}${delivery.recipientName ? ` (${delivery.recipientName})` : ''}`,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },

    async resolveWithoutContact(orderId: string, reason: string, actor: ActorRef): Promise<void> {
      const before = await repo.get(orderId)
      await repo.resolveWithoutContact(orderId, reason, actor.name)
      const after = await repo.get(orderId)
      emitEvent({
        type: 'MEDICATION_PENDING_RESOLVED', sourceDomain: 'fulfillment',
        sourceEntityType: 'MedicationFulfillment', sourceEntityId: orderId, patientId: before.order.patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
        previousState: before.status, newState: after.status, reason: `Sin contacto: ${reason}`,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PENDING_RESOLVED_WITHOUT_CONTACT', entityType: 'MedicationFulfillment', entityId: orderId, patientId: before.order.patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role,
        previousState: before.status, newState: after.status, reason,
        source: 'fulfillment', sourceSystem: 'kumpels',
      })
    },
  }
}
export type FulfillmentService = ReturnType<typeof makeFulfillmentService>
