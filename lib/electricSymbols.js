// Schematic symbols in paper millimetres (Sähköinfo / ST).
// A device circle is about 3 mm on the sheet at 1:50. Pipe junctions are
// 1 mm dots and are drawn only at a real tee. The plan multiplies these
// millimetres by the sheet scale. The 3D model keeps the real envelope.

import { placeFlowLabel, placeLineLabels } from './annotations.js'
import { isWallDevice } from './wallDevices.js'

export const SYMBOL_STROKE_MM = 0.2
export const CABLE_LABEL_MM = 1.8
export const DEVICE_TAG_MM = 1.6
export const LABEL_JOIN_MM = 32
export const NODE_DOT_R_MM = 0.5

const BADGE = {
  'heater-control': 'OK',
  stove: 'L',
  heater: 'K',
  oven: 'U',
  radiator: 'P',
  ev: 'EV',
  heatpump: 'LP',
  'iv-unit': 'IV',
  boiler: 'V',
  washer: 'PK',
  dishwasher: 'AP',
  fridge: 'JK',
  dryer: 'KR',
  microwave: 'M',
  tv: 'TV',
  towel: 'PK',
  spa: 'PA',
}

// Named plates drawn as a 3–5 mm box. Width and height are paper millimetres.
const PLATE = {
  ahu: ['IV', 5, 3.4],
  hood: ['LK', 4.4, 3.2],
  manifold: ['JT', 5, 3.2],
  cleanout: ['PL', 3.6, 3.6],
  'kv-manifold': ['KV', 5, 3.2],
  'lv-manifold': ['LV', 5, 3.2],
  'floor-manifold': ['LJT', 5, 3.2],
  'dhw-tank': ['LV', 4.8, 3.4],
  'buffer-tank': ['PV', 4.8, 3.4],
  'heat-source': ['LL', 4.8, 3.4],
  'air-air': ['ILP', 5, 3.2],
  actuator: ['A', 3.2, 3.2],
  thermostat: ['T', 3.2, 3.2],
  'outdoor-terminal': ['UL', 4.2, 3.2],
  'exhaust-terminal': ['JT', 4.2, 3.2],
  'dhw-exchanger': ['LS', 4.4, 3.2],
}

const FIXED = {
  socket: [3, 3],
  switch: [3, 3],
  light: [3, 3],
  junction: [3, 3],
  panel: [5, 3.4],
  data: [3.6, 4.2],
  antenna: [3.6, 4.2],
  valve: [3, 3],
  inlet: [3, 3],
  shutoff: [3, 3],
  'water-point': [3, 3],
  'floor-drain': [3, 3],
  'drain-point': [3, 3],
  'outdoor-tap': [3, 3],
  fixture: [3, 3],
  silencer: [4.8, 3.2],
  'heater-rad': [4.6, 3.2],
}

