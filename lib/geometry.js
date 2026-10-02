import { getType, getTemplate, defaultLoad, TEMPLATES, isRefrigerated } from './catalog.js'
import { defaultElevation, defaultMount, isOutdoorCategory, snapOutdoorUnit } from './placement.js'

export function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export function num(value, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

export function snap(value, grid) {
  if (!grid) return value
  return Math.round(value / grid) * grid
}

export function nextLabel(rooms, typeId) {
  const prefix = getType(typeId).prefix
  const used = new Set((rooms || []).map((r) => r.label).filter(Boolean))
  let n = 1
  while (used.has(prefix + n)) n += 1
  return prefix + n
}

export function externalRect(room) {
  return {
    left: room.x - room.width / 2,
    right: room.x + room.width / 2,
    top: room.z - room.depth / 2,
    bottom: room.z + room.depth / 2,
  }
}

export function internalDims(room) {
  const wall = Math.max(0, num(room.wallThickness, 0.08))
  const ceil = Math.max(0, num(room.ceilingThickness, wall))
  const floor = Math.max(0, num(room.floorThickness, wall))
  const width = Math.max(0.2, room.width - 2 * wall)
  const depth = Math.max(0.2, room.depth - 2 * wall)
  const height = Math.max(0.2, room.height - ceil - floor)
  const area = width * depth
  return { width, depth, height, area, volume: area * height, wall, ceil, floor }
}

export function internalRect(room) {
  const wall = Math.max(0, num(room.wallThickness, 0.08))
  const ext = externalRect(room)
  return {
    left: ext.left + wall,
    right: ext.right - wall,
    top: ext.top + wall,
    bottom: ext.bottom - wall,
  }
}

export function overlap1d(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))
}

export function overlapArea(a, b) {
  return overlap1d(a.left, a.right, b.left, b.right) * overlap1d(a.top, a.bottom, b.top, b.bottom)
}

export function containsRect(outer, inner, slop = 0.05) {
  return (
    inner.left >= outer.left - slop &&
    inner.right <= outer.right + slop &&
    inner.top >= outer.top - slop &&
    inner.bottom <= outer.bottom + slop
  )
}

export function pointInRect(rect, x, z, slop = 0) {
  return x >= rect.left - slop && x <= rect.right + slop && z >= rect.top - slop && z <= rect.bottom + slop
}

export function pointInPolygon(x, z, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const zi = points[i].z
    const xj = points[j].x
    const zj = points[j].z
    const crosses = (zi > z) !== (zj > z)
    if (!crosses) continue
    const xHit = ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-12) + xi
    if (x < xHit) inside = !inside
  }
  return inside
}

/** Smallest room whose external footprint contains the world point. */
export function roomAtPoint(rooms, x, z) {
  const hits = (rooms || []).filter((room) => pointInRect(externalRect(room), x, z))
  hits.sort((a, b) => a.width * a.depth - b.width * b.depth)
  return hits[0] || null
}

export function findContainer(rooms, rect) {
  const corners = [
    { x: rect.left, z: rect.top },
    { x: rect.right, z: rect.top },
    { x: rect.right, z: rect.bottom },
    { x: rect.left, z: rect.bottom },
    { x: (rect.left + rect.right) / 2, z: (rect.top + rect.bottom) / 2 },
  ]
  const hits = (rooms || []).filter((room) => {
    if (Array.isArray(room.outline) && room.outline.length >= 4) {
      return corners.every((corner) => pointInPolygon(corner.x, corner.z, room.outline))
    }
    return containsRect(externalRect(room), rect)
  })
  hits.sort((a, b) => a.width * a.depth - b.width * b.depth)
  return hits[0] || null
}

export function descendantIds(rooms, id) {
  const ids = new Set()
  let grew = true
  while (grew) {
    grew = false
    for (const room of rooms) {
      if (room.parentId && (room.parentId === id || ids.has(room.parentId)) && !ids.has(room.id)) {
        ids.add(room.id)
        grew = true
      }
    }
  }
  return ids
}

export function createRoom({ typeId, x, z, width, depth, height, rooms = [], parentId = null, parent = null }) {
  const type = getType(typeId)
  const h = height ?? type.defaultHeight
  const partition = !!parentId
  const fullHeight = !!(parent && Math.abs(h - parent.height) < 0.05)
  const label = nextLabel(rooms, type.id)
  return {
    id: genId(),
    type: type.id,
    name: type.name,
    label,
    x,
    z,
    width,
    depth,
    height: h,
    wallThickness: type.wallThickness,
    ceilingThickness: type.wallThickness,
    floorThickness: type.wallThickness,
    temp: type.temp,
    ambientTemp: 25,
    uWall: type.uWall,
    uCeiling: type.uCeiling,
    uFloor: type.uFloor,
    color: type.color,
    parentId: parentId || null,
    equipment: [],
    load: defaultLoad(type.id, {
      partition,
      ceilingToParent: partition && !fullHeight,
      floorToParent: false,
      pullDown: !partition,
    }),
  }
}

