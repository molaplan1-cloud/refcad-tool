// Wall-end editing: snap a free end onto another wall, trim or extend it
// to that wall's face, and close an L so the mitre is one corner.

import { faceOffsets } from './wall-outline.js'
import { setEndpoint, thicknessOf } from './floorplan.js'

function hypot(dx, dz) {
  return Math.hypot(dx || 0, dz || 0)
}

function unit(dx, dz) {
  const len = hypot(dx, dz) || 1
  return { x: dx / len, z: dz / len }
}

function leftNormal(dir) {
  return { x: -dir.z, z: dir.x }
}

function add(a, b) {
  return { x: a.x + b.x, z: a.z + b.z }
}

function scale(v, k) {
  return { x: v.x * k, z: v.z * k }
}

function near(a, b, tol = 0.001) {
  return hypot(a.x - b.x, a.z - b.z) <= tol
}

function lineIntersect(p, d, q, e) {
  const den = d.x * e.z - d.z * e.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den
  return { x: p.x + d.x * t, z: p.z + d.z * t, t }
}

function wallDir(wall) {
  return unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
}

function wallLen(wall) {
  return hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
}

function faceLines(wall, plan) {
  const thick = Math.max(0.04, thicknessOf(wall, plan) || 0.24)
  const offsets = faceOffsets(wall, thick)
  const dir = wallDir(wall)
  const n = leftNormal(dir)
  return [offsets.left, offsets.right].map((dist) => ({
    a: add(wall.a, scale(n, dist)),
    b: add(wall.b, scale(n, dist)),
    dir,
    len: wallLen(wall),
  }))
}

function axisOf(wall, end) {
  const anchor = wall[end === 'a' ? 'b' : 'a']
  const moving = wall[end]
  const dir = unit(moving.x - anchor.x, moving.z - anchor.z)
  return { anchor, moving, dir }
}

function onAxis(anchor, dir, distance) {
  return { x: anchor.x + dir.x * distance, z: anchor.z + dir.z * distance }
}

function projectParam(origin, dir, point) {
  return (point.x - origin.x) * dir.x + (point.z - origin.z) * dir.z
}

function angleKind(a, b) {
  const dot = Math.abs(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)))
  const deg = Math.acos(dot) * 180 / Math.PI
  if (deg <= 8) return 'collinear'
  if (Math.abs(deg - 90) <= 8) return 'perpendicular'
  return null
}

function nearerEnd(wall, point) {
  const da = hypot(wall.a.x - point.x, wall.a.z - point.z)
  const db = hypot(wall.b.x - point.x, wall.b.z - point.z)
  return da <= db ? 'a' : 'b'
}

export function joinCorner(plan, idA, idB) {
  const walls = plan?.walls || []
  const first = walls.find((item) => item.id === idA)
  const second = walls.find((item) => item.id === idB)
  if (!first || !second || first.id === second.id) return plan
  const da = wallDir(first)
  const db = wallDir(second)
  const hit = lineIntersect(first.a, da, second.a, db)
  if (!hit) return plan
  if (hypot(hit.x - first.a.x, hit.z - first.a.z) > 40 && hypot(hit.x - first.b.x, hit.z - first.b.z) > 40) return plan
  const endA = nearerEnd(first, hit)
  const endB = nearerEnd(second, hit)
  let next = setEndpoint(plan, first.id, endA, hit)
  const moved = (next.walls || []).find((item) => item.id === second.id) || second
  const end = nearerEnd(moved, hit)
  next = setEndpoint(next, second.id, end, hit)
  return next
}

