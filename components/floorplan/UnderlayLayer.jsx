'use client'

function band(a, b, thickness, X, Y) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz) || 1
  const nx = (-dz / len) * thickness / 2
  const nz = (dx / len) * thickness / 2
  const p = (point, sx, sz) => `${X(point.x + sx)},${Y(point.z + sz)}`
  return `${p(a, nx, nz)} ${p(b, nx, nz)} ${p(b, -nx, -nz)} ${p(a, -nx, -nz)}`
}

export function UnderlayDrawing({ underlay, X, Y, scale, picks = [], picking = false, onSuggestion }) {
  if (!underlay?.image || underlay.visible === false) return null
  const w = Math.max(1, underlay.widthM * scale)
  const h = Math.max(1, underlay.heightM * scale)
  return (
    <g data-testid="underlay-layer">
      <g transform={`translate(${X(underlay.x)} ${Y(underlay.z)}) rotate(${underlay.rotation || 0})`}>
        <image
          data-testid="underlay-image"
          href={underlay.image}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          opacity={underlay.opacity ?? 0.55}
          style={{ pointerEvents: 'none' }}
        />
        {underlay.snapLines && (underlay.lines || []).map((line, index) => (
          <line
            key={`trace-${index}`}
            data-testid="underlay-line"
            x1={(line.u1 - 0.5) * w}
            y1={(line.v1 - 0.5) * h}
            x2={(line.u2 - 0.5) * w}
            y2={(line.v2 - 0.5) * h}
            stroke="#0f766e"
            strokeWidth={1.2}
            strokeDasharray="5 3"
            opacity={0.85}
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </g>
      {(underlay.suggestions || []).map((item) => {
        if (item.kind === 'opening') {
          return (
            <g key={item.id} data-testid="underlay-suggestion" data-kind="opening" data-selected={item.selected ? '1' : '0'} style={{ cursor: picking ? 'crosshair' : 'pointer', pointerEvents: picking ? 'none' : 'auto' }} onPointerDown={(event) => { event.stopPropagation(); onSuggestion?.(item.id) }}>
              <circle cx={X(item.at.x)} cy={Y(item.at.z)} r={7} fill={item.selected ? '#f59e0b' : '#fff'} stroke="#b45309" strokeWidth={1.4} />
            </g>
          )
        }
        return (
          <polygon
            key={item.id}
            data-testid="underlay-suggestion"
            data-kind="wall"
            data-selected={item.selected ? '1' : '0'}
            points={band(item.a, item.b, item.thickness || 0.12, X, Y)}
            fill={item.selected ? 'rgba(15,118,110,0.28)' : 'rgba(120,113,108,0.16)'}
            stroke={item.selected ? '#0f766e' : '#78716c'}
            strokeWidth={1.3}
            strokeDasharray="7 4"
            style={{ cursor: picking ? 'crosshair' : 'pointer', pointerEvents: picking ? 'none' : 'auto' }}
            onPointerDown={(event) => { event.stopPropagation(); onSuggestion?.(item.id) }}
          />
        )
      })}
      {picks.length > 0 && picks.map((point, index) => (
        <circle key={`pick-${index}`} data-testid="underlay-pick" cx={X(point.x)} cy={Y(point.z)} r={5} fill="#fff" stroke="#b45309" strokeWidth={1.6} />
      ))}
      {picks.length === 2 && (
        <line data-testid="underlay-calibration" x1={X(picks[0].x)} y1={Y(picks[0].z)} x2={X(picks[1].x)} y2={Y(picks[1].z)} stroke="#b45309" strokeWidth={1.4} />
      )}
    </g>
  )
}
