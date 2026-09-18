/**
 * Sello de tiempo CANÓNICO de Kumpels. Toda acción clínica u operativa relevante
 * se marca con FECHA + HORA EXACTAS (no "Hoy"). Se conserva el instante en ISO
 * 8601 (tz-aware, forma de persistencia) y se presenta con una etiqueta legible
 * en español: "14 sep 2026 · 10:42".
 *
 * Mapeo FHIR: los campos de tiempo (occurredAt, recorded, whenHandedOver,
 * effectiveDateTime…) usan `iso`; la etiqueta legible es solo presentación.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export interface Stamp {
  /** Instante ISO 8601 (tz-aware) — forma de persistencia. */
  iso: string
  /** Etiqueta legible "14 sep 2026 · 10:42". */
  label: string
}

/** Formatea una fecha a la etiqueta legible canónica. */
export function formatStamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mi}`
}

/** Solo fecha, sin hora — para controles de programación ("14 sep 2026"). */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/** Instante actual como Stamp (ISO tz-aware + etiqueta legible). */
export function now(): Stamp {
  const d = new Date()
  return { iso: d.toISOString(), label: formatStamp(d) }
}

/** Etiqueta legible del instante actual (para campos `at` de eventos/UI). */
export function nowLabel(): string {
  return formatStamp(new Date())
}

/** ISO tz-aware del instante actual (para campos de persistencia). */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Combina una fecha (YYYY-MM-DD de un control) y una hora opcional (HH:MM) en un
 * Stamp tz-aware. Para reprogramación de disponibilidad/administración.
 */
export function stampFromInput(dateStr: string, timeStr?: string): Stamp {
  const d = new Date(`${dateStr}T${timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '00:00'}:00`)
  if (Number.isNaN(d.getTime())) return now()
  return {
    iso: d.toISOString(),
    label: timeStr ? formatStamp(d) : formatDate(d),
  }
}
