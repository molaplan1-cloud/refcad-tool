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

export const SNAP_LABELS = {
  corner: 'Päätepiste',
  intersection: 'Leikkaus',
  perpendicular: 'Kohtisuora',
  midpoint: 'Keskipiste',
  face: 'Pinta',
  edge: 'Keskilinja',
  align: 'Linjaus',
  angle: 'Suunta',
  grid: 'Ruudukko',
}

export function snapRadius(ppm, pixels = 14) {
  return pixels / Math.max(Number(ppm) || 1, 0.001)
}

export function pointAtLength(origin, toward, mm) {
  const metres = Math.max(0, Number(mm) || 0) / 1000
  const len = hypot(origin, toward) || 1
  return weld({
    x: (origin?.x || 0) + ((toward?.x || 0) - (origin?.x || 0)) / len * metres,
    z: (origin?.z || 0) + ((toward?.z || 0) - (origin?.z || 0)) / len * metres,
  })
}

export function wallHeadings(point, walls) {
  const headings = []
  if (!point) return headings
  ;(walls || []).forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    ;[[wall.a, wall.b], [wall.b, wall.a]].forEach(([end, far]) => {
      if (hypot(end, point) > 0.08) return
      headings.push(Math.atan2(far.z - end.z, far.x - end.x))
    })
  })
  return headings
}

export function shouldCloseChain(chain, point) {
  if (!chain?.start || (chain.count || 0) < 2 || !point) return false
  return hypot(chain.start, point) <= 0.02
}

export function gridPoint(cursor, grid) {
  const step = grid > 0 ? grid : 0.1
  return {
    x: Math.round((cursor?.x || 0) / step) * step,
    z: Math.round((cursor?.z || 0) / step) * step,
  }
}

function segmentCross(a, b, c, d) {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = d.x - c.x
  const sz = d.z - c.z
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-9) return null
  const qpx = c.x - a.x
  const qpz = c.z - a.z
  const t = (qpx * sz - qpz * sx) / den
  const u = (qpx * rz - qpz * rx) / den
  if (t < -0.001 || t > 1.001 || u < 0.001 || u > 0.999) return null
  return { x: a.x + rx * t, z: a.z + rz * t }
}

function polarPoint(origin, raw, headings, aperture) {
  const length = hypot(origin, raw)
  if (length < 0.05 || !(aperture > 0)) return null
  const angle = Math.atan2(raw.z - origin.z, raw.x - origin.x)
  const bases = [0, ...(headings || [])]
  let best = null
  bases.forEach((base) => {
    for (let step = 0; step < 4; step += 1) {
      const target = base + step * Math.PI / 2
      const diff = angDiff(angle, target)
      if (diff <= aperture && (!best || diff < best.diff)) best = { diff, target }
    }
  })
  if (!best) return null
  return {
    x: origin.x + Math.cos(best.target) * length,
    z: origin.z + Math.sin(best.target) * length,
  }
}

function nearIgnored(point, ignore) {
  return Boolean(ignore) && hypot(point, ignore) <= 0.05
}

