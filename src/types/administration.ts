/**
 * Dominio de ADMINISTRACIÓN de medicación (enfermería). Entidad canónica de
 * Kumpels, DISTINTA de la preparación y de la dispensación; se enlaza a la orden
 * y a la preparación por id (no las duplica).
 *
 * Mapeo FHIR (documentado, no forzado): MedicationAdministration
 *   patientId → subject · medication/dose/route → medication + dosage
 *   performer* → performer (Practitioner/PractitionerRole)
 *   startedAt/completedAt → effectivePeriod · result → status
 *   reason (no administrada/parcial) → statusReason
 * NO se almacena FHIR crudo como fuente de verdad.
 */
/**
 * Resultado de la administración. Mapeo FHIR MedicationAdministration.status:
 *   administrada → completed · parcial → in-progress/stopped (parcial) ·
 *   detenida → stopped · no-administrada → not-done · (entered-in-error vía corrección).
 * SCHEDULED/IN_PROGRESS son transitorios previos al registro terminal.
 */
export type AdministrationResult = 'administrada' | 'parcial' | 'detenida' | 'no-administrada'

/** Disposición del remanente cuando la administración no se completa. */
export type RemainderStatus = 'RETURNED' | 'DISCARDED' | 'HELD_FOR_REVIEW' | 'REUSABLE_PER_POLICY' | 'DESTROYED' | 'UNKNOWN' | 'OTHER'

export interface RemainderDisposition {
  quantity?: string
  status: RemainderStatus
  actorName?: string
  at?: string
  comment?: string
}

export interface MedicationAdministration {
  id: string
  /** Orden de preparación de origen (trazabilidad de lote/preparación). */
  preparationOrderId?: string
  /** Orden de medicación cuando aplica. */
  medicationOrderId?: string
  patientId: string
  episodeId?: string

  medication: string
  dose: string
  route: string
  /** Referencia de trazabilidad de lote/preparación cuando aplica. */
  preparationRef?: string
  lotReference?: string

  scheduledAt?: string
  startedAt?: string
  /** Momento de detención/finalización (parcial/detenida/completada). */
  stoppedAt?: string
  completedAt?: string

  /** Dosis/volumen planificado vs administrado vs remanente (infusión). */
  plannedVolume?: string
  administeredVolume?: string
  remainingVolume?: string
  /** Disposición del remanente cuando no se completa. */
  remainder?: RemainderDisposition

  result: AdministrationResult
  /** Requerido cuando no se completa (no-administrada / parcial / detenida). */
  reason?: string
  observation?: string
  /** Registrado por error (FHIR status = entered-in-error). Corrección controlada. */
  enteredInError?: boolean

  performerId: string
  performerName: string
  performerRole: string

  /** Momento del registro. */
  at: string
  atIso: string

  source?: string
  sourceSystem?: string
  version: number
}
