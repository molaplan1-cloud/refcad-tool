// Cold-room sensors and the controller snap only while the user places or
// drags them. Nothing here adds a door, an evaporator, or another device.
// A placed device keeps a host id and follows that host; the host's model
// is left untouched.

import { doorFrame, isColdRoom, resolveDoor } from './doors.js'

const FRAME = 0.05
const DOOR_GAP = 0.08

export function deviceKind(item) {
  const sensor = item?.sensor
  if (sensor === 'room') return 'room'
  if (sensor === 'door') return 'door'
  if (sensor === 'defrost') return 'defrost'
  if (item?.category === 'controller' || sensor === 'controller') return 'controller'
  return null
}

export function isColdDevice(item) {
  return deviceKind(item) != null
}

export function isColdDoor(eq, room) {
  if (!eq || eq.category !== 'door') return false
  if (eq.doorFamily === 'ambient') return false
  if (eq.doorFamily === 'cold') return true
  if (resolveDoor(eq).family === 'cold') return true
  return isColdRoom(room)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function outerPoints(room) {
  if (Array.isArray(room?.outline) && room.outline.length >= 3) {
    return room.outline.map((point) => ({ x: Number(point.x) || 0, z: Number(point.z) || 0 }))
  }
  const x = room?.x || 0
  const z = room?.z || 0
  const hw = (room?.width || 0) / 2
  const hd = (room?.depth || 0) / 2
  return [
    { x: x - hw, z: z - hd },
    { x: x + hw, z: z - hd },
    { x: x + hw, z: z + hd },
    { x: x - hw, z: z + hd },
  ]
}

function inside(x, z, points) {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const zi = points[i].z
    const xj = points[j].x
    const zj = points[j].z
    const crosses = (zi > z) !== (zj > z)
    if (!crosses) continue
    const xHit = ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-12) + xi
    if (x < xHit) hit = !hit
  }
  return hit
}

function roomEdges(room) {
  const points = outerPoints(room)
  const edges = []
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.05) continue
    let nx = -dz / len
    let nz = dx / len
    const mx = (a.x + b.x) / 2
    const mz = (a.z + b.z) / 2
    if (!inside(mx + nx * 0.02, mz + nz * 0.02, points)) {
      nx = -nx
      nz = -nz
    }
    edges.push({ index: i, a, b, dx, dz, len, nx, nz })
  }
  return edges
}

function cardinal(edge, room) {
  const mx = (edge.a.x + edge.b.x) / 2 - (room?.x || 0)
  const mz = (edge.a.z + edge.b.z) / 2 - (room?.z || 0)
  if (Math.abs(mx) >= Math.abs(mz)) return mx >= 0 ? 'e' : 'w'
  return mz >= 0 ? 's' : 'n'
}

function nearestFace(room, worldX, worldZ, face, item) {
  const edges = roomEdges(room)
  const wall = room?.wallThickness || 0.1
  const extra = face === 'outer' ? (item?.depth || 0.12) / 2 : 0
  let best = null
  edges.forEach((edge) => {
    let t = ((worldX - edge.a.x) * edge.dx + (worldZ - edge.a.z) * edge.dz) / (edge.len * edge.len)
    t = clamp(t, 0.04, 0.96)
    const along = face === 'inner' ? wall : -extra
    const x = edge.a.x + edge.dx * t + edge.nx * along
    const z = edge.a.z + edge.dz * t + edge.nz * along
    const dist = Math.hypot(x - worldX, z - worldZ)
    if (!best || dist < best.dist) best = { edge, t, x, z, dist }
  })
  if (!best) return null
  const horizontal = Math.abs(best.edge.dx) >= Math.abs(best.edge.dz)
  return {
    ...best,
    wall: cardinal(best.edge, room),
    rotation: horizontal ? 0 : 90,
  }
}

function coldDoors(room) {
  return (room?.equipment || []).filter((eq) => isColdDoor(eq, room))
}

function evaporators(room) {
  return (room?.equipment || []).filter((eq) => eq.category === 'evaporator')
}

function findEquipment(rooms, id) {
  if (!id) return null
  for (const room of rooms || []) {
    const eq = (room.equipment || []).find((item) => item.id === id)
    if (eq) return eq
  }
  return null
}

function sideOf(door, room, worldX, worldZ) {
  const alongX = door.wall !== 'e' && door.wall !== 'w'
  const origin = alongX ? (room.x || 0) + (door.x || 0) : (room.z || 0) + (door.z || 0)
  const delta = (alongX ? worldX : worldZ) - origin
  return delta >= 0 ? 1 : -1
}

