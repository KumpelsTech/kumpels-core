/**
 * ProductionRequest — solicitud OPERATIVA de Enfermería a Central de Mezclas para
 * producir un tratamiento. Concepto NATIVO de Kumpels, DISTINTO de la prescripción
 * clínica (MedicationOrder / MedicationRequest): referencia las entidades canónicas
 * por id, no copia su payload clínico.
 *
 * Mapeo FHIR: ProductionRequest ↔ Task (intent=order, focus=MedicationRequest,
 * for=Patient, owner=PractitionerRole Central de Mezclas). NO se fuerza a
 * MedicationRequest: la prescripción y la solicitud de producción son distintas.
 */
export type ProductionRequestStatus =
  | 'DRAFT' | 'READY_TO_SEND' | 'SENT_TO_PRODUCTION' | 'ACCEPTED_BY_COMPOUNDING' | 'CANCELLED'

export interface ProductionRequestEntry {
  id: string
  at: string
  atIso?: string
  from?: ProductionRequestStatus
  to: ProductionRequestStatus
  actorId?: string
  actorName?: string
  actorRole?: string
  reason?: string
}

export interface ProductionRequest {
  id: string
  patientId: string
  episodeId?: string
  medicationOrderId?: string
  therapyPlanId?: string
  /** Orden de preparación asociada (la producción concreta). */
  preparationOrderId: string
  scheduledTreatmentAt?: string
  requestedById?: string
  requestedByName?: string
  requestedByRole?: string
  requestedAt?: string
  requestedAtIso?: string
  facility?: string
  program?: string
  status: ProductionRequestStatus
  note?: string
  /** Aceptación por Central de Mezclas (acuse de recepción del handoff). */
  acceptedById?: string
  acceptedByName?: string
  acceptedByRole?: string
  acceptedAt?: string
  acceptedAtIso?: string
  /** true si la aceptación se realizó automáticamente al iniciar la preparación. */
  acceptedAuto?: boolean
  cancelReason?: string
  cancelledAt?: string
  history: ProductionRequestEntry[]
}

export const PRODUCTION_STATUS_LABEL: Record<ProductionRequestStatus, string> = {
  DRAFT: 'Borrador', READY_TO_SEND: 'Lista para enviar', SENT_TO_PRODUCTION: 'Enviada a producción',
  ACCEPTED_BY_COMPOUNDING: 'Aceptada por Central de Mezclas', CANCELLED: 'Cancelada',
}