const INK = {
  tulo: '#dc2626',
  poisto: '#ca8a04',
  ulko: '#2563eb',
  jate: '#166534',
  cold: '#1d4ed8',
  hot: '#dc2626',
  circ: '#ea580c',
  floorheat: '#d97706',
  drain: '#57534e',
  vent: '#78716c',
  electric: '#1c1917',
  'heat-supply': '#dc2626',
  'heat-return': '#2563eb',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function symbolSizeMm(kind) {
  if (FIXED[kind]) return { w: FIXED[kind][0], h: FIXED[kind][1] }
  const plate = PLATE[kind]
  if (plate) return { w: plate[1], h: plate[2] }
  const label = BADGE[kind]
  if (label) return { w: Math.min(5, 2.6 + label.length * 1.05), h: 3.2 }
  return { w: 3, h: 3 }
}

function plateFigures(kind) {
  const plate = PLATE[kind]
  if (!plate) return null
  const [text, w, h] = plate
  return [
    { op: 'rect', x: -w / 2, y: -h / 2, w, h, fill: true },
    { op: 'text', text, size: text.length > 2 ? 1.15 : 1.3, upright: true },
  ]
}

export function symbolFigures(kindOrNode) {
  const node = kindOrNode && typeof kindOrNode === 'object' ? kindOrNode : null
  const kind = node ? node.kind : kindOrNode
  if (kind === 'socket') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'line', x1: -0.32, y1: 0.15, x2: -0.32, y2: 0.95 },
      { op: 'line', x1: 0.32, y1: 0.15, x2: 0.32, y2: 0.95 },
    ]
  }
  if (kind === 'switch') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'line', x1: 0, y1: 0, x2: 0.85, y2: 1.3 },
    ]
  }
  if (kind === 'light') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'line', x1: -0.85, y1: -0.85, x2: 0.85, y2: 0.85 },
      { op: 'line', x1: 0.85, y1: -0.85, x2: -0.85, y2: 0.85 },
    ]
  }
  if (kind === 'junction') {
    return [{ op: 'rect', x: -1.5, y: -1.5, w: 3, h: 3, fill: true }]
  }
  if (kind === 'panel') {
    return [
      { op: 'rect', x: -2.5, y: -1.7, w: 5, h: 3.4, fill: true },
      { op: 'text', text: 'SK', size: 1.5, upright: true },
    ]
  }
  if (kind === 'data') {
    return [{ op: 'poly', points: [[0, -1.8], [1.7, 1.5], [-1.7, 1.5]], fill: true }]
  }
  if (kind === 'antenna') {
    return [
      { op: 'poly', points: [[0, -2], [1.5, 0.7], [-1.5, 0.7]], fill: false },
      { op: 'line', x1: 0, y1: 0.7, x2: 0, y2: 2.1 },
    ]
  }
  if (kind === 'water-point') {
    const both = node?.supply && node.supply !== 'cold'
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'text', text: both ? 'KL' : 'KV', size: 0.9, upright: true },
    ]
  }
  if (kind === 'valve') {
    const tri = node?.role === 'poisto'
      ? [[0, -0.75], [0.65, 0.55], [-0.65, 0.55]]
      : [[0, 0.75], [0.65, -0.55], [-0.65, -0.55]]
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'poly', points: tri, fill: 'ink' },
    ]
  }
  if (kind === 'inlet' || kind === 'drain-point') {
    return [{ op: 'circle', x: 0, y: 0, r: 1.5, fill: 'ink' }]
  }
  if (kind === 'shutoff') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'line', x1: -0.7, y1: -0.7, x2: 0.7, y2: 0.7 },
      { op: 'line', x1: 0.7, y1: -0.7, x2: -0.7, y2: 0.7 },
    ]
  }
  if (kind === 'floor-drain') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.5, fill: true },
      { op: 'line', x1: -0.85, y1: 0, x2: 0.85, y2: 0 },
      { op: 'line', x1: 0, y1: -0.85, x2: 0, y2: 0.85 },
    ]
  }
  if (kind === 'outdoor-tap' || kind === 'fixture') {
    return [{ op: 'circle', x: 0, y: 0, r: 1.5, fill: true }]
  }
  if (kind === 'silencer') {
    return [
      { op: 'rect', x: -2.4, y: -1.6, w: 4.8, h: 3.2, fill: true },
      { op: 'line', x1: -1.6, y1: -1.6, x2: -0.4, y2: 1.6 },
      { op: 'line', x1: -0.4, y1: -1.6, x2: 0.8, y2: 1.6 },
      { op: 'line', x1: 0.8, y1: -1.6, x2: 2, y2: 1.6 },
    ]
  }
  if (kind === 'heater-rad') {
    return [
      { op: 'rect', x: -2.3, y: -1.6, w: 4.6, h: 3.2, fill: true },
      { op: 'line', x1: -1.15, y1: -1.6, x2: -1.15, y2: 1.6 },
      { op: 'line', x1: 0, y1: -1.6, x2: 0, y2: 1.6 },
      { op: 'line', x1: 1.15, y1: -1.6, x2: 1.15, y2: 1.6 },
    ]
  }
  const plate = plateFigures(kind)
  if (plate) return plate
  const label = BADGE[kind]
  if (label) {
    const size = symbolSizeMm(kind)
    return [
      { op: 'rect', x: -size.w / 2, y: -size.h / 2, w: size.w, h: size.h, fill: true },
      { op: 'text', text: label, size: 1.35, upright: true },
    ]
  }
  return [{ op: 'circle', x: 0, y: 0, r: 1.5, fill: true }]
}

export function symbolInk(node) {
  if (!node || node.system === 'electric' || !node.system) return INK.electric
  if (node.system === 'iv') {
    if (node.kind === 'hood' || node.role === 'poisto') return INK.poisto
    if (node.role === 'tulo' || node.kind === 'valve') return INK.tulo
    return '#334155'
  }
  if (node.system === 'water') {
    if ((node.supply && node.supply !== 'cold') || node.kind === 'dhw-tank' || node.kind === 'lv-manifold') return INK.hot
    return INK.cold
  }
  if (node.system === 'heat') return node.kind === 'floor-manifold' ? INK.floorheat : INK['heat-supply']
  if (node.system === 'drain') return INK.drain
  return INK.electric
}

