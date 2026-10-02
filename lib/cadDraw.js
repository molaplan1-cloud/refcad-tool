// Drawing helpers for the plan canvas: outlines, snaps, and orthogonal polygons.
// Rectangles stay on the existing centre/width/depth model. An L-shaped room
// stores an `outline` of world points and is measured from that outline.

import { externalRect, num } from './geometry.js'

export function outlineOf(room) {
  if (Array.isArray(room?.outline) && room.outline.length >= 3) {
    return room.outline.map((point) => ({ x: num(point.x, 0), z: num(point.z, 0) }))
  }
  const rect = externalRect(room)
  return [
    { x: rect.left, z: rect.top },
    { x: rect.right, z: rect.top },
    { x: rect.right, z: rect.bottom },
    { x: rect.left, z: rect.bottom },
  ]
}

export function isCustomOutline(room) {
  return Array.isArray(room?.outline) && room.outline.length >= 6
}

export function polygonArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.x * next.z - next.x * current.z
  }
  return Math.abs(sum) / 2
}

export function pointInPolygon(x, z, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const zi = points[i].z
    const xj = points[j].x
    const zj = points[j].z
    const crosses = (zi > z) !== (zj > z)
    if (!crosses) continue
    const xHit = ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-12) + xi
    if (x < xHit) inside = !inside
  }
  return inside
}

export function bboxOf(points) {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  points.forEach((point) => {
    left = Math.min(left, point.x)
    right = Math.max(right, point.x)
    top = Math.min(top, point.z)
    bottom = Math.max(bottom, point.z)
  })
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    depth: bottom - top,
    x: (left + right) / 2,
    z: (top + bottom) / 2,
  }
}

export function edgesOf(points) {
  const edges = []
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 1e-6) continue
    edges.push({ a, b, x1: a.x, z1: a.z, x2: b.x, z2: b.z, len, index: i })
  }
  return edges
}

export function cleanOrthogonal(points) {
  const raw = []
  points.forEach((point) => {
    const prev = raw[raw.length - 1]
    if (prev && Math.hypot(point.x - prev.x, point.z - prev.z) < 1e-4) return
    raw.push({ x: point.x, z: point.z })
  })
  if (raw.length > 1) {
    const first = raw[0]
    const last = raw[raw.length - 1]
    if (Math.hypot(first.x - last.x, first.z - last.z) < 1e-4) raw.pop()
  }
  if (raw.length < 3) return raw
  const simplified = []
  for (let i = 0; i < raw.length; i += 1) {
    const prev = raw[(i - 1 + raw.length) % raw.length]
    const current = raw[i]
    const next = raw[(i + 1) % raw.length]
    const cross = (current.x - prev.x) * (next.z - current.z) - (current.z - prev.z) * (next.x - current.x)
    if (Math.abs(cross) < 1e-4) continue
    simplified.push(current)
  }
  return simplified
}

export function isRectangleOutline(points) {
  if (!points || points.length !== 4) return false
  const xs = new Set(points.map((point) => point.x.toFixed(3)))
  const zs = new Set(points.map((point) => point.z.toFixed(3)))
  return xs.size === 2 && zs.size === 2
}

export function segmentsOverlap(a, b, tol = 0.2) {
  const aHoriz = Math.abs(a.z1 - a.z2) <= tol && Math.abs(a.x1 - a.x2) > tol
  const aVert = Math.abs(a.x1 - a.x2) <= tol && Math.abs(a.z1 - a.z2) > tol
  const bHoriz = Math.abs(b.z1 - b.z2) <= tol && Math.abs(b.x1 - b.x2) > tol
  const bVert = Math.abs(b.x1 - b.x2) <= tol && Math.abs(b.z1 - b.z2) > tol
  if (aHoriz && bHoriz && Math.abs((a.z1 + a.z2) / 2 - (b.z1 + b.z2) / 2) <= tol) {
    return overlap1d(Math.min(a.x1, a.x2), Math.max(a.x1, a.x2), Math.min(b.x1, b.x2), Math.max(b.x1, b.x2))
  }
  if (aVert && bVert && Math.abs((a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2) <= tol) {
    return overlap1d(Math.min(a.z1, a.z2), Math.max(a.z1, a.z2), Math.min(b.z1, b.z2), Math.max(b.z1, b.z2))
  }
  return 0
}

function overlap1d(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))
}

