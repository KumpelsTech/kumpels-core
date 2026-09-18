import { useEffect, useState } from 'react'
import type { Finding, ProfessionalReview, ReviewOutcome } from '../../types/review'
import type { ActorRef } from '../../types/actor'
import { now } from '../../utils/datetime'
import { Icon } from '../Icon'
import { HistoryDrawer, type HistoryEntry } from '../HistoryDrawer'

const OPTIONS: { value: ReviewOutcome; desc: string }[] = [
  { value: 'Confirmado', desc: 'El hallazgo es relevante y se confirma para gestión clínica.' },
  { value: 'Descartado', desc: 'Revisado; no requiere acción adicional.' },
  { value: 'Pendiente', desc: 'Requiere más información antes de decidir.' },
]

const TONE: Record<ReviewOutcome, HistoryEntry['tone']> = { Confirmado: 'warn', Descartado: 'ok', Pendiente: 'info' }

/**
 * Registro de decisión profesional sobre un hallazgo. NO es la intervención
 * completa: solo captura el juicio profesional (confirmar/descartar/pendiente).
 * Conserva historia: al editar, muestra la decisión previa y "Ver historial".
 */
export function ReviewModal({
  finding, existing, history = [], reviewer, onSave, onClose,
}: {
  finding: Finding
  existing?: ProfessionalReview
  history?: ProfessionalReview[]
  reviewer: ActorRef
  onSave: (review: ProfessionalReview) => void
  onClose: () => void
}) {
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(existing?.outcome ?? null)
  const [comment, setComment] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    if (!outcome) return
    const stamp = now()
    onSave({ outcome, comment: comment.trim() || undefined, by: reviewer.name, role: reviewer.role, at: stamp.label, atIso: stamp.iso })
  }

  const histEntries: HistoryEntry[] = history.map((r, i) => ({
    id: `rev-${i}`, when: r.at, title: r.outcome, detail: r.comment, actor: r.by, role: r.role,
    transition: r.previousOutcome ? { from: r.previousOutcome, to: r.outcome } : undefined,
    tone: TONE[r.outcome],
  })).reverse()

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Revisión profesional" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ico"><Icon name="stethoscope" size={17} /></span>
          <div>
            <div className="mh-title">Revisión profesional</div>
            <div className="mh-sub">{finding.domain} · decisión del profesional</div>
          </div>
          {history.length ? (
            <button type="button" className="link-mini" style={{ marginLeft: 'auto', marginRight: 8 }} onClick={() => setShowHistory(true)}>
              <Icon name="clock" size={12} /> Ver historial ({history.length})
            </button>
          ) : null}
          <button type="button" className="mh-close" aria-label="Cerrar" onClick={onClose}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
          </button>
        </div>
        <div className="modal-body">
          <div className="mb-context">
            <b>Hallazgo detectado.</b> {finding.trigger}<br />
            <b>Dato del paciente.</b> {finding.patientData}<br />
            <b>Criterio configurado.</b> {finding.criterion}
          </div>
          {existing ? (
            <div className="prev-decision">
              <Icon name="clock" size={12} /> Decisión vigente · <b>{existing.outcome}</b> · {existing.by}{existing.role ? ` (${existing.role})` : ''} · <span className="mono">{existing.at}</span>
              {existing.comment ? <div className="pd-note">{existing.comment}</div> : null}
              <div className="pd-hint">Registrar una decisión distinta conserva la anterior en el historial.</div>
            </div>
          ) : null}
          <div className="mb-lead"><Icon name="shield" size={13} /> Registrar decisión profesional</div>
          <div className="opt-row">
            {OPTIONS.map((o) => (
              <div key={o.value} className={`opt ${outcome === o.value ? 'on' : ''}`} onClick={() => setOutcome(o.value)}
                role="radio" aria-checked={outcome === o.value} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOutcome(o.value) } }}>
                <span className="opt-radio" />
                <div>
                  <div className="opt-name">{o.value}</div>
                  <div className="opt-desc">{o.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-comment">
            <label htmlFor="review-comment">Motivo / comentario {outcome === 'Confirmado' || outcome === 'Pendiente' ? '(recomendado)' : '(opcional)'}</label>
            <textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Breve nota que respalde la decisión…" />
          </div>
        </div>
        <div className="modal-foot">
          <span className="mf-note"><Icon name="shield" size={12} /> Decisión profesional. Kumpels no decide el tratamiento.</span>
          <button type="button" className="btn sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary sm" disabled={!outcome} onClick={save}
            style={!outcome ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {existing ? 'Actualizar decisión' : 'Guardar decisión'}
          </button>
        </div>
      </div>
      {showHistory ? (
        <HistoryDrawer title="Historial de decisiones" subtitle={`${finding.domain} · ${finding.id}`}
          icon="stethoscope" entries={histEntries} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  )
}
