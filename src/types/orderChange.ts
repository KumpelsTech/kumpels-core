import type { DemoPersona } from '../config/workspaces'

/**
 * Cambio de una orden de medicación (MedicationOrder). Nativo de Kumpels; se
 * mapea a MedicationRequest.status (active/on-hold/cancelled/…) sin copiar los
 * enums FHIR literalmente. Un cambio dispara una evaluación DETERMINISTA del
 * trabajo aguas abajo (preparación, entrega, administración).
 */
export type OrderChangeType = 'MODIFIED' | 'SUSPENDED' | 'CANCELLED' | 'REPLACED'

export interface OrderChange {
  orderId: string
  changeType: OrderChangeType
  reason: string
  actorId: string
  actorName: string
  actorRole: string
  at: string
  atIso: string
}

export const ORDER_CHANGE_LABEL: Record<OrderChangeType, string> = {
  MODIFIED: 'Modificada', SUSPENDED: 'Suspendida', CANCELLED: 'Cancelada', REPLACED: 'Reemplazada',
}

/** Elemento de impacto aguas abajo (explicable). */
export interface ImpactItem {
  entity: 'preparacion' | 'administracion' | 'entrega' | 'dispensacion'
  statusLabel: string
  requiredAction: string
  responsibleRole: DemoPersona
  ownerLabel: string
  tone: 'crit' | 'warn' | 'info'
  /** true si es histórico y no debe revertirse. */
  historical?: boolean
}

export interface DownstreamImpact {
  change: OrderChange
  impacts: ImpactItem[]
}
