import { jsPDF } from 'jspdf'

export const WALL_HEIGHT = 2.6
export const EXTERIOR_THICKNESS = 0.24
export const INTERIOR_THICKNESS = 0.12

export const MATERIALS = {
  floor: [
    { id: 'concrete', name: 'Betoni', color: '#c8cac7' },
    { id: 'tile', name: 'Laatta', color: '#d9d4cc' },
    { id: 'parquet', name: 'Parketti', color: '#b08968' },
    { id: 'laminate', name: 'Laminaatti', color: '#d4a574' },
    { id: 'vinyl', name: 'Vinyyli', color: '#9aa5b1' },
  ],
  interior: [
    { id: 'wallpaper', name: 'Tapetti', color: '#e7e1d8' },
    { id: 'paint', name: 'Maalattu', color: '#f4f1ea' },
    { id: 'panel', name: 'Puuverhous', color: '#c4a882' },
    { id: 'tile', name: 'Laatta', color: '#e2e8f0' },
  ],
  exterior: [
    { id: 'cladding', name: 'Puuverhous', color: '#c4a484' },
    { id: 'brick', name: 'Tiili', color: '#a33b32' },
    { id: 'render', name: 'Rappaus', color: '#e6e0d4' },
  ],
  roof: [
    { id: 'metal', name: 'Pelti', color: '#64748b' },
    { id: 'tile', name: 'Tiili', color: '#7f1d1d' },
    { id: 'felt', name: 'Huopa', color: '#44403c' },
  ],
}

export const FIXTURES = [
  { id: 'cabinet', group: 'Keittiö', name: 'Kaappi', w: 0.6, d: 0.6 },
  { id: 'sink', group: 'Keittiö', name: 'Tiskiallas', w: 0.8, d: 0.6 },
  { id: 'stove', group: 'Keittiö', name: 'Liesi', w: 0.6, d: 0.6 },
  { id: 'fridge', group: 'Keittiö', name: 'Jääkaappi', w: 0.6, d: 0.65 },
  { id: 'dishwasher', group: 'Keittiö', name: 'Astianpesukone', w: 0.6, d: 0.6 },
  { id: 'island', group: 'Keittiö', name: 'Saareke', w: 1.4, d: 0.8 },
  { id: 'toilet', group: 'WC', name: 'WC-istuin', w: 0.4, d: 0.7 },
  { id: 'basin', group: 'WC', name: 'Pesuallas', w: 0.6, d: 0.45 },
  { id: 'shower', group: 'WC', name: 'Suihku', w: 0.9, d: 0.9 },
  { id: 'bath', group: 'WC', name: 'Kylpyamme', w: 1.7, d: 0.75 },
  { id: 'bench', group: 'Sauna', name: 'Lauteet', w: 1.8, d: 0.6 },
  { id: 'heater', group: 'Sauna', name: 'Kiuas', w: 0.45, d: 0.45 },
  { id: 'bed', group: 'Makuu', name: 'Sänky', w: 1.6, d: 2.05 },
  { id: 'wardrobe', group: 'Makuu', name: 'Vaatekaappi', w: 1.5, d: 0.6 },
  { id: 'sofa', group: 'Olohuone', name: 'Sohva', w: 2.1, d: 0.9 },
  { id: 'table', group: 'Olohuone', name: 'Pöytä', w: 1.4, d: 0.8 },
  { id: 'chair', group: 'Olohuone', name: 'Tuoli', w: 0.45, d: 0.45 },
]

const GROUP_LABEL = { floor: 'Lattia', interior: 'Sisäseinä', exterior: 'Ulkoseinä', roof: 'Katto' }

export function materialOf(group, id) {
  return (MATERIALS[group] || []).find((item) => item.id === id) || MATERIALS[group][0]
}

export function fixtureTemplate(id) {
  return FIXTURES.find((item) => item.id === id) || FIXTURES[0]
}

