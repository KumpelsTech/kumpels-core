import { useEffect } from 'react'
import type { ComponentView } from '../../types/traceability'
import { LOT_STATUS_LABEL, LOT_STATUS_VARIANT, useTraceabilityStore } from '../../utils/traceabilityStore'
import { usePreparationStore } from '../../utils/preparationStore'
import { Badge } from '../Badge'
import { Icon } from '../Icon'

/**
 * Árbol de GENEALOGÍA COMPUESTA (bidireccional, legible). No es un inventario:
 *
 *   Preparación final (id + lote de mezcla)
 *     → Componentes
 *         ├─ Producto → lote(s) fuente (cantidad, vencimiento, estado)
 *     → Paciente
 *
 * Cada lote fuente permanece visible (incluye componentes multi-lote).
 */
export function TraceTree({
  patientName, patientId, preparationId, batchNumber, components,
}: {
  patientName: string
  patientId: string
  preparationId: string
  batchNumber?: string
  components: ComponentView[]
}) {
  const lotCount = components.reduce((s, cv) => s + cv.lots.length, 0)
  return (
    <div className="trace-tree">
      {/* ¿Qué entró? — lotes fuente por componente */}
      <div className="tt-step">
        <div className="tt-step-k"><Icon name="box" size={12} /> ¿Qué entró? · {components.length} componentes · {lotCount} lotes fuente</div>
        <div className="tt-comp-list">
          {components.map((cv) => (
            <div className="tt-comp" key={cv.component.key}>
              <div className="tt-comp-head">
                <span className="tt-prod">{cv.presentation.product}</span>
                <span className="tt-pres">{cv.presentation.presentation}</span>
                <span className="tt-req">requerido {cv.requiredText}</span>
              </div>
              <div className="tt-lots">
                {cv.lots.length === 0 ? <div className="tt-lot subtle">Sin lote asignado</div> : null}
                {cv.lots.map((lv) => (
                  <div className={`tt-lot ${lv.usable ? '' : 'invalid'}`} key={lv.lot.id}>
                    <span className="tt-lot-branch" />
                    <span className="tt-lot-tag">Lote fuente</span>
                    <span className="mono tt-lotnum">{lv.lot.manufacturerLot}</span>
                    <span className="tt-qty">{lv.quantity} {lv.unit}{lv.note ? ` · ${lv.note}` : ''}</span>
                    <span className="lc-exp">vence {lv.lot.expiration}</span>
                    <Badge variant={LOT_STATUS_VARIANT[lv.lot.status]}>{LOT_STATUS_LABEL[lv.lot.status]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tt-flow"><Icon name="arrow" size={16} /></div>

      {/* ¿Qué preparación produjo? / ¿Qué lote final? */}
      <div className="tt-node prep">
        <span className="tt-ico"><Icon name="drop" size={13} /></span>
        <div>
          <div className="tt-k">Preparación final</div>
          <div className="tt-v"><span className="mono">{preparationId}</span></div>
        </div>
      </div>
      <div className="tt-node final">
        <span className="tt-ico"><Icon name="shield" size={13} /></span>
        <div>
          <div className="tt-k">Lote de mezcla final</div>
          <div className="tt-v">{batchNumber ? <span className="mono">{batchNumber}</span> : <span className="subtle">Sin lote de mezcla</span>} <span className="tt-note">(compuesto en sede · no es lote de fabricante)</span></div>
        </div>
      </div>

      <div className="tt-flow"><Icon name="arrow" size={16} /></div>

      {/* ¿Para qué paciente? */}
      <div className="tt-node patient">
        <span className="tt-ico"><Icon name="users" size={13} /></span>
        <div>
          <div className="tt-k">Paciente</div>
          <div className="tt-v">{patientName} · <span className="mono">{patientId}</span></div>
        </div>
      </div>
    </div>
  )
}

const AUDIT_TITLE: Record<string, string> = {
  seleccion: 'Lote seleccionado', correccion: 'Lote corregido', uso: 'Uso de lote registrado',
}

/**
 * Drawer de TRAZABILIDAD COMPLETA de una preparación (bidireccional). Reúne, sin
 * duplicar la fuente: la cadena compuesta (árbol), las firmas y tiempos exactos, y
 * el historial append-only de lotes/componentes (actor, rol, fecha/hora, previo→
 * nuevo, motivo). Se abre desde el caso de preparación y desde Patient 360.
 */
export function TraceabilityDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { getPreparationTrace, getAudit, getPreparationBatch } = useTraceabilityStore()
  const prepStore = usePreparationStore()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const v = prepStore.view(orderId)
  const { order, instance } = v
  const { components } = getPreparationTrace(orderId)
  const batch = getPreparationBatch(orderId)
  const audit = [...getAudit(orderId)].reverse()

  const Sign = ({ k, who, at }: { k: string; who?: string; at?: string }) => (
    <div className="sign"><span className="sg-k">{k}</span><span className={`sg-v ${who ? '' : 'pend'}`}>{who ?? 'Pendiente'}</span>{at ? <span className="sg-at">{at}</span> : null}</div>
  )

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="hist-drawer wide" role="dialog" aria-modal="true" aria-label="Trazabilidad completa" onClick={(e) => e.stopPropagation()}>
        <div className="fu-head">
          <span className="mh-ico"><Icon name="route" size={17} /></span>
          <div>
            <div className="mh-title">Trazabilidad completa</div>
            <div className="mh-sub">{order.patientName} · {order.id}{batch ? ` · ${batch.batchNumber}` : ''}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>

        <div className="hist-body">
          {/* Cadena compuesta (forward + reverse) */}
          <div className="trace-sec-lead"><Icon name="route" size={13} /> Cadena de genealogía</div>
          <TraceTree
            patientName={order.patientName} patientId={order.patientId}
            preparationId={order.id} batchNumber={batch?.batchNumber} components={components}
          />

          {/* Firmas y tiempos exactos */}
          <div className="trace-sec-lead" style={{ marginTop: 16 }}><Icon name="shield" size={13} /> Firmas y tiempos</div>
          <div className="sign-grid">
            <Sign k="Preparado por" who={instance?.preparedBy} at={instance?.completedAt ?? instance?.startedAt} />
            <Sign k="Verificado por" who={instance?.verifiedBy} at={instance?.verifiedAt} />
            <Sign k="Liberado por" who={instance?.releasedBy} at={instance?.releasedAt} />
          </div>
          {batch ? (
            <div className="trace-batch">
              <Icon name="shield" size={12} /> Lote de mezcla <b className="mono">{batch.batchNumber}</b> · v{batch.version} · {batch.createdBy} · {batch.createdAt}
              {batch.beyondUseAt ? <> · uso máx. {batch.beyondUseAt}</> : null}
              {batch.expirationAt ? <> · vence {batch.expirationAt}</> : null}
            </div>
          ) : null}

          {/* Historial append-only de lotes / componentes */}
          <div className="trace-sec-lead" style={{ marginTop: 16 }}><Icon name="clock" size={13} /> Historial de lotes y componentes</div>
          {audit.length === 0 ? (
            <div className="subtle" style={{ padding: '4px 2px' }}>Sin registros de lote todavía.</div>
          ) : (
            <div className="hist-list">
              {audit.map((a) => (
                <div className={`hist-entry ${a.action === 'correccion' ? 'warn' : 'info'}`} key={a.id}>
                  <span className="he-dot" />
                  <div className="he-main">
                    <div className="he-top">
                      <span className="he-title">{AUDIT_TITLE[a.action] ?? a.action} · {a.componentKey}</span>
                      <span className="he-when mono">{a.at}</span>
                    </div>
                    {a.fromLotId ? (
                      <div className="he-trans"><span className="he-prev mono">{a.fromLotId}</span> <Icon name="arrow" size={12} /> <b className="mono">{a.lotId}</b></div>
                    ) : <div className="he-detail">Lote <span className="mono">{a.lotId}</span>{a.quantity ? ` · ${a.quantity}` : ''}</div>}
                    {a.reason ? <div className="he-detail">Motivo: {a.reason}</div> : a.note ? <div className="he-detail">{a.note}</div> : null}
                    <div className="he-actor"><Icon name="users" size={11} /> {a.by}{a.byRole ? ` · ${a.byRole}` : ' · Central de Mezclas'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fu-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Genealogía nativa de Kumpels · append-only · fuente única (sin duplicar).</span>
          <button type="button" className="btn sm" onClick={onClose}>Cerrar</button>
        </div>
      </aside>
    </div>
  )
}
