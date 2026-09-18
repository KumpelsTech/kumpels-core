import type { ActorRef } from '../types/actor'
import type {
  AttentionSignal, CommunicationAttachment, MessageType, PatientReportedData,
} from '../types/communication'
import type { DomainEventType } from '../types/domainEvent'
import { evaluateEligibility } from '../utils/eligibility'
import { getUser } from '../utils/adminStore'
import { interpretResponse, reportedTypeFor } from '../utils/responseRules'
import {
  addAttentionSignal, addReportedData, addRequest, appendMessage, commNow, ensureThread,
  setDelivery, setThreadStatus,
} from '../utils/communicationStore'
import { newId } from '../utils/ids'
import { messagingProvider, type OutboundEnvelope } from './messagingProvider'
import { emitEvent, recordAudit, auditNow } from './eventBus'

/**
 * Servicio de aplicación de COMUNICACIONES. UI → servicio → reglas → repositorio →
 * WorkItem/Atención Farmacéutica → auditoría/evento. La interpretación clínica NO
 * vive en componentes React. Enviar requiere capacidad; las respuestas del paciente
 * se interpretan de forma determinista y, si son significativas, generan una señal
 * de atención (que deriva un WorkItem) + evento + auditoría — nunca un diagnóstico.
 */

export interface SendInput {
  patientId: string
  content: string
  messageType: MessageType
  programId?: string
  relatedMedicationOrderId?: string
  relatedQuestionnaireId?: string
  attachment?: CommunicationAttachment
  options?: string[]
  simulateFail?: boolean
}

const EVENT_FOR: Record<string, DomainEventType> = {
  ADHERENCE: 'PATIENT_ADHERENCE_CONCERN_REPORTED',
  SYMPTOM: 'PATIENT_SYMPTOM_REPORTED',
  PAIN_SCORE: 'PATIENT_PAIN_REPORTED',
  INTERRUPTION: 'PATIENT_TREATMENT_INTERRUPTION_REPORTED',
}

function canSend(actor: ActorRef): { ok: boolean; reason?: string } {
  const user = getUser(actor.id)
  if (!user) return { ok: false, reason: 'Usuario no encontrado' }
  const el = evaluateEligibility(user, { capability: 'PATIENT_COMMUNICATION_SEND' })
  return el.eligible ? { ok: true } : { ok: false, reason: el.reason }
}

