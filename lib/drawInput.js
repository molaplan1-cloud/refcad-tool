// Wall-drawing entry: typed lengths, ortho rounding, and the reference line.

export function parseDrawInput(text) {
  const raw = String(text ?? '').trim().replace(/,/g, '.')
  if (!raw) return null
  const body = raw.startsWith('@') ? raw.slice(1).trim() : raw
  const match = body.match(/^(-?\d+(?:\.\d+)?)(?:\s*<\s*(-?\d+(?:\.\d+)?))?$/)
  if (!match) return null
  const lengthMm = Number(match[1])
  if (!Number.isFinite(lengthMm)) return null
  const angleDeg = match[2] == null ? null : Number(match[2])
  return {
    lengthMm,
    angleDeg: Number.isFinite(angleDeg) ? normalizeDeg(angleDeg) : null,
  }
}

export function parseDrawFields(lengthText, angleText) {
  const parsed = parseDrawInput(lengthText)
  if (!parsed) return null
  const extra = String(angleText ?? '').trim()
  if (!extra) return parsed
  const angle = Number(extra.replace(',', '.'))
  if (!Number.isFinite(angle)) return parsed
  return { ...parsed, angleDeg: normalizeDeg(angle) }
}

function normalizeDeg(angle) {
  return ((Number(angle) % 360) + 360) % 360
}

export function lockOrthoPoint(origin, point, toleranceDeg = 2) {
  if (!origin || !point) return point || null
  const dx = point.x - origin.x
  const dz = point.z - origin.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-6) return { x: roundMm(origin.x), z: roundMm(origin.z) }
  const ang = Math.atan2(dz, dx)
  const nearest = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2)
  let diff = ang - nearest
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const limit = (Number(toleranceDeg) > 0 ? Number(toleranceDeg) : 0) * Math.PI / 180
  if (Math.abs(diff) > limit) return { x: roundMm(point.x), z: roundMm(point.z) }
  return {
    x: roundMm(origin.x + Math.cos(nearest) * len),
    z: roundMm(origin.z + Math.sin(nearest) * len),
  }
}

export function pointFromDraw(origin, toward, parsed, options = {}) {
  if (!origin || !parsed || !Number.isFinite(parsed.lengthMm)) return null
  const metres = parsed.lengthMm / 1000
  let angle = null
  if (parsed.angleDeg != null) angle = parsed.angleDeg * Math.PI / 180
  else if (Number.isFinite(options.lockAngle)) angle = options.lockAngle
  else if (toward) angle = Math.atan2((toward.z || 0) - origin.z, (toward.x || 0) - origin.x)
  if (!Number.isFinite(angle)) return null
  if (options.ortho && parsed.angleDeg == null) {
    angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2)
  }
  const point = {
    x: roundMm(origin.x + Math.cos(angle) * metres),
    z: roundMm(origin.z + Math.sin(angle) * metres),
  }
  if (parsed.angleDeg != null) return lockOrthoPoint(origin, point, options.nearAxis ?? 2)
  return point
}

function roundMm(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

// Interior defaults to the left of the travel direction, which is inside a
// loop drawn to the right and then downward. Outer keeps that face on the
// typed line so the length is the outside dimension.
export function alignForReference(reference, interiorSide = 'left') {
  if (reference === 'center') return 'center'
  const interiorLeft = interiorSide !== 'right'
  if (reference === 'inner') return interiorLeft ? 'left' : 'right'
  return interiorLeft ? 'right' : 'left'
}

export function drawStepText(draft, segmentCount) {
  if (!draft) return 'Klikkaa aloituspiste'
  if ((segmentCount || 0) < 1) return 'Klikkaa tai syötä pituus'
  const close = (segmentCount || 0) >= 2 ? ' · Sulje (C)' : ''
  return `Klikkaa tai syötä pituus · Enter/kaksoisklikkaus lopettaa, Esc peruu${close}`
}