function outwardLocal(wall, distance) {
  if (wall === 'n') return { x: 0, z: -distance }
  if (wall === 'e') return { x: distance, z: 0 }
  if (wall === 'w') return { x: -distance, z: 0 }
  return { x: 0, z: distance }
}

function isController(device) {
  return device?.hostKind === 'controller' || device?.sensor === 'controller' || device?.category === 'controller'
}

export function poseOnDoor(room, door, device) {
  const alongX = door.wall !== 'e' && door.wall !== 'w'
  const side = device.hostSide === -1 ? -1 : 1
  const controller = isController(device)
  const reach = controller
    ? (door.width || 0.9) / 2 + 0.62
    : (door.width || 0.9) / 2 + FRAME
  const shift = side * reach
  let x = alongX ? (door.x || 0) + shift : (door.x || 0)
  let z = alongX ? (door.z || 0) : (door.z || 0) + shift
  if (controller) {
    const out = outwardLocal(door.wall || 's', 0.34)
    x += out.x
    z += out.z
  }
  const hw = Math.max(0.2, (room?.width || 1) / 2 - 0.12)
  const hd = Math.max(0.2, (room?.depth || 1) / 2 - 0.12)
  if (alongX) x = clamp(x, -hw, hw)
  else z = clamp(z, -hd, hd)
  return {
    x,
    z,
    wall: door.wall || 's',
    rotation: alongX ? 0 : 90,
    hostId: door.id,
    hostKind: 'door',
    hostSide: side,
    face: device.hostKind === 'controller' || device.category === 'controller' ? 'outer' : 'frame',
    mount: 'wall',
  }
}

export function poseOnEvaporator(room, evap, device) {
  const rot = ((evap.rotation || 0) * Math.PI) / 180
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const localX = clamp(device.coilT || 0, -0.84, 0.84) * ((evap.width || 1) / 2)
  const localZ = -((evap.depth || 0.6) / 2)
  const ox = localX * c - localZ * s
  const oz = localX * s + localZ * c
  return {
    x: (evap.x || 0) + ox,
    z: (evap.z || 0) + oz,
    hostId: evap.id,
    hostKind: 'evaporator',
    coilT: device.coilT || 0,
    face: 'coil',
    mount: 'ceiling',
    rotation: evap.rotation || 0,
  }
}

function poseOnWall(room, device) {
  const edges = roomEdges(room)
  const edge = edges.find((item) => item.index === device.hostEdge) || edges[0]
  if (!edge) return {}
  const t = clamp(device.hostT ?? 0.5, 0.04, 0.96)
  const wall = room?.wallThickness || 0.1
  const extra = device.face === 'outer' ? (device.depth || 0.12) / 2 : 0
  const along = device.face === 'outer' ? -extra : wall
  const x = edge.a.x + edge.dx * t + edge.nx * along
  const z = edge.a.z + edge.dz * t + edge.nz * along
  const horizontal = Math.abs(edge.dx) >= Math.abs(edge.dz)
  return {
    x: x - (room.x || 0),
    z: z - (room.z || 0),
    hostKind: 'wall',
    hostId: room.id,
    hostEdge: edge.index,
    hostT: t,
    face: device.face || 'inner',
    wall: cardinal(edge, room),
    rotation: horizontal ? 0 : 90,
    mount: 'wall',
  }
}

function wallPatch(room, hit, item, face) {
  return poseOnWall(room, {
    ...item,
    hostEdge: hit.edge.index,
    hostT: hit.t,
    face,
    depth: item.depth,
  })
}

function coilT(evap, room, worldX, worldZ) {
  const rot = ((evap.rotation || 0) * Math.PI) / 180
  const dx = worldX - ((room.x || 0) + (evap.x || 0))
  const dz = worldZ - ((room.z || 0) + (evap.z || 0))
  const localX = dx * Math.cos(rot) + dz * Math.sin(rot)
  const half = (evap.width || 1) / 2 || 0.5
  return clamp(localX / half, -0.84, 0.84)
}

