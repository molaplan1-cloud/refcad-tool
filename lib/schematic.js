// Principle diagram (P&ID) generated from the placed rooms. Pipe diameters come
// from the same screening sizer as the plan. The condenser-to-receiver liquid
// segment is one copper size larger than the supply line at the same duty,
// because liquid leaving a condenser can carry bubbles.

import { isRefrigerated } from './catalog.js'
import { COPPER, REFRIGERANTS, sizeLine } from './pipeSizing.js'

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

const RHO_DIS = { R404A: 66, R449A: 70, R452A: 68, R134a: 38, R290: 22, R744: 140 }

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
  const basis = sizeLine({
    kind: 'suction', refrigerant, capacityKw, teC, tcC, lengthM, riseM: 0, roomTempC: 5,
  })
  const mass = basis.massFlowKgS
  const rho = Math.max(8, (RHO_DIS[refrigerant] || RHO_DIS.R449A) + (tcC - 40) * 1.5)
  if (!(mass > 0)) return { odMm: 0, inch: '', label: '' }
  let chosen = COPPER[COPPER.length - 1]
  for (const tube of COPPER) {
    const idM = (tube.odMm - 2 * tube.wallMm) / 1000
    const velocity = mass / (rho * Math.PI * idM * idM / 4)
    if (velocity <= 15) {
      chosen = tube
      break
    }
  }
  return { odMm: chosen.odMm, inch: chosen.inch, label: mmLabel(chosen.odMm, chosen.inch) }
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

function captionBox(symbol) {
  const textW = Math.max(28, (symbol.label || '').length * 7.2)
  const below = ['receiver', 'oilSeparator', 'accumulator', 'filterDrier', 'suctionFilter', 'sightGlass'].includes(symbol.type)
  if (symbol.type === 'solenoid') return { x: symbol.x - 8 - textW, y: symbol.y + 1, w: textW, h: 15 }
  if (symbol.type === 'pressostat' || symbol.type === 'defrost' || symbol.type === 'drainHeater') return null
  if (below) return { x: symbol.x + symbol.w / 2 - textW / 2, y: symbol.y + symbol.h + 1, w: textW, h: 16 }
  return { x: symbol.x + symbol.w / 2 - textW / 2, y: symbol.y - 20, w: textW, h: 16 }
}

function labelSize(text) {
  return { w: Math.max(36, (text || '').length * 6.6), h: 16 }
}

function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad
}

function labelRect(x, y, text) {
  const { w, h } = labelSize(text)
  return { x: x - w / 2, y: y - 12, w, h }
}

function insideSheet(rect, width, height) {
  return rect.x >= 6 && rect.y >= 8 && rect.x + rect.w <= width - 6 && rect.y + rect.h <= height - 72
}

function blockedLabel(rect, obstacles, placed) {
  if (obstacles.some((obstacle) => rectsOverlap(rect, obstacle, 1))) return true
  return placed.some((other) => rectsOverlap(rect, labelRect(other.x, other.y, other.text), 2))
}

