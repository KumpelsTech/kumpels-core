import type { Priority } from '../types/patient'
import type { WorkItem, WorkTone } from '../types/work'
import { PATIENTS, getPatient } from '../data/patients'
import { REVIEW_BY_ID } from '../data/review'
import { getCare } from '../data/careFollowup'
import { getAssessment } from './careStore'
import { listViews as listFulfillmentViews, nextFulfillmentAction } from './fulfillmentStore'
import { listPreparationViews, PREP_STATUS_LABEL } from './preparationStore'
import { reviewPriority, unresolvedReviewFindings } from './review'

/**
 * Derivación de WorkItems desde los dominios existentes. No duplica datos ni
 * reglas: lee Revisión Clínica, Atención Farmacéutica, Cumplimiento y Preparación
 * a través de sus selectores canónicos. Se llama desde componentes suscritos a
 * esos stores (re-render reactivo).
 */

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
      dueLabel: p?.due, nextAction: 'Revisar', actionKey: 'revisar', source: 'Revisión Clínica',
      href: `/patients/${patientId}?tab=revision`,
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
      nextAction: care.mode === 'entrevista-inicial' ? 'Completar entrevista' : 'Realizar seguimiento',
      actionKey: 'seguimiento', source: 'Atención Farmacéutica', href: `/patients/${p.id}?tab=seguimiento`,
    })
  }
  return out
}

function pendingItems(): WorkItem[] {
  return listFulfillmentViews().filter((v) => v.isPending).map((v) => {
    const tone: WorkTone = v.continuity.risk === 'retrasado' ? 'crit' : v.continuity.risk === 'en-riesgo' ? 'warn' : 'info'
    return {
      id: `wi-pend-${v.order.id}`, type: 'pendiente', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: v.continuity.risk === 'retrasado' ? 'HIGH' : v.continuity.risk === 'en-riesgo' ? 'ACTION' : 'MONITOR',
      statusLabel: `${v.remaining} pendiente · ${v.order.medication}`, tone, roles: ['coordinador'],
      dueLabel: v.expectedAvailability,
      nextAction: nextFulfillmentAction(v),
      actionKey: 'ver-caso', source: 'Cumplimiento', href: `/medication-operations?case=${v.order.id}`,
    }
  })
}

function preparationItems(): WorkItem[] {
  return listPreparationViews().map((v) => {
    const s = v.status
    const tone: WorkTone = s === 'bloqueada' || s === 'pendiente-validacion' ? 'crit'
      : s === 'pendiente-verificacion' ? 'warn' : s === 'liberada' ? 'ok' : 'info'
    const roles = s === 'bloqueada' || s === 'pendiente-validacion' ? (['qf-mezclas', 'coordinador'] as const) : (['qf-mezclas'] as const)
    const actionKey = s === 'lista' || s === 'en-preparacion' ? 'preparar' as const
      : s === 'pendiente-verificacion' ? 'verificar' as const
        : s === 'verificada' ? 'liberar' as const : 'ver-caso' as const
    return {
      id: `wi-prep-${v.order.id}`, type: 'preparacion', patientId: v.order.patientId, patientName: v.order.patientName,
      priority: tone === 'crit' ? 'ACTION' : 'none', statusLabel: PREP_STATUS_LABEL[s], tone, roles: [...roles],
      dueLabel: v.order.scheduledAt, nextAction: v.nextAction, actionKey, source: 'Preparación estéril',
      href: `/medication-operations?ws=preparacion&prep=${v.order.id}`,
    }
  })
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
      dueLabel: v.order.scheduledAt,
      nextAction: ready ? 'Registrar administración' : 'Ver estado',
      actionKey: ready ? 'registrar-administracion' : 'ver-caso', source: 'Administración',
      href: ready ? `/patients/${v.order.patientId}` : `/medication-operations?ws=preparacion&prep=${v.order.id}`,
    }
  })
}

/** Todos los WorkItems derivados (cada uno declara para qué personas es relevante). */
export function buildWorkItems(): WorkItem[] {
  return [
    ...reviewItems(), ...followUpItems(), ...pendingItems(), ...preparationItems(), ...administrationItems(),
  ]
}
