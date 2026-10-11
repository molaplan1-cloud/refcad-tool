// Insulated cold-room panels are ordinary walls. Drawing, snapping, joining
// and room detection go through the floor-plan engine.

import { bboxOf } from './cadDraw.js'
import { createRoom } from './geometry.js'
import { reseatWallDevices } from './coldDevices.js'
import { detectRooms, emptyPlan, moveCorner, nearestWall, segmentLength, setEndpoint } from './floorplan.js'
import { extendToWall, joinCorner } from './wallJoin.js'
import { commitDrawnWall } from './wallDraw.js'

export const PANEL_MM = [80, 100, 120, 150, 200]

export function emptyPanelPlan() {
  return {
    ...emptyPlan('Kylmiö'),
    projectType: 'kylmio',
    buildingType: 'kylmio',
    panelMm: 100,
    walls: [],
    openings: [],
    rooms: [],
    fixtures: [],
  }
}

export function commitPanel(plan, a, b, thicknessMm = 100) {
  const base = plan?.walls ? plan : emptyPanelPlan()
  const thickness = (Number(thicknessMm) || 100) / 1000
  const next = commitDrawnWall(base, a, b, { kind: 'panel', panel: true, thickness, axisDeg: 2 })
  return { ...next, panelMm: thicknessMm, projectType: 'kylmio', buildingType: 'kylmio' }
}

function faceKey(face) {
  return [...new Set((face.walls || []).map((edge) => edge.wallId).filter(Boolean))].sort().join('|')
}

function reshape(room, face, thicknessM) {
  const box = bboxOf(face.polygon || [])
  return {
    ...room,
    panelKey: faceKey(face),
    x: box.x,
    z: box.z,
    width: Math.max(0.4, box.width),
    depth: Math.max(0.4, box.depth),
    outline: face.polygon,
    wallThickness: thicknessM,
    ceilingThickness: room.ceilingThickness || thicknessM,
    floorThickness: room.floorThickness || thicknessM,
  }
}

export function roomsFromPanels(plan, previous = [], typeId = 'chilled') {
  const detected = detectRooms(plan?.walls || [], [], plan?.openings || [])
    .filter((face) => (face.area || 0) > 0.4 && (face.polygon || []).length >= 3)
  const thicknessM = Math.max(0.04, (Number(plan?.panelMm) || 100) / 1000)
  const used = new Set()
  const claim = (face) => {
    const key = faceKey(face)
    const exact = (previous || []).find((room) => room.panelKey === key && !used.has(room.id))
    if (exact) return exact
    const faceIds = key ? key.split('|') : []
    let best = null
    ;(previous || []).forEach((room) => {
      if (!room.panelKey || used.has(room.id)) return
      const ids = room.panelKey.split('|').filter(Boolean)
      const overlap = ids.filter((id) => faceIds.includes(id)).length
      const dist = Math.hypot((room.x || 0) - face.cx, (room.z || 0) - face.cz)
      if (overlap >= 2) {
        const score = overlap * 100 - dist
        if (!best || score > best.score) best = { room, score, overlap }
        return
      }
      if (dist < 2.5 && (!best || ((best.overlap || 0) < 1 && dist < best.dist))) {
        best = { room, dist, overlap: 0, score: -dist }
      }
    })
    return best?.room || null
  }
  const synced = detected.map((face) => {
    const key = faceKey(face)
    const prev = claim(face)
    if (prev) {
      used.add(prev.id)
      return reseatWallDevices(reshape(prev, face, thicknessM))
    }
    const created = createRoom({
      typeId: typeId || 'chilled',
      x: face.cx,
      z: face.cz,
      width: 1,
      depth: 1,
      rooms: previous || [],
    })
    return { ...reshape(created, face, thicknessM), panelKey: key }
  })
  const loose = (previous || []).filter((room) => !room.panelKey)
  return [...loose, ...synced]
}

function roundMm(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function shiftPoint(point, dx, dz) {
  return { x: roundMm((point?.x || 0) + dx), z: roundMm((point?.z || 0) + dz) }
}

function samePoint(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) < 0.008
}

