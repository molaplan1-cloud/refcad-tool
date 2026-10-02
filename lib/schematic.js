// Principle diagram (P&ID) generated from the placed rooms. Pipe diameters come
// from the same screening sizer as the plan. The condenser-to-receiver liquid
// segment is one copper size larger than the supply line at the same duty,
// because liquid leaving a condenser can carry bubbles.

import { isRefrigerated } from './catalog.js'
import { COPPER, REFRIGERANTS, sizeLine } from './pipeSizing.js'
import { layoutPid } from './schematicPid.js'

export const ACCESSORY_FIELDS = [
  { key: 'oilSeparator', label: 'Öljynerotin' },
  { key: 'receiver', label: 'Vastaanotin' },
  { key: 'filterDrier', label: 'Kuivain' },
  { key: 'sightGlass', label: 'Näkölasi' },
  { key: 'solenoid', label: 'Magneettiventtiili' },
  { key: 'suctionFilter', label: 'Imusuodatin' },
  { key: 'accumulator', label: 'Imuakku' },
  { key: 'hpSwitch', label: 'Korkeapainepressostaatti' },
  { key: 'lpSwitch', label: 'Matalapainepressostaatti' },
  { key: 'defrostHeater', label: 'Sulatusvastus' },
  { key: 'drainHeater', label: 'Kondenssivesivastus' },
  { key: 'controller', label: 'Ohjain' },
  { key: 'evapProbe', label: 'Höyrystinanturi' },
  { key: 'roomProbe', label: 'Huoneanturi' },
]

export function defaultAccessories({ frozen = false } = {}) {
  return {
    oilSeparator: false,
    receiver: true,
    filterDrier: true,
    sightGlass: true,
    solenoid: true,
    expansion: 'txv',
    suctionFilter: false,
    accumulator: !!frozen,
    hpSwitch: true,
    lpSwitch: true,
    defrostHeater: !!frozen,
    drainHeater: !!frozen,
    controller: true,
    evapProbe: true,
    roomProbe: true,
  }
}

export function ascii(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A')
    .replace(/–/g, '-').replace(/°/g, ' ')
}

function dist(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0))
}

function worldOf(room, eq) {
  return { x: (room.x || 0) + (eq.x || 0), z: (room.z || 0) + (eq.z || 0) }
}

function nearest(point, list) {
  return (list || []).reduce((best, item) => {
    if (!best || dist(point, item) < dist(point, best)) return item
    return best
  }, null)
}

function mmLabel(odMm, inch) {
  const n = Number(odMm)
  if (!Number.isFinite(n) || n <= 0) return ''
  const text = (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return inch ? `${text} mm (${inch})` : `${text} mm`
}

function sizeHotGas({ capacityKw, refrigerant, teC, tcC, lengthM }) {
  // Horizontal screening on the same 1.1 K limit as suction. A velocity-only
  // pick accepts 6.35 mm at about 12 m/s, but that run loses several kelvin
  // over 10 m. A vertical discharge riser still has to be checked for oil return.
  const sized = sizeLine({
    kind: 'hotgas',
    refrigerant,
    capacityKw,
    teC,
    tcC,
    lengthM: lengthM || 10,
    riseM: 0,
    roomTempC: 5,
  })
  if (!sized.odMm) return { odMm: 0, inch: '', label: '' }
  return { odMm: sized.odMm, inch: sized.inch, label: mmLabel(sized.odMm, sized.inch) }
}

function bumpLiquid(sized) {
  const index = COPPER.findIndex((tube) => tube.odMm === sized.odMm)
  const tube = COPPER[Math.min(COPPER.length - 1, Math.max(0, index + 1))]
  return { odMm: tube.odMm, inch: tube.inch, label: mmLabel(tube.odMm, tube.inch), bumped: index >= 0 && index < COPPER.length - 1 }
}

function lineSizes({ capacityKw, refrigerant, teC, tcC, roomTempC }) {
  const suction = sizeLine({ kind: 'suction', refrigerant, capacityKw, teC, tcC, lengthM: 15, riseM: 3, roomTempC })
  const liquid = sizeLine({ kind: 'liquid', refrigerant, capacityKw, teC, tcC, lengthM: 15, riseM: 0, roomTempC })
  const hotgas = sizeHotGas({ capacityKw, refrigerant, teC, tcC, lengthM: 10 })
  const back = liquid.odMm ? bumpLiquid(liquid) : { label: '', odMm: 0, inch: '' }
  return {
    suction: mmLabel(suction.odMm, suction.inch),
    liquid: mmLabel(liquid.odMm, liquid.inch),
    liquidReturn: back.label,
    hotgas: hotgas.label,
    suctionOd: suction.odMm || 0,
    liquidOd: liquid.odMm || 0,
    liquidReturnOd: back.odMm || 0,
    hotgasOd: hotgas.odMm || 0,
  }
}

function collect(rooms) {
  const rows = []
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      rows.push({ room, eq, ...worldOf(room, eq), category: eq.category, id: eq.id })
    }
  }
  return rows
}