export function runInk(run) {
  if (!run) return INK.electric
  if (run.system === 'iv') return INK[run.kind] || INK.tulo
  if (run.system === 'water') return INK[run.kind] || INK.cold
  if (run.system === 'drain') return run.kind === 'vent' ? INK.vent : INK.drain
  if (run.system === 'heat') {
    if (run.kind === 'collector') return '#0f766e'
    if (run.kind === 'floorheat') return INK.floorheat
    if (run.kind === 'heat-return' || run.role === 'return') return INK['heat-return']
    return INK['heat-supply']
  }
  return INK.electric
}

// Paper line weight. Ducts and drains use the real diameter at the sheet
// ratio. Water and heat PEX is thinner than a pen, so it stays a standard
// thin line. `size` is millimetres of pipe or duct.
export function runStrokeMm(run, ratio = 50) {
  const scale = Number(ratio) > 0 ? Number(ratio) : 50
  const size = Number(run?.size) || 0
  if (!run || run.system === 'electric') return 0.3
  if (run.kind === 'floorheat' || run.role === 'loop' || run.kind === 'efloor' || run.kind === 'ceiling' || run.kind === 'sensor') return 0.22
  if (run.system === 'iv') return clamp(size > 0 ? size / scale : 0.7, 0.35, 5)
  if (run.system === 'drain') return clamp(size > 0 ? size / scale : 0.55, 0.4, 4)
  if (run.system === 'water' || run.system === 'heat') return clamp(size > 0 ? size / scale : 0.32, 0.25, 1.2)
  return 0.3
}

export function runLabelText(run) {
  if (!run || run.hidden) return ''
  if (run.system === 'iv') {
    if (!run.size) return ''
    if (run.role && !['trunk', 'main', 'header'].includes(run.role)) return ''
    const sizeText = `Ø${run.size}`
    return run.flow ? `${sizeText}  ${Math.round(run.flow)} l/s` : sizeText
  }
  if (!run.marking || !run.showMark) return ''
  if (run.system === 'electric' || run.system === 'water' || run.system === 'heat' || run.system === 'drain') return String(run.marking)
  return ''
}

export function longestRunSegment(points, toX, toY) {
  let best = null
  const list = points || []
  for (let i = 1; i < list.length; i += 1) {
    const a = list[i - 1]
    const b = list[i]
    const ax = toX(a.x)
    const ay = toY(a.z)
    const bx = toX(b.x)
    const by = toY(b.z)
    const len = Math.hypot(bx - ax, by - ay)
    if (!best || len > best.len) best = { len, ax, ay, bx, by, index: i }
  }
  return best
}

// One callout per cable text in a neighbourhood. A far copy of the same
// text keeps its own label, so a repeated chain does not stamp every device.
export function groupCableCallouts(segments, join) {
  const limit = Math.max(1, Number(join) || 1)
  const pending = (segments || []).filter((segment) => segment?.text).map((segment) => ({ ...segment }))
  const groups = []
  while (pending.length) {
    let best = 0
    for (let i = 1; i < pending.length; i += 1) {
      if ((pending[i].len || 0) > (pending[best].len || 0)) best = i
    }
    const seed = pending.splice(best, 1)[0]
    const sx = (seed.ax + seed.bx) / 2
    const sy = (seed.ay + seed.by) / 2
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const other = pending[i]
      if (other.text !== seed.text) continue
      const mx = (other.ax + other.bx) / 2
      const my = (other.ay + other.by) / 2
      if (Math.hypot(mx - sx, my - sy) <= limit) pending.splice(i, 1)
    }
    groups.push(seed)
  }
  return groups
}

export function layoutDeviceTags(items, obstacles, font) {
  const tags = []
  ;(items || []).forEach((item) => {
    if (!item?.text) return
    const reach = item.reach || font
    const place = placeFlowLabel(item.cx, item.cy, item.text, font, reach, obstacles)
    if (!place) return
    obstacles.push({ ...place.box, kind: 'label', key: item.id })
    const dist = Math.hypot(place.x, place.y)
    tags.push({
      id: item.id,
      text: item.text,
      dx: place.x,
      dy: place.y,
      anchor: place.anchor,
      leader: dist > reach + font * 0.8,
      ax: item.cx,
      ay: item.cy,
      reach,
    })
  })
  return tags
}

