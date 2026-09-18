import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ContinuityRisk, FulfillmentView } from '../types/fulfillment'
import {
  AVAILABILITY_LABEL, COMM_LABEL, CONTINUITY_LABEL, RECIPIENT_LABEL, RECEIPT_EVIDENCE_LABEL,
  nextFulfillmentAction, useFulfillmentStore,
} from '../utils/fulfillmentStore'
import { continuityRank } from '../utils/continuity'
import { usePersona } from '../utils/personaStore'
import { services } from '../services'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { ContactModal } from '../components/ops/ContactModal'
import { SchedulingModal } from '../components/ops/SchedulingModal'
import { DeliveryModal } from '../components/ops/DeliveryModal'
import { OrderChangeModal } from '../components/ops/OrderChangeModal'
import { ImpactBanner } from '../components/ops/ImpactBanner'
import { PreparacionEsterilWorkstream } from '../components/ops/PreparacionEsterilWorkstream'
import { hasCapability } from '../utils/eligibility'

type Workstream = 'cumplimiento' | 'preparacion'

const riskVariant = (r: ContinuityRisk) => (r === 'retrasado' ? 'hi' : r === 'en-riesgo' ? 'action' : 'ok')
function commBadge(v: FulfillmentView) {
  const variant = v.communication === 'coordinado' || v.communication === 'informado' ? 'ok' : v.communication === 'contactado' ? 'info' : 'action'
  return <Badge variant={variant}>{COMM_LABEL[v.communication]}</Badge>
}

