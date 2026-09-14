import type { JourneyStage } from '../types/patient'
import { Icon } from './Icon'

/**
 * Timeline horizontal reutilizable del journey de tratamiento.
 * Estados: done · current · warning · blocked · upcoming.
 */
export function JourneyTimeline({ stages }: { stages: JourneyStage[] }) {
  return (
    <div className="journey">
      {stages.map((s, i) => (
        <div key={`${s.label}-${i}`} className={`jstage ${s.state === 'upcoming' ? '' : s.state}`}>
          <span className={`jline ${s.state === 'done' ? 'done' : ''}`} />
          <span className="jdot">{s.state === 'done' ? <Icon name="check" size={12} /> : ''}</span>
          <span className="jlabel">{s.label}</span>
          {s.sub ? <span className="jsub">{s.sub}</span> : null}
        </div>
      ))}
    </div>
  )
}
