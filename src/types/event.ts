/**
 * Evento de dominio canónico — forma única compartida por todos los flujos
 * (cumplimiento, preparación, actividad). Antes existía duplicada como
 * FulfillmentEvent y PrepEvent; ahora ambas son alias de DomainEvent.
 *
 * Mapeo FHIR: una línea de trazabilidad/actividad se corresponde con
 * AuditEvent o Provenance según el caso (ver docs/domain-model.md).
 */
export type EventState = 'done' | 'warn' | 'pending'

export interface DomainEvent {
  at: string
  label: string
  state: EventState
}