function wallIdSet(room) {
  return new Set(String(room?.panelKey || '').split('|').filter(Boolean))
}

function polygonCentroid(points) {
  let x = 0
  let z = 0
  ;(points || []).forEach((point) => {
    x += point.x
    z += point.z
  })
  const count = Math.max(1, (points || []).length)
  return { x: x / count, z: z / count }
}

// Push each inner edge out by half the panel thickness and meet the neighbours.
// That is the wall centreline the face was inset from.
function expandOutward(polygon, distance) {
  const center = polygonCentroid(polygon)
  const lines = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const len = Math.hypot(next.x - point.x, next.z - point.z) || 1
    const dx = (next.x - point.x) / len
    const dz = (next.z - point.z) / len
    let nx = -dz
    let nz = dx
    const midX = (point.x + next.x) / 2
    const midZ = (point.z + next.z) / 2
    if ((center.x - midX) * nx + (center.z - midZ) * nz > 0) {
      nx = -nx
      nz = -nz
    }
    return {
      a: { x: point.x + nx * distance, z: point.z + nz * distance },
      b: { x: next.x + nx * distance, z: next.z + nz * distance },
      dx,
      dz,
    }
  })
  const points = []
  for (let i = 0; i < lines.length; i += 1) {
    const prev = lines[(i + lines.length - 1) % lines.length]
    const current = lines[i]
    const den = prev.dx * current.dz - prev.dz * current.dx
    if (Math.abs(den) < 1e-6) {
      points.push({ x: roundMm(current.a.x), z: roundMm(current.a.z) })
      continue
    }
    const t = ((current.a.x - prev.a.x) * current.dz - (current.a.z - prev.a.z) * current.dx) / den
    points.push({
      x: roundMm(prev.a.x + prev.dx * t),
      z: roundMm(prev.a.z + prev.dz * t),
    })
  }
  return points
}

function sideOf(x, z, center) {
  const dx = x - center.x
  const dz = z - center.z
  if (Math.abs(dx) >= Math.abs(dz)) return dx < 0 ? 'w' : 'e'
  return dz < 0 ? 'n' : 's'
}

function pairWallsToEdges(walls, edges, oldCenter, newCenter) {
  const wallBuckets = { n: [], s: [], e: [], w: [] }
  const edgeBuckets = { n: [], s: [], e: [], w: [] }
  walls.forEach((wall) => {
    const mx = (wall.a.x + wall.b.x) / 2
    const mz = (wall.a.z + wall.b.z) / 2
    wallBuckets[sideOf(mx, mz, oldCenter)].push({ wall, mx, mz })
  })
  edges.forEach((edge) => {
    edgeBuckets[sideOf(edge.mx, edge.mz, newCenter)].push(edge)
  })
  const pairs = []
  ;['n', 's', 'e', 'w'].forEach((side) => {
    const horizontal = side === 'n' || side === 's'
    const owned = wallBuckets[side].slice().sort((a, b) => (horizontal ? a.mx - b.mx : a.mz - b.mz))
    const found = edgeBuckets[side].slice().sort((a, b) => (horizontal ? a.mx - b.mx : a.mz - b.mz))
    const count = Math.min(owned.length, found.length)
    for (let i = 0; i < count; i += 1) pairs.push({ wall: owned[i].wall, edge: found[i] })
  })
  return pairs
}

function assignEnds(wall, a, b) {
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const ex = b.x - a.x
  const ez = b.z - a.z
  if (dx * ex + dz * ez < 0) return { a: { x: roundMm(b.x), z: roundMm(b.z) }, b: { x: roundMm(a.x), z: roundMm(a.z) } }
  return { a: { x: roundMm(a.x), z: roundMm(a.z) }, b: { x: roundMm(b.x), z: roundMm(b.z) } }
}