export function emptyPlan(name = 'Omakotitalo') {
  return {
    name,
    paper: 'a3',
    roofType: 'gable',
    exteriorId: 'cladding',
    roofId: 'metal',
    seq: 1,
    walls: [],
    openings: [],
    rooms: [],
    fixtures: [],
  }
}

function issue(plan, prefix) {
  const seq = (plan.seq || 1) + 1
  return { seq, id: `${prefix}-${seq}` }
}

export function segmentLength(a, b) {
  return Math.hypot((b?.x || 0) - (a?.x || 0), (b?.z || 0) - (a?.z || 0))
}

export function wallThickness(kind) {
  return kind === 'interior' ? INTERIOR_THICKNESS : EXTERIOR_THICKNESS
}

function weld(point) {
  return {
    x: Math.round((point?.x || 0) * 1000) / 1000,
    z: Math.round((point?.z || 0) * 1000) / 1000,
  }
}

function vkey(point) {
  const p = weld(point)
  return `${p.x},${p.z}`
}

export function polygonArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.x * next.z - next.x * current.z
  }
  return Math.abs(sum) / 2
}

function signedArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.x * next.z - next.x * current.z
  }
  return sum / 2
}

export function pointInPolygon(x, z, points) {
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

export function centroid(points) {
  if (!points?.length) return { x: 0, z: 0 }
  const area = signedArea(points)
  if (Math.abs(area) < 1e-6) {
    const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
    return { x: sum.x / points.length, z: sum.z / points.length }
  }
  let x = 0
  let z = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const cross = current.x * next.z - next.x * current.z
    x += (current.x + next.x) * cross
    z += (current.z + next.z) * cross
  }
  return { x: x / (6 * area), z: z / (6 * area) }
}

function segmentHits(a, b, c, d) {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = d.x - c.x
  const sz = d.z - c.z
  const den = rx * sz - rz * sx
  const qx = c.x - a.x
  const qz = c.z - a.z
  if (Math.abs(den) < 1e-9) {
    const ts = []
    ;[c, d].forEach((point) => {
      const t = pointOnSegmentT(point, a, b)
      if (t != null) ts.push(t)
    })
    return ts
  }
  const t = (qx * sz - qz * sx) / den
  const u = (qx * rz - qz * rx) / den
  if (t > 0.004 && t < 0.996 && u > 0.004 && u < 0.996) return [t]
  return []
}

function pointOnSegmentT(point, a, b) {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz
  if (len2 < 1e-8) return null
  const t = ((point.x - a.x) * abx + (point.z - a.z) * abz) / len2
  if (t <= 0.004 || t >= 0.996) return null
  const x = a.x + abx * t
  const z = a.z + abz * t
  if (Math.hypot(x - point.x, z - point.z) > 0.012) return null
  return t
}

function atomicEdges(walls) {
  const edges = []
  walls.forEach((wall) => {
    const ts = [0, 1]
    walls.forEach((other) => {
      if (other === wall) return
      segmentHits(wall.a, wall.b, other.a, other.b).forEach((t) => ts.push(t))
      ;[other.a, other.b].forEach((point) => {
        const t = pointOnSegmentT(point, wall.a, wall.b)
        if (t != null) ts.push(t)
      })
    })
    const unique = [...new Set(ts.map((t) => Math.round(t * 10000) / 10000))].sort((a, b) => a - b)
    for (let i = 0; i < unique.length - 1; i += 1) {
      const t0 = unique[i]
      const t1 = unique[i + 1]
      const a = weld({
        x: wall.a.x + (wall.b.x - wall.a.x) * t0,
        z: wall.a.z + (wall.b.z - wall.a.z) * t0,
      })
      const b = weld({
        x: wall.a.x + (wall.b.x - wall.a.x) * t1,
        z: wall.a.z + (wall.b.z - wall.a.z) * t1,
      })
      if (segmentLength(a, b) < 0.02) continue
      edges.push({ a, b, wallId: wall.id, kind: wall.kind, thickness: wallThickness(wall.kind) })
    }
  })
  return edges
}

