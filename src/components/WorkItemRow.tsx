import { useNavigate } from 'react-router-dom'
import type { WorkItem, WorkItemType } from '../types/work'
import { usePersona } from '../utils/personaStore'
import { hasCapability } from '../utils/eligibility'
import { acceptProductionRequest } from '../utils/productionActions'
import { PriorityBadge } from './Badge'
import { Icon, type IconName } from './Icon'

const TYPE_ICON: Record<WorkItemType, IconName> = {
  revision: 'stethoscope', seguimiento: 'refresh', pendiente: 'box', preparacion: 'drop', administracion: 'syringe', bloqueo: 'alert',
}

/** Fila de trabajo (WorkItem) para la página Hoy. Abre el workflow de origen. */
export function WorkItemRow({ item }: { item: WorkItem }) {
  const navigate = useNavigate()
  const { user, actor } = usePersona()
  const open = () => navigate(item.href)
  // Aceptación del handoff de producción (Central de Mezclas): acuse explícito.
  const canAccept = item.actionKey === 'aceptar-solicitud' && !!item.refId && !!user && hasCapability(user, 'PRODUCTION_REQUEST_ACCEPT')
  const accept = () => { if (item.refId && item.patientId) void acceptProductionRequest(item.refId, item.patientId, actor()) }
  return (
    <div className={`wi-row ${item.tone}`} onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
      <span className={`wi-ico ${item.tone}`}><Icon name={TYPE_ICON[item.type]} size={15} /></span>
      <div className="wi-main">
        <div className="wi-top">
          <span className="wi-name">{item.patientName}</span>
          {item.patientId ? <span className="pq-id mono">{item.patientId}</span> : null}
          {item.priority !== 'none' ? <PriorityBadge priority={item.priority} /> : null}
          {item.escalationState === 'escalated' ? <span className="esc-chip"><Icon name="alert" size={11} /> Escalado</span> : null}
        </div>
        <div className="wi-status">{item.statusLabel}</div>
        <div className="wi-meta">
          <span className="wi-src"><Icon name="spark" size={11} /> {item.source}</span>
          {item.owner ? <span className="wi-owner"><Icon name="users" size={11} /> {item.owner.label}</span> : null}
          {item.dueLabel ? <span className="wi-due"><Icon name="clock" size={11} /> {item.dueLabel}</span> : null}
        </div>
      </div>
      <div className="wi-next">
        <span className="lbl">Siguiente</span>
        <span className="val">{item.nextAction}</span>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {canAccept ? (
            <button type="button" className="btn sm primary" onClick={(e) => { e.stopPropagation(); accept() }}>
              <Icon name="check" size={12} /> Aceptar solicitud
            </button>
          ) : null}
          <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); open() }}>Abrir <Icon name="chevR" size={12} /></button>
        </div>
      </div>
    </div>
  )
}
