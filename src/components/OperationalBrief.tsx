import { useState } from 'react'
import { Icon } from './Icon'
import type { BriefStatement } from '../utils/hoyView'

/**
 * OperationalBrief — resumen operativo con lenguaje visual Kumpels AI (UX-04).
 * SOLO resume datos deterministas ya existentes (conteos/horas/demoras). No
 * genera recomendaciones clínicas ni prioridades. Cada enunciado es trazable
 * ("Ver por qué" revela los pacientes que lo respaldan).
 */
export function OperationalBrief({ statements }: { statements: BriefStatement[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!statements.length) return null
  return (
    <section className="op-brief ai-surface" aria-label="Resumen operativo Kumpels AI">
      <div className="ob-head">
        <span className="ai-label"><Icon name="spark" size={13} className="ai-ico" /> Kumpels AI</span>
        <span className="ob-note">Resumen de datos operativos · no es una decisión clínica</span>
      </div>
      <ul className="ob-list">
        {statements.map((s) => (
          <li key={s.id} className={`ob-item ${s.tone}`}>
            <span className="ob-dot" aria-hidden="true" />
            <div className="ob-body">
              <span className="ob-text">{s.text}</span>
              {s.evidence.length ? (
                <button type="button" className="ob-why" aria-expanded={openId === s.id}
                  onClick={() => setOpenId((c) => (c === s.id ? null : s.id))}>
                  {openId === s.id ? 'Ocultar' : 'Ver por qué'}
                </button>
              ) : null}
              {openId === s.id ? (
                <div className="ob-evidence">{s.evidence.join(' · ')}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
