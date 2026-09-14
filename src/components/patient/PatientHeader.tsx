import type { Patient } from '../../types/patient'
import { initialsOf, showsCycle } from '../../utils/patient'
import { CategoryChip, PriorityBadge, Tag } from '../Badge'
import { Icon } from '../Icon'

/** Encabezado compacto de Patient 360. Muestra solo campos aplicables. */
export function PatientHeader({ patient }: { patient: Patient }) {
  return (
    <div className="p360-head">
      <div className="p360-top">
        <div className="p360-id">
          <div className="p360-av">{patient.initials}</div>
          <div>
            <div className="p360-name">{patient.name}</div>
            <div className="p360-line">
              <span className="mono">{patient.id}</span>
              {patient.dx ? (<><span className="dot-sep" />{patient.dx}</>) : null}
              {patient.protocol ? (<><span className="dot-sep" />Protocolo {patient.protocol}</>) : null}
              {showsCycle(patient) ? (<><span className="dot-sep" />Ciclo {patient.cycle}</>) : null}
            </div>
            <div className="p360-line">
              <Tag icon="loc">{patient.facility}</Tag>
              <Tag icon="card">{patient.payer}</Tag>
              <Tag icon="drop">{patient.modality} · {patient.med.split('(')[0].trim()}</Tag>
            </div>
          </div>
        </div>
        <div className="p360-badges">
          <PriorityBadge priority={patient.priority} />
          <CategoryChip category={patient.category} />
        </div>
      </div>
      <div className="p360-team">
        <div className="team-m">
          <div className="tm-lbl">Farmacéutica clínica</div>
          <div className="tm-name"><span className="team-av">{initialsOf(patient.team.pharm)}</span>{patient.team.pharm}</div>
        </div>
        <div className="team-m">
          <div className="tm-lbl">Oncología</div>
          <div className="tm-name"><span className="team-av">{initialsOf(patient.team.onc)}</span>{patient.team.onc}</div>
        </div>
        <div className="team-m">
          <div className="tm-lbl">Enfermería</div>
          <div className="tm-name"><span className="team-av"><Icon name="users" size={12} /></span>{patient.team.nurse}</div>
        </div>
      </div>
    </div>
  )
}
