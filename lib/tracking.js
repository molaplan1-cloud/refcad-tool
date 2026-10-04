import { moveWallParallel, segmentLength, updateFixture, updateOpening } from './floorplan.js'

function weld(point) {
  return {
    x: Math.round((point?.x || 0) * 1000) / 1000,
    z: Math.round((point?.z || 0) * 1000) / 1000,
  }
}

function hypot(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0))
}

export function wallAxes(wall) {
  const len = segmentLength(wall?.a, wall?.b) || 1
  const dx = ((wall?.b?.x || 0) - (wall?.a?.x || 0)) / len
  const dz = ((wall?.b?.z || 0) - (wall?.a?.z || 0)) / len
  return { len, dx, dz, nx: -dz, nz: dx }
}

function projectOn(wall, point) {
  const { len, dx, dz } = wallAxes(wall)
  const t = Math.max(0, Math.min(len, ((point?.x || 0) - wall.a.x) * dx + ((point?.z || 0) - wall.a.z) * dz))
  return { x: wall.a.x + dx * t, z: wall.a.z + dz * t, t, len }
}

export function parseTrackText(text) {
  const raw = String(text || '').trim().replace(/\s+/g, ' ')
  if (!raw) return { kind: 'none' }
  const pair = raw.match(/^(-?\d+)\s*[,; ]\s*(-?\d+)$/)
  if (pair) return { kind: 'delta', x: Number(pair[1]), y: Number(pair[2]) }
  const single = raw.match(/^(-?\d+(?:[.,]\d+)?)$/)
  if (!single) return { kind: 'none' }
  const mm = Number(single[1].replace(',', '.'))
  return Number.isFinite(mm) ? { kind: 'distance', mm } : { kind: 'none' }
}

export function nextTrackAxis(axis) {
  if (axis === 'along') return 'x'
  if (axis === 'x') return 'y'
  return 'along'
}

function hostWall(base, walls) {
  let best = null
  ;(walls || []).forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    const foot = projectOn(wall, base)
    const dist = hypot(foot, base)
    if (dist <= 0.05 && (!best || dist < best.dist)) best = { wall, dist }
  })
  return best?.wall || null
}

export function trackFrame(base, cursor, walls) {
  const origin = base || { x: 0, z: 0 }
  const raw = cursor || origin
  const dx = raw.x - origin.x
  const dz = raw.z - origin.z
  const span = Math.hypot(dx, dz)
  const host = hostWall(origin, walls)
  if (host && span > 0.02) {
    const { dx: wx, dz: wz } = wallAxes(host)
    const along = dx * wx + dz * wz
    if (Math.abs(along) >= span * 0.45) {
      const sign = along >= 0 ? 1 : -1
      return { mode: 'wall', wallId: host.id, dir: { x: wx * sign, z: wz * sign } }
    }
  }
  if (Math.abs(dx) >= Math.abs(dz)) return { mode: 'x', wallId: host?.id || null, dir: { x: dx < 0 ? -1 : 1, z: 0 } }
  return { mode: 'y', wallId: host?.id || null, dir: { x: 0, z: dz < 0 ? -1 : 1 } }
}

export function trackedPoint(base, cursor, walls, { axis = 'along', text = '' } = {}) {
  const origin = base || { x: 0, z: 0 }
  const parsed = parseTrackText(text)
  if (parsed.kind === 'delta') {
    return {
      point: weld({ x: origin.x + parsed.x / 1000, z: origin.z + parsed.y / 1000 }),
      mm: Math.round(Math.hypot(parsed.x, parsed.y)),
      axis: 'delta',
      label: `X ${parsed.x} mm · Y ${parsed.y} mm`,
    }
  }
  const frame = trackFrame(origin, cursor, walls)
  const useAxis = axis === 'x' || axis === 'y' ? axis : 'along'
  let dir = frame.dir
  if (useAxis === 'x') dir = { x: (cursor?.x || 0) - origin.x < 0 ? -1 : 1, z: 0 }
  if (useAxis === 'y') dir = { x: 0, z: (cursor?.z || 0) - origin.z < 0 ? -1 : 1 }
  const projected = ((cursor?.x || 0) - origin.x) * dir.x + ((cursor?.z || 0) - origin.z) * dir.z
  const mm = parsed.kind === 'distance' ? parsed.mm : Math.round(projected * 1000)
  const point = weld({ x: origin.x + dir.x * (mm / 1000), z: origin.z + dir.z * (mm / 1000) })
  const shown = Math.abs(Math.round(mm))
  const label = useAxis === 'x'
    ? `X ${Math.round(mm)} mm`
    : useAxis === 'y'
      ? `Y ${Math.round(mm)} mm`
      : `${shown} mm nurkasta`
  return { point, mm: Math.round(mm), axis: useAxis === 'along' ? frame.mode : useAxis, label }
}

