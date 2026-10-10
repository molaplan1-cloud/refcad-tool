'use client'

import { useId } from 'react'

// Plan symbols in Finnish architectural style: thin even lines, white fill, the wall side at the top.

function useInk(color) {
  const stroke = color || '#1c1917'
  const sw = 1.05
  const paper = { fill: '#fff', stroke, strokeWidth: sw, strokeLinejoin: 'miter', strokeLinecap: 'butt' }
  const line = { fill: 'none', stroke, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' }
  return { stroke, sw, paper, line }
}

export function FixtureSymbol({ symbol, w, d, color, flues = 1, stand = false }) {
  const clipId = `hatch${useId().replace(/:/g, '')}`
  const { stroke, sw, paper, line } = useInk(color)
  const left = -w / 2
  const top = -d / 2
  const mark = symbol || 'cabinet'

  if (mark === 'toilet' || mark === 'toilet-wall') {
    const tank = mark === 'toilet-wall' ? 0.12 : 0.26
    return (
      <g>
        <rect x={-w * 0.32} y={top} width={w * 0.64} height={d * tank} rx={1.5} {...paper} />
        <ellipse cx={0} cy={top + d * (tank + 0.34)} rx={w * 0.38} ry={d * 0.3} {...paper} />
        <ellipse cx={0} cy={top + d * (tank + 0.36)} rx={w * 0.2} ry={d * 0.16} {...line} />
      </g>
    )
  }
  if (mark === 'bidet') {
    return (
      <g>
        <path d={`M ${-w * 0.28} ${top + d * 0.12} Q 0 ${top - d * 0.02} ${w * 0.28} ${top + d * 0.12} L ${w * 0.34} ${top + d * 0.72} Q 0 ${top + d * 0.98} ${-w * 0.34} ${top + d * 0.72} Z`} {...paper} />
        <ellipse cx={0} cy={top + d * 0.48} rx={w * 0.16} ry={d * 0.16} {...line} />
      </g>
    )
  }
  if (mark === 'spray') {
    return (
      <g {...line}>
        <rect x={left} y={top} width={w} height={d * 0.45} {...paper} />
        <path d={`M 0 ${top + d * 0.45} q ${w * 0.35} ${d * 0.2} 0 ${d * 0.5}`} />
        <circle cx={0} cy={top + d * 0.2} r={Math.min(w, d) * 0.12} fill={stroke} />
      </g>
    )
  }
  if (mark === 'basin') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <ellipse cx={0} cy={d * 0.02} rx={w * 0.3} ry={d * 0.3} {...line} />
        <line x1={0} y1={top + d * 0.08} x2={0} y2={top + d * 0.28} {...line} />
        <line x1={-w * 0.08} y1={top + d * 0.16} x2={w * 0.08} y2={top + d * 0.16} {...line} />
      </g>
    )
  }
  if (mark === 'sink' || mark === 'sink-double' || mark === 'laundry-sink') {
    const bowls = mark === 'sink-double' ? [-0.22, 0.22] : [0]
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {bowls.map((cx) => (
          <rect key={cx} x={w * cx - w * 0.16} y={-d * 0.22} width={w * 0.32} height={d * 0.48} rx={Math.min(w, d) * 0.06} {...line} />
        ))}
        <line x1={-w * 0.08} y1={top + 3} x2={w * 0.08} y2={top + 3} {...line} />
        {mark === 'laundry-sink' && <line x1={left + 3} y1={d * 0.22} x2={w / 2 - 3} y2={d * 0.22} {...line} />}
      </g>
    )
  }
  if (mark === 'vanity') {
    const doors = w > 70 ? 2 : 1
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <ellipse cx={0} cy={-d * 0.08} rx={w * 0.22} ry={d * 0.24} {...line} />
        <line x1={left} y1={d * 0.18} x2={w / 2} y2={d * 0.18} {...line} />
        {Array.from({ length: doors }, (_, index) => (
          <line key={index} x1={left + (w / doors) * (index + 1)} y1={d * 0.18} x2={left + (w / doors) * (index + 1)} y2={d / 2} {...line} />
        ))}
      </g>
    )
  }
  if (mark === 'mirror' || mark === 'mirror-cab') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <rect x={left + 2} y={top + 2} width={Math.max(1, w - 4)} height={Math.max(1, d - 4)} {...line} />
        {mark === 'mirror-cab' && <line x1={0} y1={top + 2} x2={0} y2={d / 2 - 2} {...line} />}
      </g>
    )
  }
  if (mark === 'paper') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d * 0.35} {...paper} />
        <ellipse cx={0} cy={d * 0.12} rx={w * 0.28} ry={d * 0.28} {...line} />
      </g>
    )
  }
  if (mark === 'hooks') {
    return (
      <g {...line}>
        <line x1={left} y1={top + d * 0.3} x2={w / 2} y2={top + d * 0.3} />
        {[-0.28, 0, 0.28].map((t) => (
          <path key={t} d={`M ${w * t} ${top + d * 0.3} v ${d * 0.25} q ${w * 0.08} ${d * 0.15} 0 ${d * 0.28}`} />
        ))}
      </g>
    )
  }
  if (mark === 'drain') {
    const r = Math.min(w, d) * 0.38
    return (
      <g {...line}>
        <circle r={r} {...paper} />
        <circle r={r * 0.45} />
        <line x1={-r} y1={0} x2={r} y2={0} />
        <line x1={0} y1={-r} x2={0} y2={r} />
      </g>
    )
  }
  if (mark === 'cabinet' || mark === 'base-cab' || mark === 'clean-cab') {
    const doors = w > 55 ? 2 : 1
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {Array.from({ length: doors }, (_, index) => (
          <g key={index}>
            <line x1={left + (w / doors) * index} y1={top} x2={left + (w / doors) * index} y2={d / 2} {...line} />
            <path d={`M ${left + (w / doors) * index + 2} ${top + 2} q ${(w / doors) * 0.7} ${d * 0.35} 0 ${d * 0.7}`} {...line} />
          </g>
        ))}
      </g>
    )
  }
  if (mark === 'wall-cab') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} fill="#fff" stroke={stroke} strokeWidth={sw} strokeDasharray="3 1.5" />
        <line x1={0} y1={top} x2={0} y2={d / 2} stroke={stroke} strokeWidth={sw} strokeDasharray="3 1.5" />
      </g>
    )
  }
  if (mark === 'washer' || mark === 'dryer' || mark === 'dishwasher') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <line x1={left} y1={top + d * 0.16} x2={w / 2} y2={top + d * 0.16} {...line} />
        <circle cx={0} cy={d * 0.06} r={Math.min(w, d) * 0.26} {...line} />
        <circle cx={0} cy={d * 0.06} r={Math.min(w, d) * 0.08} {...line} />
        {mark === 'dryer' && <path d={`M ${-w * 0.12} ${d * 0.02} q ${w * 0.12} ${-d * 0.08} ${w * 0.22} 0`} {...line} />}
      </g>
    )
  }
  if (mark === 'stack' || mark === 'dry-cab') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <line x1={left} y1={0} x2={w / 2} y2={0} {...line} />
        <circle cx={0} cy={-d * 0.24} r={Math.min(w, d) * 0.16} {...line} />
        <circle cx={0} cy={d * 0.24} r={Math.min(w, d) * 0.16} {...line} />
      </g>
    )
  }
  if (mark === 'shower' || mark === 'shower-cabin' || mark === 'shower-corner' || mark === 'shower-walk' || mark === 'shower-screen') {
    const glass = { fill: 'none', stroke, strokeWidth: sw * 1.15 }
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} fill="#f8fafc" stroke={stroke} strokeWidth={sw * 0.7} />
        <circle cx={w * 0.22} cy={-d * 0.18} r={Math.min(w, d) * 0.07} {...line} />
        <line x1={w * 0.22} y1={top + 2} x2={w * 0.22} y2={-d * 0.18} {...line} />
        {(mark === 'shower' || mark === 'shower-screen' || mark === 'shower-walk') && (
          <line x1={mark === 'shower-walk' ? left + w * 0.15 : left} y1={top} x2={mark === 'shower-walk' ? left + w * 0.15 : left} y2={d / 2} {...glass} />
        )}
        {mark === 'shower-cabin' && <rect x={left + 1.5} y={top + 1.5} width={w - 3} height={d - 3} {...glass} />}
        {mark === 'shower-corner' && <path d={`M ${left} ${d / 2} L ${left} ${top} L ${w / 2} ${top}`} {...glass} />}
        {mark === 'shower-screen' && <line x1={w * 0.15} y1={top} x2={w * 0.15} y2={d * 0.45} {...glass} />}
      </g>
    )
  }
  if (mark === 'bath' || mark === 'spa') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} rx={Math.min(w, d) * 0.28} {...paper} />
        <rect x={left + w * 0.06} y={top + d * 0.1} width={w * 0.88} height={d * 0.8} rx={Math.min(w, d) * 0.22} {...line} />
        <circle cx={-w * 0.32} cy={-d * 0.18} r={Math.min(w, d) * 0.05} {...line} />
        {mark === 'spa' && [-0.1, 0.15, 0.32].map((t) => <circle key={t} cx={w * t} cy={d * 0.05} r={Math.min(w, d) * 0.035} {...line} />)}
      </g>
    )
  }
  if (mark === 'soap' || mark === 'rail' || mark === 'towel-rad') {
    return (
      <g {...line}>
        <line x1={left} y1={0} x2={w / 2} y2={0} />
        {mark === 'towel-rad' && [-0.28, -0.1, 0.08, 0.26].map((t) => <line key={t} x1={w * t} y1={-d * 0.35} x2={w * t} y2={d * 0.35} />)}
        {mark === 'soap' && <rect x={-w * 0.28} y={-d * 0.2} width={w * 0.56} height={d * 0.55} {...paper} />}
      </g>
    )
  }
  if (mark === 'bench') {
    return (
      <g>
        <rect x={left} y={top + d * 0.15} width={w} height={d * 0.7} rx={2} {...paper} />
        <line x1={left + 2} y1={top + d * 0.15} x2={left + 2} y2={d / 2} {...line} />
        <line x1={w / 2 - 2} y1={top + d * 0.15} x2={w / 2 - 2} y2={d / 2} {...line} />
      </g>
    )
  }
  if (mark === 'litter' || mark === 'basket') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} rx={mark === 'basket' ? 4 : 1} {...paper} />
        {mark === 'litter' && <ellipse cx={0} cy={0} rx={w * 0.28} ry={d * 0.22} {...line} />}
        {mark === 'basket' && <path d={`M ${left + 2} ${-d * 0.1} Q 0 ${d * 0.35} ${w / 2 - 2} ${-d * 0.1}`} {...line} />}
      </g>
    )
  }
  if (mark === 'heater' || mark === 'heater-wood') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <circle cx={0} cy={0} r={Math.min(w, d) * 0.28} {...line} />
        {[-0.12, 0.02, 0.14].map((t, index) => <circle key={t} cx={w * (index - 1) * 0.16} cy={d * t} r={Math.min(w, d) * 0.07} {...line} />)}
        {mark === 'heater-wood' && <line x1={left + w * 0.2} y1={top + d * 0.22} x2={w / 2 - w * 0.2} y2={top + d * 0.22} {...line} />}
      </g>
    )
  }
  if (mark === 'chimney' || mark === 'chimney-masonry' || mark === 'chimney-element' || mark === 'chimney-steel') {
    const kind = mark === 'chimney-element' ? 'element' : mark === 'chimney-steel' ? 'steel' : 'masonry'
    const count = flues >= 2 ? 2 : 1
    if (kind === 'steel') {
      const spots = count === 2 ? [-w * 0.25, w * 0.25] : [0]
      const radius = count === 2 ? Math.min(w * 0.22, d * 0.42) : Math.min(w, d) * 0.46
      return (
        <g>
          {spots.map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={0} r={radius} {...paper} />
              <circle cx={cx} cy={0} r={radius * 0.58} {...line} />
            </g>
          ))}
        </g>
      )
    }
    const span = w + d
    const step = 4
    const diagonals = []
    for (let i = 0; i <= span; i += step) diagonals.push(i)
    const flueW = count === 2 ? w * 0.22 : Math.min(w, d) * 0.34
    const flueH = count === 2 ? d * 0.34 : Math.min(w, d) * 0.34
    const flueX = count === 2 ? [-w * 0.24, w * 0.24] : [0]
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={left + 0.8} y={top + 0.8} width={Math.max(1, w - 1.6)} height={Math.max(1, d - 1.6)} />
          </clipPath>
        </defs>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <g clipPath={`url(#${clipId})`} stroke={stroke} strokeWidth={kind === 'element' ? 0.45 : 0.7} opacity={kind === 'element' ? 0.55 : 0.9}>
          {diagonals.map((i) => <line key={`d${i}`} x1={left + i} y1={top} x2={left + i - d} y2={top + d} />)}
          {kind === 'element' && diagonals.map((i) => <line key={`c${i}`} x1={left + i - d} y1={top} x2={left + i} y2={top + d} />)}
        </g>
        {flueX.map((cx) => (kind === 'element'
          ? <circle key={cx} cx={cx} cy={0} r={Math.min(flueW, flueH) * 0.7} fill="#fff" stroke={stroke} strokeWidth={sw} />
          : <rect key={cx} x={cx - flueW / 2} y={-flueH / 2} width={flueW} height={flueH} fill="#fff" stroke={stroke} strokeWidth={sw} />))}
      </g>
    )
  }
  if (mark === 'sauna-bench' || mark === 'sauna-bench-3') {
    const steps = mark === 'sauna-bench-3' ? 3 : 2
    return (
      <g>
        {Array.from({ length: steps }, (_, index) => (
          <rect key={index} x={left} y={top + (d / steps) * index} width={w} height={d / steps - 1.5} {...paper} />
        ))}
      </g>
    )
  }
  if (mark === 'sauna-door') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <line x1={left + w * 0.72} y1={top} x2={left + w * 0.72} y2={d / 2} {...line} />
        <circle cx={w * 0.28} cy={0} r={1.3} fill={stroke} />
      </g>
    )
  }
  if (mark === 'bucket') {
    return <ellipse cx={0} cy={0} rx={w * 0.42} ry={d * 0.42} {...paper} />
  }
  if (mark === 'hob') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {[[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x * w} cy={y * d} r={Math.min(w, d) * 0.13} {...line} />
        ))}
      </g>
    )
  }
  if (mark === 'oven' || mark === 'micro') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <rect x={left + w * 0.12} y={top + d * 0.16} width={w * 0.76} height={d * 0.62} {...line} />
        <line x1={left} y1={top + d * 0.12} x2={w / 2} y2={top + d * 0.12} {...line} />
      </g>
    )
  }
  if (mark === 'hood') {
    return (
      <g>
        <path d={`M ${-w * 0.46} ${top + d * 0.08} H ${w * 0.46} L ${w * 0.3} ${top + d * 0.72} H ${-w * 0.3} Z`} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="3 1.6" />
      </g>
    )
  }
  if (mark === 'fridge' || mark === 'freezer' || mark === 'fridge-freezer') {
    const split = mark === 'freezer' ? 0.72 : mark === 'fridge-freezer' ? 0.58 : 0.28
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <line x1={left} y1={top + d * split} x2={w / 2} y2={top + d * split} {...line} />
        <line x1={w * 0.32} y1={top + d * 0.08} x2={w * 0.32} y2={top + d * split - 2} {...line} />
      </g>
    )
  }
  if (mark === 'island') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <rect x={left + w * 0.08} y={top + d * 0.12} width={w * 0.84} height={d * 0.76} {...line} />
      </g>
    )
  }
  if (mark === 'table' || mark === 'coffee' || mark === 'desk') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} rx={mark === 'coffee' ? 2 : 0} {...paper} />
        {mark !== 'coffee' && <rect x={-w * 0.36} y={-d * 0.28} width={w * 0.72} height={d * 0.56} {...line} />}
      </g>
    )
  }
  if (mark === 'chair' || mark === 'office-chair' || mark === 'armchair') {
    return (
      <g>
        {mark === 'office-chair' ? (
          <circle r={Math.min(w, d) * 0.34} {...paper} />
        ) : (
          <rect x={mark === 'armchair' ? left + w * 0.08 : left} y={-d * 0.08} width={mark === 'armchair' ? w * 0.84 : w} height={d * 0.55} rx={2} {...paper} />
        )}
        <path d={`M ${-w * 0.38} ${top + d * 0.08} Q 0 ${top - d * 0.08} ${w * 0.38} ${top + d * 0.08}`} {...line} />
        <line x1={-w * 0.38} y1={top} x2={-w * 0.38} y2={top + d * 0.22} {...line} />
        <line x1={w * 0.38} y1={top} x2={w * 0.38} y2={top + d * 0.22} {...line} />
        {mark === 'armchair' && (
          <>
            <line x1={left} y1={-d * 0.05} x2={left} y2={d * 0.35} {...line} />
            <line x1={w / 2} y1={-d * 0.05} x2={w / 2} y2={d * 0.35} {...line} />
          </>
        )}
      </g>
    )
  }
  if (mark === 'sofa' || mark === 'divan') {
    const seats = Math.max(2, Math.round(w / 28))
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} rx={3} {...paper} />
        <line x1={left + w * 0.08} y1={top + d * 0.28} x2={w / 2 - w * 0.08} y2={top + d * 0.28} {...line} />
        {Array.from({ length: seats - 1 }, (_, index) => (
          <line key={index} x1={left + (w / seats) * (index + 1)} y1={top + d * 0.32} x2={left + (w / seats) * (index + 1)} y2={d / 2 - 2} {...line} />
        ))}
        <line x1={left + 2} y1={top + 2} x2={left + 2} y2={d / 2 - 2} {...line} />
        <line x1={w / 2 - 2} y1={top + 2} x2={w / 2 - 2} y2={d / 2 - 2} {...line} />
      </g>
    )
  }
  if (mark === 'sofa-corner') {
    return (
      <g>
        <path d={`M ${left} ${top} H ${w / 2} V ${top + d * 0.42} H ${left + w * 0.42} V ${d / 2} H ${left} Z`} {...paper} />
        <path d={`M ${left + w * 0.1} ${top + d * 0.16} H ${w / 2 - 2} M ${left + w * 0.16} ${top + d * 0.5} V ${d / 2 - 2}`} {...line} />
      </g>
    )
  }
  if (mark === 'tv') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <rect x={left + 2} y={top + 1.5} width={Math.max(2, w - 4)} height={Math.max(2, d - 3)} {...line} />
      </g>
    )
  }
  if (mark === 'wall-tv') {
    const panel = stand ? Math.min(Math.max(d, 4), 8) : Math.max(d, 4)
    const bulge = 9
    return (
      <g data-symbol="wall-tv">
        {stand && <rect x={left} y={top} width={w} height={d} {...paper} />}
        <rect x={left} y={top} width={w} height={panel} {...paper} />
        <line x1={left + 3} y1={top + panel - 1.5} x2={w / 2 - 3} y2={top + panel - 1.5} stroke={stroke} strokeWidth={Math.max(sw, 1.5)} />
        <path d={`M ${-w * 0.22} ${top + panel} Q 0 ${top + panel + bulge} ${w * 0.22} ${top + panel}`} {...line} />
      </g>
    )
  }
  if (mark === 'tvstand' || mark === 'dresser' || mark === 'night' || mark === 'low') {
    const rows = mark === 'night' ? 1 : 2
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {Array.from({ length: rows }, (_, index) => (
          <line key={index} x1={left} y1={top + (d / (rows + 1)) * (index + 1)} x2={w / 2} y2={top + (d / (rows + 1)) * (index + 1)} {...line} />
        ))}
      </g>
    )
  }
  if (mark === 'speakers') {
    return (
      <g>
        <rect x={left} y={top} width={w * 0.28} height={d} {...paper} />
        <rect x={w * 0.22} y={top} width={w * 0.28} height={d} {...paper} />
        <circle cx={-w * 0.36} cy={0} r={Math.min(w, d) * 0.08} {...line} />
        <circle cx={w * 0.36} cy={0} r={Math.min(w, d) * 0.08} {...line} />
      </g>
    )
  }
  if (mark === 'shelf' || mark === 'vitrine') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={left + 2} y1={top + d * t} x2={w / 2 - 2} y2={top + d * t} {...line} />)}
        {mark === 'vitrine' && <line x1={0} y1={top} x2={0} y2={d / 2} {...line} />}
      </g>
    )
  }
  if (mark === 'rug') {
    return <rect x={left} y={top} width={w} height={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="4 2" />
  }
  if (mark === 'lamp') {
    return (
      <g {...line}>
        <circle r={Math.min(w, d) * 0.28} {...paper} />
        <line x1={-w * 0.2} y1={d * 0.1} x2={w * 0.2} y2={-d * 0.1} />
        <line x1={w * 0.2} y1={d * 0.1} x2={-w * 0.2} y2={-d * 0.1} />
      </g>
    )
  }
  if (mark === 'insert') {
    return (
      <g>
        <path d={`M ${left} ${d / 2} V ${top} H ${w / 2} V ${d / 2}`} {...paper} />
        <path d={`M ${-w * 0.06} ${d * 0.22} Q 0 ${-d * 0.18} ${w * 0.1} ${d * 0.02} Q ${w * 0.02} ${d * 0.16} ${-w * 0.06} ${d * 0.22}`} {...line} />
        <path d={`M ${w * 0.02} ${d * 0.28} Q ${w * 0.16} ${d * 0.02} ${w * 0.22} ${d * 0.22}`} {...line} />
      </g>
    )
  }
  if (mark === 'fireplace' || mark === 'leivinuuni' || mark === 'kakluuni') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {mark === 'kakluuni' && [0.28, 0.5, 0.72].map((t) => <line key={t} x1={left + 2} y1={top + d * t} x2={w / 2 - 2} y2={top + d * t} {...line} />)}
        {mark === 'leivinuuni' && <path d={`M ${-w * 0.28} ${d * 0.2} Q 0 ${-d * 0.05} ${w * 0.28} ${d * 0.2}`} {...line} />}
        {mark !== 'kakluuni' && <rect x={-w * 0.22} y={-d * 0.08} width={w * 0.44} height={d * 0.42} {...line} />}
        {mark === 'fireplace' && <path d={`M 0 ${d * 0.02} q ${w * 0.08} ${-d * 0.12} 0 ${-d * 0.18} q ${-w * 0.08} ${d * 0.08} 0 ${d * 0.18}`} {...line} />}
      </g>
    )
  }
  if (mark === 'kamiina') {
    return (
      <g>
        <rect x={left + w * 0.08} y={top + d * 0.08} width={w * 0.84} height={d * 0.7} rx={Math.min(w, d) * 0.35} {...paper} />
        <rect x={-w * 0.16} y={-d * 0.02} width={w * 0.32} height={d * 0.28} rx={1} {...line} />
        <circle cx={0} cy={top + d * 0.16} r={Math.min(w, d) * 0.1} {...line} />
        <line x1={-w * 0.22} y1={d * 0.22} x2={-w * 0.3} y2={d * 0.46} {...line} />
        <line x1={w * 0.22} y1={d * 0.22} x2={w * 0.3} y2={d * 0.46} {...line} />
      </g>
    )
  }
  if (mark === 'puuhella') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {[-0.22, 0.22].map((t) => <circle key={t} cx={w * t} cy={-d * 0.12} r={Math.min(w, d) * 0.16} {...line} />)}
        <rect x={-w * 0.22} y={d * 0.08} width={w * 0.44} height={d * 0.28} {...line} />
      </g>
    )
  }
  if (mark === 'piano') {
    return (
      <g>
        <path d={`M ${left} ${top + d * 0.15} H ${w * 0.15} V ${top} H ${w / 2} V ${d * 0.15} H ${w * 0.05} Q ${w * 0.45} ${d / 2} ${left + w * 0.15} ${d / 2} Z`} {...paper} />
        <line x1={left + 3} y1={top + d * 0.28} x2={w * 0.2} y2={top + d * 0.28} {...line} />
      </g>
    )
  }
  if (mark === 'bed' || mark === 'bunk') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <rect x={left + w * 0.08} y={top} width={w * 0.84} height={d * 0.18} {...paper} />
        {mark === 'bunk' && <line x1={left} y1={0} x2={w / 2} y2={0} {...line} />}
        {w > 50 && mark === 'bed' && <line x1={0} y1={top + d * 0.2} x2={0} y2={d / 2} {...line} />}
      </g>
    )
  }
  if (mark === 'wardrobe' || mark === 'slider') {
    const doors = mark === 'slider' ? 2 : Math.max(1, Math.round(w / 36))
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {Array.from({ length: doors }, (_, index) => (
          <line key={index} x1={left + (w / doors) * (index + 1)} y1={top} x2={left + (w / doors) * (index + 1)} y2={d / 2} {...line} />
        ))}
        {mark === 'slider' && <path d={`M ${left + 4} ${d * 0.15} H ${w / 2 - 4}`} {...line} />}
      </g>
    )
  }
  if (mark === 'vanity-table') {
    return (
      <g>
        <rect x={left} y={top + d * 0.25} width={w} height={d * 0.75} {...paper} />
        <rect x={-w * 0.22} y={top} width={w * 0.44} height={d * 0.32} {...paper} />
      </g>
    )
  }
  if (mark === 'rack') {
    return (
      <g {...line}>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        {[0.2, 0.4, 0.6, 0.8].map((t) => <line key={t} x1={left + 2} y1={top + d * t} x2={w / 2 - 2} y2={top + d * t} />)}
      </g>
    )
  }
  if (mark === 'iron') {
    return (
      <g>
        <path d={`M ${left} ${d * 0.15} H ${w * 0.15} L ${w / 2} ${-d * 0.05} V ${d * 0.35} H ${left} Z`} {...paper} />
        <line x1={left + 3} y1={0} x2={w * 0.25} y2={0} {...line} />
      </g>
    )
  }
  if (mark === 'coat') {
    return (
      <g {...line}>
        <rect x={left} y={top} width={w} height={d * 0.35} {...paper} />
        {[-0.3, -0.1, 0.1, 0.3].map((t) => <circle key={t} cx={w * t} cy={d * 0.05} r={1.4} fill={stroke} />)}
      </g>
    )
  }
  if (mark === 'shoes') {
    return (
      <g>
        <rect x={left} y={top} width={w} height={d} {...paper} />
        <path d={`M ${-w * 0.3} ${-d * 0.05} h ${w * 0.22} l ${w * 0.06} ${d * 0.12} h ${-w * 0.28} Z`} {...line} />
        <path d={`M ${w * 0.02} ${d * 0.08} h ${w * 0.22} l ${w * 0.06} ${d * 0.12} h ${-w * 0.28} Z`} {...line} />
      </g>
    )
  }
  if (mark === 'printer') {
    return (
      <g>
        <rect x={left} y={-d * 0.1} width={w} height={d * 0.55} {...paper} />
        <rect x={-w * 0.28} y={top} width={w * 0.56} height={d * 0.28} {...line} />
      </g>
    )
  }
  if (mark === 'car') {
    return (
      <g>
        <path d={`M ${-w * 0.42} ${-d * 0.32} Q 0 ${-d * 0.5} ${w * 0.42} ${-d * 0.32} V ${d * 0.32} Q 0 ${d * 0.5} ${-w * 0.42} ${d * 0.32} Z`} {...paper} />
        <path d={`M ${-w * 0.28} ${-d * 0.12} H ${w * 0.28} V ${d * 0.16} H ${-w * 0.28} Z`} {...line} />
        {[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x * w} cy={y * d} r={Math.min(w, d) * 0.08} {...line} />
        ))}
      </g>
    )
  }
  if (mark === 'tires') {
    return (
      <g {...line}>
        {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x * w} cy={y * d} r={Math.min(w, d) * 0.16} {...paper} />
        ))}
      </g>
    )
  }
  if (mark === 'bin') {
    return (
      <g>
        <path d={`M ${-w * 0.32} ${top + d * 0.18} L ${-w * 0.42} ${d / 2} L ${w * 0.42} ${d / 2} L ${w * 0.32} ${top + d * 0.18} Z`} {...paper} />
        <line x1={-w * 0.22} y1={top + d * 0.42} x2={w * 0.22} y2={top + d * 0.42} {...line} />
      </g>
    )
  }
  if (mark === 'stool') {
    return (
      <g>
        <circle cx={0} cy={d * 0.04} r={Math.min(w, d) * 0.34} {...paper} />
        <line x1={-w * 0.18} y1={-d * 0.12} x2={w * 0.18} y2={d * 0.2} {...line} />
        <line x1={w * 0.18} y1={-d * 0.12} x2={-w * 0.18} y2={d * 0.2} {...line} />
      </g>
    )
  }
  return <rect x={left} y={top} width={w} height={d} {...paper} />
}
