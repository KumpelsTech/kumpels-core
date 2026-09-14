import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { PrepStatus, PreparationView } from '../../types/preparation'
import type { ComponentView } from '../../types/traceability'
import {
  PREP_STATUS_LABEL, PREP_STATUS_SHORT, usePreparationStore,
} from '../../utils/preparationStore'
import { useReviewStore } from '../../utils/reviewStore'
import { usePersona } from '../../utils/personaStore'
import { LOT_STATUS_LABEL, LOT_STATUS_VARIANT, useTraceabilityStore } from '../../utils/traceabilityStore'
import { services } from '../../services'
import { Badge } from '../Badge'
import { Icon } from '../Icon'
import { LotPicker } from './LotPicker'
import { LotDetail } from './LotDetail'

/** Jerarquía visual de estado. */
const STATUS_VARIANT: Record<PrepStatus, 'hi' | 'action' | 'info' | 'ok' | 'plain'> = {
  bloqueada: 'hi', 'pendiente-validacion': 'action', lista: 'info', 'en-preparacion': 'info',
  'pendiente-verificacion': 'action', verificada: 'info', liberada: 'ok',
}
const groupRank = (s: PrepStatus) => (s === 'bloqueada' || s === 'pendiente-validacion' ? 0 : s === 'liberada' ? 2 : 1)

