import { useSyncExternalStore } from 'react'
import type { ActionKey, DemoPersona, WorkspaceProfile } from '../config/workspaces'
import { WORKSPACES } from '../config/workspaces'

/**
 * Estado de la persona/workspace activa (demo "Ver como"). En memoria, sesión.
 * NO es autenticación ni RBAC: solo selecciona el WorkspaceProfile vigente.
 */
let current: DemoPersona = 'coordinador'
const listeners = new Set<() => void>()
let version = 0

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) }

export function getPersona(): DemoPersona { return current }
export function setPersona(p: DemoPersona) { if (p !== current) { current = p; emit() } }
export function getProfile(): WorkspaceProfile { return WORKSPACES[current] }

export function usePersona() {
  useSyncExternalStore(subscribe, () => version, () => version)
  const profile = WORKSPACES[current]
  return {
    persona: current,
    profile,
    setPersona,
    can: (action: ActionKey) => profile.actions.includes(action),
    sees: (section: WorkspaceProfile['sections'][number]) => profile.sections.includes(section),
  }
}
