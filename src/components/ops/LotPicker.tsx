import { useEffect, useState } from 'react'
import { LOT_STATUS_LABEL, LOT_STATUS_VARIANT, useTraceabilityStore } from '../../utils/traceabilityStore'
import { Badge } from '../Badge'
import { Icon } from '../Icon'

/**
 * Selección de lote: solo lotes DISPONIBLES son seleccionables. Los lotes en otro
 * estado se muestran bloqueados con la razón (cuarentena/bloqueado/vencido/retirado).
 * Sugerencia determinística "Vence primero"; el usuario ve claramente qué elige.
 */
export function LotPicker({
  presentationId, presentationLabel, currentLotId, onPick, onClose,
}: {
  presentationId: string
  presentationLabel: string
  currentLotId?: string
  onPick: (lotId: string, reason?: string) => void
  onClose: () => void
}) {
  const { getSelectableLots, suggestLot } = useTraceabilityStore()
  const { disponibles, otros } = getSelectableLots(presentationId)
  const suggested = suggestLot(presentationId)
  const [reason, setReason] = useState('')
  const changing = !!currentLotId
  const pick = (lotId: string) => { if (lotId !== currentLotId) onPick(lotId, changing ? (reason.trim() || undefined) : undefined) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Seleccionar lote" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="box" size={16} /></span>
          <div>
            <div className="mh-title">Seleccionar lote</div>
            <div className="mh-sub">{presentationLabel}</div>
          </div>
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
        </div>
        <div className="modal-body">
          {changing ? (
            <div className="fu-field" style={{ marginBottom: 14 }}>
              <label>Motivo del cambio de lote <span className="fu-hint">· recomendado</span></label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="p. ej. Lote anterior en cuarentena" />
            </div>
          ) : null}
          <div className="lp-group">Disponibles</div>
          {disponibles.length === 0 ? <div className="subtle" style={{ padding: '4px 0 10px' }}>No hay lotes disponibles para esta presentación.</div> : null}
          {disponibles.map((l) => (
            <button type="button" key={l.id} className={`lp-lot ${currentLotId === l.id ? 'on' : ''}`} onClick={() => pick(l.id)}>
              <span className="lp-check">{currentLotId === l.id ? <Icon name="check" size={13} /> : null}</span>
              <div className="lp-main">
                <div className="lp-top">
                  <span className="lp-num mono">{l.manufacturerLot}</span>
                  {l.id === suggested ? <span className="lp-sug"><Icon name="clock" size={11} /> Vence primero</span> : null}
                </div>
                <div className="lp-meta">Vence {l.expiration}{l.location ? ` · ${l.location}` : ''}{l.availableQuantity != null ? ` · ${l.availableQuantity} ${l.unit}` : ''}</div>
              </div>
              <Badge variant="ok">Disponible</Badge>
            </button>
          ))}

          {otros.length ? (
            <>
              <div className="lp-group" style={{ marginTop: 14 }}>No seleccionables</div>
              {otros.map((l) => (
                <div key={l.id} className="lp-lot blocked" aria-disabled="true">
                  <span className="lp-check"><Icon name="shield" size={13} /></span>
                  <div className="lp-main">
                    <div className="lp-top"><span className="lp-num mono">{l.manufacturerLot}</span></div>
                    <div className="lp-meta">Vence {l.expiration} · No seleccionable ({LOT_STATUS_LABEL[l.status].toLowerCase()})</div>
                  </div>
                  <Badge variant={LOT_STATUS_VARIANT[l.status]}>{LOT_STATUS_LABEL[l.status]}</Badge>
                </div>
              ))}
            </>
          ) : null}
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Solo lotes disponibles. La selección queda registrada.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