function findFaces(walls) {
  const edges = atomicEdges(walls)
  const adj = new Map()
  const add = (from, to, edge) => {
    const key = vkey(from)
    if (!adj.has(key)) adj.set(key, [])
    adj.get(key).push({ to, angle: Math.atan2(to.z - from.z, to.x - from.x), edge })
  }
  edges.forEach((edge) => {
    add(edge.a, edge.b, edge)
    add(edge.b, edge.a, edge)
  })
  adj.forEach((list) => list.sort((a, b) => a.angle - b.angle))
  const used = new Set()
  const faces = []
  const directed = []
  edges.forEach((edge) => {
    directed.push([edge.a, edge.b])
    directed.push([edge.b, edge.a])
  })
  directed.forEach(([startA, startB]) => {
    const startKey = `${vkey(startA)}>${vkey(startB)}`
    if (used.has(startKey)) return
    const polygon = [startA]
    let prev = startA
    let current = startB
    let guard = 0
    let closed = false
    while (guard < 400) {
      guard += 1
      const stepKey = `${vkey(prev)}>${vkey(current)}`
      if (used.has(stepKey) && guard > 1) break
      used.add(stepKey)
      polygon.push(current)
      if (vkey(current) === vkey(startA) && polygon.length > 3) {
        closed = true
        break
      }
      const options = adj.get(vkey(current)) || []
      if (!options.length) break
      const reverse = Math.atan2(prev.z - current.z, prev.x - current.x)
      let pick = options[options.length - 1]
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (options[i].angle < reverse - 1e-6) {
          pick = options[i]
          break
        }
      }
      if (vkey(pick.to) === vkey(prev) && options.length > 1) {
        const other = options.find((item) => vkey(item.to) !== vkey(prev) && item.angle < reverse - 1e-6)
          || options.find((item) => vkey(item.to) !== vkey(prev))
        if (other) pick = other
      }
      prev = current
      current = pick.to
    }
    if (!closed) return
    polygon.pop()
    const area = signedArea(polygon)
    if (area < 0.4) return
    const edgeMeta = []
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i]
      const b = polygon[(i + 1) % polygon.length]
      const match = edges.find((edge) => (
        (vkey(edge.a) === vkey(a) && vkey(edge.b) === vkey(b))
        || (vkey(edge.a) === vkey(b) && vkey(edge.b) === vkey(a))
      ))
      edgeMeta.push(match || { thickness: INTERIOR_THICKNESS, kind: 'interior' })
    }
    faces.push({ polygon, area, edges: edgeMeta })
  })
  return faces
}

function insetPolygon(polygon, edges) {
  const lines = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const len = segmentLength(point, next) || 1
    const dx = (next.x - point.x) / len
    const dz = (next.z - point.z) / len
    const nx = -dz
    const nz = dx
    const dist = (edges[index]?.thickness || INTERIOR_THICKNESS) / 2
    return {
      a: { x: point.x + nx * dist, z: point.z + nz * dist },
      b: { x: next.x + nx * dist, z: next.z + nz * dist },
      dx, dz,
    }
  })
  const points = []
  for (let i = 0; i < lines.length; i += 1) {
    const prev = lines[(i + lines.length - 1) % lines.length]
    const current = lines[i]
    const den = prev.dx * current.dz - prev.dz * current.dx
    if (Math.abs(den) < 1e-8) {
      points.push(current.a)
      continue
    }
    const t = ((current.a.x - prev.a.x) * current.dz - (current.a.z - prev.a.z) * current.dx) / den
    points.push({ x: prev.a.x + prev.dx * t, z: prev.a.z + prev.dz * t })
  }
  if (polygonArea(points) < 0.2) return polygon.map((point) => ({ ...point }))
  return points
}