function lineIntersect(x1, z1, x2, z2, x3, z3, x4, z4) {
  const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4)
  if (Math.abs(denom) < 1e-9) return null
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom
  return { x: x1 + t * (x2 - x1), z: z1 + t * (z2 - z1) }
}

export function insetOrthogonal(points, amount) {
  if (!points || points.length < 4 || amount <= 0) return points ? points.map((point) => ({ ...point })) : []
  const edges = edgesOf(points)
  const offset = edges.map((edge) => {
    const len = edge.len || 1
    let nx = -(edge.z2 - edge.z1) / len
    let nz = (edge.x2 - edge.x1) / len
    const mx = (edge.x1 + edge.x2) / 2
    const mz = (edge.z1 + edge.z2) / 2
    if (!pointInPolygon(mx + nx * 0.02, mz + nz * 0.02, points)) {
      nx = -nx
      nz = -nz
    }
    return { x: edge.x1 + nx * amount, z: edge.z1 + nz * amount, dx: edge.x2 - edge.x1, dz: edge.z2 - edge.z1 }
  })
  const result = []
  for (let i = 0; i < offset.length; i += 1) {
    const current = offset[i]
    const next = offset[(i + 1) % offset.length]
    const hit = lineIntersect(
      current.x, current.z, current.x + current.dx, current.z + current.dz,
      next.x, next.z, next.x + next.dx, next.z + next.dz
    )
    if (!hit) return null
    result.push(hit)
  }
  if (polygonArea(result) < 0.04) return null
  return result
}

export function selfIntersects(points) {
  const edges = edgesOf(points)
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === edges.length - 1)) continue
      const a = edges[i]
      const b = edges[j]
      const hit = properCross(a, b)
      if (hit) return true
    }
  }
  return false
}

function properCross(a, b) {
  const d1 = cross(b.x1 - a.x1, b.z1 - a.z1, a.x2 - a.x1, a.z2 - a.z1)
  const d2 = cross(b.x2 - a.x1, b.z2 - a.z1, a.x2 - a.x1, a.z2 - a.z1)
  const d3 = cross(a.x1 - b.x1, a.z1 - b.z1, b.x2 - b.x1, b.z2 - b.z1)
  const d4 = cross(a.x2 - b.x1, a.z2 - b.z1, b.x2 - b.x1, b.z2 - b.z1)
  return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6))
    && ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6))
}

function cross(ax, az, bx, bz) {
  return ax * bz - az * bx
}

export function polygonMetrics(room) {
  const wall = Math.max(0, num(room.wallThickness, 0.08))
  const ceil = Math.max(0, num(room.ceilingThickness, wall))
  const floor = Math.max(0, num(room.floorThickness, wall))
  const ext = outlineOf(room)
  const inner = insetOrthogonal(ext, wall) || ext
  const area = polygonArea(inner)
  const box = bboxOf(inner)
  const height = Math.max(0.2, room.height - ceil - floor)
  return {
    ext,
    inner,
    dims: {
      width: Math.max(0.2, box.width),
      depth: Math.max(0.2, box.depth),
      height,
      area,
      volume: area * height,
      wall,
      ceil,
      floor,
    },
  }
}

