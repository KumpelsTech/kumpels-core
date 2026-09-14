import type { Patient } from '../../types/patient'
import { deriveOperativeState } from '../../utils/resumen'
import { Icon } from '../Icon'

/** Estado operativo del paciente (solo lectura, dato existente). Sin workflows nuevos. */
export function OperationSection({ patient }: { patient: Patient }) {
  const ops = deriveOperativeState(patient)
  return (
    <div className="card info-card">
      {ops.map((it) => (
        <div className="op-row2" key={it.label}>
          <span className={`r-ico ${it.state}`}>
            <Icon name={it.state === 'ok' ? 'check' : it.state === 'warn' ? 'alert' : 'clock'} size={13} />
          </span>
          <span className="r-k">{it.label}</span>
          <span className={`r-v ${it.state === 'warn' ? 'warn' : ''}`}>{it.value}</span>
        </div>
      ))}
    </div>
  )
}
