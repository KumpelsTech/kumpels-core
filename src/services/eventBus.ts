import type { DomainEventInput, DomainEventRecord } from '../types/domainEvent'
import { appendEvent, allEvents } from '../utils/eventStore'

/**
 * Fachada de emisión de eventos para la capa de servicios. Publica en el
 * almacén append-only (utils/eventStore, adaptador in-memory del EventRepository).
 * Punto único donde los servicios registran lo ocurrido, de forma consistente.
 */
export function emitEvent(input: DomainEventInput): DomainEventRecord {
  return appendEvent(input)
}

/** Log completo de la sesión (base de auditoría/analítica futura; sin UI todavía). */
export function getEventLog(): readonly DomainEventRecord[] {
  return allEvents()
}

/** Sello de tiempo canónico para eventos/auditoría (demo: etiqueta 'Hoy HH:MM'). */
export function auditNow(): string {
  return `Hoy ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}
