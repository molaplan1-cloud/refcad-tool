'use client'

const PALETTE = {
  light: {
    paper: '#ffffff',
    ink: '#1c1917',
    muted: '#44403c',
    frame: '#1c1917',
    zone: '#a8a29e',
    box: '#57534e',
    hair: '#d6d3d1',
    discharge: '#b91c1c',
    liquid: '#c2410c',
    suction: '#1d4ed8',
    oil: '#a16207',
    control: '#166534',
    sensor: '#44403c',
    capillary: '#57534e',
  },
  dark: {
    paper: '#1c1f23',
    ink: '#f5f5f4',
    muted: '#d6d3d1',
    frame: '#e7e5e4',
    zone: '#78716c',
    box: '#a8a29e',
    hair: '#44403c',
    discharge: '#f87171',
    liquid: '#fb923c',
    suction: '#60a5fa',
    oil: '#fbbf24',
    control: '#4ade80',
    sensor: '#e7e5e4',
    capillary: '#a8a29e',
  },
}

const FONT = '"Liberation Sans", "Nimbus Sans", Arial, Helvetica, sans-serif'

export default function TechnicalSheet({ circuit, themeName = 'light' }) {
  const theme = PALETTE[themeName] || PALETTE.light
  const ink = theme.ink
  return (
    <g data-testid="schematic-pid" fontFamily={FONT} fill={ink}>
      <rect width={circuit.width} height={circuit.height} fill={theme.paper} />
      <Frame circuit={circuit} theme={theme} />
      {circuit.boxes.map((item) => (
        <g key={item.id} data-role={item.role}>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} fill="none" stroke={theme.box} strokeWidth="0.8" strokeDasharray="6 4" />
          <text x={item.x + 8} y={item.y + 16} fill={theme.muted} fontSize="12" fontWeight="700">{item.title}</text>
        </g>
      ))}
      {circuit.lines.map((line) => <PidLine key={line.id} line={line} theme={theme} />)}
      {circuit.symbols.map((symbol) => (
        <g key={symbol.id} data-symbol={symbol.type} data-tag={symbol.tag || ''} transform={`translate(${symbol.x} ${symbol.y})`}>
          <PidSymbol symbol={symbol} ink={ink} />
          <TagMark symbol={symbol} />
        </g>
      ))}
      {circuit.labels.map((label) => (
        <text
          key={label.id}
          data-testid="schematic-label"
          x={label.x}
          y={label.y}
          fill={theme[label.kind] || ink}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          transform={label.rotate ? `rotate(-90 ${label.x} ${label.y})` : undefined}
        >{label.text}</text>
      ))}
      <PartsTable circuit={circuit} theme={theme} />
      <PidTitle circuit={circuit} theme={theme} />
    </g>
  )
}

function Frame({ circuit, theme }) {
  const x = 14
  const y = 14
  const w = circuit.width - 28
  const h = circuit.height - 28
  const zones = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const rows = ['1', '2', '3', '4', '5', '6']
  return (
    <g data-testid="schematic-frame" fill="none" stroke={theme.frame}>
      <rect x={x} y={y} width={w} height={h} strokeWidth="1.6" />
      <rect x={x + 18} y={y + 18} width={w - 36} height={h - 36} strokeWidth="0.7" />
      {zones.map((zone, index) => {
        const zx = x + (w * index) / zones.length
        return (
          <g key={zone}>
            <line x1={zx} y1={y} x2={zx} y2={y + 18} strokeWidth="0.6" />
            <text x={zx + w / zones.length / 2} y={y + 13} fill={theme.muted} stroke="none" fontSize="9" textAnchor="middle">{zone}</text>
          </g>
        )
      })}
      {rows.map((row, index) => {
        const zy = y + (h * index) / rows.length
        return (
          <g key={row}>
            <line x1={x} y1={zy} x2={x + 18} y2={zy} strokeWidth="0.6" />
            <text x={x + 9} y={zy + h / rows.length / 2 + 3} fill={theme.muted} stroke="none" fontSize="9" textAnchor="middle">{row}</text>
          </g>
        )
      })}
    </g>
  )
}

