import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../../types/patient'
import type { Finding, ProfessionalReview } from '../../types/review'
import { deriveActiveAttention } from '../../utils/resumen'
import { useReviewStore } from '../../utils/reviewStore'
import { usePersona } from '../../utils/personaStore'
import { services } from '../../services'
import { COMM_LABEL, CONTINUITY_LABEL, useFulfillmentStore } from '../../utils/fulfillmentStore'
import { PriorityBadge } from '../Badge'
import { Icon } from '../Icon'
import { FindingCard } from './FindingCard'
import { ReviewModal } from './ReviewModal'

/**
 * Atención activa — superficie SOLO lo que requiere criterio profesional u
 * operativo ahora (hallazgos de revisión, excepciones, datos faltantes).
 * Reutiliza la corrida de validación de TASK 4; no muestra todos los resultados.
 */
export function ActiveAttention({ patient }: { patient: Patient }) {
  const items = deriveActiveAttention(patient)
  const { getReview, getReviewHistory } = useReviewStore()
  const { getPatientPending } = useFulfillmentStore()
  const { can, actor } = usePersona()
  const navigate = useNavigate()
  const [active, setActive] = useState<Finding | null>(null)

  const pending = getPatientPending(patient.id)
  const findings = items.filter((i) => i.kind === 'finding')
  const hasAny = items.length > 0 || !!pending

  const save = (finding: Finding, r: ProfessionalReview) => {
    void services.clinicalReview.recordDecision(finding.id, r, patient.id)
    setActive(null)
  }

  if (!hasAny) {
    return (
      <div className="calm">
        <span className="c-ico"><Icon name="check" size={16} /></span>
        Kumpels revisó el caso y no hay nada que requiera tu atención en este momento.
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {pending ? (
        <div className={`pending-block ${pending.continuity.risk !== 'sin-riesgo' ? 'risk' : ''}`}>
          <div className="pb-head">
            <span className="pb-ico"><Icon name="box" size={15} /></span>
            <span className="pb-title">Medicamento pendiente</span>
            <span className="pb-med">{pending.order.medication}</span>
            <button type="button" className="btn sm" style={{ marginLeft: 'auto' }}
              onClick={() => navigate(`/medication-operations?case=${pending.order.id}`)}>Ver pendiente <Icon name="chevR" size={12} /></button>
          </div>
          <div className="pb-grid">
            <div className="pb-cell"><span className="pk">Ordenado</span><span className="pv">{pending.ordered}</span></div>
            <div className="pb-cell"><span className="pk">Dispensado</span><span className="pv done">{pending.fulfilled}</span></div>
            <div className="pb-cell"><span className="pk">Pendiente</span><span className="pv rem">{pending.remaining}</span></div>
            <div className="pb-cell wide"><span className="pk">Disponibilidad estimada</span><span className="pv sm">{pending.expectedAvailability ?? 'Sin fecha'}</span></div>
            {pending.nextApplication ? <div className="pb-cell wide"><span className="pk">Próxima aplicación</span><span className="pv sm">{pending.nextApplication}</span></div> : null}
            <div className="pb-cell wide"><span className="pk">Continuidad</span><span className={`pv sm cont ${pending.continuity.risk}`}>{CONTINUITY_LABEL[pending.continuity.risk]}</span></div>
            <div className="pb-cell wide"><span className="pk">Paciente informado</span><span className="pv sm">{COMM_LABEL[pending.communication]}</span></div>
          </div>
          {pending.continuity.risk !== 'sin-riesgo' ? <div className="pb-explain"><Icon name="alert" size={12} /> {pending.continuity.explain}</div> : null}
        </div>
      ) : null}
      {items.map((item, i) => {
        if (item.kind === 'finding') {
          return <FindingCard key={item.finding.id} finding={item.finding} review={getReview(item.finding.id)} onReview={can('revisar') ? () => setActive(item.finding) : undefined} />
        }
        if (item.kind === 'exception') {
          return (
            <div key={item.id} className="exc-item">
              <span className="ei-ico"><Icon name="alert" size={16} /></span>
              <div className="ei-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <PriorityBadge priority={item.severity} />
                  <span className="ei-title">{item.domain}</span>
                </div>
                <div className="ei-txt">{item.text}</div>
              </div>
            </div>
          )
        }
        return (
          <div key={`gap-${i}`} className="gap-line">
            <Icon name="alert" size={14} />
            <span><b>{item.count}</b> dato{item.count > 1 ? 's' : ''} insuficiente{item.count > 1 ? 's' : ''} para completar la validación.</span>
          </div>
        )
      })}

      {findings.length > 0 ? (
        <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
          <Icon name="shield" size={12} /> La detección es automática; la confirmación y la decisión son profesionales.
        </div>
      ) : null}

      {active ? (
        <ReviewModal
          finding={active}
          existing={getReview(active.id)}
          history={getReviewHistory(active.id)}
          reviewer={actor()}
          onSave={(r) => save(active, r)}
          onClose={() => setActive(null)}
        />
      ) : null}
    </div>
  )
}
