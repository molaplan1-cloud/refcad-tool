export function annotationFont(k, zoom, paperMm = 2.3, screenCap = 14) {
  const scale = Math.max(0.2, Number(k) || 1)
  const view = Math.max(0.2, Number(zoom) || 1)
  const paper = paperMm * scale
  return Math.min(paper, screenCap / view)
}

export function textBox(cx, cy, text, font) {
  const size = Math.max(1, font)
  const w = Math.max(size * 2.2, String(text || '').length * size * 0.58)
  const h = size * 1.25
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function flowSize(text, font) {
  const size = Math.max(1, font)
  return {
    w: Math.max(size * 3.2, String(text || '').length * size * 0.62 + size * 1.2),
    h: size * 1.45,
  }
}

function overlapArea(a, b) {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (x <= 0 || y <= 0) return 0
  return x * y
}

export function placeFlowLabel(cx, cy, text, font, reach, obstacles) {
  const { w, h } = flowSize(text, font)
  const clear = Math.max(reach || 0, h)
  const steps = [0, h * 0.9, h * 1.8]
  const candidates = []
  steps.forEach((extra) => {
    const side = clear + extra
    const rise = clear + h / 2 + extra
    candidates.push(
      { anchor: 'start', x: side, y: 0 },
      { anchor: 'end', x: -side, y: 0 },
      { anchor: 'middle', x: 0, y: -rise },
      { anchor: 'middle', x: 0, y: rise },
    )
  })
  const blocks = obstacles || []
  const placed = candidates.map((item, index) => {
    const left = item.anchor === 'start' ? cx + item.x : item.anchor === 'end' ? cx + item.x - w : cx + item.x - w / 2
    const box = { x: left, y: cy + item.y - h / 2, w, h }
    let textHit = 0
    let symbolHit = 0
    blocks.forEach((block) => {
      const area = overlapArea(box, block)
      if (!area) return
      if (block.kind === 'symbol') symbolHit += area
      else textHit += area
    })
    return { ...item, box, textHit, symbolHit, dist: Math.hypot(item.x, item.y), index }
  })
  placed.sort((a, b) => a.textHit - b.textHit || a.symbolHit - b.symbolHit || a.dist - b.dist || a.index - b.index)
  return placed[0]
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

const HARD = new Set(['room', 'dim', 'symbol', 'legend', 'chrome', 'label'])

function hitKinds(box, blocks) {
  const kinds = []
  blocks.forEach((block) => {
    if (boxesOverlap(box, block)) kinds.push(block.kind || 'other')
  })
  return kinds
}

function penalty(box, blocks) {
  let score = 0
  blocks.forEach((block) => {
    if (!boxesOverlap(box, block)) return
    score += HARD.has(block.kind) ? 5000 : 40
  })
  return score
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
    const beside = [font * 1.1, font * 2.1]
    const leaders = [font * 4.5, font * 8, font * 13, font * 20, font * 28]
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
      score += penalty(box, blocks)
      if (!best || score < best.score) {
        best = { score, leader: leader || fitted.moved, anchorX, anchorY, cx: box.x + box.w / 2, cy: box.y + box.h / 2, box, kinds: hitKinds(box, blocks) }
      }
    }
    along.forEach((t) => [1, -1].forEach((sign) => beside.forEach((gap) => consider(t, gap, sign, false))))
    if (!best || best.score >= 1000) {
      along.forEach((t) => [1, -1].forEach((sign) => leaders.forEach((gap) => consider(t, gap, sign, true))))
    }
    if (!best || best.score >= 5000) {
      options.onSkip?.(segment.key, best?.score ?? null, best?.kinds || [])
      return
    }
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
