import { useSyncExternalStore } from 'react'
import type { AdminUser, RoleId, Scope, SupportSession, SupportStatus, UserStatus } from '../types/admin'
import { ADMIN_USERS, SEED_SUPPORT_SESSIONS } from '../data/admin'
import { newId } from './ids'

/**
 * Estado mutable de administración (en memoria, sesión). Read model reactivo +
 * mutaciones a nivel de módulo para el adaptador de repositorio (no para la UI:
 * la UI muta vía services.admin). No incluye credenciales ni contraseñas.
 */
const users = new Map<string, AdminUser>()
const support: SupportSession[] = []
const listeners = new Set<() => void>()
let version = 0
let seeded = false

function seed() {
  if (seeded) return
  for (const u of ADMIN_USERS) users.set(u.id, structuredClone(u))
  for (const s of SEED_SUPPORT_SESSIONS) support.push(structuredClone(s))
  seeded = true
}
function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { seed(); listeners.add(l); return () => listeners.delete(l) }

/* ---- lecturas ---- */
export function listUsers(): AdminUser[] { seed(); return [...users.values()] }
export function getUser(id: string): AdminUser | undefined { seed(); return users.get(id) }
export function listSupport(): SupportSession[] { seed(); return [...support].reverse() }
export function activeSupport(): SupportSession | undefined { seed(); return support.find((s) => s.status === 'activo') }
export function supportStatus(): SupportStatus { return activeSupport() ? 'activo' : 'inactivo' }

/* ---- mutaciones (usadas por el repositorio; nunca desde JSX) ---- */
export function setUserStatus(id: string, status: UserStatus) { const u = users.get(id); if (u) { u.status = status; emit() } }
export function setUserRole(id: string, role: RoleId) { const u = users.get(id); if (u) { u.role = role; emit() } }
export function setUserTeam(id: string, teamId: string | undefined) { const u = users.get(id); if (u) { u.teamId = teamId; emit() } }
export function setUserScope(id: string, scope: Scope) { const u = users.get(id); if (u) { u.scope = scope; emit() } }

export function openSupport(session: Omit<SupportSession, 'id' | 'status' | 'startedAt'>): SupportSession {
  seed()
  const s: SupportSession = { ...session, id: newId('sup'), status: 'activo', startedAt: nowLabel() }
  support.push(s)
  emit()
  return s
}
export function closeSupport(id: string) {
  const s = support.find((x) => x.id === id)
  if (s && s.status === 'activo') { s.status = 'finalizado'; s.endedAt = nowLabel(); emit() }
}

function nowLabel(): string {
  return `Hoy ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}

export function useAdminStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { listUsers, getUser, listSupport, activeSupport, supportStatus }
}