function clampOpenings(openings, walls) {
  return (openings || []).map((opening) => {
    const wall = (walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return opening
    const len = segmentLength(wall.a, wall.b)
    const half = (opening.width || 0.9) / 2 + 0.05
    if (!(len > half * 2)) return opening
    const offset = Math.min(Math.max(half, opening.offset || len / 2), len - half)
    return Math.abs(offset - (opening.offset || 0)) < 0.0005 ? opening : { ...opening, offset }
  })
}

function taggedPlan(plan, walls) {
  return {
    ...plan,
    walls,
    openings: clampOpenings(plan.openings, walls),
    panelMm: plan.panelMm,
    projectType: plan.projectType || 'kylmio',
    buildingType: plan.buildingType || 'kylmio',
  }
}

// A saved plan can hold a room polygon that no longer sits on its walls.
// The walls stay; the polygon is built from them again. Labels and equipment
// stay with the room through roomsFromPanels.
export function repairRoomsFromWalls(plan, previous = [], typeId = 'chilled') {
  if (!(plan?.walls || []).length) return previous || []
  return roomsFromPanels(plan, previous, typeId)
}

function mergeIntervals(list) {
  const items = (list || [])
    .filter((span) => span && span[1] - span[0] > 0.02)
    .map((span) => [Math.min(span[0], span[1]), Math.max(span[0], span[1])])
    .sort((a, b) => a[0] - b[0])
  const out = []
  items.forEach(([lo, hi]) => {
    const prev = out[out.length - 1]
    if (prev && lo <= prev[1] + 0.02) prev[1] = Math.max(prev[1], hi)
    else out.push([lo, hi])
  })
  return out
}

function subtractIntervals(base, cut) {
  let pieces = mergeIntervals(base)
  mergeIntervals(cut).forEach(([c0, c1]) => {
    const next = []
    pieces.forEach(([lo, hi]) => {
      if (c1 <= lo + 0.01 || c0 >= hi - 0.01) {
        next.push([lo, hi])
        return
      }
      if (c0 > lo + 0.01) next.push([lo, Math.min(hi, c0)])
      if (c1 < hi - 0.01) next.push([Math.max(lo, c1), hi])
    })
    pieces = next
  })
  return pieces.filter(([lo, hi]) => hi - lo > 0.02)
}

function intersectIntervals(base, cut) {
  const out = []
  mergeIntervals(base).forEach(([a0, a1]) => {
    mergeIntervals(cut).forEach(([b0, b1]) => {
      const lo = Math.max(a0, b0)
      const hi = Math.min(a1, b1)
      if (hi - lo > 0.02) out.push([lo, hi])
    })
  })
  return out
}

function pointAt(wall, t) {
  return {
    x: roundMm(wall.a.x + (wall.b.x - wall.a.x) * t),
    z: roundMm(wall.a.z + (wall.b.z - wall.a.z) * t),
  }
}

function splitAtJunctions(walls) {
  let list = (walls || []).map((wall) => ({ ...wall, a: { ...wall.a }, b: { ...wall.b } }))
  for (let guard = 0; guard < 16; guard += 1) {
    let hit = null
    for (const wall of list) {
      const dx = wall.b.x - wall.a.x
      const dz = wall.b.z - wall.a.z
      const len2 = dx * dx + dz * dz
      const len = Math.sqrt(len2)
      if (len < 0.2) continue
      for (const other of list) {
        if (other.id === wall.id) continue
        for (const point of [other.a, other.b]) {
          if (samePoint(point, wall.a) || samePoint(point, wall.b)) continue
          const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len2
          if (t <= 0.03 || t >= 0.97) continue
          const px = wall.a.x + dx * t
          const pz = wall.a.z + dz * t
          if (Math.hypot(px - point.x, pz - point.z) > 0.03) continue
          hit = { wall, point: { x: roundMm(point.x), z: roundMm(point.z) } }
          break
        }
        if (hit) break
      }
      if (hit) break
    }
    if (!hit) break
    const id = `${hit.wall.id}~j${guard + 1}`
    list = list.flatMap((wall) => (
      wall.id !== hit.wall.id
        ? [wall]
        : [{ ...wall, b: hit.point }, { ...wall, id, a: hit.point }]
    ))
  }
  return list.filter((wall) => Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) >= 0.04)
}