export function detectRooms(walls, previous = []) {
  return findFaces(walls).map((face) => {
    const inner = insetPolygon(face.polygon, face.edges)
    const center = centroid(inner)
    const prev = previous.find((room) => pointInPolygon(room.cx ?? centroid(room.polygon).x, room.cz ?? centroid(room.polygon).z, face.polygon))
      || previous.find((room) => Math.hypot((room.cx || 0) - center.x, (room.cz || 0) - center.z) < 0.75)
    return {
      id: prev?.id || `room-${face.polygon.length}-${Math.round(center.x * 100)}-${Math.round(center.z * 100)}`,
      name: prev?.name || 'Huone',
      polygon: inner,
      gross: face.polygon,
      area: polygonArea(inner),
      cx: center.x,
      cz: center.z,
      floorId: prev?.floorId || 'parquet',
      interiorId: prev?.interiorId || 'paint',
    }
  })
}

function withRooms(plan) {
  return { ...plan, rooms: detectRooms(plan.walls, plan.rooms) }
}

export function addWall(plan, a, b, kind = 'exterior') {
  const start = weld(a)
  const end = weld(b)
  if (segmentLength(start, end) < 0.15) return plan
  const issued = issue(plan, 'wall')
  const next = {
    ...plan,
    seq: issued.seq,
    walls: [...plan.walls, { id: issued.id, a: start, b: end, kind: kind === 'interior' ? 'interior' : 'exterior' }],
  }
  return withRooms(next)
}

export function addOpening(plan, wallId, point, kind = 'door') {
  const wall = plan.walls.find((item) => item.id === wallId)
  if (!wall) return plan
  const placed = placeOpening(wall, point, kind)
  if (!placed) return plan
  const clash = plan.openings.some((item) => item.wallId === wallId && Math.abs(item.offset - placed.offset) < (item.width + placed.width) / 2)
  if (clash) return plan
  const issued = issue(plan, 'open')
  return { ...plan, seq: issued.seq, openings: [...plan.openings, { id: issued.id, ...placed }] }
}

export function placeOpening(wall, point, kind) {
  const len = segmentLength(wall.a, wall.b)
  const width = kind === 'window' ? 1.2 : 0.9
  if (len < width + 0.25) return null
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)
  const offset = Math.min(len - width / 2 - 0.08, Math.max(width / 2 + 0.08, t * len))
  return { wallId: wall.id, offset, width, kind: kind === 'window' ? 'window' : 'door', swing: 1 }
}

export function wallSolids(wall, openings) {
  const len = segmentLength(wall.a, wall.b)
  const cuts = (openings || [])
    .filter((item) => item.wallId === wall.id)
    .map((item) => ({
      from: Math.max(0, item.offset - item.width / 2),
      to: Math.min(len, item.offset + item.width / 2),
      opening: item,
    }))
    .filter((item) => item.to - item.from > 0.05)
    .sort((a, b) => a.from - b.from)
  const solids = []
  let cursor = 0
  cuts.forEach((cut) => {
    if (cut.from - cursor > 0.02) solids.push({ from: cursor, to: cut.from })
    cursor = Math.max(cursor, cut.to)
  })
  if (len - cursor > 0.02) solids.push({ from: cursor, to: len })
  return { length: len, solids, cuts }
}

export function wallPieces(wall, openings) {
  const parts = wallSolids(wall, openings)
  const pieces = []
  const push = (from, to, y0, y1) => {
    if (to - from > 0.02 && y1 - y0 > 0.02) pieces.push({ from, to, y0, y1 })
  }
  parts.solids.forEach((span) => push(span.from, span.to, 0, WALL_HEIGHT))
  parts.cuts.forEach((cut) => {
    if (cut.opening.kind === 'window') {
      push(cut.from, cut.to, 0, 0.9)
      push(cut.from, cut.to, 2.1, WALL_HEIGHT)
    } else {
      push(cut.from, cut.to, 2.1, WALL_HEIGHT)
    }
  })
  return pieces
}

export function nearestWall(walls, point, max = 0.45) {
  let best = null
  ;(walls || []).forEach((wall) => {
    const len = segmentLength(wall.a, wall.b)
    if (len < 0.05) return
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)))
    const x = wall.a.x + dx * t
    const z = wall.a.z + dz * t
    const dist = Math.hypot(point.x - x, point.z - z)
    if (dist <= max && (!best || dist < best.dist)) best = { wall, dist, x, z, t }
  })
  return best
}

