import type { Priority } from '../types/patient'
import type { WorkItem, WorkOwner, WorkTone } from '../types/work'
import type { Capability } from '../config/capabilities'
import type { DemoPersona } from '../config/workspaces'
import { MIXING_SCOPE } from '../data/admin'
import { PATIENTS, getPatient } from '../data/patients'
import { REVIEW_BY_ID } from '../data/review'
import { getCare } from '../data/careFollowup'
import { getAssessment } from './careStore'
import { listViews as listFulfillmentViews, nextFulfillmentAction } from './fulfillmentStore'
import { listPreparationViews, listRejections, PREP_STATUS_LABEL } from './preparationStore'
import { listProductionRequests } from './productionStore'
import { reviewPriority, unresolvedReviewFindings } from './review'
import { listOrderChanges } from './orderChangeStore'
import { impactFor } from './downstreamImpact'
import { ORDER_CHANGE_LABEL } from '../types/orderChange'
import { listAttentionSignals } from './communicationStore'

/**
 * Derivación de WorkItems desde los dominios existentes. No duplica datos ni
 * reglas: lee Revisión Clínica, Atención Farmacéutica, Cumplimiento y Preparación
 * a través de sus selectores canónicos. Se llama desde componentes suscritos a
 * esos stores (re-render reactivo).
 *
 * Handoffs (TASK 18 §3, §19): cada item declara su propietario (rol/equipo). Los
 * bloqueos se enrutan al rol RESPONSABLE (clínico, acceso o mezclas), no siempre
 * a Central de Mezclas; Mezclas ve un item "en espera" que no debe resolver.
 */

/** Capacidad primaria por rol propietario (para elegibilidad de handoffs). */
const CAP_FOR_ROLE: Record<DemoPersona, Capability | undefined> = {
  coordinador: undefined, 'qf-clinico': 'CLINICAL_REVIEW', farmacia: 'MEDICATION_FULFILLMENT',
  'qf-mezclas': 'STERILE_PREPARATION', enfermeria: 'MEDICATION_ADMINISTRATION', admin: undefined,
}

/** Mapea el responsable textual de un bloqueo al rol propietario del handoff. */
function blockerOwner(responsible: string | undefined): WorkOwner {
  const r = responsible ?? ''
  if (/acceso|autoriz/i.test(r)) return { role: 'farmacia', team: r || 'Gestión de acceso', label: r || 'Gestión de acceso' }
  if (/mezclas/i.test(r)) return { role: 'qf-mezclas', team: 'Central de Mezclas', label: 'Central de Mezclas' }
  if (/oncolog|cl[ií]nic/i.test(r)) return { role: 'qf-clinico', team: r, label: r }
  return { role: 'coordinador', team: r || undefined, label: r || 'Coordinación' }
}

function reviewItems(): WorkItem[] {
  const out: WorkItem[] = []
  for (const patientId of Object.keys(REVIEW_BY_ID)) {
    const unresolved = unresolvedReviewFindings(patientId)
    if (!unresolved.length) continue
    const p = getPatient(patientId)
    const priority = reviewPriority(patientId)
    out.push({
      id: `wi-rev-${patientId}`, type: 'revision', patientId, patientName: p?.name ?? patientId,
      priority, statusLabel: `${unresolved.length} hallazgo${unresolved.length > 1 ? 's' : ''} para revisión`,
      tone: priority === 'HIGH' ? 'crit' : 'warn', roles: ['qf-clinico', 'coordinador'],
      owner: { role: 'qf-clinico', team: 'Farmacia Clínica', label: 'Farmacia Clínica' },
      dueLabel: p?.due, nextAction: 'Revisar', actionKey: 'revisar', source: 'Revisión Clínica',
      requiredCapability: 'CLINICAL_REVIEW',
      href: `/patients/${patientId}?tab=revision`,
      signals: { unresolvedFinding: true },
    })
  }
  return out
}

