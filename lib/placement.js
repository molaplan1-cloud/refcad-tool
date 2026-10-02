import { isRefrigerated } from './catalog.js'

export const OUTDOOR_CATEGORIES = new Set(['condenser', 'unit', 'combo', 'compressor'])

export function isOutdoorCategory(category) {
  return OUTDOOR_CATEGORIES.has(category)
}

export function outlinePoints(room) {
  if (Array.isArray(room?.outline) && room.outline.length >= 3) {
    return room.outline.map((point) => ({ x: point.x, z: point.z }))
  }
  const hw = (room?.width || 0) / 2
  const hd = (room?.depth || 0) / 2
  const x = room?.x || 0
  const z = room?.z || 0
  return [
    { x: x - hw, z: z - hd },
    { x: x + hw, z: z - hd },
    { x: x + hw, z: z + hd },
    { x: x - hw, z: z + hd },
  ]
}

export function pointInOutline(x, z, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const yi = points[i].z
    const yj = points[j].z
    const xi = points[i].x
    const xj = points[j].x
    const hit = (yi > z) !== (yj > z) && x < ((xj - xi) * (z - yi)) / ((yj - yi) || 1e-9) + xi
    if (hit) inside = !inside
  }
  return inside
}

export function rotateLocal(x, z, deg) {
  const t = ((deg || 0) * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return { x: x * c - z * s, z: x * s + z * c }
}

export function unrotateLocal(x, z, deg) {
  const t = ((deg || 0) * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return { x: x * c + z * s, z: -x * s + z * c }
}

export function footprintCorners(cx, cz, width, depth, rotationDeg) {
  const hw = width / 2
  const hd = depth / 2
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, z]) => {
    const p = rotateLocal(x, z, rotationDeg)
    return { x: cx + p.x, z: cz + p.z }
  })
}

export function pointInEquipment(room, eq, x, z) {
  if (eq.category === 'door') {
    const vertical = eq.wall === 'e' || eq.wall === 'w' || (eq.rotation === 90 && eq.wall !== 'n' && eq.wall !== 's')
    const hw = (vertical ? Math.max(eq.depth, 0.12) : eq.width) / 2
    const hd = (vertical ? eq.width : Math.max(eq.depth, 0.12)) / 2
    return Math.abs(x - (room.x + eq.x)) <= hw + 0.08 && Math.abs(z - (room.z + eq.z)) <= hd + 0.08
  }
  const local = unrotateLocal(x - (room.x + eq.x), z - (room.z + eq.z), eq.rotation || 0)
  const pad = eq.category === 'sensor' || eq.category === 'controller' ? 0.12 : 0.06
  return Math.abs(local.x) <= eq.width / 2 + pad && Math.abs(local.z) <= eq.depth / 2 + pad
}

export function internalCeiling(room) {
  const ceil = Number.isFinite(room?.ceilingThickness) ? room.ceilingThickness : (room?.wallThickness || 0.1)
  return Math.max(0.4, (room?.height || 3) - ceil)
}

export function defaultMount(category) {
  if (category === 'evaporator') return 'ceiling'
  if (category === 'rack' || category === 'column' || category === 'door') return 'floor'
  if (category === 'sensor' || category === 'controller') return 'wall'
  if (isOutdoorCategory(category)) return 'wall'
  return 'floor'
}

export function defaultElevation(room, eq) {
  const h = eq?.height || 0.4
  const mount = eq?.mount || defaultMount(eq?.category)
  if (mount === 'ceiling' || eq?.category === 'evaporator') return Math.max(0, internalCeiling(room) - h)
  if (mount === 'roof') return room?.height || 0
  if (eq?.category === 'sensor') {
    if (eq.sensor === 'door') return 1.1
    if (eq.sensor === 'room' || eq.sensor === 'controller') return 1.5
    return Math.max(1.4, internalCeiling(room) - 0.35)
  }
  if (eq?.category === 'controller') return 1.45
  if (isOutdoorCategory(eq?.category)) return mount === 'floor' ? 0 : 1.15
  return 0
}