export function snapDrawPoint(cursor, origin, walls, grid = 0.1) {
  let point = {
    x: Math.round((cursor?.x || 0) / grid) * grid,
    z: Math.round((cursor?.z || 0) / grid) * grid,
  }
  let best = null
  ;(walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((end) => {
      const dist = Math.hypot(end.x - (cursor?.x || 0), end.z - (cursor?.z || 0))
      if (dist <= 0.28 && (!best || dist < best.dist)) best = { dist, point: end }
    })
  })
  if (best) return weld(best.point)
  if (origin) {
    const angle = Math.atan2(point.z - origin.z, point.x - origin.x)
    const horizontal = Math.abs(angle) < 0.2 || Math.abs(Math.abs(angle) - Math.PI) < 0.2
    const vertical = Math.abs(Math.abs(angle) - Math.PI / 2) < 0.2
    if (horizontal) point = { x: point.x, z: origin.z }
    else if (vertical) point = { x: origin.x, z: point.z }
  }
  const along = nearestWall(walls, point, 0.18)
  if (along && (!origin || segmentLength(origin, { x: along.x, z: along.z }) > 0.15)) {
    return weld({ x: along.x, z: along.z })
  }
  return weld(point)
}

export function snapFixture(fixture, walls) {
  const tpl = fixtureTemplate(fixture.type)
  const hit = nearestWall(walls, fixture, 0.4)
  if (!hit) return { ...fixture, rotation: Math.round((fixture.rotation || 0) / 90) * 90 }
  const wall = hit.wall
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const nx = -dz
  const nz = dx
  const side = Math.sign((fixture.x - hit.x) * nx + (fixture.z - hit.z) * nz) || 1
  const gap = wallThickness(wall.kind) / 2 + tpl.d / 2
  const intoX = nx * side
  const intoZ = nz * side
  return {
    ...fixture,
    x: Math.round((hit.x + intoX * gap) * 1000) / 1000,
    z: Math.round((hit.z + intoZ * gap) * 1000) / 1000,
    rotation: Math.round((Math.atan2(intoX, intoZ) * 180) / Math.PI),
  }
}

export function addFixture(plan, type, x, z) {
  const issued = issue(plan, 'fix')
  const fixture = snapFixture({ id: issued.id, type, x, z, rotation: 0 }, plan.walls)
  return { ...plan, seq: issued.seq, fixtures: [...plan.fixtures, fixture] }
}

export function moveFixture(plan, id, x, z) {
  return {
    ...plan,
    fixtures: plan.fixtures.map((item) => (item.id === id ? snapFixture({ ...item, x, z }, plan.walls) : item)),
  }
}

export function rotateFixture(plan, id) {
  return {
    ...plan,
    fixtures: plan.fixtures.map((item) => (item.id === id ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item)),
  }
}

export function removeFixture(plan, id) {
  return { ...plan, fixtures: plan.fixtures.filter((item) => item.id !== id) }
}

export function duplicateFixture(plan, id) {
  const item = plan.fixtures.find((fixture) => fixture.id === id)
  if (!item) return plan
  return addFixture(plan, item.type, item.x + 0.4, item.z + 0.4)
}

export function renameRoom(plan, id, name) {
  return { ...plan, rooms: plan.rooms.map((room) => (room.id === id ? { ...room, name } : room)) }
}

export function setSurface(plan, target, group, materialId) {
  if (group === 'exterior') return { ...plan, exteriorId: materialId }
  if (group === 'roof') return { ...plan, roofId: materialId }
  return {
    ...plan,
    rooms: plan.rooms.map((room) => {
      if (room.id !== target) return room
      if (group === 'floor') return { ...room, floorId: materialId }
      return { ...room, interiorId: materialId }
    }),
  }
}

export function setRoofType(plan, roofType) {
  return { ...plan, roofType: roofType === 'flat' ? 'flat' : 'gable' }
}