function topologyFor(accessories) {
  const discharge = ['compressor']
  if (accessories.oilSeparator) discharge.push('oilSeparator')
  discharge.push('condenser')
  const liquid = ['condenser']
  if (accessories.receiver) liquid.push('receiver')
  if (accessories.filterDrier) liquid.push('filterDrier')
  if (accessories.sightGlass) liquid.push('sightGlass')
  if (accessories.solenoid) liquid.push('solenoid')
  if (accessories.expansion === 'eev') liquid.push('eev')
  else if (accessories.expansion === 'txv') liquid.push('txv')
  liquid.push('evaporator')
  const suction = ['evaporator']
  if (accessories.suctionFilter) suction.push('suctionFilter')
  if (accessories.accumulator) suction.push('accumulator')
  suction.push('compressor')
  const controls = []
  if (accessories.controller) {
    controls.push(['controller', 'compressor'])
    if (accessories.solenoid) controls.push(['controller', 'solenoid'])
    if (accessories.defrostHeater) controls.push(['controller', 'defrost'])
    if (accessories.drainHeater) controls.push(['controller', 'drainHeater'])
  }
  const sensors = []
  if (accessories.controller && accessories.evapProbe) sensors.push('evapProbe')
  if (accessories.controller && accessories.roomProbe) sensors.push('roomProbe')
  return {
    discharge,
    liquid,
    suction,
    oilReturn: !!accessories.oilSeparator,
    controls,
    sensors,
    pressostats: [accessories.hpSwitch ? 'hp' : null, accessories.lpSwitch ? 'lp' : null].filter(Boolean),
  }
}

function addLine(lines, kind, points, label) {
  const clean = []
  for (const point of points) {
    if (!point) continue
    const last = clean[clean.length - 1]
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.8) continue
    clean.push({ x: Math.round(point.x), y: Math.round(point.y) })
  }
  if (clean.length < 2) return null
  const line = {
    id: `${kind}-${lines.length}`,
    kind,
    points: clean,
    label: label || '',
    labelPos: labelAnchor(clean, kind),
    labelLock: null,
  }
  lines.push(line)
  return line
}

function segmentCutsSymbol(a, b, symbol, pad = 3) {
  const left = symbol.x + pad
  const right = symbol.x + symbol.w - pad
  const top = symbol.y + pad
  const bottom = symbol.y + symbol.h - pad
  if (right <= left || bottom <= top) return false
  for (let step = 1; step < 24; step += 1) {
    const t = step / 24
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    if (x > left && x < right && y > top && y < bottom) return true
  }
  return false
}

function pathCutsSymbol(points, symbol) {
  for (let index = 1; index < points.length; index += 1) {
    if (segmentCutsSymbol(points[index - 1], points[index], symbol)) return true
  }
  return false
}

function approachPort(from, port, body) {
  const direct = [from, { x: port.x, y: from.y }, port]
  if (!pathCutsSymbol(direct, body)) return direct
  const laneX = from.x <= body.x + body.w / 2 ? body.x - 16 : body.x + body.w + 16
  const below = body.y + body.h + 20
  const above = body.y - 20
  const under = [from, { x: laneX, y: from.y }, { x: laneX, y: below }, { x: port.x, y: below }, port]
  if (!pathCutsSymbol(under, body)) return under
  return [from, { x: laneX, y: from.y }, { x: laneX, y: above }, { x: port.x, y: above }, port]
}

function labelAnchor(points, kind) {
  let best = 0
  let mid = points[0]
  let dx = 1
  let dy = 0
  for (let i = 1; i < points.length; i += 1) {
    const sx = points[i].x - points[i - 1].x
    const sy = points[i].y - points[i - 1].y
    const len = Math.hypot(sx, sy)
    if (len >= best) {
      best = len
      mid = { x: (points[i].x + points[i - 1].x) / 2, y: (points[i].y + points[i - 1].y) / 2 }
      dx = sx
      dy = sy
    }
  }
  const span = Math.hypot(dx, dy) || 1
  const side = kind === 'suction' ? 1 : kind === 'discharge' ? -1 : kind === 'control' ? 1 : -1
  return {
    x: mid.x + (-dy / span) * 16 * side,
    y: mid.y + (dx / span) * 16 * side,
  }
}

function labelSize(text) {
  return { w: Math.max(36, (text || '').length * 6.6), h: 16 }
}

function symbolCaptionRect(symbol) {
  const { type, label, w, h } = symbol
  if (!label) return null
  const rect = (relX, relY, size, anchor) => {
    const tw = Math.max(24, label.length * size * 0.58)
    const th = size + 4
    let x = symbol.x + relX
    if (anchor === 'middle') x -= tw / 2
    if (anchor === 'end') x -= tw
    return { x, y: symbol.y + relY - size, w: tw, h: th }
  }
  if (type === 'receiver' || type === 'oilSeparator' || type === 'accumulator' || type === 'sightGlass') return rect(w / 2, h + 14, 12, 'middle')
  if (type === 'filterDrier' || type === 'suctionFilter') return rect(w / 2, h + 13, 12, 'middle')
  if (type === 'solenoid') return rect(w / 2, h + 13, 12, 'middle')
  if (type === 'txv' || type === 'eev') return rect(w / 2, -6, 12, 'middle')
  if (type === 'probe' && symbol.captionAt === 'left') return rect(-4, 12, 10, 'end')
  if (type === 'probe' && symbol.captionAt === 'under') return rect(w + 6, h + 14, 10, 'start')
  if (type === 'probe') return rect(18, 14, 10, 'start')
  if (type === 'defrost' || type === 'drainHeater') return rect(w / 2, -2, 11, 'middle')
  return null
}

