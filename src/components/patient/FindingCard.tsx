import type { Finding, ProfessionalReview } from '../../types/review'
import { PriorityBadge } from '../Badge'
import { Icon } from '../Icon'

export function severityClass(f: Finding): string {
  if (f.severity === 'HIGH') return 'hi'
  if (f.severity === 'ACTION') return 'action'
  return 'monitor'
}

/**
 * Tarjeta de hallazgo (detección automática) + acceso a la decisión profesional.
 * Presentacional; la decisión se registra fuera vía el store de revisión.
 */
export function FindingCard({ finding, review, onReview }: { finding: Finding; review?: ProfessionalReview; onReview?: () => void }) {
  return (
    <div className={`fcard ${severityClass(finding)}`}>
      <div className="fc-head">
        <div className="fc-dom">
          {finding.severity ? <PriorityBadge priority={finding.severity} /> : null}
          <span className="fc-title">{finding.domain}</span>
        </div>
      </div>
      <div className="fc-grid">
        <div className="fc-cell trig full">
          <div className="lbl"><Icon name="alert" size={11} /> Motivo / trigger</div>
          <div className="txt">{finding.trigger}</div>
        </div>
        <div className="fc-cell data">
          <div className="lbl"><Icon name="drop" size={11} /> Dato del paciente</div>
          <div className="txt">{finding.patientData}</div>
        </div>
        <div className="fc-cell">
          <div className="lbl"><Icon name="shield" size={11} /> Criterio configurado</div>
          <div className="txt">{finding.criterion}</div>
        </div>
        <div className="fc-cell full">
          <div className="lbl"><Icon name="doc" size={11} /> Fuente / regla</div>
          <div className="txt">{finding.source}</div>
        </div>
      </div>
      <div className="fc-foot">
        <span className="status-txt"><Icon name="shield" size={13} /> {finding.status}</span>
        {review ? <span className={`outcome ${review.outcome}`}><Icon name="check" size={12} /> {review.outcome}</span> : null}
        {onReview ? (
          <button type="button" className={`btn sm ${review ? '' : 'primary'}`} onClick={onReview}>
            {review ? 'Editar revisión' : 'Revisar'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
