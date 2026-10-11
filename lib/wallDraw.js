// One wall-drawing engine for the house plan and the cold-room plan.
// A chain commits the ortho-locked target, then continues from the welded
// end. A rectangle is four axis-aligned walls that share those corners.

import { dropDegenerateWalls } from './guides.js'
import { lockOrthoPoint, parseDrawInput, pointFromDraw } from './drawInput.js'
import { addWall, segmentLength, splitWall } from './floorplan.js'
import { shouldCloseChain, snapPoint, snapRadius, wallHeadings } from './snap.js'

function roundPt(point) {
  return {
    x: Math.round((point?.x || 0) * 1000) / 1000,
    z: Math.round((point?.z || 0) * 1000) / 1000,
  }
}

function near(a, b, tol = 0.02) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) <= tol
}

export function chainTarget(chain, start, end) {
  const locked = lockOrthoPoint(start, end, 2)
  const closing = Boolean(chain?.start) && (shouldCloseChain(chain, end) || shouldCloseChain(chain, locked))
  const target = closing ? chain.start : locked
  const skip = !start || !target || segmentLength(start, target) < 0.02
  return { locked, closing, target, skip }
}

export function drawCursor(cursor, origin, walls, scale, typed = '', extra = {}) {
  const parsed = parseDrawInput(typed)
  const explicit = parsed?.angleDeg != null
  const snapped = snapPoint(cursor, {
    walls: walls || [],
    origin: origin || null,
    ortho: Boolean(origin) && !explicit,
    freeAngle: explicit,
    grid: extra.grid > 0 ? extra.grid : 0.05,
    radius: snapRadius(scale, 16),
    joinWalls: true,
    headings: origin ? wallHeadings(origin, walls) : [],
    extraPoints: extra.extraPoints || [],
    angleStep: explicit ? 0 : 90,
  }).point
  if (origin && parsed) return pointFromDraw(origin, snapped, parsed, { ortho: !explicit })
  return snapped
}

export function parseRectangleSize(text) {
  const raw = String(text ?? '').trim().replace(/,/g, '.').replace(/\s+/g, '')
  const match = raw.match(/^(\d+(?:\.\d+)?)[x×*](\d+(?:\.\d+)?)$/i)
  if (!match) return null
  const width = Number(match[1]) / 1000
  const depth = Number(match[2]) / 1000
  if (!(width >= 0.3 && depth >= 0.3)) return null
  return { width, depth }
}

export function snapRectanglePoint(corner, point, grid) {
  if (!corner || !point) return point
  const step = Number(grid) || 0
  const snap = (delta) => {
    if (!(step > 0)) return delta
    const sign = delta < 0 ? -1 : 1
    const steps = Math.round(Math.abs(delta) / step)
    return sign * steps * step
  }
  return roundPt({
    x: corner.x + snap(point.x - corner.x),
    z: corner.z + snap(point.z - corner.z),
  })
}

export function rectangleCursor(cursor, corner, walls, scale, typed = '', extra = {}) {
  const grid = extra.grid > 0 ? extra.grid : 0
  const snapped = snapPoint(cursor, {
    walls: walls || [],
    grid: grid > 0 ? grid : 0.001,
    radius: snapRadius(scale, 16),
    joinWalls: true,
    extraPoints: corner ? [corner] : [],
  }).point
  const size = parseRectangleSize(typed)
  if (corner && size) {
    const signX = snapped.x - corner.x >= 0 ? 1 : -1
    const signZ = snapped.z - corner.z >= 0 ? 1 : -1
    return roundPt({ x: corner.x + signX * size.width, z: corner.z + signZ * size.depth })
  }
  if (corner && grid > 0) return snapRectanglePoint(corner, snapped, grid)
  return roundPt(snapped)
}