export function planBounds(plan) {
  const points = (plan.walls || []).flatMap((wall) => [wall.a, wall.b])
  if (!points.length) return { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }
  return points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

export function roofModel(plan) {
  const box = planBounds(plan)
  const spanX = box.maxX - box.minX
  const spanZ = box.maxZ - box.minZ
  const alongX = spanX >= spanZ
  return {
    ...box,
    type: plan.roofType === 'flat' ? 'flat' : 'gable',
    wallHeight: WALL_HEIGHT,
    rise: plan.roofType === 'flat' ? 0.18 : Math.max(1.1, Math.min(spanX, spanZ) * 0.28),
    alongX,
    overhang: 0.35,
  }
}

export function materialsList(plan) {
  const rows = []
  const add = (group, id) => {
    const item = materialOf(group, id)
    const key = `${group}:${item.id}`
    const found = rows.find((row) => row.key === key)
    if (found) found.count += 1
    else rows.push({ key, group, groupLabel: GROUP_LABEL[group], id: item.id, name: item.name, color: item.color, count: 1 })
  }
  ;(plan.rooms || []).forEach((room) => {
    add('floor', room.floorId)
    add('interior', room.interiorId)
  })
  add('exterior', plan.exteriorId)
  add('roof', plan.roofId)
  return rows
}

export function formatArea(area) {
  return `${(area || 0).toFixed(1).replace('.', ',')} m²`
}

export function formatMm(metres) {
  return String(Math.round((metres || 0) * 1000))
}

function ascii(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A')
    .replace(/²/g, '2')
}

export function sheetLayout(plan) {
  const paper = plan?.paper === 'a4' ? 'a4' : 'a3'
  const pageW = paper === 'a4' ? 297 : 420
  const pageH = paper === 'a4' ? 210 : 297
  const margin = 12
  const titleW = 78
  const titleH = 36
  const box = planBounds(plan || emptyPlan())
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const frame = { x: margin, y: margin, w: pageW - margin * 2, h: pageH - margin * 2 }
  const drawW = frame.w - titleW - 16
  const drawH = frame.h - 18
  const scale = Math.min(drawW / (worldW + 1.6), drawH / (worldH + 1.6))
  const ox = frame.x + 10 + (drawW - worldW * scale) / 2
  const oy = frame.y + 8 + (drawH - worldH * scale) / 2
  return {
    paper,
    pageW,
    pageH,
    margin,
    titleW,
    titleH,
    box,
    worldW,
    worldH,
    frame,
    scale,
    ox,
    oy,
    title: {
      x: frame.x + frame.w - titleW - 2,
      y: frame.y + frame.h - titleH - 2,
      w: titleW,
      h: titleH,
    },
  }
}

export function viewLayout(plan) {
  const base = sheetLayout(plan)
  if (!plan?.walls?.length) return { ...base, building: base.box }
  const pad = 1.5
  const box = {
    minX: base.box.minX - pad,
    maxX: base.box.maxX + pad,
    minZ: base.box.minZ - pad,
    maxZ: base.box.maxZ + pad,
  }
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const drawW = base.frame.w - base.titleW - 16
  const drawH = base.frame.h - 18
  const scale = Math.min(drawW / worldW, drawH / worldH)
  return {
    ...base,
    box,
    building: base.box,
    scale,
    ox: base.frame.x + 10 + (drawW - worldW * scale) / 2,
    oy: base.frame.y + 8 + (drawH - worldH * scale) / 2,
  }
}

export function buildFloorPlanPdf(plan) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: plan.paper === 'a4' ? 'a4' : 'a3' })
  const layout = sheetLayout(plan)
  const { box, scale, ox, oy, frame, title } = layout
  const X = (x) => ox + (x - box.minX) * scale
  const Y = (z) => oy + (z - box.minZ) * scale

  doc.setDrawColor(20)
  doc.setLineWidth(0.4)
  doc.rect(frame.x, frame.y, frame.w, frame.h)
  doc.setLineWidth(0.15)
  doc.rect(frame.x + 1.2, frame.y + 1.2, frame.w - 2.4, frame.h - 2.4)

  ;(plan.walls || []).forEach((wall) => {
    const parts = wallSolids(wall, plan.openings)
    const thick = wallThickness(wall.kind) * scale
    doc.setDrawColor(17)
    doc.setLineWidth(wall.kind === 'exterior' ? 0.45 : 0.22)
    parts.solids.forEach((span) => {
      const a = pointAt(wall, span.from)
      const b = pointAt(wall, span.to)
      doc.line(X(a.x), Y(a.z), X(b.x), Y(b.z))
    })
    parts.cuts.forEach((cut) => {
      const mid = pointAt(wall, (cut.from + cut.to) / 2)
      doc.setFontSize(7)
      doc.setTextColor(60)
      doc.text(cut.opening.kind === 'window' ? 'Ikkuna' : 'Ovi', X(mid.x), Y(mid.z) - 1.2, { align: 'center' })
    })
    if (thick > 0) doc.setLineWidth(wall.kind === 'exterior' ? 0.45 : 0.22)
  })

  ;(plan.rooms || []).forEach((room) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(20)
    doc.text(ascii(room.name), X(room.cx), Y(room.cz) - 1.2, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(ascii(formatArea(room.area)), X(room.cx), Y(room.cz) + 3.2, { align: 'center' })
  })

  doc.setDrawColor(40)
  doc.setLineWidth(0.12)
  doc.setFontSize(7)
  const widthMm = formatMm(layout.worldW)
  const depthMm = formatMm(layout.worldH)
  doc.line(X(box.minX), Y(box.maxZ) + 6, X(box.maxX), Y(box.maxZ) + 6)
  doc.text(widthMm, (X(box.minX) + X(box.maxX)) / 2, Y(box.maxZ) + 9.5, { align: 'center' })
  doc.line(X(box.maxX) + 6, Y(box.minZ), X(box.maxX) + 6, Y(box.maxZ))
  doc.text(depthMm, X(box.maxX) + 8, (Y(box.minZ) + Y(box.maxZ)) / 2, { angle: 90 })

  const tx = title.x
  const ty = title.y
  doc.setDrawColor(20)
  doc.setLineWidth(0.3)
  doc.rect(tx, ty, title.w, title.h)
  doc.line(tx, ty + 8, tx + title.w, ty + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15)
  doc.text('Pohjakuva', tx + 3, ty + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const rows = [
    ascii(plan.name || 'Omakotitalo'),
    `Mittakaava 1:${Math.round(1000 / scale)}`,
    plan.paper === 'a4' ? 'A4 vaaka' : 'A3 vaaka',
    plan.roofType === 'flat' ? 'Tasakatto' : 'Harjakatto',
    `Huoneita ${(plan.rooms || []).length}`,
    `Pinta-ala ${ascii(formatArea((plan.rooms || []).reduce((sum, room) => sum + room.area, 0)))}`,
  ]
  rows.forEach((row, index) => doc.text(row, tx + 3, ty + 13 + index * 3.6))
  return doc
}