function followUpItems(): WorkItem[] {
  const out: WorkItem[] = []
  for (const p of PATIENTS) {
    const care = getCare(p.id)
    if (!care || !care.required || care.status === 'completado' || getAssessment(p.id)) continue
    const tone: WorkTone = care.status === 'vencido' ? 'crit' : 'warn'
    const priority: Priority = care.status === 'vencido' ? 'HIGH' : 'ACTION'
    out.push({
      id: `wi-seg-${p.id}`, type: 'seguimiento', patientId: p.id, patientName: p.name,
      priority, statusLabel: care.statusLabel, tone, roles: ['qf-clinico', 'coordinador'],
      owner: { role: 'qf-clinico', team: care.responsible, label: care.responsible },
      nextAction: care.mode === 'entrevista-inicial' ? 'Completar entrevista' : 'Realizar seguimiento',
      actionKey: 'seguimiento', requiredCapability: 'PHARMACEUTICAL_FOLLOWUP',
      source: 'Atención Farmacéutica', href: `/patients/${p.id}?tab=seguimiento`,
    })
  }
  return out
}

function pendingItems(): WorkItem[] {
  return listFulfillmentViews().filter((v) => v.isPending).map((v) => {
    const risk = v.continuity.risk
    const tone: WorkTone = risk === 'retrasado' ? 'crit' : risk === 'en-riesgo' ? 'warn' : 'info'
    return {
      id: `wi-pend-${v.order.id}`, type: 'pendiente', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: risk === 'retrasado' ? 'HIGH' : risk === 'en-riesgo' ? 'ACTION' : 'MONITOR',
      statusLabel: `${v.remaining} pendiente · ${v.order.medication}`, tone,
      // Ejecución operativa: Farmacia / Dispensación; Coordinación solo supervisa.
      roles: ['farmacia', 'coordinador'],
      owner: { role: 'farmacia', team: v.responsible, label: v.responsible },
      dueLabel: v.expectedAvailability,
      blockerReason: v.blocked ? 'Dispensación bloqueada — esperando autorización' : undefined,
      nextAction: nextFulfillmentAction(v), actionKey: 'ver-caso', source: 'Cumplimiento',
      requiredCapability: 'MEDICATION_FULFILLMENT',
      href: `/medication-operations?case=${v.order.id}`,
      signals: { continuityRisk: risk, daysPending: v.daysPending, pendingContact: v.communication === 'pendiente', blocked: v.blocked },
    }
  })
}