function collectSnaps(raw, options, radius) {
  const walls = options.walls || []
  const origin = options.origin || null
  const candidates = []
  const corners = []
  const considerEnd = (end) => {
    if (!end || nearIgnored(end, options.ignore)) return
    corners.push(end)
    const dist = hypot(end, raw)
    if (dist <= radius) candidates.push({ dist, priority: 0, kind: 'corner', point: end })
  }
  ;(options.extraPoints || []).forEach(considerEnd)
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const hit = segmentCross(walls[i].a, walls[i].b, walls[j].a, walls[j].b)
      if (!hit) continue
      const dist = hypot(hit, raw)
      if (dist <= radius) candidates.push({ dist, priority: 1, kind: 'intersection', point: hit })
    }
  }
  walls.forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    const { len, dx, dz, nx, nz } = frame(wall)
    ;[wall.a, wall.b].forEach(considerEnd)
    const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
    const midDist = hypot(mid, raw)
    if (midDist <= radius) candidates.push({ dist: midDist, priority: 3, kind: 'midpoint', point: mid })
    const along = project(wall.a, dx, dz, len, raw)
    const alongDist = hypot(along, raw)
    const half = (Number(wall.thickness) > 0 ? wall.thickness : (wall.kind === 'interior' ? 0.12 : 0.24)) / 2
    let faceDist = Infinity
    let facePoint = null
    ;[-1, 1].forEach((side) => {
      const faceOrigin = { x: wall.a.x + nx * half * side, z: wall.a.z + nz * half * side }
      const face = project(faceOrigin, dx, dz, len, raw)
      const dist = hypot(face, raw)
      if (dist < faceDist) {
        faceDist = dist
        facePoint = face
      }
    })
    if (options.joinWalls) {
      const capture = Math.min(alongDist, faceDist)
      if (capture <= radius && !nearIgnored(along, options.ignore)) {
        candidates.push({ dist: capture, priority: 4, kind: faceDist < alongDist ? 'face' : 'edge', point: along })
      }
    } else {
      if (alongDist <= radius) candidates.push({ dist: alongDist, priority: 4, kind: 'edge', point: along })
      if (facePoint && faceDist <= radius) candidates.push({ dist: faceDist, priority: 4, kind: 'face', point: facePoint })
    }
    if (origin) {
      const foot = project(wall.a, dx, dz, len, origin)
      const dist = hypot(foot, raw)
      if (dist <= radius && hypot(foot, origin) > 0.05 && !nearIgnored(foot, options.ignore)) {
        candidates.push({ dist, priority: 2, kind: 'perpendicular', point: foot })
      }
      const reach = hypot(origin, raw) + radius
      const far = {
        x: origin.x + (raw.x - origin.x) / (hypot(origin, raw) || 1) * reach,
        z: origin.z + (raw.z - origin.z) / (hypot(origin, raw) || 1) * reach,
      }
      const crossing = hypot(origin, raw) > 0.05 ? segmentCross(origin, far, wall.a, wall.b) : null
      if (crossing && hypot(crossing, raw) <= radius && hypot(crossing, origin) > 0.08) {
        const sx = crossing.x - origin.x
        const sz = crossing.z - origin.z
        const slen = Math.hypot(sx, sz) || 1
        const parallel = Math.abs((sx / slen) * dx + (sz / slen) * dz)
        const atEnd = [wall.a, wall.b].some((end) => hypot(end, crossing) <= 0.04)
        if (parallel >= 0.12 && !atEnd) {
          candidates.push({ dist: hypot(crossing, raw), priority: 1, kind: 'intersection', point: crossing })
        }
      }
    }
  })
  return { candidates, corners }
}

function alignmentCandidates(raw, corners, radius, polar, origin) {
  const found = []
  corners.forEach((end) => {
    if (polar && origin) {
      const horizontal = Math.abs(polar.z - origin.z) < 0.001
      const vertical = Math.abs(polar.x - origin.x) < 0.001
      const point = horizontal ? { x: end.x, z: polar.z } : vertical ? { x: polar.x, z: end.z } : null
      if (point && hypot(point, end) > 0.05) {
        const dist = hypot(point, raw)
        if (dist <= radius) found.push({ dist, priority: 5, kind: 'align', point, guide: end })
      }
      return
    }
    if (Math.abs(end.x - raw.x) <= radius && Math.abs(end.z - raw.z) > radius) {
      found.push({ dist: Math.abs(end.x - raw.x), priority: 5, kind: 'align', point: { x: end.x, z: raw.z }, guide: end })
    }
    if (Math.abs(end.z - raw.z) <= radius && Math.abs(end.x - raw.x) > radius) {
      found.push({ dist: Math.abs(end.z - raw.z), priority: 5, kind: 'align', point: { x: raw.x, z: end.z }, guide: end })
    }
  })
  return found
}

function withGuides(point, kind, corners) {
  const guides = []
  corners.forEach((end) => {
    if (Math.abs(end.x - point.x) <= 0.001 && Math.abs(end.z - point.z) > 0.05) {
      guides.push({ x1: end.x, z1: end.z, x2: point.x, z2: point.z })
    } else if (Math.abs(end.z - point.z) <= 0.001 && Math.abs(end.x - point.x) > 0.05) {
      guides.push({ x1: end.x, z1: end.z, x2: point.x, z2: point.z })
    }
  })
  const unique = []
  guides.forEach((guide) => {
    const key = `${guide.x1}:${guide.z1}:${guide.x2}:${guide.z2}`
    if (!unique.some((item) => `${item.x1}:${item.z1}:${item.x2}:${item.z2}` === key)) unique.push(guide)
  })
  return {
    point: weld(point),
    kind,
    guides: unique.slice(0, 4),
    label: SNAP_LABELS[kind] || '',
  }
}

