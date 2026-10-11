// Editing helpers for the cold-room plan: abut a new room instead of
// slicing an overlap, slide a wall, and place a door or evaporator on
// the wall the pointer is actually over.

import { moveWallParallel, nearestWall, segmentLength } from './floorplan.js'

function boxOf(points) {
  return (points || []).reduce((box, point) => ({
    left: Math.min(box.left, point.x),
    right: Math.max(box.right, point.x),
    top: Math.min(box.top, point.z),
    bottom: Math.max(box.bottom, point.z),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity })
}

function measureBox(corner, opposite) {
  return {
    left: Math.min(corner.x, opposite.x),
    right: Math.max(corner.x, opposite.x),
    top: Math.min(corner.z, opposite.z),
    bottom: Math.max(corner.z, opposite.z),
  }
}

function shiftBox(corner, opposite, dx, dz) {
  return {
    corner: { x: corner.x + dx, z: corner.z + dz },
    opposite: { x: opposite.x + dx, z: opposite.z + dz },
  }
}

// Positive when the spans are apart, negative by the overlap length.
function separation(a0, a1, b0, b1) {
  if (a1 <= b0) return b0 - a1
  if (b1 <= a0) return a0 - b1
  return -(Math.min(a1, b1) - Math.max(a0, b0))
}

function innerBox(corner, opposite, thickness, basis) {
  const box = measureBox(corner, opposite)
  const shrink = basis === 'outer' ? (Number(thickness) || 0) : 0
  return {
    left: box.left + shrink,
    right: box.right - shrink,
    top: box.top + shrink,
    bottom: box.bottom - shrink,
  }
}

function roomBox(room) {
  if ((room?.outline || []).length >= 3) return boxOf(room.outline)
  const hw = (room?.width || 0) / 2
  const hd = (room?.depth || 0) / 2
  return { left: room.x - hw, right: room.x + hw, top: room.z - hd, bottom: room.z + hd }
}

function gridSpan(fixed, moving, step) {
  if (!(step > 0)) return moving
  const span = moving - fixed
  const sign = span < 0 ? -1 : 1
  const steps = Math.max(3, Math.round(Math.abs(span) / step))
  return fixed + sign * steps * step
}

// The shared face stays put. Edges on the other axis pull onto the
// neighbour when they are already inside the snap radius, and every
// resulting side lands on the Tartunta step.
function alignBox(box, other, { gap, grid, radius }) {
  const step = Number(grid) > 0 ? Number(grid) : 0
  const reach = Math.max(Number(radius) > 0 ? Number(radius) : 0, step, 0.05)
  let { left, right, top, bottom } = box
  const shared = {
    left: Math.abs(left - (other.right + gap)) <= 0.02,
    right: Math.abs(right - (other.left - gap)) <= 0.02,
    top: Math.abs(top - (other.bottom + gap)) <= 0.02,
    bottom: Math.abs(bottom - (other.top - gap)) <= 0.02,
  }
  if (shared.left || shared.right) {
    if (Math.abs(top - other.top) <= reach) top = other.top
    if (Math.abs(bottom - other.bottom) <= reach) bottom = other.bottom
  }
  if (shared.top || shared.bottom) {
    if (Math.abs(left - other.left) <= reach) left = other.left
    if (Math.abs(right - other.right) <= reach) right = other.right
  }
  const snapAxis = (a, b, lockA, lockB) => {
    if (lockA && !lockB) return [a, gridSpan(a, b, step)]
    if (lockB && !lockA) return [gridSpan(b, a, step), b]
    if (!lockA && !lockB && step > 0) {
      const na = Math.round(a / step) * step
      const nb = Math.round(b / step) * step
      if (nb - na >= 0.3) return [na, nb]
    }
    return [a, b]
  }
  const topLocked = top === other.top
  const bottomLocked = bottom === other.bottom
  const leftLocked = shared.left || left === other.left
  const rightLocked = shared.right || right === other.right
  ;[top, bottom] = snapAxis(top, bottom, shared.top || topLocked, shared.bottom || bottomLocked)
  ;[left, right] = snapAxis(left, right, leftLocked, rightLocked)
  if (right - left < 0.3 || bottom - top < 0.3) return box
  return { left, right, top, bottom }
}

// A new rectangle that only nicks a neighbour snaps so the two rooms share
// that panel. A deep overlap is refused — it used to shatter into extra
// rooms that reused the next name.
export function fitAgainstRooms(corner, opposite, rooms, { thickness = 0.1, basis = 'inner', grid = 0, radius = 0.25 } = {}) {
  if (!corner || !opposite) return { corner, opposite, snapped: false, rejected: false }
  let current = { corner: { ...corner }, opposite: { ...opposite } }
  let snapped = false
  const gap = Math.max(0, Number(thickness) || 0)
  for (let pass = 0; pass < 4; pass += 1) {
    const box = innerBox(current.corner, current.opposite, thickness, basis)
    const width = box.right - box.left
    const depth = box.bottom - box.top
    let hit = null
    ;(rooms || []).forEach((room) => {
      const other = roomBox(room)
      if (!Number.isFinite(other.left)) return
      const sepX = separation(box.left, box.right, other.left, other.right)
      const sepZ = separation(box.top, box.bottom, other.top, other.bottom)
      const overlapX = Math.max(0, -sepX)
      const overlapZ = Math.max(0, -sepZ)
      const faces = (sepX <= 0.35 && overlapZ > 0.4) || (sepZ <= 0.35 && overlapX > 0.4)
      if (!faces) return
      const area = overlapX * overlapZ
      const closer = !hit || area > hit.area || (area === hit.area && Math.abs(sepX) + Math.abs(sepZ) < Math.abs(hit.sepX) + Math.abs(hit.sepZ))
      if (closer) hit = { other, sepX, sepZ, area }
    })
    if (!hit) return { ...current, snapped, rejected: false }
    const nearX = hit.sepX >= -0.6 && hit.sepX <= 0.35 && (hit.sepX >= 0 || -hit.sepX < width * 0.4)
    const nearZ = hit.sepZ >= -0.6 && hit.sepZ <= 0.35 && (hit.sepZ >= 0 || -hit.sepZ < depth * 0.4)
    const faceX = -hit.sepX > 0.45
    const faceZ = -hit.sepZ > 0.45
    const midX = (box.left + box.right) / 2
    const midZ = (box.top + box.bottom) / 2
    const otherMidX = (hit.other.left + hit.other.right) / 2
    const otherMidZ = (hit.other.top + hit.other.bottom) / 2
    if (nearX && faceZ && (!nearZ || Math.abs(hit.sepX) <= Math.abs(hit.sepZ))) {
      const onRight = midX >= otherMidX
      const shift = onRight ? (hit.other.right + gap - box.left) : (hit.other.left - gap - box.right)
      if (Math.abs(shift) > 0.0005) {
        current = shiftBox(current.corner, current.opposite, shift, 0)
        snapped = true
        continue
      }
    }
    if (nearZ && faceX) {
      const below = midZ >= otherMidZ
      const shift = below ? (hit.other.bottom + gap - box.top) : (hit.other.top - gap - box.bottom)
      if (Math.abs(shift) > 0.0005) {
        current = shiftBox(current.corner, current.opposite, 0, shift)
        snapped = true
        continue
      }
    }
    if (hit.sepX < -0.02 && hit.sepZ < -0.02) return { corner, opposite, snapped: false, rejected: true }
    const aligned = alignBox(box, hit.other, { gap, grid, radius })
    const grow = basis === 'outer' ? gap : 0
    const moved = Math.abs(aligned.left - box.left) > 0.0005
      || Math.abs(aligned.right - box.right) > 0.0005
      || Math.abs(aligned.top - box.top) > 0.0005
      || Math.abs(aligned.bottom - box.bottom) > 0.0005
    return {
      corner: { x: aligned.left - grow, z: aligned.top - grow },
      opposite: { x: aligned.right + grow, z: aligned.bottom + grow },
      snapped: snapped || moved,
      rejected: false,
    }
  }
  return { corner, opposite, snapped: false, rejected: true }
}

export function slideWallBy(plan, wallId, worldDx, worldDz) {
  const wall = (plan?.walls || []).find((item) => item.id === wallId)
  if (!wall) return plan
  const len = segmentLength(wall.a, wall.b) || 1
  const nx = -((wall.b.z - wall.a.z) / len)
  const nz = (wall.b.x - wall.a.x) / len
  const signed = (worldDx || 0) * nx + (worldDz || 0) * nz
  if (!Number.isFinite(signed) || Math.abs(signed) < 1e-6) return plan
  return moveWallParallel(plan, wallId, signed)
}

function degreeAt(walls, point) {
  return (walls || []).reduce((count, wall) => (
    count
    + (Math.hypot(wall.a.x - point.x, wall.a.z - point.z) <= 0.04 ? 1 : 0)
    + (Math.hypot(wall.b.x - point.x, wall.b.z - point.z) <= 0.04 ? 1 : 0)
  ), 0)
}

export function wallIsShared(walls, wall) {
  if (!wall) return false
  return degreeAt(walls, wall.a) >= 3 && degreeAt(walls, wall.b) >= 3
}

function spanWalls(plan, dim) {
  const horizontal = Math.abs((dim?.x2 || 0) - (dim?.x1 || 0)) >= Math.abs((dim?.z2 || 0) - (dim?.z1 || 0))
  const low = horizontal ? Math.min(dim.x1, dim.x2) : Math.min(dim.z1, dim.z2)
  const high = horizontal ? Math.max(dim.x1, dim.x2) : Math.max(dim.z1, dim.z2)
  const at = horizontal ? ((dim.z1 || 0) + (dim.z2 || 0)) / 2 : ((dim.x1 || 0) + (dim.x2 || 0)) / 2
  const walls = (plan?.walls || []).filter((wall) => {
    const vertical = Math.abs(wall.a.x - wall.b.x) <= Math.abs(wall.a.z - wall.b.z)
    if (horizontal !== vertical) return false
    const along0 = horizontal ? Math.min(wall.a.z, wall.b.z) : Math.min(wall.a.x, wall.b.x)
    const along1 = horizontal ? Math.max(wall.a.z, wall.b.z) : Math.max(wall.a.x, wall.b.x)
    if (at < along0 - 0.05 || at > along1 + 0.05) return false
    const c = horizontal ? (wall.a.x + wall.b.x) / 2 : (wall.a.z + wall.b.z) / 2
    return Math.abs(c - low) <= 0.35 || Math.abs(c - high) <= 0.35
  })
  const coord = (wall) => (horizontal ? (wall.a.x + wall.b.x) / 2 : (wall.a.z + wall.b.z) / 2)
  const lowWall = walls.filter((wall) => Math.abs(coord(wall) - low) <= Math.abs(coord(wall) - high))
    .sort((a, b) => Math.abs(coord(a) - low) - Math.abs(coord(b) - low))[0] || null
  const highWall = walls.filter((wall) => wall !== lowWall)
    .sort((a, b) => Math.abs(coord(a) - high) - Math.abs(coord(b) - high))[0] || null
  return { horizontal, low, high, lowWall, highWall }
}

export function dimensionMoveChoice(plan, dim) {
  const span = spanWalls(plan, dim)
  if (!span.lowWall || !span.highWall) return { shared: false, outer: true }
  const lowShared = wallIsShared(plan.walls, span.lowWall)
  const highShared = wallIsShared(plan.walls, span.highWall)
  return { shared: lowShared !== highShared, outer: true, lowShared, highShared }
}

// Default grows the edited room by sliding its outer wall. The neighbour
// keeps its size and the overall length changes. 'shared' slides the party wall.
export function resizeRoomSpan(plan, dim, metres, side = 'outer') {
  if (!plan || !dim) return plan
  const span = spanWalls(plan, dim)
  if (!span.lowWall || !span.highWall) return plan
  const length = Math.abs(span.high - span.low)
  const next = Math.max(0.3, Number(metres) || 0)
  const grow = next - length
  if (!Number.isFinite(grow) || Math.abs(grow) < 0.0005) return plan
  const lowShared = wallIsShared(plan.walls, span.lowWall)
  const highShared = wallIsShared(plan.walls, span.highWall)
  let moving = span.highWall
  if (side === 'shared') moving = (highShared ? span.highWall : lowShared ? span.lowWall : span.highWall)
  else if (lowShared !== highShared) moving = lowShared ? span.highWall : span.lowWall
  const shift = moving === span.lowWall ? -grow : grow
  return slideWallBy(plan, moving.id, span.horizontal ? shift : 0, span.horizontal ? 0 : shift)
}

function hostRoom(rooms, point) {
  const inside = (rooms || []).find((room) => {
    const poly = room.outline || []
    if (poly.length < 3) return false
    let hit = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const zi = poly[i].z
      const zj = poly[j].z
      if ((zi > point.z) === (zj > point.z)) continue
      const xHit = ((poly[j].x - poly[i].x) * (point.z - zi)) / ((zj - zi) || 1e-12) + poly[i].x
      if (point.x < xHit) hit = !hit
    }
    return hit
  })
  if (inside) return inside
  let best = null
  ;(rooms || []).forEach((room) => {
    const box = roomBox(room)
    const dx = point.x < box.left ? box.left - point.x : point.x > box.right ? point.x - box.right : 0
    const dz = point.z < box.top ? box.top - point.z : point.z > box.bottom ? point.z - box.bottom : 0
    const dist = Math.hypot(dx, dz)
    if (dist <= 0.45 && (!best || dist < best.dist)) best = { room, dist }
  })
  return best?.room || null
}

