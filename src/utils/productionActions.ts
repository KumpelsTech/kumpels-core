import type { ActorRef } from '../types/actor'
import { services } from '../services'
import { getAssignment, acknowledge as ackAssignment, startWork } from './coordinatorStore'

/**
 * Aceptación del handoff de producción por Central de Mezclas. Además de cambiar
 * el ProductionRequest (SENT → ACCEPTED, con evento + auditoría), avanza el
 * WorkItem de handoff (ASSIGNED → ACKNOWLEDGED/IN_PROGRESS) cuando el Coordinador
 * lo había asignado — cerrando la propiedad sin dejar el trabajo sin acuse.
 *
 * `auto` = aceptación implícita al iniciar la preparación directamente: conserva
 * la misma historia de auditoría/evento (no salta la propiedad).
 */
export async function acceptProductionRequest(orderId: string, patientId: string, actor: ActorRef, auto = false): Promise<{ ok: boolean; reason?: string }> {
  const res = await services.production.accept(orderId, patientId, actor, auto)
  if (!res.ok) return res
  // Avance del WorkItem de handoff si estaba asignado por el Coordinador.
  const wiId = `wi-sent-${orderId}`
  const a = getAssignment(wiId)
  if (a && (a.status === 'assigned' || a.status === 'acknowledged')) {
    if (a.status === 'assigned') ackAssignment(wiId, actor.id, actor.name, actor.role)
    startWork(wiId)
  }
  return res
}