export function snapPoint(cursor, options = {}) {
  const raw = { x: cursor?.x || 0, z: cursor?.z || 0 }
  if (options.enabled === false) return { point: weld(raw), kind: null, guides: [], label: '' }
  const grid = options.grid > 0 ? options.grid : 0.1
  const radius = Number.isFinite(options.radius) ? options.radius : 0.28
  const origin = options.origin || null
  const base = gridPoint(raw, grid)
  const { candidates, corners } = collectSnaps(raw, options, radius)
  const polar = origin && !options.freeAngle && Number.isFinite(options.polarAperture)
    ? polarPoint(origin, raw, options.headings, options.polarAperture)
    : null
  candidates.push(...alignmentCandidates(raw, corners, radius, polar, origin))

  if (Number.isFinite(options.polarAperture)) {
    if (polar && origin) {
      const span = hypot(origin, polar) || 1
      const reach = span + radius
      const far = {
        x: origin.x + (polar.x - origin.x) / span * reach,
        z: origin.z + (polar.z - origin.z) / span * reach,
      }
      ;(options.walls || []).forEach((wall) => {
        if (!wall?.a || !wall?.b) return
        const crossing = segmentCross(origin, far, wall.a, wall.b)
        if (!crossing || hypot(crossing, raw) > radius || hypot(crossing, origin) <= 0.08) return
        if ([wall.a, wall.b].some((end) => hypot(end, crossing) <= 0.04)) return
        const { len, dx, dz } = frame(wall)
        if (len < 0.05) return
        const sx = crossing.x - origin.x
        const sz = crossing.z - origin.z
        const slen = Math.hypot(sx, sz) || 1
        if (Math.abs((sx / slen) * dx + (sz / slen) * dz) < 0.12) return
        candidates.push({ dist: hypot(crossing, raw), priority: 1, kind: 'intersection', point: crossing })
      })
    }
    candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist)
    const chosen = candidates[0]
    if (chosen) return withGuides(chosen.point, chosen.kind, corners)
    if (polar) return withGuides(polar, 'angle', corners)
    return withGuides(base, 'grid', corners)
  }

  const stepDeg = Number.isFinite(options.angleStep) ? options.angleStep : (options.ortho ? 90 : null)
  const hardStep = !options.freeAngle && stepDeg > 0 ? (stepDeg * Math.PI) / 180 : 0
  if (!options.freeAngle && origin && hypot(origin, raw) > 0.05 && (hardStep > 0 || stepDeg == null)) {
    const angle = Math.atan2(raw.z - origin.z, raw.x - origin.x)
    const step = hardStep > 0 ? hardStep : Math.PI / 4
    const snapped = Math.round(angle / step) * step
    const length = hypot(origin, raw)
    const angled = {
      x: origin.x + Math.cos(snapped) * length,
      z: origin.z + Math.sin(snapped) * length,
    }
    const dist = hypot(angled, raw)
    if (hardStep > 0 || (angDiff(angle, snapped) < 0.16 && dist <= Math.max(radius, length * 0.2))) {
      candidates.push({ dist, priority: hardStep > 0 ? 1 : 5, kind: 'angle', point: angled })
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist)
  const chosen = candidates[0]
  let point = chosen ? { ...chosen.point } : { ...base }
  let kind = chosen ? chosen.kind : 'grid'
  if (!options.freeAngle && (options.ortho || stepDeg === 90) && origin && (!chosen || chosen.priority >= 5)) {
    if (Math.abs(point.x - origin.x) >= Math.abs(point.z - origin.z)) point = { x: point.x, z: origin.z }
    else point = { x: origin.x, z: point.z }
    kind = 'angle'
  } else if (hardStep > 0 && stepDeg !== 90 && origin && (!chosen || chosen.priority >= 5)) {
    const length = hypot(origin, base)
    const angle = Math.atan2(raw.z - origin.z, raw.x - origin.x)
    const snapped = Math.round(angle / hardStep) * hardStep
    point = {
      x: origin.x + Math.cos(snapped) * length,
      z: origin.z + Math.sin(snapped) * length,
    }
    kind = 'angle'
  }
  if (!chosen && kind !== 'angle') point = { ...base }
  return withGuides(kind === 'grid' ? base : point, kind, corners)
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