export function placeColdDevice(template, room, worldX, worldZ, rooms = null) {
  const kind = deviceKind(template)
  if (!kind || !room) return { ok: true, patch: null }
  if (kind === 'door') {
    const doors = coldDoors(room)
    if (!doors.length) return { ok: false, reason: 'need-door' }
    let door = doors[0]
    let best = Infinity
    doors.forEach((item) => {
      const dist = Math.hypot(worldX - ((room.x || 0) + item.x), worldZ - ((room.z || 0) + item.z))
      if (dist < best) {
        best = dist
        door = item
      }
    })
    return {
      ok: true,
      patch: poseOnDoor(room, door, { ...template, hostKind: 'door', hostSide: sideOf(door, room, worldX, worldZ) }),
    }
  }
  if (kind === 'defrost') {
    const units = evaporators(room)
    if (!units.length) return { ok: false, reason: 'need-evap' }
    let evap = units[0]
    let best = Infinity
    units.forEach((item) => {
      const dist = Math.hypot(worldX - ((room.x || 0) + item.x), worldZ - ((room.z || 0) + item.z))
      if (dist < best) {
        best = dist
        evap = item
      }
    })
    return {
      ok: true,
      patch: poseOnEvaporator(room, evap, { coilT: coilT(evap, room, worldX, worldZ) }),
    }
  }
  if (kind === 'controller') {
    const doors = coldDoors(room)
    const hit = nearestFace(room, worldX, worldZ, 'outer', template)
    if (doors.length) {
      let door = doors[0]
      let best = Infinity
      doors.forEach((item) => {
        const dist = Math.hypot(worldX - ((room.x || 0) + item.x), worldZ - ((room.z || 0) + item.z))
        if (dist < best) {
          best = dist
          door = item
        }
      })
      const otherWall = hit && cardinalOfDoor(room, door) !== hit.wall
      if (!(otherWall && hit.dist + 0.45 < best && best > 1.8)) {
        return {
          ok: true,
          patch: poseOnDoor(room, door, {
            ...template,
            hostKind: 'controller',
            hostSide: sideOf(door, room, worldX, worldZ),
          }),
        }
      }
    }
    if (!hit) return { ok: false, reason: 'need-wall' }
    return { ok: true, patch: wallPatch(room, hit, template, 'outer') }
  }
  const hit = nearestFace(room, worldX, worldZ, 'inner', template)
  if (!hit) return { ok: false, reason: 'need-wall' }
  return { ok: true, patch: wallPatch(room, offsetRoomSensor(room, hit, worldX, worldZ), template, 'inner') }
}

function facePoint(edge, t, room) {
  const wall = room?.wallThickness || 0.1
  return {
    x: edge.a.x + edge.dx * t + edge.nx * wall,
    z: edge.a.z + edge.dz * t + edge.nz * wall,
  }
}

/** Keep the room sensor on an inner face, on the opposite side of a door from the switch. */
function offsetRoomSensor(room, hit, worldX, worldZ) {
  const doors = coldDoors(room).filter((door) => cardinalOfDoor(room, door) === hit.wall)
  if (!doors.length) return hit
  let door = doors[0]
  let best = Infinity
  doors.forEach((item) => {
    const dist = Math.hypot(worldX - ((room.x || 0) + (item.x || 0)), worldZ - ((room.z || 0) + (item.z || 0)))
    if (dist < best) {
      best = dist
      door = item
    }
  })
  const alongX = door.wall !== 'e' && door.wall !== 'w'
  const doorAlong = alongX ? (room.x || 0) + (door.x || 0) : (room.z || 0) + (door.z || 0)
  const clickAlong = alongX ? worldX : worldZ
  const sign = clickAlong >= doorAlong ? 1 : -1
  const keep = (door.width || 0.9) / 2 + 0.62
  if (Math.abs(clickAlong - doorAlong) >= keep) return hit
  const target = doorAlong - sign * keep
  let t = null
  let gap = Infinity
  for (let i = 0; i <= 48; i += 1) {
    const candidate = 0.06 + (0.88 * i) / 48
    const point = facePoint(hit.edge, candidate, room)
    const along = alongX ? point.x : point.z
    if ((along - doorAlong) * sign >= -0.02) continue
    const dist = Math.abs(along - target)
    if (dist < gap) {
      gap = dist
      t = candidate
    }
  }
  if (t == null) {
    const other = roomEdges(room).find((item) => cardinal(item, room) !== hit.wall)
    if (!other) return hit
    return { ...hit, edge: other, t: 0.5, wall: cardinal(other, room) }
  }
  return { ...hit, t }
}

function cardinalOfDoor(room, door) {
  const edges = roomEdges(room)
  const x = (room.x || 0) + (door.x || 0)
  const z = (room.z || 0) + (door.z || 0)
  let best = edges[0]
  let dist = Infinity
  edges.forEach((edge) => {
    const t = clamp(((x - edge.a.x) * edge.dx + (z - edge.a.z) * edge.dz) / (edge.len * edge.len), 0, 1)
    const px = edge.a.x + edge.dx * t
    const pz = edge.a.z + edge.dz * t
    const gap = Math.hypot(px - x, pz - z)
    if (gap < dist) {
      dist = gap
      best = edge
    }
  })
  return best ? cardinal(best, room) : door.wall
}