function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad
}

function labelRect(x, y, text) {
  const { w, h } = labelSize(text)
  return { x: x - w / 2, y: y - 12, w, h }
}

function insideSheet(rect, width, height) {
  return rect.x >= 6 && rect.y >= 8 && rect.x + rect.w <= width - 6 && rect.y + rect.h <= height - 124
}

function placeLabels(lines, symbols, boxes, width, height) {
  const titles = boxes.map((box) => ({
    x: box.x + 10,
    y: box.y + 4,
    w: Math.min(box.w - 24, box.title.length * 7.5 + 8),
    h: 18,
  }))
  const bodies = [
    ...symbols.map((symbol) => ({ x: symbol.x - 1, y: symbol.y - 1, w: symbol.w + 2, h: symbol.h + 2 })),
    ...titles,
    ...symbols.map(symbolCaptionRect).filter(Boolean),
  ]
  const placed = []
  lines.filter((line) => line.label).forEach((line) => {
    const { w, h } = labelSize(line.label)
    const segments = []
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const len = Math.hypot(point.x - start.x, point.y - start.y)
      if (len >= 28) segments.push({ start, point, len })
    })
    segments.sort((a, b) => b.len - a.len)
    let chosen = null
    if (line.labelLock) {
      const rect = labelRect(line.labelLock.x, line.labelLock.y, line.label)
      const clear = insideSheet(rect, width, height)
        && !bodies.some((body) => rectsOverlap(rect, body, 1))
        && !placed.some((other) => rectsOverlap(rect, labelRect(other.x, other.y, other.text), 2))
      if (clear) chosen = line.labelLock
    }
    if (!chosen) segments.some((segment) => {
      const dx = segment.point.x - segment.start.x
      const dy = segment.point.y - segment.start.y
      const span = Math.hypot(dx, dy) || 1
      const horizontal = Math.abs(dx) >= Math.abs(dy)
      const gaps = horizontal ? [h / 2 + 12, 34, 52] : [w / 2 + 14, w / 2 + 36]
      const nx = -dy / span
      const ny = dx / span
      return gaps.some((gap) => [0.55, 0.35, 0.75].some((t) => [1, -1].some((side) => {
        const x = segment.start.x + dx * t + nx * gap * side
        const y = segment.start.y + dy * t + ny * gap * side
        const rect = labelRect(x, y, line.label)
        if (!insideSheet(rect, width, height)) return false
        if (bodies.some((body) => rectsOverlap(rect, body, 2))) return false
        if (placed.some((other) => rectsOverlap(rect, labelRect(other.x, other.y, other.text), 3))) return false
        const onOtherLine = lines.some((other) => {
          if (other.id === line.id) return false
          return other.points.some((pt, i) => {
            if (!i) return false
            const a = other.points[i - 1]
            const obstacle = {
              x: Math.min(a.x, pt.x) - 6,
              y: Math.min(a.y, pt.y) - 6,
              w: Math.abs(pt.x - a.x) + 12,
              h: Math.abs(pt.y - a.y) + 12,
            }
            return rectsOverlap(rect, obstacle, 0)
          })
        })
        if (onOtherLine) return false
        chosen = { x, y }
        return true
      })))
    })
    const fallback = chosen || line.labelPos
    placed.push({
      id: line.id,
      text: line.label,
      x: Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, fallback.x)),
      y: Math.max(14, Math.min(height - 118, fallback.y)),
      w,
      h,
      kind: line.kind,
    })
  })
  return placed
}

function sym(type, x, y, w, h, label, ports, extra = {}) {
  const abs = {}
  Object.entries(ports || {}).forEach(([name, point]) => {
    abs[name] = { x: x + point.x, y: y + point.y }
  })
  return { id: extra.id || type, type, x, y, w, h, label, ports: abs, ...extra }
}