// The drawn box is the measurement the user asked for. Walls sit on the
// centerline: inner grows the centerline by half the panel, outer shrinks it.
export function centerlineFromMeasure(corner, opposite, thickness = 0, basis = 'center') {
  if (!corner || !opposite) return null
  const half = Math.max(0, Number(thickness) || 0) / 2
  const inset = basis === 'outer' ? half : basis === 'inner' ? -half : 0
  const left = Math.min(corner.x, opposite.x) + inset
  const right = Math.max(corner.x, opposite.x) - inset
  const top = Math.min(corner.z, opposite.z) + inset
  const bottom = Math.max(corner.z, opposite.z) - inset
  if (right - left < 0.3 || bottom - top < 0.3) return null
  return {
    corner: roundPt({ x: left, z: top }),
    opposite: roundPt({ x: right, z: bottom }),
  }
}

function covered(walls, a, b) {
  return (walls || []).some((wall) => {
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    const along = (point) => {
      const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len))
      const x = wall.a.x + dx * len * t
      const z = wall.a.z + dz * len * t
      return Math.hypot(point.x - x, point.z - z)
    }
    return along(a) < 0.03 && along(b) < 0.03
  })
}

export function commitDrawnWall(plan, a, b, options = {}) {
  if (!plan || !a || !b) return plan
  if (covered(plan.walls, a, b)) return plan
  return addWall(plan, a, b, options.kind || 'exterior', {
    panel: options.panel === true || options.kind === 'panel',
    thickness: options.thickness,
    axisDeg: Number.isFinite(options.axisDeg) ? options.axisDeg : 2,
    align: options.align,
  })
}

export function committedEnd(before, after, target) {
  if (!target) return null
  const ids = new Set((before?.walls || []).map((wall) => wall.id))
  const added = (after?.walls || []).filter((wall) => !ids.has(wall.id))
  const pool = added.length ? added : (after?.walls || [])
  let best = roundPt(target)
  let bestDist = Infinity
  pool.forEach((wall) => {
    ;[wall.a, wall.b].forEach((point) => {
      const dist = Math.hypot(point.x - target.x, point.z - target.z)
      if (dist < bestDist) {
        bestDist = dist
        best = { x: point.x, z: point.z }
      }
    })
  })
  return bestDist < 0.5 ? best : roundPt(target)
}

function onInterior(point, wall) {
  const len = segmentLength(wall.a, wall.b)
  if (len < 0.2) return false
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)
  if (t <= 0.06 || t >= 0.94) return false
  const x = wall.a.x + dx * t
  const z = wall.a.z + dz * t
  return Math.hypot(point.x - x, point.z - z) <= 0.05
}

function parallel(wall, other) {
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const ox = other.b.x - other.a.x
  const oz = other.b.z - other.a.z
  const len = Math.hypot(dx, dz) || 1
  const olen = Math.hypot(ox, oz) || 1
  return Math.abs((dx / len) * (ox / olen) + (dz / len) * (oz / olen)) > 0.98
}

