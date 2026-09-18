/**
 * Corrección CONTROLADA de un registro clínicamente relevante. Un registro nunca
 * se sobreescribe en silencio: la corrección conserva el valor previo y produce
 * una proyección vigente. Append-only.
 *
 * Mapeo FHIR: ENTERED_IN_ERROR ↔ status = entered-in-error; DATA_CORRECTION /
 * AMENDMENT ↔ nueva versión + Provenance (activity = amend/correct). No se
 * almacena FHIR crudo como fuente de verdad.
 */
export type CorrectionType = 'DATA_CORRECTION' | 'AMENDMENT' | 'ENTERED_IN_ERROR'

export interface CorrectionRecord {
  id: string
  targetEntityType: string
  targetEntityId: string
  correctionType: CorrectionType
  /** Valor/estado previo (instantánea legible del registro original). */
  previousValue: string
  /** Valor/estado corregido (proyección vigente). */
  correctedValue: string
  reason: string
  comment?: string
  actorId: string
  actorName: string
  actorRole: string
  occurredAt: string
  occurredAtIso: string
  patientId?: string
  episodeId?: string
  version: number
}

export const CORRECTION_TYPE_LABEL: Record<CorrectionType, string> = {
  DATA_CORRECTION: 'Corrección de dato',
  AMENDMENT: 'Enmienda',
  ENTERED_IN_ERROR: 'Registrado por error',
}