function pdfSafe(value) {
  return String(value ?? '').replace(/×/g, 'x').replace(/Ø/g, 'O').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function rgbOf(hex) {
  const value = String(hex || '#1c1917').replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ]
}

function mapPoint(px, py, rotation, lx, ly) {
  const rad = ((Number(rotation) || 0) * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [px + lx * c + ly * s, py - lx * s + ly * c]
}

function drawPoly(doc, points, fill) {
  if (!points || points.length < 2) return
  const [x, y] = points[0]
  const rel = []
  let cx = x
  let cy = y
  for (let i = 1; i < points.length; i += 1) {
    rel.push([points[i][0] - cx, points[i][1] - cy])
    cx = points[i][0]
    cy = points[i][1]
  }
  rel.push([points[0][0] - cx, points[0][1] - cy])
  doc.lines(rel, x, y, [1, 1], fill ? 'FD' : 'S')
}

function paint(doc, hex, fillHex) {
  const [r, g, b] = rgbOf(hex)
  doc.setDrawColor(r, g, b)
  if (fillHex) {
    const [fr, fg, fb] = rgbOf(fillHex)
    doc.setFillColor(fr, fg, fb)
  }
}

export function drawSchematicSymbol(doc, node, px, py) {
  const kind = node?.kind
  const rotation = isWallDevice(kind) ? node?.rotation : 0
  const at = (lx, ly) => mapPoint(px, py, rotation, lx, ly)
  const ink = symbolInk(node)
  doc.setLineWidth(SYMBOL_STROKE_MM)
  symbolFigures(node || kind).forEach((fig) => {
    const stroke = fig.stroke || ink
    const filled = fig.fill === 'ink' ? stroke : (fig.fill ? '#ffffff' : null)
    paint(doc, stroke, filled || '#ffffff')
    if (fig.op === 'circle') {
      const [x, y] = at(fig.x, fig.y)
      doc.circle(x, y, fig.r, fig.fill ? 'FD' : 'S')
    } else if (fig.op === 'line') {
      const [x1, y1] = at(fig.x1, fig.y1)
      const [x2, y2] = at(fig.x2, fig.y2)
      doc.setLineWidth(SYMBOL_STROKE_MM)
      doc.line(x1, y1, x2, y2)
    } else if (fig.op === 'rect') {
      drawPoly(doc, [
        [fig.x, fig.y],
        [fig.x + fig.w, fig.y],
        [fig.x + fig.w, fig.y + fig.h],
        [fig.x, fig.y + fig.h],
      ].map(([lx, ly]) => at(lx, ly)), Boolean(fig.fill))
    } else if (fig.op === 'poly') {
      drawPoly(doc, fig.points.map(([lx, ly]) => at(lx, ly)), Boolean(fig.fill))
    } else if (fig.op === 'text') {
      const [tr, tg, tb] = rgbOf(fig.tone || '#14120f')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(fig.size * 72 / 25.4)
      doc.setTextColor(tr, tg, tb)
      doc.text(pdfSafe(fig.text), px, py, { align: 'center', baseline: 'middle' })
    }
  })
}

function interiorHit(point, points) {
  if (!points || points.length < 2) return false
  const endA = points[0]
  const endB = points[points.length - 1]
  if (Math.hypot(point.x - endA.x, point.z - endA.z) < 0.05) return false
  if (Math.hypot(point.x - endB.x, point.z - endB.z) < 0.05) return false
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    if (len2 < 1e-8) continue
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2))
    const x = a.x + dx * t
    const z = a.z + dz * t
    if (Math.hypot(point.x - x, point.z - z) > 0.08) continue
    if (Math.hypot(x - a.x, z - a.z) < 0.05 || Math.hypot(x - b.x, z - b.z) < 0.05) continue
    return true
  }
  return false
}

function sheetTees(runs) {
  const tees = []
  ;(runs || []).forEach((run) => {
    const points = run.points || []
    if (points.length < 2) return
    ;[points[0], points[points.length - 1]].forEach((end) => {
      if ((runs || []).some((other) => other !== run && interiorHit(end, other.points))) {
        tees.push({ x: end.x, z: end.z, color: runInk(run) })
      }
    })
  })
  const kept = []
  tees.forEach((point) => {
    if (!kept.some((item) => Math.hypot(item.x - point.x, item.z - point.z) < 0.08)) kept.push(point)
  })
  return kept
}

