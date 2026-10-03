// One physical panel per wall. Touching rooms share the overlapping run
// instead of each extruding its own box, so the plan, the 3D view and the
// quantity list count that wall once.

import { edgesOf, outlineOf, pointInPolygon } from './cadDraw.js'

const PLANE_TOL = 0.16
const MIN_RUN = 0.08

function roundMm(value) {
  return Math.round(value * 1000) / 1000
}

function overlapLen(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

function roomWallEdges(room) {
  if (!room || room.type === 'yard') return []
  const outline = outlineOf(room)
  const thickness = Math.max(0.04, room.wallThickness || 0.1)
  const height = room.height || 3
  return edgesOf(outline).map((edge) => {
    const len = edge.len || 1
    let nx = -(edge.z2 - edge.z1) / len
    let nz = (edge.x2 - edge.x1) / len
    const mx = (edge.x1 + edge.x2) / 2
    const mz = (edge.z1 + edge.z2) / 2
    if (!pointInPolygon(mx + nx * 0.05, mz + nz * 0.05, outline)) {
      nx = -nx
      nz = -nz
    }
    const alongX = Math.abs(edge.z2 - edge.z1) <= Math.abs(edge.x2 - edge.x1)
    if (alongX && Math.abs(edge.z2 - edge.z1) > 0.05) return null
    if (!alongX && Math.abs(edge.x2 - edge.x1) > 0.05) return null
    const axis = alongX ? 'x' : 'z'
    const plane = roundMm(alongX ? edge.z1 : edge.x1)
    const inward = alongX ? (Math.sign(nz) || 1) : (Math.sign(nx) || 1)
    const a = roundMm(alongX ? Math.min(edge.x1, edge.x2) : Math.min(edge.z1, edge.z2))
    const b = roundMm(alongX ? Math.max(edge.x1, edge.x2) : Math.max(edge.z1, edge.z2))
    if (b - a < MIN_RUN) return null
    return { roomId: room.id, height, thickness, axis, plane, inward, a, b }
  }).filter(Boolean)
}

function placeSlab(covering, plane) {
  const thickness = Math.max(...covering.map((edge) => edge.thickness))
  const height = Math.max(...covering.map((edge) => edge.height))
  const shared = covering.length > 1
  const containers = covering.filter((edge) => covering.every((other) => edge.a <= other.a + 0.03 && edge.b >= other.b - 0.03))
  let c0
  let c1
  if (!shared || containers.length === 1) {
    const host = containers[0] || covering[0]
    const sign = host.inward
    c0 = roundMm(Math.min(plane, plane + sign * host.thickness))
    c1 = roundMm(Math.max(plane, plane + sign * host.thickness))
  } else {
    c0 = roundMm(plane - thickness / 2)
    c1 = roundMm(plane + thickness / 2)
  }
  return { thickness: roundMm(c1 - c0), height, shared, c0, c1 }
}

function mergeRuns(panels) {
  const groups = new Map()
  panels.forEach((panel) => {
    const key = [panel.axis, panel.c0, panel.c1, panel.y1, panel.shared].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(panel)
  })
  const merged = []
  groups.forEach((list) => {
    list.sort((a, b) => a.a - b.a)
    list.forEach((panel) => {
      const prev = merged[merged.length - 1]
      const same = prev
        && prev.axis === panel.axis
        && Math.abs(prev.c0 - panel.c0) < 0.004
        && Math.abs(prev.c1 - panel.c1) < 0.004
        && Math.abs(prev.y1 - panel.y1) < 0.004
        && prev.shared === panel.shared
        && panel.a <= prev.b + 0.02
      if (!same) {
        merged.push({ ...panel, roomIds: [...panel.roomIds] })
        return
      }
      prev.b = Math.max(prev.b, panel.b)
      panel.roomIds.forEach((id) => {
        if (!prev.roomIds.includes(id)) prev.roomIds.push(id)
      })
    })
  })
  return merged
}

function endHits(end, lo, hi) {
  return end >= lo - 0.03 && end <= hi + 0.03
}

function buttJoints(panels) {
  const next = panels.map((panel) => ({ ...panel, roomIds: [...panel.roomIds] }))
  next.forEach((panel) => {
    let a = panel.a
    let b = panel.b
    next.forEach((cap) => {
      if (cap === panel || cap.axis === panel.axis) return
      const stemHits = overlapLen(panel.c0, panel.c1, cap.a, cap.b) > 0.02
      const capHits = overlapLen(cap.c0, cap.c1, panel.a, panel.b) > 0.02
      if (!stemHits) return
      const aHit = endHits(a, cap.c0, cap.c1)
      const bHit = endHits(b, cap.c0, cap.c1)
      const capEndHit = capHits && (endHits(cap.a, panel.c0, panel.c1) || endHits(cap.b, panel.c0, panel.c1))
      const corner = (aHit || bHit) && capEndHit
      if (corner && panel.axis !== 'z') return
      if (!aHit && !bHit) return
      if (!corner && !capHits && !stemHits) return
      const center = (panel.a + panel.b) / 2
      const face = Math.abs(cap.c0 - center) <= Math.abs(cap.c1 - center) ? cap.c0 : cap.c1
      if (bHit && face < b && face > a + MIN_RUN) b = face
      if (aHit && face > a && face < b - MIN_RUN) a = face
    })
    panel.a = roundMm(a)
    panel.b = roundMm(b)
  })
  return next.filter((panel) => panel.b - panel.a >= MIN_RUN)
}

function doorSpan(room, door) {
  const wall = door.wall || 's'
  const alongX = wall === 'n' || wall === 's'
  const width = Math.max(0.4, door.width || 0.9)
  const center = alongX ? room.x + (door.x || 0) : room.z + (door.z || 0)
  const plane = alongX ? room.z + (door.z || 0) : room.x + (door.x || 0)
  return {
    id: door.id,
    roomId: room.id,
    wall,
    axis: alongX ? 'x' : 'z',
    plane,
    a: roundMm(center - width / 2),
    b: roundMm(center + width / 2),
    height: Math.max(1.4, door.height || 2),
    width,
  }
}

function attachOpenings(panels, rooms) {
  const doors = []
  ;(rooms || []).forEach((room) => {
    ;(room.equipment || []).forEach((item) => {
      if (item?.category === 'door') doors.push(doorSpan(room, item))
    })
  })
  return panels.map((panel) => {
    const openings = []
    doors.forEach((door) => {
      if (door.axis !== panel.axis) return
      if (Math.abs(door.plane - panel.plane) > 0.22) return
      const a = Math.max(panel.a, door.a)
      const b = Math.min(panel.b, door.b)
      if (b - a < 0.3) return
      if (openings.some((opening) => opening.id === door.id)) return
      openings.push({ id: door.id, a, b, height: Math.min(door.height, panel.y1 - 0.05) })
    })
    openings.sort((a, b) => a.a - b.a)
    return { ...panel, openings }
  })
}

function buildPieces(panel) {
  const pieces = []
  let cursor = panel.a
  panel.openings.forEach((opening) => {
    if (opening.a - cursor > 0.02) pieces.push({ a: cursor, b: opening.a, y0: 0, y1: panel.y1 })
    if (panel.y1 - opening.height > 0.04) pieces.push({ a: opening.a, b: opening.b, y0: opening.height, y1: panel.y1 })
    cursor = Math.max(cursor, opening.b)
  })
  if (panel.b - cursor > 0.02) pieces.push({ a: cursor, b: panel.b, y0: 0, y1: panel.y1 })
  return pieces
}

export function sharedWallPanels(rooms) {
  const edges = (rooms || []).flatMap(roomWallEdges)
  const groups = []
  edges.forEach((edge) => {
    let group = groups.find((item) => item.axis === edge.axis && Math.abs(item.plane - edge.plane) <= PLANE_TOL)
    if (!group) {
      group = { axis: edge.axis, plane: edge.plane, edges: [] }
      groups.push(group)
    } else {
      group.plane = roundMm((group.plane * group.edges.length + edge.plane) / (group.edges.length + 1))
    }
    group.edges.push(edge)
  })
  const raw = []
  groups.forEach((group) => {
    const marks = [...new Set(group.edges.flatMap((edge) => [edge.a, edge.b]))].sort((a, b) => a - b)
    for (let i = 0; i < marks.length - 1; i += 1) {
      const a = marks[i]
      const b = marks[i + 1]
      if (b - a < MIN_RUN) continue
      const mid = (a + b) / 2
      const covering = group.edges.filter((edge) => mid > edge.a + 0.01 && mid < edge.b - 0.01)
      if (!covering.length) continue
      const slab = placeSlab(covering, group.plane)
      raw.push({
        axis: group.axis,
        plane: group.plane,
        a,
        b,
        c0: slab.c0,
        c1: slab.c1,
        y0: 0,
        y1: slab.height,
        thickness: slab.thickness,
        shared: slab.shared,
        roomIds: [...new Set(covering.map((edge) => edge.roomId))],
      })
    }
  })
  const joined = attachOpenings(buttJoints(mergeRuns(raw)), rooms)
  return joined.map((panel, index) => ({
    ...panel,
    id: `panel-${index}`,
    pieces: buildPieces(panel),
  }))
}

export function panelPolygon(panel) {
  if (panel.axis === 'x') {
    return [
      { x: panel.a, z: panel.c0 },
      { x: panel.b, z: panel.c0 },
      { x: panel.b, z: panel.c1 },
      { x: panel.a, z: panel.c1 },
    ]
  }
  return [
    { x: panel.c0, z: panel.a },
    { x: panel.c1, z: panel.a },
    { x: panel.c1, z: panel.b },
    { x: panel.c0, z: panel.b },
  ]
}

export function panelSchedule(rooms) {
  const panels = sharedWallPanels(rooms)
  let gross = 0
  let net = 0
  let shared = 0
  panels.forEach((panel) => {
    const length = panel.b - panel.a
    const area = length * (panel.y1 - panel.y0)
    const holes = panel.openings.reduce((sum, opening) => sum + (opening.b - opening.a) * opening.height, 0)
    gross += area
    net += Math.max(0, area - holes)
    if (panel.shared) shared += 1
  })
  return {
    panels,
    count: panels.length,
    shared,
    gross,
    net,
  }
}