export function resolvedElevation(room, eq) {
  return Number.isFinite(eq?.elevation) ? eq.elevation : defaultElevation(room, eq)
}

export function mountLabel(mount, ascii = false) {
  const labels = ascii
    ? { floor: 'lattia', ceiling: 'katto', wall: 'seina', roof: 'vesikatto' }
    : { floor: 'lattia', ceiling: 'katto', wall: 'seinä', roof: 'vesikatto' }
  return labels[mount] || labels.floor
}

function projectSegment(x, z, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz || 1
  let t = ((x - a.x) * dx + (z - a.z) * dz) / l2
  t = Math.max(0, Math.min(1, t))
  return { x: a.x + dx * t, z: a.z + dz * t, t, len: Math.sqrt(l2) }
}

function outwardOf(room, a, b) {
  let ox = -(b.z - a.z)
  let oz = b.x - a.x
  const len = Math.hypot(ox, oz) || 1
  ox /= len
  oz /= len
  const mx = (a.x + b.x) / 2
  const mz = (a.z + b.z) / 2
  if (ox * (mx - room.x) + oz * (mz - room.z) < 0) {
    ox = -ox
    oz = -oz
  }
  return { ox, oz }
}

export function rotationForOutward(ox, oz) {
  const deg = (Math.atan2(-ox, oz) * 180) / Math.PI
  return (deg + 360) % 360
}

export function nearestColdWall(rooms, x, z) {
  let best = null
  for (const room of rooms || []) {
    if (!isRefrigerated(room.type)) continue
    const pts = outlinePoints(room)
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const proj = projectSegment(x, z, a, b)
      const dist = Math.hypot(proj.x - x, proj.z - z)
      if (!best || dist < best.dist) {
        best = { dist, proj, room, a, b, ...outwardOf(room, a, b) }
      }
    }
  }
  return best
}

export function insideRefrigerated(rooms, x, z) {
  return (rooms || []).find((room) => isRefrigerated(room.type) && pointInOutline(x, z, outlinePoints(room))) || null
}

/** Clear of the door frame, plus room to service the casing beside the opening. */
export const DOOR_FRAME_CLEAR = 0.3
export const DOOR_SERVICE_CLEAR = 0.2
/** Free discharge in front of the outdoor fan. */
export const AIRFLOW_CLEAR = 0.6

function doorKeepouts(room) {
  const blocks = []
  for (const door of room.equipment || []) {
    if (door.category !== 'door') continue
    const wall = door.wall || 's'
    const horizontal = wall === 'n' || wall === 's'
    const center = horizontal ? room.x + door.x : room.z + door.z
    const half = (door.width || 0.9) / 2
    const sliding = /liuku/i.test(door.name || '') || (door.width || 0) >= 1.15
    const side = DOOR_FRAME_CLEAR + DOOR_SERVICE_CLEAR
    const swing = sliding ? 0 : (door.width || 0.9)
    const hingeNegative = wall === 's' || wall === 'w'
    const negPad = side + (hingeNegative ? swing : 0)
    const posPad = side + (hingeNegative ? 0 : swing)
    blocks.push({ wall, lo: center - half - negPad, hi: center + half + posPad })
  }
  return blocks
}

function placementAnchor(rooms, x, z) {
  const host = insideRefrigerated(rooms, x, z)
  let best = null
  for (const room of rooms || []) {
    if (host && room.id !== host.id) continue
    for (const eq of room.equipment || []) {
      if (eq.category !== 'evaporator') continue
      const point = { x: room.x + eq.x, z: room.z + eq.z }
      const dist = Math.hypot(point.x - x, point.z - z)
      if (!best || dist < best.dist) best = { ...point, dist }
    }
  }
  return best || { x, z }
}