// Bends stay in the bill of materials. The drawing shows a 1 mm dot at a
// real tee only, never an open circle on every vertex.
export function visibleRouteMarks(fittings) {
  return {
    bends: [],
    tees: (fittings?.tees || []).map((point) => ({ ...point, r: NODE_DOT_R_MM })),
  }
}

function drawPdfTag(doc, tag) {
  if (tag.leader) {
    const len = Math.hypot(tag.dx, tag.dy) || 1
    const inset = Math.min(tag.reach, len * 0.45)
    doc.setDrawColor(90)
    doc.setLineWidth(0.1)
    doc.line(tag.ax + (tag.dx / len) * inset, tag.ay + (tag.dy / len) * inset, tag.ax + tag.dx, tag.ay + tag.dy)
  }
  const align = tag.anchor === 'start' ? 'left' : tag.anchor === 'end' ? 'right' : 'center'
  doc.setTextColor(20)
  doc.text(pdfSafe(tag.text), tag.ax + tag.dx, tag.ay + tag.dy, { align, baseline: 'middle' })
}

export function drawPlanSymbols(doc, { nodes = [], runs = [], X, Y, obstacles = [], systems = null } = {}) {
  const allow = systems ? new Set(systems) : null
  const visible = (item) => item && !item.hidden && (!allow || allow.has(item.system))
  const list = (nodes || []).filter(visible)
  list.forEach((node) => {
    drawSchematicSymbol(doc, node, X(node.x), Y(node.z))
    const size = symbolSizeMm(node.kind)
    obstacles.push({
      x: X(node.x) - size.w / 2,
      y: Y(node.z) - size.h / 2,
      w: size.w,
      h: size.h,
      kind: 'symbol',
    })
  })
  const fittingRuns = (runs || []).filter((run) => visible(run) && run.kind !== 'floorheat' && run.kind !== 'efloor' && run.role !== 'loop')
  sheetTees(fittingRuns).forEach((point) => {
    paint(doc, point.color, point.color)
    doc.setLineWidth(0.05)
    doc.circle(X(point.x), Y(point.z), NODE_DOT_R_MM, 'F')
  })
  const segments = []
  ;(runs || []).forEach((run) => {
    if (!visible(run)) return
    const text = runLabelText(run)
    const best = longestRunSegment(run.points, X, Y)
    if (!text || !best || best.len < 1) return
    segments.push({
      key: run.id,
      routeKey: run.id,
      text,
      color: runInk(run),
      ax: best.ax,
      ay: best.ay,
      bx: best.bx,
      by: best.by,
      len: best.len,
    })
  })
  const font = CABLE_LABEL_MM
  const labels = placeLineLabels(groupCableCallouts(segments, LABEL_JOIN_MM), obstacles, {
    font,
    minLength: font * 0.75,
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(font * 72 / 25.4)
  labels.forEach((item) => {
    if (item.leader) {
      doc.setDrawColor(90)
      doc.setLineWidth(0.12)
      doc.line(item.anchorX, item.anchorY, item.x, item.y)
    }
    doc.setTextColor(20)
    doc.text(pdfSafe(item.text), item.x, item.y, { align: 'center', baseline: 'middle' })
    if (item.box) obstacles.push({ ...item.box, kind: 'label' })
  })
  const tags = layoutDeviceTags(list.filter((node) => node.system === 'electric' && node.circuit && node.kind !== 'panel').map((node) => {
    const size = symbolSizeMm(node.kind)
    return {
      id: node.id,
      cx: X(node.x),
      cy: Y(node.z),
      text: `R${node.circuit}`,
      reach: Math.hypot(size.w, size.h) / 2 + 0.5,
    }
  }), obstacles, DEVICE_TAG_MM)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(DEVICE_TAG_MM * 72 / 25.4)
  tags.forEach((tag) => drawPdfTag(doc, tag))
  const flows = layoutDeviceTags(list.filter((node) => node.flow).map((node) => {
    const size = symbolSizeMm(node.kind)
    return {
      id: `${node.id}-flow`,
      cx: X(node.x),
      cy: Y(node.z),
      text: `${node.flow} l/s`,
      reach: Math.hypot(size.w, size.h) / 2 + 0.4,
    }
  }), obstacles, DEVICE_TAG_MM)
  flows.forEach((tag) => drawPdfTag(doc, tag))
}

export function drawElectricPlanGraphics(doc, options = {}) {
  return drawPlanSymbols(doc, { ...options, systems: ['electric'] })
}