export function applyType(room, typeId, rooms) {
  const type = getType(typeId)
  const others = (rooms || []).filter((r) => r.id !== room.id)
  return {
    ...room,
    type: type.id,
    name: room.name && room.name !== getType(room.type).name ? room.name : type.name,
    label: nextLabel(others, type.id),
    color: type.color,
    temp: type.temp,
    uWall: type.uWall,
    uCeiling: type.uCeiling,
    uFloor: type.uFloor,
    wallThickness: type.wallThickness,
    ceilingThickness: type.wallThickness,
    floorThickness: type.wallThickness,
  }
}

export function hydrateRoom(room) {
  const type = getType(room?.type)
  const wall = num(room?.wallThickness, type.wallThickness)
  return {
    id: room?.id || genId(),
    type: type.id,
    name: room?.name || type.name,
    label: room?.label || '',
    x: num(room?.x, 0),
    z: num(room?.z, 0),
    width: Math.max(0.4, num(room?.width, 4)),
    depth: Math.max(0.4, num(room?.depth, 4)),
    height: Math.max(0.4, num(room?.height, type.defaultHeight)),
    wallThickness: wall,
    ceilingThickness: num(room?.ceilingThickness, wall),
    floorThickness: num(room?.floorThickness, wall),
    temp: num(room?.temp, type.temp),
    ambientTemp: num(room?.ambientTemp, 25),
    uWall: num(room?.uWall, type.uWall),
    uCeiling: num(room?.uCeiling, type.uCeiling),
    uFloor: num(room?.uFloor, type.uFloor),
    color: room?.color || type.color,
    parentId: room?.parentId || null,
    outline: Array.isArray(room?.outline) && room.outline.length >= 3
      ? room.outline.map((point) => ({ x: num(point.x, 0), z: num(point.z, 0) }))
      : null,
    equipment: Array.isArray(room?.equipment) ? room.equipment.map(hydrateEquipment) : [],
    load: { ...defaultLoad(type.id), ...(room?.load || {}) },
  }
}

export function hydrateEquipment(eq) {
  const tpl = getTemplate(eq?.catalogId) || {}
  return {
    id: eq?.id || genId(),
    catalogId: eq?.catalogId || tpl.id || '',
    category: eq?.category || tpl.category || 'unit',
    name: eq?.name || tpl.name || 'Laite',
    width: num(eq?.width, tpl.width || 0.6),
    height: num(eq?.height, tpl.height || 0.5),
    depth: num(eq?.depth, tpl.depth || 0.6),
    capacityKw: num(eq?.capacityKw, num(eq?.capacity, tpl.capacityKw || 0)),
    fanW: num(eq?.fanW, tpl.fanW || 0),
    x: num(eq?.x, 0),
    z: num(eq?.z, 0),
    rotation: num(eq?.rotation, 0),
    wall: eq?.wall || null,
    style: eq?.style || tpl.style || (eq?.category === 'evaporator' || tpl.category === 'evaporator' ? 'cubic' : null),
    sensor: eq?.sensor || tpl.sensor || null,
    mount: eq?.mount || null,
    elevation: Number.isFinite(eq?.elevation) ? eq.elevation : (Number.isFinite(parseFloat(eq?.elevation)) ? parseFloat(eq.elevation) : null),
  }
}

