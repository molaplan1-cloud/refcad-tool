export function annotationFont(k, zoom, paperMm = 2.3, screenCap = 14) {
  const scale = Math.max(0.2, Number(k) || 1)
  const view = Math.max(0.2, Number(zoom) || 1)
  const paper = paperMm * scale
  return Math.min(paper, screenCap / view)
}

export function paperFont(k, zoom, paperMm) {
  const cap = Math.round(paperMm * (14 / 2.3) * 10) / 10
  return annotationFont(k, zoom, paperMm, cap)
}

// Baseline-to-baseline distance, in font heights. A smaller step lets the
// next line's caps sit inside the line above.
export const LINE_LEADING = 1.3

export function lineStep(font) {
  return Math.max(0.5, Number(font) || 1) * LINE_LEADING
}

export function pdfLeadingMm(fontPt) {
  const pt = Math.max(1, Number(fontPt) || 1)
  return (pt * 25.4 / 72) * LINE_LEADING
}

// Height of `count` lines at `font`, including the cap of the first line,
// the descender of the last, and the reserved bands above and below.
export function blockHeightForLines({ count, font, top = 0, bottom = 0 }) {
  const n = Math.max(1, Math.round(Number(count) || 1))
  const size = Math.max(0.5, Number(font) || 1)
  const em = 0.8 + LINE_LEADING * (n - 1) + 0.25
  return Number(top) + Number(bottom) + em * size
}

// Place baselines inside a block. The preferred font shrinks until the
// stack fits; the step stays LINE_LEADING × the font that is used.
export function fitLines({ height, count, font, top = 0, bottom = 0 }) {
  const n = Math.max(1, Math.round(Number(count) || 1))
  const preferred = Math.max(0.5, Number(font) || 1)
  const band = Math.max(0.5, Number(height) - Number(top) - Number(bottom))
  const em = 0.8 + LINE_LEADING * (n - 1) + 0.25
  const size = Math.min(preferred, band / em)
  const step = size * LINE_LEADING
  const first = Number(top) + size * 0.8
  const ys = Array.from({ length: n }, (_, index) => first + step * index)
  return { font: size, step, ys, leading: LINE_LEADING }
}

export function dimensionFont(zoom, screenPx = 12) {
  const view = Math.max(0.2, Number(zoom) || 1)
  return screenPx / view
}

export function placeDimensionText(length, label, fontSize) {
  const text = String(label ?? '')
  const size = Math.max(1, Number(fontSize) || 1)
  const textW = Math.max(size * 2, text.length * size * 0.62)
  const pad = size * 0.55
  const fits = length >= textW + pad * 2
  return {
    mode: fits ? 'gap' : 'leader',
    textW,
    gap: fits ? textW + pad : 0,
  }
}

export function textBox(cx, cy, text, font) {
  const size = Math.max(1, font)
  const w = Math.max(size * 2.2, String(text || '').length * size * 0.58)
  const h = size * 1.25
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function boxesOverlap(a, b, pad = 2) {
  return a.x < b.x + b.w + pad
    && a.x + a.w + pad > b.x
    && a.y < b.y + b.h + pad
    && a.y + a.h + pad > b.y
}

function fitInside(box, bounds) {
  if (!bounds) return { box, moved: false }
  const minX = bounds.x + 2
  const minY = bounds.y + 2
  const maxX = Math.max(minX, bounds.x + bounds.w - box.w - 2)
  const maxY = Math.max(minY, bounds.y + bounds.h - box.h - 2)
  const x = Math.min(Math.max(box.x, minX), maxX)
  const y = Math.min(Math.max(box.y, minY), maxY)
  return {
    box: { ...box, x, y },
    moved: Math.abs(x - box.x) > 0.5 || Math.abs(y - box.y) > 0.5,
  }
}

const HARD = new Set(['room', 'dim', 'symbol', 'legend', 'chrome', 'label', 'route'])

function penalty(box, blocks, ownKey) {
  let score = 0
  blocks.forEach((block) => {
    if (ownKey && block.key === ownKey) return
    const pad = block.kind === 'route' ? 0 : 2
    if (!boxesOverlap(box, block, pad)) return
    score += HARD.has(block.kind) ? 5000 : 40
  })
  return score
}

function overlapArea(a, b) {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (x <= 0 || y <= 0) return 0
  return x * y
}

export function routeStrokeBoxes(segments, pad = 2.2) {
  return (segments || []).flatMap((segment) => {
    const len = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1)
    if (len < 0.5) {
      if (!segment.riser) return []
      return [{ x: segment.x1 - 6.5, y: segment.y1 - 6.5, w: 13, h: 13, kind: 'route', key: segment.key }]
    }
    return [{
      x: Math.min(segment.x1, segment.x2) - pad,
      y: Math.min(segment.y1, segment.y2) - pad,
      w: Math.abs(segment.x2 - segment.x1) + pad * 2,
      h: Math.abs(segment.y2 - segment.y1) + pad * 2,
      kind: 'route',
      key: segment.key,
    }]
  })
}