function wallSide(room, wall) {
  const horizontal = Math.abs(wall.a.z - wall.b.z) <= Math.abs(wall.a.x - wall.b.x)
  if (horizontal) return ((wall.a.z + wall.b.z) / 2) <= room.z ? 'n' : 's'
  return ((wall.a.x + wall.b.x) / 2) <= room.x ? 'w' : 'e'
}

export function doorPlacement(rooms, walls, point, doorWidth = 0.9) {
  const hit = nearestWall(walls || [], point, 1.4)
  if (!hit) return null
  const room = hostRoom(rooms, point) || hostRoom(rooms, { x: hit.x, z: hit.z })
  if (!room) return null
  const wall = hit.wall
  const len = segmentLength(wall.a, wall.b) || 1
  const margin = Math.min((doorWidth || 0.9) / 2 + 0.05, len / 2)
  const along = Math.max(margin, Math.min(len - margin, hit.t * len))
  const x = wall.a.x + ((wall.b.x - wall.a.x) / len) * along
  const z = wall.a.z + ((wall.b.z - wall.a.z) / len) * along
  const side = wallSide(room, wall)
  return {
    roomId: room.id,
    wallId: wall.id,
    wall: side,
    x: x - room.x,
    z: z - room.z,
    worldX: x,
    worldZ: z,
    rotation: side === 'n' || side === 's' ? 0 : 90,
    opensOut: true,
  }
}