export function normalizeRooms(rooms) {
  const out = []
  for (const raw of rooms || []) {
    const room = hydrateRoom(raw)
    if (!room.label) room.label = nextLabel(out, room.type)
    out.push(room)
  }
  return out
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/** Snap a door onto the nearest external wall. Coordinates are room-local. */
export function snapDoorToWall(room, localX, localZ, doorWidth) {
  const hw = room.width / 2
  const hd = room.depth / 2
  const dW = Math.abs(localX + hw)
  const dE = Math.abs(localX - hw)
  const dN = Math.abs(localZ + hd)
  const dS = Math.abs(localZ - hd)
  const min = Math.min(dW, dE, dN, dS)
  const margin = Math.min(doorWidth / 2 + 0.05, Math.max(hw, hd) - 0.05)
  if (min === dN || min === dS) {
    return {
      wall: min === dN ? 'n' : 's',
      x: clamp(localX, -hw + margin, hw - margin),
      z: min === dN ? -hd : hd,
      rotation: 0,
    }
  }
  return {
    wall: min === dW ? 'w' : 'e',
    x: min === dW ? -hw : hw,
    z: clamp(localZ, -hd + margin, hd - margin),
    rotation: 90,
  }
}

export function clampInside(localX, localZ, room, itemW, itemD) {
  const wall = room.wallThickness
  const limitX = Math.max(0.05, room.width / 2 - wall - itemW / 2)
  const limitZ = Math.max(0.05, room.depth / 2 - wall - itemD / 2)
  return {
    x: clamp(localX, -limitX, limitX),
    z: clamp(localZ, -limitZ, limitZ),
  }
}

export function makeEquipment(templateId, room, worldX, worldZ, allRooms = null, options = {}) {
  const tpl = getTemplate(templateId) || TEMPLATES[0]
  const rooms = allRooms || [room]
  const base = {
    id: genId(),
    catalogId: tpl.id,
    category: tpl.category,
    style: tpl.style || (tpl.category === 'evaporator' ? 'cubic' : null),
    sensor: tpl.sensor || null,
    name: tpl.name,
    width: tpl.width,
    height: tpl.category === 'column' ? room.height : tpl.height,
    depth: tpl.depth,
    capacityKw: tpl.capacityKw || 0,
    fanW: tpl.fanW || 0,
    x: worldX - room.x,
    z: worldZ - room.z,
    rotation: 0,
    wall: null,
    mount: options.mount || defaultMount(tpl.category),
    elevation: null,
    warning: '',
  }
  if (tpl.category === 'door') {
    const snapped = snapDoorToWall(room, base.x, base.z, tpl.width)
    return { ...base, ...snapped, mount: 'floor', elevation: 0 }
  }
  if (isOutdoorCategory(tpl.category)) {
    const hostInside = isRefrigerated(room.type)
    const snapped = snapOutdoorUnit(rooms, base, worldX, worldZ, {
      mount: options.mount || (hostInside ? 'wall' : 'wall'),
    })
    return {
      ...base,
      x: snapped.x - room.x,
      z: snapped.z - room.z,
      rotation: snapped.rotation,
      mount: snapped.mount,
      elevation: snapped.elevation,
      warning: snapped.warning,
    }
  }
  const clamped = clampInside(base.x, base.z, room, base.width, base.depth)
  const placed = { ...base, ...clamped }
  placed.elevation = defaultElevation(room, placed)
  return placed
}

export function roomsOverlap(a, b) {
  if (!a || !b || a.id === b.id) return false
  if (a.parentId === b.id || b.parentId === a.id) return false
  const A = externalRect(a)
  const B = externalRect(b)
  const ox = overlap1d(A.left, A.right, B.left, B.right)
  const oz = overlap1d(A.top, A.bottom, B.top, B.bottom)
  return ox > 0.08 && oz > 0.08
}

export function buildEnquiryExample() {
  const parent = createRoom({
    typeId: 'chilled',
    x: 0,
    z: 0,
    width: 12,
    depth: 8,
    height: 6,
    rooms: [],
  })
  parent.name = 'Vihanneshuone'
  parent.load = {
    ...parent.load,
    productId: 'vegetables',
    dailyMassKg: 800,
    entryTempC: 12,
    cp: 3.85,
    respirationWPerKg: 0.04,
    people: 2,
    peopleHoursPerDay: 4,
    doorOpeningsPerDay: 50,
  }
  parent.equipment = [
    {
      id: genId(),
      catalogId: 'door-1500',
      category: 'door',
      name: 'Liukuovi 1500',
      width: 1.5,
      height: 2.4,
      depth: 0.1,
      capacityKw: 0,
      fanW: 0,
      x: -2,
      z: 4,
      rotation: 0,
      wall: 's',
    },
    {
      id: genId(),
      catalogId: 'evap-20',
      category: 'evaporator',
      name: 'Höyrystin 20 kW',
      width: 1.8,
      height: 0.55,
      depth: 0.85,
      capacityKw: 20,
      fanW: 400,
      x: -3,
      z: 1,
      rotation: 0,
      wall: null,
    },
  ]

  const childW = 4.5
  const childD = 3.8
  const child = createRoom({
    typeId: 'frozen',
    x: 6 - childW / 2,
    z: -4 + childD / 2,
    width: childW,
    depth: childD,
    height: 6,
    rooms: [parent],
    parentId: parent.id,
    parent,
  })
  child.name = 'Pakaste'
  child.load = {
    ...child.load,
    productId: 'frozen-food',
    dailyMassKg: 250,
    entryTempC: -15,
    cp: 2.1,
    respirationWPerKg: 0,
    people: 1,
    doorOpeningsPerDay: 25,
  }
  child.equipment = [
    {
      id: genId(),
      catalogId: 'door-900',
      category: 'door',
      name: 'Kylmäovi 900',
      width: 0.9,
      height: 2.0,
      depth: 0.08,
      capacityKw: 0,
      fanW: 0,
      x: 0,
      z: childD / 2,
      rotation: 0,
      wall: 's',
    },
    {
      id: genId(),
      catalogId: 'evap-10',
      category: 'evaporator',
      name: 'Höyrystin 10 kW',
      width: 1.3,
      height: 0.48,
      depth: 0.7,
      capacityKw: 10,
      fanW: 220,
      x: 0.4,
      z: -0.3,
      rotation: 0,
      wall: null,
    },
  ]
  return [parent, child]
}
