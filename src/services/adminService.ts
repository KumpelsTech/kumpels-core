import type { RoleId, Scope, UserStatus } from '../types/admin'
import type { AdminRepository } from '../repositories/types'
import { emitEvent, auditNow } from './eventBus'

/**
 * Servicio de aplicación: Administración / Configuración institucional.
 * Cada mutación es async, emite un evento de dominio auditable (actor, timestamp,
 * estado previo/nuevo, razón) y NO expone credenciales. La configuración clínica
 * NO se muta desde aquí: se gobierna por su propio ciclo de vida (revisión/aprobación).
 */
export function makeAdminService(repo: AdminRepository) {
  return {
    async setUserStatus(userId: string, status: UserStatus, actor: string, reason?: string): Promise<void> {
      const prev = await repo.getUser(userId)
      await repo.setUserStatus(userId, status)
      emitEvent({
        type: 'USER_STATUS_CHANGED', sourceDomain: 'admin', sourceEntityType: 'User', sourceEntityId: userId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: prev?.name, previousState: prev?.status, newState: status, reason, source: 'admin', sourceSystem: 'kumpels',
      })
    },
    async assignRole(userId: string, role: RoleId, actor: string, reason?: string): Promise<void> {
      const prev = await repo.getUser(userId)
      await repo.setUserRole(userId, role)
      emitEvent({
        type: 'USER_ROLE_ASSIGNED', sourceDomain: 'admin', sourceEntityType: 'User', sourceEntityId: userId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: prev?.name, previousState: prev?.role, newState: role, reason, source: 'admin', sourceSystem: 'kumpels',
      })
    },
    async assignTeam(userId: string, teamId: string | undefined, actor: string): Promise<void> {
      const prev = await repo.getUser(userId)
      await repo.setUserTeam(userId, teamId)
      emitEvent({
        type: 'USER_TEAM_ASSIGNED', sourceDomain: 'admin', sourceEntityType: 'User', sourceEntityId: userId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: prev?.name, previousState: prev?.teamId, newState: teamId, source: 'admin', sourceSystem: 'kumpels',
      })
    },
    async assignScope(userId: string, scope: Scope, actor: string): Promise<void> {
      await repo.setUserScope(userId, scope)
      emitEvent({
        type: 'USER_SCOPE_ASSIGNED', sourceDomain: 'admin', sourceEntityType: 'User', sourceEntityId: userId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        summary: `${scope.facilityIds.length} sede(s) · ${scope.programIds.length} programa(s)`, source: 'admin', sourceSystem: 'kumpels',
      })
    },
    async requestSupport(input: { reason: string; scope: string; requestedBy: string }): Promise<void> {
      const s = await repo.openSupport(input)
      emitEvent({
        type: 'SUPPORT_REQUESTED', sourceDomain: 'admin', sourceEntityType: 'SupportSession', sourceEntityId: s.id,
        occurredAt: auditNow(), actorId: input.requestedBy, actorType: 'user',
        summary: input.scope, reason: input.reason, newState: 'activo', source: 'admin', sourceSystem: 'kumpels',
      })
    },
    async endSupport(sessionId: string, actor: string): Promise<void> {
      await repo.closeSupport(sessionId)
      emitEvent({
        type: 'SUPPORT_ENDED', sourceDomain: 'admin', sourceEntityType: 'SupportSession', sourceEntityId: sessionId,
        occurredAt: auditNow(), actorId: actor, actorType: 'user',
        previousState: 'activo', newState: 'finalizado', source: 'admin', sourceSystem: 'kumpels',
      })
    },
  }
}
export type AdminService = ReturnType<typeof makeAdminService>
