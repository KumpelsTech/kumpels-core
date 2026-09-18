import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PlanDay, NursingPlanItem } from '../utils/nursingPlanning'
import { nursingPlanItems } from '../utils/nursingPlanning'
import { usePreparationStore } from '../utils/preparationStore'
import { useProductionStore } from '../utils/productionStore'
import { usePersona } from '../utils/personaStore'
import { hasCapability } from '../utils/eligibility'
import { MIXING_SCOPE } from '../data/admin'
import { PRODUCTION_STATUS_LABEL } from '../types/production'
import { services } from '../services'
import { Segmented } from './Segmented'
import { Icon } from './Icon'

/**
 * Planeación de ENFERMERÍA — "Pacientes próximos" (TASK 20.1 §2). Enfermería es la
 * compuerta operativa: confirma el tratamiento y lo ENVÍA a Central de Mezclas
 * (no prescribe). Reutiliza el readiness de preparación (no duplica Medication
 * Intelligence). Enviar/cancelar exigen capacidad; se registra evento + auditoría.
 */

/** Modal ligero para capturar el motivo de cancelación (obligatorio). */
function CancelModal({ item, onConfirm, onClose }: { item: NursingPlanItem; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const can = reason.trim().length > 0
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Cancelar envío a producción" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="alert" size={16} /></span>
          <div>
            <div className="mh-title">Cancelar envío a producción</div>
            <div className="mh-sub">{item.prep.order.patientName} · {item.prep.order.medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="alert" size={13} /> No se elimina la solicitud: queda <b>cancelada</b> con su historia. Si la producción ya inició, gestiónela desde Central de Mezclas.</div>
          <div className="fu-field">
            <label>Motivo de cancelación <span className="fu-hint">· obligatorio</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Cita reprogramada por el paciente" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Cancelación trazable · actor + fecha/hora exactas.</span>
          <button type="button" className="btn sm" onClick={onClose}>Volver</button>
          <button type="button" className="btn primary sm" disabled={!can} onClick={() => can && onConfirm(reason.trim())} style={!can ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Confirmar cancelación</button>
        </div>
      </div>
    </div>
  )
}

/** Estado de producción legible por item (compuerta hacia Central de Mezclas). */
function prodStatusOf(it: NursingPlanItem): { label: string; tone: 'crit' | 'warn' | 'info' | 'ok' } {
  if (it.cancelled) return { label: 'Envío cancelado', tone: 'crit' }
  if (it.accepted) return { label: 'Aceptada por Central de Mezclas', tone: 'ok' }
  if (it.sent) return { label: 'Enviada a producción', tone: 'info' }
  if (it.readyToSend) return { label: 'Pendiente de envío a producción', tone: 'warn' }
  return { label: 'Aún no lista para envío', tone: 'warn' }
}

function PlanRow({ it, canSend, canCancel, onSend, onCancel, onReview }: {
  it: NursingPlanItem
  canSend: boolean
  canCancel: boolean
  onSend: () => void
  onCancel: () => void
  onReview: () => void
}) {
  const { order } = it.prep
  const ps = prodStatusOf(it)
  const time = order.scheduledAt.replace(/^Hoy\s*/i, '').replace(/^Mañana\s*/i, '')
  return (
    <div className={`prepq-row ${it.sent ? 'on' : ''}`}>
      <div className="prepq-time">
        <span className="pt-h">{time}</span>
        <span className="pt-l">{it.day === 'hoy' ? 'Hoy' : 'Mañana'}</span>
      </div>
      <div className="prepq-main">
        <div className="prepq-top">
          <span className="prepq-name">{order.patientName}</span>
          {order.protocol ? <span className="pq-id">{order.protocol}{order.cycleDay ? ` · ${order.cycleDay}` : ''}</span> : null}
          <span className={`np-chip ${ps.tone}`}>{ps.label}</span>
        </div>
        <div className="prepq-sub">{order.medication} · {order.approvedDose ?? order.prescribedDose}{order.route ? ` · ${order.route}` : ''}</div>
        {it.readyToSend && !it.blockingReasons.length ? (
          <div className="np-ready"><Icon name="check" size={12} /> Requisitos listos — puede enviarse a producción</div>
        ) : null}
        {it.blockingReasons.length ? (
          <div className="np-blocks">
            {it.blockingReasons.map((r) => (
              <span className="np-block" key={r}><Icon name="alert" size={11} /> {r}</span>
            ))}
          </div>
        ) : null}
        {it.cancelled && it.request?.cancelReason ? (
          <div className="prepq-blk"><Icon name="alert" size={12} /> Cancelada: {it.request.cancelReason} · {it.request.cancelledAt}</div>
        ) : null}
        {it.sent && it.request?.requestedAt ? (
          <div className="np-sent"><Icon name="clock" size={12} /> Enviada por {it.request.requestedByName} · {it.request.requestedAt} · {it.request ? PRODUCTION_STATUS_LABEL[it.request.status] : ''}</div>
        ) : null}
      </div>
      <div className="prepq-next">
        <span className="lbl">Siguiente</span>
        <span className={`val ${it.readyToSend ? 'attn' : ''}`}>
          {it.sent ? 'En Central de Mezclas' : it.readyToSend ? 'Enviar a producción' : 'Resolver requisitos'}
        </span>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button type="button" className="btn sm" onClick={onReview}>Revisar</button>
          {!it.sent ? (
            <button type="button" className="btn sm primary" disabled={!it.readyToSend || !canSend} onClick={onSend}
              style={!it.readyToSend || !canSend ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              title={!canSend ? 'Sin capacidad para enviar a producción' : !it.readyToSend ? 'Requisitos pendientes' : undefined}>
              <Icon name="box" size={12} /> Enviar a producción
            </button>
          ) : !it.accepted && canCancel ? (
            <button type="button" className="btn sm" onClick={onCancel}>Cancelar envío</button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Vista de planeación de Enfermería — se monta en "Hoy" del rol enfermería. */
export function NursingPlanning() {
  usePreparationStore(); useProductionStore()
  const { user, actor } = usePersona()
  const navigate = useNavigate()
  const [day, setDay] = useState<PlanDay>('hoy')
  const [cancelItem, setCancelItem] = useState<NursingPlanItem | null>(null)

  const canSend = !!user && hasCapability(user, 'PRODUCTION_REQUEST_SEND')
  const canCancel = !!user && hasCapability(user, 'PRODUCTION_REQUEST_CANCEL')

  const all = nursingPlanItems()
  const hoyCount = all.filter((i) => i.day === 'hoy').length
  const mananaCount = all.filter((i) => i.day === 'manana').length
  const items = all
    .filter((i) => i.day === day)
    .sort((a, b) => a.prep.order.scheduledMinutes - b.prep.order.scheduledMinutes)

  const send = (it: NursingPlanItem) => {
    const o = it.prep.order
    void services.production.send({
      patientId: o.patientId, episodeId: o.episodeId, medicationOrderId: o.medicationOrderId,
      preparationOrderId: o.id, scheduledTreatmentAt: o.scheduledAt,
      facility: MIXING_SCOPE.facilityId, program: MIXING_SCOPE.programId,
      note: `Confirmado por Enfermería · ${o.protocol ?? o.medication}`,
    }, actor())
  }
  const cancel = (it: NursingPlanItem, reason: string) => {
    void services.production.cancel(it.prep.order.id, it.prep.order.patientId, reason, actor())
    setCancelItem(null)
  }

  return (
    <div className="card hoy-group">
      <div className="section-head">
        <div className="section-title">Pacientes próximos <span className="st-sub">Confirmar y enviar a Central de Mezclas</span></div>
        <Segmented<PlanDay>
          ariaLabel="Día de planeación" size="sm" value={day} onChange={setDay}
          options={[{ value: 'hoy', label: `Hoy · ${hoyCount}` }, { value: 'manana', label: `Mañana · ${mananaCount}` }]}
        />
      </div>
      {items.length === 0 ? (
        <div className="calm"><span className="c-ico"><Icon name="check" size={15} /></span> Sin tratamientos {day === 'hoy' ? 'para hoy' : 'para mañana'}.</div>
      ) : (
        <div className="prepq">
          {items.map((it) => (
            <PlanRow key={it.prep.order.id} it={it} canSend={canSend} canCancel={canCancel}
              onSend={() => send(it)} onCancel={() => setCancelItem(it)}
              onReview={() => navigate(`/medication-operations?ws=preparacion&prep=${it.prep.order.id}`)} />
          ))}
        </div>
      )}
      {cancelItem ? <CancelModal item={cancelItem} onConfirm={(r) => cancel(cancelItem, r)} onClose={() => setCancelItem(null)} /> : null}
    </div>
  )
}