function PidLine({ line, theme }) {
  const color = theme[line.kind] || theme.suction
  const signal = line.kind === 'control' || line.kind === 'sensor' || line.kind === 'capillary' || line.kind === 'oil'
  const width = line.kind === 'capillary' ? 0.8 : signal ? 0.9 : 1.7
  const d = line.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const arrows = []
  if (!signal || line.kind === 'oil') {
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const len = Math.hypot(point.x - start.x, point.y - start.y)
      if (len < 80) return
      const t = 0.62
      arrows.push({
        x: start.x + (point.x - start.x) * t,
        y: start.y + (point.y - start.y) * t,
        angle: Math.atan2(point.y - start.y, point.x - start.x) * 180 / Math.PI,
      })
    })
  }
  const end = line.points[line.points.length - 1]
  return (
    <g data-kind={line.kind} data-testid="schematic-line">
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="miter" strokeDasharray={dash(line.kind)} />
      {arrows.map((arrow) => (
        <polygon key={`${arrow.x}-${arrow.y}`} points="-7,-2.6 0,0 -7,2.6" fill={color} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`} />
      ))}
      {line.endCap === 'bulb' && <circle cx={end.x} cy={end.y} r="5" fill={theme.paper} stroke={color} strokeWidth="1" />}
    </g>
  )
}

function dash(kind) {
  if (kind === 'oil') return '7 3'
  if (kind === 'control') return '5 3'
  if (kind === 'sensor' || kind === 'capillary') return '2 2'
  return undefined
}

function TagMark({ symbol }) {
  if (!symbol.tag) return null
  if (symbol.type === 'pressureSwitch' || symbol.type === 'probe' || symbol.type === 'controller') return null
  const onSpine = symbol.type === 'compressor' || symbol.type === 'serviceValve' || symbol.type === 'oilSeparator' || symbol.type === 'checkValve'
  if (onSpine) {
    return <text x={-6} y={symbol.h / 2 + 4} fontSize="11" fontWeight="700" textAnchor="end">{symbol.tag}</text>
  }
  return <text x={symbol.w / 2} y={-5} fontSize="11" fontWeight="700" textAnchor="middle">{symbol.tag}</text>
}

function PidSymbol({ symbol, ink }) {
  const { type, w, h } = symbol
  if (type === 'compressor') return <Compressor w={w} h={h} ink={ink} />
  if (type === 'condenser' || type === 'evaporator') return <Exchanger w={w} h={h} ink={ink} fan={type === 'condenser' ? 'top' : 'side'} />
  if (type === 'receiver' || type === 'oilSeparator' || type === 'accumulator') return <Vessel w={w} h={h} ink={ink} />
  if (type === 'filterDrier' || type === 'suctionFilter') return <Filter w={w} h={h} ink={ink} />
  if (type === 'sightGlass') return <Sight w={w} h={h} ink={ink} />
  if (type === 'solenoid') return <Solenoid w={w} h={h} ink={ink} />
  if (type === 'txv' || type === 'eev') return <Expansion w={w} h={h} ink={ink} motor={type === 'eev'} />
  if (type === 'serviceValve') return <ValveBody w={w} h={h} ink={ink} stem />
  if (type === 'checkValve') return <Check w={w} h={h} ink={ink} />
  if (type === 'pressureSwitch' || type === 'probe') return <Bubble w={w} h={h} ink={ink} text={symbol.tag} />
  if (type === 'heater') return <Heater w={w} h={h} ink={ink} />
  if (type === 'controller') return <Controller w={w} h={h} ink={ink} />
  return <rect width={w} height={h} fill="none" stroke={ink} strokeWidth="1.1" />
}

function Compressor({ w, h, ink }) {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - 1
  return (
    <g fill="none" stroke={ink} strokeWidth="1.25">
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M ${cx} ${cy - r * 0.45} L ${cx - r * 0.38} ${cy + r * 0.32} L ${cx + r * 0.38} ${cy + r * 0.32} Z`} fill={ink} stroke="none" />
    </g>
  )
}

function Exchanger({ w, h, ink, fan }) {
  const tubes = [0.28, 0.42, 0.56, 0.7].map((t) => h * t)
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} />
      {tubes.map((y) => <line key={y} x1="8" y1={y} x2={w - (fan === 'side' ? 28 : 8)} y2={y} />)}
      {fan === 'top' ? <Fan cx={w - 22} cy={h / 2} r={Math.min(14, h * 0.32)} ink={ink} /> : <Fan cx={w - 16} cy={h / 2} r={Math.min(14, h * 0.34)} ink={ink} />}
    </g>
  )
}