function layoutCircuit(spec) {
  const {
    accessories: acc, remote, evaps, sizes, roomTempC, setpoint, mode,
    title, projectName, refrigerant, teC, tcC, capacityKw, virtual,
    drawingNo, revision, designer, date,
  } = spec
  const symbols = []
  const lines = []
  const boxes = []
  const count = Math.max(1, evaps.length)
  const sheetW = 900 + (count - 1) * 360
  const topY = 8
  const topH = 240
  const corridorY = topY + topH + 10
  const unitY = corridorY + 26
  const unitH = remote ? 400 : 380
  const height = unitY + unitH + 150
  const roomX = remote ? 366 : 14
  const roomW = sheetW - roomX - 14
  const roomY = topY
  const headerY = topY + 34
  const busY = topY + 188

  boxes.push({
    id: 'room-0', role: 'room', x: roomX, y: roomY, w: roomW, h: topH,
    title: evaps[0]?.roomName || title || 'Kylmähuone',
  })

  const ctrl = acc.controller
    ? sym('controller', roomX + 14, topY + 40, 148, 124, 'Ohjain', {
      t1: { x: 22, y: 124 },
      t2: { x: 50, y: 124 },
      t3: { x: 78, y: 124 },
      t4: { x: 106, y: 124 },
      t5: { x: 134, y: 124 },
    }, {
      id: 'controller',
      group: 'room',
      setpoint: Number.isFinite(setpoint) ? setpoint : 2,
      mode,
      terminals: [
        { id: 't1', n: '1' },
        { id: 't2', n: '2' },
        { id: 't3', n: '3' },
        { id: 't4', n: '4' },
        { id: 't5', n: '5' },
      ],
    })
    : null
  if (ctrl) symbols.push(ctrl)

  const evapSymbols = []
  const valves = []
  evaps.forEach((evap, index) => {
    const x = (remote ? 554 : 400) + index * 360
    const y = topY + 62
    const fans = (evap.widthM || 1.2) >= 2.2 ? 3 : 2
    const ev = sym('evaporator', x, y, 236, 90, evap.name || 'Höyrystin', {
      suction: { x: 198, y: 0 },
      liquid: { x: 236, y: 44 },
    }, { id: `evaporator-${index}`, group: 'room', fans })
    symbols.push(ev)
    evapSymbols.push(ev)
    if (acc.expansion === 'txv' || acc.expansion === 'eev') {
      const valveType = acc.expansion === 'eev' ? 'eev' : 'txv'
      const valve = sym(valveType, x + 244, y + 16, 64, 54, valveType === 'eev' ? 'EEV' : 'TXV', {
        inlet: { x: 32, y: 54 },
        outlet: { x: 0, y: 28 },
        equaliser: { x: 64, y: 12 },
      }, { id: `${valveType}-${index}`, group: 'room' })
      symbols.push(valve)
      valves.push(valve)
      addLine(lines, 'liquid', [valve.ports.outlet, ev.ports.liquid], '')
      const bulb = sym('bulb', ev.ports.suction.x, ev.ports.suction.y - 16, 16, 12, '', {
        cap: { x: 16, y: 6 },
      }, { id: `bulb-${index}`, group: 'room' })
      symbols.push(bulb)
      addLine(lines, 'capillary', [
        bulb.ports.cap,
        { x: valve.x + 18, y: bulb.ports.cap.y },
        { x: valve.x + 18, y: valve.y },
      ], '')
      const tieX = ev.ports.suction.x + 42
      addLine(lines, 'capillary', [
        valve.ports.equaliser,
        { x: valve.ports.equaliser.x + 10, y: valve.ports.equaliser.y },
        { x: valve.ports.equaliser.x + 10, y: ev.y - 4 },
        { x: tieX, y: ev.y - 4 },
        { x: tieX, y: headerY },
      ], '')
    }
    if (acc.evapProbe && index === 0) {
      symbols.push(sym('probe', ev.x + 162, ev.y + ev.h - 6, 16, 16, 'Höyrystinanturi', {
        lead: { x: 8, y: 16 },
      }, { id: 'evap-probe', group: 'room', probe: 'evap', captionAt: 'under' }))
    }
    if (acc.defrostHeater) {
      symbols.push(sym('defrost', ev.x + 6, ev.y + ev.h + 20, 46, 12, 'Sulatus', {}, { id: `defrost-${index}`, group: 'room' }))
    }
    if (acc.drainHeater) {
      symbols.push(sym('drainHeater', ev.x + 112, ev.y + ev.h + 20, 46, 12, 'Valutus', {}, { id: `drain-${index}`, group: 'room' }))
    }
  })
  const primary = evapSymbols[0]
  if (acc.roomProbe) {
    const probeX = Math.min(sheetW - 104, roomX + roomW - 92)
    symbols.push(sym('probe', probeX, topY + topH - 42, 16, 16, 'Huoneanturi', {
      lead: { x: 8, y: 0 },
    }, { id: 'room-probe', group: 'room', probe: 'room', captionAt: 'left' }))
  }

  const unitTitle = remote
    ? (virtual ? 'Kompressoriyksikkö (ei pohjassa)' : 'Kompressoriyksikkö')
    : (virtual ? 'Koneikko (ei pohjassa)' : 'Koneikko')
  const unit = { id: 'unit-box', role: 'unit', x: 14, y: unitY, w: sheetW - 28, h: unitH, title: unitTitle }
  boxes.push(unit)

  let condenser
  if (remote) {
    boxes.push({ id: 'condenser-box', role: 'condenser', x: 14, y: topY, w: 340, h: topH, title: 'Lauhdutin' })
    condenser = sym('condenser', 30, topY + 46, 300, 156, 'Lauhdutin', {
      hot: { x: 168, y: 156 },
      liquid: { x: 300, y: 74 },
    }, { id: 'condenser', group: 'condenser', fans: 2 })
  } else {
    condenser = sym('condenser', 36, unitY + 46, 268, 108, 'Lauhdutin', {
      hot: { x: 150, y: 108 },
      liquid: { x: 268, y: 50 },
    }, { id: 'condenser', group: 'unit', fans: 2 })
  }
  symbols.push(condenser)

  const trainY = remote ? unitY + 70 : condenser.ports.liquid.y
  let cursor = remote ? 248 : condenser.x + condenser.w + 28
  let receiver
  let drier
  let glass
  if (acc.receiver) {
    const inletRel = remote ? { x: 24, y: 0 } : { x: 0, y: 54 }
    const outletRel = remote ? { x: 48, y: 78 } : { x: 48, y: 54 }
    const top = remote ? trainY - 8 : trainY - inletRel.y
    receiver = sym('receiver', cursor, top, 48, 112, 'Vastaanotin', {
      inlet: inletRel,
      outlet: outletRel,
    }, { id: 'receiver', group: 'unit' })
    symbols.push(receiver)
    cursor = receiver.x + receiver.w + 26
  }
  const pipeY = receiver ? receiver.ports.outlet.y : trainY
  if (acc.filterDrier) {
    drier = sym('filterDrier', cursor, pipeY - 15, 96, 30, 'Kuivain', {
      inlet: { x: 0, y: 15 },
      outlet: { x: 96, y: 15 },
    }, { id: 'filterDrier', group: 'unit' })
    symbols.push(drier)
    cursor += 122
  }
  if (acc.sightGlass) {
    glass = sym('sightGlass', cursor, pipeY - 15, 32, 30, 'Näkölasi', {
      inlet: { x: 0, y: 15 },
      outlet: { x: 32, y: 15 },
    }, { id: 'sightGlass', group: 'unit' })
    symbols.push(glass)
    cursor += 58
  }

  const valveX = valves[0] ? valves[0].ports.inlet.x : (primary?.ports.liquid.x || sheetW - 80)
  let solenoid
  if (acc.solenoid) {
    solenoid = sym('solenoid', valveX - 17, pipeY - 24, 34, 52, 'Venttiili', {
      inlet: { x: 0, y: 24 },
      outlet: { x: 17, y: 0 },
    }, { id: 'solenoid', group: 'riser' })
    symbols.push(solenoid)
  }

  const compY = remote ? unitY + 262 : unitY + 236
  const compX = acc.oilSeparator ? 132 : 48
  const compressor = sym('compressor', compX, compY, 244, 104, 'Kompressori', {
    discharge: { x: 52, y: 0 },
    suction: { x: 198, y: 0 },
    terminal: { x: 252, y: 40 },
    oil: { x: 0, y: 72 },
  }, { id: 'compressor', group: 'unit' })
  symbols.push(compressor)

  let oil
  if (acc.oilSeparator) {
    oil = sym('oilSeparator', compX - 78, compY + 2, 52, 112, 'Öljynerotin', {
      inlet: { x: 52, y: 70 },
      outlet: { x: 26, y: 0 },
      oil: { x: 52, y: 96 },
    }, { id: 'oilSeparator', group: 'unit' })
    symbols.push(oil)
  }
  let accumulator
  if (acc.accumulator) {
    const accX = Math.max(compX + 300, cursor + 28)
    accumulator = sym('accumulator', accX, compY - 8, 54, 118, 'Imuakku', {
      inlet: { x: 27, y: 0 },
      outlet: { x: 0, y: 64 },
    }, { id: 'accumulator', group: 'unit' })
    symbols.push(accumulator)
  }
  let shell
  if (acc.suctionFilter) {
    const host = accumulator || compressor
    const inlet = accumulator ? { x: 27, y: 0 } : { x: 198, y: 0 }
    shell = sym('suctionFilter', host.x + inlet.x - 38, host.y - 40, 76, 28, 'Imusuodatin', {
      inlet: { x: 38, y: 0 },
      outlet: { x: 38, y: 28 },
    }, { id: 'suctionFilter', group: 'unit' })
    symbols.push(shell)
  }
  if (acc.hpSwitch) {
    const hp = sym('pressostat', compressor.ports.discharge.x - 13, compressor.y - 40, 26, 24, 'HP', {
      cap: { x: 13, y: 24 },
      wire: { x: 0, y: 12 },
    }, { id: 'hp', group: 'unit', tone: 'hp' })
    symbols.push(hp)
    addLine(lines, 'capillary', [hp.ports.cap, compressor.ports.discharge], '')
  }
  if (acc.lpSwitch) {
    const lp = sym('pressostat', compressor.ports.suction.x - 13, compressor.y - 40, 26, 24, 'LP', {
      cap: { x: 13, y: 24 },
      wire: { x: 26, y: 12 },
    }, { id: 'lp', group: 'unit', tone: 'lp' })
    symbols.push(lp)
    addLine(lines, 'capillary', [lp.ports.cap, compressor.ports.suction], '')
  }
  const hp = symbols.find((item) => item.id === 'hp')
  const lp = symbols.find((item) => item.id === 'lp')

  const liquidIn = receiver?.ports.inlet || drier?.ports.inlet || glass?.ports.inlet || solenoid?.ports.inlet || valves[0]?.ports.inlet || primary.ports.liquid
  const returnFloor = remote ? corridorY - 8 : condenser.ports.liquid.y
  const returnPath = remote
    ? [condenser.ports.liquid, { x: condenser.ports.liquid.x, y: returnFloor }, { x: liquidIn.x, y: returnFloor }, liquidIn]
    : [condenser.ports.liquid, { x: liquidIn.x, y: condenser.ports.liquid.y }, liquidIn]
  const returnLine = addLine(lines, 'liquid', returnPath, acc.receiver ? `Neste ${sizes.liquidReturn}` : `Neste ${sizes.liquid}`)
  if (returnLine && !remote && receiver) {
    returnLine.labelLock = {
      x: receiver.x + receiver.w / 2,
      y: condenser.y - 16,
    }
  }
  const train = [receiver, drier, glass].filter(Boolean)
  for (let i = 0; i < train.length - 1; i += 1) {
    addLine(lines, 'liquid', [train[i].ports.outlet, train[i + 1].ports.inlet], '')
  }
  const after = train.length ? train[train.length - 1].ports.outlet : condenser.ports.liquid
  if (solenoid) {
    addLine(lines, 'liquid', [
      after,
      { x: solenoid.ports.inlet.x, y: after.y },
      solenoid.ports.inlet,
    ], '')
    const supplyLabel = acc.receiver ? `Neste ${sizes.liquid}` : ''
    if (valves.length) {
      const riseX = solenoid.ports.outlet.x
      const headY = valves[0].ports.inlet.y
      const coilBottom = evapSymbols[0].y + evapSymbols[0].h
      const manifoldY = (acc.defrostHeater || acc.drainHeater) ? coilBottom + 48 : coilBottom + 16
      if (valves.length === 1) {
        addLine(lines, 'liquid', [
          solenoid.ports.outlet,
          { x: riseX, y: headY },
          valves[0].ports.inlet,
        ], supplyLabel)
      } else {
        addLine(lines, 'liquid', [
          solenoid.ports.outlet,
          { x: riseX, y: manifoldY },
          { x: valves[0].ports.inlet.x, y: manifoldY },
          valves[0].ports.inlet,
        ], supplyLabel)
        valves.slice(1).forEach((valve) => {
          addLine(lines, 'liquid', [
            { x: valves[0].ports.inlet.x, y: manifoldY },
            { x: valve.ports.inlet.x, y: manifoldY },
            valve.ports.inlet,
          ], '')
        })
      }
    } else if (primary) {
      addLine(lines, 'liquid', [
        solenoid.ports.outlet,
        { x: solenoid.ports.outlet.x, y: primary.ports.liquid.y },
        primary.ports.liquid,
      ], supplyLabel)
    }
  } else if (primary) {
    const target = valves[0]?.ports.inlet || primary.ports.liquid
    addLine(lines, 'liquid', [after, { x: target.x, y: after.y }, target], acc.receiver ? `Neste ${sizes.liquid}` : '')
    valves.slice(1).forEach((valve) => {
      addLine(lines, 'liquid', [after, { x: valve.ports.inlet.x, y: after.y }, valve.ports.inlet], '')
    })
  }

  const suctionX = sheetW - 26
  const suctionEnd = shell?.ports.inlet || accumulator?.ports.inlet || compressor.ports.suction
  evapSymbols.forEach((ev, index) => {
    addLine(lines, 'suction', [
      ev.ports.suction,
      { x: ev.ports.suction.x, y: headerY },
      { x: suctionX, y: headerY },
      { x: suctionX, y: suctionEnd.y },
      suctionEnd,
    ], index === 0 ? `Imu ${sizes.suction}` : '')
  })
  if (shell && (accumulator || compressor)) {
    const next = accumulator?.ports.inlet || compressor.ports.suction
    addLine(lines, 'suction', [shell.ports.outlet, next], '')
  }
  if (accumulator && compressor) {
    const from = accumulator.ports.outlet
    const lane = compressor.x + compressor.w + 18
    addLine(lines, 'suction', [
      from,
      { x: lane, y: from.y },
      { x: lane, y: compressor.ports.suction.y },
      compressor.ports.suction,
    ], '')
  }

  const hot = condenser.ports.hot
  if (oil) {
    addLine(lines, 'discharge', [
      compressor.ports.discharge,
      { x: oil.ports.inlet.x, y: compressor.ports.discharge.y },
      oil.ports.inlet,
    ], '')
    const laneY = condenser.y + condenser.h + 18
    const hotLine = addLine(lines, 'discharge', [
      oil.ports.outlet,
      { x: oil.ports.outlet.x, y: laneY },
      { x: hot.x, y: laneY },
      hot,
    ], `Kuumakaasu ${sizes.hotgas}`)
    if (hotLine) hotLine.labelLock = { x: hot.x - 92, y: remote ? unitY + 84 : hot.y + 18 }
    addLine(lines, 'oil', [
      oil.ports.oil,
      { x: compressor.ports.oil.x, y: oil.ports.oil.y },
      compressor.ports.oil,
    ], 'Öljyn paluu')
  } else {
    const hotLine = addLine(lines, 'discharge', [
      compressor.ports.discharge,
      { x: hot.x, y: compressor.ports.discharge.y },
      hot,
    ], `Kuumakaasu ${sizes.hotgas}`)
    if (hotLine) hotLine.labelLock = { x: hot.x - 92, y: remote ? unitY + 84 : hot.y + 18 }
  }

  if (ctrl) {
    const laneX = 24
    const target = hp?.ports.wire || lp?.ports.wire || compressor.ports.terminal
    const controlLine = addLine(lines, 'control', [
      ctrl.ports.t1,
      { x: ctrl.ports.t1.x, y: corridorY },
      { x: laneX, y: corridorY },
      { x: laneX, y: target.y },
      target,
    ], 'Ohjaus')
    if (controlLine) controlLine.labelLock = { x: remote ? 64 : 148, y: remote ? unitY + 156 : unitY + 20 }
    if (hp && lp) {
      const hopY = hp.y - 10
      const riseX = hot.x
      const between = riseX > hp.x + hp.w && riseX < lp.x
      const points = between
        ? [
          { x: hp.x + hp.w, y: hp.y + 12 },
          { x: hp.x + hp.w, y: hopY },
          { x: riseX - 12, y: hopY },
          { x: riseX - 12, y: hopY - 16 },
          { x: riseX + 12, y: hopY - 16 },
          { x: riseX + 12, y: hopY },
          { x: lp.x, y: hopY },
          { x: lp.x, y: lp.y + 12 },
        ]
        : [
          { x: hp.x + hp.w, y: hp.y + 12 },
          { x: hp.x + hp.w, y: hopY },
          { x: lp.x, y: hopY },
          { x: lp.x, y: lp.y + 12 },
        ]
      addLine(lines, 'control', points, '')
    }
    const lastSwitch = lp || hp
    if (lastSwitch) {
      const leave = { x: lastSwitch.x + lastSwitch.w, y: lastSwitch.y + 12 }
      const port = compressor.ports.terminal
      addLine(lines, 'control', [
        leave,
        { x: port.x, y: leave.y },
        port,
      ], '')
    }
    if (solenoid) {
      addLine(lines, 'control', [
        ctrl.ports.t2,
        { x: ctrl.ports.t2.x, y: corridorY + 16 },
        { x: solenoid.x + solenoid.w / 2, y: corridorY + 16 },
        { x: solenoid.x + solenoid.w / 2, y: solenoid.y },
      ], '')
    }
    const heater = symbols.find((item) => item.type === 'defrost')
    if (heater) {
      addLine(lines, 'control', [
        ctrl.ports.t3,
        { x: ctrl.ports.t3.x, y: busY },
        { x: heater.x, y: busY },
        { x: heater.x, y: heater.y + 6 },
      ], '')
    }
    const evapProbe = symbols.find((item) => item.id === 'evap-probe')
    if (evapProbe) {
      addLine(lines, 'sensor', [
        ctrl.ports.t4,
        { x: ctrl.ports.t4.x, y: busY },
        { x: evapProbe.ports.lead.x, y: busY },
        evapProbe.ports.lead,
      ], '')
    }
    const roomProbe = symbols.find((item) => item.id === 'room-probe')
    if (roomProbe) {
      addLine(lines, 'sensor', [
        ctrl.ports.t5,
        { x: ctrl.ports.t5.x, y: busY },
        { x: roomProbe.ports.lead.x, y: busY },
        roomProbe.ports.lead,
      ], '')
    }
  }

  const labels = placeLabels(lines, symbols, boxes, sheetW, height)
  return {
    width: sheetW,
    height,
    remote,
    virtual,
    title,
    projectName,
    refrigerant,
    teC,
    tcC,
    roomTempC,
    capacityKw,
    drawingNo: drawingNo || 'KA-01',
    revision: revision || 'A',
    designer: designer || '',
    date: date || '',
    note: 'Ei mittakaavassa',
    sizes,
    boxes,
    symbols,
    lines,
    labels,
    legend: [
      { kind: 'discharge', label: 'Kuumakaasu' },
      { kind: 'liquid', label: 'Neste' },
      { kind: 'suction', label: 'Imu' },
      { kind: 'oil', label: 'Öljyn paluu' },
      { kind: 'control', label: 'Ohjaus' },
      { kind: 'sensor', label: 'Anturi' },
    ],
  }
}

