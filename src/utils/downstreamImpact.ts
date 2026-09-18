import type { DownstreamImpact, ImpactItem } from '../types/orderChange'
import { getOrderChange } from './orderChangeStore'
import { listPreparationViews } from './preparationStore'
import { getAdministrationForOrder } from './administrationStore'

/**
 * DownstreamImpactService — evaluación DETERMINISTA y explicable del impacto de
 * un cambio de orden sobre el trabajo aguas abajo (preparación → administración).
 * No revierte historia: una administración ya realizada se conserva y la nueva
 * orden rige las acciones futuras. No cubre todos los escenarios: solo lo
 * necesario para proteger los flujos actuales.
 */
export function impactFor(orderId: string): DownstreamImpact | null {
  const change = getOrderChange(orderId)
  if (!change) return null
  const impacts: ImpactItem[] = []

  const prep = listPreparationViews().find((v) => v.order.medicationOrderId === orderId)
  if (prep) {
    const admin = getAdministrationForOrder(prep.order.id)
    if (admin && admin.result === 'administrada' && !admin.enteredInError) {
      impacts.push({
        entity: 'administracion', statusLabel: 'Administración ya realizada',
        requiredAction: 'Conservar registro histórico; la nueva orden rige acciones futuras',
        responsibleRole: 'qf-clinico', ownerLabel: 'Farmacia Clínica', tone: 'info', historical: true,
      })
    } else if (prep.status === 'liberada') {
      impacts.push({
        entity: 'administracion', statusLabel: 'Administración bloqueada — preparación liberada afectada',
        requiredAction: 'Revisar preparación afectada por cambio de tratamiento',
        responsibleRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas', tone: 'crit',
      })
    } else if (prep.status === 'en-preparacion') {
      impacts.push({
        entity: 'preparacion', statusLabel: 'Preparación en curso — bloqueada / revisión requerida',
        requiredAction: 'Detener y revisar preparación por cambio de tratamiento',
        responsibleRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas', tone: 'crit',
      })
    } else {
      impacts.push({
        entity: 'preparacion', statusLabel: 'Preparación afectada — no iniciada',
        requiredAction: 'Revisar / recrear preparación según la nueva orden',
        responsibleRole: 'qf-mezclas', ownerLabel: 'Central de Mezclas', tone: 'warn',
      })
    }
  }

  // Suspensión/cancelación sin preparación ligada: impacto sobre cumplimiento.
  if (!prep && (change.changeType === 'SUSPENDED' || change.changeType === 'CANCELLED')) {
    impacts.push({
      entity: 'dispensacion', statusLabel: `Orden ${change.changeType === 'SUSPENDED' ? 'suspendida' : 'cancelada'} — dispensación afectada`,
      requiredAction: 'Revisar dispensación/entrega pendiente por cambio de orden',
      responsibleRole: 'farmacia', ownerLabel: 'Farmacia / Dispensación', tone: 'warn',
    })
  }

  return { change, impacts }
}
