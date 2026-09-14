import { useNavigate } from 'react-router-dom'
import type { WorkItem, WorkItemType } from '../types/work'
import { PriorityBadge } from './Badge'
import { Icon, type IconName } from './Icon'

const TYPE_ICON: Record<WorkItemType, IconName> = {
  revision: 'stethoscope', seguimiento: 'refresh', pendiente: 'box', preparacion: 'drop', administracion: 'syringe',
}

/** Fila de trabajo (WorkItem) para la página Hoy. Abre el workflow de origen. */
export function WorkItemRow({ item }: { item: WorkItem }) {
  const navigate = useNavigate()
  const open = () => navigate(item.href)
  return (
    <div className={`wi-row ${item.tone}`} onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
      <span className={`wi-ico ${item.tone}`}><Icon name={TYPE_ICON[item.type]} size={15} /></span>
      <div className="wi-main">
        <div className="wi-top">
          <span className="wi-name">{item.patientName}</span>
          {item.patientId ? <span className="pq-id mono">{item.patientId}</span> : null}
          {item.priority !== 'none' ? <PriorityBadge priority={item.priority} /> : null}
        </div>
        <div className="wi-status">{item.statusLabel}</div>
        <div className="wi-meta">
          <span className="wi-src"><Icon name="spark" size={11} /> {item.source}</span>
          {item.dueLabel ? <span className="wi-due"><Icon name="clock" size={11} /> {item.dueLabel}</span> : null}
        </div>
      </div>
      <div className="wi-next">
        <span className="lbl">Siguiente</span>
        <span className="val">{item.nextAction}</span>
        <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); open() }}>Abrir <Icon name="chevR" size={12} /></button>
      </div>
    </div>
  )
}
