import type { DomainEventRecord, DomainEventType } from '../types/domainEvent'
import type { IconName } from '../components/Icon'

/**
 * Capa de PROYECCIÓN: DomainEvent (técnico, nativo) → ítem de actividad para el
 * usuario (español, ícono, énfasis). Mantiene las etiquetas de UI FUERA del
 * modelo de dominio. No expone id, enum, sourceEntityType ni metadata cruda.
 */
export type ActivityTone = 'ok' | 'warn' | 'info' | 'plain'

export interface ActivityItem {
  id: string
  when: string
  title: string
  summary?: string
  actor?: string
  icon: IconName
  tone: ActivityTone
}

const MAP: Record<DomainEventType, { title: string; icon: IconName; tone: ActivityTone }> = {
  CLINICAL_REVIEW_CREATED: { title: 'Prevalidación clínica ejecutada', icon: 'stethoscope', tone: 'info' },
  CLINICAL_REVIEW_COMPLETED: { title: 'Revisión clínica completada', icon: 'stethoscope', tone: 'ok' },
  FINDING_CONFIRMED: { title: 'Hallazgo confirmado', icon: 'alert', tone: 'warn' },
  FINDING_DISMISSED: { title: 'Hallazgo descartado', icon: 'check', tone: 'ok' },
  PHARMACEUTICAL_CARE_ENROLLED: { title: 'Inscripción en atención farmacéutica', icon: 'refresh', tone: 'info' },
  INITIAL_ASSESSMENT_COMPLETED: { title: 'Entrevista inicial completada', icon: 'refresh', tone: 'ok' },
  FOLLOWUP_COMPLETED: { title: 'Seguimiento farmacoterapéutico realizado', icon: 'refresh', tone: 'ok' },
  MEDICATION_ORDER_CREATED: { title: 'Prescripción recibida', icon: 'doc', tone: 'info' },
  MEDICATION_ORDER_CHANGED: { title: 'Orden de medicación modificada', icon: 'refresh', tone: 'warn' },
  DISPENSE_PARTIAL: { title: 'Dispensación parcial registrada', icon: 'box', tone: 'warn' },
  DISPENSE_COMPLETED: { title: 'Dispensación completada', icon: 'box', tone: 'ok' },
  MEDICATION_PENDING_CREATED: { title: 'Pendiente de medicamento creado', icon: 'box', tone: 'warn' },
  MEDICATION_AVAILABILITY_UPDATED: { title: 'Disponibilidad actualizada', icon: 'calendar', tone: 'info' },
  PATIENT_CONTACTED: { title: 'Paciente contactado', icon: 'phone', tone: 'info' },
  MEDICATION_PENDING_RESOLVED: { title: 'Pendiente de medicamento resuelto', icon: 'check', tone: 'ok' },
  PREPARATION_ORDER_CREATED: { title: 'Orden de preparación creada', icon: 'drop', tone: 'info' },
  PREPARATION_STARTED: { title: 'Preparación iniciada', icon: 'drop', tone: 'info' },
  PREPARATION_COMPLETED: { title: 'Preparación finalizada', icon: 'drop', tone: 'warn' },
  PREPARATION_VERIFIED: { title: 'Preparación verificada', icon: 'shield', tone: 'ok' },
  PREPARATION_RELEASED: { title: 'Preparación liberada', icon: 'check', tone: 'ok' },
  PREPARATION_REPLACED: { title: 'Preparación reemplazada', icon: 'refresh', tone: 'warn' },
  PREPARATION_REJECTED_BY_NURSING: { title: 'Preparación rechazada por Enfermería', icon: 'alert', tone: 'warn' },
  PRODUCTION_REQUEST_SENT: { title: 'Tratamiento enviado a Central de Mezclas', icon: 'drop', tone: 'info' },
  PRODUCTION_REQUEST_ACCEPTED: { title: 'Solicitud aceptada por Central de Mezclas', icon: 'check', tone: 'ok' },
  PRODUCTION_REQUEST_CANCELLED: { title: 'Solicitud de producción cancelada', icon: 'alert', tone: 'warn' },
  LOT_SELECTED: { title: 'Lote asignado', icon: 'box', tone: 'info' },
  LOT_ADDED: { title: 'Lote añadido a la mezcla', icon: 'box', tone: 'info' },
  LOT_REMOVED: { title: 'Lote retirado de la mezcla', icon: 'box', tone: 'warn' },
  COMPONENT_USAGE_RECORDED: { title: 'Uso de componente registrado', icon: 'box', tone: 'info' },
  PREPARATION_BATCH_CONFIRMED: { title: 'Lote de mezcla final confirmado', icon: 'shield', tone: 'info' },
  PATIENT_ADHERENCE_CONCERN_REPORTED: { title: 'Paciente reportó dificultad con la adherencia vía WhatsApp', icon: 'msg', tone: 'warn' },
  PATIENT_SYMPTOM_REPORTED: { title: 'Paciente reportó un síntoma vía WhatsApp', icon: 'msg', tone: 'warn' },
  PATIENT_PAIN_REPORTED: { title: 'Paciente reportó nivel de dolor vía WhatsApp', icon: 'msg', tone: 'warn' },
  PATIENT_TREATMENT_INTERRUPTION_REPORTED: { title: 'Paciente reportó posible interrupción del tratamiento vía WhatsApp', icon: 'alert', tone: 'warn' },
  FOLLOWUP_RESPONSE_REQUIRES_REVIEW: { title: 'Respuesta del paciente requiere revisión profesional', icon: 'stethoscope', tone: 'warn' },
  MEDICATION_ADMINISTERED: { title: 'Medicamento administrado', icon: 'syringe', tone: 'ok' },
  MEDICATION_ADMINISTRATION_INCOMPLETE: { title: 'Administración no completada', icon: 'syringe', tone: 'warn' },
  MEDICATION_ADMINISTRATION_CORRECTED: { title: 'Administración corregida', icon: 'refresh', tone: 'warn' },
  WORKITEM_CREATED: { title: 'Tarea creada', icon: 'check', tone: 'info' },
  WORKITEM_COMPLETED: { title: 'Tarea completada', icon: 'check', tone: 'ok' },
  WORKITEM_ASSIGNED: { title: 'Trabajo asignado', icon: 'users', tone: 'info' },
  WORKITEM_ESCALATED: { title: 'Trabajo escalado', icon: 'alert', tone: 'warn' },
  WORKITEM_PRIORITIZED: { title: 'Prioridad ajustada', icon: 'alert', tone: 'info' },
  WORKITEM_ACKNOWLEDGED: { title: 'Tarea tomada', icon: 'check', tone: 'ok' },
  WORKITEM_STARTED: { title: 'Tarea en curso', icon: 'clock', tone: 'info' },
  WORKITEM_REASSIGNED: { title: 'Trabajo reasignado', icon: 'users', tone: 'warn' },
  RESPONSIBILITY_TRANSFERRED: { title: 'Responsabilidad transferida', icon: 'users', tone: 'warn' },
  VERIFICATION_WORK_CREATED: { title: 'Verificación requerida', icon: 'shield', tone: 'warn' },
  VERIFICATION_ASSIGNED: { title: 'Verificación asignada', icon: 'shield', tone: 'info' },
  VERIFICATION_COMPLETED: { title: 'Verificación completada', icon: 'shield', tone: 'ok' },
  USER_STATUS_CHANGED: { title: 'Estado de usuario actualizado', icon: 'users', tone: 'info' },
  USER_ROLE_ASSIGNED: { title: 'Rol asignado', icon: 'users', tone: 'info' },
  USER_TEAM_ASSIGNED: { title: 'Equipo asignado', icon: 'users', tone: 'info' },
  USER_SCOPE_ASSIGNED: { title: 'Alcance actualizado', icon: 'users', tone: 'info' },
  SUPPORT_REQUESTED: { title: 'Soporte Kumpels solicitado', icon: 'shield', tone: 'warn' },
  SUPPORT_ENDED: { title: 'Sesión de soporte finalizada', icon: 'shield', tone: 'ok' },
}

export function projectEvent(e: DomainEventRecord): ActivityItem {
  const m = MAP[e.type]
  return {
    id: e.id, when: e.occurredAt, title: m.title, summary: e.summary,
    actor: e.actorId, icon: m.icon, tone: m.tone,
  }
}

export function projectEvents(list: DomainEventRecord[]): ActivityItem[] {
  return list.map(projectEvent)
}
