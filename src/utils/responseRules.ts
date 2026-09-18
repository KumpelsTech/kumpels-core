import type {
  AdherenceReported, AttentionSeverity, MessageType, PatientReportedType,
} from '../types/communication'

/**
 * Capa de REGLAS DETERMINISTAS (transparente, sin IA predictiva). Interpreta la
 * respuesta del paciente en un dato estructurado + severidad de atención. NO
 * diagnostica: solo decide si un profesional debe REVISAR. Umbrales configurables.
 */

/** Umbral de dolor que amerita atención (configurable a futuro por política). */
export const PAIN_ATTENTION_THRESHOLD = 7

export interface Interpretation {
  type: PatientReportedType
  adherence?: AdherenceReported
  painScore?: number
  symptomText?: string
  interruption?: boolean
  interpretation: string
  attention: AttentionSeverity
  /** Etiqueta corta del WorkItem/atención (o undefined si no requiere trabajo). */
  workLabel?: string
}

const norm = (s: string) => s.trim().toLowerCase()

/** Tipo de dato reportado según el tipo de pregunta enviada. */
export function reportedTypeFor(questionType: MessageType): PatientReportedType | undefined {
  if (questionType === 'ADHERENCE_CHECK') return 'ADHERENCE'
  if (questionType === 'SYMPTOM_CHECK') return 'SYMPTOM'
  if (questionType === 'PAIN_CHECK') return 'PAIN_SCORE'
  if (questionType === 'FOLLOWUP_REQUEST') return 'INTERRUPTION'
  return undefined
}

function interpretAdherence(text: string): Interpretation {
  const t = norm(text)
  let adherence: AdherenceReported = 'UNKNOWN'
  if (/^s[ií]\b|^si$|correcto|sin problema/.test(t)) adherence = 'YES'
  else if (/parcial|a veces|algunas|olvid/.test(t)) adherence = 'PARTIAL'
  else if (/^no\b|no he|no lo|no pude|no tom/.test(t)) adherence = 'NO'
  const attention: AttentionSeverity = adherence === 'NO' || adherence === 'PARTIAL' ? 'ATTENTION' : 'NONE'
  return {
    type: 'ADHERENCE', adherence,
    interpretation: adherence === 'YES' ? 'Adherencia reportada: sí' : adherence === 'NO' ? 'Adherencia reportada: no' : adherence === 'PARTIAL' ? 'Adherencia reportada: parcial' : 'Adherencia no clara',
    attention, workLabel: attention !== 'NONE' ? 'Revisar posible problema de adherencia' : undefined,
  }
}

function interpretSymptom(text: string): Interpretation {
  const t = norm(text)
  const negative = /^no\b|ningun|sin s[ií]ntoma|todo bien|estoy bien/.test(t)
  const yes = !negative
  return {
    type: 'SYMPTOM', symptomText: yes ? text.trim() : undefined,
    interpretation: yes ? 'Síntoma reportado por el paciente' : 'Sin síntomas reportados',
    attention: yes ? 'ATTENTION' : 'NONE',
    workLabel: yes ? 'Revisar síntoma reportado por el paciente' : undefined,
  }
}

function interpretPain(text: string): Interpretation {
  const m = /(\d{1,2})/.exec(text)
  const painScore = m ? Math.min(10, Math.max(0, Number(m[1]))) : undefined
  const attention: AttentionSeverity = painScore != null && painScore >= PAIN_ATTENTION_THRESHOLD ? 'ATTENTION' : 'NONE'
  return {
    type: 'PAIN_SCORE', painScore,
    interpretation: painScore != null ? `Dolor reportado: ${painScore}/10` : 'Nivel de dolor no claro',
    attention, workLabel: attention !== 'NONE' ? 'Revisar reporte de dolor' : undefined,
  }
}

function interpretInterruption(text: string): Interpretation {
  const t = norm(text)
  const interrupted = /^s[ií]\b|suspend|dej[eé]|interrump|par[eé]/.test(t)
  return {
    type: 'INTERRUPTION', interruption: interrupted,
    interpretation: interrupted ? 'Posible interrupción del tratamiento' : 'Continúa el tratamiento',
    attention: interrupted ? 'HIGH' : 'NONE',
    workLabel: interrupted ? 'Revisar posible interrupción del tratamiento' : undefined,
  }
}

/** Interpreta una respuesta del paciente según el tipo de pregunta. */
export function interpretResponse(questionType: MessageType, text: string): Interpretation | undefined {
  const type = reportedTypeFor(questionType)
  if (!type) return undefined
  if (type === 'ADHERENCE') return interpretAdherence(text)
  if (type === 'SYMPTOM') return interpretSymptom(text)
  if (type === 'PAIN_SCORE') return interpretPain(text)
  return interpretInterruption(text)
}
