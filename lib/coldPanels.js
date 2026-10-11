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
    let best = null
    ;(previous || []).forEach((room) => {
      if (!room.panelKey || used.has(room.id)) return
      const dist = Math.hypot((room.x || 0) - face.cx, (room.z || 0) - face.cz)
      if (dist < 2.5 && (!best || dist < best.dist)) best = { room, dist }
    })
    return best?.room || null
  }
  const labelPool = [...(previous || [])]
  const synced = detected.map((face) => {
    const key = faceKey(face)
    const prev = claim(face)
    if (prev) {
      used.add(prev.id)
      const shaped = reseatWallDevices(reshape(prev, face, thicknessM))
      const poolIndex = labelPool.findIndex((room) => room.id === prev.id)
      if (poolIndex >= 0) labelPool[poolIndex] = shaped
      return shaped
    }
    const created = createRoom({
      typeId: typeId || 'chilled',
      x: face.cx,
      z: face.cz,
      width: 1,
      depth: 1,
      rooms: labelPool,
    })
    const shaped = { ...reshape(created, face, thicknessM), panelKey: key }
    labelPool.push(shaped)
    return shaped
  })
  const loose = (previous || []).filter((room) => !room.panelKey)
  return [...loose, ...synced]
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