export function sealClosedLoop(plan) {
  if (!plan?.walls?.length) return plan
  const clusters = []
  const taken = new Set()
  const ends = []
  plan.walls.forEach((wall) => {
    ends.push({ id: wall.id, end: 'a', point: wall.a })
    ends.push({ id: wall.id, end: 'b', point: wall.b })
  })
  ends.forEach((item, index) => {
    if (taken.has(index)) return
    const group = [item]
    taken.add(index)
    ends.forEach((other, otherIndex) => {
      if (taken.has(otherIndex)) return
      if (Math.hypot(other.point.x - item.point.x, other.point.z - item.point.z) <= 0.08) {
        taken.add(otherIndex)
        group.push(other)
      }
    })
    if (group.length > 1) clusters.push(group)
  })
  let next = plan
  if (clusters.length) {
    const walls = plan.walls.map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } }))
    clusters.forEach((group) => {
      const x = Math.round((group.reduce((sum, item) => sum + item.point.x, 0) / group.length) * 1000) / 1000
      const z = Math.round((group.reduce((sum, item) => sum + item.point.z, 0) / group.length) * 1000) / 1000
      group.forEach((item) => {
        const wall = walls.find((entry) => entry.id === item.id)
        if (wall) wall[item.end] = { x, z }
      })
    })
    next = { ...plan, walls }
  }
  let guard = 0
  while (guard < 16) {
    guard += 1
    const walls = next.walls || []
    let hit = null
    walls.forEach((wall) => {
      if (hit) return
      walls.forEach((other) => {
        if (hit || other.id === wall.id) return
        ;[other.a, other.b].forEach((point) => {
          if (!hit && onInterior(point, wall)) hit = { id: wall.id, point }
        })
      })
    })
    if (!hit) break
    const split = splitWall(next, hit.id, hit.point)
    if (!split || (split.walls || []).length === (next.walls || []).length) break
    next = split
  }
  const list = next.walls || []
  const degree = (point) => list.reduce((count, wall) => (
    count + (near(wall.a, point) ? 1 : 0) + (near(wall.b, point) ? 1 : 0)
  ), 0)
  const kept = list.filter((wall) => {
    const da = degree(wall.a)
    const db = degree(wall.b)
    const free = da === 1 ? wall.a : db === 1 ? wall.b : null
    const joint = da === 1 ? wall.b : db === 1 ? wall.a : null
    if (!free || degree(joint) < 3) return true
    const others = list.filter((other) => other.id !== wall.id && (near(other.a, joint) || near(other.b, joint)))
    const corner = others.some((other) => !parallel(wall, other))
    const collinear = others.some((other) => parallel(wall, other))
    return !(corner && collinear)
  })
  return dropDegenerateWalls({ ...next, walls: kept })
}

export function stepWallChain(plan, chain, point, options = {}) {
  if (!point) return { plan, chain, committed: false, closed: false }
  if (!chain?.anchor) {
    const start = roundPt(point)
    return { plan, chain: { start, anchor: start, count: 0 }, committed: false, closed: false }
  }
  const closingClick = (chain.count || 0) >= 2 && near(point, chain.start, 0.08)
  const aimed = closingClick || options.freeAngle ? point : lockOrthoPoint(chain.anchor, point, 45)
  const decision = chainTarget(chain, chain.anchor, closingClick ? chain.start : aimed)
  if (decision.skip) {
    if (decision.closing) return { plan: sealClosedLoop(plan), chain: null, committed: false, closed: true }
    return { plan, chain, committed: false, closed: false }
  }
  const drawn = commitDrawnWall(plan, chain.anchor, decision.target, options)
  if (decision.closing) return { plan: sealClosedLoop(drawn), chain: null, committed: drawn !== plan, closed: true }
  const anchor = committedEnd(plan, drawn, decision.target)
  const start = chain.count === 0 ? committedEnd(plan, drawn, chain.start) : chain.start
  return {
    plan: drawn,
    chain: { start, anchor, count: (chain.count || 0) + 1 },
    committed: drawn !== plan,
    closed: false,
  }
}

export function closeWallChain(plan, chain, options = {}) {
  if (!chain?.start || !chain.anchor || (chain.count || 0) < 2) return { plan, chain, committed: false, closed: false }
  return stepWallChain(plan, chain, chain.start, options)
}

export function commitRectangle(plan, corner, opposite, options = {}) {
  if (!corner || !opposite) return plan
  const width = Math.abs(opposite.x - corner.x)
  const depth = Math.abs(opposite.z - corner.z)
  if (width < 0.3 || depth < 0.3) return plan
  const corners = [
    roundPt({ x: corner.x, z: corner.z }),
    roundPt({ x: opposite.x, z: corner.z }),
    roundPt({ x: opposite.x, z: opposite.z }),
    roundPt({ x: corner.x, z: opposite.z }),
  ]
  let next = plan
  for (let index = 0; index < 4; index += 1) {
    next = commitDrawnWall(next, corners[index], corners[(index + 1) % 4], {
      ...options,
      axisDeg: 0.01,
    })
  }
  return sealClosedLoop(next)
}
