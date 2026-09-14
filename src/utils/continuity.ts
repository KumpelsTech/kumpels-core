import type { Continuity, MedicationFulfillment } from '../types/fulfillment'

/** Día del mes "hoy" en el contexto sintético (11 Sep 2026). */
export const TODAY_DAY = 11

/**
 * Impacto en continuidad — determinístico y explicable (sin IA).
 * Compara la disponibilidad estimada del pendiente con la próxima necesidad
 * de la terapia (aplicación/dispensación). Es una SEÑAL operativa/clínica,
 * no una decisión autónoma.
 */
export function deriveContinuity(f: MedicationFulfillment, remaining: number): Continuity {
  if (remaining <= 0) return { risk: 'sin-riesgo', explain: 'Cumplimiento completo; sin impacto en continuidad.' }

  const need = f.nextNeedDay
  const needLabel = f.nextNeedLabel ?? 'la próxima aplicación programada'
  const exp = f.expectedDay

  if (f.blocked && exp == null) {
    return { risk: 'retrasado', explain: 'Tratamiento potencialmente retrasado: dispensación bloqueada sin fecha estimada.' }
  }
  if (exp == null) {
    return { risk: 'en-riesgo', explain: `Sin fecha estimada de disponibilidad antes de ${needLabel}.` }
  }
  if (exp < TODAY_DAY) {
    return { risk: 'retrasado', explain: `Disponibilidad estimada vencida (Sep ${exp}).` }
  }
  if (need != null && exp > need) {
    return { risk: 'en-riesgo', explain: `Disponibilidad estimada (Sep ${exp}) posterior a ${needLabel} (Sep ${need}).` }
  }
  return {
    risk: 'sin-riesgo',
    explain: need != null
      ? `Disponibilidad estimada (Sep ${exp}) antes de ${needLabel} (Sep ${need}).`
      : `Disponibilidad estimada (Sep ${exp}); sin necesidad inmediata programada.`,
  }
}

/** Rango de prioridad para ordenar la cola (menor = más urgente). */
export function continuityRank(risk: Continuity['risk']): number {
  return risk === 'retrasado' ? 0 : risk === 'en-riesgo' ? 1 : 2
}
