import type { PreparationRepository } from '../repositories/types'
import { emitEvent, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Preparación estéril. Transiciones del flujo
 * (iniciar → finalizar → verificar → liberar) como acciones separadas y
 * trazables; cada una emite su evento de dominio. Al finalizar, el dominio
 * registra el uso de componentes (genealogía) → COMPONENT_USAGE_RECORDED.
 */
export function makePreparationService(repo: PreparationRepository) {
  const base = (orderId: string, patientId: string, by: string) => ({
    sourceDomain: 'preparation' as const, sourceEntityId: orderId, patientId,
    occurredAt: auditNow(), actorId: by, actorType: 'user' as const,
    source: 'preparation', sourceSystem: 'kumpels',
  })
  return {
    async start(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.start(orderId, by)
      emitEvent({ type: 'PREPARATION_STARTED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: before.status, newState: 'en-preparacion' })
    },
    async complete(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.complete(orderId)
      emitEvent({ type: 'PREPARATION_COMPLETED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: before.status, newState: 'pendiente-verificacion' })
      emitEvent({ type: 'COMPONENT_USAGE_RECORDED', sourceEntityType: 'ComponentUsage', ...base(orderId, before.order.patientId, by), summary: before.order.medication })
    },
    async verify(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.verify(orderId, by)
      emitEvent({ type: 'PREPARATION_VERIFIED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: 'pendiente-verificacion', newState: 'verificada' })
    },
    async release(orderId: string, by: string): Promise<void> {
      const before = await repo.get(orderId)
      await repo.release(orderId, by)
      emitEvent({ type: 'PREPARATION_RELEASED', sourceEntityType: 'PreparationInstance', ...base(orderId, before.order.patientId, by), previousState: 'verificada', newState: 'liberada' })
    },
  }
}
export type PreparationService = ReturnType<typeof makePreparationService>
