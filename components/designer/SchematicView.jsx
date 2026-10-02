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
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke="#dbe4ee" strokeWidth="2" />
      {[0, 45, 90, 135].map((angle) => (
        <line key={angle} x1={cx - r * 0.72} y1={cy} x2={cx + r * 0.72} y2={cy} stroke="#e2e8f0" strokeWidth="1.5" transform={`rotate(${angle} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#f8fafc" />
    </g>
  )
}

function SymbolArt({ symbol }) {
  const { type, w, h, label } = symbol
  if (type === 'evaporator' || type === 'condenser') {
    const fans = 2
    const r = h * 0.28
    return (
      <g>
        <rect x="0" y="0" width={w} height={h} rx="10" fill={type === 'condenser' ? '#1f2937' : '#e8eef3'} stroke="#0f172a" strokeWidth="2" />
        {type === 'condenser' && <rect x="6" y="6" width={w - 12} height={h - 12} rx="8" fill="none" stroke="#94a3b8" strokeWidth="1.5" />}
        {Array.from({ length: fans }, (_, index) => (
          <Fan key={index} cx={w * (0.32 + index * 0.36)} cy={h * 0.48} r={r} />
        ))}
        <text x={w / 2} y={-8} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'compressor') {
    return (
      <g>
        <rect x="18" y="10" width={w - 28} height={h - 16} rx="16" fill="#15803d" stroke="#052e16" strokeWidth="2" />
        <rect x="0" y={h * 0.22} width="36" height={h * 0.56} rx="8" fill="#111827" />
        <circle cx={w * 0.55} cy={h * 0.48} r="10" fill="#bbf7d0" />
        <text x={w / 2} y={-8} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'receiver' || type === 'oilSeparator' || type === 'accumulator') {
    const fill = type === 'accumulator' ? '#1e3a8a' : '#166534'
    return (
      <g>
        <rect x="6" y="10" width={w - 12} height={h - 20} rx={(w - 12) / 2} fill={fill} stroke="#052e16" strokeWidth="2" />
        <ellipse cx={w / 2} cy="12" rx={(w - 12) / 2} ry="8" fill="#86efac" />
        <text x={w / 2} y={h + 14} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'filterDrier' || type === 'suctionFilter') {
    return (
      <g>
        <rect x="0" y="2" width={w} height={h - 4} rx={(h - 4) / 2} fill={type === 'suctionFilter' ? '#334155' : '#1d4ed8'} stroke="#0f172a" strokeWidth="2" />
        <text x={w / 2} y={h + 12} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'sightGlass') {
    return (
      <g>
        <circle cx={w / 2} cy={h / 2} r={h / 2 - 1} fill="#0f172a" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx={w / 2} cy={h / 2} r={h / 5} fill="#38bdf8" />
        <text x={w / 2} y={h + 14} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'solenoid') {
    return (
      <g>
        <rect x="4" y="0" width={w - 8} height="22" rx="3" fill="#f59e0b" stroke="#111827" strokeWidth="1.5" />
        <path d={`M0 ${h} H${w} L${w / 2} 24 Z`} fill="#fdba74" stroke="#111827" strokeWidth="1.5" />
        <text x={-8} y="14" textAnchor="end" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'txv' || type === 'eev') {
    return (
      <g>
        <path d={`M8 8 H${w - 8} L${w / 2} ${h - 6} Z`} fill="#fb923c" stroke="#111827" strokeWidth="1.6" />
        <circle cx={w - 8} cy="10" r="7" fill="#0ea5e9" stroke="#111827" />
        <text x={w / 2} y={-8} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'controller') {
    return (
      <g>
        <rect x="0" y="0" width={w} height={h} rx="12" fill="#0b1220" stroke="#334155" strokeWidth="2" />
        <circle cx="18" cy="22" r="6" fill="#22c55e" />
        <text x="32" y="26" fill="#86efac" fontSize="11" fontWeight="700">{symbol.mode}</text>
        <text x={w / 2} y="68" textAnchor="middle" fill="#f8fafc" fontSize="32" fontWeight="800">{symbol.setpoint}°</text>
        <text x={w / 2} y={-8} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">{label}</text>
      </g>
    )
  }
  if (type === 'pressostat') {
    const fill = symbol.tone === 'hp' ? '#ef4444' : '#3b82f6'
    return (
      <g>
        <circle cx={w / 2} cy={h / 2} r={h / 2 - 1} fill={fill} stroke="#0f172a" />
        <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">{label}</text>
      </g>
    )
  }
  if (type === 'defrost' || type === 'drainHeater') {
    return (
      <g>
        <polyline points="0,10 10,2 20,14 30,2 40,14 50,4" fill="none" stroke="#fb923c" strokeWidth="2" />
        <text x="56" y="12" fill="currentColor" fontSize="11">{label}</text>
      </g>
    )
  }
  return null
}

function Poly({ line, theme }) {
  const points = line.points.map((point) => `${point.x},${point.y}`).join(' ')
  const color = colorOf(theme, line.kind)
  const dashed = line.kind === 'control' || line.kind === 'sensor' || line.kind === 'oil'
  const width = line.kind === 'sensor' ? 2.2 : line.kind === 'control' ? 2.6 : 7
  const last = line.points[line.points.length - 1]
  const prev = line.points[line.points.length - 2]
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * 180 / Math.PI
  const marks = []
  if (!dashed) {
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const len = Math.hypot(point.x - start.x, point.y - start.y)
      if (len < 90) return
      const count = Math.max(1, Math.floor(len / 170))
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
      {!dashed && <polyline points={points} fill="none" stroke={color} strokeWidth={width + 6} strokeLinejoin="round" strokeLinecap="round" opacity="0.28" filter="url(#schematic-glow)" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '7 6' : undefined} />
      {marks.map((mark) => (
        <polygon key={`${mark.x}-${mark.y}`} points="-8,-4.5 0,0 -8,4.5" fill={color} transform={`translate(${mark.x} ${mark.y}) rotate(${mark.angle})`} />
      ))}
      {line.kind !== 'sensor' && (
        <polygon points="-9,-5 0,0 -9,5" fill={color} transform={`translate(${last.x} ${last.y}) rotate(${angle})`} />
      )}
    </g>
  )
}

export default function SchematicView({ rooms, projectName, settings, onChange, loads }) {
  const svgRef = useRef(null)
  const [circuitId, setCircuitId] = useState(settings?.circuitId || null)
  const model = useMemo(() => buildSchematics(rooms, {
    ...settings,
    projectName,
    loads,
  }), [rooms, settings, projectName, loads])
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
            <g data-testid="schematic-title">
              <rect x="12" y={circuit.height - 62} width={circuit.width - 24} height="50" rx="8" fill={theme.labelBg} stroke={theme.boxStroke} />
              <text x="28" y={circuit.height - 32} fill={theme.title} fontSize="16" fontWeight="800">{circuit.projectName} · {circuit.title}</text>
              <text x="28" y={circuit.height - 14} fill={theme.muted} fontSize="12">
                {`${circuit.refrigerant}   Te ${circuit.teC} °C   Tc ${circuit.tcC} °C   ${circuit.capacityKw.toFixed(1)} kW   huone ${circuit.roomTempC} °C`}
              </text>
              {circuit.legend.map((item, index) => (
                <g key={item.kind} transform={`translate(${circuit.width - 620 + index * 100} ${circuit.height - 40})`}>
                  <line x1="0" y1="6" x2="28" y2="6" stroke={colorOf(theme, item.kind)} strokeWidth={item.kind === 'control' || item.kind === 'sensor' ? 2 : 4} strokeDasharray={item.kind === 'control' || item.kind === 'sensor' || item.kind === 'oil' ? '4 3' : undefined} />
                  <text x="34" y="10" fill={theme.muted} fontSize="11">{item.label}</text>
                </g>
              ))}
            </g>
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

const field = { width: '100%', marginTop: 4, height: 30, borderRadius: 6, border: '1px solid #3f3f46', background: '#1c212b', color: '#f5f5f4', padding: '0 8px' }
const lab = { display: 'block', fontSize: 12, marginTop: 8 }
const btn = { flex: 1, height: 32, borderRadius: 8, border: '1px solid #3f3f46', background: '#1c212b', color: '#f5f5f4', cursor: 'pointer' }
