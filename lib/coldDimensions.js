// Cold-room dimensions are the house dimension chains: outer runs, the
// overall box, and a clear size inside each room. Extension lines are
// resolved by the same witness function as the floor plan.

import { emptyPanelPlan } from './coldPanels.js'
import { pointInPolygon } from './geometry.js'
import { dedupeDimensions, extensionWitnesses, planDimensions } from './floorplan.js'

// Inner sizes sit just inside the clear face, not through the room name.
export const INNER_FACE_OFFSET = 0.3
const MIN_WIDTH_PX = 128
const MIN_DEPTH_PX = 96

export function coldDimensionPlan(panelPlan, rooms = []) {
  const base = panelPlan?.walls ? panelPlan : emptyPanelPlan()
  return {
    ...base,
    rooms: (rooms || []).filter((room) => (room.outline || []).length >= 3 && !room.hidden).map((room) => ({
      id: room.id,
      name: room.label || room.name || '',
      polygon: room.outline,
      gross: room.outline,
    })),
  }
}

export function coldDimensions(panelPlan, rooms = []) {
  const plan = coldDimensionPlan(panelPlan, rooms)
  if (!(plan.walls || []).length) return []
  return planDimensions(plan, {
    preset: 'custom',
    dims: { overall: true, room: true, openings: false, internal: true },
  })
}

export function coldDimensionFigures(panelPlan, rooms = [], minGap = 0.35) {
  const plan = coldDimensionPlan(panelPlan, rooms)
  const dims = dedupeDimensions(coldDimensions(panelPlan, rooms), minGap)
  return dims.map((dim) => ({
    dim,
    witnesses: extensionWitnesses(dim, plan),
  }))
}

