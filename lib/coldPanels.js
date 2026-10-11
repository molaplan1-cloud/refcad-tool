// Insulated cold-room panels are ordinary walls. Drawing, snapping, joining
// and room detection go through the floor-plan engine.

import { bboxOf } from './cadDraw.js'
import { createRoom } from './geometry.js'
import { addWall, detectRooms, emptyPlan, nearestWall, segmentLength } from './floorplan.js'
import { extendToWall, joinCorner } from './wallJoin.js'
import { parseDrawInput, pointFromDraw } from './drawInput.js'
import { shouldCloseChain, snapPoint, snapRadius, wallHeadings } from './snap.js'

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

function distToSegment(point, wall) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len))
  const x = wall.a.x + dx * len * t
  const z = wall.a.z + dz * len * t
  return Math.hypot(point.x - x, point.z - z)
}

function alreadyCovered(walls, a, b) {
  return (walls || []).some((wall) => distToSegment(a, wall) < 0.03 && distToSegment(b, wall) < 0.03)
}

export function commitPanel(plan, a, b, thicknessMm = 100) {
  const base = plan?.walls ? plan : emptyPanelPlan()
  if (!a || !b) return base
  if (alreadyCovered(base.walls, a, b)) return { ...base, panelMm: thicknessMm }
  const thickness = (Number(thicknessMm) || 100) / 1000
  const next = addWall(base, a, b, 'panel', { panel: true, thickness })
  return { ...next, panelMm: thicknessMm, projectType: 'kylmio', buildingType: 'kylmio' }
}

export function panelCursor(cursor, origin, walls, scale, typed = '') {
  const parsed = parseDrawInput(typed)
  if (origin && parsed) {
    const toward = snapPoint(cursor, {
      walls: walls || [],
      origin,
      ortho: parsed.angleDeg == null,
      grid: 0.05,
      radius: snapRadius(scale, 16),
      joinWalls: true,
      headings: wallHeadings(origin, walls),
    }).point
    return pointFromDraw(origin, toward, parsed, { ortho: parsed.angleDeg == null })
  }
  return snapPoint(cursor, {
    walls: walls || [],
    origin: origin || null,
    ortho: Boolean(origin),
    grid: 0.05,
    radius: snapRadius(scale, 16),
    joinWalls: true,
    headings: origin ? wallHeadings(origin, walls) : [],
    polarAperture: origin ? Math.PI / 12 : undefined,
  }).point
}

export function chainCloses(points, point) {
  if (!points?.length || !point) return false
  return shouldCloseChain({ start: points[0], count: points.length }, point)
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
    let best = null
    ;(previous || []).forEach((room) => {
      if (!room.panelKey || used.has(room.id)) return
      const dist = Math.hypot((room.x || 0) - face.cx, (room.z || 0) - face.cz)
      if (dist < 2.5 && (!best || dist < best.dist)) best = { room, dist }
    })
    return best?.room || null
  }
  const synced = detected.map((face) => {
    const key = faceKey(face)
    const prev = claim(face)
    if (prev) {
      used.add(prev.id)
      return reshape(prev, face, thicknessM)
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

export function setPanelEnd(plan, id, end, point) {
  if (!plan || (end !== 'a' && end !== 'b') || !point) return plan
  return {
    ...plan,
    walls: (plan.walls || []).map((wall) => (
      wall.id === id ? { ...wall, [end]: { x: point.x, z: point.z } } : wall
    )),
  }
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
