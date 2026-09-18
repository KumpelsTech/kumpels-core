/**
 * Registro de AUDITORÍA — "quién cambió qué, de qué a qué, cuándo y por qué".
 *
 * Concepto DISTINTO, no colapsado (ver TASK 18 §20):
 *   AuditRecord   → traza de cambio (actor · previo→nuevo · momento · razón)
 *   DomainEvent   → hecho de flujo relevante (types/domainEvent.ts)
 *   ActivityItem  → proyección legible para la UI (utils/activityProjection.ts)
 *
 * Append-only: una corrección genera un registro nuevo; no se edita el anterior.
 * Mapeo FHIR: AuditRecord ↔ AuditEvent / Provenance (ver docs/domain-model.md).
 */
export interface AuditRecord {
  id: string
  /** Secuencia monotónica (orden de la traza). */
  seq: number
  /** Etiqueta legible del momento ("14 sep 2026 · 10:42"). */
  at: string
  /** Instante ISO tz-aware (persistencia). */
  atIso: string

  actorId: string
  actorName: string
  actorRole: string

  /** Acción auditada (p. ej. REVIEW_DECISION, PRIORITY_OVERRIDE, LOT_CHANGED). */
  action: string
  /** Entidad de dominio afectada (por tipo + id estable). */
  entityType: string
  entityId: string
  patientId?: string
  episodeId?: string

  previousState?: string
  newState?: string
  reason?: string

  source?: string
  sourceSystem?: string
  version: number
}

/** Entrada de auditoría (id/seq/at/version los asigna el store). */
export type AuditInput =
  Omit<AuditRecord, 'id' | 'seq' | 'at' | 'atIso' | 'version'> & { at?: string; atIso?: string; version?: number }