export function polygonTransmission(room, rooms) {
  const metrics = polygonMetrics(room)
  const parent = room.parentId ? (rooms || []).find((item) => item.id === room.parentId) : null
  const parentEdges = parent ? edgesOf(outlineOf(parent)) : []
  const shares = []
  let ambientLen = 0
  let interiorLen = 0
  edgesOf(metrics.inner).forEach((edge) => {
    let used = 0
    ;(rooms || []).forEach((other) => {
      if (!other || other.id === room.id || other.parentId === room.id) return
      edgesOf(outlineOf(other)).forEach((otherEdge) => {
        const overlap = segmentsOverlap(edge, otherEdge, 0.35)
        const take = Math.min(overlap, Math.max(0, edge.len - used))
        if (take > 0.12) {
          used += take
          shares.push({ other, length: take })
        }
      })
    })
    const rest = Math.max(0, edge.len - used)
    const onShell = parentEdges.some((otherEdge) => segmentsOverlap(edge, otherEdge, 0.35) > 0.12)
    if (parent && !onShell) interiorLen += rest
    else ambientLen += rest
  })
  return { ...metrics, shares, ambientLen, interiorLen }
}

export function flushContactLength(child, parent) {
  if (!child || !parent) return 0
  let length = 0
  edgesOf(outlineOf(child)).forEach((edge) => {
    edgesOf(outlineOf(parent)).forEach((other) => {
      length += segmentsOverlap(edge, other, 0.2)
    })
  })
  return length
}

export function translateOutline(outline, dx, dz) {
  if (!outline) return outline
  return outline.map((point) => ({ x: point.x + dx, z: point.z + dz }))
}

export function scaleOutline(room, next) {
  if (!room.outline) return null
  const sx = room.width ? next.width / room.width : 1
  const sz = room.depth ? next.depth / room.depth : 1
  return room.outline.map((point) => ({
    x: next.x + (point.x - room.x) * sx,
    z: next.z + (point.z - room.z) * sz,
  }))
}

export function applyBox(room, left, top, right, bottom) {
  const width = Math.max(0.4, right - left)
  const depth = Math.max(0.4, bottom - top)
  return {
    ...room,
    x: left + width / 2,
    z: top + depth / 2,
    width,
    depth,
    outline: null,
  }
}

export function applyOutline(room, points) {
  const clean = cleanOrthogonal(points)
  const box = bboxOf(clean)
  return {
    ...room,
    x: box.x,
    z: box.z,
    width: Math.max(0.4, box.width),
    depth: Math.max(0.4, box.depth),
    outline: isRectangleOutline(clean) ? null : clean,
  }
}

function projectToSegment(x, z, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-8) return null
  let t = ((x - a.x) * dx + (z - a.z) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: a.x + t * dx, z: a.z + t * dz }
}

export function snapWorld(x, z, options = {}) {
  const scale = options.scale || 30
  const tol = (options.tolPx || 14) / scale
  const flags = options.flags || {}
  let px = x
  let pz = z
  const origin = options.origin
  if (origin && flags.ortho !== false) {
    if (Math.abs(x - origin.x) >= Math.abs(z - origin.z)) pz = origin.z
    else px = origin.x
  }
  let best = null
  const consider = (point, rank) => {
    if (origin && flags.ortho !== false) {
      const onAxis = Math.abs(point.z - pz) < tol * 1.2 || Math.abs(point.x - px) < tol * 1.2
      if (!onAxis) return
      if (Math.abs(pz - origin.z) < 1e-6) point = { ...point, z: origin.z }
      if (Math.abs(px - origin.x) < 1e-6) point = { ...point, x: origin.x }
    }
    const dist = Math.hypot(point.x - px, point.z - pz)
    if (dist > tol) return
    if (!best || rank < best.rank || (rank === best.rank && dist < best.dist)) {
      best = { ...point, rank, dist }
    }
  }
  if (flags.endpoint !== false || flags.midpoint !== false || flags.wall !== false) {
    ;(options.rooms || []).forEach((room) => {
      if (options.ignoreIds && options.ignoreIds.has(room.id)) return
      const pts = outlineOf(room)
      pts.forEach((point, index) => {
        const next = pts[(index + 1) % pts.length]
        if (flags.endpoint !== false) consider({ x: point.x, z: point.z, kind: 'endpoint' }, 0)
        if (flags.midpoint !== false) consider({ x: (point.x + next.x) / 2, z: (point.z + next.z) / 2, kind: 'midpoint' }, 1)
        if (flags.wall !== false) {
          const projected = projectToSegment(px, pz, point, next)
          if (projected) consider({ ...projected, kind: 'wall' }, 2)
        }
      })
    })
  }
  if (best) return { x: best.x, z: best.z, kind: best.kind }
  if (options.grid && flags.grid !== false) {
    const g = options.grid
    return {
      x: Math.round(px / g) * g,
      z: Math.round(pz / g) * g,
      kind: origin ? 'ortho' : 'grid',
    }
  }
  return { x: px, z: pz, kind: origin ? 'ortho' : null }
}

