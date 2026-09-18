import type { Capability } from '../config/capabilities'

/**
 * Contexto de una acción para evaluar ELEGIBILIDAD. No es una matriz de permisos:
 * describe qué capacidad se requiere y en qué alcance, más datos de política
 * (segregación de funciones). La lógica de decisión vive en utils/eligibility.
 */
export interface ActionContext {
  capability: Capability
  facilityId?: string
  programId?: string
  /** Segregación de funciones: quién preparó / verificó la instancia. */
  preparedBy?: string
  verifiedBy?: string
  /** WorkItem específico (para exclusiones puntuales). */
  workItemId?: string
  /** Usuarios excluidos explícitamente para este WorkItem. */
  excludedUserIds?: string[]
}

export type EligibilityCode =
  | 'ok' | 'inactive' | 'missing-capability' | 'facility-scope' | 'program-scope'
  | 'separation-of-duty' | 'excluded'

export interface EligibilityResult {
  eligible: boolean
  code: EligibilityCode
  reason: string
}
