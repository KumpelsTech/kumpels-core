import type { ActorRef } from '../types/actor'
import type { PreparationBatchStatus } from '../types/traceability'
import type { TraceabilityRepository } from '../repositories/types'
import { getPreparationOrder } from '../data/preparation'
import { getLot } from '../data/traceability'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { MIXING_SCOPE } from '../data/admin'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Trazabilidad de lotes y mezcla final. Seleccionar lote,
 * añadir/cambiar/quitar lotes de un componente (multi-lote) y confirmar el lote de
 * preparación final requieren ELEGIBILIDAD de Central de Mezclas (capacidad +
 * sede + programa), no solo poder ver el caso. Cada acción emite evento + auditoría
 * (append-only: una corrección es un evento nuevo, no una edición del anterior).
 */
export function makeTraceabilityService(repo: TraceabilityRepository) {
  /** Elegibilidad para operar la genealogía (Central de Mezclas). */
  const guard = (actor: ActorRef): { ok: boolean; reason?: string } => {
    const user = getUser(actor.id)
    if (!user) return { ok: false, reason: 'Usuario no encontrado' }
    const el = evaluateEligibility(user, { capability: 'STERILE_PREPARATION', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId })
    return el.eligible ? { ok: true } : { ok: false, reason: el.reason }
  }
  const patientOf = (orderId: string) => getPreparationOrder(orderId)?.patientId
  const emitLot = (orderId: string, actor: ActorRef, action: string, summary: string, reason?: string, metadata?: Record<string, unknown>) => {
    const patientId = patientOf(orderId)
    emitEvent({
      type: 'LOT_SELECTED', sourceDomain: 'traceability', sourceEntityType: 'PreparationOrder', sourceEntityId: orderId, patientId,
      occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role || 'Central de Mezclas', actorType: 'user',
      summary, reason, metadata, source: 'traceability', sourceSystem: 'kumpels',
    })
    recordAudit({
      action, entityType: 'PreparationOrder', entityId: orderId, patientId,
      actorId: actor.id, actorName: actor.name, actorRole: actor.role || 'Central de Mezclas',
      newState: summary, reason, source: 'traceability', sourceSystem: 'kumpels',
    })
  }

  return {
    /** Selección del lote principal (único) de un componente. */
    async selectLot(orderId: string, componentKey: string, lotId: string, actor: ActorRef, reason?: string): Promise<{ ok: boolean; reason?: string }> {
      const g = guard(actor); if (!g.ok) return g
      const res = await repo.selectLot(orderId, componentKey, lotId, actor.name, reason)
      if (res.ok) emitLot(orderId, actor, 'LOT_SELECTED', getLot(lotId)?.manufacturerLot ?? lotId, reason, { componentKey, lotId })
      return res
    },
    /** Añade un lote fuente adicional a un componente (multi-lote). */
    async addLot(orderId: string, componentKey: string, lotId: string, quantity: number, unit: string, actor: ActorRef, note?: string): Promise<{ ok: boolean; reason?: string }> {
      const g = guard(actor); if (!g.ok) return g
      const res = await repo.addLot(orderId, componentKey, lotId, quantity, unit, actor.name, note)
      if (res.ok) emitLot(orderId, actor, 'LOT_ADDED', `${getLot(lotId)?.manufacturerLot ?? lotId} · ${quantity} ${unit}`, undefined, { componentKey, lotId, quantity })
      return res
    },
    /** Cambia un lote específico de un componente (corrección trazable). */
    async changeLot(orderId: string, componentKey: string, fromLotId: string, toLotId: string, actor: ActorRef, reason?: string): Promise<{ ok: boolean; reason?: string }> {
      const g = guard(actor); if (!g.ok) return g
      const res = await repo.changeLot(orderId, componentKey, fromLotId, toLotId, actor.name, reason)
      if (res.ok) emitLot(orderId, actor, 'LOT_SELECTED', getLot(toLotId)?.manufacturerLot ?? toLotId, reason, { componentKey, fromLotId, toLotId })
      return res
    },
    /** Quita un lote de un componente (antes de verificar). */
    async removeLot(orderId: string, componentKey: string, lotId: string, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const g = guard(actor); if (!g.ok) return g
      const res = await repo.removeLot(orderId, componentKey, lotId, actor.name)
      if (res.ok) emitLot(orderId, actor, 'LOT_REMOVED', `${getLot(lotId)?.manufacturerLot ?? lotId} retirado`, undefined, { componentKey, lotId })
      return res
    },
    /** Confirma / actualiza el lote de preparación final (mezcla compuesta). */
    async confirmBatch(orderId: string, input: { batchNumber: string; facilityId: string; beyondUseAt?: string; expirationAt?: string; status?: PreparationBatchStatus }, actor: ActorRef): Promise<{ ok: boolean; reason?: string }> {
      const g = guard(actor); if (!g.ok) return g
      const batch = await repo.confirmBatch(orderId, input, actor.name)
      const patientId = patientOf(orderId)
      emitEvent({
        type: 'PREPARATION_BATCH_CONFIRMED', sourceDomain: 'traceability', sourceEntityType: 'PreparationBatch', sourceEntityId: batch.id, patientId,
        occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role || 'Central de Mezclas', actorType: 'user',
        summary: batch.batchNumber, newState: `${batch.batchNumber} (v${batch.version})`, source: 'traceability', sourceSystem: 'kumpels',
      })
      recordAudit({
        action: 'PREPARATION_BATCH_CONFIRMED', entityType: 'PreparationBatch', entityId: batch.id, patientId,
        actorId: actor.id, actorName: actor.name, actorRole: actor.role || 'Central de Mezclas',
        newState: `${batch.batchNumber} (v${batch.version})`, source: 'traceability', sourceSystem: 'kumpels',
      })
      return { ok: true }
    },
  }
}
export type TraceabilityService = ReturnType<typeof makeTraceabilityService>
