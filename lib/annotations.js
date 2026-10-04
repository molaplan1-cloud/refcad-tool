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

function boxesOverlap(a, b, pad = 2) {
  return a.x < b.x + b.w + pad
    && a.x + a.w + pad > b.x
    && a.y < b.y + b.h + pad
    && a.y + a.h + pad > b.y
}

function inside(box, bounds, margin = 2) {
  if (!bounds) return true
  return box.x >= bounds.x + margin
    && box.y >= bounds.y + margin
    && box.x + box.w <= bounds.x + bounds.w - margin
    && box.y + box.h <= bounds.y + bounds.h - margin
}

const HARD = new Set(['room', 'dim', 'symbol', 'legend', 'chrome', 'label'])

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
    const along = [0.5, 0.36, 0.64, 0.26, 0.74, 0.16, 0.84]
    const beside = [font * 0.95, font * 1.75]
    const leaders = [font * 3.3, font * 5.1, font * 7.4]
    let best = null
    const consider = (t, gap, sign, leader) => {
      const anchorX = segment.ax + dx * t
      const anchorY = segment.ay + dy * t
      const cx = anchorX + nx * gap * sign
      const cy = anchorY + ny * gap * sign
      const box = textBox(cx, cy, segment.text, font)
      if (!inside(box, bounds)) return
      let score = (leader ? 8 : 0) + gap * 0.02 + Math.abs(t - 0.5) * 4
      score += penalty(box, blocks)
      if (!best || score < best.score) {
        best = { score, leader, anchorX, anchorY, cx, cy, box }
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