function rectWalls(room) {
  const hw = (room.width || 0) / 2
  const hd = (room.depth || 0) / 2
  const x = room.x || 0
  const z = room.z || 0
  return [
    { wall: 'n', along: 'x', lo: x - hw, hi: x + hw, fixed: z - hd, ox: 0, oz: -1 },
    { wall: 's', along: 'x', lo: x - hw, hi: x + hw, fixed: z + hd, ox: 0, oz: 1 },
    { wall: 'w', along: 'z', lo: z - hd, hi: z + hd, fixed: x - hw, ox: -1, oz: 0 },
    { wall: 'e', along: 'z', lo: z - hd, hi: z + hd, fixed: x + hw, ox: 1, oz: 0 },
  ]
}

export function snapOutdoorUnit(rooms, template, x, z, options = {}) {
  const width = template.width || 1
  const depth = template.depth || 0.6
  const mount = options.mount || 'wall'
  const inside = insideRefrigerated(rooms, x, z)
  const stick = mount === 'wall' || mount === 'roof' || !!inside
  const anchor = options.near || placementAnchor(rooms, x, z)
  if (stick) {
    let best = null
    for (const room of rooms || []) {
      if (!isRefrigerated(room.type)) continue
      const blocks = doorKeepouts(room)
      const unitHalf = width / 2
      const endClear = unitHalf + 0.2
      for (const edge of rectWalls(room)) {
        const span = edge.hi - edge.lo
        if (span < endClear * 2 + 0.2) continue
        for (let cursor = edge.lo + endClear; cursor <= edge.hi - endClear + 1e-6; cursor += 0.1) {
          const covered = blocks.some((block) => block.wall === edge.wall && cursor - unitHalf < block.hi && cursor + unitHalf > block.lo)
          if (covered) continue
          const px = edge.along === 'x' ? cursor : edge.fixed
          const pz = edge.along === 'z' ? cursor : edge.fixed
          const gap = depth / 2 + 0.06
          const wx = px + edge.ox * gap
          const wz = pz + edge.oz * gap
          if (insideRefrigerated(rooms, wx, wz)) continue
          if (insideRefrigerated(rooms, wx + edge.ox * AIRFLOW_CLEAR, wz + edge.oz * AIRFLOW_CLEAR)) continue
          const dist = Math.hypot(wx - anchor.x, wz - anchor.z)
          if (!best || dist < best.dist) {
            best = { wx, wz, ox: edge.ox, oz: edge.oz, room, dist, mount }
          }
        }
      }
    }
    if (best) {
      const elevation = mount === 'roof' ? best.room.height : mount === 'floor' ? 0 : 1.15
      return {
        x: best.wx,
        z: best.wz,
        rotation: rotationForOutward(best.ox, best.oz),
        elevation,
        mount: mount === 'floor' ? 'floor' : mount,
        warning: inside ? 'Koneikko siirrettiin kylmähuoneen ulkoseinälle. Se ei jää jäähdytettävään tilaan.' : '',
      }
    }
  }
  const wall = nearestColdWall(rooms, x, z)
  if (wall && stick && (inside || wall.dist < 2.4)) {
    const margin = (width / 2 + 0.2) / Math.max(wall.proj.len, 0.2)
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const t = Math.max(margin, Math.min(1 - margin, wall.proj.t))
    const px = wall.a.x + dx * t
    const pz = wall.a.z + dz * t
    const gap = depth / 2 + 0.06
    return {
      x: px + wall.ox * gap,
      z: pz + wall.oz * gap,
      rotation: rotationForOutward(wall.ox, wall.oz),
      elevation: mount === 'roof' ? wall.room.height : mount === 'floor' ? 0 : 1.15,
      mount: mount === 'floor' ? 'floor' : mount,
      warning: inside ? 'Koneikko siirrettiin kylmähuoneen ulkoseinälle. Se ei jää jäähdytettävään tilaan.' : '',
    }
  }
  return {
    x,
    z,
    rotation: 0,
    elevation: mount === 'roof' ? 0 : 0,
    mount: mount === 'roof' ? 'roof' : 'floor',
    warning: '',
  }
}

function placePort(room, eq, lx, lz, meta) {
  const p = rotateLocal(lx, lz, eq.rotation || 0)
  return {
    x: room.x + eq.x + p.x,
    z: room.z + eq.z + p.z,
    ...meta,
  }
}

