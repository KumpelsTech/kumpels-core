import type { WorkItem } from '../types/work'

/**
 * Cola de prioridad DETERMINISTA y EXPLICABLE (no IA predictiva). Puntúa cada
 * WorkItem con señales ya disponibles y produce el "por qué" en lenguaje claro.
 * El Coordinador no inspecciona paciente por paciente: la cola ordena el trabajo
 * y explica cada prioridad.
 */
export type PriorityLevel = 'CRÍTICO' | 'ALTA' | 'MEDIA' | 'BAJA'

export interface PrioritizedItem {
  item: WorkItem
  score: number
  level: PriorityLevel
  reasons: string[]
  slaMinutes?: number
}

/** Contexto horario demo (12:02) para el cálculo de SLA reproducible. */
const DEMO_NOW_MINUTES = 12 * 60 + 2

const BASE_PRIORITY: Record<string, number> = { HIGH: 100, ACTION: 60, MONITOR: 30, none: 10 }

export function slaMinutesOf(item: WorkItem): number | undefined {
  return item.dueMinutes == null ? undefined : item.dueMinutes - DEMO_NOW_MINUTES
}

/** Puntúa un WorkItem y arma la lista de razones (orden de aparición = relevancia). */
export function scoreItem(item: WorkItem): { score: number; reasons: string[]; slaMinutes?: number } {
  const s = item.signals ?? {}
  let score = BASE_PRIORITY[item.priority] ?? 10
  const reasons: string[] = []

  if (item.escalationState === 'escalated') { score += 100; reasons.push('Escalado por coordinación') }
  if (item.priority === 'HIGH') reasons.push('Prioridad clínica alta')

  if (s.unresolvedFinding) { score += 50; reasons.push('Revisión clínica pendiente') }
  if (s.continuityRisk === 'retrasado') { score += 80; reasons.push('Continuidad: tratamiento potencialmente retrasado') }
  else if (s.continuityRisk === 'en-riesgo') { score += 40; reasons.push('Continuidad en riesgo') }
  if (s.blocked) { score += 30; reasons.push(item.blockerReason ?? 'Bloqueado — esperando a otro equipo') }
  else if (item.blockerReason) reasons.push(item.blockerReason)

  const sla = slaMinutesOf(item)
  if (sla != null && sla >= 0) {
    if (sla <= 60) { score += 70; reasons.push(`${sla} min para SLA de administración`) }
    else if (sla <= 120) { score += 40; reasons.push(`${sla} min para administración`) }
    if (item.dueLabel) reasons.push(`Administración programada ${item.dueLabel.replace('Hoy ', '')}`)
  }

  if (s.readyNotSent) {
    score += 25
    if (sla != null && sla >= 0 && sla <= 90) reasons.push(`Programado en ${sla} min y aún no enviado a producción`)
    else reasons.push('Listo — pendiente de envío a producción por Enfermería')
  }
  if (s.sentNotAccepted) {
    score += 20
    if (typeof s.sentAgoMinutes === 'number' && s.sentAgoMinutes >= 20) reasons.push(`Enviada hace ${s.sentAgoMinutes} min y Central de Mezclas no la ha aceptado`)
    else reasons.push('Enviada a producción — esperando aceptación de Central de Mezclas')
  }
  if (s.pendingContact) { score += 15; reasons.push('Contacto con paciente pendiente') }
  if (typeof s.daysPending === 'number' && s.daysPending >= 5) { score += Math.min(s.daysPending * 3, 30); reasons.push(`Pendiente hace ${s.daysPending} días`) }
  if (!item.owner) { score += 20; reasons.push('Sin responsable asignado') }

  if (reasons.length === 0) reasons.push(item.statusLabel)
  return { score, reasons, slaMinutes: sla }
}

function levelOf(score: number): PriorityLevel {
  if (score >= 160) return 'CRÍTICO'
  if (score >= 95) return 'ALTA'
  if (score >= 50) return 'MEDIA'
  return 'BAJA'
}

/** Construye la cola priorizada (mayor score primero; SLA como desempate). */
export function buildPriorityQueue(items: WorkItem[]): PrioritizedItem[] {
  return items
    .map((item) => {
      const { score, reasons, slaMinutes } = scoreItem(item)
      return { item, score, level: levelOf(score), reasons, slaMinutes }
    })
    .sort((a, b) => b.score - a.score
      || (a.slaMinutes ?? 9999) - (b.slaMinutes ?? 9999)
      || a.item.patientName.localeCompare(b.item.patientName))
}

export const LEVEL_TONE: Record<PriorityLevel, 'crit' | 'warn' | 'info' | 'ok'> = {
  CRÍTICO: 'crit', ALTA: 'warn', MEDIA: 'info', BAJA: 'ok',
}
