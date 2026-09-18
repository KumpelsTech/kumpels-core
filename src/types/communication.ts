/**
 * Dominio de COMUNICACIONES con el paciente (Patient Engagement). Modelo CANÓNICO
 * de Kumpels, base para conectar más adelante WhatsApp Business SIN rediseñar el
 * dominio clínico. La comunicación NO es una segunda verdad clínica: las respuestas
 * relevantes fluyen a Atención Farmacéutica vía señales de atención + WorkItems, y
 * el juicio clínico permanece en el profesional.
 *
 * Mapeo FHIR (documentado, no forzado; sin FHIR crudo como fuente de verdad):
 *   CommunicationMessage → Communication · CommunicationRequest → CommunicationRequest
 *   Questionnaire/QuestionnaireResponse → preguntas/respuestas estructuradas
 *   PatientReportedData clínico → Observation · Patient → Patient
 *   profesional → Practitioner/PractitionerRole · contexto de medicación → MedicationRequest
 *   trabajo de seguimiento → Task · trazabilidad → Provenance/AuditEvent
 *   CommunicationThread / AttentionSignal → nativos de Kumpels.
 */

export type Channel = 'WHATSAPP_SIMULATED'
export type MessageDirection = 'outbound' | 'inbound'
export type SenderType = 'professional' | 'patient' | 'system'

/** Propósito del mensaje (no un registro clínico independiente). */
export type MessageType =
  | 'TEXT' | 'MEDICATION_REMINDER' | 'ADHERENCE_CHECK' | 'SYMPTOM_CHECK'
  | 'PAIN_CHECK' | 'EDUCATION' | 'DOCUMENT' | 'FOLLOWUP_REQUEST'

/** Ciclo de vida del mensaje (saliente) / RECEIVED para entrante. */
export type DeliveryStatus = 'DRAFT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED'

export type ThreadStatus = 'active' | 'pending-response' | 'needs-attention' | 'resolved'

/** Adjunto/recurso educativo (placeholder — sin CMS). */
export interface CommunicationAttachment {
  title: string
  type: string
  resourceId?: string
}

export interface DeliveryEntry { status: DeliveryStatus; at: string }

export interface CommunicationMessage {
  id: string
  threadId: string
  patientId: string
  direction: MessageDirection
  channel: Channel
  messageType: MessageType
  content: string
  senderType: SenderType
  senderId?: string
  senderName?: string
  senderRole?: string
  sentAt: string
  sentIso?: string
  deliveryStatus: DeliveryStatus
  /** Historia de entrega append-only (no se edita un mensaje enviado). */
  statusHistory: DeliveryEntry[]
  relatedMedicationOrderId?: string
  relatedFollowUpId?: string
  relatedQuestionnaireId?: string
  /** Enlace al dato reportado por el paciente derivado de este mensaje. */
  relatedReportId?: string
  attachment?: CommunicationAttachment
  /** Opciones de una pregunta estructurada (para la UI). */
  options?: string[]
  source: string
}

export interface CommunicationThread {
  id: string
  patientId: string
  episodeId?: string
  programId?: string
  assignedTeam?: string
  assignedUserId?: string
  assignedUserName?: string
  status: ThreadStatus
  lastActivityAt: string
  lastActivityIso?: string
  unreadCount: number
  lastPreview?: string
}

/** Plantilla reutilizable (propósito + cuerpo prellenado). */
export interface MessageTemplate {
  id: string
  messageType: MessageType
  title: string
  /** Etiqueta de acción rápida ("Recordar medicamento"). */
  actionLabel: string
  /** Requiere contexto de medicación (referencia canónica). */
  requiresMedication?: boolean
  /** Opciones estructuradas (adherencia/síntomas/dolor). */
  options?: string[]
}

/** Interpretación estructurada de una respuesta del paciente (no un diagnóstico). */
export type PatientReportedType = 'ADHERENCE' | 'SYMPTOM' | 'PAIN_SCORE' | 'INTERRUPTION'
export type AdherenceReported = 'YES' | 'NO' | 'PARTIAL' | 'UNKNOWN'
export type AttentionSeverity = 'NONE' | 'ATTENTION' | 'HIGH'

export interface PatientReportedData {
  id: string
  patientId: string
  threadId: string
  sourceMessageId: string
  type: PatientReportedType
  /** Texto ORIGINAL del paciente (nunca se pierde). */
  rawText: string
  adherence?: AdherenceReported
  painScore?: number
  symptomText?: string
  interruption?: boolean
  /** Interpretación legible (transparente). */
  interpretation: string
  attention: AttentionSeverity
  reportedAt: string
  reportedIso?: string
}

/** Señal de atención derivada (fluye a Atención Farmacéutica; no es un PRM). */
export interface AttentionSignal {
  id: string
  patientId: string
  threadId: string
  reportedDataId: string
  kind: PatientReportedType
  severity: AttentionSeverity
  label: string
  /** Rol propietario del trabajo de revisión (elegibilidad, no un QF fijo). */
  ownerRole: string
  createdAt: string
  workItemId?: string
  /** Etiqueta de procedencia para Patient 360/Atención Farmacéutica. */
  sourceLabel: string
}

/** Comunicación PROGRAMADA (mensaje futuro ligero; no un scheduler completo). */
export type CommunicationRequestStatus = 'Programado' | 'Enviado' | 'Cancelado'
export interface CommunicationRequest {
  id: string
  patientId: string
  threadId: string
  messageType: MessageType
  content: string
  relatedMedicationOrderId?: string
  requestedAt: string
  scheduledFor: string
  requestedById?: string
  requestedByName?: string
  status: CommunicationRequestStatus
}

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  TEXT: 'Mensaje', MEDICATION_REMINDER: 'Recordatorio de medicamento', ADHERENCE_CHECK: 'Chequeo de adherencia',
  SYMPTOM_CHECK: 'Chequeo de síntomas', PAIN_CHECK: 'Escala de dolor', EDUCATION: 'Educación',
  DOCUMENT: 'Documento', FOLLOWUP_REQUEST: 'Solicitud de seguimiento',
}
export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  DRAFT: 'Borrador', QUEUED: 'En cola', SENT: 'Enviado', DELIVERED: 'Entregado', READ: 'Leído', FAILED: 'No enviado', RECEIVED: 'Recibido',
}