function preparationItems(): WorkItem[] {
  const out: WorkItem[] = []
  for (const v of listPreparationViews()) {
    // Gate de Central de Mezclas: lista pero aún NO enviada por Enfermería.
    // No es trabajo de Mezclas todavía → lo maneja sendItems() (Enfermería).
    if (v.productionGate) continue
    const s = v.status
    const blocked = s === 'bloqueada' || s === 'pendiente-validacion'
    if (blocked && v.blocker) {
      // La revisión clínica sin resolver es responsabilidad de Farmacia Clínica.
      const owner = s === 'pendiente-validacion' ? blockerOwner('Farmacia clínica') : blockerOwner(v.blocker.responsible)
      const href = owner.role === 'qf-clinico' && s === 'pendiente-validacion'
        ? `/patients/${v.order.patientId}?tab=revision`
        : `/medication-operations?ws=preparacion&prep=${v.order.id}`
      if (owner.role === 'qf-mezclas') {
        // Bloqueo de preparación propiamente dicho: Central de Mezclas lo resuelve.
        out.push({
          id: `wi-prep-${v.order.id}`, type: 'preparacion', patientId: v.order.patientId, patientName: v.order.patientName,
          priority: 'ACTION', statusLabel: v.blocker.label, tone: 'crit', roles: ['qf-mezclas', 'coordinador'],
          owner, dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes, blockerReason: v.blocker.label,
          nextAction: v.blocker.nextAction ?? 'Resolver bloqueo', actionKey: 'ver-caso', source: 'Preparación estéril',
          requiredCapability: 'STERILE_PREPARATION', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId,
          href: `/medication-operations?ws=preparacion&prep=${v.order.id}`,
          signals: { blocked: true, scheduledMinutes: v.order.scheduledMinutes },
        })
      } else {
        // Handoff: la resolución la posee el rol responsable (clínico o acceso).
        out.push({
          id: `wi-blk-${v.order.id}`, type: 'bloqueo', patientId: v.order.patientId, patientName: v.order.patientName,
          priority: 'ACTION', statusLabel: v.blocker.label, tone: 'crit',
          roles: [owner.role, 'coordinador'], owner,
          dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes, blockerReason: v.blocker.label,
          nextAction: v.blocker.nextAction ?? 'Resolver bloqueo', actionKey: 'ver-caso',
          requiredCapability: CAP_FOR_ROLE[owner.role],
          source: owner.role === 'qf-clinico' ? (s === 'pendiente-validacion' ? 'Revisión Clínica' : 'Datos clínicos') : owner.label,
          href, signals: { blocked: true, scheduledMinutes: v.order.scheduledMinutes },
        })
        // Central de Mezclas: item "en espera" — no resuelve trabajo de otro equipo.
        out.push({
          id: `wi-prep-${v.order.id}`, type: 'preparacion', patientId: v.order.patientId, patientName: v.order.patientName,
          priority: 'none', statusLabel: `Bloqueada — esperando: ${v.blocker.label}`, tone: 'warn', roles: ['qf-mezclas'],
          owner: { role: 'qf-mezclas', label: 'Central de Mezclas' },
          dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes, blockerReason: v.blocker.label,
          nextAction: 'Seguir bloqueo', actionKey: 'ver-caso', source: 'Preparación estéril',
          requiredCapability: 'STERILE_PREPARATION', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId,
          href: `/medication-operations?ws=preparacion&prep=${v.order.id}`,
          signals: { blocked: true, scheduledMinutes: v.order.scheduledMinutes },
        })
      }
      continue
    }
    // No bloqueada: item de preparación propiedad de Central de Mezclas.
    const tone: WorkTone = s === 'pendiente-verificacion' ? 'warn' : s === 'liberada' ? 'ok' : 'info'
    const actionKey = s === 'lista' || s === 'en-preparacion' ? 'preparar' as const
      : s === 'pendiente-verificacion' ? 'verificar' as const
        : s === 'verificada' ? 'liberar' as const : 'ver-caso' as const
    const cap: Capability = s === 'pendiente-verificacion' ? 'STERILE_PREPARATION_VERIFY'
      : s === 'verificada' ? 'STERILE_PREPARATION_RELEASE' : 'STERILE_PREPARATION'
    out.push({
      id: `wi-prep-${v.order.id}`, type: 'preparacion', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: 'none', statusLabel: PREP_STATUS_LABEL[s], tone, roles: ['qf-mezclas'],
      owner: { role: 'qf-mezclas', label: 'Central de Mezclas' },
      dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes,
      nextAction: v.nextAction, actionKey, source: 'Preparación estéril',
      requiredCapability: cap, facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId,
      href: `/medication-operations?ws=preparacion&prep=${v.order.id}`,
      signals: { scheduledMinutes: v.order.scheduledMinutes },
    })
  }
  return out
}

function administrationItems(): WorkItem[] {
  return listPreparationViews().map((v) => {
    const s = v.status
    const ready = s === 'liberada'
    const blocked = s === 'bloqueada' || s === 'pendiente-validacion'
    const tone: WorkTone = ready ? 'ok' : blocked ? 'warn' : 'info'
    const statusLabel = ready ? 'Listo para administrar' : blocked ? 'Preparación bloqueada' : 'Preparación en curso'
    return {
      id: `wi-adm-${v.order.id}`, type: 'administracion', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: 'none', statusLabel: `${statusLabel} · ${v.order.medication}`, tone, roles: ['enfermeria'],
      owner: { role: 'enfermeria', label: 'Enfermería' },
      dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes,
      nextAction: ready ? 'Registrar administración' : 'Ver estado',
      actionKey: ready ? 'registrar-administracion' : 'ver-caso', source: 'Administración',
      requiredCapability: 'MEDICATION_ADMINISTRATION',
      href: ready ? `/patients/${v.order.patientId}` : `/medication-operations?ws=preparacion&prep=${v.order.id}`,
      signals: { scheduledMinutes: v.order.scheduledMinutes },
    }
  })
}

