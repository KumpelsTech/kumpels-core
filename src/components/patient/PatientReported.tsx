import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../types/patient'
import { useCommunicationStore, getReported } from '../../utils/communicationStore'
import { Icon } from '../Icon'

/**
 * Datos REPORTADOS POR EL PACIENTE (vía WhatsApp) que fluyen a Atención
 * Farmacéutica. NO son una segunda verdad clínica: son señales para REVISIÓN del
 * profesional. Se muestran con procedencia clara; el profesional decide qué
 * significan (no se convierten automáticamente en PRM/evento adverso).
 */
export function PatientReported({ patient }: { patient: Patient }) {
  const { attentionForPatient } = useCommunicationStore()
  const navigate = useNavigate()
  const signals = attentionForPatient(patient.id)
  if (!signals.length) return null

  return (
    <div className="ppr">
      {signals.map((s) => {
        const d = getReported(s.reportedDataId)
        return (
          <div className={`ppr-row ${s.severity === 'HIGH' ? 'high' : ''}`} key={s.id}>
            <span className="ppr-ico"><Icon name="msg" size={14} /></span>
            <div className="ppr-main">
              <div className="ppr-top">
                <span className="ppr-label">{s.label}</span>
                <span className="ppr-src">{s.sourceLabel} · {s.createdAt}</span>
              </div>
              {d ? <div className="ppr-quote">“{d.rawText}”</div> : null}
              {d ? <div className="ppr-interp">{d.interpretation} · pendiente de revisión profesional</div> : null}
            </div>
            <button type="button" className="btn sm" onClick={() => navigate(`/communications?patient=${patient.id}`)}>
              Ver conversación <Icon name="chevR" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