export function placeFlowLabel(cx, cy, text, font, reach, obstacles) {
  const size = Math.max(1, font)
  const w = Math.max(size * 3.2, String(text || '').length * size * 0.62 + size * 1.2)
  const h = size * 1.45
  const clear = Math.max(reach || 0, h)
  const steps = [0, h, h * 2.2]
  const candidates = []
  steps.forEach((extra) => {
    const side = clear + extra
    const rise = clear + h * 0.55 + extra
    candidates.push(
      { anchor: 'start', x: side, y: 0 },
      { anchor: 'end', x: -side, y: 0 },
      { anchor: 'middle', x: 0, y: -rise },
      { anchor: 'middle', x: 0, y: rise },
      { anchor: 'start', x: side * 0.85, y: -rise * 0.7 },
      { anchor: 'end', x: -side * 0.85, y: -rise * 0.7 },
      { anchor: 'start', x: side * 0.85, y: rise * 0.7 },
      { anchor: 'end', x: -side * 0.85, y: rise * 0.7 },
    )
  })
  const blocks = obstacles || []
  const placed = candidates.map((item, index) => {
    const left = item.anchor === 'start' ? cx + item.x : item.anchor === 'end' ? cx + item.x - w : cx + item.x - w / 2
    const box = { x: left, y: cy + item.y - h / 2, w, h }
    let routeHit = 0
    let textHit = 0
    let symbolHit = 0
    blocks.forEach((block) => {
      const area = overlapArea(box, block)
      if (!area) return
      if (block.kind === 'route') routeHit += area
      else if (block.kind === 'symbol') symbolHit += area
      else textHit += area
    })
    return { ...item, box, routeHit, textHit, symbolHit, dist: Math.hypot(item.x, item.y), index }
  })
  placed.sort((a, b) => a.routeHit - b.routeHit || a.textHit - b.textHit || a.symbolHit - b.symbolHit || a.dist - b.dist || a.index - b.index)
  return placed[0]
}

export function placeLineLabels(segments, obstacles, options = {}) {
  const font = Math.max(1, options.font || 8)
  const bounds = options.bounds || null
  const minLength = options.minLength || font * 3
  const placed = []
  const blocks = [...(obstacles || [])]
  ;(segments || []).forEach((segment) => {
    const dx = segment.bx - segment.ax
    const dy = segment.by - segment.ay
    const len = Math.hypot(dx, dy)
    if (len < minLength || !segment.text) return
    const nx = -dy / len
    const ny = dx / len
    const along = [0.5, 0.32, 0.68, 0.2, 0.8, 0.12, 0.88]
    const textW = textBox(0, 0, segment.text, font).w
    const vertical = Math.abs(dy) > Math.abs(dx)
    const clear = vertical ? textW / 2 + font * 0.8 : font * 1.45
    const beside = [clear, clear + font]
    const leaders = [clear + font * 3, clear + font * 7, clear + font * 12, clear + font * 18]
    let best = null
    const consider = (t, gap, sign, leader) => {
      const anchorX = segment.ax + dx * t
      const anchorY = segment.ay + dy * t
      const cx = anchorX + nx * gap * sign
      const cy = anchorY + ny * gap * sign
      const raw = textBox(cx, cy, segment.text, font)
      const fitted = fitInside(raw, bounds)
      const box = fitted.box
      let score = (leader || fitted.moved ? 8 : 0) + gap * 0.02 + Math.abs(t - 0.5) * 4
      if (fitted.moved) score += Math.hypot(box.x - raw.x, box.y - raw.y) * 0.15
      score += penalty(box, blocks, segment.routeKey || segment.key)
      if (!best || score < best.score) {
        best = { score, leader: leader || fitted.moved, anchorX, anchorY, cx: box.x + box.w / 2, cy: box.y + box.h / 2, box }
      }
    }
    along.forEach((t) => [1, -1].forEach((sign) => beside.forEach((gap) => consider(t, gap, sign, false))))
    if (!best || best.score >= 1000) {
      along.forEach((t) => [1, -1].forEach((sign) => leaders.forEach((gap) => consider(t, gap, sign, true))))
    }
    if (!best || best.score >= 5000) return
    const item = {
      key: segment.key,
      text: segment.text,
      color: segment.color,
      x: best.cx,
      y: best.cy,
      anchorX: best.anchorX,
      anchorY: best.anchorY,
      leader: best.leader || Math.hypot(best.cx - best.anchorX, best.cy - best.anchorY) > font * 2.2,
      box: best.box,
    }
    placed.push(item)
    blocks.push({ ...best.box, kind: 'label' })
  })
  return placed
}
