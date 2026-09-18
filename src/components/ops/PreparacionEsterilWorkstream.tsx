import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { PrepStatus, PreparationOrder, PreparationView } from '../../types/preparation'
import type { ComponentView, PreparationBatch } from '../../types/traceability'
import {
  PREP_STATUS_LABEL, PREP_STATUS_SHORT, usePreparationStore,
} from '../../utils/preparationStore'
import { useReviewStore } from '../../utils/reviewStore'
import { usePersona } from '../../utils/personaStore'
import { delaySignalFor } from '../../utils/delaySignals'
import { StatTile } from '../StatTile'
import { LOT_STATUS_LABEL, LOT_STATUS_VARIANT, useTraceabilityStore } from '../../utils/traceabilityStore'
import { ADMIN_RESULT_LABEL, useAdministrationStore } from '../../utils/administrationStore'
import { services } from '../../services'
import { Badge } from '../Badge'
import { Icon } from '../Icon'
import { LotPicker } from './LotPicker'
import { LotDetail } from './LotDetail'
import { AdministrationDrawer } from '../patient/AdministrationDrawer'
import { TraceTree, TraceabilityDrawer } from './TraceabilityDrawer'
import type { WorkItem } from '../../types/work'
import type { AdminUser } from '../../types/admin'
import type { ActionContext } from '../../types/eligibility'
import { evaluateEligibility, eligibleUsers, hasCapability } from '../../utils/eligibility'
import { PREPARATION_POLICY } from '../../config/preparationPolicy'
import { MIXING_SCOPE, getFacility } from '../../data/admin'
import { useProductionStore } from '../../utils/productionStore'
import { acceptProductionRequest } from '../../utils/productionActions'
import { PRODUCTION_STATUS_LABEL } from '../../types/production'
import { ReplaceModal } from './ReplaceModal'
import { ImpactBanner } from './ImpactBanner'

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

const COMPONENT_TYPE_LABEL: Record<string, string> = {
  'principio-activo': 'Principio activo', diluyente: 'Diluyente', vehiculo: 'Vehículo', otro: 'Componente',
}

/**
 * Sección de COMPONENTES orientada a la PREPARACIÓN (no inventario). Cada
 * componente puede usar VARIOS lotes fuente; muestra por lote: número, vencimiento,
 * cantidad usada y estado. Solo lotes utilizables pueden asignarse.
 */