function placeLabels(lines, symbols, boxes, width, height) {
  const obstacles = [
    ...symbols.map((symbol) => ({ x: symbol.x - 2, y: symbol.y - 2, w: symbol.w + 4, h: symbol.h + 4 })),
    ...symbols.map(captionBox).filter(Boolean),
    ...boxes.map((box) => ({ x: box.x + 10, y: box.y + 6, w: Math.min(box.w - 20, box.title.length * 8 + 12), h: 18 })),
  ]
  lines.forEach((line) => {
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const x = Math.min(start.x, point.x) - 7
      const y = Math.min(start.y, point.y) - 7
      obstacles.push({
        x,
        y,
        w: Math.max(14, Math.abs(point.x - start.x) + 14),
        h: Math.max(14, Math.abs(point.y - start.y) + 14),
      })
    })
  })
  const placed = []
  const shifts = [[0, -1], [0, 1], [-1, 0], [1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]
  lines.filter((line) => line.label).forEach((line) => {
    const { w, h } = labelSize(line.label)
    const seeds = []
    line.points.forEach((point, index) => {
      if (!index) return
      const start = line.points[index - 1]
      const len = Math.hypot(point.x - start.x, point.y - start.y)
      if (len < 20) return
      const nx = -(point.y - start.y) / len
      const ny = (point.x - start.x) / len
      const gap = w / 2 + 16
      ;[0.35, 0.62].forEach((t) => {
        const mx = start.x + (point.x - start.x) * t
        const my = start.y + (point.y - start.y) * t
        ;[1, -1].forEach((side) => seeds.push({ x: mx + nx * gap * side, y: my + ny * gap * side, len }))
      })
    })
    seeds.sort((a, b) => b.len - a.len)
    let chosen = null
    seeds.some((seed) => {
      for (let radius = 0; radius <= 180 && !chosen; radius += 10) {
        const ring = radius === 0 ? [[0, 0]] : shifts
        ring.some(([dx, dy]) => {
          const x = seed.x + dx * radius
          const y = seed.y + dy * radius
          const rect = labelRect(x, y, line.label)
          if (!insideSheet(rect, width, height) || blockedLabel(rect, obstacles, placed, line.label)) return false
          chosen = { x, y }
          return true
        })
      }
      return !!chosen
    })
    const fallback = chosen || seeds[0] || { x: line.labelPos.x, y: line.labelPos.y }
    placed.push({
      id: line.id,
      text: line.label,
      x: Math.max(w / 2 + 6, Math.min(width - w / 2 - 6, fallback.x)),
      y: Math.max(16, Math.min(height - 78, fallback.y)),
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
  const { accessories: acc, remote, evaps, sizes, roomTempC, setpoint, mode, title, projectName, refrigerant, teC, tcC, capacityKw, virtual } = spec
  const evapCount = Math.max(1, evaps.length)
  const roomW = evapCount === 1 ? 620 : 440
  const gap = 28
  const roomsW = evapCount * roomW + (evapCount - 1) * gap
  const roomsX = 210
  const riseX = roomsX + roomsW + 52
  const suctionDropX = riseX + 70
  const width = Math.max(1280, suctionDropX + 28)
  const height = 980
  const roomY = 18
  const roomH = 248
  const boxes = []
  const symbols = []
  const lines = []
  const evapSymbols = []

  evaps.forEach((evap, index) => {
    const x = roomsX + index * (roomW + gap)
    const roomTitle = evap.roomName || 'Kylmähuone'
    boxes.push({ id: `room-${index}`, role: 'room', x, y: roomY, w: roomW, h: roomH, title: roomTitle })
    const ev = sym('evaporator', x + roomW * 0.34, roomY + 78, 230, 112, evap.name || 'Höyrystin', {
      suction: { x: 200, y: 0 },
      liquid: { x: 230, y: 78 },
    }, { id: `evaporator-${index}`, group: 'room', fans: 2 })
    symbols.push(ev)
    evapSymbols.push(ev)
    if (acc.expansion === 'txv' || acc.expansion === 'eev') {
      const valveType = acc.expansion === 'eev' ? 'eev' : 'txv'
      const valve = sym(valveType, x + roomW - 92, roomY + 108, 62, 54, valveType === 'eev' ? 'EEV' : 'TXV', {
        inlet: { x: 31, y: 54 },
        outlet: { x: 0, y: 28 },
      }, { id: `${valveType}-${index}`, group: 'room' })
      symbols.push(valve)
      addLine(lines, 'liquid', [valve.ports.outlet, { x: ev.ports.liquid.x, y: valve.ports.outlet.y }, ev.ports.liquid], '')
    }
    if (acc.defrostHeater) {
      symbols.push(sym('defrost', ev.x + 16, ev.y + ev.h - 8, 70, 18, 'Sulatus', {}, { id: `defrost-${index}`, group: 'room' }))
    }
    if (acc.drainHeater) {
      symbols.push(sym('drainHeater', ev.x + 120, ev.y + ev.h + 6, 54, 16, 'Valutus', {}, { id: `drain-${index}`, group: 'room' }))
    }
  })

  const primary = evapSymbols[0]
  const ctrl = acc.controller
    ? sym('controller', 16, roomY + 58, 168, 112, 'Ohjain', {
      out: { x: 168, y: 56 },
    }, {
      id: 'controller',
      group: 'room',
      setpoint: Number.isFinite(setpoint) ? setpoint : 2,
      mode,
    })
    : null
  if (ctrl) symbols.push(ctrl)

  let condenser
  let receiver
  let drier
  let glass
  let solenoid
  let compressor
  let oil
  let accumulator
  let shell

  if (remote) {
    boxes.push({ id: 'condenser-box', role: 'condenser', x: 16, y: 292, w: 320, h: 188, title: 'Lauhdutin' })
    condenser = sym('condenser', 48, 328, 240, 112, 'Lauhdutin', {
      hot: { x: 120, y: 112 },
      liquid: { x: 240, y: 56 },
    }, { id: 'condenser', group: 'condenser' })
    symbols.push(condenser)
    boxes.push({ id: 'unit-box', role: 'unit', x: 360, y: 520, w: width - 400, h: 340, title: virtual ? 'Kompressoriyksikkö (ei pohjassa)' : 'Kompressoriyksikkö' })
  } else {
    boxes.push({
      id: 'unit-box',
      role: 'unit',
      x: 16,
      y: 300,
      w: width - 32,
      h: 560,
      title: virtual ? 'Koneikko (ei pohjassa)' : 'Koneikko',
    })
    condenser = sym('condenser', 48, 360, 240, 112, 'Lauhdutin', {
      hot: { x: 40, y: 112 },
      liquid: { x: 240, y: 40 },
    }, { id: 'condenser', group: 'unit' })
    symbols.push(condenser)
  }

  const unit = boxes.find((box) => box.role === 'unit')
  const liquidY = remote ? unit.y + 56 : unit.y + 78
  let cursor = unit.x + (remote ? 36 : 320)
  if (acc.receiver) {
    receiver = sym('receiver', cursor, liquidY - 20, 48, 108, 'Vastaanotin', {
      inlet: { x: 0, y: 54 },
      outlet: { x: 48, y: 54 },
    }, { id: 'receiver', group: 'unit' })
    symbols.push(receiver)
    cursor += 64
  }
  const trainY = acc.receiver ? liquidY + 34 : liquidY + 26
  if (acc.filterDrier) {
    drier = sym('filterDrier', cursor, trainY - 18, 92, 36, 'Kuivain', {
      inlet: { x: 0, y: 18 },
      outlet: { x: 92, y: 18 },
    }, { id: 'filterDrier', group: 'unit' })
    symbols.push(drier)
    cursor += 108
  }
  if (acc.sightGlass) {
    glass = sym('sightGlass', cursor, trainY - 18, 36, 36, 'Näkölasi', {
      inlet: { x: 0, y: 18 },
      outlet: { x: 36, y: 18 },
    }, { id: 'sightGlass', group: 'unit' })
    symbols.push(glass)
    cursor += 56
  }

  const compY = remote ? unit.y + 180 : unit.y + 300
  compressor = sym('compressor', unit.x + (acc.oilSeparator ? 130 : (remote ? 48 : 70)), compY, 220, 100, 'Kompressori', {
    discharge: { x: 46, y: 0 },
    suction: { x: 180, y: 0 },
  }, { id: 'compressor', group: 'unit' })
  symbols.push(compressor)
  if (acc.oilSeparator) {
    oil = sym('oilSeparator', compressor.x - 78, compressor.y - 10, 58, 118, 'Öljynerotin', {
      inlet: { x: 29, y: 118 },
      outlet: { x: 29, y: 0 },
      oil: { x: 58, y: 90 },
    }, { id: 'oilSeparator', group: 'unit' })
    symbols.push(oil)
  }
  if (acc.accumulator) {
    accumulator = sym('accumulator', compressor.x + 280, compressor.y - 16, 62, 124, 'Imuakku', {
      inlet: { x: 31, y: 0 },
      outlet: { x: 0, y: 70 },
    }, { id: 'accumulator', group: 'unit' })
    symbols.push(accumulator)
  }
  if (acc.suctionFilter) {
    const host = accumulator || compressor
    shell = sym('suctionFilter', host.x - 100, host.y + 20, 84, 40, 'Imusuodatin', {
      inlet: { x: 42, y: 0 },
      outlet: { x: 0, y: 20 },
    }, { id: 'suctionFilter', group: 'unit' })
    symbols.push(shell)
  }
  if (acc.hpSwitch) {
    symbols.push(sym('pressostat', compressor.x + 12, compressor.y + 16, 34, 28, 'HP', {}, { id: 'hp', group: 'unit', tone: 'hp' }))
  }
  if (acc.lpSwitch) {
    symbols.push(sym('pressostat', compressor.x + 156, compressor.y + 16, 34, 28, 'LP', {}, { id: 'lp', group: 'unit', tone: 'lp' }))
  }

  if (acc.solenoid) {
    solenoid = sym('solenoid', riseX - 18, remote ? 360 : unit.y + 70, 36, 52, 'Venttiili', {
      inlet: { x: 18, y: 52 },
      outlet: { x: 18, y: 0 },
    }, { id: 'solenoid', group: 'riser' })
    symbols.push(solenoid)
  }

  const liquidIn = receiver?.ports.inlet || drier?.ports.inlet || glass?.ports.inlet || solenoid?.ports.inlet || primary.ports.liquid
  addLine(lines, 'liquid', [
    condenser.ports.liquid,
    { x: liquidIn.x, y: condenser.ports.liquid.y },
    liquidIn,
  ], acc.receiver ? `Neste ${sizes.liquidReturn}` : `Neste ${sizes.liquid}`)

  const train = [receiver, drier, glass].filter(Boolean)
  for (let i = 0; i < train.length - 1; i += 1) {
    addLine(lines, 'liquid', [train[i].ports.outlet, train[i + 1].ports.inlet], '')
  }
  const lastTrain = train[train.length - 1]
  const after = lastTrain?.ports.outlet || condenser.ports.liquid
  if (solenoid) {
    addLine(lines, 'liquid', approachPort(after, solenoid.ports.inlet, solenoid), acc.receiver ? `Neste ${sizes.liquid}` : '')
    const valve = symbols.find((item) => item.id.startsWith('txv') || item.id.startsWith('eev'))
    const outletTarget = valve?.ports.inlet || primary.ports.liquid
    addLine(lines, 'liquid', approachPort(solenoid.ports.outlet, outletTarget, solenoid), '')
  } else {
    const valve = symbols.find((item) => item.id.startsWith('txv') || item.id.startsWith('eev'))
    const target = valve?.ports.inlet || primary.ports.liquid
    addLine(lines, 'liquid', [after, { x: target.x, y: after.y }, target], acc.receiver ? `Neste ${sizes.liquid}` : '')
  }

  evapSymbols.forEach((ev, index) => {
    if (index === 0) return
    const valve = symbols.find((item) => item.id === `txv-${index}` || item.id === `eev-${index}`)
    if (!valve) return
    addLine(lines, 'liquid', [
      solenoid ? solenoid.ports.outlet : after,
      { x: valve.ports.inlet.x, y: solenoid ? solenoid.ports.outlet.y : after.y },
      valve.ports.inlet,
    ], '')
  })

  evapSymbols.forEach((ev, index) => {
    const end = shell?.ports.inlet || accumulator?.ports.inlet || compressor.ports.suction
    const headerY = roomY + 40
    addLine(lines, 'suction', [
      ev.ports.suction,
      { x: ev.ports.suction.x, y: headerY },
      { x: suctionDropX, y: headerY },
      { x: suctionDropX, y: end.y },
      end,
    ], index === 0 ? `Imu ${sizes.suction}` : '')
  })
  if (shell && accumulator) addLine(lines, 'suction', [shell.ports.outlet, accumulator.ports.inlet], '')
  if ((shell || accumulator) && compressor) {
    const from = accumulator?.ports.outlet || shell?.ports.outlet
    if (from) addLine(lines, 'suction', [from, { x: from.x, y: compressor.ports.suction.y }, compressor.ports.suction], '')
  }

  const hotTarget = condenser.ports.hot
  const dischargeX = remote ? unit.x + 18 : compressor.ports.discharge.x
  if (oil) {
    addLine(lines, 'discharge', [compressor.ports.discharge, { x: oil.ports.inlet.x, y: compressor.ports.discharge.y }, oil.ports.inlet], '')
    addLine(lines, 'discharge', [
      oil.ports.outlet,
      { x: oil.ports.outlet.x, y: Math.min(oil.ports.outlet.y, hotTarget.y) - 24 },
      { x: hotTarget.x, y: Math.min(oil.ports.outlet.y, hotTarget.y) - 24 },
      hotTarget,
    ], `Kuumakaasu ${sizes.hotgas}`)
    addLine(lines, 'oil', [oil.ports.oil, { x: compressor.x + 8, y: oil.ports.oil.y }], 'Öljyn paluu')
  } else {
    addLine(lines, 'discharge', [
      compressor.ports.discharge,
      { x: dischargeX, y: compressor.ports.discharge.y },
      { x: dischargeX, y: hotTarget.y },
      hotTarget,
    ], `Kuumakaasu ${sizes.hotgas}`)
  }

  if (ctrl) {
    const compSide = { x: compressor.x, y: compressor.y + compressor.h * 0.55 }
    addLine(lines, 'control', [
      { x: ctrl.x, y: ctrl.y + ctrl.h * 0.45 },
      { x: 8, y: ctrl.y + ctrl.h * 0.45 },
      { x: 8, y: compSide.y },
      compSide,
    ], 'Ohjaus')
    if (solenoid) {
      const under = roomY + roomH + 10
      addLine(lines, 'control', [
        { x: ctrl.x + 24, y: ctrl.y + ctrl.h },
        { x: ctrl.x + 24, y: under },
        { x: solenoid.x + solenoid.w / 2, y: under },
        { x: solenoid.x + solenoid.w / 2, y: solenoid.y },
      ], '')
    }
    if (acc.evapProbe) {
      addLine(lines, 'sensor', [
        { x: ctrl.x + ctrl.w, y: ctrl.y + 36 },
        { x: primary.x, y: ctrl.y + 36 },
        { x: primary.x, y: primary.y + primary.h * 0.35 },
      ], 'Höyrystinanturi')
    }
    if (acc.roomProbe) {
      addLine(lines, 'sensor', [
        { x: ctrl.x + ctrl.w, y: ctrl.y + ctrl.h - 18 },
        { x: roomsX + 36, y: ctrl.y + ctrl.h - 18 },
        { x: roomsX + 36, y: roomY + roomH - 22 },
      ], 'Huoneanturi')
    }
  }

  const labels = placeLabels(lines, symbols, boxes, width, height)

  return {
    width,
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
    const sheet = layoutCircuit({
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
    })
    circuits.push({
      id: key,
      ...sheet,
      accessories,
      topology,
      machineName: group.anchor?.machine?.eq?.name || '',
      condenserName: group.anchor?.condenser?.eq?.name || '',
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
