import type { DemoPersona } from '../config/workspaces'

/**
 * Dominio de ADMINISTRACIÓN / CONFIGURACIÓN institucional (nativo de Kumpels).
 * Conceptos SEPARADOS: User ≠ Role ≠ Permission ≠ Scope ≠ Workspace.
 * No es IAM/RBAC empresarial: es la configuración operativa que la institución
 * gestiona por sí misma. Soporte Kumpels es acceso TEMPORAL y con alcance.
 *
 * Mapeo FHIR (documentado, no forzado): User/profesional → Practitioner +
 * PractitionerRole; Facility → Location/Organization; contenido de protocolo →
 * PlanDefinition. WorkspaceProfile, SupportSession y la config institucional
 * permanecen nativos (ver docs/domain-model.md).
 */

/** El rol es la responsabilidad; reutiliza las personas demo (incluye admin). */
export type RoleId = DemoPersona

export type UserStatus = 'activo' | 'inactivo'

/** Alcance: a qué sedes/programas aplica el acceso del usuario (≠ rol, ≠ permiso). */
export interface Scope {
  facilityIds: string[]
  programIds: string[]
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: RoleId
  teamId?: string
  scope: Scope
  status: UserStatus
}

export interface Team {
  id: string
  name: string
  facilityId: string
  memberIds: string[]
}

export interface Program {
  id: string
  name: string
  facilityId: string
}

export interface Facility {
  id: string
  name: string
  orgId: string
}

export interface Organization {
  id: string
  name: string
  nit?: string
}

/* ---- Configuración clínica (gobernada aparte de la administración de TI) ---- */
export type ClinicalConfigKind = 'protocolo' | 'ruleset' | 'plantilla-seguimiento' | 'formulario'
/** Ciclo de vida clínico: Borrador → Revisión → Aprobado → Activo → Retirado. */
export type ClinicalConfigStatus = 'borrador' | 'revision' | 'aprobado' | 'activo' | 'retirado'

export interface ClinicalConfiguration {
  id: string
  kind: ClinicalConfigKind
  name: string
  version: string
  status: ClinicalConfigStatus
  owner: string
  approvedBy?: string
  effectiveDate?: string
}

/* ---- Integraciones (sin conectores reales en este MVP) ---- */
export type IntegrationType = 'HIS' | 'LIS' | 'ERP' | 'Farmacia'
export type IntegrationStatus = 'conectado' | 'inactivo' | 'error'
export type IntegrationMode = 'REST' | 'HL7' | 'FHIR' | 'archivo'

export interface IntegrationConfig {
  id: string
  name: string
  type: IntegrationType
  status: IntegrationStatus
  lastSync?: string
  mode: IntegrationMode
}

/* ---- Soporte Kumpels: acceso temporal y con alcance (no superusuario oculto) ---- */
export type SupportStatus = 'inactivo' | 'activo' | 'finalizado'

export interface SupportSession {
  id: string
  reason: string
  requestedBy: string
  scope: string
  startedAt?: string
  endedAt?: string
  status: SupportStatus
}