function boundsOf(points) {
  return (points || []).reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

function isHorizontal(dim) {
  return Math.abs((dim?.z2 || 0) - (dim?.z1 || 0)) <= Math.abs((dim?.x2 || 0) - (dim?.x1 || 0))
}

function midpoint(dim) {
  return { x: ((dim.x1 || 0) + (dim.x2 || 0)) / 2, z: ((dim.z1 || 0) + (dim.z2 || 0)) / 2 }
}

function segmentInside(dim, outline) {
  return [0.12, 0.5, 0.88].every((u) => pointInPolygon(
    dim.x1 + (dim.x2 - dim.x1) * u,
    dim.z1 + (dim.z2 - dim.z1) * u,
    outline,
  ))
}

function shiftToFace(dim, box, face) {
  if (isHorizontal(dim)) {
    const z = face === 'top' ? box.minZ + INNER_FACE_OFFSET : box.maxZ - INNER_FACE_OFFSET
    return { ...dim, z1: z, z2: z }
  }
  const x = face === 'left' ? box.minX + INNER_FACE_OFFSET : box.maxX - INNER_FACE_OFFSET
  return { ...dim, x1: x, x2: x }
}

function chipFor(room, box, scale) {
  const line1 = `${room.label || room.name || 'J1'}  0 °C`
  const px = Math.max(line1.length, 8) * 7.1 + 22
  const width = box.maxX - box.minX
  return {
    x: (box.minX + box.maxX) / 2,
    z: (box.minZ + box.maxZ) / 2,
    w: Math.min(width * 0.78, px / Math.max(scale, 1)),
    h: 34 / Math.max(scale, 1),
  }
}

export function innerDimHitsLabel(dim, label) {
  if (!dim || !label) return false
  const mid = midpoint(dim)
  const band = 0.16
  if (isHorizontal(dim)) {
    return Math.abs(mid.z - label.z) < (label.h || 0) / 2 + band
      && Math.abs(mid.x - label.x) < (label.w || 0) / 2 + Math.abs(dim.x2 - dim.x1) / 2
  }
  return Math.abs(mid.x - label.x) < (label.w || 0) / 2 + band
    && Math.abs(mid.z - label.z) < (label.h || 0) / 2 + Math.abs(dim.z2 - dim.z1) / 2
}

function slideLabel(anchor, chip, dims, outline) {
  let x = anchor.x
  let z = anchor.z
  for (let pass = 0; pass < 4; pass += 1) {
    let hit = false
    dims.forEach((dim) => {
      if (!innerDimHitsLabel(dim, { ...chip, x, z })) return
      hit = true
      const mid = midpoint(dim)
      if (isHorizontal(dim)) {
        const dir = Math.sign(z - mid.z) || -1
        const need = chip.h / 2 + 0.16 - Math.abs(z - mid.z)
        z += dir * (Math.max(need, 0) + 0.05)
      } else {
        const dir = Math.sign(x - mid.x) || -1
        const need = chip.w / 2 + 0.16 - Math.abs(x - mid.x)
        x += dir * (Math.max(need, 0) + 0.05)
      }
    })
    if (!hit) break
  }
  const next = { ...chip, x, z }
  const corners = [
    [x - chip.w / 2, z - chip.h / 2],
    [x + chip.w / 2, z - chip.h / 2],
    [x - chip.w / 2, z + chip.h / 2],
    [x + chip.w / 2, z + chip.h / 2],
  ]
  if (corners.some(([cx, cz]) => !pointInPolygon(cx, cz, outline))) return null
  if (dims.some((dim) => innerDimHitsLabel(dim, next))) return null
  return { x, z }
}

// Pull each inner dimension onto the inner face farther from the room label.
// Drop them when the room is too small on screen, or when the label cannot
// move clear of the lines.
export function layoutColdInnerDims(figures, rooms = [], options = {}) {
  const scale = Number(options.scale) > 0 ? options.scale : 36
  const enabled = options.enabled !== false
  const anchors = {}
  if (!enabled) {
    return {
      figures: (figures || []).filter((item) => item.dim?.kind !== 'internal'),
      anchors,
    }
  }
  const grouped = new Map()
  const rest = []
  ;(figures || []).forEach((item) => {
    if (item.dim?.kind !== 'internal') {
      rest.push(item)
      return
    }
    const mid = midpoint(item.dim)
    const room = (rooms || []).find((entry) => (entry.outline || []).length >= 3 && pointInPolygon(mid.x, mid.z, entry.outline))
    if (!room) {
      rest.push(item)
      return
    }
    if (!grouped.has(room.id)) grouped.set(room.id, { room, items: [] })
    grouped.get(room.id).items.push(item)
  })
  const placed = []
  grouped.forEach(({ room, items }) => {
    const outline = room.outline
    const box = boundsOf(outline)
    if (!Number.isFinite(box.minX)) return
    const widthPx = (box.maxX - box.minX) * scale
    const depthPx = (box.maxZ - box.minZ) * scale
    if (widthPx < MIN_WIDTH_PX || depthPx < MIN_DEPTH_PX) return
    const estimated = chipFor(room, box, scale)
    const override = options.labelSize?.(room, box, scale) || {}
    const chip = { ...estimated, ...override }
    const nextItems = []
    items.forEach((item) => {
      const faces = isHorizontal(item.dim) ? ['bottom', 'top'] : ['right', 'left']
      let chosen = null
      let best = -1
      faces.forEach((face) => {
        const dim = shiftToFace(item.dim, box, face)
        if (!segmentInside(dim, outline)) return
        const mid = midpoint(dim)
        const gap = isHorizontal(dim)
          ? Math.abs(mid.z - chip.z) - chip.h / 2
          : Math.abs(mid.x - chip.x) - chip.w / 2
        if (gap < 0.08) return
        const dist = Math.hypot(mid.x - chip.x, mid.z - chip.z)
        if (dist <= best) return
        best = dist
        chosen = { ...item, dim: { ...dim, roomId: room.id } }
      })
      if (chosen) nextItems.push(chosen)
    })
    if (!nextItems.length) return
    const dims = nextItems.map((item) => item.dim)
    if (dims.some((dim) => innerDimHitsLabel(dim, chip))) {
      const moved = slideLabel(chip, chip, dims, outline)
      if (!moved) return
      anchors[room.id] = moved
    }
    placed.push(...nextItems)
  })
  return { figures: [...rest, ...placed], anchors }
}
