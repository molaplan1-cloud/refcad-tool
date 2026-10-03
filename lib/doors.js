// Door types follow the room. A cold room keeps insulated cold-room doors.
// A corridor, office, dock, warehouse or plant room offers ordinary doors.
// The family is taken from the colder side of the opening, unless the door
// carries an explicit doorFamily override.

const AMBIENT_TYPES = new Set(['corridor', 'dock', 'warehouse', 'plant', 'office', 'yard'])

export const DOOR_LIBRARY = [
  { id: 'door-hinged-cold', family: 'cold', style: 'hinged', name: 'Saranakylmäovi', width: 0.9, height: 2.0, depth: 0.08, uValue: 0.5, insulated: true },
  { id: 'door-sliding-cold', family: 'cold', style: 'sliding', name: 'Liukukylmäovi', width: 1.5, height: 2.4, depth: 0.1, uValue: 0.45, insulated: true },
  { id: 'door-freezer', family: 'cold', style: 'freezer', name: 'Pakkasovi', width: 0.9, height: 2.0, depth: 0.12, uValue: 0.28, insulated: true, heated: true, heaterW: 70 },
  { id: 'door-speed-cold', family: 'cold', style: 'speed-roll', name: 'Pikarullaovi, kylmä', width: 1.6, height: 2.4, depth: 0.18, uValue: 1.1, insulated: true },
  { id: 'door-impact', family: 'cold', style: 'impact', name: 'Heiluriovi', width: 1.2, height: 2.1, depth: 0.05, uValue: 2.8, insulated: false },
  { id: 'door-strip', family: 'cold', style: 'strip', name: 'Lamelliverho', width: 1.4, height: 2.2, depth: 0.04, uValue: 5.5, insulated: false, curtain: true },
  { id: 'door-wood', family: 'ambient', style: 'hinged', name: 'Väliovi', width: 0.9, height: 2.1, depth: 0.06, uValue: 2.0, insulated: false },
  { id: 'door-fire-30', family: 'ambient', style: 'fire', name: 'Palo-ovi EI30', width: 0.9, height: 2.1, depth: 0.07, uValue: 1.6, insulated: true, fire: 'EI30' },
  { id: 'door-fire-60', family: 'ambient', style: 'fire', name: 'Palo-ovi EI60', width: 1.0, height: 2.1, depth: 0.08, uValue: 1.2, insulated: true, fire: 'EI60' },
  { id: 'door-steel', family: 'ambient', style: 'hinged', name: 'Teräsovi', width: 0.9, height: 2.1, depth: 0.05, uValue: 5.0, insulated: false },
  { id: 'door-glass', family: 'ambient', style: 'glass', name: 'Lasiovi', width: 0.9, height: 2.1, depth: 0.05, uValue: 5.5, insulated: false },
  { id: 'door-sectional', family: 'ambient', style: 'sectional', name: 'Nosto-ovi', width: 2.4, height: 2.5, depth: 0.08, uValue: 0.9, insulated: true },
  { id: 'door-sectional-double', family: 'ambient', style: 'sectional', name: 'Nosto-pariovi', width: 4.0, height: 2.7, depth: 0.08, uValue: 0.9, insulated: true },
  { id: 'door-roll', family: 'ambient', style: 'roll', name: 'Rullaovi', width: 2.5, height: 2.6, depth: 0.22, uValue: 4.0, insulated: false },
  { id: 'door-speed', family: 'ambient', style: 'speed-roll', name: 'Pikarullaovi', width: 2.2, height: 2.5, depth: 0.16, uValue: 1.4, insulated: true },
  { id: 'door-double', family: 'ambient', style: 'double', name: 'Pariovi', width: 1.6, height: 2.1, depth: 0.06, uValue: 2.2, insulated: false },
  { id: 'door-sliding', family: 'ambient', style: 'sliding', name: 'Liukuovi', width: 1.2, height: 2.1, depth: 0.08, uValue: 2.5, insulated: false },
  { id: 'door-leveler', family: 'ambient', style: 'leveler', name: 'Lastaussilta', width: 2.0, height: 0.2, depth: 2.2, uValue: 3.5, insulated: false, dockOnly: true, cutsWall: false },
  { id: 'door-seal', family: 'ambient', style: 'dock-seal', name: 'Laituritiiviste', width: 2.4, height: 2.7, depth: 0.35, uValue: 1.8, insulated: true, dockOnly: true },
]