export function equipmentPorts(room, eq) {
  const w = eq.width || 1
  const d = eq.depth || 0.5
  const port = (lx, lz, meta) => placePort(room, eq, lx, lz, meta)
  if (eq.category === 'evaporator') {
    return {
      suction: port(-w * 0.28, d / 2, { key: 'suction', kind: 'suction', flow: 'out', label: 'Imu ulos' }),
      liquid: port(w * 0.28, d / 2, { key: 'liquid', kind: 'liquid', flow: 'in', label: 'Neste sisään · paisuntaventtiili' }),
      drain: port(0, d / 2, { key: 'drain', kind: 'drain', flow: 'out', label: 'Kondenssivesi' }),
    }
  }
  if (eq.category === 'compressor') {
    return {
      suction: port(-w * 0.32, -d / 2, { key: 'suction', kind: 'suction', flow: 'in', label: 'Imu sisään' }),
      discharge: port(-w * 0.08, -d / 2, { key: 'discharge', kind: 'hotgas', flow: 'out', label: 'Kuumakaasu ulos' }),
      liquidIn: port(w * 0.12, -d / 2, { key: 'liquidIn', kind: 'liquid', flow: 'in', label: 'Neste sisään · vastaanotin' }),
      liquidOut: port(w * 0.34, -d / 2, { key: 'liquidOut', kind: 'liquid', flow: 'out', label: 'Neste ulos · näkölasi' }),
    }
  }
  if (eq.category === 'condenser') {
    return {
      hotgas: port(-w * 0.18, -d / 2, { key: 'hotgas', kind: 'hotgas', flow: 'in', label: 'Kuumakaasu sisään' }),
      liquid: port(w * 0.18, -d / 2, { key: 'liquid', kind: 'liquid', flow: 'out', label: 'Neste ulos' }),
    }
  }
  if (eq.category === 'combo' || eq.category === 'unit') {
    return {
      suction: port(-w * 0.22, -d / 2, { key: 'suction', kind: 'suction', flow: 'in', label: 'Imu sisään' }),
      liquid: port(w * 0.22, -d / 2, { key: 'liquid', kind: 'liquid', flow: 'out', label: 'Neste ulos · näkölasi' }),
    }
  }
  return null
}

const PORT_KEYS = {
  suction: ['suction'],
  liquid: ['liquid', 'liquidIn', 'liquidOut'],
  drain: ['drain'],
  hotgas: ['hotgas', 'discharge'],
}

export function nearestPort(rooms, x, z, kind, maxDist = 0.6) {
  let best = null
  const keys = PORT_KEYS[kind] || [kind]
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      for (const key of keys) {
        const point = ports[key]
        if (!point) continue
        const dist = Math.hypot(point.x - x, point.z - z)
        if (dist <= maxDist && (!best || dist < best.dist)) best = { ...point, dist, eq, room }
      }
    }
  }
  return best
}

export function containingRoom(rooms, x, z) {
  const hits = (rooms || []).filter((room) => pointInOutline(x, z, outlinePoints(room)))
  hits.sort((a, b) => a.width * a.depth - b.width * b.depth)
  return hits[0] || null
}

export function rotateDoorWall(wall, direction) {
  const order = ['n', 'e', 's', 'w']
  const index = Math.max(0, order.indexOf(wall || 's'))
  const step = direction >= 0 ? 1 : -1
  return order[(index + step + 4) % 4]
}

export function doorOnWall(room, eq, wall) {
  const hw = room.width / 2
  const hd = room.depth / 2
  const marginX = Math.min(eq.width / 2 + 0.05, Math.max(hw - 0.05, 0.05))
  const marginZ = Math.min(eq.width / 2 + 0.05, Math.max(hd - 0.05, 0.05))
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value))
  if (wall === 'n' || wall === 's') {
    return { wall, rotation: 0, x: clamp(eq.x, marginX), z: wall === 'n' ? -hd : hd }
  }
  return { wall, rotation: 90, x: wall === 'w' ? -hw : hw, z: clamp(eq.z, marginZ) }
}
