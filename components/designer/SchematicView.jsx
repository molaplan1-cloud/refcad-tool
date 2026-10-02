'use client'

import { useMemo, useRef, useState } from 'react'
import { REFRIGERANT_IDS } from '@/lib/pipeSizing'
import { ACCESSORY_FIELDS, buildSchematics } from '@/lib/schematic'

const THEMES = {
  dark: {
    bg: '#2b2f34',
    box: 'rgba(255,255,255,0.03)',
    boxStroke: '#9aa3ad',
    title: '#f8fafc',
    muted: '#d5dde6',
    labelBg: 'rgba(32,35,40,0.92)',
    discharge: '#ff2d2d',
    liquid: '#ff9a1a',
    suction: '#3b82f6',
    oil: '#f5d90a',
    control: '#3ddc4a',
    sensor: '#f8fafc',
  },
  light: {
    bg: '#f4f6f8',
    box: 'rgba(255,255,255,0.72)',
    boxStroke: '#64748b',
    title: '#1c1917',
    muted: '#44403c',
    labelBg: 'rgba(255,255,255,0.94)',
    discharge: '#dc2626',
    liquid: '#ea580c',
    suction: '#1d4ed8',
    oil: '#a16207',
    control: '#15803d',
    sensor: '#1c1917',
  },
}

function colorOf(theme, kind) {
  return theme[kind] || theme.suction
}