const LEGACY = {
  'door-700': { family: 'cold', style: 'hinged', uValue: 0.5, insulated: true },
  'door-900': { family: 'cold', style: 'hinged', uValue: 0.5, insulated: true },
  'door-1200': { family: 'cold', style: 'sliding', uValue: 0.45, insulated: true },
  'door-1500': { family: 'cold', style: 'sliding', uValue: 0.45, insulated: true },
  'door-2000': { family: 'cold', style: 'sliding', uValue: 0.45, insulated: true },
}

const OUTWARD = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }

export function doorTypeById(id) {
  return DOOR_LIBRARY.find((item) => item.id === id) || null
}

export function isAmbientRoom(room) {
  return AMBIENT_TYPES.has(room?.type)
}

export function isColdRoom(room) {
  return !!room && !isAmbientRoom(room)
}

function inferStyle(eq) {
  const name = eq?.name || ''
  if (/lamelli|verho|liuska/i.test(name)) return 'strip'
  if (/pakkas/i.test(name)) return 'freezer'
  if (/nosto|sektio/i.test(name)) return 'sectional'
  if (/pikarulla/i.test(name)) return 'speed-roll'
  if (/rulla/i.test(name)) return 'roll'
  if (/lasi/i.test(name)) return 'glass'
  if (/heiluri/i.test(name)) return 'impact'
  if (/pariovi/i.test(name)) return 'double'
  if (/palo/i.test(name)) return 'fire'
  if (/silta/i.test(name)) return 'leveler'
  if (/tiiviste/i.test(name)) return 'dock-seal'
  if (eq?.slide || /liuku/i.test(name) || (eq?.width || 0) >= 1.15) return 'sliding'
  return 'hinged'
}

export function resolveDoor(eq) {
  const spec = doorTypeById(eq?.catalogId)
  const legacy = LEGACY[eq?.catalogId]
  const style = eq?.doorStyle || spec?.style || legacy?.style || inferStyle(eq)
  const uValue = Number.isFinite(eq?.uValue) ? eq.uValue : (spec?.uValue ?? legacy?.uValue ?? 2.2)
  const family = spec?.family || legacy?.family || (style === 'freezer' || style === 'strip' || style === 'impact' ? 'cold' : 'ambient')
  const insulated = eq?.insulated ?? spec?.insulated ?? legacy?.insulated ?? uValue < 1.5
  const heated = !!(eq?.heated ?? spec?.heated)
  const curtain = !!(eq?.curtain || eq?.stripCurtain || spec?.curtain || style === 'strip')
  const cutsWall = eq?.cutsWall === false || spec?.cutsWall === false || style === 'leveler' ? false : true
  return {
    id: spec?.id || eq?.catalogId || '',
    name: eq?.name || spec?.name || 'Ovi',
    style,
    family,
    uValue,
    insulated: !!insulated,
    heated,
    curtain,
    cutsWall,
    heaterW: Number.isFinite(eq?.heaterW) ? eq.heaterW : (spec?.heaterW || (heated ? 70 : 0)),
    fire: eq?.fire || spec?.fire || null,
    dockOnly: !!(spec?.dockOnly),
  }
}

export function doorEquipmentPatch(spec) {
  return {
    catalogId: spec.id,
    category: 'door',
    name: spec.name,
    width: spec.width,
    height: spec.height,
    depth: spec.depth,
    doorStyle: spec.style,
    uValue: spec.uValue,
    insulated: !!spec.insulated,
    heated: !!spec.heated,
    curtain: !!spec.curtain,
    heaterW: spec.heaterW || 0,
    cutsWall: spec.cutsWall !== false,
    fire: spec.fire || null,
  }
}

function rectOutline(room) {
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

function contains(x, z, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const zi = points[i].z
    const xj = points[j].x
    const zj = points[j].z
    const hit = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi)
    if (hit) inside = !inside
  }
  return inside
}