/** WorkItems por impacto de cambio de orden (deterministas, enrutados por rol). */
function orderChangeItems(): WorkItem[] {
  const out: WorkItem[] = []
  for (const ch of listOrderChanges()) {
    const imp = impactFor(ch.orderId)
    if (!imp) continue
    const prep = listPreparationViews().find((v) => v.order.medicationOrderId === ch.orderId)
    imp.impacts.filter((i) => !i.historical).forEach((i, idx) => {
      const mixing = i.responsibleRole === 'qf-mezclas'
      out.push({
        id: `wi-ordimp-${ch.orderId}-${idx}`, type: 'bloqueo',
        patientId: prep?.order.patientId, patientName: prep?.order.patientName ?? ch.orderId,
        priority: i.tone === 'crit' ? 'HIGH' : 'ACTION',
        statusLabel: `Afectado por cambio de tratamiento · ${i.statusLabel}`, tone: i.tone,
        roles: [i.responsibleRole, 'coordinador'], owner: { role: i.responsibleRole, label: i.ownerLabel },
        blockerReason: `Orden ${ORDER_CHANGE_LABEL[ch.changeType]} — ${ch.reason}`,
        nextAction: i.requiredAction, actionKey: 'ver-caso', requiredCapability: CAP_FOR_ROLE[i.responsibleRole],
        facilityId: mixing ? MIXING_SCOPE.facilityId : undefined, programId: mixing ? MIXING_SCOPE.programId : undefined,
        source: 'Cambio de tratamiento',
        href: prep ? `/medication-operations?ws=preparacion&prep=${prep.order.id}` : `/medication-operations?case=${ch.orderId}`,
        signals: { blocked: true },
      })
    })
  }
  return out
}

/** WorkItems de resolución por rechazo de Enfermería (enrutados por motivo). */
function rejectionItems(): WorkItem[] {
  return listRejections().map((r) => {
    const role = r.ownerRole as DemoPersona
    const mixing = role === 'qf-mezclas'
    const p = getPatient(r.patientId)
    return {
      id: `wi-reject-${r.orderId}`, type: 'bloqueo', patientId: r.patientId, patientName: p?.name ?? r.patientId,
      priority: 'HIGH', statusLabel: `Preparación rechazada por Enfermería · ${r.reasonLabel}`, tone: 'crit',
      roles: [role, 'coordinador'], owner: { role, label: r.ownerLabel },
      blockerReason: `Rechazo de Enfermería — ${r.reasonLabel}${r.comment ? ` (${r.comment})` : ''}`,
      nextAction: 'Resolver preparación rechazada', actionKey: 'ver-caso', requiredCapability: CAP_FOR_ROLE[role],
      facilityId: mixing ? MIXING_SCOPE.facilityId : undefined, programId: mixing ? MIXING_SCOPE.programId : undefined,
      source: 'Rechazo de Enfermería',
      href: `/medication-operations?ws=preparacion&prep=${r.orderId}`,
      signals: { blocked: true },
    }
  })
}

/**
 * WorkItems de ENVÍO A PRODUCCIÓN (handoff Enfermería → Central de Mezclas,
 * TASK 20.1 §6/§7/§12/§13). Dos estados visibles y deterministas:
 *  - Listo pero aún NO enviado: propiedad de Enfermería (capacidad de envío).
 *  - Enviado y aún NO aceptado por Mezclas: señal de demora para Coordinación.
 * No duplica la orden: referencia la preparación por id. Reutiliza el readiness.
 */