function pointAt(wall, distance) {
  const len = segmentLength(wall.a, wall.b) || 1
  const t = distance / len
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  }
}

export function wallQuads(wall, openings) {
  const parts = wallSolids(wall, openings)
  const len = parts.length || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const nx = -dz
  const nz = dx
  const half = wallThickness(wall.kind) / 2
  return parts.solids.map((span) => {
    const a = pointAt(wall, span.from)
    const b = pointAt(wall, span.to)
    return [
      { x: a.x + nx * half, z: a.z + nz * half },
      { x: b.x + nx * half, z: b.z + nz * half },
      { x: b.x - nx * half, z: b.z - nz * half },
      { x: a.x - nx * half, z: a.z - nz * half },
    ]
  })
}

export function exampleHouse() {
  let plan = emptyPlan('Esimerkkitalo')
  const outer = [[0, 0], [12, 0], [12, 9], [0, 9], [0, 0]]
  for (let i = 0; i < outer.length - 1; i += 1) {
    plan = addWall(plan, { x: outer[i][0], z: outer[i][1] }, { x: outer[i + 1][0], z: outer[i + 1][1] }, 'exterior')
  }
  plan = addWall(plan, { x: 7, z: 0 }, { x: 7, z: 5.5 }, 'interior')
  plan = addWall(plan, { x: 0, z: 5.5 }, { x: 12, z: 5.5 }, 'interior')
  plan = addWall(plan, { x: 5, z: 5.5 }, { x: 5, z: 9 }, 'interior')
  plan = addWall(plan, { x: 8, z: 5.5 }, { x: 8, z: 9 }, 'interior')
  const names = [
    { name: 'Olohuone', x: 3.2, z: 2.6, floorId: 'parquet', interiorId: 'paint' },
    { name: 'Keittiö', x: 9.4, z: 2.6, floorId: 'tile', interiorId: 'tile' },
    { name: 'Makuuhuone', x: 2.4, z: 7.2, floorId: 'laminate', interiorId: 'wallpaper' },
    { name: 'WC', x: 6.5, z: 7.2, floorId: 'tile', interiorId: 'tile' },
    { name: 'Sauna', x: 10, z: 7.2, floorId: 'tile', interiorId: 'panel' },
  ]
  plan = {
    ...plan,
    exteriorId: 'cladding',
    roofId: 'metal',
    roofType: 'gable',
    rooms: plan.rooms.map((room) => {
      const hit = names.find((item) => pointInPolygon(item.x, item.z, room.gross || room.polygon))
      if (!hit) return room
      return { ...room, name: hit.name, floorId: hit.floorId, interiorId: hit.interiorId, cx: hit.x, cz: hit.z }
    }),
  }
  const front = plan.walls.find((wall) => wall.a.z === 0 && wall.b.z === 0 && wall.a.x === 0)
  const cross = plan.walls.find((wall) => wall.a.z === 5.5 && wall.b.z === 5.5)
  const split = plan.walls.find((wall) => wall.a.x === 7 && wall.b.x === 7 && wall.kind === 'interior' && wall.a.z === 0)
  if (front) plan = addOpening(plan, front.id, { x: 3.2, z: 0 }, 'door')
  if (front) plan = addOpening(plan, front.id, { x: 9.2, z: 0 }, 'window')
  const right = plan.walls.find((wall) => wall.a.x === 12 && wall.b.x === 12)
  const back = plan.walls.find((wall) => wall.a.z === 9 && wall.b.z === 9)
  if (right) plan = addOpening(plan, right.id, { x: 12, z: 2.4 }, 'window')
  if (back) plan = addOpening(plan, back.id, { x: 2.2, z: 9 }, 'window')
  if (split) plan = addOpening(plan, split.id, { x: 7, z: 2.8 }, 'door')
  if (cross) {
    plan = addOpening(plan, cross.id, { x: 2.2, z: 5.5 }, 'door')
    plan = addOpening(plan, cross.id, { x: 6.4, z: 5.5 }, 'door')
    plan = addOpening(plan, cross.id, { x: 9.6, z: 5.5 }, 'door')
  }
  ;[
    ['sofa', 0.35, 3.1],
    ['table', 3.6, 2.6],
    ['chair', 3.6, 3.7],
    ['sink', 10.4, 0.32],
    ['stove', 9.3, 0.32],
    ['fridge', 8.15, 0.32],
    ['dishwasher', 11.15, 0.32],
    ['cabinet', 8.3, 5.15],
    ['island', 9.7, 2.7],
    ['bed', 2.3, 5.85],
    ['wardrobe', 0.35, 7.6],
    ['toilet', 6.3, 8.65],
    ['basin', 6.4, 5.85],
    ['shower', 7.65, 8.2],
    ['bench', 10.1, 8.65],
    ['heater', 9.1, 5.85],
  ].forEach(([type, x, z]) => {
    plan = addFixture(plan, type, x, z)
  })
  return plan
}
