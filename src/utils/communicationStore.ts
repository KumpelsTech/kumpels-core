import { useSyncExternalStore } from 'react'
import type {
  AttentionSignal, CommunicationMessage, CommunicationRequest, CommunicationThread,
  DeliveryStatus, MessageTemplate, PatientReportedData,
} from '../types/communication'
import { newId } from './ids'
import { now, nowLabel } from './datetime'

/**
 * Estado de COMUNICACIONES (en memoria, sesión). Fuente única de hilos, mensajes,
 * solicitudes programadas, datos reportados por el paciente y señales de atención.
 * Los objetos React de la UI NO son la fuente de verdad. Historia inmutable: un
 * mensaje enviado no se edita (una corrección es un mensaje nuevo).
 */
const threads = new Map<string, CommunicationThread>()          // patientId → thread (uno por paciente en esta iteración)
const messages = new Map<string, CommunicationMessage[]>()      // threadId → messages (cronológico)
const requests = new Map<string, CommunicationRequest[]>()      // patientId → programados
const reported = new Map<string, PatientReportedData>()         // id → dato reportado
const attention = new Map<string, AttentionSignal>()            // id → señal de atención
const listeners = new Set<() => void>()
let version = 0
let seeded = false

function emit() { version += 1; listeners.forEach((l) => l()) }
function subscribe(l: () => void) { seed(); listeners.add(l); return () => listeners.delete(l) }

/* ---------------- Plantillas y documentos ---------------- */
export const TEMPLATES: MessageTemplate[] = [
  { id: 'TPL-REMINDER', messageType: 'MEDICATION_REMINDER', title: 'Recordatorio de medicamento', actionLabel: 'Recordar medicamento', requiresMedication: true },
  { id: 'TPL-ADHERENCE', messageType: 'ADHERENCE_CHECK', title: 'Chequeo de adherencia', actionLabel: 'Preguntar adherencia', options: ['Sí', 'No', 'Parcialmente'] },
  { id: 'TPL-SYMPTOM', messageType: 'SYMPTOM_CHECK', title: 'Chequeo de síntomas', actionLabel: 'Preguntar síntomas', options: ['No', 'Sí'] },
  { id: 'TPL-PAIN', messageType: 'PAIN_CHECK', title: 'Escala de dolor', actionLabel: 'Preguntar dolor', options: ['0', '2', '4', '6', '8', '10'] },
  { id: 'TPL-EDU', messageType: 'EDUCATION', title: 'Educación', actionLabel: 'Enviar educación' },
  { id: 'TPL-DOC', messageType: 'DOCUMENT', title: 'Documento', actionLabel: 'Enviar documento' },
  { id: 'TPL-FOLLOWUP', messageType: 'FOLLOWUP_REQUEST', title: 'Solicitud de seguimiento', actionLabel: 'Solicitar seguimiento', options: ['Continúo', 'Suspendí'] },
]
export const EDUCATION_DOCS = [
  { title: 'Información sobre posibles efectos del tratamiento', type: 'Educación', resourceId: 'DOC-EFECTOS' },
  { title: 'Cómo prepararte para tu próximo tratamiento', type: 'Preparación', resourceId: 'DOC-PREP' },
  { title: 'Manejo de náuseas en casa', type: 'Educación', resourceId: 'DOC-NAUSEAS' },
]

