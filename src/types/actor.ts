/**
 * Actor de una acción — QUIÉN la ejecutó. Identidad estable (id) + nombre + rol,
 * para atribución consistente en eventos y auditoría. Hoy proviene de la persona
 * demo activa (personaStore); mañana, de la sesión autenticada real.
 *
 * Mapeo FHIR: ActorRef ↔ Practitioner + PractitionerRole (performer/author).
 */
export interface ActorRef {
  /** Id estable del actor (persona/rol demo hoy; usuario real en el futuro). */
  id: string
  name: string
  role: string
}

/** Actor de sistema (procesos automáticos: prevalidación, reglas). */
export const SYSTEM_ACTOR: ActorRef = { id: 'system', name: 'Kumpels', role: 'Sistema' }
