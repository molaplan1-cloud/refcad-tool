const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Icon({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ display: 'block' }}>
      {children}
    </svg>
  )
}

const PATHS = {
  move: (
    <>
      <path d="M8 1.5v13M1.5 8h13" {...stroke} />
      <path d="M8 1.5 6.2 3.4M8 1.5 9.8 3.4M8 14.5 6.2 12.6M8 14.5 9.8 12.6M1.5 8 3.4 6.2M1.5 8 3.4 9.8M14.5 8 12.6 6.2M14.5 8 12.6 9.8" {...stroke} />
    </>
  ),
  copy: (
    <>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.2" {...stroke} />
      <path d="M11 5V3.2A1.2 1.2 0 0 0 9.8 2H3.2A1.2 1.2 0 0 0 2 3.2v6.6A1.2 1.2 0 0 0 3.2 11H5" {...stroke} />
    </>
  ),
  rotate: (
    <>
      <path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7" {...stroke} />
      <path d="M12.2 1.8v3.2H9" {...stroke} />
    </>
  ),
  rotate90: (
    <>
      <rect x="3.2" y="3.2" width="6.2" height="6.2" {...stroke} />
      <path d="M10.2 2.2A5 5 0 0 1 14 7.2" {...stroke} />
      <path d="M14 4.2v3h-3" {...stroke} />
    </>
  ),
  scale: (
    <>
      <path d="M3 13 13 3" {...stroke} />
      <path d="M8.5 3H13v4.5M3 7.5V13h4.5" {...stroke} />
    </>
  ),
  mirror: (
    <>
      <path d="M8 1.8v12.4" {...stroke} />
      <path d="M6.4 4.2 3 8l3.4 3.8zM9.6 4.2 13 8l-3.4 3.8z" {...stroke} />
    </>
  ),
  array: (
    <>
      <rect x="1.8" y="2" width="3.6" height="3.6" {...stroke} />
      <rect x="6.2" y="2" width="3.6" height="3.6" {...stroke} />
      <rect x="10.6" y="2" width="3.6" height="3.6" {...stroke} />
      <rect x="6.2" y="10.2" width="3.6" height="3.6" {...stroke} />
    </>
  ),
  offset: (
    <>
      <path d="M3 3.2h7.2A2.6 2.6 0 0 1 12.8 5.8V13" {...stroke} />
      <path d="M1.6 6.2h7.2a2.6 2.6 0 0 1 2.6 2.6v4" {...stroke} />
    </>
  ),
  stretch: (
    <>
      <path d="M2 8h12" {...stroke} />
      <path d="M4.2 5.6 1.8 8l2.4 2.4M11.8 5.6 14.2 8l-2.4 2.4" {...stroke} />
      <path d="M6.2 4.2v7.6M9.8 4.2v7.6" {...stroke} />
    </>
  ),
  align: (
    <>
      <path d="M2.2 2.2v11.6" {...stroke} />
      <rect x="4.2" y="3.2" width="5.2" height="2.6" {...stroke} />
      <rect x="4.2" y="7.2" width="8.4" height="2.6" {...stroke} />
      <rect x="4.2" y="11" width="3.4" height="2.2" {...stroke} />
    </>
  ),
  measure: (
    <>
      <path d="M2.2 11.2 11.2 2.2" {...stroke} />
      <path d="M2.2 8.4V11.2H5M8.6 2.2H11.2V4.8" {...stroke} />
    </>
  ),
  delete: (
    <>
      <path d="M3.2 4.4h9.6M6.2 4.4V3h3.6v1.4M4.4 4.4l.6 8.2h5.9l.6-8.2" {...stroke} />
    </>
  ),
  group: (
    <>
      <rect x="2" y="2" width="5" height="5" {...stroke} />
      <rect x="9" y="9" width="5" height="5" {...stroke} />
      <path d="M7 4.5h2.2V9H7" {...stroke} />
    </>
  ),
  ungroup: (
    <>
      <rect x="1.6" y="1.6" width="5" height="5" {...stroke} />
      <rect x="9.4" y="9.4" width="5" height="5" {...stroke} />
      <path d="M8.2 6.2 10.6 8.6" {...stroke} />
    </>
  ),
  lock: (
    <>
      <rect x="3.4" y="7" width="9.2" height="6.4" rx="1" {...stroke} />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" {...stroke} />
    </>
  ),
  unlock: (
    <>
      <rect x="3.4" y="7" width="9.2" height="6.4" rx="1" {...stroke} />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 4.4-1.8" {...stroke} />
    </>
  ),
  hide: (
    <>
      <path d="M2 8s2.2-3.4 6-3.4S14 8 14 8s-2.2 3.4-6 3.4S2 8 2 8z" {...stroke} />
      <path d="M3.2 3.2 12.8 12.8" {...stroke} />
    </>
  ),
  isolate: (
    <>
      <rect x="5" y="5" width="6" height="6" {...stroke} />
      <path d="M2 2h3.2M2 2v3.2M14 2h-3.2M14 2v3.2M2 14h3.2M2 14v-3.2M14 14h-3.2M14 14v-3.2" {...stroke} />
    </>
  ),
  show: (
    <>
      <path d="M1.8 8s2.3-3.6 6.2-3.6S14.2 8 14.2 8s-2.3 3.6-6.2 3.6S1.8 8 1.8 8z" {...stroke} />
      <circle cx="8" cy="8" r="1.7" {...stroke} />
    </>
  ),
  similar: (
    <>
      <rect x="2" y="2.2" width="5" height="5" {...stroke} />
      <rect x="9" y="8.8" width="5" height="5" {...stroke} />
      <path d="M8.2 4.6h2.2M9.3 3.5v2.2M4.6 9.2v2.2" {...stroke} />
    </>
  ),
  match: (
    <>
      <path d="M9.2 2.2 13.6 6.6 7.2 13.2H2.8V8.8z" {...stroke} />
      <path d="M8 3.6 12.2 7.8" {...stroke} />
    </>
  ),
}

export function CadIcon({ name }) {
  return <Icon>{PATHS[name] || PATHS.move}</Icon>
}