/* ---------------- Seed ---------------- */
function pushMsg(threadId: string, m: CommunicationMessage) {
  messages.set(threadId, [...(messages.get(threadId) ?? []), m])
}
function seed() {
  if (seeded) return
  seeded = true
  // Carlos Ramírez (ONC-2018, oral · Capecitabina) — con un reporte de adherencia ya recibido.
  const tid = 'THR-2018'
  threads.set('ONC-2018', {
    id: tid, patientId: 'ONC-2018', episodeId: 'EOC-ONC-2018', programId: 'PRG-ONC-CAS',
    assignedTeam: 'Farmacia Clínica', status: 'needs-attention',
    lastActivityAt: 'Hoy 10:14', unreadCount: 1, lastPreview: 'No he podido tomar el medicamento…',
  })
  pushMsg(tid, { id: 'CM-2018-1', threadId: tid, patientId: 'ONC-2018', direction: 'outbound', channel: 'WHATSAPP_SIMULATED', messageType: 'MEDICATION_REMINDER', content: 'Hola, Carlos. Recuerda tomar Capecitabina según el esquema indicado por tu equipo tratante.', senderType: 'professional', senderId: 'USR-2', senderName: 'Ximena Torres', senderRole: 'QF Clínico', sentAt: 'Hoy 09:40', deliveryStatus: 'READ', statusHistory: [{ status: 'SENT', at: 'Hoy 09:40' }, { status: 'READ', at: 'Hoy 09:45' }], relatedMedicationOrderId: 'ORD-2018', source: 'whatsapp' })
  pushMsg(tid, { id: 'CM-2018-2', threadId: tid, patientId: 'ONC-2018', direction: 'outbound', channel: 'WHATSAPP_SIMULATED', messageType: 'ADHERENCE_CHECK', content: '¿Has podido tomar tu medicamento según lo indicado?', options: ['Sí', 'No', 'Parcialmente'], senderType: 'professional', senderId: 'USR-2', senderName: 'Ximena Torres', senderRole: 'QF Clínico', sentAt: 'Hoy 10:10', deliveryStatus: 'READ', statusHistory: [{ status: 'SENT', at: 'Hoy 10:10' }, { status: 'READ', at: 'Hoy 10:12' }], relatedQuestionnaireId: 'Q-ADHERENCE', source: 'whatsapp' })
  const rid = 'PRD-2018-1'
  pushMsg(tid, { id: 'CM-2018-3', threadId: tid, patientId: 'ONC-2018', direction: 'inbound', channel: 'WHATSAPP_SIMULATED', messageType: 'ADHERENCE_CHECK', content: 'No he podido tomar el medicamento estos días.', senderType: 'patient', sentAt: 'Hoy 10:14', deliveryStatus: 'RECEIVED', statusHistory: [{ status: 'RECEIVED', at: 'Hoy 10:14' }], relatedReportId: rid, source: 'whatsapp' })
  reported.set(rid, { id: rid, patientId: 'ONC-2018', threadId: tid, sourceMessageId: 'CM-2018-3', type: 'ADHERENCE', rawText: 'No he podido tomar el medicamento estos días.', adherence: 'NO', interpretation: 'Adherencia reportada: no', attention: 'ATTENTION', reportedAt: 'Hoy 10:14' })
  attention.set('ATS-2018-1', { id: 'ATS-2018-1', patientId: 'ONC-2018', threadId: tid, reportedDataId: rid, kind: 'ADHERENCE', severity: 'ATTENTION', label: 'Revisar posible problema de adherencia', ownerRole: 'qf-clinico', createdAt: 'Hoy 10:14', sourceLabel: 'Reportado por el paciente vía WhatsApp' })

  // Marta Ruiz (ONC-2011, oral) — conversación tranquila, sin atención.
  const t2 = 'THR-2011'
  threads.set('ONC-2011', { id: t2, patientId: 'ONC-2011', programId: 'PRG-ONC-TEU', assignedTeam: 'Farmacia Clínica', status: 'active', lastActivityAt: 'Ayer 16:20', unreadCount: 0, lastPreview: 'Gracias, todo bien.' })
  pushMsg(t2, { id: 'CM-2011-1', threadId: t2, patientId: 'ONC-2011', direction: 'outbound', channel: 'WHATSAPP_SIMULATED', messageType: 'ADHERENCE_CHECK', content: '¿Has podido tomar tu medicamento según lo indicado?', options: ['Sí', 'No', 'Parcialmente'], senderType: 'professional', senderId: 'USR-2', senderName: 'Ximena Torres', senderRole: 'QF Clínico', sentAt: 'Ayer 16:00', deliveryStatus: 'READ', statusHistory: [{ status: 'SENT', at: 'Ayer 16:00' }, { status: 'READ', at: 'Ayer 16:18' }], source: 'whatsapp' })
  pushMsg(t2, { id: 'CM-2011-2', threadId: t2, patientId: 'ONC-2011', direction: 'inbound', channel: 'WHATSAPP_SIMULATED', messageType: 'ADHERENCE_CHECK', content: 'Sí, todo bien. Gracias.', senderType: 'patient', sentAt: 'Ayer 16:20', deliveryStatus: 'RECEIVED', statusHistory: [{ status: 'RECEIVED', at: 'Ayer 16:20' }], source: 'whatsapp' })
}