function Fan({ cx, cy, r }) {
  const blades = [0, 55, 110, 165, 220, 275]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.5} fill="#111827" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r - 1} fill="#0b1220" />
      {blades.map((angle) => (
        <ellipse key={angle} cx={cx} cy={cy - r * 0.42} rx={r * 0.16} ry={r * 0.38} fill="#e5e7eb" transform={`rotate(${angle} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.18} fill="#f8fafc" stroke="#94a3b8" />
    </g>
  )
}

function Fins({ x, y, w, h, gap = 4 }) {
  const lines = []
  for (let px = x; px <= x + w; px += gap) lines.push(<line key={px} x1={px} y1={y} x2={px} y2={y + h} stroke="#64748b" strokeWidth="0.7" opacity="0.85" />)
  return <g>{lines}</g>
}

function Caption({ x, y, children, anchor = 'middle', size = 12 }) {
  if (!children) return null
  return <text x={x} y={y} textAnchor={anchor} fill="currentColor" fontSize={size} fontWeight="700">{children}</text>
}

function SymbolArt({ symbol }) {
  const { type, w, h, label } = symbol
  const gid = `metal-${symbol.id}`
  if (type === 'evaporator' || type === 'condenser') {
    const fans = symbol.fans || 2
    const r = Math.min(h * 0.28, 28)
    const casing = type === 'condenser' ? '#3f6212' : '#e8eef3'
    const edge = type === 'condenser' ? '#1a2e05' : '#0f172a'
    return (
      <g>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} rx="12" fill={casing} stroke={edge} strokeWidth="2" />
        <rect x="3" y="3" width={w - 6} height={h * 0.22} rx="8" fill={`url(#${gid})`} />
        <Fins x={10} y={h * 0.18} w={w - 20} h={h * 0.64} />
        {Array.from({ length: fans }, (_, index) => (
          <Fan key={index} cx={w * ((index + 1) / (fans + 1))} cy={h * 0.5} r={r} />
        ))}
        {type === 'evaporator' && (
          <g>
            <rect x={w - 14} y={14} width="9" height={h - 28} rx="2" fill="#b45309" stroke="#7c2d12" />
            {[0.34, 0.52, 0.7].map((t) => (
              <line key={t} x1={w - 14} y1={h * t} x2={w - 24} y2={h * t} stroke="#d97706" strokeWidth="1.5" />
            ))}
          </g>
        )}
        {type === 'evaporator' ? (
          <text x="12" y="15" textAnchor="start" fill="#0f172a" fontSize="12" fontWeight="700">{label}</text>
        ) : (
          <text x={w / 2} y={h - 8} textAnchor="middle" fill="#ecfccb" fontSize="12" fontWeight="700">{label}</text>
        )}
      </g>
    )
  }
  if (type === 'compressor') {
    return (
      <g>
        <rect x="0" y={h * 0.28} width="42" height={h * 0.48} rx="8" fill="#14532d" stroke="#052e16" strokeWidth="1.5" />
        <rect x="28" y="10" width={w - 46} height={h - 18} rx="20" fill="#15803d" stroke="#052e16" strokeWidth="2" />
        <path d={`M48 16 H${w - 40}`} stroke="#86efac" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
        <rect x="212" y="28" width="40" height="24" rx="3" fill="#0f172a" stroke="#334155" />
        <circle cx="232" cy="40" r="3" fill="#4ade80" />
        <rect x="44" y="-10" width="12" height="18" rx="2" fill="#94a3b8" stroke="#334155" />
        <rect x="40" y="-2" width="20" height="8" rx="1" fill="#b45309" stroke="#7c2d12" />
        <rect x="186" y="-10" width="12" height="18" rx="2" fill="#94a3b8" stroke="#334155" />
        <rect x="182" y="-2" width="20" height="8" rx="1" fill="#b45309" stroke="#7c2d12" />
        <text x={w / 2 + 8} y={h * 0.66} textAnchor="middle" fill="#f0fdf4" fontSize="13" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'receiver' || type === 'oilSeparator' || type === 'accumulator') {
    const fill = type === 'accumulator' ? '#1d4ed8' : type === 'oilSeparator' ? '#0f766e' : '#166534'
    const head = type === 'accumulator' ? '#93c5fd' : '#86efac'
    return (
      <g>
        <rect x={w / 2 - 5} y="-8" width="10" height="14" rx="2" fill="#94a3b8" stroke="#334155" />
        <rect x={w - 4} y={h * 0.62} width="12" height="8" rx="2" fill="#94a3b8" stroke="#334155" />
        <rect x="5" y="8" width={w - 10} height={h - 18} rx={(w - 10) / 2} fill={fill} stroke="#052e16" strokeWidth="2" />
        <ellipse cx={w / 2} cy="12" rx={(w - 14) / 2} ry="7" fill={head} />
        <path d={`M10 20 V${h - 24}`} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.28" />
        <Caption x={w / 2} y={h + 14}>{label}</Caption>
      </g>
    )
  }
  if (type === 'filterDrier' || type === 'suctionFilter') {
    const body = type === 'suctionFilter' ? '#334155' : '#1d4ed8'
    return (
      <g>
        <polygon points={`0,${h / 2} 12,2 12,${h - 2}`} fill="#b45309" stroke="#7c2d12" />
        <polygon points={`${w},${h / 2} ${w - 12},2 ${w - 12},${h - 2}`} fill="#b45309" stroke="#7c2d12" />
        <rect x="10" y="2" width={w - 20} height={h - 4} rx="4" fill={body} stroke="#0f172a" strokeWidth="1.5" />
        <rect x={w * 0.4} y="2" width="10" height={h - 4} fill="#7dd3fc" opacity="0.8" />
        <Caption x={w / 2} y={h + 13}>{label}</Caption>
      </g>
    )
  }
  if (type === 'sightGlass') {
    return (
      <g>
        <rect x="0" y={h * 0.28} width={w} height={h * 0.44} rx="3" fill="#b45309" stroke="#7c2d12" />
        <circle cx={w / 2} cy={h / 2} r={h / 2 - 1} fill="#0f172a" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle cx={w / 2} cy={h / 2} r={h / 4} fill="#22c55e" />
        <circle cx={w / 2 - 2} cy={h / 2 - 2} r={h / 10} fill="#bbf7d0" />
        <Caption x={w / 2} y={h + 14}>{label}</Caption>
      </g>
    )
  }
  if (type === 'solenoid') {
    return (
      <g>
        <rect x="5" y="0" width={w - 10} height="20" rx="3" fill="#1f2937" stroke="#0f172a" />
        {[5, 9, 13].map((y) => <line key={y} x1="8" y1={y} x2={w - 8} y2={y} stroke="#cbd5e1" strokeWidth="1.2" />)}
        <rect x={w / 2 - 3} y="18" width="6" height="8" fill="#94a3b8" />
        <path d={`M0 30 L${w / 2} 42 L0 ${h - 1} Z`} fill="#d97706" stroke="#78350f" strokeWidth="1.2" />
        <path d={`M${w} 30 L${w / 2} 42 L${w} ${h - 1} Z`} fill="#b45309" stroke="#78350f" strokeWidth="1.2" />
        <Caption x={w / 2} y={h + 13}>{label}</Caption>
      </g>
    )
  }
  if (type === 'txv' || type === 'eev') {
    return (
      <g>
        <circle cx={w / 2} cy="12" r="10" fill="#0369a1" stroke="#0f172a" strokeWidth="1.4" />
        <path d={`M${w / 2 - 6} 8 H${w / 2 + 6} M${w / 2} 6 V18`} stroke="#e0f2fe" strokeWidth="1.3" />
        <path d={`M6 22 H${w - 6} L${w / 2} ${h - 2} Z`} fill="#fb923c" stroke="#7c2d12" strokeWidth="1.4" />
        <Caption x={w / 2} y={-6}>{label}</Caption>
      </g>
    )
  }
  if (type === 'bulb') {
    return (
      <g>
        <path d={`M0 1 H-6 V${h - 1} H0`} fill="none" stroke="#0f172a" strokeWidth="1.4" />
        <rect x="0" y="1" width={w} height={h - 2} rx={(h - 2) / 2} fill="#e2e8f0" stroke="#0f172a" />
        <line x1={w - 1} y1={h / 2} x2={w + 10} y2={h / 2} stroke="#94a3b8" strokeWidth="1.3" />
      </g>
    )
  }
  if (type === 'controller') {
    return (
      <g>
        <rect x="0" y="0" width={w} height={h} rx="10" fill="#0b1220" stroke="#334155" strokeWidth="2" />
        <circle cx="16" cy="16" r="5" fill="#22c55e" />
        <text x="28" y="20" fill="#86efac" fontSize="11" fontWeight="700">{symbol.mode}</text>
        <text x={w / 2} y="62" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="800">{symbol.setpoint}°</text>
        {(symbol.terminals || []).map((term) => {
          const port = symbol.ports?.[term.id]
          if (!port) return null
          const x = port.x - symbol.x
          return (
            <g key={term.id}>
              <circle cx={x} cy={h - 8} r="6" fill="#111827" stroke="#e2e8f0" />
              <text x={x} y={h - 5} textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="800">{term.n}</text>
            </g>
          )
        })}
      </g>
    )
  }
  if (type === 'pressostat') {
    const fill = symbol.tone === 'hp' ? '#ef4444' : '#2563eb'
    return (
      <g>
        <circle cx={w / 2} cy={h / 2} r={h / 2 - 1} fill={fill} stroke="#0f172a" strokeWidth="1.4" />
        <path d={`M6 ${h / 2} H${w / 2} L${w - 6} ${h / 2 - 6}`} fill="none" stroke="#fff" strokeWidth="1.4" />
        <circle cx={w - 6} cy={h / 2 - 6} r="1.6" fill="#fff" />
        <text x={w / 2} y={h - 3} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800">{label}</text>
      </g>
    )
  }
  if (type === 'probe') {
    return (
      <g>
        <line x1="8" y1="0" x2="8" y2="6" stroke="#94a3b8" strokeWidth="1.4" />
        <circle cx="8" cy="11" r="5.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.3" />
        {symbol.captionAt === 'below' && <Caption x={w / 2} y={h + 12} size="10">{label}</Caption>}
        {symbol.captionAt === 'under' && <Caption x={w + 6} y={h + 14} anchor="start" size="10">{label}</Caption>}
        {symbol.captionAt === 'left' && <Caption x={-4} y={12} anchor="end" size="10">{label}</Caption>}
        {symbol.captionAt !== 'below' && symbol.captionAt !== 'under' && symbol.captionAt !== 'left' && symbol.captionAt !== 'inside' && (
          <Caption x="18" y="14" anchor="start" size="10">{label}</Caption>
        )}
        {symbol.captionAt === 'inside' && <Caption x={-3} y={11} anchor="end" size="10">{label}</Caption>}
      </g>
    )
  }
  if (type === 'defrost' || type === 'drainHeater') {
    return (
      <g>
        <polyline points="0,9 8,2 16,10 24,2 32,10 40,3" fill="none" stroke="#fb923c" strokeWidth="2" />
        <Caption x={w / 2} y={-2} size="11">{label}</Caption>
      </g>
    )
  }
  return null
}

function roundedPath(points, radius = 12) {
  if (!points.length) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]
    const v1x = cur.x - prev.x
    const v1y = cur.y - prev.y
    const v2x = next.x - cur.x
    const v2y = next.y - cur.y
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const r = Math.min(radius, l1 / 2.2, l2 / 2.2)
    if (r < 3) {
      d += ` L ${cur.x} ${cur.y}`
      continue
    }
    const ax = cur.x - (v1x / l1) * r
    const ay = cur.y - (v1y / l1) * r
    const bx = cur.x + (v2x / l2) * r
    const by = cur.y + (v2y / l2) * r
    d += ` L ${ax} ${ay} Q ${cur.x} ${cur.y} ${bx} ${by}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function Poly({ line, theme }) {
  const d = roundedPath(line.points, line.kind === 'capillary' ? 6 : 12)
  const color = line.kind === 'capillary' ? '#94a3b8' : colorOf(theme, line.kind)
  const dashed = line.kind === 'control' || line.kind === 'sensor' || line.kind === 'oil' || line.kind === 'capillary'
  const width = line.kind === 'capillary' ? 1.4 : line.kind === 'sensor' ? 1.8 : line.kind === 'control' ? 2.2 : 8
  const refrigerant = line.kind === 'discharge' || line.kind === 'liquid' || line.kind === 'suction'
  const last = line.points[line.points.length - 1]
  const prev = line.points[line.points.length - 2]
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * 180 / Math.PI
  const marks = []
  if (refrigerant) {
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const len = Math.hypot(point.x - start.x, point.y - start.y)
      if (len < 70) return
      const count = Math.max(1, Math.floor(len / 120))
      for (let step = 1; step <= count; step += 1) {
        const t = step / (count + 1)
        marks.push({
          x: start.x + (point.x - start.x) * t,
          y: start.y + (point.y - start.y) * t,
          angle: Math.atan2(point.y - start.y, point.x - start.x) * 180 / Math.PI,
        })
      }
    })
  }
  return (
    <g data-kind={line.kind} data-testid="schematic-line">
      {refrigerant && <path d={d} fill="none" stroke={color} strokeWidth={width + 8} strokeLinejoin="round" strokeLinecap="round" opacity="0.35" filter="url(#schematic-glow)" />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '6 5' : undefined} />
      {refrigerant && <path d={d} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 11" opacity="0.9" />}
      {marks.map((mark) => (
        <polygon key={`${mark.x}-${mark.y}`} points="-7,-3.5 0,0 -7,3.5" fill="#ffffff" transform={`translate(${mark.x} ${mark.y}) rotate(${mark.angle})`} />
      ))}
      {refrigerant && (
        <polygon points="-8,-4.5 0,0 -8,4.5" fill={color} transform={`translate(${last.x} ${last.y}) rotate(${angle})`} />
      )}
    </g>
  )
}

export default function SchematicView({ rooms, projectName, settings, onChange, loads }) {
  const svgRef = useRef(null)
  const [circuitId, setCircuitId] = useState(settings?.circuitId || null)
  const drawn = settings?.date || new Date().toLocaleDateString('fi-FI')
  const model = useMemo(() => buildSchematics(rooms, {
    ...settings,
    projectName,
    loads,
    date: drawn,
  }), [rooms, settings, projectName, loads, drawn])
  const circuit = model.circuits.find((item) => item.id === circuitId) || model.circuits[0] || null
  const theme = THEMES[settings?.theme === 'light' ? 'light' : 'dark']

  function patch(partial) {
    onChange({ ...settings, ...partial })
  }

  function patchAccessory(key, value) {
    if (!circuit) return
    const overrides = { ...(settings.overrides || {}) }
    overrides[circuit.id] = { ...(overrides[circuit.id] || {}), [key]: value }
    patch({ overrides })
  }

  async function exportPng() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    const width = circuit?.width || 1280
    const height = circuit?.height || 980
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${(projectName || 'kaavio').replace(/\s+/g, '_')}_kaavio.png`
    link.click()
  }

  return (
    <div data-testid="schematic-view" style={{ display: 'flex', height: '100%', minWidth: 0, background: theme.bg }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 12 }}>
        {!circuit && (
          <div style={{ color: theme.title, padding: 24 }}>Lisää höyrystin pohjaan, niin periaatekaavio rakentuu.</div>
        )}
        {circuit && (
          <svg
            ref={svgRef}
            data-testid="schematic-sheet"
            data-theme={settings?.theme === 'light' ? 'light' : 'dark'}
            data-remote={circuit.remote ? 'true' : 'false'}
            viewBox={`0 0 ${circuit.width} ${circuit.height}`}
            width="100%"
            style={{ display: 'block', maxWidth: circuit.width, background: theme.bg, color: theme.title }}
          >
            <defs>
              <filter id="schematic-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <rect width={circuit.width} height={circuit.height} fill={theme.bg} />
            {circuit.boxes.map((box) => (
              <g key={box.id} data-role={box.role}>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="14" fill={theme.box} stroke={theme.boxStroke} strokeWidth="1.6" strokeDasharray="8 6" />
                <text x={box.x + 14} y={box.y + 22} fill={theme.muted} fontSize="14" fontWeight="700">{box.title}</text>
              </g>
            ))}
            {circuit.lines.map((line) => <Poly key={line.id} line={line} theme={theme} />)}
            {circuit.symbols.map((symbol) => (
              <g key={symbol.id} data-symbol={symbol.type} transform={`translate(${symbol.x} ${symbol.y})`}>
                <SymbolArt symbol={symbol} />
              </g>
            ))}
            {circuit.labels.map((label) => (
              <g key={label.id} data-testid="schematic-label">
                <rect x={label.x - label.w / 2} y={label.y - 12} width={label.w} height={18} rx="4" fill={theme.labelBg} stroke={colorOf(theme, label.kind)} />
                <text x={label.x} y={label.y + 1} textAnchor="middle" fill={colorOf(theme, label.kind)} fontSize="12" fontWeight="700">{label.text}</text>
              </g>
            ))}
            <TitleBlock circuit={circuit} theme={theme} />
          </svg>
        )}
      </div>
      <aside data-testid="schematic-panel" style={{ width: 280, flexShrink: 0, overflowY: 'auto', background: '#14181f', color: '#f5f5f4', borderLeft: '1px solid #0c0f14', padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Periaatekaavio</div>
        {model.circuits.length > 1 && (
          <select aria-label="Piiri" value={circuit?.id || ''} onChange={(event) => setCircuitId(event.target.value)} style={field}>
            {model.circuits.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        )}
        <label style={lab}>Kylmäaine
          <select aria-label="Kylmäaine" value={settings.refrigerant || 'R449A'} onChange={(event) => patch({ refrigerant: event.target.value })} style={field}>
            {REFRIGERANT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={lab}>Te
            <input aria-label="Höyrystymislämpötila" type="number" value={settings.teC} onChange={(event) => patch({ teC: Number(event.target.value) })} style={field} />
          </label>
          <label style={lab}>Tc
            <input aria-label="Lauhtumislämpötila" type="number" value={settings.tcC} onChange={(event) => patch({ tcC: Number(event.target.value) })} style={field} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={lab}>Piirustus
            <input aria-label="Piirustusnumero" value={settings.drawingNo || 'KA-01'} onChange={(event) => patch({ drawingNo: event.target.value })} style={field} />
          </label>
          <label style={lab}>Rev
            <input aria-label="Revisio" value={settings.revision || 'A'} onChange={(event) => patch({ revision: event.target.value })} style={field} />
          </label>
        </div>
        <label style={lab}>Suunnittelija
          <input aria-label="Suunnittelija" value={settings.designer || ''} onChange={(event) => patch({ designer: event.target.value })} style={field} />
        </label>
        <label style={lab}>Paisunta
          <select aria-label="Paisuntaventtiili" value={circuit?.accessories.expansion || 'txv'} onChange={(event) => patchAccessory('expansion', event.target.value)} style={field}>
            <option value="txv">TXV</option>
            <option value="eev">EEV</option>
            <option value="none">Ei venttiiliä</option>
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {ACCESSORY_FIELDS.map((field) => (
            <label key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                data-testid={`accessory-${field.key}`}
                checked={!!circuit?.accessories[field.key]}
                onChange={(event) => patchAccessory(field.key, event.target.checked)}
              />
              {field.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="button" data-testid="schematic-theme" onClick={() => patch({ theme: settings.theme === 'light' ? 'dark' : 'light' })} style={btn}>
            {settings.theme === 'light' ? 'Tumma' : 'Vaalea'}
          </button>
          <button type="button" data-testid="schematic-png" onClick={exportPng} style={btn}>PNG</button>
        </div>
        <p style={{ fontSize: 11, color: '#a8a29e', lineHeight: 1.45, marginTop: 12 }}>
          Kaavio lukee pohjan laitteet ja mitoittaa putket samalla seulonnalla. Vastaanotinlinja on yhtä kokoa suurempi. Vastaanotin, kuivain ja näkölasi ovat kompressoriyksikön sisällä.
        </p>
      </aside>
    </div>
  )
}

function TitleBlock({ circuit, theme }) {
  const x = 12
  const y = circuit.height - 124
  const w = circuit.width - 24
  const h = 112
  const cells = [
    ['Projekti', circuit.projectName, 'Piirustus', circuit.drawingNo || 'KA-01', 'Rev', circuit.revision || 'A', 'Päivä', circuit.date || ''],
    ['Kylmäaine', circuit.refrigerant, 'Te', `${circuit.teC} °C`, 'Tc', `${circuit.tcC} °C`, 'Teho', `${circuit.capacityKw.toFixed(1)} kW`],
    ['Huone', `${circuit.roomTempC} °C`, 'Mittakaava', circuit.note || 'Ei mittakaavassa', 'Suunnittelija', circuit.designer || '—', 'Piiri', circuit.title],
  ]
  let legendX = x + 14
  return (
    <g data-testid="schematic-title">
      <rect x={x} y={y} width={w} height={h} fill={theme.labelBg} stroke={theme.boxStroke} />
      {[1, 2, 3].map((row) => <line key={row} x1={x} y1={y + row * 22} x2={x + w} y2={y + row * 22} stroke={theme.boxStroke} strokeWidth="0.6" />)}
      {cells.map((row, rowIndex) => row.map((value, index) => (
        <text key={`${rowIndex}-${index}`} x={x + 12 + (index % 2 === 0 ? Math.floor(index / 2) * (w / 4) : Math.floor(index / 2) * (w / 4) + 78)} y={y + 15 + rowIndex * 22} fill={index % 2 === 0 ? theme.muted : theme.title} fontSize={index % 2 === 0 ? 9 : 11} fontWeight={index % 2 === 0 ? 500 : 700}>{value}</text>
      )))}
      {circuit.legend.map((item) => {
        const itemW = 46 + item.label.length * 6.4
        const node = (
          <g key={item.kind} transform={`translate(${legendX} ${y + 90})`}>
            <line x1="0" y1="8" x2="28" y2="8" stroke={colorOf(theme, item.kind)} strokeWidth={item.kind === 'control' || item.kind === 'sensor' || item.kind === 'oil' ? 2 : 5} strokeDasharray={item.kind === 'control' || item.kind === 'sensor' || item.kind === 'oil' ? '4 3' : undefined} />
            <text x="34" y="12" fill={theme.muted} fontSize="11">{item.label}</text>
          </g>
        )
        legendX += itemW
        return node
      })}
    </g>
  )
}

const field = { width: '100%', marginTop: 4, height: 30, borderRadius: 6, border: '1px solid #3f3f46', background: '#1c212b', color: '#f5f5f4', padding: '0 8px' }
const lab = { display: 'block', fontSize: 12, marginTop: 8 }
const btn = { flex: 1, height: 32, borderRadius: 8, border: '1px solid #3f3f46', background: '#1c212b', color: '#f5f5f4', cursor: 'pointer' }
