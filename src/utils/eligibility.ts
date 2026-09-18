import type { AdminUser } from '../types/admin'
import type { ActionContext, EligibilityResult } from '../types/eligibility'
import type { Capability } from '../config/capabilities'
import { CAPABILITY_LABEL, capabilitiesForRole } from '../config/capabilities'
import { PREPARATION_POLICY } from '../config/preparationPolicy'
import { listUsers } from './adminStore'

/**
 * Lógica CENTRALIZADA de elegibilidad. Un usuario es elegible para una acción solo
 * si se cumplen TODAS las condiciones aplicables. El rol NO garantiza elegibilidad
 * por sí mismo: la política de flujo (segregación de funciones) se evalúa al final
 * y puede denegar aunque rol/capacidad/alcance sean válidos.
 *
 * Orden de evaluación (documentado): activo → capacidad → sede → programa →
 * segregación de funciones → exclusión puntual. No se decide con `if role === …`.
 */
export function userCapabilities(u: AdminUser): Capability[] {
  return u.capabilities ?? capabilitiesForRole(u.role)
}
export function hasCapability(u: AdminUser, c: Capability): boolean {
  return userCapabilities(u).includes(c)
}

const deny = (code: EligibilityResult['code'], reason: string): EligibilityResult => ({ eligible: false, code, reason })

export function evaluateEligibility(user: AdminUser, ctx: ActionContext): EligibilityResult {
  if (user.status !== 'activo') return deny('inactive', `${user.name} está inactivo`)
  if (!hasCapability(user, ctx.capability)) return deny('missing-capability', `Sin capacidad “${CAPABILITY_LABEL[ctx.capability]}”`)
  if (ctx.facilityId && !user.scope.facilityIds.includes(ctx.facilityId)) return deny('facility-scope', 'Fuera del alcance de sede')
  if (ctx.programId && !user.scope.programIds.includes(ctx.programId)) return deny('program-scope', 'Fuera del alcance de programa')
  // Segregación de funciones (la política supera al rol) — se evalúa al final.
  if (ctx.capability === 'STERILE_PREPARATION_VERIFY' && PREPARATION_POLICY.preparerCannotVerifyOwnWork && ctx.preparedBy && ctx.preparedBy === user.name) {
    return deny('separation-of-duty', 'Segregación de funciones: quien preparó no puede verificar su propia preparación')
  }
  if (ctx.capability === 'STERILE_PREPARATION_RELEASE' && PREPARATION_POLICY.verifierCannotReleaseOwnWork && ctx.verifiedBy && ctx.verifiedBy === user.name) {
    return deny('separation-of-duty', 'Segregación de funciones: quien verificó no puede liberar su propia verificación')
  }
  if (ctx.excludedUserIds?.includes(user.id)) return deny('excluded', 'Excluido para esta tarea')
  return { eligible: true, code: 'ok', reason: 'Elegible' }
}

/** Usuarios elegibles para el contexto (excluye inactivos, fuera de alcance y SoD). */
export function eligibleUsers(ctx: ActionContext): AdminUser[] {
  return listUsers().filter((u) => evaluateEligibility(u, ctx).eligible)
}

/** ¿Existe al menos un usuario elegible? (para detectar callejones sin salida). */
export function hasEligibleUser(ctx: ActionContext): boolean {
  return eligibleUsers(ctx).length > 0
}