export function dragColdDevice(eq, room, worldX, worldZ, rooms) {
  const hit = placeColdDevice(eq, room, worldX, worldZ, rooms)
  if (!hit.ok || !hit.patch) return null
  return { ...eq, ...hit.patch }
}

export function followHosts(room, equipment, movedId) {
  if (!movedId) return equipment
  const host = (equipment || []).find((item) => item.id === movedId)
  if (!host) return equipment
  return equipment.map((eq) => {
    if (!eq || eq.id === movedId || eq.hostId !== movedId) return eq
    if (host.category === 'door') return { ...eq, ...poseOnDoor(room, host, eq) }
    if (host.category === 'evaporator') return { ...eq, ...poseOnEvaporator(room, host, eq) }
    return eq
  })
}

export function reseatWallDevices(room) {
  if (!room?.equipment?.length) return room
  let changed = false
  const equipment = room.equipment.map((eq) => {
    if (eq?.category === 'door' && (eq.wall || eq.x || eq.z)) {
      const frame = doorFrame(room, eq)
      const wx = (room.x || 0) + (eq.x || 0)
      const wz = (room.z || 0) + (eq.z || 0)
      if (Math.hypot(wx - frame.center.x, wz - frame.center.z) < 0.03 && eq.wall === frame.cardinal) return eq
      changed = true
      return {
        ...eq,
        x: frame.center.x - (room.x || 0),
        z: frame.center.z - (room.z || 0),
        wall: frame.cardinal,
      }
    }
    if (eq?.hostKind === 'wall') {
      changed = true
      return { ...eq, ...poseOnWall(room, eq) }
    }
    return eq
  })
  if (!changed) return room
  return { ...room, equipment }
}

export function deviceLinkParts(room, eq, rooms) {
  const unit = findEquipment(rooms, room?.unitId)
  let host = ''
  let hostKey = 'cold.hostInner'
  if (eq?.hostKind === 'door') {
    host = findEquipment(rooms, eq.hostId)?.name || ''
    hostKey = host ? '' : 'cold.hostFrame'
  } else if (eq?.hostKind === 'evaporator') {
    host = findEquipment(rooms, eq.hostId)?.name || ''
    hostKey = host ? '' : 'cold.hostCoil'
  } else if (eq?.face === 'outer') {
    hostKey = 'cold.hostOuter'
  } else if (eq?.face === 'frame') {
    hostKey = 'cold.hostFrame'
  } else if (eq?.face === 'coil') {
    hostKey = 'cold.hostCoil'
  }
  return {
    room: room?.label || '',
    name: eq?.name || '',
    unit: unit?.name || '',
    host,
    hostKey,
  }
}

export function formatDeviceLink(t, room, eq, rooms) {
  const parts = deviceLinkParts(room, eq, rooms)
  return t('cold.deviceLink', {
    room: parts.room,
    name: parts.name,
    unit: parts.unit || t('cold.unassigned'),
    host: parts.host || (parts.hostKey ? t(parts.hostKey) : ''),
  })
}

export function removalAsk(rooms, ids) {
  const idSet = new Set(ids || [])
  const selected = []
  const orphaned = []
  for (const room of rooms || []) {
    const roomSelected = idSet.has(room.id)
    for (const eq of room.equipment || []) {
      const attached = eq.hostKind === 'wall' || !!eq.hostId
      if (!attached || !isColdDevice(eq)) continue
      const hostSelected = eq.hostKind === 'wall' ? roomSelected : idSet.has(eq.hostId)
      if (idSet.has(eq.id)) selected.push({ room, eq })
      else if (hostSelected) orphaned.push({ room, eq })
    }
  }
  if (!selected.length && !orphaned.length) return null
  return { selected, orphaned }
}

export function removalPrompt(rooms, ids, t) {
  const ask = removalAsk(rooms, ids)
  if (!ask || typeof t !== 'function') return null
  if (ask.orphaned.length) {
    const hostLabels = ask.orphaned.map((item) => {
      if (item.eq.hostKind === 'wall') return item.room.label || item.room.name || ''
      return findEquipment(rooms, item.eq.hostId)?.name || item.room.label || ''
    })
    return t('cold.removeHost', {
      name: [...new Set(hostLabels.filter(Boolean))].join(', '),
      devices: ask.orphaned.map((item) => item.eq.name).join(', '),
    })
  }
  const hosts = ask.selected.map((item) => {
    const parts = deviceLinkParts(item.room, item.eq, rooms)
    return parts.host || (parts.hostKey ? t(parts.hostKey) : item.room.label)
  })
  return t('cold.removeDevice', {
    name: ask.selected.map((item) => item.eq.name).join(', '),
    host: [...new Set(hosts.filter(Boolean))].join(', '),
  })
}
