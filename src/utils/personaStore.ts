import { useSyncExternalStore } from 'react'
import type { ActionKey, DemoPersona, WorkspaceProfile } from '../config/workspaces'
import type { ActorRef } from '../types/actor'
import type { AdminUser } from '../types/admin'
import { WORKSPACES } from '../config/workspaces'
import { PERSONA_USER } from '../data/admin'
import { getUser } from './adminStore'

/**
 * Estado de la identidad activa (demo "Ver como"). Separa Practitioner (usuario)
 * de Role/Workspace: se selecciona un USUARIO; su rol determina el WorkspaceProfile.
 * En memoria, sesión. NO es autenticación ni RBAC: la autorización real se evalúa
 * con utils/eligibility (capacidad + alcance + política).
 */
let current: DemoPersona = 'coordinador'
let currentUserId: string = PERSONA_USER.coordinador
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getPersona(): DemoPersona { return current }
export function getCurrentUserId(): string { return currentUserId }
export function getCurrentUser(): AdminUser | undefined { return getUser(currentUserId) }

/** Cambia de rol (persona); selecciona el usuario canónico de ese rol. */
export function setPersona(p: DemoPersona) {
  if (p !== current) { current = p; currentUserId = PERSONA_USER[p] ?? currentUserId; emit() }
}
/** Cambia de usuario (identidad); el rol se deriva del usuario. */
export function setUser(userId: string) {
  const u = getUser(userId)
  if (!u) return
  if (userId !== currentUserId || u.role !== current) { currentUserId = userId; current = u.role; emit() }
}
export function getProfile(): WorkspaceProfile { return WORKSPACES[current] }

/** Actor de la identidad activa (id de usuario + nombre + rol) para eventos/auditoría. */
export function getActor(): ActorRef {
  const u = getUser(currentUserId)
  const p = WORKSPACES[current]
  return { id: u?.id ?? current, name: u?.name ?? p.userName, role: p.roleLabel }
}

export function usePersona() {
  useSyncExternalStore(subscribe, () => version, () => version)
  const profile = WORKSPACES[current]
  const user = getUser(currentUserId)
  return {
    persona: current,
    profile,
    user,
    userId: currentUserId,
    setPersona,
    setUser,
    actor: (): ActorRef => ({ id: user?.id ?? current, name: user?.name ?? profile.userName, role: profile.roleLabel }),
    can: (action: ActionKey) => profile.actions.includes(action),
    sees: (section: WorkspaceProfile['sections'][number]) => profile.sections.includes(section),
  }
}
