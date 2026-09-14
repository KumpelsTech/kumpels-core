import type { JSX } from 'react'

export type IconName =
  | 'home' | 'users' | 'route' | 'pill' | 'stethoscope' | 'check' | 'box' | 'chart' | 'gear' | 'msg'
  | 'search' | 'bell' | 'spark' | 'arrow' | 'chevR' | 'clock' | 'alert' | 'shield' | 'loc' | 'card'
  | 'drop' | 'refresh' | 'syringe' | 'calendar' | 'doc' | 'phone'

const paths: Record<IconName, JSX.Element> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 5.2A3 3 0 0 1 16 11" /><path d="M17 14.6c2.3.5 3.8 2.4 3.8 5" /></>,
  route: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.4 6H14a3.5 3.5 0 0 1 0 7H9.5a3.5 3.5 0 0 0 0 7h6.1" /></>,
  pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(45 12 12)" /><path d="M8.5 8.5 15.5 15.5" /></>,
  stethoscope: <><path d="M5 3v5a4 4 0 0 0 8 0V3" /><path d="M9 15a5 5 0 0 0 10 0v-2" /><circle cx="19" cy="10" r="2.2" /></>,
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  chart: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="12" width="3" height="5" /><rect x="12" y="8" width="3" height="9" /><rect x="17" y="5" width="3" height="12" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  msg: <path d="M4 5h16v11H8l-4 4z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  spark: <><path d="M12 3l1.6 4.8L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.2z" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17.5v.5" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  loc: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
  drop: <path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" /></>,
  syringe: <><path d="M18 3l3 3M17 4l3 3-8.5 8.5L8 16l-1-3z" /><path d="M11 9l4 4M4 20l4-4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9h17M8 3v4M16 3v4" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