export function extendToWall(plan, wallId, end, targetId) {
  const wall = (plan?.walls || []).find((item) => item.id === wallId)
  const target = (plan?.walls || []).find((item) => item.id === targetId)
  if (!wall || !target || end !== 'a' && end !== 'b') return plan
  const { anchor, moving, dir } = axisOf(wall, end)
  let best = null
  faceLines(target, plan).forEach((face) => {
    const hit = lineIntersect(anchor, dir, face.a, face.dir)
    if (!hit) return
    const along = projectParam(anchor, dir, hit)
    if (along < 0.04) return
    const dist = hypot(hit.x - moving.x, hit.z - moving.z)
    if (!best || dist < best.dist) best = { hit, dist, face }
  })
  if (!best) return plan
  const half = Math.max(0.08, (thicknessOf(target, plan) || 0.24) / 2 + 0.02)
  const corner = [target.a, target.b].some((point) => hypot(point.x - best.hit.x, point.z - best.hit.z) <= half + 0.04)
  if (corner) return joinCorner(plan, wallId, targetId)
  return setEndpoint(plan, wallId, end, best.hit)
}

export function snapWallEnd(cursor, wall, end, walls, radius, plan = null) {
  const { anchor, dir } = axisOf(wall, end)
  const along = Math.max(0.05, projectParam(anchor, dir, cursor || wall[end]))
  const raw = onAxis(anchor, dir, along)
  let best = null
  const consider = (point, kind, targetId, dist) => {
    const rank = kind === 'face' ? 0 : kind === 'corner' ? 1 : 2
    if (!best || rank < best.rank || (rank === best.rank && dist < best.dist)) {
      best = { point, kind, targetId, dist, rank, onFace: kind === 'face' || kind === 'extension' }
    }
  }
  ;(walls || []).forEach((other) => {
    if (!other || other.id === wall.id || !other.a || !other.b) return
    const reach = Math.max(0.02, Number(radius) || 0.2)
    faceLines(other, plan).forEach((face) => {
      const hit = lineIntersect(anchor, dir, face.a, face.dir)
      if (!hit) return
      const travel = projectParam(anchor, dir, hit)
      if (travel < 0.05) return
      const point = onAxis(anchor, dir, travel)
      const dist = hypot(point.x - raw.x, point.z - raw.z)
      if (dist > reach) return
      const t = projectParam(face.a, face.dir, hit) / (face.len || 1)
      consider(point, t >= -0.02 && t <= 1.02 ? 'face' : 'extension', other.id, dist)
    })
    ;[other.a, other.b].forEach((corner) => {
      const travel = projectParam(anchor, dir, corner)
      if (travel < 0.05) return
      const point = onAxis(anchor, dir, travel)
      const off = hypot(point.x - corner.x, point.z - corner.z)
      const dist = hypot(point.x - raw.x, point.z - raw.z)
      if (off <= reach && dist <= reach) consider(point, 'corner', other.id, dist)
    })
  })
  if (!best) return { point: raw, onFace: false, kind: null, targetId: null }
  return best
}

export function healCandidate(plan) {
  const walls = plan?.walls || []
  let best = null
  walls.forEach((wall) => {
    const dir = wallDir(wall)
    ;['a', 'b'].forEach((end) => {
      const point = wall[end]
      walls.forEach((other) => {
        if (!other || other.id === wall.id) return
        const kind = angleKind(dir, wallDir(other))
        if (!kind) return
        faceLines(other, plan).forEach((face) => {
          const relX = point.x - face.a.x
          const relZ = point.z - face.a.z
          const t = (relX * face.dir.x + relZ * face.dir.z) / (face.len || 1)
          if (t < -0.05 || t > 1.05) return
          const on = {
            x: face.a.x + face.dir.x * face.len * Math.max(0, Math.min(1, t)),
            z: face.a.z + face.dir.z * face.len * Math.max(0, Math.min(1, t)),
          }
          const dist = hypot(point.x - on.x, point.z - on.z)
          if (dist > 0.05 || dist < 0.002) return
          if (!best || dist < best.dist) {
            best = { wallId: wall.id, end, targetId: other.id, dist, kind }
          }
        })
      })
    })
  })
  return best
}