function Fan({ cx, cy, r, ink }) {
  return (
    <g stroke={ink} fill="none" strokeWidth="1">
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M ${cx} ${cy - r + 1.5} L ${cx} ${cy + r - 1.5} M ${cx - r + 1.5} ${cy} L ${cx + r - 1.5} ${cy}`} />
    </g>
  )
}

function Vessel({ w, h, ink }) {
  const r = w / 2
  return (
    <g fill="none" stroke={ink} strokeWidth="1.2">
      <path d={`M 0 ${r} A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 0 ${h - r} Z`} />
      <line x1="3" y1={h * 0.62} x2={w - 3} y2={h * 0.62} strokeDasharray="2 2" />
    </g>
  )
}

function Filter({ w, h, ink }) {
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} />
      <line x1={w * 0.38} y1="3" x2={w * 0.38} y2={h - 3} strokeDasharray="1.5 1.5" />
      <circle cx={w * 0.68} cy={h / 2} r="3.2" />
    </g>
  )
}

function Sight({ w, h, ink }) {
  const r = Math.min(w, h) / 2 - 1
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <circle cx={w / 2} cy={h / 2} r={r} />
      <circle cx={w / 2} cy={h / 2} r={r * 0.45} />
    </g>
  )
}

function Solenoid({ w, h, ink }) {
  const mid = h * 0.62
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <path d={`M 0 ${mid} L ${w / 2} ${mid - 8} L ${w / 2} ${mid + 8} Z M ${w} ${mid} L ${w / 2} ${mid - 8} L ${w / 2} ${mid + 8} Z`} />
      <rect x={w / 2 - 8} y="1" width="16" height="12" />
      <text x={w / 2} y="10" fill={ink} stroke="none" fontSize="8" fontWeight="700" textAnchor="middle">S</text>
    </g>
  )
}

function Expansion({ w, h, ink, motor }) {
  const mid = h * 0.5
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <path d={`M 0 ${mid} L ${w / 2} ${mid - 8} L ${w / 2} ${mid + 8} Z M ${w} ${mid} L ${w / 2} ${mid - 8} L ${w / 2} ${mid + 8} Z`} />
      <path d={`M ${w / 2 - 10} ${mid - 8} Q ${w / 2} 2 ${w / 2 + 10} ${mid - 8}`} />
      {motor && <rect x={w / 2 - 6} y="0" width="12" height="8" />}
    </g>
  )
}

function ValveBody({ w, h, ink, stem }) {
  const mid = h / 2
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <path d={`M 0 ${mid} L ${w / 2} ${mid - 7} L ${w / 2} ${mid + 7} Z M ${w} ${mid} L ${w / 2} ${mid - 7} L ${w / 2} ${mid + 7} Z`} />
      {stem && <path d={`M ${w / 2} ${mid - 7} L ${w / 2} 1 M ${w / 2 - 5} 1 L ${w / 2 + 5} 1`} />}
    </g>
  )
}

function Check({ w, h, ink }) {
  const mid = w / 2
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <path d={`M 2 ${h / 2} L ${mid} 3 L ${mid} ${h - 3} Z`} />
      <line x1={mid + 3} y1="2" x2={mid + 3} y2={h - 2} />
    </g>
  )
}

function Bubble({ w, h, ink, text }) {
  return (
    <g fill="none" stroke={ink} strokeWidth="1.1">
      <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 0.5} />
      <text x={w / 2} y={h / 2 + 3.5} fill={ink} stroke="none" fontSize="9" fontWeight="700" textAnchor="middle">{text}</text>
    </g>
  )
}

function Heater({ w, h, ink }) {
  const mid = h / 2
  return (
    <g fill="none" stroke={ink} strokeWidth="1.1">
      <path d={`M 0 ${mid} L 8 ${mid} L 14 ${mid - 6} L 22 ${mid + 6} L 30 ${mid - 6} L 38 ${mid + 6} L 46 ${mid} L ${w} ${mid}`} />
    </g>
  )
}

function Controller({ w, h, ink }) {
  return (
    <g fill="none" stroke={ink} strokeWidth="1.15">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} />
      <text x="8" y="16" fill={ink} stroke="none" fontSize="11" fontWeight="700">TC</text>
      {[0, 1, 2, 3, 4].map((index) => <circle key={index} cx={18 + index * 16} cy={h - 14} r="2.2" fill={ink} stroke="none" />)}
    </g>
  )
}

function PartsTable({ circuit, theme }) {
  const x = 46
  const y = 888
  const w = 980
  const rows = circuit.parts || []
  const rowH = Math.min(15, 250 / Math.max(rows.length, 1))
  const h = 20 + rows.length * rowH
  const cols = [0, 64, 300, 620, w]
  return (
    <g data-testid="schematic-parts" fontSize="10">
      <text x={x} y={y - 6} fontSize="11" fontWeight="700" fill={theme.ink}>Osaluettelo</text>
      <rect x={x} y={y} width={w} height={Math.max(h, 40)} fill={theme.paper} stroke={theme.ink} strokeWidth="0.8" />
      {cols.slice(1, -1).map((col) => <line key={col} x1={x + col} y1={y} x2={x + col} y2={y + Math.max(h, 40)} stroke={theme.ink} strokeWidth="0.5" />)}
      <line x1={x} y1={y + 18} x2={x + w} y2={y + 18} stroke={theme.ink} strokeWidth="0.6" />
      {['Tunnus', 'Nimitys', 'Tyyppi / koko', 'Liitäntä'].map((heading, index) => (
        <text key={heading} x={x + cols[index] + 6} y={y + 13} fontWeight="700" fill={theme.ink}>{heading}</text>
      ))}
      {rows.map((row, index) => (
        <g key={`${row.tag}-${row.name}-${index}`}>
          <text x={x + 6} y={y + 32 + index * rowH} fill={theme.ink}>{row.tag}</text>
          <text x={x + cols[1] + 6} y={y + 32 + index * rowH} fill={theme.ink}>{row.name}</text>
          <text x={x + cols[2] + 6} y={y + 32 + index * rowH} fill={theme.ink}>{row.model}</text>
          <text x={x + cols[3] + 6} y={y + 32 + index * rowH} fill={theme.ink}>{row.connection}</text>
        </g>
      ))}
    </g>
  )
}

function PidTitle({ circuit, theme }) {
  const x = 1044
  const y = 888
  const w = 590
  const h = 270
  const rows = [
    ['Yritys', 'RefCAD', 'Piir.nro', circuit.drawingNo || 'KA-01'],
    ['Projekti', circuit.projectName || '', 'Revisio', circuit.revision || 'A'],
    ['Piirustus', 'Kylmäkaavio', 'Mittakaava', 'NTS'],
    ['Kohde', circuit.title || '', 'Käyttö', circuit.duty || ''],
    ['Kylmäaine', `${circuit.refrigerant || ''}   Te ${circuit.teC} °C   Tc ${circuit.tcC} °C`, 'Teho', `${Number(circuit.capacityKw || 0).toFixed(1)} kW`],
    ['Päiväys', circuit.date || '', 'Piirtäjä', circuit.designer || '—'],
    ['Tarkastaja', '—', 'Huone', `${circuit.roomTempC} °C`],
  ]
  return (
    <g data-testid="schematic-title" fontSize="10">
      <rect x={x} y={y} width={w} height={h} fill={theme.paper} stroke={theme.ink} strokeWidth="1.1" />
      {rows.map((row, index) => (
        <g key={row[0]}>
          <line x1={x} y1={y + 22 * (index + 1)} x2={x + w} y2={y + 22 * (index + 1)} stroke={theme.ink} strokeWidth="0.5" />
          <text x={x + 8} y={y + 15 + index * 22} fill={theme.muted}>{row[0]}</text>
          <text x={x + 78} y={y + 15 + index * 22} fill={theme.ink} fontWeight="700">{row[1]}</text>
          <text x={x + 360} y={y + 15 + index * 22} fill={theme.muted}>{row[2]}</text>
          <text x={x + 440} y={y + 15 + index * 22} fill={theme.ink} fontWeight="700">{row[3]}</text>
        </g>
      ))}
      <text x={x + 8} y={y + 168} fill={theme.muted}>Revisiotaulukko</text>
      <text x={x + 8} y={y + 186} fill={theme.ink}>{`${circuit.revision || 'A'}   ${circuit.date || ''}   Luonnos   ${circuit.designer || '—'}`}</text>
      <text x={x + 8} y={y + 204} fill={theme.muted} fontSize="8">Kuumakaasu seulottu 10 m vaakana, raja 1,1 K. Nousu tarkistetaan erikseen.</text>
      <text x={x + 8} y={y + 216} fill={theme.muted} fontSize="8">Vastaanotinlinja on yhtä kokoa suurempi kuin nesteen syöttö.</text>
      <g transform={`translate(${x + 8} ${y + 242})`}>
        {circuit.legend.map((item, index) => (
          <g key={item.kind} transform={`translate(${index * 96} 0)`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke={theme[item.kind]} strokeWidth={item.kind === 'control' || item.kind === 'sensor' || item.kind === 'oil' ? 1 : 1.6} strokeDasharray={item.kind === 'control' || item.kind === 'sensor' || item.kind === 'oil' ? '4 2' : undefined} />
            <text x="26" y="9" fill={theme.muted} fontSize="9">{item.label}</text>
          </g>
        ))}
      </g>
    </g>
  )
}
