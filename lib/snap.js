function hypot(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0))
}

function weld(point) {
  return {
    x: Math.round((point?.x || 0) * 1000) / 1000,
    z: Math.round((point?.z || 0) * 1000) / 1000,
  }
}

function frame(wall) {
  const len = hypot(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  return { len, dx, dz, nx: -dz, nz: dx }
}

function project(origin, dirX, dirZ, len, cursor) {
  const t = Math.max(0, Math.min(len, (cursor.x - origin.x) * dirX + (cursor.z - origin.z) * dirZ))
  return { x: origin.x + dirX * t, z: origin.z + dirZ * t }
}

function angDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

export function gridPoint(cursor, grid) {
  const step = grid > 0 ? grid : 0.1
  return {
    x: Math.round((cursor?.x || 0) / step) * step,
    z: Math.round((cursor?.z || 0) / step) * step,
  }
}

export function snapPoint(cursor, options = {}) {
  const raw = { x: cursor?.x || 0, z: cursor?.z || 0 }
  if (options.enabled === false) return { point: weld(raw), kind: null, guides: [] }
  const walls = options.walls || []
  const grid = options.grid > 0 ? options.grid : 0.1
  const radius = Number.isFinite(options.radius) ? options.radius : 0.28
  const origin = options.origin || null
  const base = gridPoint(raw, grid)
  const candidates = []
  const corners = []

  walls.forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    const { len, dx, dz, nx, nz } = frame(wall)
    ;[wall.a, wall.b].forEach((end) => {
      corners.push(end)
      const dist = hypot(end, raw)
      if (dist <= radius) candidates.push({ dist, priority: 0, kind: 'corner', point: end })
    })
    const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
    const midDist = hypot(mid, raw)
    if (midDist <= radius) candidates.push({ dist: midDist, priority: 1, kind: 'midpoint', point: mid })
    const along = project(wall.a, dx, dz, len, raw)
    const alongDist = hypot(along, raw)
    if (alongDist <= radius) candidates.push({ dist: alongDist, priority: 4, kind: 'edge', point: along })
    const half = (Number(wall.thickness) > 0 ? wall.thickness : 0.24) / 2
    ;[-1, 1].forEach((side) => {
      const faceOrigin = { x: wall.a.x + nx * half * side, z: wall.a.z + nz * half * side }
      const face = project(faceOrigin, dx, dz, len, raw)
      const dist = hypot(face, raw)
      if (dist <= radius) candidates.push({ dist, priority: 3, kind: 'face', point: face })
    })
    if (origin) {
      const foot = project(wall.a, dx, dz, len, origin)
      const dist = hypot(foot, raw)
      if (dist <= radius && hypot(foot, origin) > 0.05) {
        candidates.push({ dist, priority: 2, kind: 'perpendicular', point: foot })
      }
    }
  })

  if (origin && hypot(origin, raw) > 0.05) {
    const angle = Math.atan2(raw.z - origin.z, raw.x - origin.x)
    const step = options.ortho ? Math.PI / 2 : Math.PI / 4
    const snapped = Math.round(angle / step) * step
    const length = hypot(origin, raw)
    const angled = {
      x: origin.x + Math.cos(snapped) * length,
      z: origin.z + Math.sin(snapped) * length,
    }
    const dist = hypot(angled, raw)
    if (options.ortho || (angDiff(angle, snapped) < 0.16 && dist <= Math.max(radius, length * 0.2))) {
      candidates.push({ dist, priority: options.ortho ? 1 : 5, kind: 'angle', point: angled })
    }
  }

  corners.forEach((end) => {
    if (Math.abs(end.x - raw.x) <= radius && Math.abs(end.z - raw.z) > radius) {
      candidates.push({ dist: Math.abs(end.x - raw.x), priority: 5, kind: 'align', point: { x: end.x, z: raw.z }, guide: end })
    }
    if (Math.abs(end.z - raw.z) <= radius && Math.abs(end.x - raw.x) > radius) {
      candidates.push({ dist: Math.abs(end.z - raw.z), priority: 5, kind: 'align', point: { x: raw.x, z: end.z }, guide: end })
    }
  })

  candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist)
  const chosen = candidates[0]
  let point = chosen ? { ...chosen.point } : { ...base }
  let kind = chosen ? chosen.kind : 'grid'
  if (options.ortho && origin && (!chosen || chosen.priority >= 5)) {
    if (Math.abs(point.x - origin.x) >= Math.abs(point.z - origin.z)) point = { x: point.x, z: origin.z }
    else point = { x: origin.x, z: point.z }
    kind = 'angle'
  }
  if (!chosen) point = { ...base }

  const guides = []
  corners.forEach((end) => {
    if (Math.abs(end.x - point.x) <= 0.001 && Math.abs(end.z - point.z) > 0.05) {
      guides.push({ x1: end.x, z1: end.z, x2: point.x, z2: point.z })
    } else if (Math.abs(end.z - point.z) <= 0.001 && Math.abs(end.x - point.x) > 0.05) {
      guides.push({ x1: end.x, z1: end.z, x2: point.x, z2: point.z })
    }
  })
  return { point: weld(kind === 'grid' ? base : point), kind, guides: guides.slice(0, 4) }
}

export function snapAlongWall(cursor, walls, radius = 0.28, enabled = true) {
  const raw = { x: cursor?.x || 0, z: cursor?.z || 0 }
  if (!enabled) return { point: weld(raw), kind: null, wall: null, guides: [] }
  let best = null
  ;(walls || []).forEach((wall) => {
    const { len, dx, dz } = frame(wall)
    const point = project(wall.a, dx, dz, len, raw)
    const dist = hypot(point, raw)
    if (dist <= radius && (!best || dist < best.dist)) best = { dist, point, wall }
  })
  if (!best) return { point: weld(raw), kind: null, wall: null, guides: [] }
  return { point: weld(best.point), kind: 'edge', wall: best.wall, guides: [] }
}

export function snapFixturePoint(cursor, walls, options = {}) {
  const raw = { x: cursor?.x || 0, z: cursor?.z || 0 }
  const enabled = options.enabled !== false
  const radius = Number.isFinite(options.radius) ? options.radius : 0.4
  const depth = Number(options.depth) || 0.6
  if (!enabled) return { x: raw.x, z: raw.z, rotation: options.rotation || 0, kind: null }
  let best = null
  ;(walls || []).forEach((wall) => {
    const { len, dx, dz, nx, nz } = frame(wall)
    const point = project(wall.a, dx, dz, len, raw)
    const dist = hypot(point, raw)
    if (dist <= radius && (!best || dist < best.dist)) best = { dist, point, wall, nx, nz }
  })
  if (!best) {
    const grid = gridPoint(raw, options.grid || 0.1)
    return { ...weld(grid), rotation: options.rotation || 0, kind: 'grid' }
  }
  const half = (Number(best.wall.thickness) > 0 ? best.wall.thickness : (best.wall.kind === 'interior' ? 0.12 : 0.24)) / 2
  const side = Math.sign((raw.x - best.point.x) * best.nx + (raw.z - best.point.z) * best.nz) || 1
  const gap = half + depth / 2
  return {
    x: Math.round((best.point.x + best.nx * side * gap) * 1000) / 1000,
    z: Math.round((best.point.z + best.nz * side * gap) * 1000) / 1000,
    rotation: Math.round((Math.atan2(best.nx * side, best.nz * side) * 180) / Math.PI),
    kind: 'face',
  }
}
