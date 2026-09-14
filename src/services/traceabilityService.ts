import type { TraceabilityRepository } from '../repositories/types'
import { getPreparationOrder } from '../data/preparation'
import { getLot } from '../data/traceability'
import { emitEvent, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Trazabilidad de lotes. Selección de lote para un
 * componente (solo lotes válidos; el repositorio conserva la auditoría sin
 * reemplazo silencioso). Cada selección emite un LOT_SELECTED (append-only: una
 * corrección es un evento nuevo, no una edición del anterior).
 */
export function makeTraceabilityService(repo: TraceabilityRepository) {
  return {
    async selectLot(orderId: string, componentKey: string, lotId: string, actor: string): Promise<{ ok: boolean; reason?: string }> {
      const res = await repo.selectLot(orderId, componentKey, lotId, actor)
      if (res.ok) {
        const lot = getLot(lotId)
        emitEvent({
          type: 'LOT_SELECTED', sourceDomain: 'traceability',
          sourceEntityType: 'PreparationOrder', sourceEntityId: orderId,
          patientId: getPreparationOrder(orderId)?.patientId,
          occurredAt: auditNow(), actorId: actor, actorType: 'user',
          summary: lot?.manufacturerLot ?? lotId,
          metadata: { componentKey, lotId },
          source: 'traceability', sourceSystem: 'kumpels',
        })
      }
      return res
    },
  }
}
export type TraceabilityService = ReturnType<typeof makeTraceabilityService>