function Fact({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  if (!v) return null
  return <div className="fact"><span className="fk">{k}</span><span className={`fv ${mono ? 'mono' : ''}`}>{v}</span></div>
}

function Readiness({ v, onGoReview }: { v: PreparationView; onGoReview: () => void }) {
  const { readiness, status } = v
  const ready = readiness.ready
  return (
    <div className={`readiness ${ready ? 'ok' : 'blocked'}`}>
      <div className="rd-head">
        <span className="rd-ico"><Icon name={ready ? 'check' : 'alert'} size={16} /></span>
        <div>
          <div className="rd-title">{ready ? 'Lista para preparar' : PREP_STATUS_LABEL[status].toUpperCase()}</div>
          <div className="rd-sub">
            {ready
              ? 'Todos los requisitos de preparación están cumplidos.'
              : `${readiness.pendingCount} requisito${readiness.pendingCount > 1 ? 's' : ''} pendiente${readiness.pendingCount > 1 ? 's' : ''}.`}
          </div>
        </div>
      </div>
      <div className="rq-list">
        {readiness.requirements.map((r) => (
          <div className={`rq-row ${r.met ? 'met' : 'unmet'}`} key={r.key}>
            <span className="rq-ico"><Icon name={r.met ? 'check' : 'alert'} size={13} /></span>
            <span className="rq-k">{r.label}</span>
            {!r.met && r.responsible ? <span className="rq-resp">{r.responsible}</span> : null}
          </div>
        ))}
      </div>
      {v.blocker ? (
        <div className="rd-blocker">
          <div className="rb-main">
            <span className="rb-k">Bloqueo</span>
            <span className="rb-v">{v.blocker.label}</span>
          </div>
          {v.blocker.responsible ? <div className="rb-line">Responsable · <b>{v.blocker.responsible}</b></div> : null}
          {v.blocker.nextAction ? <div className="rb-line">Siguiente · <b>{v.blocker.nextAction}</b></div> : null}
          {v.reviewBlocked ? (
            <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={onGoReview}>
              <Icon name="stethoscope" size={13} /> Ir a Revisión Clínica
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const ROLE_LABEL: Record<ComponentView['component']['role'], string> = {
  antineoplastico: 'Antineoplásico', diluyente: 'Diluyente', otro: 'Componente',
}

function Componentes({
  views, editable, onPick, onOpenLot,
}: {
  views: ComponentView[]
  editable: boolean
  onPick: (componentKey: string, presentationId: string, presentationLabel: string, currentLotId?: string) => void
  onOpenLot: (lotId: string) => void
}) {
  return (
    <div className="comp-list">
      {views.map((cv) => {
        const lot = cv.lot
        const invalid = lot && lot.status !== 'disponible'
        return (
          <div className={`comp-row ${cv.component.role}`} key={cv.component.key}>
            <div className="comp-main">
              <div className="comp-top">
                <span className="comp-role">{ROLE_LABEL[cv.component.role]}</span>
                <span className="comp-prod">{cv.presentation.product}</span>
              </div>
              <div className="comp-sub">{cv.presentation.presentation} · requiere {cv.requiredText}</div>
            </div>
            <div className="comp-lot">
              {lot ? (
                <button type="button" className="lot-chip" onClick={() => onOpenLot(lot.id)} title="Ver trazabilidad del lote">
                  <Icon name="box" size={12} /> <span className="mono">{lot.manufacturerLot}</span>
                  <span className="lc-exp">vence {lot.expiration}</span>
                </button>
              ) : <span className="subtle">Sin lote</span>}
              {lot ? <Badge variant={LOT_STATUS_VARIANT[lot.status]}>{LOT_STATUS_LABEL[lot.status]}</Badge> : null}
            </div>
            <div className="comp-act">
              {invalid ? <span className="comp-warn"><Icon name="alert" size={12} /> Lote no válido</span> : null}
              {editable ? (
                <button type="button" className="btn sm" onClick={() => onPick(cv.component.key, cv.component.presentationId, `${cv.presentation.product} · ${cv.presentation.presentation}`, lot?.id)}>
                  {lot ? 'Cambiar lote' : 'Seleccionar lote'}
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Genealogy({ v }: { v: PreparationView }) {
  const { getComponentViews, buildGenealogy } = useTraceabilityStore()
  const steps = buildGenealogy(v.order, v, getComponentViews(v.order.id))
  return (
    <div className="geneal">
      {steps.map((s, i) => (
        <div className={`gen-step ${s.state}`} key={i}>
          <div className="gen-mark"><span className={`gen-dot ${s.state}`}>{s.state === 'done' ? <Icon name="check" size={10} /> : ''}</span>{i < steps.length - 1 ? <span className="gen-line" /> : null}</div>
          <div className="gen-body">
            <div className="gen-label">{s.label}</div>
            {s.value ? <div className="gen-value">{s.value}{s.at ? ` · ${s.at}` : ''}</div> : s.at ? <div className="gen-value">{s.at}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function CaseDetail({ v, onClose }: { v: PreparationView; onClose: () => void }) {
  usePreparationStore()
  const { getComponentViews, getAudit } = useTraceabilityStore()
  const { can, profile } = usePersona()
  const navigate = useNavigate()
  const { order, instance, status } = v
  const by = profile.userName
  const componentViews = getComponentViews(order.id)
  const auditEntries = getAudit(order.id)
  const editableLots = status !== 'liberada' && can('seleccionar-lote')
  const [adminDone, setAdminDone] = useState(false)
  const [picker, setPicker] = useState<{ key: string; presentationId: string; label: string; current?: string } | null>(null)

  const openLot = (lotId: string) => navigate(`/medication-operations?ws=preparacion&lot=${lotId}`)
  const goReview = () => navigate(`/patients/${order.patientId}?tab=revision`)

  return (
    <div className="prep-detail">
      <div className="pd-head">
        <div>
          <div className="pd-title">{order.patientName} <span className="pq-id mono">{order.id}</span></div>
          <div className="pd-sub">{order.medication} · {order.protocol}{order.cycleDay ? ` · ${order.cycleDay}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge variant={STATUS_VARIANT[status]}>{PREP_STATUS_LABEL[status]}</Badge>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
      </div>

      <div className="pd-body">
        {/* Paciente y tratamiento */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="users" size={13} /> Paciente y tratamiento</div>
          <div className="pd-facts">
            <Fact k="Paciente" v={`${order.patientName} · ${order.patientId}`} />
            <Fact k="Protocolo" v={order.protocol} />
            <Fact k="Ciclo / día" v={order.cycleDay} />
            <Fact k="Administración programada" v={order.scheduledAt} />
          </div>
          <button type="button" className="link-mini" style={{ marginTop: 10 }} onClick={() => navigate(`/patients/${order.patientId}`)}>
            Abrir Patient 360 →
          </button>
        </section>

        {/* Orden de preparación */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="doc" size={13} /> Orden de preparación</div>
          <div className="pd-facts">
            <Fact k="Medicamento" v={order.medication} />
            <Fact k="Dosis prescrita" v={order.prescribedDose} />
            <Fact k="Dosis final aprobada" v={order.approvedDose ?? 'Por confirmar'} />
            <Fact k="Vía" v={order.route} />
            <Fact k="Presentación" v={order.presentation} />
            <Fact k="Diluyente" v={order.diluent} />
            <Fact k="Volumen final" v={order.finalVolume ?? 'Por definir'} />
            <Fact k="Tiempo de administración" v={order.administrationTime} />
            <Fact k="Contenedor" v={order.container} />
            <Fact k="Responsable" v={order.responsible} />
            {order.medicationOrderId ? <Fact k="Orden de medicación" v={order.medicationOrderId} mono /> : null}
          </div>
        </section>

        {/* Componentes + selección de lote */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="box" size={13} /> Componentes</div>
          <Componentes
            views={componentViews}
            editable={editableLots}
            onOpenLot={openLot}
            onPick={(key, presentationId, label, current) => setPicker({ key, presentationId, label, current })}
          />
          {auditEntries.some((a) => a.action === 'correccion') ? (
            <div className="comp-audit">
              <Icon name="clock" size={12} /> {auditEntries.filter((a) => a.action === 'correccion').map((a) => `${a.note} · ${a.by}`).join(' · ')}
            </div>
          ) : null}
          {!editableLots ? <div className="subtle" style={{ marginTop: 8 }}>Lotes bloqueados tras la liberación (registro conservado).</div> : null}
        </section>

        {/* Readiness */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="shield" size={13} /> Estado de preparación</div>
          <Readiness v={v} onGoReview={goReview} />
        </section>

        {/* Preparación */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="drop" size={13} /> Preparación</div>
          {instance?.startedAt ? (
            <div className="pd-facts">
              <Fact k="Dosis final" v={instance.finalDose} />
              <Fact k="Concentración" v={instance.concentration} />
              <Fact k="Volumen" v={instance.volume} />
              <Fact k="Contenedor" v={instance.container} />
              <Fact k="Iniciada" v={instance.startedAt} />
              <Fact k="Finalizada" v={instance.completedAt} />
            </div>
          ) : (
            <div className="subtle" style={{ padding: '2px 0 6px' }}>La preparación aún no ha iniciado.</div>
          )}
          {can('preparar') ? (
            <div className="prep-actions">
              <button type="button" className="btn sm primary" disabled={status !== 'lista'} onClick={() => { void services.preparation.start(order.id, by) }}>
                <Icon name="drop" size={13} /> Iniciar preparación
              </button>
              <button type="button" className="btn sm" disabled={status !== 'en-preparacion'} onClick={() => { void services.preparation.complete(order.id, by) }}>
                <Icon name="check" size={13} /> Finalizar preparación
              </button>
            </div>
          ) : null}
        </section>

        {/* Verificación — preparar / verificar / liberar son acciones separadas */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="shield" size={13} /> Verificación y liberación</div>
          <div className="sign-grid">
            <div className="sign"><span className="sg-k">Preparado por</span><span className={`sg-v ${instance?.preparedBy ? '' : 'pend'}`}>{instance?.preparedBy ?? 'Pendiente'}</span>{instance?.completedAt ? <span className="sg-at">{instance.completedAt}</span> : null}</div>
            <div className="sign"><span className="sg-k">Verificado por</span><span className={`sg-v ${instance?.verifiedBy ? '' : 'pend'}`}>{instance?.verifiedBy ?? 'Pendiente'}</span>{instance?.verifiedAt ? <span className="sg-at">{instance.verifiedAt}</span> : null}</div>
            <div className="sign"><span className="sg-k">Liberado por</span><span className={`sg-v ${instance?.releasedBy ? '' : 'pend'}`}>{instance?.releasedBy ?? 'Pendiente'}</span>{instance?.releasedAt ? <span className="sg-at">{instance.releasedAt}</span> : null}</div>
          </div>
          {can('verificar') || can('liberar') ? (
            <div className="prep-actions">
              {can('verificar') ? (
                <button type="button" className="btn sm primary" disabled={status !== 'pendiente-verificacion'} onClick={() => { void services.preparation.verify(order.id, by) }}>
                  <Icon name="shield" size={13} /> Verificar
                </button>
              ) : null}
              {can('liberar') ? (
                <button type="button" className="btn sm primary" disabled={status !== 'verificada'} onClick={() => { void services.preparation.release(order.id, by) }}>
                  <Icon name="check" size={13} /> Liberar
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <Icon name="shield" size={12} /> Preparación, verificación y liberación se registran como acciones separadas.
          </div>
          {status === 'liberada' ? <div className="calm" style={{ marginTop: 12 }}><span className="c-ico"><Icon name="check" size={15} /></span> Preparación liberada para administración.</div> : null}
          {can('registrar-administracion') && status === 'liberada' ? (
            <div className="prep-actions">
              <button type="button" className="btn sm primary" disabled={adminDone} onClick={() => setAdminDone(true)}>
                <Icon name="syringe" size={13} /> {adminDone ? 'Administración registrada · demo' : 'Registrar administración'}
              </button>
            </div>
          ) : null}
        </section>

        {/* Trazabilidad (genealogía) */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="route" size={13} /> Trazabilidad</div>
          <Genealogy v={v} />
        </section>

        {/* Actividad */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="clock" size={13} /> Actividad</div>
          <div className="ftimeline">
            {order.events.map((e, i) => (
              <div className="fte" key={i}>
                <span className={`fte-dot ${e.state}`}>{e.state === 'done' ? <Icon name="check" size={10} /> : e.state === 'warn' ? '!' : ''}</span>
                <div className="fte-main"><div className="fte-label">{e.label}</div><div className="fte-at mono">{e.at}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {picker ? (
        <LotPicker
          presentationId={picker.presentationId}
          presentationLabel={picker.label}
          currentLotId={picker.current}
          onPick={(lotId) => { void services.traceability.selectLot(order.id, picker.key, lotId, by); setPicker(null) }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  )
}

function QueueRow({ v, on, onSelect }: { v: PreparationView; on: boolean; onSelect: () => void }) {
  const { order, status } = v
  const attention = status === 'bloqueada' || status === 'pendiente-validacion'
  return (
    <div className={`prepq-row ${on ? 'on' : ''}`} onClick={onSelect}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}>
      <div className="prepq-time">
        <span className="pt-h">{order.scheduledAt.replace('Hoy ', '')}</span>
        <span className="pt-l">Administración</span>
      </div>
      <div className="prepq-main">
        <div className="prepq-top">
          <span className="prepq-name">{order.patientName}</span>
          <span className="pq-id mono">{order.id}</span>
          <Badge variant={STATUS_VARIANT[status]}>{PREP_STATUS_SHORT[status]}</Badge>
        </div>
        <div className="prepq-sub">{order.medication} · {order.protocol}{order.cycleDay ? ` · ${order.cycleDay}` : ''}</div>
        {attention && v.blocker ? (
          <div className="prepq-blk"><Icon name="alert" size={12} /> {v.blocker.label}{v.blocker.responsible ? ` · ${v.blocker.responsible}` : ''}</div>
        ) : null}
      </div>
      <div className="prepq-next">
        <span className="lbl">Siguiente</span>
        <span className={`val ${attention ? 'attn' : ''}`}>{v.nextAction}</span>
        <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); onSelect() }}>Ver caso <Icon name="chevR" size={12} /></button>
      </div>
    </div>
  )
}

/** Workstream "Preparación estéril" dentro de Operaciones de Medicación. */
export function PreparacionEsterilWorkstream() {
  const store = usePreparationStore()
  useReviewStore() // re-render cuando cambian las decisiones de revisión clínica
  const views = store.listPreparationViews()
  const [params, setParams] = useSearchParams()
  const initial = params.get('prep')
  const lotId = params.get('lot')
  const [selected, setSelected] = useState<string | null>(initial && views.some((v) => v.order.id === initial) ? initial : null)

  const closeLot = () => { const p = new URLSearchParams(params); p.delete('lot'); setParams(p, { replace: true }) }

  const atencion = views.filter((v) => v.status === 'bloqueada' || v.status === 'pendiente-validacion')
  const enCurso = views.filter((v) => v.status === 'lista' || v.status === 'en-preparacion' || v.status === 'pendiente-verificacion' || v.status === 'verificada')
  const liberadas = views.filter((v) => v.status === 'liberada')

  const queue = [...views].sort((a, b) =>
    groupRank(a.status) - groupRank(b.status) || a.order.scheduledMinutes - b.order.scheduledMinutes)
  const sel = selected ? store.view(selected) : null

  const sum = (n: number, label: string, kind: string) => (
    <div className={`ops-stat ${kind}`}><span className="os-n tnum">{n}</span><span className="os-l">{label}</span></div>
  )

  return (
    <>
      <div className="ops-sum">
        {sum(views.length, 'Preparaciones programadas hoy', 'attn')}
        {sum(atencion.length, 'Bloqueadas / validación', 'crit')}
        {sum(enCurso.length, 'En cola / preparación', 'warn')}
        {sum(liberadas.length, 'Liberadas', '')}
      </div>

      {lotId ? <LotDetail lotId={lotId} onClose={closeLot} /> : null}
      {sel ? <CaseDetail v={sel} onClose={() => setSelected(null)} /> : null}

      <div className="card">
        <div className="section-head">
          <div className="section-title">Cola de preparación estéril <span className="st-sub">{views.length} casos · orden por atención y hora de administración</span></div>
        </div>
        <div className="prepq">
          {queue.map((v) => (
            <QueueRow key={v.order.id} v={v} on={selected === v.order.id} onSelect={() => setSelected(v.order.id)} />
          ))}
        </div>
      </div>
    </>
  )
}