function isJunctionChild(parentId, wallId) {
  const prefix = `${parentId}~j`
  if (!String(wallId).startsWith(prefix)) return false
  return /^j\d+$/.test(String(wallId).slice(parentId.length + 1))
}

function ownsWall(room, wallId) {
  const ids = wallIdSet(room)
  if (ids.has(wallId)) return true
  for (const id of ids) {
    if (isJunctionChild(id, wallId)) return true
  }
  return false
}

function intervalsOnWall(room, wall) {
  const half = Math.max(0.02, (Number(room?.wallThickness) || 0.1) / 2)
  const poly = (room?.outline || []).length >= 3 ? expandOutward(room.outline, half) : null
  if (!poly) return []
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const len = Math.hypot(dx, dz) || 1
  const dirx = dx / len
  const dirz = dz / len
  const nx = -dirz
  const nz = dirx
  const spans = []
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const el = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const parallel = Math.abs(((b.x - a.x) * dirx + (b.z - a.z) * dirz) / el) > 0.98
    if (!parallel) continue
    const dist = Math.abs((a.x - wall.a.x) * nx + (a.z - wall.a.z) * nz)
    if (dist > 0.045) continue
    const t0 = ((a.x - wall.a.x) * dirx + (a.z - wall.a.z) * dirz) / len
    const t1 = ((b.x - wall.a.x) * dirx + (b.z - wall.a.z) * dirz) / len
    const lo = Math.max(0, Math.min(t0, t1))
    const hi = Math.min(1, Math.max(t0, t1))
    if (hi - lo > 0.02) spans.push([lo, hi])
  }
  return mergeIntervals(spans)
}

function jointUsers(walls, point) {
  return walls.reduce((count, wall) => (
    count + (samePoint(wall.a, point) || samePoint(wall.b, point) ? 1 : 0)
  ), 0)
}

function mergeCollinearRuns(walls) {
  let list = walls.filter((wall) => Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) >= 0.04)
  for (let guard = 0; guard < list.length + 2; guard += 1) {
    let merged = false
    for (let i = 0; i < list.length && !merged; i += 1) {
      for (let j = i + 1; j < list.length && !merged; j += 1) {
        const A = list[i]
        const B = list[j]
        const adx = A.b.x - A.a.x
        const adz = A.b.z - A.a.z
        const al = Math.hypot(adx, adz) || 1
        const bdx = B.b.x - B.a.x
        const bdz = B.b.z - B.a.z
        const bl = Math.hypot(bdx, bdz) || 1
        if (Math.abs((adx * bdx + adz * bdz) / (al * bl)) < 0.995) continue
        const joint = samePoint(A.b, B.a) ? A.b
          : samePoint(A.a, B.b) ? A.a
            : samePoint(A.b, B.b) ? A.b
              : samePoint(A.a, B.a) ? A.a
                : null
        if (!joint || jointUsers(list, joint) !== 2) continue
        const far = (wall) => (samePoint(wall.a, joint) ? wall.b : wall.a)
        const a = far(A)
        const b = far(B)
        if (Math.hypot(b.x - a.x, b.z - a.z) < 0.04) continue
        const next = { ...A, a, b }
        list = list.filter((wall) => wall !== A && wall !== B)
        list.push(next)
        merged = true
      }
    }
    if (!merged) break
  }
  return list
}

