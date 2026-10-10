// Schematic electrical symbols in paper millimetres (Sähköinfo / ST).
// A socket is about 4 mm on the sheet at 1:50 and at every other ratio.
// The plan multiplies these millimetres by the sheet scale, so the symbol
// grows and shrinks with the drawing. The 3D model keeps the real envelope.

import { placeFlowLabel, placeLineLabels } from './annotations.js'
import { isWallDevice } from './wallDevices.js'

export const SYMBOL_STROKE_MM = 0.2
export const CABLE_LABEL_MM = 1.8
export const DEVICE_TAG_MM = 1.6
export const LABEL_JOIN_MM = 32

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

export function symbolSizeMm(kind) {
  if (kind === 'socket') return { w: 4, h: 4 }
  if (kind === 'switch') return { w: 3.6, h: 3.6 }
  if (kind === 'light') return { w: 4.2, h: 4.2 }
  if (kind === 'junction') return { w: 3.2, h: 3.2 }
  if (kind === 'panel') return { w: 5, h: 3.4 }
  if (kind === 'data' || kind === 'antenna') return { w: 3.6, h: 4.2 }
  const label = BADGE[kind]
  if (label) return { w: Math.min(5, 2.6 + label.length * 1.05), h: 3.2 }
  return { w: 3.6, h: 3.6 }
}

export function symbolFigures(kind) {
  if (kind === 'socket') {
    return [
      { op: 'circle', x: 0, y: 0, r: 2, fill: true },
      { op: 'line', x1: -0.42, y1: 0.2, x2: -0.42, y2: 1.15 },
      { op: 'line', x1: 0.42, y1: 0.2, x2: 0.42, y2: 1.15 },
    ]
  }
  if (kind === 'switch') {
    return [
      { op: 'circle', x: 0, y: 0, r: 1.8, fill: true },
      { op: 'line', x1: 0, y1: 0, x2: 1.15, y2: 2.15 },
    ]
  }
  if (kind === 'light') {
    return [
      { op: 'circle', x: 0, y: 0, r: 2.1, fill: true },
      { op: 'line', x1: -1.2, y1: -1.2, x2: 1.2, y2: 1.2 },
      { op: 'line', x1: 1.2, y1: -1.2, x2: -1.2, y2: 1.2 },
    ]
  }
  if (kind === 'junction') {
    return [{ op: 'rect', x: -1.6, y: -1.6, w: 3.2, h: 3.2, fill: true }]
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
  const label = BADGE[kind]
  if (label) {
    const size = symbolSizeMm(kind)
    return [
      { op: 'rect', x: -size.w / 2, y: -size.h / 2, w: size.w, h: size.h, fill: true },
      { op: 'text', text: label, size: 1.35, upright: true },
    ]
  }
  return [{ op: 'circle', x: 0, y: 0, r: 1.8, fill: true }]
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
  return String(value ?? '').replace(/×/g, 'x').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
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

export function drawSchematicSymbol(doc, node, px, py) {
  const kind = node?.kind
  const rotation = isWallDevice(kind) ? node?.rotation : 0
  const at = (lx, ly) => mapPoint(px, py, rotation, lx, ly)
  doc.setDrawColor(28)
  doc.setFillColor(255, 255, 255)
  doc.setLineWidth(SYMBOL_STROKE_MM)
  symbolFigures(kind).forEach((fig) => {
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
      ].map(([lx, ly]) => at(lx, ly)), fig.fill)
    } else if (fig.op === 'poly') {
      drawPoly(doc, fig.points.map(([lx, ly]) => at(lx, ly)), fig.fill)
    } else if (fig.op === 'text') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(fig.size * 72 / 25.4)
      doc.setTextColor(20)
      doc.text(pdfSafe(fig.text), px, py, { align: 'center', baseline: 'middle' })
    }
  })
}

export function drawElectricPlanGraphics(doc, { nodes = [], runs = [], X, Y, obstacles = [] } = {}) {
  const electric = (nodes || []).filter((node) => node && node.system === 'electric' && !node.hidden)
  electric.forEach((node) => {
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
  const segments = []
  ;(runs || []).forEach((run) => {
    if (!run || run.system !== 'electric' || run.hidden || !run.showMark || !run.marking) return
    const best = longestRunSegment(run.points, X, Y)
    if (!best || best.len < 1) return
    segments.push({
      key: run.id,
      routeKey: run.id,
      text: run.marking,
      color: '#1c1917',
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
  doc.setTextColor(20)
  labels.forEach((item) => {
    if (item.leader) {
      doc.setDrawColor(90)
      doc.setLineWidth(0.12)
      doc.line(item.anchorX, item.anchorY, item.x, item.y)
    }
    doc.text(pdfSafe(item.text), item.x, item.y, { align: 'center', baseline: 'middle' })
    if (item.box) obstacles.push({ ...item.box, kind: 'label' })
  })
  const tags = layoutDeviceTags(electric.filter((node) => node.circuit && node.kind !== 'panel').map((node) => {
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
  tags.forEach((tag) => {
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
  })
}