function roomAt(x, z, rooms, ignoreId) {
  let best = null
  for (const candidate of rooms || []) {
    if (!candidate || candidate.id === ignoreId) continue
    if (!contains(x, z, rectOutline(candidate))) continue
    const area = Math.abs((candidate.width || 1) * (candidate.depth || 1))
    if (!best || area < best.area) best = { room: candidate, area }
  }
  return best?.room || null
}

export function doorContext(room, door, rooms) {
  const wall = door?.wall || 's'
  const [ox, oz] = OUTWARD[wall] || OUTWARD.s
  const px = (room?.x || 0) + (door?.x || 0) + ox * 0.35
  const pz = (room?.z || 0) + (door?.z || 0) + oz * 0.35
  const other = roomAt(px, pz, rooms, room?.id)
  const hostCold = isColdRoom(room)
  const otherCold = isColdRoom(other)
  let colder = room
  if (other && otherCold && !hostCold) colder = other
  else if (other && hostCold && otherCold && other.temp < room.temp) colder = other
  else if (other && !hostCold && !otherCold && other.temp < room.temp) colder = other
  const autoFamily = hostCold || otherCold ? 'cold' : 'ambient'
  const override = door?.doorFamily
  const family = override === 'cold' || override === 'ambient' ? override : autoFamily
  const dock = room?.type === 'dock' || other?.type === 'dock'
  return { other, colder, autoFamily, family, dock, hostCold, otherCold }
}

export function doorChoices(host, rooms, eq = null) {
  if (!host) return DOOR_LIBRARY.slice()
  const ctx = eq ? doorContext(host, eq, rooms || [host]) : null
  const family = ctx?.family || (isColdRoom(host) ? 'cold' : 'ambient')
  const dock = host.type === 'dock' || !!ctx?.dock
  return DOOR_LIBRARY.filter((type) => {
    if (type.dockOnly && !dock) return false
    if (type.dockOnly) return family === 'ambient'
    return type.family === family
  })
}

export function alignDoorToBoundary(eq, room, rooms) {
  const spec = doorTypeById(eq?.catalogId)
  const templateFamily = spec?.family || resolveDoor(eq).family
  const ctx = doorContext(room, eq, rooms)
  if (templateFamily === 'ambient' && ctx.autoFamily === 'cold' && eq?.doorFamily !== 'ambient') {
    const wide = (eq.width || 0) >= 1.15 || ['sectional', 'roll', 'speed-roll', 'sliding', 'double'].includes(spec?.style || eq.doorStyle)
    const cold = doorTypeById(wide ? 'door-sliding-cold' : 'door-hinged-cold')
    return { ...eq, ...doorEquipmentPatch(cold), doorFamily: 'auto' }
  }
  return { ...eq, doorFamily: eq?.doorFamily || 'auto' }
}

export function boundaryDoors(room, rooms) {
  if (!room) return []
  const list = []
  for (const host of rooms || []) {
    for (const eq of host.equipment || []) {
      if (eq?.category !== 'door') continue
      const ctx = doorContext(host, eq, rooms)
      if (host.id !== room.id && ctx.other?.id !== room.id) continue
      list.push({ host, eq, ctx })
    }
  }
  const kept = []
  for (const item of list) {
    const cx = item.host.x + (item.eq.x || 0)
    const cz = item.host.z + (item.eq.z || 0)
    const dup = kept.find((other) => {
      const ox = other.host.x + (other.eq.x || 0)
      const oz = other.host.z + (other.eq.z || 0)
      return Math.hypot(cx - ox, cz - oz) < 0.45
    })
    if (!dup) kept.push(item)
  }
  return kept
}

export function doorSchedule(rooms) {
  const groups = new Map()
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      if (eq?.category !== 'door') continue
      const spec = resolveDoor(eq)
      const key = `${spec.name}|${spec.uValue}`
      const row = groups.get(key) || { name: spec.name, count: 0, uValue: spec.uValue, style: spec.style }
      row.count += 1
      groups.set(key, row)
    }
  }
  return [...groups.values()]
}

