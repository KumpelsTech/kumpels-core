import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../types/patient'
import type { PrepStatus } from '../../types/preparation'
import { PREP_STATUS_LABEL, usePreparationStore } from '../../utils/preparationStore'
import { useReviewStore } from '../../utils/reviewStore'
import { useTraceabilityStore } from '../../utils/traceabilityStore'
import { Icon } from '../Icon'

const TONE: Record<PrepStatus, 'risk' | 'warn' | 'ok'> = {
  bloqueada: 'risk', 'pendiente-validacion': 'risk', lista: 'warn', 'en-preparacion': 'warn',
  'pendiente-verificacion': 'warn', verificada: 'warn', liberada: 'ok',
}

/**
 * Estado conciso de preparación estéril en Patient 360. NO duplica el flujo:
 * enlaza al workstream de Operaciones. Solo aparece si el paciente tiene orden.
 */
export function PreparationStatus({ patient }: { patient: Patient }) {
  const { getPatientPreparation } = usePreparationStore()
  const { principalLot } = useTraceabilityStore()
  useReviewStore()
  const navigate = useNavigate()
  const prep = getPatientPreparation(patient.id)
  if (!prep) return null

  const tone = TONE[prep.status]
  const lot = principalLot(prep.order.id)
  return (
    <div className={`prep-status ${tone}`}>
      <div className="ps-head">
        <span className="ps-ico"><Icon name="drop" size={15} /></span>
        <div>
          <div className="ps-title">Preparación estéril · <span className="mono">{prep.order.id}</span></div>
          <div className="ps-status">{PREP_STATUS_LABEL[prep.status]}</div>
        </div>
        <button type="button" className="btn sm" style={{ marginLeft: 'auto' }}
          onClick={() => navigate(`/medication-operations?ws=preparacion&prep=${prep.order.id}`)}>
          Ver trazabilidad <Icon name="chevR" size={12} />
        </button>
      </div>
      <div className="ps-meta">
        <span>{prep.order.medication}{prep.order.cycleDay ? ` · ${prep.order.cycleDay}` : ''}</span>
        {lot ? <span>Lote principal · <b className="mono">{lot.manufacturerLot}</b></span> : null}
        <span>Administración programada · <b>{prep.order.scheduledAt}</b></span>
      </div>
      {prep.blocker ? (
        <div className="ps-blk"><Icon name="alert" size={12} /> {prep.blocker.label}{prep.blocker.responsible ? ` · ${prep.blocker.responsible}` : ''}</div>
      ) : null}
    </div>
  )
}
