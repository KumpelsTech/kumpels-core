import { useNavigate } from 'react-router-dom'
import type { Patient } from '../types/patient'
import { PRIORITY_META } from '../utils/patient'
import { CategoryChip, PriorityBadge, Tag } from './Badge'
import { Icon } from './Icon'

/**
 * Fila de paciente reutilizable. Abre Patient 360 al hacer clic en la fila
 * o en "Abrir paciente". Usada por Pacientes y Revisión Clínica.
 */
export function PatientRow({ patient, ctaLabel = 'Abrir paciente', openOnTab }: { patient: Patient; ctaLabel?: string; openOnTab?: string }) {
  const navigate = useNavigate()
  const open = () => navigate(`/patients/${patient.id}${openOnTab ? `?tab=${openOnTab}` : ''}`)
  const stripe = PRIORITY_META[patient.priority].cls

  return (
    <div className="prow" onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
      <div className={`pstripe ${stripe}`} />
      <div className="pbody">
        <div className="ptop">
          <span className="pname">{patient.name}</span>
          <span className="pid mono">{patient.id}</span>
          <CategoryChip category={patient.category} />
          <PriorityBadge priority={patient.priority} />
        </div>
        <div className="preason">{patient.reason}</div>
        <div className="pmeta">
          <Tag icon="loc">{patient.facility}</Tag>
          <Tag icon="card">{patient.payer}</Tag>
          <Tag icon="drop">{patient.modality}</Tag>
          {patient.due && patient.dueKind ? (
            <span className={`pdue ${patient.dueKind}`}><Icon name="clock" size={13} /> {patient.due}</span>
          ) : null}
        </div>
      </div>
      <div className="pright">
        <div className="pnext">Siguiente<b>{patient.next}</b></div>
        <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); open() }}>
          {ctaLabel} <Icon name="chevR" size={12} />
        </button>
      </div>
    </div>
  )
}
