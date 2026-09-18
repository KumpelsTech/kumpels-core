import { useOrderChangeStore } from '../../utils/orderChangeStore'
import { usePreparationStore } from '../../utils/preparationStore'
import { useAdministrationStore } from '../../utils/administrationStore'
import { impactFor } from '../../utils/downstreamImpact'
import { ORDER_CHANGE_LABEL } from '../../types/orderChange'
import { Icon } from '../Icon'

/**
 * Banner "Afectado por cambio de tratamiento" — muestra el impacto DETERMINISTA de
 * un cambio de orden sobre el trabajo aguas abajo (qué cambió, cuándo, actor,
 * acción requerida y responsable). No solo deshabilita: explica y enruta.
 */
export function ImpactBanner({ orderId }: { orderId?: string }) {
  useOrderChangeStore(); usePreparationStore(); useAdministrationStore()
  if (!orderId) return null
  const imp = impactFor(orderId)
  if (!imp || !imp.impacts.length) return null
  const { change, impacts } = imp
  return (
    <div className="impact-banner">
      <div className="ib-head"><Icon name="refresh" size={14} /> Afectado por cambio de tratamiento</div>
      <div className="ib-change">Orden <b>{ORDER_CHANGE_LABEL[change.changeType]}</b> · {change.reason} · {change.actorName} ({change.actorRole}) · <span className="mono">{change.at}</span></div>
      <div className="ib-impacts">
        {impacts.map((i, idx) => (
          <div className={`ib-imp ${i.tone}`} key={idx}>
            <span className="ibi-status">{i.statusLabel}</span>
            <span className="ibi-next"><Icon name="chevR" size={11} /> {i.requiredAction}</span>
            <span className="ibi-owner"><Icon name="users" size={11} /> {i.ownerLabel}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