function QuantityStats({ v }: { v: FulfillmentView }) {
  const pct = Math.round((v.fulfilled / v.ordered) * 100)
  return (
    <div>
      <div className="qstats">
        <div className="qstat"><span className="ql">Ordenado</span><span className="qn">{v.ordered}</span><span className="qu">{v.order.unitLabel}</span></div>
        <span className="qsep"><Icon name="arrow" size={15} /></span>
        <div className="qstat"><span className="ql">Dispensado</span><span className="qn done">{v.fulfilled}</span></div>
        <span className="qsep"><Icon name="arrow" size={15} /></span>
        <div className={`qstat ${v.remaining > 0 ? 'rem' : 'ok'}`}><span className="ql">Pendiente</span><span className="qn">{v.remaining}</span></div>
      </div>
      <div className="qbar"><div className="qbar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function CaseDetail({ v, onClose }: { v: FulfillmentView; onClose: () => void }) {
  const { actor, can, user } = usePersona()
  const a = actor()
  const [showContact, setShowContact] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDelivery, setShowDelivery] = useState(false)
  const [showOrderChange, setShowOrderChange] = useState(false)
  const [noContact, setNoContact] = useState(false)
  const [noContactReason, setNoContactReason] = useState('')
  const canChangeOrder = !!user && hasCapability(user, 'MEDICATION_ORDER_CHANGE')
  const lastContact = v.contacts[v.contacts.length - 1]
  const lastDelivery = v.deliveries[v.deliveries.length - 1]
  // Ejecución operativa solo para roles con acción (Farmacia); Coordinación supervisa.
  const canExecute = can('registrar-contacto') || can('actualizar-disponibilidad') || can('entregar') || can('resolver-pendiente')

  return (
    <div className="op-detail2">
      <div className="od2-head">
        <div>
          <div className="od2-title">{v.order.patientName} <span className="pq-id mono">{v.order.id}</span></div>
          <div className="od2-sub">{v.order.medication} · {v.order.facility}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {v.isPending ? <Badge variant="action">{v.status === 'parcial' ? 'Dispensación parcial' : 'Pendiente'}</Badge> : <Badge variant="ok">Completo</Badge>}
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
      </div>

      <div className="od2-body">
        <div className="od2-main">
          <ImpactBanner orderId={v.order.id} />
          <QuantityStats v={v} />

          {/* Continuidad — señal determinística y explicable */}
          <div className={`continuity ${v.continuity.risk}`}>
            <span className="ct-ico"><Icon name={v.continuity.risk === 'sin-riesgo' ? 'check' : 'alert'} size={14} /></span>
            <div>
              <div className="ct-title">Continuidad · {CONTINUITY_LABEL[v.continuity.risk]}</div>
              <div className="ct-explain">{v.continuity.explain}</div>
            </div>
          </div>

          {/* Coherencia de contacto (§8): no se resuelve a ciegas si falta contacto */}
          {v.isPending && !v.contactSettled ? (
            <div className="coherence-warn"><Icon name="alert" size={13} /> Contacto con el paciente pendiente — el pendiente no puede marcarse completo sin registrar entrega o resolver explícitamente sin contacto.</div>
          ) : null}

          <div className="od2-facts">
            <div className="fact"><span className="fk">Disponibilidad</span>
              <span className="fv">{AVAILABILITY_LABEL[v.availability]}{v.expectedAvailability ? ` · ${v.expectedAvailability}` : ''}</span>
              {v.availabilityUpdatedAt ? <span className="fsub">Actualizado {v.availabilityUpdatedAt}</span> : null}
            </div>
            <div className="fact"><span className="fk">Pendiente desde</span><span className="fv">{v.pendingSince} · {v.daysPending} d</span></div>
            <div className="fact"><span className="fk">Comunicación</span><span className="fv">{commBadge(v)}</span>
              {lastContact ? <span className="fsub">{lastContact.at} · {lastContact.channel} · {lastContact.result}</span> : null}
            </div>
            <div className="fact"><span className="fk">Responsable</span><span className="fv">{v.responsible}</span></div>
            {v.nextApplication ? <div className="fact"><span className="fk">Próxima aplicación</span><span className="fv">{v.nextApplication}</span></div> : null}
            {v.lot ? <div className="fact"><span className="fk">Lote</span><span className="fv mono">{v.lot}</span></div> : null}
          </div>

          {lastDelivery ? (
            <div className="delivery-note">
              <Icon name="box" size={13} /> Entregado a <b>{RECIPIENT_LABEL[lastDelivery.recipientType]}{lastDelivery.recipientName ? ` · ${lastDelivery.recipientName}` : ''}</b> · {lastDelivery.at}
              <span className="dn-ev"> · Evidencia: {RECEIPT_EVIDENCE_LABEL[lastDelivery.evidence.type]}</span>
              <span className="dn-by"> · por {lastDelivery.deliveredBy}</span>
            </div>
          ) : null}
          {v.resolvedWithoutContactReason ? (
            <div className="coherence-warn"><Icon name="shield" size={13} /> Resuelto sin contacto exitoso — {v.resolvedWithoutContactReason}</div>
          ) : null}

          {canExecute ? (
            <div className="od2-actions">
              <button type="button" className="btn sm" disabled={!v.isPending || !can('registrar-contacto')} onClick={() => setShowContact(true)}><Icon name="phone" size={13} /> Registrar contacto</button>
              <button type="button" className="btn sm" disabled={!v.isPending || !can('actualizar-disponibilidad')} onClick={() => setShowSchedule(true)}><Icon name="calendar" size={13} /> Reprogramar</button>
              <button type="button" className="btn sm primary" disabled={!v.isPending || !can('entregar')} onClick={() => setShowDelivery(true)}><Icon name="box" size={13} /> Registrar entrega</button>
              {can('resolver-pendiente') ? <button type="button" className="btn sm" disabled={!v.isPending} onClick={() => setNoContact((s) => !s)}><Icon name="check" size={13} /> Resolver sin contacto</button> : null}
            </div>
          ) : (
            <div className="subtle" style={{ marginTop: 12 }}><Icon name="users" size={12} /> Vista de supervisión — la ejecución operativa la realiza Farmacia / Dispensación.</div>
          )}

          {noContact && v.isPending ? (
            <div className="nocontact-box">
              <label>Motivo para resolver sin contacto <span className="fu-hint">· obligatorio</span></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input type="text" value={noContactReason} onChange={(e) => setNoContactReason(e.target.value)} placeholder="p. ej. Entrega institucional documentada aparte" style={{ flex: 1 }} />
                <button type="button" className="btn sm primary" disabled={!noContactReason.trim()} onClick={() => { void services.fulfillment.resolveWithoutContact(v.order.id, noContactReason.trim(), a); setNoContact(false); setNoContactReason('') }}>Confirmar</button>
              </div>
            </div>
          ) : null}

          {canChangeOrder ? (
            <div className="od2-orderchange">
              <button type="button" className="btn sm" onClick={() => setShowOrderChange(true)}><Icon name="refresh" size={13} /> Registrar cambio de orden</button>
              <span className="subtle" style={{ marginLeft: 8 }}>Evalúa el impacto aguas abajo (preparación/entrega/administración).</span>
            </div>
          ) : null}

          {!v.isPending ? <div className="calm" style={{ marginTop: 12 }}><span className="c-ico"><Icon name="check" size={15} /></span> Cumplimiento completo{lastDelivery ? ' · entrega registrada' : ''}.</div> : null}
        </div>

        <div className="od2-timeline">
          <div className="section-lead" style={{ marginTop: 0, marginBottom: 10 }}>Trazabilidad del caso</div>
          <div className="ftimeline">
            {v.events.map((e, i) => (
              <div className="fte" key={i}>
                <span className={`fte-dot ${e.state}`}>{e.state === 'done' ? <Icon name="check" size={10} /> : e.state === 'warn' ? '!' : ''}</span>
                <div className="fte-main"><div className="fte-label">{e.label}</div><div className="fte-at mono">{e.at}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showContact ? (
        <ContactModal patientName={v.order.patientName} previous={v.contacts}
          onSave={(entry) => { void services.fulfillment.registerContact(v.order.id, entry, a); setShowContact(false) }}
          onClose={() => setShowContact(false)} />
      ) : null}
      {showSchedule ? (
        <SchedulingModal patientName={v.order.patientName} currentLabel={v.expectedAvailability} history={v.scheduleHistory}
          onSave={(change) => { void services.fulfillment.reprogram(v.order.id, change, a); setShowSchedule(false) }}
          onClose={() => setShowSchedule(false)} />
      ) : null}
      {showDelivery ? (
        <DeliveryModal patientName={v.order.patientName} medicationLabel={v.order.medication} remaining={v.remaining} unitLabel={v.order.unitLabel}
          onSave={(delivery) => { void services.fulfillment.registerDelivery(v.order.id, delivery, a); setShowDelivery(false) }}
          onClose={() => setShowDelivery(false)} />
      ) : null}
      {showOrderChange ? (
        <OrderChangeModal orderId={v.order.id} medication={v.order.medication}
          onSave={(input) => { void services.orderChange.registerChange(v.order.id, input, a); setShowOrderChange(false) }}
          onClose={() => setShowOrderChange(false)} />
      ) : null}
    </div>
  )
}

/** Workstream Cumplimiento / Pendientes (disponibilidad, comunicación, continuidad). */
function CumplimientoWorkstream() {
  const store = useFulfillmentStore()
  const views = store.listViews()
  const [params] = useSearchParams()
  const initialCase = params.get('case')
  const [selected, setSelected] = useState<string | null>(initialCase && views.some((v) => v.order.id === initialCase) ? initialCase : null)

  const pendientes = views.filter((v) => v.isPending)
  const parciales = views.filter((v) => v.status === 'parcial')
  const porContactar = views.filter((v) => v.isPending && v.communication === 'pendiente')
  const enRiesgo = views.filter((v) => v.isPending && v.continuity.risk !== 'sin-riesgo')

  const queue = [...views].sort((a, b) =>
    Number(b.isPending) - Number(a.isPending)
    || continuityRank(a.continuity.risk) - continuityRank(b.continuity.risk)
    || b.daysPending - a.daysPending
    || Number(a.communication === 'pendiente' ? 0 : 1) - Number(b.communication === 'pendiente' ? 0 : 1))
  const sel = selected ? store.view(selected) : null

  const sum = (n: number, label: string, kind: string) => (
    <div className={`ops-stat ${kind}`}><span className="os-n tnum">{n}</span><span className="os-l">{label}</span></div>
  )

  return (
    <>
      <div className="ops-sum">
        {sum(pendientes.length, 'Dispensaciones pendientes', 'attn')}
        {sum(parciales.length, 'Dispensaciones parciales', 'attn')}
        {sum(porContactar.length, 'Pendientes por contactar', 'warn')}
        {sum(enRiesgo.length, 'Continuidad en riesgo', 'crit')}
      </div>

      {sel ? <CaseDetail v={sel} onClose={() => setSelected(null)} /> : null}

      <div className="card">
        <div className="section-head">
          <div className="section-title">Pendientes de medicamento <span className="st-sub">{pendientes.length} activos</span></div>
        </div>
        <div className="opq">
          {queue.map((v) => (
            <div key={v.order.id} className={`opq-row ${selected === v.order.id ? 'on' : ''}`} onClick={() => setSelected(v.order.id)}
              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(v.order.id) } }}>
              <div className="opq-main">
                <div className="opq-top">
                  <span className="opq-name">{v.order.patientName}</span>
                  <span className="pq-id mono">{v.order.id}</span>
                  {v.status === 'parcial' ? <Badge variant="action">Parcial</Badge> : !v.isPending ? <Badge variant="ok">Completo</Badge> : <Badge variant="action">Pendiente</Badge>}
                  {v.isPending && v.continuity.risk !== 'sin-riesgo' ? <Badge variant={riskVariant(v.continuity.risk)}>Continuidad {v.continuity.risk === 'retrasado' ? 'retrasada' : 'en riesgo'}</Badge> : null}
                </div>
                <div className="opq-sub">{v.order.medication} · {v.order.facility}</div>
              </div>
              <div className="opq-qty">
                <span className="oq"><b>{v.ordered}</b><i>ord.</i></span>
                <span className="oq"><b className="done">{v.fulfilled}</b><i>disp.</i></span>
                <span className="oq rem"><b>{v.remaining}</b><i>pend.</i></span>
              </div>
              <div className="opq-meta">
                <div className="opq-since">{AVAILABILITY_LABEL[v.availability]}{v.expectedAvailability ? ` · ${v.expectedAvailability}` : ''}</div>
                <div className="opq-since">Pend. {v.pendingSince} · <b className={v.daysPending >= 5 ? 'late' : ''}>{v.daysPending} d</b></div>
                {commBadge(v)}
              </div>
              <div className="opq-next">
                <span className="lbl">Siguiente</span>
                <span className="val">{nextFulfillmentAction(v)}</span>
                <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); setSelected(v.order.id) }}>Ver caso <Icon name="chevR" size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

const SUBTITLE: Record<Workstream, string> = {
  cumplimiento: 'Cumplimiento y pendientes: qué falta entregar, cuándo, si se contactó al paciente y si hay riesgo de continuidad.',
  preparacion: 'Preparación estéril: qué preparar, qué está listo, qué está bloqueado, qué falta verificar y qué sigue.',
}

/** Operaciones de Medicación — dos workstreams: Cumplimiento y Preparación estéril. */
export function OperacionesMedicacionPage() {
  const [params, setParams] = useSearchParams()
  const ws: Workstream = params.get('ws') === 'preparacion' || params.get('prep') ? 'preparacion' : 'cumplimiento'

  const go = (next: Workstream) => {
    const p = new URLSearchParams(params)
    if (next === 'preparacion') p.set('ws', 'preparacion')
    else { p.delete('ws'); p.delete('prep') }
    if (next === 'cumplimiento') p.delete('case')
    setParams(p, { replace: true })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Operaciones de Medicación</h1>
          <div className="page-sub">{SUBTITLE[ws]}</div>
        </div>
      </div>

      <div className="ws-tabs" role="tablist" aria-label="Workstreams">
        <button type="button" role="tab" aria-selected={ws === 'cumplimiento'} className={`ws-tab ${ws === 'cumplimiento' ? 'on' : ''}`} onClick={() => go('cumplimiento')}>
          <Icon name="box" size={14} /> Cumplimiento / Pendientes
        </button>
        <button type="button" role="tab" aria-selected={ws === 'preparacion'} className={`ws-tab ${ws === 'preparacion' ? 'on' : ''}`} onClick={() => go('preparacion')}>
          <Icon name="drop" size={14} /> Preparación estéril
        </button>
      </div>

      {ws === 'preparacion' ? <PreparacionEsterilWorkstream /> : <CumplimientoWorkstream />}
    </>
  )
}
