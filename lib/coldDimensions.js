// Cold-room dimensions are the house dimension chains: outer runs, the
// overall box, and a clear size inside each room. Extension lines are
// resolved by the same witness function as the floor plan.

import { emptyPanelPlan } from './coldPanels.js'
import { pointInPolygon } from './geometry.js'
import { dedupeDimensions, extensionWitnesses, formatMm, planDimensions } from './floorplan.js'

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

function halfThickness(plan) {
  const listed = (Number(plan?.panelMm) || 0) / 2000
  const wall = (plan?.walls || []).reduce((max, item) => Math.max(max, Number(item.thickness) || 0), 0) / 2
  return Math.max(0.02, listed || wall || 0.05)
}

function wallComponents(walls) {
  const parent = walls.map((_, index) => index)
  const find = (index) => {
    let root = index
    while (parent[root] !== root) root = parent[root]
    let cursor = index
    while (parent[cursor] !== root) {
      const next = parent[cursor]
      parent[cursor] = root
      cursor = next
    }
    return root
  }
  const near = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) < 0.04
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const A = walls[i]
      const B = walls[j]
      if (near(A.a, B.a) || near(A.a, B.b) || near(A.b, B.a) || near(A.b, B.b)) parent[find(j)] = find(i)
    }
  }
  const groups = new Map()
  walls.forEach((wall, index) => {
    const root = find(index)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(wall)
  })
  return [...groups.values()]
}

