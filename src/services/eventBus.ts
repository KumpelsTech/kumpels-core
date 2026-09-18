import type { DomainEventInput, DomainEventRecord } from '../types/domainEvent'
import type { AuditInput, AuditRecord } from '../types/audit'
import { appendEvent, allEvents } from '../utils/eventStore'
import { recordAudit as appendAudit } from '../utils/auditStore'
import { nowLabel } from '../utils/datetime'

/**
 * Fachada de la capa de servicios para registrar lo ocurrido. Dos canales
 * SEPARADOS (ver TASK 18 §20):
 *   emitEvent   → DomainEvent (hecho de flujo) en el almacén append-only.
 *   recordAudit → AuditRecord (quién/qué/antes→después/por qué) en la traza.
 * Un cambio de estado crítico produce AMBOS; no se colapsan en un solo objeto.
 */
export function emitEvent(input: DomainEventInput): DomainEventRecord {
  return appendEvent(input)
}

export function recordAudit(input: AuditInput): AuditRecord {
  return appendAudit(input)
}

/** Log completo de la sesión (base de auditoría/analítica futura; sin UI todavía). */
export function getEventLog(): readonly DomainEventRecord[] {
  return allEvents()
}

/** Sello de tiempo canónico para eventos/auditoría: fecha + hora exactas. */
export function auditNow(): string {
  return nowLabel()
}