// Dragging a room carries its walls. A run that also bounds a room left
// behind stays with that neighbour. The moved room gets its own run only for
// the part that no longer meets the neighbour, so the two never overlap.
export function translatePanelRooms(plan, rooms, movingIds, dx, dz) {
  const idList = [...(movingIds || [])].filter(Boolean)
  if (!plan?.walls?.length || !idList.length) return { plan, copied: false }
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < 1e-6) return { plan, copied: false }
  const moving = new Set(idList)
  const stamp = idList.slice().sort().join(',')
  const source = splitAtJunctions(plan.walls)
  const built = []
  let copied = false
  let extra = 0
  const piece = (wall, t0, t1, shift, keepId) => {
    let a = pointAt(wall, t0)
    let b = pointAt(wall, t1)
    if (shift) {
      a = shiftPoint(a, shift.x, shift.z)
      b = shiftPoint(b, shift.x, shift.z)
    }
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.04) return null
    const id = keepId ? wall.id : `${wall.id}~${stamp}~${extra += 1}`
    return { ...wall, id, a, b }
  }
  source.forEach((wall) => {
    const moveRooms = (rooms || []).filter((room) => moving.has(room.id) && ownsWall(room, wall.id))
    const stayRooms = (rooms || []).filter((room) => !moving.has(room.id) && ownsWall(room, wall.id))
    let moveInts = mergeIntervals(moveRooms.flatMap((room) => intervalsOnWall(room, wall)))
    let stayInts = mergeIntervals(stayRooms.flatMap((room) => intervalsOnWall(room, wall)))
    if (moveRooms.length && !moveInts.length) moveInts = [[0, 1]]
    if (stayRooms.length && !stayInts.length) stayInts = [[0, 1]]
    if (!moveInts.length && !stayInts.length) {
      built.push(wall)
      return
    }
    if (moveInts.length && !stayInts.length) {
      built.push({ ...wall, a: shiftPoint(wall.a, dx, dz), b: shiftPoint(wall.b, dx, dz) })
      return
    }
    if (stayInts.length && !moveInts.length) {
      built.push(wall)
      return
    }
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1
    const dirx = (wall.b.x - wall.a.x) / len
    const dirz = (wall.b.z - wall.a.z) / len
    const perp = dx * -dirz + dz * dirx
    if (Math.abs(perp) >= 0.03) {
      stayInts.forEach((span, index) => {
        const part = piece(wall, span[0], span[1], null, index === 0)
        if (part) built.push(part)
      })
      moveInts.forEach((span) => {
        const part = piece(wall, span[0], span[1], { x: dx, z: dz }, false)
        if (part) {
          built.push(part)
          copied = true
        }
      })
      return
    }
    const along = (dx * dirx + dz * dirz) / len
    const moved = moveInts.map(([lo, hi]) => [lo + along, hi + along])
    const overlap = intersectIntervals(stayInts, moved)
    const stayOnly = subtractIntervals(stayInts, moved)
    const moveOnly = subtractIntervals(moved, stayInts)
    const stayParts = [...stayOnly, ...overlap]
    stayParts.forEach((span, index) => {
      const part = piece(wall, span[0], span[1], null, index === 0)
      if (part) built.push(part)
    })
    moveOnly.forEach((span) => {
      const part = piece(wall, span[0], span[1], null, false)
      if (part) {
        built.push(part)
        copied = true
      }
    })
  })
  const walls = mergeCollinearRuns(built)
  const sameLayout = walls.length === plan.walls.length && walls.every((wall, index) => {
    const prev = plan.walls[index]
    return prev && wall.id === prev.id && samePoint(wall.a, prev.a) && samePoint(wall.b, prev.b)
  })
  if (sameLayout && !copied) return { plan, copied: false }
  return { plan: taggedPlan(plan, walls), copied }
}

