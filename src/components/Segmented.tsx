/**
 * Control SEGMENTADO (radio compacto) — alternativa a dropdowns grandes cuando
 * el conjunto de opciones es pequeño. Reutilizable por modales y drawers.
 */
export interface SegOption<T extends string> { value: T; label: string }

export function Segmented<T extends string>({
  value, options, onChange, ariaLabel, size = 'md',
}: {
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`seg ${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg-opt ${value === o.value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