function sendItems(): WorkItem[] {
  const out: WorkItem[] = []
  const nowMs = Date.now()
  // (a) Listo para enviar — Enfermería es la responsable (gate abierto).
  for (const v of listPreparationViews()) {
    if (!v.productionGate) continue
    out.push({
      id: `wi-send-${v.order.id}`, type: 'administracion', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: 'ACTION', statusLabel: `Pendiente de envío a producción · ${v.order.medication}`, tone: 'warn',
      roles: ['enfermeria', 'coordinador'],
      owner: { role: 'enfermeria', team: 'Enfermería', label: 'Enfermería' },
      dueLabel: v.order.scheduledAt, dueMinutes: v.order.scheduledMinutes,
      nextAction: 'Enviar a producción', actionKey: 'enviar-produccion', source: 'Planeación de Enfermería',
      requiredCapability: 'PRODUCTION_REQUEST_SEND', refId: v.order.id,
      href: `/medication-operations?ws=preparacion&prep=${v.order.id}`,
      signals: { readyNotSent: true, scheduledMinutes: v.order.scheduledMinutes },
    })
  }
  // (b) Enviado y aún sin aceptar por Mezclas — señal de demora para Coordinación.
  for (const r of listProductionRequests()) {
    if (r.status !== 'SENT_TO_PRODUCTION') continue
    const prep = listPreparationViews().find((v) => v.order.id === r.preparationOrderId)
    const sentAgo = r.requestedAtIso ? Math.max(0, Math.round((nowMs - Date.parse(r.requestedAtIso)) / 60000)) : undefined
    out.push({
      id: `wi-sent-${r.preparationOrderId}`, type: 'preparacion', patientId: r.patientId,
      patientName: prep?.order.patientName ?? r.patientId,
      priority: 'MONITOR', statusLabel: 'Enviada a producción — esperando aceptación de Central de Mezclas', tone: 'info',
      roles: ['qf-mezclas', 'coordinador'],
      owner: { role: 'qf-mezclas', team: 'Central de Mezclas', label: 'Central de Mezclas' },
      dueLabel: prep?.order.scheduledAt, dueMinutes: prep?.order.scheduledMinutes,
      requiredCapability: 'PRODUCTION_REQUEST_ACCEPT', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId,
      nextAction: 'Aceptar solicitud', actionKey: 'aceptar-solicitud', source: 'Planeación de Enfermería', refId: r.preparationOrderId,
      href: `/medication-operations?ws=preparacion&prep=${r.preparationOrderId}`,
      signals: { sentNotAccepted: true, sentAgoMinutes: sentAgo, scheduledMinutes: prep?.order.scheduledMinutes },
    })
  }
  return out
}

/**
 * WorkItems de REVISIÓN de respuestas del paciente (TASK 20.5). Derivados de las
 * señales de atención de comunicaciones (adherencia/síntoma/dolor/interrupción). No
 * son un diagnóstico: enrutan una REVISIÓN profesional. Propietario QF Clínico
 * (capacidad PATIENT_FOLLOWUP_REVIEW), elegibilidad, sin QF fijo.
 */
function communicationItems(): WorkItem[] {
  return listAttentionSignals().map((s) => {
    const p = getPatient(s.patientId)
    return {
      id: `wi-comm-${s.id}`, type: 'seguimiento', patientId: s.patientId, patientName: p?.name ?? s.patientId,
      priority: s.severity === 'HIGH' ? 'HIGH' : 'ACTION',
      statusLabel: `${s.label} · ${s.sourceLabel}`, tone: s.severity === 'HIGH' ? 'crit' : 'warn',
      roles: ['qf-clinico', 'coordinador'],
      owner: { role: 'qf-clinico', team: 'Farmacia Clínica', label: 'Farmacia Clínica' },
      nextAction: s.label, actionKey: 'ver-caso', requiredCapability: 'PATIENT_FOLLOWUP_REVIEW',
      source: 'Comunicaciones', refId: s.id,
      href: `/communications?patient=${s.patientId}`,
      signals: { unresolvedFinding: true },
    }
  })
}

/** Todos los WorkItems derivados (cada uno declara para qué personas es relevante). */
export function buildWorkItems(): WorkItem[] {
  return [
    ...reviewItems(), ...followUpItems(), ...pendingItems(), ...preparationItems(), ...administrationItems(),
    ...orderChangeItems(), ...rejectionItems(), ...sendItems(), ...communicationItems(),
  ]
}