export const communicationService = {
  /** Envía un mensaje al paciente (guardado por capacidad). Historia inmutable. */
  async send(input: SendInput, actor: ActorRef): Promise<{ ok: boolean; reason?: string; messageId?: string }> {
    const guard = canSend(actor)
    if (!guard.ok) return guard
    const thread = ensureThread(input.patientId, input.programId)
    const stamp = commNow()
    const msg = appendMessage(thread.id, input.patientId, {
      direction: 'outbound', channel: 'WHATSAPP_SIMULATED', messageType: input.messageType, content: input.content,
      senderType: 'professional', senderId: actor.id, senderName: actor.name, senderRole: actor.role,
      sentAt: stamp.label, sentIso: stamp.iso, deliveryStatus: 'DRAFT', statusHistory: [{ status: 'DRAFT', at: stamp.label }],
      relatedMedicationOrderId: input.relatedMedicationOrderId, relatedQuestionnaireId: input.relatedQuestionnaireId,
      attachment: input.attachment, options: input.options, source: 'whatsapp',
    })
    const env: OutboundEnvelope = { patientId: input.patientId, content: input.content, messageType: input.messageType, channel: 'WHATSAPP_SIMULATED', simulateFail: input.simulateFail }
    const res = await messagingProvider.send(env)
    for (const s of res.lifecycle) setDelivery(thread.id, msg.id, s)
    if (input.messageType === 'ADHERENCE_CHECK' || input.messageType === 'SYMPTOM_CHECK' || input.messageType === 'PAIN_CHECK' || input.messageType === 'FOLLOWUP_REQUEST') {
      setThreadStatus(input.patientId, 'pending-response')
    }
    return { ok: res.ok, reason: res.ok ? undefined : 'No enviado', messageId: msg.id }
  },

  /** Reintenta un envío fallido (conserva el intento previo). */
  async retry(patientId: string, messageId: string): Promise<{ ok: boolean }> {
    const thread = ensureThread(patientId)
    const res = await messagingProvider.send({ patientId, content: '', messageType: 'TEXT', channel: 'WHATSAPP_SIMULATED' })
    for (const s of res.lifecycle) setDelivery(thread.id, messageId, s)
    return { ok: res.ok }
  },

  /** Programa un mensaje futuro (modelado y visible como "Programado"; sin ejecución en background). */
  schedule(input: { patientId: string; content: string; messageType: MessageType; scheduledFor: string; relatedMedicationOrderId?: string }, actor: ActorRef): { ok: boolean; reason?: string } {
    const guard = canSend(actor)
    if (!guard.ok) return guard
    const thread = ensureThread(input.patientId)
    const stamp = commNow()
    addRequest({
      id: newId('creq'), patientId: input.patientId, threadId: thread.id, messageType: input.messageType, content: input.content,
      relatedMedicationOrderId: input.relatedMedicationOrderId, requestedAt: stamp.label, scheduledFor: input.scheduledFor,
      requestedById: actor.id, requestedByName: actor.name, status: 'Programado',
    })
    return { ok: true }
  },

  /**
   * Respuesta ENTRANTE del paciente (mensajería simulada). Conserva el texto
   * original, lo interpreta de forma determinista y, si es significativo, crea
   * PatientReportedData + AttentionSignal (que deriva un WorkItem) + evento + auditoría.
   */
  simulateInbound(patientId: string, replyText: string, questionType: MessageType): { ok: boolean; attention?: AttentionSignal } {
    const thread = ensureThread(patientId)
    const stamp = commNow()
    const type = reportedTypeFor(questionType)
    const msg = appendMessage(thread.id, patientId, {
      direction: 'inbound', channel: 'WHATSAPP_SIMULATED', messageType: questionType, content: replyText,
      senderType: 'patient', sentAt: stamp.label, sentIso: stamp.iso, deliveryStatus: 'RECEIVED', statusHistory: [{ status: 'RECEIVED', at: stamp.label }], source: 'whatsapp',
    })
    if (!type) return { ok: true }
    const interp = interpretResponse(questionType, replyText)
    if (!interp) return { ok: true }
    const reportId = newId('prd')
    const data: PatientReportedData = {
      id: reportId, patientId, threadId: thread.id, sourceMessageId: msg.id, type: interp.type,
      rawText: replyText, adherence: interp.adherence, painScore: interp.painScore, symptomText: interp.symptomText,
      interruption: interp.interruption, interpretation: interp.interpretation, attention: interp.attention,
      reportedAt: stamp.label, reportedIso: stamp.iso,
    }
    addReportedData(data)
    msg.relatedReportId = reportId
    if (interp.attention === 'NONE') { setThreadStatus(patientId, 'active'); return { ok: true } }

    const signal: AttentionSignal = {
      id: newId('ats'), patientId, threadId: thread.id, reportedDataId: reportId, kind: interp.type,
      severity: interp.attention, label: interp.workLabel ?? 'Revisar respuesta del paciente', ownerRole: 'qf-clinico',
      createdAt: stamp.label, sourceLabel: 'Reportado por el paciente vía WhatsApp',
    }
    addAttentionSignal(signal)
    setThreadStatus(patientId, 'needs-attention')

    const evt = EVENT_FOR[interp.type]
    if (evt) {
      emitEvent({
        type: evt, sourceDomain: 'communication', sourceEntityType: 'PatientReportedData', sourceEntityId: reportId,
        patientId, occurredAt: auditNow(), actorId: 'paciente', actorRole: 'Paciente', actorType: 'user',
        summary: interp.interpretation, reason: replyText, source: 'communication', sourceSystem: 'kumpels',
      })
    }
    emitEvent({
      type: 'FOLLOWUP_RESPONSE_REQUIRES_REVIEW', sourceDomain: 'communication', sourceEntityType: 'AttentionSignal', sourceEntityId: signal.id,
      patientId, occurredAt: auditNow(), actorId: 'sistema', actorRole: 'Sistema', actorType: 'system',
      summary: signal.label, source: 'communication', sourceSystem: 'kumpels',
    })
    recordAudit({
      action: 'FOLLOWUP_RESPONSE_REQUIRES_REVIEW', entityType: 'AttentionSignal', entityId: signal.id, patientId,
      actorId: 'sistema', actorName: 'Sistema', actorRole: 'Sistema',
      newState: interp.interpretation, reason: replyText, source: 'communication', sourceSystem: 'kumpels',
    })
    return { ok: true, attention: signal }
  },
}
export type CommunicationService = typeof communicationService