function Componentes({
  views, editable, onAddLot, onChangeLot, onRemoveLot, onOpenLot,
}: {
  views: ComponentView[]
  editable: boolean
  onAddLot: (cv: ComponentView) => void
  onChangeLot: (cv: ComponentView, fromLotId: string) => void
  onRemoveLot: (componentKey: string, lotId: string) => void
  onOpenLot: (lotId: string) => void
}) {
  return (
    <div className="comp-list">
      {views.map((cv) => {
        const typeLabel = cv.component.componentType ? COMPONENT_TYPE_LABEL[cv.component.componentType] : ROLE_LABEL[cv.component.role]
        return (
          <div className={`comp-card ${cv.component.role}`} key={cv.component.key}>
            <div className="comp-head">
              <div>
                <span className="comp-role">{typeLabel}</span>
                <span className="comp-prod">{cv.presentation.product}</span>
                <span className="comp-pres">{cv.presentation.presentation}</span>
              </div>
              <span className="comp-req">Requerido: {cv.requiredText}</span>
            </div>
            <div className="comp-lots">
              <div className="comp-lots-k">Lotes utilizados</div>
              {cv.lots.length === 0 ? <div className="subtle">Sin lote asignado</div> : null}
              {cv.lots.map((lv) => (
                <div className={`comp-lotrow ${lv.usable ? '' : 'invalid'}`} key={lv.lot.id}>
                  <button type="button" className="lot-chip" onClick={() => onOpenLot(lv.lot.id)} title="Ver trazabilidad del lote">
                    <Icon name="box" size={12} /> <span className="mono">{lv.lot.manufacturerLot}</span>
                  </button>
                  <span className="comp-qty">{lv.quantity} {lv.unit}{lv.note ? ` · ${lv.note}` : ''}</span>
                  <span className="lc-exp">vence {lv.lot.expiration}</span>
                  <Badge variant={LOT_STATUS_VARIANT[lv.lot.status]}>{LOT_STATUS_LABEL[lv.lot.status]}</Badge>
                  {editable ? (
                    <span className="comp-lotact">
                      <button type="button" className="link-mini" onClick={() => onChangeLot(cv, lv.lot.id)}>Cambiar</button>
                      {cv.lots.length > 1 ? <button type="button" className="link-mini danger" onClick={() => onRemoveLot(cv.component.key, lv.lot.id)}>Quitar</button> : null}
                    </span>
                  ) : null}
                </div>
              ))}
              {editable ? (
                <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => onAddLot(cv)}>
                  <Icon name="box" size={12} /> Añadir lote
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}


/** Genera un número de lote de mezcla sugerido (CMP-AAAAMMDD-NNN), no derivado del paciente. */
function suggestBatchNumber(order: PreparationOrder): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const seq = order.id.replace(/\D/g, '').slice(-3).padStart(3, '0')
  return `CMP-${ymd}-${seq}`
}

/** Modal de confirmación del LOTE DE PREPARACIÓN FINAL (mezcla compuesta). */
function BatchModal({
  order, batch, onSave, onClose,
}: {
  order: PreparationOrder
  batch?: PreparationBatch
  onSave: (input: { batchNumber: string; facilityId: string; beyondUseAt?: string; expirationAt?: string }) => void
  onClose: () => void
}) {
  const [batchNumber, setBatchNumber] = useState(batch?.batchNumber ?? suggestBatchNumber(order))
  const [beyondUseAt, setBeyondUseAt] = useState(batch?.beyondUseAt ?? '')
  const [expirationAt, setExpirationAt] = useState(batch?.expirationAt ?? '')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const canSave = batchNumber.trim().length > 0
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Lote de mezcla final" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="shield" size={16} /></span>
          <div>
            <div className="mh-title">Lote de preparación final</div>
            <div className="mh-sub">{order.id} · {order.medication}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          <div className="coherence-warn" style={{ marginBottom: 14 }}><Icon name="alert" size={13} /> Es el lote de la <b>mezcla compuesta</b>, distinto de los lotes fuente de cada componente.</div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Número de lote de mezcla <span className="fu-hint">· obligatorio</span></label>
            <input type="text" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="CMP-AAAAMMDD-NNN" />
          </div>
          <div className="fu-field" style={{ marginBottom: 14 }}>
            <label>Uso máximo (beyond-use) <span className="fu-hint">· opcional</span></label>
            <input type="text" value={beyondUseAt} onChange={(e) => setBeyondUseAt(e.target.value)} placeholder="p. ej. Hoy 23:05" />
          </div>
          <div className="fu-field">
            <label>Vencimiento de la mezcla <span className="fu-hint">· opcional</span></label>
            <input type="text" value={expirationAt} onChange={(e) => setExpirationAt(e.target.value)} placeholder="p. ej. 12 Sep 2026" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Solo Central de Mezclas habilitada. Trazable.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!canSave} onClick={() => canSave && onSave({ batchNumber: batchNumber.trim(), facilityId: MIXING_SCOPE.facilityId, beyondUseAt: beyondUseAt.trim() || undefined, expirationAt: expirationAt.trim() || undefined })} style={!canSave ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {batch ? 'Actualizar lote' : 'Confirmar lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CaseDetail({ v, onClose }: { v: PreparationView; onClose: () => void }) {
  const prepStore = usePreparationStore()
  const { getProductionRequest } = useProductionStore()
  const { getComponentViews, getAudit, principalLot, getPreparationBatch } = useTraceabilityStore()
  const { getAdministrationForOrder } = useAdministrationStore()
  const { can, profile, actor, user } = usePersona()
  const navigate = useNavigate()
  const { order, instance, status } = v
  // Solicitud de producción (handoff Enfermería → Central de Mezclas).
  const request = getProductionRequest(order.id)
  const pendingAcceptance = request?.status === 'SENT_TO_PRODUCTION'
  const canAccept = !!user && hasCapability(user, 'PRODUCTION_REQUEST_ACCEPT')
  // Iniciar preparación: si aún está SOLO enviada (no aceptada), acepta primero
  // (aceptación automática, misma historia de auditoría/evento) y luego inicia.
  const startPrep = async () => {
    if (pendingAcceptance) await acceptProductionRequest(order.id, order.patientId, actor(), true)
    await services.preparation.start(order.id, by)
  }
  // Atribución al usuario ACTIVO (Practitioner), no al nombre estático del workspace:
  // así la segregación de funciones distingue correctamente preparador vs verificador.
  const by = user?.name ?? profile.userName
  // Elegibilidad de verificación (capacidad + alcance + segregación de funciones).
  const verifyCtx: ActionContext = { capability: 'STERILE_PREPARATION_VERIFY', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId, preparedBy: instance?.preparedBy }
  const verifyEligibles: AdminUser[] = status === 'pendiente-verificacion' ? eligibleUsers(verifyCtx) : []
  const currentVerifyElig = user ? evaluateEligibility(user, verifyCtx) : undefined
  const verifyItem: WorkItem = {
    id: `wi-prep-${order.id}`, type: 'preparacion', patientId: order.patientId, patientName: order.patientName,
    priority: 'ACTION', statusLabel: 'Verificación requerida', tone: 'warn', roles: ['qf-mezclas', 'coordinador'],
    owner: { role: 'qf-mezclas', label: 'Central de Mezclas' }, dueLabel: order.scheduledAt, dueMinutes: order.scheduledMinutes,
    nextAction: 'Verificar', actionKey: 'verificar', requiredCapability: 'STERILE_PREPARATION_VERIFY',
    facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId,
    source: 'Preparación estéril', href: `/medication-operations?ws=preparacion&prep=${order.id}`,
    signals: { scheduledMinutes: order.scheduledMinutes },
  }
  const assignVerify = (u: AdminUser) => { void services.coordinator.assign(verifyItem, u, {}, actor(), { preparedBy: instance?.preparedBy }) }
  const componentViews = getComponentViews(order.id)
  const batch = getPreparationBatch(order.id)
  const compoundingRequired = PREPARATION_POLICY.requireCompoundingBatch
  const auditEntries = getAudit(order.id)
  // Bloqueo clínico: verificada o liberada ⇒ inmutable (no edición directa de lotes,
  // cantidades, ni identidad de la preparación final). Reemplazo controlado en su lugar.
  const locked = status === 'verificada' || status === 'liberada' || !!v.superseded
  // Autorización de genealogía (TASK 20.2A §10): Role + Capacidad + Sede + Programa,
  // no basta con poder ver el caso.
  const canPrepGenealogy = !!user && evaluateEligibility(user, { capability: 'STERILE_PREPARATION', facilityId: MIXING_SCOPE.facilityId, programId: MIXING_SCOPE.programId }).eligible
  const editableLots = !locked && canPrepGenealogy
  const canReplace = !!user && hasCapability(user, 'PREPARATION_REPLACE')
  const releaseBlock = prepStore.releaseBlockReason(order.id, by)
  const administration = getAdministrationForOrder(order.id)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showTrace, setShowTrace] = useState(false)
  const [picker, setPicker] = useState<{ mode: 'single' | 'add' | 'change'; key: string; presentationId: string; label: string; fromLotId?: string; current?: string; qty: number; unit: string } | null>(null)

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
        <ImpactBanner orderId={order.medicationOrderId} />
        {v.productionGate ? (
          <div className="supersede-banner warn">
            <Icon name="alert" size={14} /> <b>Pendiente de envío por Enfermería.</b> La producción no puede iniciar hasta que Enfermería confirme y envíe el tratamiento a Central de Mezclas · Responsable: <b>Enfermería</b> · Siguiente: <b>Enviar a producción</b>.
          </div>
        ) : null}
        {v.superseded ? (
          <div className="supersede-banner warn">
            <Icon name="refresh" size={14} /> Reemplazada por <b className="mono">{v.superseded.byId}</b> — {v.superseded.reason} · {v.superseded.by} · {v.superseded.at}. Preparación inmutable; genealogía conservada.
          </div>
        ) : null}
        {v.supersedes ? (
          <div className="supersede-banner info">
            <Icon name="refresh" size={14} /> Reemplaza a <b className="mono">{v.supersedes}</b> (preparación anterior conservada).
          </div>
        ) : null}
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
            onAddLot={(cv) => {
              const usedQty = cv.lots.reduce((s, l) => s + (l.quantity || 0), 0)
              const remaining = Math.max((cv.component.requiredQuantity || 0) - usedQty, 0)
              setPicker({ mode: 'add', key: cv.component.key, presentationId: cv.component.presentationId, label: `${cv.presentation.product} · ${cv.presentation.presentation}`, qty: remaining || cv.component.requiredQuantity || 0, unit: cv.component.unit })
            }}
            onChangeLot={(cv, fromLotId) => setPicker({ mode: 'change', key: cv.component.key, presentationId: cv.component.presentationId, label: `${cv.presentation.product} · ${cv.presentation.presentation}`, fromLotId, current: fromLotId, qty: 0, unit: cv.component.unit })}
            onRemoveLot={(key, lotId) => { void services.traceability.removeLot(order.id, key, lotId, actor()) }}
          />
          {auditEntries.some((a) => a.action === 'correccion') ? (
            <div className="comp-audit">
              <Icon name="clock" size={12} /> {auditEntries.filter((a) => a.action === 'correccion').map((a) => `${a.note} · ${a.by}`).join(' · ')}
            </div>
          ) : null}
          {auditEntries.length ? (
            <button type="button" className="link-mini" style={{ marginTop: 8 }} onClick={() => setShowTrace(true)}>
              <Icon name="clock" size={12} /> Ver historial de lotes ({auditEntries.length})
            </button>
          ) : null}
          {locked ? <div className="subtle" style={{ marginTop: 8 }}><Icon name="shield" size={12} /> Componentes y lotes bloqueados tras la verificación/liberación (registro conservado). Un cambio requiere reemplazo controlado.</div> : null}
          {!locked && !canPrepGenealogy ? <div className="subtle" style={{ marginTop: 8 }}><Icon name="shield" size={12} /> Solo Central de Mezclas habilitada (capacidad + sede + programa) puede asignar lotes.</div> : null}
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
          {pendingAcceptance ? (
            <div className="handoff-box" style={{ marginBottom: 12 }}>
              <div className="hb-lead"><Icon name="box" size={13} /> Enviada a producción por <b>{request?.requestedByName ?? 'Enfermería'}</b> · {request?.requestedAt}. Acúsela para tomar la propiedad; iniciar la preparación la acepta automáticamente.</div>
              {canAccept ? (
                <button type="button" className="btn sm primary" style={{ marginTop: 8 }} onClick={() => { void acceptProductionRequest(order.id, order.patientId, actor()) }}>
                  <Icon name="check" size={13} /> Aceptar solicitud
                </button>
              ) : null}
            </div>
          ) : null}
          {request?.status === 'ACCEPTED_BY_COMPOUNDING' && !instance?.startedAt ? (
            <div className="calm" style={{ marginBottom: 12 }}><span className="c-ico"><Icon name="check" size={15} /></span> Solicitud aceptada por {request.acceptedByName}{request.acceptedAuto ? ' (al iniciar)' : ''} · {request.acceptedAt}. {PRODUCTION_STATUS_LABEL[request.status]}.</div>
          ) : null}
          {can('preparar') ? (
            <div className="prep-actions">
              <button type="button" className="btn sm primary" disabled={status !== 'lista'} onClick={() => { void startPrep() }}>
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
          {/* Verificación — elegibilidad: capacidad + alcance + segregación de funciones */}
          {status === 'pendiente-verificacion' && can('verificar') ? (
            currentVerifyElig?.eligible ? (
              <div className="prep-actions">
                <button type="button" className="btn sm primary" onClick={() => { void services.preparation.verify(order.id, by) }}>
                  <Icon name="shield" size={13} /> Verificar
                </button>
              </div>
            ) : verifyEligibles.length ? (
              <div className="handoff-box">
                <div className="hb-deny"><Icon name="shield" size={13} /> {user?.name}: no elegible para verificar — {currentVerifyElig?.reason}</div>
                <div className="hb-lead">Asignar verificación a un QF habilitado (mismo alcance, distinto del preparador):</div>
                <div className="pqcm-users">
                  {verifyEligibles.map((u) => {
                    const fac = u.scope.facilityIds.map((f) => getFacility(f)?.name).filter(Boolean)
                    return (
                      <button key={u.id} type="button" className="pqcm-user" onClick={() => assignVerify(u)}>
                        <span className="as-av">{u.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
                        <span className="pqcm-un"><b>{u.name}</b><i>{fac[0] ?? '—'}</i></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="noelig-blocker">
                <div className="nb-title"><Icon name="alert" size={14} /> Sin profesional elegible para verificación</div>
                <div className="nb-grid">
                  <div><span className="nk">Acción requerida</span><span className="nv">Verificar preparación</span></div>
                  <div><span className="nk">Rol / capacidad</span><span className="nv">QF Central de Mezclas · Verificar</span></div>
                  <div><span className="nk">Sede / programa</span><span className="nv">{getFacility(MIXING_SCOPE.facilityId)?.name} · Oncología</span></div>
                  <div><span className="nk">Equipo responsable</span><span className="nv">Central de Mezclas</span></div>
                  <div><span className="nk">Política</span><span className="nv">Quien preparó no puede verificar (segregación de funciones)</span></div>
                </div>
                <div className="nb-next">Siguiente · Configurar o asignar un QF habilitado para verificación.</div>
                <button type="button" className="btn sm primary" onClick={() => { void services.coordinator.escalate(verifyItem, actor()) }}>
                  <Icon name="alert" size={13} /> Escalar a Coordinación
                </button>
              </div>
            )
          ) : null}
          {can('liberar') && status === 'verificada' ? (
            <div className="prep-actions">
              <button type="button" className="btn sm primary" disabled={!!releaseBlock} onClick={() => { void services.preparation.release(order.id, by) }}>
                <Icon name="check" size={13} /> Liberar
              </button>
            </div>
          ) : null}
          {status === 'verificada' && releaseBlock ? (
            <div className="segregation-warn"><Icon name="shield" size={13} /> {releaseBlock}</div>
          ) : null}
          <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <Icon name="shield" size={12} /> Preparación, verificación y liberación se registran como acciones separadas (política de segregación configurable).
          </div>
          {status === 'liberada' ? <div className="calm" style={{ marginTop: 12 }}><span className="c-ico"><Icon name="check" size={15} /></span> Preparación liberada para administración.</div> : null}
          {(status === 'verificada' || status === 'liberada') && !v.superseded ? (
            <div className="replace-zone">
              <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="shield" size={12} /> Verificada/liberada: inmutable. Un cambio clínico requiere reemplazo controlado (no edición).</div>
              {canReplace ? (
                <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => setShowReplace(true)}><Icon name="refresh" size={13} /> Reemplazar preparación</button>
              ) : null}
            </div>
          ) : null}
          {administration ? (
            <div className={`admin-note ${administration.result === 'administrada' ? 'ok' : 'warn'}`}>
              <Icon name="syringe" size={13} /> {ADMIN_RESULT_LABEL[administration.result]} · {administration.performerName} · {administration.at}
              {administration.reason ? <div className="an-reason">Motivo: {administration.reason}</div> : null}
            </div>
          ) : null}
          {can('registrar-administracion') && status === 'liberada' ? (
            <div className="prep-actions">
              <button type="button" className="btn sm primary" onClick={() => setShowAdmin(true)}>
                <Icon name="syringe" size={13} /> {administration ? 'Actualizar administración' : 'Registrar administración'}
              </button>
            </div>
          ) : null}
        </section>

        {/* Preparación final (identidad estable + lote de mezcla) */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="shield" size={13} /> Preparación final</div>
          <div className="pd-facts">
            <Fact k="ID de preparación" v={order.id} mono />
            <Fact k="Lote de mezcla final" v={batch?.batchNumber ?? (compoundingRequired ? 'Por confirmar' : '—')} mono />
            <Fact k="Paciente" v={`${order.patientName} · ${order.patientId}`} />
            <Fact k="Medicamento / régimen" v={order.protocol ? `${order.medication} · ${order.protocol}` : order.medication} />
            <Fact k="Dosis final" v={instance?.finalDose ?? order.approvedDose ?? order.prescribedDose} />
            <Fact k="Volumen final" v={instance?.volume ?? order.finalVolume} />
            <Fact k="Contenedor" v={instance?.container ?? order.container} />
            <Fact k="Preparado" v={instance?.completedAt ?? instance?.startedAt} />
            <Fact k="Preparado por" v={instance?.preparedBy} />
            <Fact k="Uso máximo (beyond-use)" v={batch?.beyondUseAt} />
            <Fact k="Vencimiento de mezcla" v={batch?.expirationAt} />
          </div>
          {compoundingRequired ? (
            <div style={{ marginTop: 10 }}>
              {batch ? <div className="subtle" style={{ marginBottom: 8 }}><Icon name="shield" size={12} /> Lote de mezcla <b className="mono">{batch.batchNumber}</b> · v{batch.version} · {batch.createdBy} · {batch.createdAt}</div> : null}
              {editableLots ? (
                <button type="button" className="btn sm" onClick={() => setShowBatch(true)}>
                  <Icon name="shield" size={13} /> {batch ? 'Actualizar lote de mezcla final' : 'Confirmar lote de mezcla final'}
                </button>
              ) : null}
            </div>
          ) : <div className="subtle" style={{ marginTop: 6 }}>El flujo institucional no requiere lote de mezcla final; la identidad es {order.id}.</div>}
        </section>

        {/* Trazabilidad — genealogía compuesta (multi-componente, multi-lote) */}
        <section className="prep-sec">
          <div className="prep-lead"><Icon name="route" size={13} /> Trazabilidad</div>
          <TraceTree
            patientName={order.patientName} patientId={order.patientId}
            preparationId={order.id} batchNumber={batch?.batchNumber} components={componentViews}
          />
          <button type="button" className="link-mini" style={{ marginTop: 10 }} onClick={() => setShowTrace(true)}>
            <Icon name="route" size={12} /> Ver trazabilidad completa (firmas, tiempos e historial)
          </button>
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
          onPick={(lotId, reason) => {
            const a = actor()
            if (picker.mode === 'add') void services.traceability.addLot(order.id, picker.key, lotId, picker.qty, picker.unit, a)
            else if (picker.mode === 'change' && picker.fromLotId) void services.traceability.changeLot(order.id, picker.key, picker.fromLotId, lotId, a, reason)
            else void services.traceability.selectLot(order.id, picker.key, lotId, a, reason)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {showBatch ? (
        <BatchModal order={order} batch={batch}
          onSave={(input) => { void services.traceability.confirmBatch(order.id, input, actor()); setShowBatch(false) }}
          onClose={() => setShowBatch(false)} />
      ) : null}
      {showAdmin ? (
        <AdministrationDrawer
          context={{
            patientId: order.patientId, patientName: order.patientName,
            preparationOrderId: order.id, medicationOrderId: order.medicationOrderId,
            medication: order.medication, dose: order.approvedDose ?? order.prescribedDose, route: order.route,
            scheduledAt: order.scheduledAt, preparationRef: order.id,
            lotReference: principalLot(order.id)?.manufacturerLot,
          }}
          onSave={(input) => { void services.administration.record(input, actor()); setShowAdmin(false) }}
          onClose={() => setShowAdmin(false)}
        />
      ) : null}
      {showTrace ? (
        <TraceabilityDrawer orderId={order.id} onClose={() => setShowTrace(false)} />
      ) : null}
      {showReplace ? (
        <ReplaceModal order={order}
          onSave={(opts) => { void services.preparation.replace(order.id, opts, actor()); setShowReplace(false) }}
          onClose={() => setShowReplace(false)} />
      ) : null}
    </div>
  )
}

function QueueRow({ v, on, owns, onSelect }: { v: PreparationView; on: boolean; owns: boolean; onSelect: () => void }) {
  const { order, status } = v
  const attention = status === 'bloqueada' || status === 'pendiente-validacion'
  const delay = delaySignalFor(order.patientId)
  const late = delay && (delay.severity === 'LATE' || delay.severity === 'CRITICAL') ? delay : undefined
  return (
    <div className={`prepq-row ${on ? 'on' : ''} ${attention ? 'blk' : ''} ${owns ? 'owns' : ''} ${late ? 'late' : ''}`} onClick={onSelect}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}>
      <div className="prepq-time">
        <span className="pt-h mono">{order.scheduledAt.replace('Hoy ', '')}</span>
        <span className="pt-l">Administración</span>
      </div>
      <div className="prepq-main">
        <div className="prepq-top">
          <span className="prepq-name">{order.patientName}</span>
          <span className="pq-id mono">{order.id}</span>
          <Badge variant={STATUS_VARIANT[status]}>{PREP_STATUS_SHORT[status]}</Badge>
          {owns ? <span className="prepq-you"><Icon name="alert" size={10} /> Requiere tu acción</span> : null}
        </div>
        <div className="prepq-sub">{order.medication} · {order.protocol}{order.cycleDay ? ` · ${order.cycleDay}` : ''}</div>
        {attention && v.blocker ? (
          <div className="prepq-blk"><Icon name="alert" size={12} /> {v.blocker.label}{v.blocker.responsible ? ` · ${v.blocker.responsible}` : ''}</div>
        ) : null}
        {late ? (
          <div className="prepq-late"><Icon name="clock" size={11} /> {late.severity === 'CRITICAL' ? 'Crítico' : 'Retrasada'} {late.minutesLate} min · {delay?.ownerLabel}</div>
        ) : null}
      </div>
      <div className="prepq-next">
        <span className="lbl">Siguiente</span>
        <span className={`val ${attention ? 'attn' : ''}`}>{v.nextAction}</span>
        <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); onSelect() }}>Abrir preparación <Icon name="chevR" size={12} /></button>
      </div>
    </div>
  )
}

/** Etapas del pipeline de producción (proyección sobre PrepStatus, sin nueva máquina de estados). */
type Stage = 'preparar' | 'preparacion' | 'verificacion' | 'liberadas'
const STAGE_OF = (s: PrepStatus): Stage | null =>
  s === 'lista' ? 'preparar'
    : s === 'en-preparacion' ? 'preparacion'
      : (s === 'pendiente-verificacion' || s === 'verificada') ? 'verificacion'
        : s === 'liberada' ? 'liberadas' : null
const STAGE_LABEL: Record<Stage, string> = {
  preparar: 'Por preparar', preparacion: 'En preparación', verificacion: 'Verificación', liberadas: 'Liberadas',
}
const STAGE_ICON = { preparar: 'box', preparacion: 'drop', verificacion: 'shield', liberadas: 'check' } as const

/** Acciones de ejecución que corresponden a Central de Mezclas por estado. */
const MEZCLAS_ACTIONABLE = new Set<PrepStatus>(['lista', 'en-preparacion', 'pendiente-verificacion', 'verificada'])

/** Workstream "Preparación estéril" (Central de Mezclas) dentro de Operaciones. */
export function PreparacionEsterilWorkstream() {
  const store = usePreparationStore()
  useReviewStore() // re-render cuando cambian las decisiones de revisión clínica
  const { persona } = usePersona()
  const views = store.listPreparationViews()
  const [params, setParams] = useSearchParams()
  const initial = params.get('prep')
  const lotId = params.get('lot')
  const [selected, setSelected] = useState<string | null>(initial && views.some((v) => v.order.id === initial) ? initial : null)
  const [stageFilter, setStageFilter] = useState<Stage | null>(null)

  const closeLot = () => { const p = new URLSearchParams(params); p.delete('lot'); setParams(p, { replace: true }) }

  const atencion = views.filter((v) => v.status === 'bloqueada' || v.status === 'pendiente-validacion')
  const count = (st: Stage) => views.filter((v) => STAGE_OF(v.status) === st).length
  const retrasadas = views.filter((v) => { const d = delaySignalFor(v.order.patientId); return d && (d.severity === 'LATE' || d.severity === 'CRITICAL') }).length

  const sorted = [...views].sort((a, b) =>
    groupRank(a.status) - groupRank(b.status) || a.order.scheduledMinutes - b.order.scheduledMinutes)
  const queue = stageFilter ? sorted.filter((v) => STAGE_OF(v.status) === stageFilter) : sorted
  const sel = selected ? store.view(selected) : null

  const stages: Stage[] = ['preparar', 'preparacion', 'verificacion', 'liberadas']

  return (
    <>
      <div className="stat-row hoy-stats">
        <StatTile value={views.length} label="Preparaciones hoy" tone="progress" />
        <StatTile value={atencion.length} label="Bloqueadas / validación" tone="crit" />
        <StatTile value={count('verificacion')} label="Esperan verificación" tone="warn" />
        <StatTile value={count('liberadas')} label="Liberadas" tone="ok" />
        {retrasadas ? <StatTile value={retrasadas} label="Retrasadas" tone="crit" /> : null}
      </div>

      {/* Pipeline de producción (Por preparar → En preparación → Verificación → Liberadas) */}
      <div className="pipe" role="tablist" aria-label="Pipeline de producción">
        {stages.map((st, i) => (
          <div className="pipe-wrap" key={st}>
            <button type="button" role="tab" aria-selected={stageFilter === st}
              className={`pipe-node ${stageFilter === st ? 'on' : ''}`}
              onClick={() => setStageFilter((c) => (c === st ? null : st))}>
              <span className="pipe-ico"><Icon name={STAGE_ICON[st]} size={14} /></span>
              <span className="pipe-n mono">{count(st)}</span>
              <span className="pipe-l">{STAGE_LABEL[st]}</span>
            </button>
            {i < stages.length - 1 ? <span className="pipe-arrow"><Icon name="arrow" size={16} /></span> : null}
          </div>
        ))}
      </div>

      {lotId ? <LotDetail lotId={lotId} onClose={closeLot} /> : null}
      {sel ? <CaseDetail v={sel} onClose={() => setSelected(null)} /> : null}

      <div className="card">
        <div className="section-head">
          <div className="section-title"><Icon name="drop" size={15} /> Cola de producción <span className="st-sub">{queue.length} {stageFilter ? `· ${STAGE_LABEL[stageFilter]}` : 'casos · por atención y hora'}</span></div>
          {stageFilter ? <button type="button" className="link-mini" onClick={() => setStageFilter(null)}>Ver todos</button> : null}
        </div>
        {queue.length === 0 ? (
          <div className="calm"><span className="c-ico"><Icon name="check" size={15} /></span> Sin preparaciones en esta etapa.</div>
        ) : (
          <div className="prepq">
            {queue.map((v) => (
              <QueueRow key={v.order.id} v={v} on={selected === v.order.id}
                owns={persona === 'qf-mezclas' && MEZCLAS_ACTIONABLE.has(v.status)}
                onSelect={() => setSelected(v.order.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