/* ---------------- Lecturas ---------------- */
export function ensureThread(patientId: string, programId?: string): CommunicationThread {
  seed()
  let t = threads.get(patientId)
  if (!t) {
    t = { id: `THR-${patientId}`, patientId, programId, status: 'active', lastActivityAt: nowLabel(), unreadCount: 0 }
    threads.set(patientId, t)
  }
  return t
}
export function getThread(patientId: string): CommunicationThread | undefined { seed(); return threads.get(patientId) }
export function listThreads(): CommunicationThread[] { seed(); return [...threads.values()] }
export function messagesFor(threadId: string): CommunicationMessage[] { seed(); return messages.get(threadId) ?? [] }
export function requestsFor(patientId: string): CommunicationRequest[] { seed(); return requests.get(patientId) ?? [] }
export function listAttentionSignals(): AttentionSignal[] { seed(); return [...attention.values()] }
export function attentionForPatient(patientId: string): AttentionSignal[] { seed(); return [...attention.values()].filter((a) => a.patientId === patientId) }
export function getReported(id: string): PatientReportedData | undefined { seed(); return reported.get(id) }

/* ---------------- Escrituras (invocadas por el servicio, no por la UI) ---------------- */
export function appendMessage(threadId: string, patientId: string, m: Omit<CommunicationMessage, 'id' | 'threadId' | 'patientId'>): CommunicationMessage {
  seed()
  const msg: CommunicationMessage = { ...m, id: newId('cm'), threadId, patientId }
  pushMsg(threadId, msg)
  const t = threads.get(patientId)
  if (t) {
    t.lastActivityAt = msg.sentAt; t.lastPreview = msg.content.slice(0, 60)
    if (msg.direction === 'inbound') t.unreadCount += 1
  }
  emit()
  return msg
}
export function setDelivery(threadId: string, messageId: string, status: DeliveryStatus) {
  const list = messages.get(threadId); if (!list) return
  const m = list.find((x) => x.id === messageId); if (!m) return
  m.deliveryStatus = status; m.statusHistory = [...m.statusHistory, { status, at: nowLabel() }]
  emit()
}
export function markThreadRead(patientId: string) {
  const t = threads.get(patientId); if (!t) return
  if (t.unreadCount !== 0) { t.unreadCount = 0; emit() }
}
export function setThreadStatus(patientId: string, status: CommunicationThread['status']) {
  const t = threads.get(patientId); if (!t) return
  t.status = status; emit()
}
export function setThreadAssignee(patientId: string, userId?: string, userName?: string) {
  const t = threads.get(patientId); if (!t) return
  t.assignedUserId = userId; t.assignedUserName = userName; emit()
}
export function addReportedData(d: PatientReportedData) { reported.set(d.id, d); emit() }
export function addAttentionSignal(s: AttentionSignal) { attention.set(s.id, s); emit() }
export function addRequest(r: CommunicationRequest) {
  requests.set(r.patientId, [...(requests.get(r.patientId) ?? []), r]); emit()
}

export function useCommunicationStore() {
  useSyncExternalStore(subscribe, () => version, () => version)
  return { listThreads, getThread, messagesFor, requestsFor, listAttentionSignals, attentionForPatient }
}

/** Instante actual (para el servicio). */
export function commNow() { return now() }
