/**
 * Estructuras compartidas de PROVENANCE / AUDITORÍA (scaffolding).
 *
 * No hay motor de auditoría todavía; estos tipos existen para que las entidades
 * de dominio puedan COMPONERLOS de forma incremental sin rediseño, y para dejar
 * documentado el contrato de auditabilidad futura. Hoy varias entidades ya
 * llevan actor + timestamp de forma parcial (ProfessionalReview, ContactEntry,
 * LotAuditEntry, ComponentUsage); AuditMeta unifica ese contrato.
 *
 * Mapeo FHIR: AuditMeta ↔ Resource.meta (+ Provenance para el "quién/cuándo/por qué");
 * StateTransition ↔ Provenance / AuditEvent (ver docs/domain-model.md).
 */

export type SourceSystem = 'kumpels' | 'his' | 'lis' | 'erp' | 'manual'

/** Metadatos de auditoría que cualquier entidad persistible puede componer. */
export interface AuditMeta {
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
  /** Origen lógico del dato (workflow o interacción que lo creó). */
  source?: string
  /** Sistema de origen cuando el dato es externo. */
  sourceSystem?: SourceSystem
  /** Versión optimista para persistencia/concurrencia futura. */
  version?: number
}

/**
 * Transición de estado clínica/operativamente relevante. Preserva el "antes",
 * el "después", el actor, el momento y (opcional) la razón — sin borrar el valor
 * previo (base para trazabilidad y correcciones no silenciosas).
 */
export interface StateTransition<S = string> {
  previousState?: S
  newState: S
  actor: string
  at: string
  reason?: string
}