export function buildSchematics(rooms, settings = {}) {
  const list = rooms || []
  const placed = collect(list)
  const evaps = placed.filter((item) => item.category === 'evaporator' && isRefrigerated(item.room.type))
  const packaged = placed.filter((item) => item.category === 'combo' || item.category === 'unit')
  const compressors = placed.filter((item) => item.category === 'compressor')
  const condensers = placed.filter((item) => item.category === 'condenser')
  const anchors = []
  packaged.forEach((item) => anchors.push({ kind: 'packaged', machine: item, condenser: null, remote: false }))
  const used = new Set()
  compressors.forEach((item) => {
    const free = condensers.filter((cond) => !used.has(cond.id))
    const cond = nearest(item, free.length ? free : condensers)
    if (cond) used.add(cond.id)
    anchors.push({ kind: 'split', machine: item, condenser: cond, remote: true })
  })
  condensers.filter((cond) => !used.has(cond.id) && !compressors.length && !packaged.length).forEach((cond) => {
    anchors.push({ kind: 'split', machine: null, condenser: cond, remote: true })
  })

  const groups = new Map()
  const pool = evaps.slice()
  if (!anchors.length) {
    pool.forEach((evap) => {
      const key = evap.room.id
      if (!groups.has(key)) groups.set(key, { anchor: null, evaps: [] })
      groups.get(key).evaps.push(evap)
    })
  } else {
    anchors.forEach((anchor, index) => groups.set(anchor.machine?.id || anchor.condenser?.id || `a${index}`, { anchor, evaps: [] }))
    pool.forEach((evap) => {
      const keys = [...groups.keys()]
      const best = keys.reduce((win, key) => {
        const group = groups.get(key)
        const point = group.anchor?.machine || group.anchor?.condenser || { x: 0, z: 0 }
        const score = dist(evap, point)
        if (!win || score < win.score) return { key, score }
        return win
      }, null)
      groups.get(best.key).evaps.push(evap)
    })
  }

  const circuits = []
  groups.forEach((group, key) => {
    const room = group.evaps[0]?.room || group.anchor?.machine?.room || list.find((item) => isRefrigerated(item.type)) || list[0]
    const frozen = (room?.temp ?? 2) < 0
    const accessories = {
      ...defaultAccessories({ frozen }),
      ...(settings.overrides?.[key] || {}),
    }
    if (accessories.expansion !== 'txv' && accessories.expansion !== 'eev' && accessories.expansion !== 'none') {
      accessories.expansion = 'txv'
    }
    const teC = Number.isFinite(settings.teC) ? settings.teC : (Number.isFinite(room?.temp) ? Math.round((room.temp - 8) * 10) / 10 : -8)
    const tcC = Number.isFinite(settings.tcC) ? settings.tcC : 40
    const refrigerant = REFRIGERANTS[settings.refrigerant] ? settings.refrigerant : 'R449A'
    const evapKw = group.evaps.reduce((sum, item) => sum + (Number(item.eq.capacityKw) || 0), 0)
    const loadW = settings.loads?.[room?.id] || 0
    const capacityKw = evapKw > 0 ? evapKw : loadW / 1000
    const remote = group.anchor ? group.anchor.remote : false
    const topology = topologyFor(accessories)
    const sizes = lineSizes({ capacityKw, refrigerant, teC, tcC, roomTempC: room?.temp ?? 2 })
    const spec = {
      accessories,
      remote,
      virtual: !group.anchor?.machine,
      evaps: (group.evaps.length ? group.evaps : [{ roomName: room?.name || 'Kylmähuone', name: 'Höyrystin', widthM: 1.2 }]).map((item) => ({
        name: item.eq?.name || item.name || 'Höyrystin',
        roomName: item.room?.name || item.roomName || room?.name || 'Kylmähuone',
        widthM: item.eq?.width || item.widthM || 1.2,
      })),
      sizes,
      roomTempC: room?.temp ?? 2,
      setpoint: room?.temp ?? 2,
      mode: frozen ? 'Pakaste' : 'Jäähdytys',
      title: group.evaps[0]?.room?.name || room?.name || 'Kylmäpiiri',
      projectName: settings.projectName || 'Projekti',
      refrigerant,
      teC,
      tcC,
      capacityKw,
      drawingNo: settings.drawingNo,
      revision: settings.revision,
      designer: settings.designer,
      date: settings.date,
      machineName: group.anchor?.machine?.eq?.name || '',
      condenserName: group.anchor?.condenser?.eq?.name || '',
    }
    const drawing = settings.drawing === 'presentation' ? 'presentation' : 'technical'
    const sheet = drawing === 'presentation' ? layoutCircuit(spec) : layoutPid(spec)
    circuits.push({
      id: key,
      ...sheet,
      drawing,
      accessories,
      topology,
      machineName: spec.machineName,
      condenserName: spec.condenserName,
    })
  })

  return { circuits }
}

export function stackSheets(circuits) {
  const width = Math.max(1100, ...(circuits || []).map((item) => item.width))
  let y = 0
  const sheets = (circuits || []).map((circuit) => {
    const sheet = { ...circuit, offsetY: y }
    y += circuit.height + 24
    return sheet
  })
  return { width, height: y, sheets }
}
