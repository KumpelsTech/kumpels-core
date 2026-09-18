import type { Priority } from '../types/patient'
import type { WorkItem } from '../types/work'
import type { ActorRef } from '../types/actor'
import type { AdminUser } from '../types/admin'
import type { ActionContext } from '../types/eligibility'
import type { DomainEventType } from '../types/domainEvent'
import type { CoordinatorRepository } from '../repositories/types'
import { evaluateEligibility } from '../utils/eligibility'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación: RESPONSABILIDAD y gestión operativa. Asignar (solo a
 * usuarios ELEGIBLES), reasignar (con motivo, preserva historia), acuse, progreso,
 * completar, transferir turno, escalar, prioridad (con motivo) y nota. Cada acción
 * emite evento de dominio y registra auditoría. La decisión de autorización vive
 * en utils/eligibility, no en la UI.
 */
export function makeCoordinatorService(repo: CoordinatorRepository) {
  const evt = (item: WorkItem, type: DomainEventType, actor: ActorRef, summary: string, previousState?: string, newState?: string, reason?: string) =>
    emitEvent({
      type, sourceDomain: 'workitem', sourceEntityType: 'WorkItem', sourceEntityId: item.id, patientId: item.patientId,
      occurredAt: auditNow(), actorId: actor.name, actorRole: actor.role, actorType: 'user',
      summary, previousState, newState, reason, source: 'coordinator', sourceSystem: 'kumpels',
    })
  const aud = (item: WorkItem, action: string, actor: ActorRef, previousState?: string, newState?: string, reason?: string) =>
    recordAudit({
      action, entityType: 'WorkItem', entityId: item.id, patientId: item.patientId,
      actorId: actor.id, actorName: actor.name, actorRole: actor.role,
      previousState, newState, reason, source: 'coordinator', sourceSystem: 'kumpels',
    })

  const ctxOf = (item: WorkItem, extra?: Partial<ActionContext>): ActionContext | undefined =>
    item.requiredCapability
      ? { capability: item.requiredCapability, facilityId: item.facilityId, programId: item.programId, workItemId: item.id, ...extra }
      : undefined

  const isVerify = (item: WorkItem) => item.requiredCapability === 'STERILE_PREPARATION_VERIFY'

  return {
    /** Asigna un WorkItem a un usuario ELEGIBLE. Deniega si no cumple la política. */
    async assign(item: WorkItem, user: AdminUser, opts: { dueAt?: string; instruction?: string; priority?: Priority }, actor: ActorRef, ctxExtra?: Partial<ActionContext>): Promise<{ ok: boolean; reason?: string }> {
      const ctx = ctxOf(item, ctxExtra)
      if (ctx) {
        const el = evaluateEligibility(user, ctx)
        if (!el.eligible) return { ok: false, reason: el.reason }
      }
      await repo.assign(item.id, { toId: user.id, toName: user.name, toRole: user.role, byId: actor.id, byName: actor.name, dueAt: opts.dueAt, instruction: opts.instruction, priority: opts.priority })
      evt(item, isVerify(item) ? 'VERIFICATION_ASSIGNED' : 'WORKITEM_ASSIGNED', actor, user.name, 'Sin asignar', user.name, opts.instruction)
      aud(item, 'WORKITEM_ASSIGNED', actor, 'Sin asignar', user.name, opts.instruction)
      return { ok: true }
    },
    async reassign(item: WorkItem, user: AdminUser, reason: string, actor: ActorRef, ctxExtra?: Partial<ActionContext>): Promise<{ ok: boolean; reason?: string }> {
      const ctx = ctxOf(item, ctxExtra)
      if (ctx) {
        const el = evaluateEligibility(user, ctx)
        if (!el.eligible) return { ok: false, reason: el.reason }
      }
      const before = await repo.get(item.id)
      await repo.reassign(item.id, { toId: user.id, toName: user.name, toRole: user.role, byId: actor.id, byName: actor.name, reason })
      evt(item, 'WORKITEM_REASSIGNED', actor, user.name, before?.assignedToName, user.name, reason)
      aud(item, 'WORKITEM_REASSIGNED', actor, before?.assignedToName, user.name, reason)
      return { ok: true }
    },
    async acknowledge(item: WorkItem, actor: ActorRef): Promise<void> {
      await repo.acknowledge(item.id, actor.id, actor.name, actor.role)
      evt(item, 'WORKITEM_ACKNOWLEDGED', actor, actor.name, 'assigned', 'acknowledged')
      aud(item, 'WORKITEM_ACKNOWLEDGED', actor, 'assigned', 'acknowledged')
    },
    async start(item: WorkItem, actor: ActorRef): Promise<void> {
      await repo.start(item.id)
      evt(item, 'WORKITEM_STARTED', actor, actor.name, 'acknowledged', 'in-progress')
    },
    async complete(item: WorkItem, actor: ActorRef): Promise<void> {
      await repo.complete(item.id)
      const type: DomainEventType = isVerify(item) ? 'VERIFICATION_COMPLETED' : 'WORKITEM_COMPLETED'
      evt(item, type, actor, actor.name, undefined, 'completed')
      aud(item, 'WORKITEM_COMPLETED', actor, undefined, 'completed')
    },
    async transfer(item: WorkItem, user: AdminUser, reason: string, actor: ActorRef, ctxExtra?: Partial<ActionContext>): Promise<{ ok: boolean; reason?: string }> {
      const ctx = ctxOf(item, ctxExtra)
      if (ctx) {
        const el = evaluateEligibility(user, ctx)
        if (!el.eligible) return { ok: false, reason: el.reason }
      }
      const before = await repo.get(item.id)
      await repo.transfer(item.id, { toId: user.id, toName: user.name, toRole: user.role, byId: actor.id, byName: actor.name, reason })
      evt(item, 'RESPONSIBILITY_TRANSFERRED', actor, user.name, before?.assignedToName, user.name, reason)
      aud(item, 'RESPONSIBILITY_TRANSFERRED', actor, before?.assignedToName, user.name, reason)
      return { ok: true }
    },
    async escalate(item: WorkItem, actor: ActorRef): Promise<void> {
      await repo.escalate(item.id, actor.id, actor.name)
      evt(item, 'WORKITEM_ESCALATED', actor, 'Escalado', undefined, 'escalated')
      aud(item, 'WORKITEM_ESCALATED', actor, item.escalationState ?? 'none', 'escalated')
    },
    async setPriority(item: WorkItem, priority: Priority, reason: string, actor: ActorRef): Promise<void> {
      await repo.setPriority(item.id, priority)
      evt(item, 'WORKITEM_PRIORITIZED', actor, priority, String(item.priority), priority, reason)
      aud(item, 'WORKITEM_PRIORITY_OVERRIDE', actor, String(item.priority), priority, reason)
    },
    async setDue(item: WorkItem, dueLabel: string, actor: ActorRef): Promise<void> {
      await repo.setDue(item.id, dueLabel)
      aud(item, 'WORKITEM_DUE_SET', actor, item.dueLabel, dueLabel)
    },
    async addNote(item: WorkItem, note: string, actor: ActorRef): Promise<void> {
      await repo.addNote(item.id, note)
      aud(item, 'WORKITEM_NOTE', actor, undefined, note)
    },
  }
}
export type CoordinatorService = ReturnType<typeof makeCoordinatorService>
