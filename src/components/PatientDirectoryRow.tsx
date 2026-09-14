import { useNavigate } from 'react-router-dom'
import type { Patient } from '../types/patient'
import { PRIORITY_META, showsCycle } from '../utils/patient'
import { PriorityBadge } from './Badge'
import { Icon } from './Icon'

/** Resumen conciso del episodio activo (contexto longitudinal, sin timeline). */
function episodeSummary(p: Patient): string {
  const parts: string[] = [p.modality]
  if (p.protocol) parts.push(p.protocol)
  if (showsCycle(p)) parts.push(`Ciclo ${p.cycle}`)
  return parts.join(' · ')
}

/**
 * Fila del directorio de Pacientes. Compacta y escaneable: identidad +
 * contexto longitudinal + próxima acción. Abre Patient 360.
 */
export function PatientDirectoryRow({ patient }: { patient: Patient }) {
  const navigate = useNavigate()
  const open = () => navigate(`/patients/${patient.id}`)
  const stripe = PRIORITY_META[patient.priority].cls

  return (
    <div className="drow" onClick={open} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
      <div className={`dstripe ${stripe}`} />
      <div className="dmain">
        <div className="dtop">
          <span className="dname">{patient.name}</span>
          <span className="did mono">{patient.id}</span>
          {patient.priority !== 'MONITOR' ? <PriorityBadge priority={patient.priority} /> : null}
        </div>
        <div className="ddx">{patient.dx ?? 'Diagnóstico por documentar'}</div>
      </div>
      <div className="dctx">
        <span className="chip-line"><span className="cl-ico"><Icon name="pill" size={12} /></span>{episodeSummary(patient)}</span>
        <span className="dot-sep" />
        <span className="chip-line"><span className="cl-ico"><Icon name="loc" size={12} /></span>{patient.facility}</span>
        <span className="dot-sep" />
        <span className="chip-line"><span className="cl-ico"><Icon name="card" size={12} /></span>{patient.payer}</span>
      </div>
      <div className="dnext">
        <span className="lbl">Próxima acción</span>
        <span className="val">{patient.next} <span className="chev"><Icon name="chevR" size={12} /></span></span>
      </div>
    </div>
  )
}