function openingOf(room, eq) {
  const wall = eq.wall || 's'
  const cx = (room?.x || 0) + (eq.x || 0)
  const cz = (room?.z || 0) + (eq.z || 0)
  const width = eq.width || 0.9
  const flip = eq.hinge === 'right' || eq.swing === -1
  let x1
  let z1
  let x2
  let z2
  let ix = 0
  let iz = 0
  if (wall === 'n' || wall === 's') {
    x1 = cx + (flip ? width / 2 : -width / 2)
    x2 = cx + (flip ? -width / 2 : width / 2)
    z1 = cz
    z2 = cz
    iz = wall === 's' ? -1 : 1
  } else {
    z1 = cz + (flip ? width / 2 : -width / 2)
    z2 = cz + (flip ? -width / 2 : width / 2)
    x1 = cx
    x2 = cx
    ix = wall === 'e' ? -1 : 1
  }
  return {
    wall,
    x1,
    z1,
    x2,
    z2,
    ix,
    iz,
    width,
    mid: { x: (x1 + x2) / 2, z: (z1 + z2) / 2 },
    alongX: wall === 'n' || wall === 's',
  }
}

function swingArc(hinge, ix, iz, radius) {
  const closed = { x: hinge.x + (ix === 0 ? radius : 0), z: hinge.z + (iz === 0 ? radius : 0) }
  const open = { x: hinge.x + ix * radius, z: hinge.z + iz * radius }
  const a0 = Math.atan2(closed.z - hinge.z, closed.x - hinge.x)
  let delta = Math.atan2(open.z - hinge.z, open.x - hinge.x) - a0
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const points = []
  for (let i = 0; i <= 12; i += 1) {
    const angle = a0 + delta * (i / 12)
    points.push({ x: hinge.x + Math.cos(angle) * radius, z: hinge.z + Math.sin(angle) * radius })
  }
  return { points, open }
}