// The room outline is the inner face. Moving it rebuilds the centreline walls
// so the fill and the panels stay one shape.
export function reshapePanelRoom(plan, rooms, room, innerPoints) {
  const points = (innerPoints || []).filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z))
  if (!plan?.walls?.length || !room?.panelKey || points.length < 3) return { plan, copied: false }
  const ids = wallIdSet(room)
  const owned = (plan.walls || []).filter((wall) => ids.has(wall.id))
  if (!owned.length) return { plan, copied: false }
  const half = Math.max(0.02, (Number(room.wallThickness) || (Number(plan.panelMm) || 100) / 1000) / 2)
  const centerline = expandOutward(points, half)
  if (centerline.length < 3) return { plan, copied: false }
  const oldCenter = { x: room.x || 0, z: room.z || 0 }
  const newCenter = polygonCentroid(points)
  const edges = centerline.map((point, index) => {
    const next = centerline[(index + 1) % centerline.length]
    return {
      a: point,
      b: next,
      mx: (point.x + next.x) / 2,
      mz: (point.z + next.z) / 2,
    }
  })
  const pairs = pairWallsToEdges(owned, edges, oldCenter, newCenter)
  if (!pairs.length) return { plan, copied: false }
  const stayWalls = new Set()
  ;(rooms || []).forEach((other) => {
    if (other.id === room.id) return
    wallIdSet(other).forEach((id) => stayWalls.add(id))
  })
  const placed = new Map()
  let copied = false
  let changed = false
  pairs.forEach(({ wall, edge }) => {
    const ends = assignEnds(wall, edge.a, edge.b)
    const moved = !samePoint(wall.a, ends.a) || !samePoint(wall.b, ends.b)
    if (!moved) {
      placed.set(wall.id, wall)
      return
    }
    changed = true
    if (stayWalls.has(wall.id)) {
      const id = `${wall.id}~${room.id}`
      if ((plan.walls || []).some((item) => item.id === id)) {
        placed.set(wall.id, { ...wall, id, a: ends.a, b: ends.b })
      } else {
        placed.set(wall.id, { ...wall, id, a: ends.a, b: ends.b })
        copied = true
      }
      return
    }
    placed.set(wall.id, { ...wall, a: ends.a, b: ends.b })
  })
  if (!changed) return { plan, copied: false }
  const clones = []
  const walls = plan.walls.map((wall) => {
    const next = placed.get(wall.id)
    if (!next) return wall
    if (next.id !== wall.id) {
      clones.push(next)
      return wall
    }
    return next
  })
  return { plan: taggedPlan(plan, clones.length ? [...walls, ...clones] : walls), copied }
}

export function resizePanelRoom(plan, rooms, room, box) {
  if (!box) return { plan, copied: false }
  const left = Math.min(box.left, box.right)
  const right = Math.max(box.left, box.right)
  const top = Math.min(box.top, box.bottom)
  const bottom = Math.max(box.top, box.bottom)
  if (right - left < 0.3 || bottom - top < 0.3) return { plan, copied: false }
  return reshapePanelRoom(plan, rooms, room, [
    { x: left, z: top },
    { x: right, z: top },
    { x: right, z: bottom },
    { x: left, z: bottom },
  ])
}

function nearPoint(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) <= 0.04
}

export function setPanelEnd(plan, id, end, point) {
  const wall = (plan?.walls || []).find((item) => item.id === id)
  if (!wall || (end !== 'a' && end !== 'b') || !point) return plan
  const from = wall[end]
  const shared = (plan.walls || []).some((item) => item.id !== id && (nearPoint(item.a, from) || nearPoint(item.b, from)))
  const moved = shared ? moveCorner(plan, from, point) : setEndpoint(plan, id, end, point)
  return { ...moved, panelMm: plan.panelMm, projectType: 'kylmio', buildingType: 'kylmio' }
}

export function joinPanelCorner(plan, idA, idB) {
  return joinCorner(plan, idA, idB)
}

export function extendPanel(plan, wallId) {
  const walls = plan?.walls || []
  const wall = walls.find((item) => item.id === wallId)
  if (!wall) return plan
  let best = plan
  let bestGain = 0.05
  walls.forEach((target) => {
    if (target.id === wall.id) return
    ;['a', 'b'].forEach((end) => {
      const next = extendToWall(plan, wall.id, end, target.id)
      const before = segmentLength(wall.a, wall.b)
      const moved = (next.walls || []).find((item) => item.id === wall.id)
      const after = moved ? segmentLength(moved.a, moved.b) : before
      if (after > before + bestGain) {
        best = next
        bestGain = after - before
      }
    })
  })
  return best
}

export function snapDoorToPanel(walls, point) {
  return nearestWall(walls || [], point, 0.8)
}