export function gridSpec(scale) {
  const target = 18 / Math.max(scale, 1)
  const pow = 10 ** Math.floor(Math.log10(target))
  const n = target / pow
  const minor = n < 1.5 ? pow : n < 3.5 ? 2 * pow : n < 7.5 ? 5 * pow : 10 * pow
  return { minor, major: minor * 5 }
}

export function scaleBarMetres(scale) {
  const raw = 112 / Math.max(scale, 1)
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)))
  const n = raw / pow
  return n < 1.5 ? pow : n < 3.5 ? 2 * pow : n < 7.5 ? 5 * pow : 10 * pow
}

export function fitView(rooms, width, height, pad) {
  if (!rooms.length || width < 40 || height < 40) {
    return { scale: 36, offsetX: width / 2, offsetY: height / 2 }
  }
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  rooms.forEach((room) => {
    outlineOf(room).forEach((point) => {
      left = Math.min(left, point.x)
      right = Math.max(right, point.x)
      top = Math.min(top, point.z)
      bottom = Math.max(bottom, point.z)
    })
  })
  const margin = 0.9
  left -= margin
  right += margin
  top -= margin
  bottom += margin
  const spanX = Math.max(0.5, right - left)
  const spanZ = Math.max(0.5, bottom - top)
  const padX = Number.isFinite(pad) ? pad : Math.max(48, width * 0.06)
  const padY = Number.isFinite(pad) ? pad : Math.max(52, height * 0.07)
  const scale = Math.max(6, Math.min(180, Math.min((width - padX * 2) / spanX, (height - padY * 2) / spanZ)))
  const cx = (left + right) / 2
  const cz = (top + bottom) / 2
  return { scale, offsetX: width / 2 - cx * scale, offsetY: height / 2 - cz * scale }
}

export function doorSymbol(room, eq) {
  const wall = eq.wall || 's'
  const cx = room.x + eq.x
  const cz = room.z + eq.z
  const width = eq.width
  let x1
  let z1
  let x2
  let z2
  let ix = 0
  let iz = 0
  if (wall === 'n' || wall === 's') {
    x1 = cx - width / 2
    x2 = cx + width / 2
    z1 = cz
    z2 = cz
    iz = wall === 's' ? -1 : 1
  } else {
    z1 = cz - width / 2
    z2 = cz + width / 2
    x1 = cx
    x2 = cx
    ix = wall === 'e' ? -1 : 1
  }
  const hinge = { x: x1, z: z1 }
  const closed = { x: x2, z: z2 }
  const open = { x: hinge.x + ix * width, z: hinge.z + iz * width }
  const a0 = Math.atan2(closed.z - hinge.z, closed.x - hinge.x)
  let delta = Math.atan2(open.z - hinge.z, open.x - hinge.x) - a0
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const arc = []
  for (let i = 0; i <= 14; i += 1) {
    const angle = a0 + delta * (i / 14)
    arc.push({ x: hinge.x + Math.cos(angle) * width, z: hinge.z + Math.sin(angle) * width })
  }
  return { x1, z1, x2, z2, hinge, open, arc, ix, iz, width }
}

const SNAP_LABEL = {
  endpoint: 'päätepiste',
  midpoint: 'keskipiste',
  wall: 'seinä',
  grid: 'ruutu',
  ortho: 'suora',
}

export function snapLabel(kind) {
  return SNAP_LABEL[kind] || ''
}