export function offsetOnWall(wall, point) {
  if (!wall?.a || !wall?.b) return 0
  return projectOn(wall, point).t
}

export function pointAtOffset(wall, offset) {
  const { len, dx, dz } = wallAxes(wall)
  const t = Math.max(0, Math.min(len, offset || 0))
  return weld({ x: wall.a.x + dx * t, z: wall.a.z + dz * t })
}

export function defaultOpeningWidth(kind) {
  return kind === 'window' ? 1.2 : 0.9
}

export function openingEndGaps(wall, offset, width) {
  const len = segmentLength(wall.a, wall.b)
  const half = (width || 0.9) / 2
  return {
    length: len,
    fromStart: (offset || 0) - half,
    fromEnd: len - ((offset || 0) + half),
  }
}

export function offsetForEndGap(wall, width, { fromStart = null, fromEnd = null } = {}) {
  const len = segmentLength(wall.a, wall.b)
  const half = (width || 0.9) / 2
  const offset = fromStart != null ? fromStart + half : len - (fromEnd || 0) - half
  const min = half + 0.02
  const max = Math.max(min, len - half - 0.02)
  return Math.min(max, Math.max(min, offset))
}

export function parallelGaps(plan, wallId) {
  const wall = (plan?.walls || []).find((item) => item.id === wallId)
  if (!wall) return []
  const { len, dx, dz, nx, nz } = wallAxes(wall)
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
  const found = []
  ;(plan.walls || []).forEach((other) => {
    if (!other || other.id === wall.id || !other.a || !other.b) return
    const axes = wallAxes(other)
    if (Math.abs(dx * axes.dx + dz * axes.dz) < 0.996) return
    const gap = (other.a.x - mid.x) * nx + (other.a.z - mid.z) * nz
    if (Math.abs(gap) < 0.05) return
    const project = (point) => (point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz
    const lo = Math.min(project(other.a), project(other.b))
    const hi = Math.max(project(other.a), project(other.b))
    const overlap = Math.min(len, hi) - Math.max(0, lo)
    if (overlap < 0.2) return
    found.push({ wallId: wall.id, otherId: other.id, gap, abs: Math.abs(gap) })
  })
  const nearest = (sign) => found.filter((item) => Math.sign(item.gap) === sign).sort((a, b) => a.abs - b.abs)[0] || null
  return [nearest(1), nearest(-1)].filter(Boolean)
}

export function wallShiftMetres(wall, from, to, typed, mode = 'offset') {
  if (!wall || !from || !to) return 0
  const { nx, nz } = wallAxes(wall)
  const signed = ((to.x || 0) - from.x) * nx + ((to.z || 0) - from.z) * nz
  const parsed = parseTrackText(String(typed ?? '').trim().split(/[\s,;]/)[0])
  if (parsed.kind !== 'distance') return signed
  const metres = parsed.mm / 1000
  const side = Math.sign(signed || 1)
  if (mode === 'distance') return signed - side * Math.abs(metres)
  return side * Math.abs(metres)
}

function fixtureClearances(plan, fixture) {
  const rows = []
  ;(plan.walls || []).forEach((wall) => {
    const { nx, nz } = wallAxes(wall)
    const foot = projectOn(wall, fixture)
    if (foot.t <= 0.02 || foot.t >= foot.len - 0.02) return
    const vx = fixture.x - foot.x
    const vz = fixture.z - foot.z
    const signed = vx * nx + vz * nz
    const dist = Math.hypot(vx, vz)
    if (dist < 0.02 || dist > 8) return
    const dir = signed >= 0 ? { x: nx, z: nz } : { x: -nx, z: -nz }
    rows.push({ wallId: wall.id, gap: Math.abs(signed), dir, foot })
  })
  rows.sort((a, b) => a.gap - b.gap)
  const picked = []
  rows.forEach((row) => {
    if (picked.length >= 2) return
    if (picked.some((item) => Math.abs(item.dir.x * row.dir.x + item.dir.z * row.dir.z) > 0.8)) return
    picked.push(row)
  })
  return picked
}

function dimLine(id, role, extra, a, b, mm) {
  return {
    id,
    role,
    ...extra,
    x1: a.x,
    z1: a.z,
    x2: b.x,
    z2: b.z,
    labelX: (a.x + b.x) / 2,
    labelZ: (a.z + b.z) / 2,
    mm: Math.round(mm),
    text: String(Math.round(mm)),
  }
}

export function temporaryDimensions(plan, target) {
  if (!plan || !target) return []
  if (target.kind === 'wall') {
    const wall = (plan.walls || []).find((item) => item.id === target.id)
    if (!wall) return []
    const { nx, nz } = wallAxes(wall)
    const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
    return parallelGaps(plan, wall.id).map((gap) => {
      const sign = Math.sign(gap.gap)
      const far = { x: mid.x + nx * gap.gap, z: mid.z + nz * gap.gap }
      return dimLine(`gap:${wall.id}:${gap.otherId}`, 'parallel', { wallId: wall.id, otherId: gap.otherId }, mid, far, Math.abs(gap.gap) * 1000 * (sign === 0 ? 1 : 1))
    })
  }
  if (target.kind === 'opening') {
    const opening = (plan.openings || []).find((item) => item.id === target.id)
    const wall = (plan.walls || []).find((item) => item.id === opening?.wallId)
    if (!opening || !wall) return []
    const gaps = openingEndGaps(wall, opening.offset, opening.width)
    const start = pointAtOffset(wall, opening.offset - opening.width / 2)
    const end = pointAtOffset(wall, opening.offset + opening.width / 2)
    return [
      dimLine(`open:${opening.id}:start`, 'opening-start', { openingId: opening.id }, wall.a, start, gaps.fromStart * 1000),
      dimLine(`open:${opening.id}:end`, 'opening-end', { openingId: opening.id }, end, wall.b, gaps.fromEnd * 1000),
    ]
  }
  if (target.kind === 'fixture') {
    const fixture = (plan.fixtures || []).find((item) => item.id === target.id)
    if (!fixture) return []
    return fixtureClearances(plan, fixture).map((row) => dimLine(
      `fix:${fixture.id}:${row.wallId}`,
      'fixture-gap',
      { fixtureId: fixture.id, wallId: row.wallId, dir: row.dir, gap: row.gap },
      row.foot,
      fixture,
      row.gap * 1000,
    ))
  }
  return []
}

export function placementGaps(wall, point, kind) {
  if (!wall || !point) return []
  const width = defaultOpeningWidth(kind)
  const offset = offsetOnWall(wall, point)
  const gaps = openingEndGaps(wall, offset, width)
  const start = pointAtOffset(wall, Math.max(0, offset - width / 2))
  const end = pointAtOffset(wall, Math.min(gaps.length, offset + width / 2))
  return [
    dimLine(`place:${wall.id}:start`, 'place-start', { wallId: wall.id, kind }, wall.a, start, gaps.fromStart * 1000),
    dimLine(`place:${wall.id}:end`, 'place-end', { wallId: wall.id, kind }, end, wall.b, gaps.fromEnd * 1000),
  ]
}

export function applyTemporaryDimension(plan, dim, mm) {
  if (!plan || !dim || !Number.isFinite(mm)) return plan
  const metres = mm / 1000
  if (dim.role === 'parallel') return setParallelGap(plan, dim.wallId, dim.otherId, metres)
  if (dim.role === 'opening-start' || dim.role === 'opening-end') {
    const opening = (plan.openings || []).find((item) => item.id === dim.openingId)
    const wall = (plan.walls || []).find((item) => item.id === opening?.wallId)
    if (!opening || !wall) return plan
    const offset = offsetForEndGap(wall, opening.width, dim.role === 'opening-start' ? { fromStart: metres } : { fromEnd: metres })
    return updateOpening(plan, opening.id, { offset })
  }
  if (dim.role === 'fixture-gap') {
    const fixture = (plan.fixtures || []).find((item) => item.id === dim.fixtureId)
    if (!fixture || !dim.dir) return plan
    const delta = metres - (dim.gap || 0)
    return updateFixture(plan, fixture.id, {
      x: Math.round((fixture.x + dim.dir.x * delta) * 1000) / 1000,
      z: Math.round((fixture.z + dim.dir.z * delta) * 1000) / 1000,
    })
  }
  return plan
}

export function setParallelGap(plan, wallId, otherId, metres) {
  const gaps = parallelGaps(plan, wallId)
  const gap = gaps.find((item) => item.otherId === otherId) || gaps[0]
  if (!gap) return plan
  const desired = Math.sign(gap.gap || 1) * Math.abs(metres)
  return moveWallParallel(plan, wallId, gap.gap - desired)
}
