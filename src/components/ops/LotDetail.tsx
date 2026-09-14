import { useNavigate } from 'react-router-dom'
import { LOT_STATUS_LABEL, LOT_STATUS_VARIANT, useTraceabilityStore } from '../../utils/traceabilityStore'
import { PREP_STATUS_LABEL, usePreparationStore } from '../../utils/preparationStore'
import { Badge } from '../Badge'
import { Icon } from '../Icon'

/**
 * Trazabilidad inversa (vista ligera): desde un lote, ver producto, vencimiento,
 * estado y en qué preparaciones/pacientes terminó. No es un panel de inventario.
 */
export function LotDetail({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const { getLotTrace } = useTraceabilityStore()
  const prep = usePreparationStore()
  const navigate = useNavigate()
  const trace = getLotTrace(lotId, (orderId) => PREP_STATUS_LABEL[prep.view(orderId).status])
  if (!trace) return null
  const { lot, presentation, entries } = trace

  return (
    <div className="lot-detail">
      <div className="ld-head">
        <div>
          <div className="ld-title">Lote <span className="mono">{lot.manufacturerLot}</span> <Badge variant={LOT_STATUS_VARIANT[lot.status]}>{LOT_STATUS_LABEL[lot.status]}</Badge></div>
          <div className="ld-sub">{presentation.product} · {presentation.presentation}</div>
        </div>
        <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}><span style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>
      </div>
      <div className="ld-facts">
        <div className="fact"><span className="fk">Presentación</span><span className="fv">{presentation.presentation}</span></div>
        <div className="fact"><span className="fk">Vencimiento</span><span className="fv">{lot.expiration}</span></div>
        <div className="fact"><span className="fk">Estado</span><span className="fv">{LOT_STATUS_LABEL[lot.status]}</span></div>
        {lot.location ? <div className="fact"><span className="fk">Ubicación</span><span className="fv">{lot.location}</span></div> : null}
      </div>
      <div className="ld-lead"><Icon name="route" size={13} /> Trazabilidad inversa · dónde terminó este lote</div>
      {entries.length === 0 ? (
        <div className="subtle" style={{ padding: '4px 2px' }}>Este lote aún no se ha usado ni seleccionado en preparaciones.</div>
      ) : (
        <div className="ld-list">
          {entries.map((e) => (
            <div key={e.orderId} className="ld-row" role="button" tabIndex={0}
              onClick={() => navigate(`/medication-operations?ws=preparacion&prep=${e.orderId}`)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') navigate(`/medication-operations?ws=preparacion&prep=${e.orderId}`) }}>
              <span className={`ld-dot ${e.used ? 'used' : 'sel'}`}><Icon name={e.used ? 'check' : 'clock'} size={11} /></span>
              <div className="ld-main">
                <div className="ld-r-top"><span className="ld-pat">{e.patientName}</span> <span className="pq-id mono">{e.orderId}</span></div>
                <div className="ld-r-sub">{e.used ? `Usado · ${e.quantity} · ${e.at}` : 'Seleccionado (aún no usado)'} · {e.prepStatusLabel}</div>
              </div>
              <Icon name="chevR" size={13} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
