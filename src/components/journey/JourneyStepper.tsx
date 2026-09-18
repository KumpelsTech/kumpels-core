import type { DerivedStage, StageStatus } from '../../types/journeyStage'
import { Icon } from '../Icon'

/**
 * Stepper HORIZONTAL del journey. Prioriza legibilidad (no decorativo). Los estados
 * se distinguen por ÍCONO + etiqueta + énfasis (no solo color). Rojo fuerte reservado
 * para bloqueos activos. En pantallas angostas hace scroll horizontal.
 */
const STATE: Record<StageStatus, { cls: string; mark: 'check' | 'dot' | 'ring' | 'bang' | 'dash' }> = {
  COMPLETED: { cls: 'done', mark: 'check' },
  ACTIVE: { cls: 'current', mark: 'dot' },
  BLOCKED: { cls: 'blocked', mark: 'bang' },
  PENDING: { cls: 'pending', mark: 'ring' },
  SKIPPED: { cls: 'skipped', mark: 'dash' },
  CANCELLED: { cls: 'skipped', mark: 'dash' },
}

export function JourneyStepper({ stages, size = 'md', highlightRole }: {
  stages: DerivedStage[]
  size?: 'sm' | 'md'
  /** Roles de etapa a resaltar (vista según persona). */
  highlightRole?: (stage: DerivedStage) => boolean
}) {
  return (
    <div className={`jstepper ${size}`} role="list" aria-label="Progreso del episodio">
      {stages.map((s) => {
        const st = STATE[s.status]
        const hl = highlightRole?.(s) ? 'hl' : ''
        return (
          <div key={s.id} role="listitem" className={`jstep ${st.cls} ${hl}`} title={`${s.label} · ${s.status}`}>
            <span className="jstep-rail" />
            <span className="jstep-dot">
              {st.mark === 'check' ? <Icon name="check" size={size === 'sm' ? 10 : 12} />
                : st.mark === 'bang' ? <b>!</b>
                  : st.mark === 'dot' ? <span className="jstep-fill" />
                    : st.mark === 'dash' ? <b>–</b> : null}
            </span>
            <span className="jstep-label">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