export function evaporatorPlacement(rooms, walls, point, template = {}) {
  const hit = nearestWall(walls || [], point, 2.2)
  if (!hit) return null
  const room = hostRoom(rooms, point) || hostRoom(rooms, { x: hit.x, z: hit.z })
  if (!room) return null
  const wall = hit.wall
  const len = segmentLength(wall.a, wall.b) || 1
  const tx = (wall.b.x - wall.a.x) / len
  const tz = (wall.b.z - wall.a.z) / len
  let nx = -tz
  let nz = tx
  const toward = (room.x - hit.x) * nx + (room.z - hit.z) * nz
  if (toward < 0) {
    nx = -nx
    nz = -nz
  }
  const half = (wall.thickness || room.wallThickness || 0.1) / 2
  const alongHalf = (template.depth || 0.55) / 2 + 0.05
  const along = Math.max(alongHalf, Math.min(len - alongHalf, hit.t * len))
  const cx = wall.a.x + tx * along
  const cz = wall.a.z + tz * along
  const faceX = cx + nx * half
  const faceZ = cz + nz * half
  const back = (template.width || 0.9) / 2
  const rotation = Math.atan2(nz, nx) * 180 / Math.PI
  return {
    roomId: room.id,
    wallId: wall.id,
    x: faceX + nx * back - room.x,
    z: faceZ + nz * back - room.z,
    worldX: faceX + nx * back,
    worldZ: faceZ + nz * back,
    rotation,
    opensOut: false,
  }
}