function wallBounds(walls) {
  return (walls || []).reduce((box, wall) => ({
    minX: Math.min(box.minX, wall.a.x, wall.b.x),
    maxX: Math.max(box.maxX, wall.a.x, wall.b.x),
    minZ: Math.min(box.minZ, wall.a.z, wall.b.z),
    maxZ: Math.max(box.maxZ, wall.a.z, wall.b.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

function roomOnWalls(room, walls) {
  const ids = new Set((walls || []).map((wall) => wall.id))
  const keys = String(room?.panelKey || '').split('|').filter(Boolean)
  if (keys.some((id) => ids.has(id) || (walls || []).some((wall) => wall.id === id || String(wall.id).startsWith(`${id}~`)))) return true
  if (keys.length) return false
  const box = wallBounds(walls)
  return (room?.x || 0) >= box.minX - 0.3 && (room?.x || 0) <= box.maxX + 0.3
    && (room?.z || 0) >= box.minZ - 0.3 && (room?.z || 0) <= box.maxZ + 0.3
}

function horizontalDim(dim) {
  return Math.abs((dim?.z2 || 0) - (dim?.z1 || 0)) <= Math.abs((dim?.x2 || 0) - (dim?.x1 || 0))
}

function roomOwns(room, wallId) {
  const ids = String(room?.panelKey || '').split('|').filter(Boolean)
  if (ids.includes(wallId)) return true
  return ids.some((id) => {
    const prefix = `${id}~j`
    if (!String(wallId).startsWith(prefix)) return false
    return /^j\d+$/.test(String(wallId).slice(id.length + 1))
  })
}

function touchesPoint(wall, point) {
  return Math.hypot((wall?.a?.x || 0) - point.x, (wall?.a?.z || 0) - point.z) < 0.04
    || Math.hypot((wall?.b?.x || 0) - point.x, (wall?.b?.z || 0) - point.z) < 0.04
}

// A rectangular block has walls along both extremes of each axis. A stepped
// pair does not, so its bounding box is not a wall length.
function edgeCovered(walls, horizontal, at, from, to) {
  const parts = []
  ;(walls || []).forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    if (horizontal) {
      if (Math.abs(wall.a.z - wall.b.z) > 0.04) return
      if (Math.abs((wall.a.z + wall.b.z) / 2 - at) > 0.06) return
      parts.push([Math.min(wall.a.x, wall.b.x), Math.max(wall.a.x, wall.b.x)])
    } else {
      if (Math.abs(wall.a.x - wall.b.x) > 0.04) return
      if (Math.abs((wall.a.x + wall.b.x) / 2 - at) > 0.06) return
      parts.push([Math.min(wall.a.z, wall.b.z), Math.max(wall.a.z, wall.b.z)])
    }
  })
  parts.sort((a, b) => a[0] - b[0])
  let cursor = from
  parts.forEach(([start, end]) => {
    if (start <= cursor + 0.08) cursor = Math.max(cursor, end)
  })
  return cursor >= to - 0.08
}

function rectangularBlock(walls, box) {
  return edgeCovered(walls, true, box.minZ, box.minX, box.maxX)
    && edgeCovered(walls, true, box.maxZ, box.minX, box.maxX)
    && edgeCovered(walls, false, box.minX, box.minZ, box.maxZ)
    && edgeCovered(walls, false, box.maxX, box.minZ, box.maxZ)
}

// Outside faces. A free corner grows by half a panel. A partition pulls the
// chain back to that panel's face, so the number is never "centreline plus
// one half".
function toOuterFace(dim, box, half) {
  if (!dim || dim.kind === 'internal') return dim
  const retract = dim.kind !== 'overall'
  if (horizontalDim(dim)) {
    let x1 = Math.min(dim.x1, dim.x2)
    let x2 = Math.max(dim.x1, dim.x2)
    if (Math.abs(x1 - box.minX) < 0.04) x1 = box.minX - half
    else if (retract) x1 += half
    if (Math.abs(x2 - box.maxX) < 0.04) x2 = box.maxX + half
    else if (retract) x2 -= half
    const onSouth = Math.abs(dim.z1 - box.maxZ) < 0.05
    const onNorth = Math.abs(dim.z1 - box.minZ) < 0.05
    const z = onSouth ? box.maxZ + half : onNorth ? box.minZ - half : dim.z1
    return { ...dim, x1, x2, z1: z, z2: z, label: formatMm(x2 - x1), ax: (dim.x1 + dim.x2) / 2, az: dim.z1 }
  }
  let z1 = Math.min(dim.z1, dim.z2)
  let z2 = Math.max(dim.z1, dim.z2)
  if (Math.abs(z1 - box.minZ) < 0.04) z1 = box.minZ - half
  else if (retract) z1 += half
  if (Math.abs(z2 - box.maxZ) < 0.04) z2 = box.maxZ + half
  else if (retract) z2 -= half
  const onEast = Math.abs(dim.x1 - box.maxX) < 0.05
  const onWest = Math.abs(dim.x1 - box.minX) < 0.05
  const x = onEast ? box.maxX + half : onWest ? box.minX - half : dim.x1
  return { ...dim, x1: x, x2: x, z1, z2, label: formatMm(z2 - z1), ax: dim.x1, az: (dim.z1 + dim.z2) / 2 }
}

function exteriorOuterDimensions(walls, rooms, half) {
  const exterior = (walls || []).filter((wall) => (rooms || []).filter((room) => roomOwns(room, wall.id)).length < 2)
  const used = new Set()
  const dims = []
  const direction = (wall) => {
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const len = Math.hypot(dx, dz) || 1
    return { dx: dx / len, dz: dz / len, len: Math.hypot(dx, dz) }
  }
  exterior.forEach((start) => {
    if (used.has(start.id)) return
    const head = direction(start)
    if (head.len < 0.25) return
    used.add(start.id)
    const grow = (point) => {
      let at = point
      for (let guard = 0; guard < 12; guard += 1) {
        const joint = walls.filter((wall) => touchesPoint(wall, at))
        if (joint.length !== 2) break
        const next = joint.find((wall) => !used.has(wall.id) && exterior.includes(wall))
        if (!next) break
        const step = direction(next)
        if (Math.abs(step.dx * head.dx + step.dz * head.dz) < 0.98) break
        used.add(next.id)
        const far = Math.hypot(next.a.x - at.x, next.a.z - at.z) < 0.04 ? next.b : next.a
        at = { x: far.x, z: far.z }
      }
      return at
    }
    const a = grow(start.a)
    const b = grow(start.b)
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.25) return
    const tx = dx / len
    const tz = dz / len
    const endShift = (point) => (walls.filter((wall) => touchesPoint(wall, point)).length >= 3 ? -half : half)
    const ax = a.x - tx * endShift(a)
    const az = a.z - tz * endShift(a)
    const bx = b.x + tx * endShift(b)
    const bz = b.z + tz * endShift(b)
    let nx = -tz
    let nz = tx
    const owner = (rooms || []).find((room) => roomOwns(room, start.id))
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    if (owner && ((owner.x || 0) - midX) * nx + ((owner.z || 0) - midZ) * nz > 0) {
      nx = -nx
      nz = -nz
    }
    dims.push({
      x1: ax + nx * half,
      z1: az + nz * half,
      x2: bx + nx * half,
      z2: bz + nz * half,
      label: formatMm(Math.hypot(bx - ax, bz - az)),
      nx,
      nz,
      offset: 0.85,
      kind: 'room',
      ax: midX,
      az: midZ,
    })
  })
  return dims
}

const COLD_DIMS = {
  preset: 'custom',
  dims: { overall: true, room: true, openings: false, internal: true },
}

export function coldDimensions(panelPlan, rooms = []) {
  const base = panelPlan?.walls ? panelPlan : emptyPanelPlan()
  const walls = base.walls || []
  if (!walls.length) return []
  const half = halfThickness(base)
  const dims = []
  wallComponents(walls).forEach((group) => {
    const partRooms = (rooms || []).filter((room) => roomOnWalls(room, group))
    const box = wallBounds(group)
    const straight = rectangularBlock(group, box)
    planDimensions(coldDimensionPlan({ ...base, walls: group }, partRooms), COLD_DIMS).forEach((dim) => {
      if (dim.kind === 'internal') dims.push(dim)
      else if (straight) dims.push(toOuterFace(dim, box, half))
    })
    if (!straight) dims.push(...exteriorOuterDimensions(group, partRooms, half))
  })
  return dims
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