export function doorPlanFigures(room, eq) {
  const spec = resolveDoor(eq)
  const o = openingOf(room, eq)
  const figures = []
  const thickness = Math.max(room?.wallThickness || 0.1, 0.08) * 2.2
  const gapW = o.alongX ? o.width : thickness
  const gapH = o.alongX ? thickness : o.width
  if (spec.style !== 'leveler') {
    figures.push({
      kind: 'rect', role: 'gap', fill: 'paper',
      x: o.mid.x - gapW / 2, z: o.mid.z - gapH / 2, w: gapW, h: gapH,
    })
  }
  const inward = (dist, from = o.mid) => ({ x: from.x + o.ix * dist, z: from.z + o.iz * dist })
  const outward = (dist, from = o.mid) => ({ x: from.x - o.ix * dist, z: from.z - o.iz * dist })
  const span = (dist) => ({
    x1: o.x1 + o.ix * dist, z1: o.z1 + o.iz * dist,
    x2: o.x2 + o.ix * dist, z2: o.z2 + o.iz * dist,
  })

  if (spec.style === 'double' || spec.style === 'impact') {
    const half = o.width / 2
    const left = swingArc({ x: o.x1, z: o.z1 }, o.ix, o.iz, half)
    const rightHinge = { x: o.x2, z: o.z2 }
    const closed = { x: (o.x1 + o.x2) / 2, z: (o.z1 + o.z2) / 2 }
    const open = { x: rightHinge.x + o.ix * half, z: rightHinge.z + o.iz * half }
    const a0 = Math.atan2(closed.z - rightHinge.z, closed.x - rightHinge.x)
    let delta = Math.atan2(open.z - rightHinge.z, open.x - rightHinge.x) - a0
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const right = []
    for (let i = 0; i <= 12; i += 1) {
      const angle = a0 + delta * (i / 12)
      right.push({ x: rightHinge.x + Math.cos(angle) * half, z: rightHinge.z + Math.sin(angle) * half })
    }
    figures.push({ kind: 'polyline', role: 'leaf', points: left.points })
    figures.push({ kind: 'line', role: 'leaf', x1: o.x1, z1: o.z1, x2: left.open.x, z2: left.open.z })
    figures.push({ kind: 'polyline', role: 'leaf', points: right })
    figures.push({ kind: 'line', role: 'leaf', x1: o.x2, z1: o.z2, x2: open.x, z2: open.z })
  } else if (spec.style === 'sectional') {
    for (let i = 1; i <= 4; i += 1) {
      const line = span((i / 5) * 0.46)
      figures.push({ kind: 'line', role: 'panel', ...line, stroke: '#44403c' })
    }
  } else if (spec.style === 'roll' || spec.style === 'speed-roll') {
    const box = spec.style === 'speed-roll' ? 0.32 : 0.52
    const center = outward(box / 2 + 0.04)
    figures.push({
      kind: 'rect', role: 'box', fill: 'none', stroke: '#44403c',
      x: center.x - (o.alongX ? box / 2 : 0.16),
      z: center.z - (o.alongX ? 0.16 : box / 2),
      w: o.alongX ? box : 0.32,
      h: o.alongX ? 0.32 : box,
    })
    for (let i = 1; i <= 3; i += 1) {
      const line = span((i / 4) * 0.22)
      figures.push({ kind: 'line', role: 'slat', ...line, stroke: '#78716c' })
    }
  } else if (spec.style === 'sliding') {
    const shift = o.width * 0.72
    const tx = o.alongX ? (o.x2 >= o.x1 ? 1 : -1) : 0
    const tz = o.alongX ? 0 : (o.z2 >= o.z1 ? 1 : -1)
    const px = o.x2 + tx * 0.08
    const pz = o.z2 + tz * 0.08
    figures.push({
      kind: 'rect', role: 'leaf', fill: 'none', stroke: '#9a3412',
      x: o.alongX ? Math.min(px, px + tx * shift) : o.mid.x - 0.06,
      z: o.alongX ? o.mid.z - 0.06 : Math.min(pz, pz + tz * shift),
      w: o.alongX ? shift : 0.12,
      h: o.alongX ? 0.12 : shift,
    })
  } else if (spec.style === 'strip') {
    const count = Math.max(4, Math.round(o.width / 0.18))
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count
      const x = o.x1 + (o.x2 - o.x1) * t
      const z = o.z1 + (o.z2 - o.z1) * t
      const tip = inward(0.28, { x, z })
      figures.push({ kind: 'line', role: 'strip', x1: x, z1: z, x2: tip.x, z2: tip.z, stroke: '#a8a29e' })
    }
  } else if (spec.style === 'leveler') {
    const len = Math.max(eq.depth || 1.6, 1.2)
    const center = outward(len / 2)
    figures.push({
      kind: 'rect', role: 'plate', fill: '#d6d3d1', stroke: '#44403c',
      x: center.x - (o.alongX ? o.width / 2 : len / 2),
      z: center.z - (o.alongX ? len / 2 : o.width / 2),
      w: o.alongX ? o.width : len,
      h: o.alongX ? len : o.width,
    })
  } else if (spec.style === 'dock-seal') {
    const pad = 0.28
    figures.push({
      kind: 'rect', role: 'seal', fill: 'none', stroke: '#1f2937', strokeWidth: 2.4,
      x: o.mid.x - (o.alongX ? o.width / 2 : pad),
      z: o.mid.z - (o.alongX ? pad : o.width / 2),
      w: o.alongX ? o.width : pad * 2,
      h: o.alongX ? pad * 2 : o.width,
    })
  } else {
    const arc = swingArc({ x: o.x1, z: o.z1 }, o.ix, o.iz, o.width)
    figures.push({ kind: 'polyline', role: 'leaf', points: arc.points })
    figures.push({ kind: 'line', role: 'leaf', x1: o.x1, z1: o.z1, x2: arc.open.x, z2: arc.open.z })
    if (spec.style === 'glass') {
      const band = inward(0.16)
      figures.push({
        kind: 'rect', role: 'glass', fill: '#dbeafe',
        x: band.x - (o.alongX ? o.width / 2 : 0.08),
        z: band.z - (o.alongX ? 0.08 : o.width / 2),
        w: o.alongX ? o.width : 0.16,
        h: o.alongX ? 0.16 : o.width,
      })
    }
    if (spec.fire) {
      const at = inward(0.55)
      figures.push({ kind: 'text', role: 'fire', x: at.x, z: at.z, text: spec.fire })
    }
  }
  return { style: spec.style, uValue: spec.uValue, figures }
}
