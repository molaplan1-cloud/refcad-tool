import { jsPDF } from 'jspdf'
import { labelObstacles, layoutRoomLabels, normalizeDisplay } from './display.js'
import { coverBill } from './covers.js'
import { groundBill } from './groundworks.js'
import { finishesOf, lookFor, plinthSpec, roofingOf, validHex } from './finishes.js'
import { pdfAscii, translate } from './i18n.js'
import { northAngle, outwardNormal, sideCompass } from './orientation.js'
import { FURNITURE, furnitureTemplate, layoutFor, resolveFixture, variantOf } from './furniture.js'
import { addChimneyFor } from './chimney.js'
import { resolveWallStructure, structureBill, structureCatalog, structureCode } from './structures.js'
import { snapPoint } from './snap.js'
import { faceOffsets, faceQuads, wallFigures } from './wall-outline.js'
import { fitLines, pdfLeadingMm } from './annotations.js'

export const WALL_HEIGHT = 2.6
export const EXTERIOR_THICKNESS = 0.24
export const INTERIOR_THICKNESS = 0.12

export const MATERIALS = {
  floor: [
    { id: 'concrete', name: 'Betoni', color: '#c8cac7' },
    { id: 'concrete-paint', name: 'Maalattu betoni', color: '#d5d2cb' },
    { id: 'epoxy', name: 'Epoksi', color: '#8fa3a8' },
    { id: 'tile', name: 'Laatta', color: '#d9d4cc' },
    { id: 'parquet', name: 'Parketti', color: '#b08968' },
    { id: 'laminate', name: 'Laminaatti', color: '#d4a574' },
    { id: 'vinyl', name: 'Vinyyli', color: '#9aa5b1' },
  ],
  interior: [
    { id: 'wallpaper', name: 'Tapetti', color: '#c4b39a' },
    { id: 'paint', name: 'Maalattu', color: '#f4f1ea' },
    { id: 'gypsum', name: 'Kipsilevy', color: '#b7b2a8' },
    { id: 'concrete-paint', name: 'Maalattu betoni', color: '#9c9890' },
    { id: 'plaster', name: 'Tasoite', color: '#e4ddd2' },
    { id: 'panel', name: 'Puuverhous', color: '#c4a882' },
    { id: 'tile', name: 'Laatta', color: '#8ea0b5' },
  ],
  ceiling: [
    { id: 'paint', name: 'Maalattu', color: '#f7f5f1' },
    { id: 'gypsum', name: 'Kipsilevy', color: '#e7e5e4' },
    { id: 'panel', name: 'Paneeli', color: '#e0c9a6' },
    { id: 'tile', name: 'Laatta', color: '#d6d3d1' },
  ],
  exterior: [
    { id: 'cladding', name: 'Puuverhous', color: '#c4a484' },
    { id: 'brick', name: 'Tiili', color: '#a33b32' },
    { id: 'render', name: 'Rappaus', color: '#e6e0d4' },
  ],
  roof: [
    { id: 'metal', name: 'Pelti', color: '#64748b' },
    { id: 'standing-seam', name: 'Konesaumattu pelti', color: '#3A3F46' },
    { id: 'tile-metal', name: 'Tiilikuviopelti', color: '#4A5560' },
    { id: 'concrete-tile', name: 'Betonitiili', color: '#6B4038' },
    { id: 'clay-tile', name: 'Savitiili', color: '#7F1D1D' },
    { id: 'tile', name: 'Tiili', color: '#7f1d1d' },
    { id: 'felt', name: 'Huopa', color: '#44403c' },
    { id: 'corrugated', name: 'Aaltopelti', color: '#5C656E' },
  ],
}

export const FIXTURES = FURNITURE

const GROUP_LABEL = { floor: 'Lattia', interior: 'Sisäseinä', ceiling: 'Sisäkatto', exterior: 'Ulkoseinä', roof: 'Katto' }

export const WALL_STRUCTURES = [
  { id: 'puuranka', name: 'Puuranka' },
  { id: 'ei30', name: 'Paloseinä EI30' },
  { id: 'ei60', name: 'Paloseinä EI60' },
  { id: 'harkko', name: 'Harkko' },
  { id: 'betoni', name: 'Betoni' },
  { id: 'hirsi', name: 'Hirsi' },
]

export function materialOf(group, id) {
  return (MATERIALS[group] || []).find((item) => item.id === id) || MATERIALS[group][0]
}

export function fixtureTemplate(id) {
  return furnitureTemplate(id)
}

export const ROOM_TYPES = [
  { id: 'olohuone', name: 'Olohuone' },
  { id: 'keittio', name: 'Keittiö' },
  { id: 'makuuhuone', name: 'Makuuhuone' },
  { id: 'wc', name: 'WC' },
  { id: 'kylpyhuone', name: 'Kylpyhuone' },
  { id: 'sauna', name: 'Sauna' },
  { id: 'kodinhoitohuone', name: 'Kodinhoitohuone' },
  { id: 'eteinen', name: 'Eteinen' },
  { id: 'tyohuone', name: 'Työhuone' },
  { id: 'vaatehuone', name: 'Vaatehuone' },
  { id: 'tekninen', name: 'Tekninen tila' },
  { id: 'autotalli', name: 'Autotalli' },
  { id: 'huone', name: 'Huone' },
]

export const ROOF_TYPES = [
  { id: 'gable', name: 'Harjakatto' },
  { id: 'hip', name: 'Aumakatto' },
  { id: 'shed', name: 'Pulpettikatto' },
  { id: 'flat', name: 'Tasakatto' },
]

export const STANDARD_SCALES = [50, 100]

export const FACADE_SIDES = [
  { id: 'north', name: 'Pohjoinen' },
  { id: 'east', name: 'Itä' },
  { id: 'south', name: 'Etelä' },
  { id: 'west', name: 'Länsi' },
]

export const CLADDING = [
  { id: 'brick-red', name: 'Punatiili', group: 'Tiili', color: '#9c341f', pattern: 'brick' },
  { id: 'brick-yellow', name: 'Keltatiili', group: 'Tiili', color: '#d2a24c', pattern: 'brick' },
  { id: 'brick-brown', name: 'Ruskea tiili', group: 'Tiili', color: '#6B4636', pattern: 'brick' },
  { id: 'brick-grey', name: 'Harmaa tiili', group: 'Tiili', color: '#8E8882', pattern: 'brick' },
  { id: 'brick-white', name: 'Valkoinen tiili', group: 'Tiili', color: '#f4f0e6', pattern: 'brick' },
  { id: 'brick-rendered', name: 'Rapattu tiili', group: 'Tiili', color: '#e4d7c5', pattern: 'render' },
  { id: 'wood-horizontal', name: 'Vaakapaneeli', group: 'Puuverhous', color: '#c4a484', pattern: 'boards-h' },
  { id: 'wood-vertical', name: 'Pystypaneeli', group: 'Puuverhous', color: '#b08968', pattern: 'boards-v' },
  { id: 'wood-batten', name: 'Peiterima', group: 'Puuverhous', color: '#a47551', pattern: 'batten' },
  { id: 'stone', name: 'Kivi', group: 'Kivi', color: '#8d887f', pattern: 'stone' },
  { id: 'concrete', name: 'Betoni', group: 'Betoni', color: '#C5C3BE', pattern: 'concrete' },
  { id: 'fibre', name: 'Kuitusementti', group: 'Kuitusementti', color: '#D5D0C8', pattern: 'board' },
  { id: 'board', name: 'Levy', group: 'Levy', color: '#d9d4cc', pattern: 'board' },
  { id: 'render', name: 'Rappaus', group: 'Rappaus', color: '#efe8dc', pattern: 'render' },
]

const LEGACY_CLADDING = {
  cladding: 'wood-horizontal',
  brick: 'brick-red',
  render: 'render',
  panel: 'wood-vertical',
}

export function claddingOf(id) {
  const direct = CLADDING.find((item) => item.id === id)
  if (direct) return direct
  const mapped = LEGACY_CLADDING[id]
  return CLADDING.find((item) => item.id === (mapped || 'wood-horizontal'))
}

export function surfaceLook(plan, materialId, override = {}) {
  return lookFor(claddingOf(materialId), plan, override)
}

export function plinthLook(plan) {
  const finish = finishesOf(plan)
  const spec = plinthSpec(finish.plinthMaterial)
  return {
    id: spec.id,
    name: spec.name,
    group: 'Sokkeli',
    color: finish.plinthColor,
    code: finish.plinthCode,
    pattern: spec.pattern,
    height: finish.plinthHeight,
  }
}

export function plinthArea(plan) {
  const height = plinthLook(plan).height
  let area = 0
  ;(plan?.walls || []).forEach((wall) => {
    if (wall.kind === 'interior') return
    const len = segmentLength(wall.a, wall.b)
    let cut = 0
    ;(plan.openings || []).forEach((opening) => {
      if (opening.wallId !== wall.id) return
      const sill = opening.kind === 'window'
        ? (Number.isFinite(opening.sill) ? opening.sill : 0.9)
        : (Number.isFinite(opening.sill) ? opening.sill : 0)
      const head = sill + (opening.height || (opening.kind === 'window' ? 1.2 : 2.1))
      const overlap = Math.min(height, head) - Math.max(0, sill)
      if (overlap > 0.02) cut += (opening.width || 0) * overlap
    })
    area += Math.max(0, len * height - cut)
  })
  return area
}

export function roofLook(plan) {
  const item = materialOf('roof', plan?.roofId || 'metal')
  const finish = finishesOf(plan)
  const roofing = roofingOf(plan?.roofId || 'metal')
  return {
    id: item.id,
    name: roofing.name,
    storedName: item.name,
    pattern: roofing.pattern,
    color: finish.roofColor || item.color,
    code: finish.roofCode || '',
    gutterColor: finish.gutterColor,
    gutterCode: finish.gutterCode,
  }
}

export function openingColour(plan, opening) {
  const finish = finishesOf(plan)
  const custom = validHex(opening?.color)
  if (opening?.kind === 'door') {
    return { color: custom || finish.doorColor, code: opening?.colorCode || finish.doorCode || '' }
  }
  return { color: custom || finish.windowColor, code: opening?.colorCode || finish.windowCode || '' }
}

export function contextMenuSpec(kind) {
  const menus = {
    wall: ['thickness', 'align', 'type', 'height', 'material', 'length', 'angle', 'split', 'facade', 'door', 'window', 'delete'],
    opening: ['width', 'height', 'sill', 'hand', 'leaf', 'type', 'delete'],
    room: ['name', 'type', 'floor', 'wall', 'ceiling', 'ceilingHeight', 'showArea', 'delete'],
    fixture: ['rotate', 'mirror', 'dimensions', 'material', 'duplicate', 'delete'],
    canvas: ['paste', 'wall', 'room', 'house'],
  }
  return menus[kind] || []
}

export function dimensionRotation(vertical) {
  return vertical ? 90 : 0
}

export function emptyPlan(name = 'Omakotitalo') {
  return {
    name,
    address: '',
    buildingType: 'omakotitalo',
    floors: 1,
    floorHeight: WALL_HEIGHT,
    exteriorThickness: EXTERIOR_THICKNESS,
    exteriorStructure: 'puuranka',
    paper: 'a3',
    roofType: 'gable',
    roofPitch: 25,
    eaveOverhang: EAVE_OVERHANG,
    drawingScale: null,
    exteriorId: 'cladding',
    roofId: 'metal',
    facades: [],
    facadeSplits: [],
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
  if (kind === 'interior' || kind === 'partition') return INTERIOR_THICKNESS
  if (kind === 'bearing') return EXTERIOR_THICKNESS
  return EXTERIOR_THICKNESS
}

export function thicknessOf(wall, plan) {
  if (wall?.thicknessCustom && Number.isFinite(wall.thickness) && wall.thickness > 0) return wall.thickness
  const spec = resolveWallStructure(plan, wall)
  if (spec?.thickness > 0.04) return spec.thickness
  if ((wall?.kind === 'exterior' || wall?.kind === 'bearing') && Number.isFinite(plan?.exteriorThickness)) return plan.exteriorThickness
  return wallThickness(wall?.kind)
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

function mergeCuts(wall, openings) {
  const len = segmentLength(wall?.a, wall?.b) || 1
  return (openings || [])
    .filter((opening) => opening.wallId === wall.id && opening.kind === 'passage' && opening.mergeSpaces)
    .map((opening) => {
      const half = (opening.width || 0.9) / 2
      return [Math.max(0, (opening.offset - half) / len), Math.min(1, (opening.offset + half) / len)]
    })
}

function atomicEdges(walls, openings = []) {
  const edges = []
  walls.forEach((wall) => {
    const cuts = mergeCuts(wall, openings)
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
      const mid = (t0 + t1) / 2
      if (cuts.some(([from, to]) => mid > from + 0.001 && mid < to - 0.001)) continue
      const a = weld({
        x: wall.a.x + (wall.b.x - wall.a.x) * t0,
        z: wall.a.z + (wall.b.z - wall.a.z) * t0,
      })
      const b = weld({
        x: wall.a.x + (wall.b.x - wall.a.x) * t1,
        z: wall.a.z + (wall.b.z - wall.a.z) * t1,
      })
      if (segmentLength(a, b) < 0.02) continue
      edges.push({
        a,
        b,
        wallId: wall.id,
        kind: wall.kind,
        align: wall.align === 'left' || wall.align === 'right' ? wall.align : 'center',
        thickness: Number.isFinite(wall.thickness) ? wall.thickness : wallThickness(wall.kind),
      })
    }
  })
  return edges
}

function findFaces(walls, openings = []) {
  const edges = atomicEdges(walls, openings)
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

function edgeInset(edge, from, to) {
  const thick = edge?.thickness || INTERIOR_THICKNESS
  const align = edge?.align === 'left' || edge?.align === 'right' ? edge.align : 'center'
  const offsets = align === 'left'
    ? { left: 0, right: -thick }
    : align === 'right'
      ? { left: thick, right: 0 }
      : { left: thick / 2, right: -thick / 2 }
  if (!edge?.a || !edge?.b || !from || !to) return thick / 2
  const same = (to.x - from.x) * (edge.b.x - edge.a.x) + (to.z - from.z) * (edge.b.z - edge.a.z) >= 0
  return same ? offsets.left : -offsets.right
}

function insetPolygon(polygon, edges) {
  const lines = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const len = segmentLength(point, next) || 1
    const dx = (next.x - point.x) / len
    const dz = (next.z - point.z) / len
    const nx = -dz
    const nz = dx
    const dist = edgeInset(edges[index], point, next)
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
    if (Math.abs(den) < 1e-6) {
      const gap = Math.hypot(current.a.x - prev.b.x, current.a.z - prev.b.z)
      if (gap > 0.001) points.push({ x: prev.b.x, z: prev.b.z })
      points.push({ x: current.a.x, z: current.a.z })
      continue
    }
    const t = ((current.a.x - prev.a.x) * current.dz - (current.a.z - prev.a.z) * current.dx) / den
    points.push({ x: prev.a.x + prev.dx * t, z: prev.a.z + prev.dz * t })
  }
  if (polygonArea(points) < 0.2) return polygon.map((point) => ({ ...point }))
  return points
}

function keptRoomPoint(room) {
  const fallback = centroid(room?.polygon || room?.gross || [])
  return {
    x: Number.isFinite(room?.lx) ? room.lx : (Number.isFinite(room?.cx) ? room.cx : fallback.x),
    z: Number.isFinite(room?.lz) ? room.lz : (Number.isFinite(room?.cz) ? room.cz : fallback.z),
  }
}

function matchPreviousRooms(faces, previous) {
  const owner = new Map()
  const taken = new Set()
  const claim = (index, room) => {
    if (index == null || taken.has(index)) return
    taken.add(index)
    owner.set(index, room)
  }
  ;(previous || []).forEach((room) => {
    const at = keptRoomPoint(room)
    const hits = faces
      .map((face, index) => ({ face, index }))
      .filter(({ face }) => pointInPolygon(at.x, at.z, face.polygon) || pointInPolygon(at.x, at.z, face.inner))
      .sort((a, b) => b.face.area - a.face.area)
    if (hits.length) claim(hits[0].index, room)
  })
  ;(previous || []).forEach((room) => {
    if ([...owner.values()].includes(room)) return
    const at = keptRoomPoint(room)
    let best = null
    faces.forEach((face, index) => {
      if (taken.has(index)) return
      const dist = Math.hypot((room.cx ?? at.x) - face.center.x, (room.cz ?? at.z) - face.center.z)
      if (dist < 0.75 && (!best || dist < best.dist)) best = { index, dist }
    })
    if (best) claim(best.index, room)
  })
  return owner
}

function polygonWithin(inner, outer) {
  if (!inner?.length || !outer?.length || inner.length < 3 || outer.length < 3) return false
  if (polygonArea(inner) >= polygonArea(outer) - 0.05) return false
  return inner.every((point) => pointInPolygon(point.x, point.z, outer))
}

function subtractEnclosedAreas(rooms) {
  const grossOf = (room) => room.gross || room.polygon || []
  return rooms.map((room, index) => {
    const outer = grossOf(room)
    const holes = rooms.filter((other, otherIndex) => {
      if (otherIndex === index) return false
      const inner = grossOf(other)
      if (!polygonWithin(inner, outer)) return false
      return !rooms.some((mid, midIndex) => (
        midIndex !== index
        && midIndex !== otherIndex
        && polygonWithin(inner, grossOf(mid))
        && polygonWithin(grossOf(mid), outer)
      ))
    })
    if (!holes.length) return room
    const hole = holes.reduce((sum, item) => sum + (item.area || 0), 0)
    return { ...room, area: Math.max(0, (room.area || 0) - hole) }
  })
}

function passageLinks(room, walls, openings) {
  return (openings || []).filter((opening) => opening.kind === 'passage').flatMap((opening) => {
    const wall = (walls || []).find((item) => item.id === opening.wallId)
    if (!wall?.a || !wall?.b) return []
    const len = segmentLength(wall.a, wall.b) || 1
    const along = opening.offset / len
    const x = wall.a.x + (wall.b.x - wall.a.x) * along
    const z = wall.a.z + (wall.b.z - wall.a.z) * along
    const nx = -(wall.b.z - wall.a.z) / len
    const nz = (wall.b.x - wall.a.x) / len
    const poly = room.gross || room.polygon || []
    const left = pointInPolygon(x + nx * 0.25, z + nz * 0.25, poly)
    const right = pointInPolygon(x - nx * 0.25, z - nz * 0.25, poly)
    if (!left && !right) return []
    return [{
      openingId: opening.id,
      kind: 'passage',
      name: 'Oviaukko',
      width: opening.width,
      mergeSpaces: Boolean(opening.mergeSpaces),
    }]
  })
}

export function detectRooms(walls, previous = [], openings = []) {
  const faces = findFaces(walls, openings).map((face) => {
    const inner = insetPolygon(face.polygon, face.edges)
    return { ...face, inner, center: centroid(inner) }
  })
  const owner = matchPreviousRooms(faces, previous)
  const rooms = faces.map((face, index) => {
    const prev = owner.get(index)
    const center = face.center
    return {
      id: prev?.id || `room-${face.polygon.length}-${Math.round(center.x * 100)}-${Math.round(center.z * 100)}`,
      name: prev?.name || 'Huone',
      type: prev?.type || 'huone',
      polygon: face.inner,
      gross: face.polygon,
      area: polygonArea(face.inner),
      cx: center.x,
      cz: center.z,
      lx: prev?.lx,
      lz: prev?.lz,
      floorId: prev?.floorId || 'parquet',
      interiorId: prev?.interiorId || 'paint',
      ceilingId: prev?.ceilingId || 'paint',
      ceilingHeight: prev?.ceilingHeight,
      setpoint: prev?.setpoint,
      showLabel: prev ? prev.showLabel !== false : true,
      suppressed: Boolean(prev?.suppressed),
      drawId: prev?.drawId || null,
      connections: [],
      walls: face.polygon.map((point, edgeIndex) => {
        const next = face.polygon[(edgeIndex + 1) % face.polygon.length]
        const edge = face.edges[edgeIndex] || {}
        return {
          index: edgeIndex,
          wallId: edge.wallId || null,
          kind: edge.kind || 'interior',
          a: point,
          b: next,
        }
      }),
    }
  })
  const linked = rooms.map((room) => ({ ...room, connections: passageLinks(room, walls, openings) }))
  return subtractEnclosedAreas(linked)
}

function wallProbes(wall) {
  const len = segmentLength(wall.a, wall.b) || 1
  const mx = (wall.a.x + wall.b.x) / 2
  const mz = (wall.a.z + wall.b.z) / 2
  const nx = -(wall.b.z - wall.a.z) / len
  const nz = (wall.b.x - wall.a.x) / len
  const probe = 0.16
  return [
    { x: mx + nx * probe, z: mz + nz * probe },
    { x: mx - nx * probe, z: mz - nz * probe },
  ]
}

function wallBuried(wall, rooms) {
  const live = (rooms || []).filter((room) => !room.suppressed && (room.gross || room.polygon || []).length >= 3)
  if (!live.length || !wall?.a || !wall?.b) return false
  const inside = (point) => live.some((room) => pointInPolygon(point.x, point.z, room.gross || room.polygon))
  const [left, right] = wallProbes(wall)
  return inside(left) && inside(right)
}

function tuneBuriedWalls(walls, rooms) {
  let changed = false
  const next = (walls || []).map((wall) => {
    if (!wall || wall.kind === 'interior' || wall.kind === 'bearing') return wall
    if (!wallBuried(wall, rooms)) return wall
    changed = true
    return {
      ...wall,
      kind: 'interior',
      thickness: wall.thicknessCustom ? wall.thickness : INTERIOR_THICKNESS,
    }
  })
  return { walls: next, changed }
}

function withRooms(plan) {
  let walls = plan.walls || []
  let rooms = detectRooms(walls, plan.rooms, plan.openings)
  const tuned = tuneBuriedWalls(walls, rooms)
  if (tuned.changed) {
    walls = tuned.walls
    rooms = detectRooms(walls, rooms, plan.openings)
  }
  return { ...plan, walls, rooms }
}

function enclosedByRooms(plan, a, b) {
  const rooms = (plan?.rooms || []).filter((room) => !room.suppressed)
  if (!rooms.length) return false
  const mx = (a.x + b.x) / 2
  const mz = (a.z + b.z) / 2
  return rooms.some((room) => pointInPolygon(mx, mz, room.gross || room.polygon || []))
}

function pullToHost(point, walls) {
  let best = null
  ;(walls || []).forEach((wall) => {
    const len = segmentLength(wall.a, wall.b)
    if (len < 0.2) return
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / len
    if (t <= 0.04 || t >= 0.96) return
    const on = { x: wall.a.x + dx * len * t, z: wall.a.z + dz * len * t }
    const dist = Math.hypot(point.x - on.x, point.z - on.z)
    const half = (Number(wall.thickness) > 0 ? wall.thickness : wallThickness(wall.kind)) / 2
    if (dist > half + 0.04 || dist < 0.004) return
    if (!best || dist < best.dist) best = { dist, point: on }
  })
  return best ? best.point : point
}

function storedKind(kind) {
  if (kind === 'partition' || kind === 'interior') return 'interior'
  if (kind === 'bearing') return 'bearing'
  return 'exterior'
}

function axisLockEnds(start, end) {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const len = Math.hypot(dx, dz)
  if (len < 0.05) return { a: start, b: end }
  const ang = Math.atan2(dz, dx)
  const nearest = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2)
  let diff = ang - nearest
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  if (Math.abs(diff) > (0.5 * Math.PI) / 180) return { a: start, b: end }
  if (Math.abs(dx) <= Math.abs(dz)) {
    const x = Math.round(start.x * 1000) / 1000
    return { a: weld({ x, z: start.z }), b: weld({ x, z: end.z }) }
  }
  const z = Math.round(start.z * 1000) / 1000
  return { a: weld({ x: start.x, z }), b: weld({ x: end.x, z }) }
}

function shiftJoined(plan, from, to) {
  if (Math.hypot(to.x - from.x, to.z - from.z) <= 0.0005) return plan
  const walls = (plan.walls || []).map((wall) => ({
    ...wall,
    a: !nearPoint(wall.a, to, 0.0005) && nearPoint(wall.a, from, 0.04) ? weld(to) : wall.a,
    b: !nearPoint(wall.b, to, 0.0005) && nearPoint(wall.b, from, 0.04) ? weld(to) : wall.b,
  }))
  return withRooms({ ...plan, walls })
}

function weldToExisting(point, walls) {
  let best = null
  ;(walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((end) => {
      const dist = segmentLength(point, end)
      if (dist <= 0.4 && (!best || dist < best.dist)) best = { dist, point: end }
    })
  })
  return best ? weld(best.point) : weld(point)
}

export function addWall(plan, a, b, kind = 'exterior') {
  const start0 = weldToExisting(pullToHost(a, plan.walls), plan.walls)
  const end0 = weldToExisting(pullToHost(b, plan.walls), plan.walls)
  const aligned = axisLockEnds(start0, end0)
  const start = aligned.a
  const end = aligned.b
  if (segmentLength(start, end) < 0.15) return plan
  const issued = issue(plan, 'wall')
  const resolved = enclosedByRooms(plan, start, end) ? 'interior' : storedKind(kind)
  const next = {
    ...plan,
    seq: issued.seq,
    walls: [...plan.walls, {
      id: issued.id,
      a: start,
      b: end,
      kind: resolved,
      height: plan.floorHeight || WALL_HEIGHT,
      thickness: resolved === 'interior' ? INTERIOR_THICKNESS : (plan.exteriorThickness || EXTERIOR_THICKNESS),
    }],
  }
  let placed = splitWhereJoined(withRooms(next), [start, end])
  const endJoined = (plan.walls || []).some((wall) => nearPoint(wall.a, end0) || nearPoint(wall.b, end0))
  if (endJoined) placed = shiftJoined(placed, end0, end)
  placed = shiftJoined(placed, start0, start)
  return placed
}

function splitWhereJoined(plan, points) {
  let next = plan
  ;(points || []).forEach((point) => {
    const targets = [...(next.walls || [])]
    targets.forEach((wall) => {
      const current = (next.walls || []).find((item) => item.id === wall.id)
      if (!current) return
      const len = segmentLength(current.a, current.b)
      if (len < 0.3) return
      const dx = current.b.x - current.a.x
      const dz = current.b.z - current.a.z
      const t = ((point.x - current.a.x) * dx + (point.z - current.a.z) * dz) / (len * len)
      if (t <= 0.08 || t >= 0.92) return
      const x = current.a.x + dx * t
      const z = current.a.z + dz * t
      if (Math.hypot(x - point.x, z - point.z) > 0.04) return
      next = splitWall(next, current.id, { x, z })
    })
  })
  return next
}

export function addOpening(plan, wallId, point, kind = 'door', options = {}) {
  const wall = plan.walls.find((item) => item.id === wallId)
  if (!wall) return plan
  const placed = placeOpening(wall, point, kind)
  if (!placed) return plan
  const clash = plan.openings.some((item) => item.wallId === wallId && Math.abs(item.offset - placed.offset) < (item.width + placed.width) / 2)
  if (clash) return plan
  const issued = issue(plan, 'open')
  const passage = placed.kind === 'passage'
  const door = placed.kind === 'door'
  const swing = door && Number.isFinite(options.swing) ? (options.swing >= 0 ? 1 : -1) : placed.swing
  const inward = door && Boolean(options.inward)
  const opening = {
    id: issued.id,
    ...placed,
    swing,
    inward,
    lintel: passage ? Boolean(options.lintel) : false,
    lintelHeight: passage ? (Number(options.lintelHeight) > 0 ? Number(options.lintelHeight) : 0.15) : 0,
    mergeSpaces: false,
  }
  const next = { ...plan, seq: issued.seq, openings: [...plan.openings, opening] }
  return passage ? withRooms(next) : next
}

export function placeOpening(wall, point, kind) {
  const len = segmentLength(wall.a, wall.b)
  const width = kind === 'window' ? 1.2 : 0.9
  if (len < width + 0.25) return null
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)
  const offset = Math.min(len - width / 2 - 0.08, Math.max(width / 2 + 0.08, t * len))
  const window = kind === 'window'
  const passage = kind === 'passage'
  return {
    wallId: wall.id,
    offset,
    width,
    kind: window ? 'window' : passage ? 'passage' : 'door',
    swing: passage ? 0 : 1,
    height: window ? 1.2 : 2.1,
    sill: window ? 0.9 : 0,
  }
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

function nearPoint(a, b, tol = 0.08) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) <= tol
}

function dirFrom(at, far) {
  const len = Math.hypot(far.x - at.x, far.z - at.z) || 1
  return { x: (far.x - at.x) / len, z: (far.z - at.z) / len }
}

function lineMeet(p, d, q, e) {
  const det = d.x * e.z - d.z * e.x
  if (Math.abs(det) < 1e-8) return null
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / det
  return { x: p.x + d.x * t, z: p.z + d.z * t }
}

function incidentAt(at, walls, plan) {
  const found = []
  ;(walls || []).forEach((wall) => {
    if (nearPoint(wall.a, at)) found.push({ wall, far: wall.b, dir: dirFrom(at, wall.b), half: thicknessOf(wall, plan) / 2 })
    else if (nearPoint(wall.b, at)) found.push({ wall, far: wall.a, dir: dirFrom(at, wall.a), half: thicknessOf(wall, plan) / 2 })
  })
  return found
}

function endJoin(wall, at, walls, plan) {
  let extra = 0
  const far = nearPoint(wall.a, at) ? wall.b : wall.a
  const dir = dirFrom(at, far)
  const half = thicknessOf(wall, plan) / 2
  ;(walls || []).forEach((other) => {
    if (!other || other.id === wall.id) return
    let otherDir = null
    if (nearPoint(other.a, at)) otherDir = dirFrom(at, other.b)
    else if (nearPoint(other.b, at)) otherDir = dirFrom(at, other.a)
    else if (pointOnSegmentT(at, other.a, other.b) != null) {
      const hostHalf = thicknessOf(other, plan) / 2
      if (wall.kind === 'interior' || wall.kind === 'partition') extra = Math.min(extra, -hostHalf)
      else extra = Math.max(extra, hostHalf)
      return
    } else return
    const dot = Math.max(-1, Math.min(1, dir.x * otherDir.x + dir.z * otherDir.z))
    const between = Math.acos(dot)
    if (between < 0.12 || between > Math.PI - 0.12) return
    const inner = wall.kind === 'interior' || wall.kind === 'partition'
    const shell = other.kind !== 'interior' && other.kind !== 'partition'
    if (inner && shell) {
      extra = Math.min(extra, -thicknessOf(other, plan) / 2)
      return
    }
    const mitre = (thicknessOf(other, plan) / 2) / Math.tan(between / 2)
    extra = Math.max(extra, Math.min(Math.abs(mitre), half * 4))
  })
  return extra
}

function mitreCorner(corner, dir, half, side, neighbor) {
  const normal = { x: -dir.z * side, z: dir.x * side }
  const square = { x: corner.x + normal.x * half, z: corner.z + normal.z * half }
  if (!neighbor) return square
  const n2 = { x: -neighbor.dir.z, z: neighbor.dir.x }
  const other = { x: corner.x + n2.x * neighbor.half * -side, z: corner.z + n2.z * neighbor.half * -side }
  const hit = lineMeet(square, dir, other, neighbor.dir)
  if (!hit) return square
  const dist = Math.hypot(hit.x - corner.x, hit.z - corner.z)
  if (dist > Math.max(half, neighbor.half) * 5) return square
  return hit
}

export function wallPieces(wall, openings, height = WALL_HEIGHT, walls = [], plan = null) {
  const parts = wallSolids(wall, openings)
  const len = parts.length || segmentLength(wall.a, wall.b) || 1
  const top = wall?.height || height || WALL_HEIGHT
  const extA = endJoin(wall, wall.a, walls, plan)
  const extB = endJoin(wall, wall.b, walls, plan)
  const pieces = []
  const push = (from, to, y0, y1) => {
    if (to - from > 0.02 && y1 - y0 > 0.02) pieces.push({ from, to, y0, y1 })
  }
  parts.solids.forEach((span) => {
    const from = span.from <= 0.02 ? -extA : span.from
    const to = span.to >= len - 0.02 ? len + extB : span.to
    push(from, to, 0, top)
  })
  parts.cuts.forEach((cut) => {
    if (cut.opening.kind === 'window') {
      const sill = Number.isFinite(cut.opening.sill) ? cut.opening.sill : 0.9
      const head = Math.min(top, sill + (cut.opening.height || 1.2))
      push(cut.from, cut.to, 0, sill)
      push(cut.from, cut.to, head, top)
    } else {
      const head = Math.min(top, cut.opening.height || 2.1)
      push(cut.from, cut.to, head, top)
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

export function snapDrawPoint(cursor, origin, walls, grid = 0.1, options = {}) {
  return snapPoint(cursor, {
    origin,
    walls,
    grid,
    radius: options.radius ?? 0.28,
    ortho: options.ortho,
    enabled: options.enabled !== false,
  }).point
}

function cornerClusters(walls) {
  const points = []
  ;(walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((point) => {
      const found = points.find((item) => Math.hypot(item.x - point.x, item.z - point.z) < 0.08)
      if (found) {
        if (!found.walls.some((item) => item.id === wall.id)) found.walls.push(wall)
      } else points.push({ x: point.x, z: point.z, walls: [wall] })
    })
  })
  return points.filter((item) => item.walls.length >= 2)
}

function snapCorner(fixture, walls, depth) {
  let best = null
  cornerClusters(walls).forEach((corner) => {
    const dist = Math.hypot(fixture.x - corner.x, fixture.z - corner.z)
    if (dist <= 0.25 && (!best || dist < best.dist)) best = { ...corner, dist }
  })
  if (!best) return null
  const inset = (wall) => {
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    const nx = -dz
    const nz = dx
    const side = Math.sign((fixture.x - best.x) * nx + (fixture.z - best.z) * nz) || 1
    const gap = wallThickness(wall.kind) / 2 + depth / 2
    return { x: nx * side * gap, z: nz * side * gap }
  }
  const first = inset(best.walls[0])
  const second = inset(best.walls[1])
  const intoX = first.x + second.x
  const intoZ = first.z + second.z
  return {
    ...fixture,
    x: Math.round((best.x + first.x + second.x) * 1000) / 1000,
    z: Math.round((best.z + first.z + second.z) * 1000) / 1000,
    rotation: Math.round((Math.atan2(intoX, intoZ) * 180) / Math.PI),
  }
}

export function snapFixture(fixture, walls, radius = 0.4) {
  const tpl = fixtureTemplate(fixture.type)
  const depth = fixture.d || tpl.d
  const corner = snapCorner(fixture, walls, depth)
  if (corner) return corner
  const hit = nearestWall(walls, fixture, radius)
  if (!hit) return { ...fixture, rotation: Math.round((fixture.rotation || 0) / 90) * 90 }
  const wall = hit.wall
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const nx = -dz
  const nz = dx
  const side = Math.sign((fixture.x - hit.x) * nx + (fixture.z - hit.z) * nz) || 1
  const gap = wallThickness(wall.kind) / 2 + depth / 2
  const intoX = nx * side
  const intoZ = nz * side
  return {
    ...fixture,
    x: Math.round((hit.x + intoX * gap) * 1000) / 1000,
    z: Math.round((hit.z + intoZ * gap) * 1000) / 1000,
    rotation: Math.round((Math.atan2(intoX, intoZ) * 180) / Math.PI),
  }
}

export function addFixture(plan, type, x, z, radius = 0.4) {
  const issued = issue(plan, 'fix')
  const tpl = fixtureTemplate(type)
  const variant = (tpl.variants || [])[0] || null
  const fixture = snapFixture({
    id: issued.id,
    type,
    x,
    z,
    rotation: 0,
    variant: variant?.id,
    w: variant?.w || tpl.w,
    d: variant?.d || tpl.d,
    h: variant?.h || tpl.h,
  }, plan.walls, radius)
  let next = { ...plan, seq: issued.seq, fixtures: [...plan.fixtures, fixture] }
  const spec = resolveFixture(fixture)
  if (spec.chimney && spec.storing === false && spec.heatKw > 0) next = addChimneyFor(next, fixture.id)
  return next
}

export function moveFixture(plan, id, x, z, radius = 0.4) {
  return {
    ...plan,
    fixtures: plan.fixtures.map((item) => (item.id === id ? snapFixture({ ...item, x, z }, plan.walls, radius) : item)),
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
  const item = (plan.fixtures || []).find((fixture) => fixture.id === id)
  if (!item) return plan
  const issued = issue(plan, 'fix')
  const snapped = snapFixture({ ...item, id: issued.id, x: item.x + 0.45, z: item.z + 0.45 }, plan.walls)
  const copy = {
    ...snapped,
    w: item.w,
    d: item.d,
    h: item.h,
    variant: item.variant,
    rotation: item.rotation,
    mirror: item.mirror,
    color: item.color,
    flue: item.flue,
    flues: item.flues,
    shield: item.shield,
    stack: item.stack,
    cadLock: false,
    groupId: undefined,
  }
  return { ...plan, seq: issued.seq, fixtures: [...plan.fixtures, copy] }
}

export function applyFixtureVariant(plan, id, variantId) {
  const fixture = (plan.fixtures || []).find((item) => item.id === id)
  if (!fixture) return plan
  const variant = variantOf(fixtureTemplate(fixture.type), variantId)
  if (!variant) return plan
  return updateFixture(plan, id, { variant: variant.id, w: variant.w, d: variant.d, h: variant.h })
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
  const allowed = ROOF_TYPES.some((item) => item.id === roofType)
  return { ...plan, roofType: allowed ? roofType : 'gable' }
}

export function updateHouse(plan, patch) {
  const next = { ...plan, ...patch }
  if (Number.isFinite(patch.floorHeight)) {
    next.walls = (plan.walls || []).map((wall) => (
      wall.heightCustom ? wall : { ...wall, height: patch.floorHeight }
    ))
  }
  if (Number.isFinite(patch.exteriorThickness)) {
    next.exteriorThickness = patch.exteriorThickness
    next.walls = (next.walls || []).map((wall) => (
      (wall.kind === 'exterior' || wall.kind === 'bearing') && !wall.thicknessCustom
        ? { ...wall, thickness: patch.exteriorThickness }
        : wall
    ))
  }
  return withRooms(next)
}

export function updateWall(plan, id, patch) {
  const requested = patch?.align
  const align = requested === 'left' || requested === 'right' || requested === 'center' ? requested : null
  return withRooms({
    ...plan,
    walls: (plan.walls || []).map((wall) => {
      if (wall.id !== id) return wall
      const next = { ...wall, ...patch, a: { ...wall.a }, b: { ...wall.b } }
      if (requested != null) next.align = align || 'center'
      return next
    }),
  })
}

export function wallNormal(wall) {
  const len = segmentLength(wall?.a, wall?.b) || 1
  return { x: -((wall?.b?.z || 0) - (wall?.a?.z || 0)) / len, z: ((wall?.b?.x || 0) - (wall?.a?.x || 0)) / len }
}

export function faceSide(wall, a, b) {
  if (!wall?.a || !wall?.b || !a || !b) return 'left'
  const dot = (b.x - a.x) * (wall.b.x - wall.a.x) + (b.z - a.z) * (wall.b.z - wall.a.z)
  return dot >= 0 ? 'left' : 'right'
}

export function roomForWallSide(plan, wall, side) {
  if (!wall) return null
  const rooms = visibleRooms(plan)
  const attached = rooms.find((room) => (room.walls || []).some((edge) => edge.wallId === wall.id && faceSide(wall, edge.a, edge.b) === side))
  if (attached) return attached
  const normal = wallNormal(wall)
  const sign = side === 'left' ? 1 : -1
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
  const half = thicknessOf(wall, plan) / 2 + 0.16
  return rooms.find((room) => pointInPolygon(mid.x + normal.x * sign * half, mid.z + normal.z * sign * half, room.polygon || []))
    || rooms.find((room) => pointInPolygon(mid.x + normal.x * sign * (half + 0.4), mid.z + normal.z * sign * (half + 0.4), room.gross || room.polygon || []))
    || null
}

export function wallFacePairs(plan, wall) {
  return {
    left: roomForWallSide(plan, wall, 'left'),
    right: roomForWallSide(plan, wall, 'right'),
  }
}

export function resolveFaceMaterial(plan, wall, side) {
  if (wall?.faces?.[side]) return wall.faces[side]
  const room = roomForWallSide(plan, wall, side)
  return room?.interiorId || 'paint'
}

export function setFaceMaterial(plan, wallId, side, materialId) {
  const wall = (plan.walls || []).find((item) => item.id === wallId)
  if (!wall || (side !== 'left' && side !== 'right')) return plan
  return updateWall(plan, wallId, { faces: { ...(wall.faces || {}), [side]: materialId } })
}

export function setRoomFaces(plan, roomId, materialId) {
  const room = (plan.rooms || []).find((item) => item.id === roomId)
  if (!room) return plan
  const extra = new Map()
  ;(room.walls || []).forEach((edge) => {
    const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
    if (!wall) return
    const side = faceSide(wall, edge.a, edge.b)
    const prev = extra.get(wall.id) || {}
    prev[side] = materialId
    extra.set(wall.id, prev)
  })
  return withRooms({
    ...plan,
    walls: (plan.walls || []).map((wall) => {
      const faces = extra.get(wall.id)
      if (!faces) return wall
      return { ...wall, faces: { ...(wall.faces || {}), ...faces } }
    }),
    rooms: (plan.rooms || []).map((item) => (item.id === roomId ? { ...item, interiorId: materialId } : item)),
  })
}

const WET_ROOMS = new Set(['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'])

export function defaultRoomSetpoint(type) {
  if (type === 'autotalli') return 5
  if (WET_ROOMS.has(type)) return 25
  return 21
}

export function applyRoomType(plan, roomId, typeId, name) {
  const room = (plan.rooms || []).find((item) => item.id === roomId)
  if (!room) return plan
  const edges = room.walls || []
  let next = updateRoom(plan, roomId, {
    type: typeId,
    name: name || room.name,
    setpoint: defaultRoomSetpoint(typeId),
  })
  if (typeId !== 'autotalli') return next
  const current = (next.rooms || []).find((item) => item.id === roomId) || room
  next = updateRoom(next, roomId, {
    floorId: !current.floorId || current.floorId === 'parquet' || current.floorId === 'laminate' ? 'concrete' : current.floorId,
    interiorId: current.interiorId === 'paint' || current.interiorId === 'wallpaper' || !current.interiorId ? 'gypsum' : current.interiorId,
  })
  edges.forEach((edge) => {
    if (edge.kind === 'exterior' || !edge.wallId) return
    const wall = (next.walls || []).find((item) => item.id === edge.wallId)
    if (!wall) return
    const side = faceSide(wall, edge.a, edge.b)
    const other = side === 'left' ? 'right' : 'left'
    const neighbor = roomForWallSide(next, wall, other)
    if (!neighbor || neighbor.id === roomId) return
    next = updateWall(next, wall.id, {
      structure: wall.structure || 'ei30',
      faces: { ...(wall.faces || {}), [side]: wall.faces?.[side] || 'gypsum' },
    })
  })
  return next
}

export function setWallLength(plan, id, metres) {
  const length = Math.max(0.2, Number(metres) || 0)
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return plan
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  return moveVertex(plan, wall.b, { x: wall.a.x + dx * length, z: wall.a.z + dz * length })
}

export function wallDirection(wall) {
  const deg = Math.atan2((wall?.b?.z || 0) - (wall?.a?.z || 0), (wall?.b?.x || 0) - (wall?.a?.x || 0)) * 180 / Math.PI
  return Math.round(((deg % 360) + 360) % 360)
}

export function setWallDirection(plan, id, degrees) {
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return plan
  const len = segmentLength(wall.a, wall.b)
  const rad = (Number(degrees) || 0) * Math.PI / 180
  return moveVertex(plan, wall.b, {
    x: wall.a.x + Math.cos(rad) * len,
    z: wall.a.z + Math.sin(rad) * len,
  })
}

export function cornerJoint(walls, point, radius = 0.28) {
  const groups = []
  ;(walls || []).forEach((wall) => {
    ;['a', 'b'].forEach((end) => {
      const at = wall[end]
      let group = groups.find((item) => nearPoint(item, at))
      if (!group) {
        group = { x: at.x, z: at.z, members: [] }
        groups.push(group)
      }
      group.members.push({ id: wall.id, end })
    })
  })
  let best = null
  groups.forEach((group) => {
    if (group.members.length < 2) return
    const dist = Math.hypot(group.x - (point?.x || 0), group.z - (point?.z || 0))
    if (dist <= radius && (!best || dist < best.dist)) best = { ...group, dist }
  })
  return best
}

function jointDirections(walls, joint) {
  return (joint?.members || []).map((member) => {
    const wall = (walls || []).find((item) => item.id === member.id)
    if (!wall) return null
    const far = member.end === 'a' ? wall.b : wall.a
    return {
      ...member,
      far,
      ang: Math.atan2(far.z - joint.z, far.x - joint.x),
    }
  }).filter(Boolean).sort((a, b) => a.ang - b.ang)
}

function interiorSector(dirs) {
  let best = null
  for (let i = 0; i < (dirs || []).length; i += 1) {
    const moving = dirs[(i + 1) % dirs.length]
    let sweep = moving.ang - dirs[i].ang
    if (sweep <= 0) sweep += Math.PI * 2
    const degrees = (sweep * 180) / Math.PI
    if (degrees <= 1 || degrees > 180.5) continue
    if (Math.abs(degrees - 180) < 2) continue
    if (!best || degrees < best.degrees) {
      best = { fixed: dirs[i], moving, sweep, degrees, start: dirs[i].ang }
    }
  }
  return best
}

export function cornerAngles(walls) {
  const marks = []
  const joints = []
  ;(walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((at) => {
      if (!at) return
      const joint = cornerJoint(walls, at, 0.08)
      if (!joint || joint.members.length < 2) return
      if (joints.some((item) => Math.hypot(item.x - joint.x, item.z - joint.z) < 0.08)) return
      joints.push(joint)
    })
  })
  joints.forEach((joint) => {
    const sector = interiorSector(jointDirections(walls, joint))
    if (!sector) return
    const degrees = Math.round(sector.degrees)
    if (degrees === 90) return
    marks.push({
      x: joint.x,
      z: joint.z,
      start: sector.start,
      sweep: sector.sweep,
      degrees,
    })
  })
  return marks
}

function moveWallEnd(plan, id, end, to) {
  const dest = weld(to)
  const walls = (plan.walls || []).map((wall) => (
    wall.id === id ? { ...wall, [end]: dest } : wall
  ))
  const openings = (plan.openings || []).map((opening) => {
    const wall = walls.find((item) => item.id === opening.wallId)
    if (!wall) return opening
    const len = segmentLength(wall.a, wall.b)
    const limit = Math.max(opening.width / 2 + 0.05, len - opening.width / 2 - 0.05)
    if (opening.offset <= limit) return opening
    return { ...opening, offset: Math.max(opening.width / 2 + 0.05, len / 2) }
  })
  return withRooms({ ...plan, walls, openings })
}

export function setCornerAngle(plan, corner, degrees) {
  const joint = cornerJoint(plan.walls, corner, 0.12)
  if (!joint || joint.members.length < 2) return plan
  const sector = interiorSector(jointDirections(plan.walls, joint))
  if (!sector) return plan
  const { fixed, moving } = sector
  const target = Math.max(1, Math.min(179, Number(degrees) || 90))
  const targetRad = (target * Math.PI) / 180
  if (Math.abs(targetRad - sector.sweep) < 1e-4) return plan
  const radius = Math.hypot(moving.far.x - joint.x, moving.far.z - joint.z)
  if (radius < 0.05) return plan
  const ray = { x: Math.cos(fixed.ang + targetRad), z: Math.sin(fixed.ang + targetRad) }
  const rotated = { x: joint.x + ray.x * radius, z: joint.z + ray.z * radius }
  const others = (plan.walls || []).filter((wall) => wall.id !== moving.id)
  const hosts = others.filter((wall) => (
    nearPoint(wall.a, moving.far) || nearPoint(wall.b, moving.far) || pointOnSegmentT(moving.far, wall.a, wall.b) != null
  ))
  const farEnd = moving.end === 'a' ? 'b' : 'a'
  if (!hosts.length) return moveWallEnd(plan, moving.id, farEnd, rotated)
  let best = null
  hosts.forEach((wall) => {
    const edge = { x: wall.b.x - wall.a.x, z: wall.b.z - wall.a.z }
    if (Math.hypot(edge.x, edge.z) < 0.05) return
    const hit = lineMeet({ x: joint.x, z: joint.z }, ray, wall.a, edge)
    if (!hit) return
    const forward = (hit.x - joint.x) * ray.x + (hit.z - joint.z) * ray.z
    if (forward < 0.2) return
    const len2 = edge.x * edge.x + edge.z * edge.z
    const t = ((hit.x - wall.a.x) * edge.x + (hit.z - wall.a.z) * edge.z) / len2
    if (t < -0.35 || t > 1.35) return
    const dist = Math.hypot(hit.x - moving.far.x, hit.z - moving.far.z)
    const score = (t >= -0.02 && t <= 1.02 ? 0 : 10) + dist
    if (!best || score < best.score) best = { hit, score }
  })
  if (!best) return plan
  const sharedEnd = others.some((wall) => nearPoint(wall.a, moving.far) || nearPoint(wall.b, moving.far))
  if (sharedEnd) return moveVertex(plan, moving.far, best.hit)
  return moveWallEnd(plan, moving.id, farEnd, best.hit)
}

export function straightenWalls(plan, toleranceDeg = 2) {
  const tol = (Number(toleranceDeg) > 0 ? Number(toleranceDeg) : 0) * Math.PI / 180
  const source = plan?.walls || []
  if (!source.length || tol <= 0) return plan
  let walls = source.map((wall) => ({
    ...wall,
    a: { x: wall.a.x, z: wall.a.z },
    b: { x: wall.b.x, z: wall.b.z },
  }))
  for (let pass = 0; pass < 3; pass += 1) {
    const nodes = []
    const adopt = (point) => {
      const found = nodes.findIndex((node) => nearPoint(node, point, 0.08))
      if (found >= 0) return found
      nodes.push({ x: point.x, z: point.z })
      return nodes.length - 1
    }
    const ends = walls.map((wall) => ({ wall, a: adopt(wall.a), b: adopt(wall.b) }))
    const parentX = nodes.map((_, index) => index)
    const parentZ = nodes.map((_, index) => index)
    const find = (parent, index) => {
      let root = index
      while (parent[root] !== root) root = parent[root]
      parent[index] = root
      return root
    }
    const unite = (parent, i, j) => {
      const left = find(parent, i)
      const right = find(parent, j)
      if (left !== right) parent[right] = left
    }
    ends.forEach(({ wall, a, b }) => {
      const dx = wall.b.x - wall.a.x
      const dz = wall.b.z - wall.a.z
      if (Math.hypot(dx, dz) < 0.05) return
      const ang = Math.atan2(dz, dx)
      const nearest = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2)
      let diff = ang - nearest
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      if (Math.abs(diff) > tol) return
      if (Math.abs(Math.cos(nearest)) < 0.5) unite(parentX, a, b)
      else unite(parentZ, a, b)
    })
    const valueFor = (parent, axis) => {
      const groups = new Map()
      nodes.forEach((node, index) => {
        const root = find(parent, index)
        if (!groups.has(root)) groups.set(root, [])
        groups.get(root).push(index)
      })
      const out = new Map()
      groups.forEach((ids) => {
        if (ids.length < 2) return
        const avg = ids.reduce((sum, index) => sum + nodes[index][axis], 0) / ids.length
        const rounded = Math.round(avg * 1000) / 1000
        ids.forEach((index) => out.set(index, rounded))
      })
      return out
    }
    const xOf = valueFor(parentX, 'x')
    const zOf = valueFor(parentZ, 'z')
    walls = ends.map(({ wall, a, b }) => ({
      ...wall,
      a: weld({ x: xOf.has(a) ? xOf.get(a) : wall.a.x, z: zOf.has(a) ? zOf.get(a) : wall.a.z }),
      b: weld({ x: xOf.has(b) ? xOf.get(b) : wall.b.x, z: zOf.has(b) ? zOf.get(b) : wall.b.z }),
    }))
  }
  const same = walls.every((wall, index) => (
    wall.a.x === source[index].a.x && wall.a.z === source[index].a.z
    && wall.b.x === source[index].b.x && wall.b.z === source[index].b.z
  ))
  if (same) return plan
  const openings = (plan.openings || []).map((opening) => {
    const wall = walls.find((item) => item.id === opening.wallId)
    if (!wall) return opening
    const len = segmentLength(wall.a, wall.b)
    const limit = Math.max(opening.width / 2 + 0.05, len - opening.width / 2 - 0.05)
    if (opening.offset <= limit) return opening
    return { ...opening, offset: Math.max(opening.width / 2 + 0.05, len / 2) }
  })
  return withRooms({ ...plan, walls, openings })
}

export function moveCorner(plan, from, to) {
  return moveVertex(plan, from, to)
}

export function nearestEndpoint(walls, point, radius = 0.2) {
  let best = null
  ;(walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((end) => {
      const dist = Math.hypot((end?.x || 0) - (point?.x || 0), (end?.z || 0) - (point?.z || 0))
      if (dist <= radius && (!best || dist < best.dist)) best = { x: end.x, z: end.z, dist }
    })
  })
  return best
}

function moveVertex(plan, from, to) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.hypot(dx, dz) < 1e-6) return plan
  const walls = (plan.walls || []).map((wall) => ({
    ...wall,
    a: nearPoint(wall.a, from) ? weld({ x: wall.a.x + dx, z: wall.a.z + dz }) : wall.a,
    b: nearPoint(wall.b, from) ? weld({ x: wall.b.x + dx, z: wall.b.z + dz }) : wall.b,
  }))
  const openings = (plan.openings || []).map((opening) => {
    const wall = walls.find((item) => item.id === opening.wallId)
    if (!wall) return opening
    const len = segmentLength(wall.a, wall.b)
    const limit = Math.max(opening.width / 2 + 0.05, len - opening.width / 2 - 0.05)
    if (opening.offset <= limit) return opening
    return { ...opening, offset: Math.max(opening.width / 2 + 0.05, len / 2) }
  })
  return withRooms({ ...plan, walls, openings })
}

export function splitWall(plan, id, point) {
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return plan
  const hit = nearestWall([wall], point, 2)
  if (!hit || hit.t < 0.08 || hit.t > 0.92) return plan
  const len = segmentLength(wall.a, wall.b)
  const splitAt = hit.t * len
  const mid = weld({ x: hit.x, z: hit.z })
  const issued = issue(plan, 'wall')
  const walls = (plan.walls || []).flatMap((item) => (
    item.id === id
      ? [{ ...item, b: mid }, { ...item, id: issued.id, a: mid }]
      : [item]
  ))
  const openings = (plan.openings || []).map((opening) => {
    if (opening.wallId !== id || opening.offset <= splitAt) return opening
    return { ...opening, wallId: issued.id, offset: opening.offset - splitAt }
  })
  return withRooms({ ...plan, seq: issued.seq, walls, openings })
}

export function splitWallAt(plan, id, metres) {
  const wall = (plan.walls || []).find((item) => item.id === id)
  if (!wall) return plan
  const len = segmentLength(wall.a, wall.b)
  const distance = Number(metres)
  if (!Number.isFinite(distance) || distance < 0.15 || distance > len - 0.15) return plan
  const t = distance / len
  return splitWall(plan, id, {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  })
}

export function facadeSide(wall, bounds) {
  const box = bounds || planBounds({ walls: [wall] })
  const midX = (wall.a.x + wall.b.x) / 2
  const midZ = (wall.a.z + wall.b.z) / 2
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  let nx = -dz
  let nz = dx
  if (nx * (midX - cx) + nz * (midZ - cz) < 0) {
    nx = -nx
    nz = -nz
  }
  if (Math.abs(nx) >= Math.abs(nz)) return nx >= 0 ? 'east' : 'west'
  return nz >= 0 ? 'south' : 'north'
}

export function zoneCovering(plan, wall, distance, y) {
  if (!wall || wall.kind === 'interior') return null
  const box = planBounds(plan)
  const side = facadeSide(wall, box)
  const len = segmentLength(wall.a, wall.b) || 1
  const u = projectAlong(wall, (Number(distance) || 0) / len, side, box)
  const height = Number(y) || 0
  return (plan.facades || []).find((zone) => (
    zone.side === side
    && u >= zone.u0 - 0.05
    && u <= zone.u1 + 0.05
    && height >= zone.y0 - 0.05
    && height <= zone.y1 + 0.05
  )) || null
}

function projectAlong(wall, t, side, box) {
  const x = wall.a.x + (wall.b.x - wall.a.x) * t
  const z = wall.a.z + (wall.b.z - wall.a.z) * t
  const horizontal = side === 'north' || side === 'south'
  const flip = side === 'south' || side === 'west'
  const value = horizontal ? x : z
  const start = horizontal ? box.minX : box.minZ
  const end = horizontal ? box.maxX : box.maxZ
  return flip ? end - value : value - start
}

function openingHeights(opening, top) {
  if (opening.kind === 'window') {
    const sill = Number.isFinite(opening.sill) ? opening.sill : 0.9
    const head = Math.min(top, sill + (opening.height || 1.2))
    return { y0: sill, y1: Math.max(sill + 0.05, head) }
  }
  const head = Math.min(top, opening.height || 2.1)
  return { y0: Number.isFinite(opening.sill) ? opening.sill : 0, y1: head }
}

export function wallCladdingId(wall, plan) {
  if (wall?.materialId && (CLADDING.some((item) => item.id === wall.materialId) || LEGACY_CLADDING[wall.materialId])) {
    return claddingOf(wall.materialId).id
  }
  return claddingOf(plan?.exteriorId).id
}

export function facadeLayout(plan, side = 'north') {
  const box = planBounds(plan)
  const length = (side === 'north' || side === 'south') ? Math.max(0.1, box.maxX - box.minX) : Math.max(0.1, box.maxZ - box.minZ)
  const walls = (plan.walls || [])
    .filter((wall) => wall.kind !== 'interior' && !wallBuried(wall, plan.rooms) && facadeSide(wall, box) === side)
    .map((wall) => {
      const uA = projectAlong(wall, 0, side, box)
      const uB = projectAlong(wall, 1, side, box)
      return {
        wall,
        u0: Math.min(uA, uB),
        u1: Math.max(uA, uB),
        top: wall.height || plan.floorHeight || WALL_HEIGHT,
      }
    })
    .sort((a, b) => a.u0 - b.u0)
  const height = Math.max(plan.floorHeight || WALL_HEIGHT, ...walls.map((entry) => entry.top), 0.1)
  const openings = []
  walls.forEach((entry) => {
    const len = segmentLength(entry.wall.a, entry.wall.b) || 1
    ;(plan.openings || []).filter((opening) => opening.wallId === entry.wall.id).forEach((opening) => {
      const t0 = (opening.offset - opening.width / 2) / len
      const t1 = (opening.offset + opening.width / 2) / len
      const ua = projectAlong(entry.wall, t0, side, box)
      const ub = projectAlong(entry.wall, t1, side, box)
      const vertical = openingHeights(opening, entry.top)
      openings.push({
        ...opening,
        u0: Math.min(ua, ub),
        u1: Math.max(ua, ub),
        y0: vertical.y0,
        y1: vertical.y1,
      })
    })
  })
  const compass = sideCompass(side, northAngle(plan))
  return {
    side,
    compass,
    name: translate(plan?.locale || 'fi', `compass.${compass}`),
    length,
    height,
    walls,
    openings,
    zones: (plan.facades || []).filter((zone) => zone.side === side),
  }
}

function stampRects(rects, box, materialId, extra = {}) {
  const next = []
  rects.forEach((rect) => {
    const u0 = Math.max(rect.u0, box.u0)
    const u1 = Math.min(rect.u1, box.u1)
    const y0 = Math.max(rect.y0, box.y0)
    const y1 = Math.min(rect.y1, box.y1)
    if (u1 - u0 <= 1e-4 || y1 - y0 <= 1e-4) {
      next.push(rect)
      return
    }
    if (rect.u0 < u0 - 1e-4) next.push({ ...rect, u1: u0 })
    if (rect.u1 > u1 + 1e-4) next.push({ ...rect, u0: u1 })
    if (rect.y0 < y0 - 1e-4) next.push({ ...rect, u0, u1, y1: y0 })
    if (rect.y1 > y1 + 1e-4) next.push({ ...rect, u0, u1, y0: y1 })
    if (materialId) next.push({ u0, u1, y0, y1, materialId, color: extra.color || '', colorCode: extra.colorCode || '' })
  })
  return next
}

function zoneOnWall(wall, side, box, zone) {
  const len = segmentLength(wall.a, wall.b) || 1
  const uA = projectAlong(wall, 0, side, box)
  const uB = projectAlong(wall, 1, side, box)
  const lo = Math.min(uA, uB)
  const hi = Math.max(uA, uB)
  const z0 = Math.max(zone.u0, lo)
  const z1 = Math.min(zone.u1, hi)
  if (z1 - z0 <= 1e-4) return null
  const tOf = (u) => (Math.abs(uB - uA) < 1e-6 ? 0 : (u - uA) / (uB - uA))
  const a = tOf(z0) * len
  const b = tOf(z1) * len
  return {
    u0: Math.max(0, Math.min(a, b)),
    u1: Math.min(len, Math.max(a, b)),
    y0: zone.y0,
    y1: zone.y1,
  }
}

export function wallPaint(wall, plan) {
  if (!wall || wall.kind === 'interior' || wallBuried(wall, plan?.rooms)) return []
  const box = planBounds(plan)
  const side = facadeSide(wall, box)
  const len = segmentLength(wall.a, wall.b)
  const top = wall.height || plan.floorHeight || WALL_HEIGHT
  let rects = [{ u0: 0, u1: len, y0: 0, y1: top, materialId: wallCladdingId(wall, plan) }]
  ;(plan.facades || []).filter((zone) => zone.side === side).forEach((zone) => {
    const local = zoneOnWall(wall, side, box, zone)
    if (local) rects = stampRects(rects, local, claddingOf(zone.materialId).id, { color: zone.color || '', colorCode: zone.colorCode || '' })
  })
  ;(plan.openings || []).filter((opening) => opening.wallId === wall.id).forEach((opening) => {
    const vertical = openingHeights(opening, top)
    rects = stampRects(rects, {
      u0: opening.offset - opening.width / 2,
      u1: opening.offset + opening.width / 2,
      y0: vertical.y0,
      y1: vertical.y1,
    }, null)
  })
  return rects.map((rect) => ({ ...rect, wallId: wall.id, side }))
}

export function claddingCoverage(plan) {
  return (plan.walls || []).flatMap((wall) => wallPaint(wall, plan))
}

export function facadePaints(plan, side) {
  const box = planBounds(plan)
  return (plan.walls || [])
    .filter((wall) => wall.kind !== 'interior' && !wallBuried(wall, plan.rooms) && facadeSide(wall, box) === side)
    .flatMap((wall) => {
      const len = segmentLength(wall.a, wall.b) || 1
      return wallPaint(wall, plan).map((piece) => {
        const u0 = projectAlong(wall, piece.u0 / len, side, box)
        const u1 = projectAlong(wall, piece.u1 / len, side, box)
        return { ...piece, u0: Math.min(u0, u1), u1: Math.max(u0, u1) }
      })
    })
}

export function claddingAreas(plan) {
  const rows = []
  claddingCoverage(plan).forEach((piece) => {
    if (!piece.materialId) return
    const area = Math.max(0, piece.u1 - piece.u0) * Math.max(0, piece.y1 - piece.y0)
    if (area < 0.005) return
    const item = claddingOf(piece.materialId)
    const look = surfaceLook(plan, item.id, { color: piece.color, colorCode: piece.colorCode })
    const key = `${item.id}:${look.color}:${look.code}`
    const found = rows.find((row) => row.key === key)
    if (found) found.area += area
    else rows.push({ key, id: item.id, name: item.name, group: item.group, color: look.color, code: look.code, pattern: look.pattern, painted: look.painted, area })
  })
  return rows.sort((a, b) => b.area - a.area)
}

export function wallCladdingPieces(wall, plan) {
  const paints = wallPaint(wall, plan)
  const parts = wallPieces(wall, plan.openings, plan.floorHeight || WALL_HEIGHT, plan.walls, plan)
  const len = segmentLength(wall.a, wall.b) || 1
  const fallback = wallCladdingId(wall, plan)
  return parts.flatMap((part) => {
    const cutsU = [part.from, part.to]
    const cutsY = [part.y0, part.y1]
    paints.forEach((paint) => {
      if (paint.u0 > part.from + 1e-3 && paint.u0 < part.to - 1e-3) cutsU.push(paint.u0)
      if (paint.u1 > part.from + 1e-3 && paint.u1 < part.to - 1e-3) cutsU.push(paint.u1)
      if (paint.y0 > part.y0 + 1e-3 && paint.y0 < part.y1 - 1e-3) cutsY.push(paint.y0)
      if (paint.y1 > part.y0 + 1e-3 && paint.y1 < part.y1 - 1e-3) cutsY.push(paint.y1)
    })
    const uniq = (values) => [...new Set(values.map((value) => Math.round(value * 1000) / 1000))].sort((a, b) => a - b)
    const xs = uniq(cutsU)
    const ys = uniq(cutsY)
    const pieces = []
    for (let i = 0; i < xs.length - 1; i += 1) {
      for (let j = 0; j < ys.length - 1; j += 1) {
        const midU = Math.max(0, Math.min(len - 0.001, (xs[i] + xs[i + 1]) / 2))
        const midY = (ys[j] + ys[j + 1]) / 2
        const paint = paints.find((item) => midU >= item.u0 - 1e-3 && midU <= item.u1 + 1e-3 && midY >= item.y0 - 1e-3 && midY <= item.y1 + 1e-3)
        pieces.push({
          from: xs[i],
          to: xs[i + 1],
          y0: ys[j],
          y1: ys[j + 1],
          materialId: paint?.materialId || fallback,
          color: paint?.color || '',
          colorCode: paint?.colorCode || '',
        })
      }
    }
    return pieces
  })
}

export function addFacadeZone(plan, side, zone) {
  const issued = issue(plan, 'facade')
  const u0 = Math.min(zone.u0, zone.u1)
  const u1 = Math.max(zone.u0, zone.u1)
  const y0 = Math.max(0, Math.min(zone.y0, zone.y1))
  const y1 = Math.max(zone.y0, zone.y1)
  if (u1 - u0 < 0.05 || y1 - y0 < 0.05) return plan
  return {
    ...plan,
    seq: issued.seq,
    facades: [...(plan.facades || []), {
      id: issued.id,
      side,
      u0,
      u1,
      y0,
      y1,
      materialId: claddingOf(zone.materialId).id,
      color: zone.color || '',
      colorCode: zone.colorCode || '',
    }],
  }
}

export function updateFacadeZone(plan, id, patch) {
  return {
    ...plan,
    facades: (plan.facades || []).map((zone) => (zone.id === id ? { ...zone, ...patch, materialId: patch.materialId ? claddingOf(patch.materialId).id : zone.materialId } : zone)),
  }
}

export function deleteFacadeZone(plan, id) {
  return { ...plan, facades: (plan.facades || []).filter((zone) => zone.id !== id) }
}

export function addFacadeBand(plan, side, y0, y1, materialId) {
  const layout = facadeLayout(plan, side)
  return addFacadeZone(plan, side, { u0: 0, u1: layout.length, y0, y1, materialId })
}

export function applyFacadePreset(plan, side, preset, materialId) {
  const layout = facadeLayout(plan, side)
  const windows = layout.openings.filter((opening) => opening.kind === 'window')
  const heads = layout.openings.map((opening) => opening.y1)
  const sills = windows.map((opening) => opening.y0)
  const head = heads.length ? Math.max(...heads) : 2.1
  const sill = sills.length ? Math.min(...sills) : 0.9
  const windowHead = windows.length ? Math.max(...windows.map((opening) => opening.y1)) : sill + 1.2
  if (preset === 'above') {
    return addFacadeZone(plan, side, { u0: 0, u1: layout.length, y0: head, y1: layout.height, materialId: materialId || 'wood-horizontal' })
  }
  if (preset === 'plinth') {
    return addFacadeZone(plan, side, { u0: 0, u1: layout.length, y0: 0, y1: sill, materialId: materialId || 'brick-red' })
  }
  if (preset === 'band') {
    return addFacadeZone(plan, side, { u0: 0, u1: layout.length, y0: sill, y1: windowHead, materialId: materialId || 'brick-white' })
  }
  return plan
}

export function applyBrickBelowWoodAbove(plan, side, below = 'brick-red') {
  const layout = facadeLayout(plan, side)
  let next = plan
  const brick = claddingOf(below).id
  layout.walls.forEach((entry) => {
    next = updateWall(next, entry.wall.id, { materialId: brick })
  })
  const fresh = facadeLayout(next, side)
  const head = fresh.openings.length ? Math.max(...fresh.openings.map((opening) => opening.y1)) : 2.1
  next = {
    ...next,
    facades: (next.facades || []).filter((zone) => !(zone.side === side && zone.y0 >= head - 0.05 && zone.materialId === 'wood-horizontal')),
  }
  return addFacadeZone(next, side, {
    u0: 0,
    u1: fresh.length,
    y0: head,
    y1: fresh.height,
    materialId: 'wood-horizontal',
  })
}

function uniqCuts(values, tol = 0.03) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const out = []
  sorted.forEach((value) => {
    const rounded = Math.round(value * 1000) / 1000
    if (!out.length || rounded - out[out.length - 1] > tol) out.push(rounded)
  })
  return out
}

function gap1d(a0, a1, b0, b1) {
  if (a1 < b0) return b0 - a1
  if (b1 < a0) return a0 - b1
  return 0
}

function sameFinish(a, b) {
  return a.materialId === b.materialId
    && (a.color || '') === (b.color || '')
    && (a.colorCode || '') === (b.colorCode || '')
    && Math.abs((a.plane ?? 0) - (b.plane ?? 0)) < 0.03
}

export function mergeFacadeRects(rects) {
  let items = (rects || [])
    .filter((rect) => rect?.materialId && rect.u1 - rect.u0 > 0.015 && rect.y1 - rect.y0 > 0.015)
    .map((rect) => ({ ...rect }))
  let guard = 0
  let changed = true
  while (changed && guard < 48) {
    changed = false
    guard += 1
    const next = []
    const used = new Array(items.length).fill(false)
    for (let i = 0; i < items.length; i += 1) {
      if (used[i]) continue
      let cur = items[i]
      for (let j = 0; j < items.length; j += 1) {
        if (i === j || used[j]) continue
        const other = items[j]
        if (!sameFinish(cur, other)) continue
        const horizontal = Math.abs(cur.y0 - other.y0) < 0.025 && Math.abs(cur.y1 - other.y1) < 0.025 && gap1d(cur.u0, cur.u1, other.u0, other.u1) < 0.04
        const vertical = Math.abs(cur.u0 - other.u0) < 0.025 && Math.abs(cur.u1 - other.u1) < 0.025 && gap1d(cur.y0, cur.y1, other.y0, other.y1) < 0.04
        if (!horizontal && !vertical) continue
        cur = {
          ...cur,
          u0: Math.min(cur.u0, other.u0),
          u1: Math.max(cur.u1, other.u1),
          y0: Math.min(cur.y0, other.y0),
          y1: Math.max(cur.y1, other.y1),
        }
        used[j] = true
        changed = true
      }
      used[i] = true
      next.push(cur)
    }
    items = next
  }
  return items
}

function outwardOf(wall, box) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  let nx = -dz
  let nz = dx
  const midX = (wall.a.x + wall.b.x) / 2
  const midZ = (wall.a.z + wall.b.z) / 2
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  if (nx * (midX - cx) + nz * (midZ - cz) < 0) {
    nx = -nx
    nz = -nz
  }
  return { nx, nz, depth: Math.round((midX * nx + midZ * nz) * 1000) / 1000 }
}

export function facadeCells(plan, side = 'north') {
  const layout = facadeLayout(plan, side)
  const splits = (plan.facadeSplits || []).filter((item) => item.side === side)
  const ys = uniqCuts([
    0,
    layout.height,
    ...layout.openings.flatMap((opening) => [opening.y0, opening.y1]),
    ...(layout.zones || []).flatMap((zone) => [zone.y0, zone.y1]),
    ...splits.filter((item) => item.axis !== 'v').map((item) => item.at),
  ])
  const us = uniqCuts([
    0,
    layout.length,
    ...layout.openings.flatMap((opening) => [opening.u0, opening.u1]),
    ...(layout.zones || []).flatMap((zone) => [zone.u0, zone.u1]),
    ...splits.filter((item) => item.axis === 'v').map((item) => item.at),
  ])
  const paints = facadePaints(plan, side)
  const cells = []
  for (let i = 0; i < us.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const u0 = us[i]
      const u1 = us[i + 1]
      const y0 = ys[j]
      const y1 = ys[j + 1]
      if (u1 - u0 < 0.04 || y1 - y0 < 0.04) continue
      const cu = (u0 + u1) / 2
      const cy = (y0 + y1) / 2
      const inside = layout.openings.some((opening) => cu > opening.u0 + 0.02 && cu < opening.u1 - 0.02 && cy > opening.y0 + 0.02 && cy < opening.y1 - 0.02)
      if (inside) continue
      const paint = paints.find((piece) => cu >= piece.u0 - 0.02 && cu <= piece.u1 + 0.02 && cy >= piece.y0 - 0.02 && cy <= piece.y1 + 0.02)
      if (!paint?.materialId) continue
      const zone = [...(layout.zones || [])].reverse().find((item) => cu >= item.u0 - 0.02 && cu <= item.u1 + 0.02 && cy >= item.y0 - 0.02 && cy <= item.y1 + 0.02)
      cells.push({
        id: `cell-${side}-${Math.round(u0 * 1000)}-${Math.round(y0 * 1000)}`,
        side,
        u0,
        u1,
        y0,
        y1,
        materialId: paint.materialId,
        color: paint.color || zone?.color || '',
        colorCode: paint.colorCode || zone?.colorCode || '',
        zoneId: zone?.id || null,
      })
    }
  }
  return cells
}

export function mergedFacadeSkins(plan) {
  const box = planBounds(plan)
  const skins = []
  FACADE_SIDES.forEach(({ id: side }) => {
    const tagged = facadePaints(plan, side).map((piece) => {
      const wall = (plan.walls || []).find((item) => item.id === piece.wallId)
      const face = wall ? outwardOf(wall, box) : { nx: 0, nz: 1, depth: 0 }
      return { ...piece, plane: face.depth, nx: face.nx, nz: face.nz }
    })
    const planes = [...new Set(tagged.map((item) => item.plane))]
    planes.forEach((plane) => {
      const group = tagged.filter((item) => item.plane === plane)
      const sample = group[0]
      mergeFacadeRects(group).forEach((rect) => {
        skins.push({
          ...rect,
          side,
          plane,
          nx: sample.nx,
          nz: sample.nz,
        })
      })
    })
  })
  return skins
}

export function facadeFlashings(plan) {
  const skins = mergedFacadeSkins(plan)
  const joints = []
  for (let i = 0; i < skins.length; i += 1) {
    for (let j = i + 1; j < skins.length; j += 1) {
      const a = skins[i]
      const b = skins[j]
      if (a.side !== b.side || Math.abs((a.plane || 0) - (b.plane || 0)) > 0.03) continue
      if (a.materialId === b.materialId && (a.color || '') === (b.color || '')) continue
      let lower = null
      let upper = null
      if (Math.abs(a.y1 - b.y0) <= 0.03 && a.y0 <= b.y0) {
        lower = a
        upper = b
      } else if (Math.abs(b.y1 - a.y0) <= 0.03 && b.y0 <= a.y0) {
        lower = b
        upper = a
      }
      if (!lower || !upper) continue
      const u0 = Math.max(lower.u0, upper.u0)
      const u1 = Math.min(lower.u1, upper.u1)
      if (u1 - u0 < 0.05) continue
      joints.push({
        side: a.side,
        u0,
        u1,
        y: lower.y1,
        plane: a.plane,
        nx: a.nx,
        nz: a.nz,
        below: lower.materialId,
        above: upper.materialId,
      })
    }
  }
  return joints
}

export function facadeWorld(plan, side, u, plane, nx, nz, offset = 0) {
  const box = planBounds(plan)
  let x
  let z
  if (side === 'north' || side === 'south') {
    x = side === 'south' ? box.maxX - u : box.minX + u
    z = Math.abs(nz) > 0.2 ? (plane - x * nx) / nz : (side === 'north' ? box.minZ : box.maxZ)
  } else {
    z = side === 'west' ? box.maxZ - u : box.minZ + u
    x = Math.abs(nx) > 0.2 ? (plane - z * nz) / nx : (side === 'east' ? box.maxX : box.minX)
  }
  return { x: x + nx * offset, z: z + nz * offset }
}

export function facadeHitFromWorld(plan, point) {
  if (!point) return null
  const box = planBounds(plan)
  let best = null
  ;(plan.walls || []).forEach((wall) => {
    if (wall.kind === 'interior' || wall.kind === 'partition') return
    const len = segmentLength(wall.a, wall.b)
    if (len < 0.2) return
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)))
    const x = wall.a.x + dx * t
    const z = wall.a.z + dz * t
    const dist = Math.hypot(point.x - x, point.z - z)
    if (dist > 0.45 || (best && dist >= best.dist)) return
    const side = facadeSide(wall, box)
    best = { dist, side, u: projectAlong(wall, t, side, box), y: Math.max(0, point.y || 0) }
  })
  return best ? { side: best.side, u: best.u, y: best.y } : null
}

export function addFacadeSplit(plan, side, axis, at) {
  const layout = facadeLayout(plan, side)
  const vertical = axis === 'v'
  const value = Number(at)
  const limit = vertical ? layout.length : layout.height
  if (!Number.isFinite(value) || value < 0.08 || value > limit - 0.08) return plan
  const kind = vertical ? 'v' : 'h'
  if ((plan.facadeSplits || []).some((item) => item.side === side && item.axis === kind && Math.abs(item.at - value) < 0.04)) return plan
  const issued = issue(plan, 'split')
  return {
    ...plan,
    seq: issued.seq,
    facadeSplits: [...(plan.facadeSplits || []), { id: issued.id, side, axis: kind, at: Math.round(value * 1000) / 1000 }],
  }
}

export function assignFacadeCell(plan, cell, patch = {}) {
  if (!cell?.side) return plan
  const materialId = patch.materialId || cell.materialId
  const match = (plan.facades || []).find((zone) => (
    zone.side === cell.side
    && Math.abs(zone.u0 - cell.u0) < 0.04
    && Math.abs(zone.u1 - cell.u1) < 0.04
    && Math.abs(zone.y0 - cell.y0) < 0.04
    && Math.abs(zone.y1 - cell.y1) < 0.04
  ))
  if (match) return updateFacadeZone(plan, match.id, { ...patch, materialId })
  if (cell.zoneId && (plan.facades || []).some((zone) => zone.id === cell.zoneId)) {
    const zone = plan.facades.find((item) => item.id === cell.zoneId)
    const exact = zone && Math.abs(zone.u0 - cell.u0) < 0.04 && Math.abs(zone.u1 - cell.u1) < 0.04 && Math.abs(zone.y0 - cell.y0) < 0.04 && Math.abs(zone.y1 - cell.y1) < 0.04
    if (exact) return updateFacadeZone(plan, cell.zoneId, { ...patch, materialId })
  }
  return addFacadeZone(plan, cell.side, {
    u0: cell.u0,
    u1: cell.u1,
    y0: cell.y0,
    y1: cell.y1,
    materialId,
    color: patch.color,
    colorCode: patch.colorCode,
  })
}

export function deleteWall(plan, id) {
  const walls = (plan.walls || []).filter((wall) => wall.id !== id)
  return withRooms({
    ...plan,
    walls,
    openings: (plan.openings || []).filter((opening) => opening.wallId !== id),
  })
}

export function moveOpening(plan, id, point) {
  const opening = (plan.openings || []).find((item) => item.id === id)
  const wall = (plan.walls || []).find((item) => item.id === opening?.wallId)
  if (!opening || !wall) return plan
  const placed = placeOpening(wall, point, opening.kind)
  if (!placed) return plan
  return updateOpening(plan, id, { offset: placed.offset })
}

export function updateOpening(plan, id, patch) {
  const openings = (plan.openings || []).map((opening) => (opening.id === id ? { ...opening, ...patch } : opening))
  const next = { ...plan, openings }
  const opening = openings.find((item) => item.id === id)
  if (opening?.kind === 'passage' && (Object.prototype.hasOwnProperty.call(patch, 'mergeSpaces') || Object.prototype.hasOwnProperty.call(patch, 'offset') || Object.prototype.hasOwnProperty.call(patch, 'width'))) {
    return withRooms(next)
  }
  return next
}

export function flipOpening(plan, id) {
  const opening = (plan.openings || []).find((item) => item.id === id)
  if (!opening) return plan
  return updateOpening(plan, id, { swing: -(opening.swing || 1) })
}

export function deleteOpening(plan, id) {
  const removed = (plan.openings || []).find((opening) => opening.id === id)
  const next = { ...plan, openings: (plan.openings || []).filter((opening) => opening.id !== id) }
  if (removed?.kind === 'passage') return withRooms(next)
  return next
}

export function updateRoom(plan, id, patch) {
  return {
    ...plan,
    rooms: (plan.rooms || []).map((room) => (room.id === id ? { ...room, ...patch } : room)),
  }
}

export function deleteRoom(plan, id) {
  const room = (plan.rooms || []).find((item) => item.id === id)
  if (!room) return plan
  if (room.drawId) {
    const walls = (plan.walls || []).filter((wall) => wall.drawId !== room.drawId)
    return withRooms({
      ...plan,
      walls,
      openings: (plan.openings || []).filter((opening) => walls.some((wall) => wall.id === opening.wallId)),
    })
  }
  return updateRoom(plan, id, { suppressed: true, showLabel: false })
}

export function visibleRooms(plan) {
  return (plan.rooms || []).filter((room) => !room.suppressed)
}

export function updateFixture(plan, id, patch) {
  return {
    ...plan,
    fixtures: (plan.fixtures || []).map((fixture) => (fixture.id === id ? { ...fixture, ...patch } : fixture)),
  }
}

export function mirrorFixture(plan, id) {
  const fixture = (plan.fixtures || []).find((item) => item.id === id)
  if (!fixture) return plan
  return updateFixture(plan, id, { mirror: !fixture.mirror })
}

function furnishKind(room) {
  const fold = (value) => String(value || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
  const type = fold(room?.type)
  const known = ['olohuone', 'keittio', 'makuuhuone', 'wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone', 'eteinen', 'tyohuone', 'autotalli']
  if (known.includes(type)) return type
  const name = fold(room?.name)
  if (name.includes('tyohuone')) return 'tyohuone'
  if (name.includes('autotalli')) return 'autotalli'
  if (name.includes('olohuone')) return 'olohuone'
  if (name.includes('keitt')) return 'keittio'
  if (name.includes('makuu')) return 'makuuhuone'
  if (name.includes('kodinhoito')) return 'kodinhoitohuone'
  if (name.includes('eteinen')) return 'eteinen'
  if (name.includes('kylpy')) return 'kylpyhuone'
  if (name.includes('sauna')) return 'sauna'
  if (name === 'wc' || name.includes('wc')) return 'wc'
  return type
}

function roomBox(poly) {
  return (poly || []).reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

export function furnishRoom(plan, roomId) {
  const room = (plan.rooms || []).find((item) => item.id === roomId)
  if (!room) return plan
  const poly = room.polygon || room.gross || []
  if (poly.length < 3) return plan
  const layout = layoutFor(furnishKind(room))
  if (!layout.length) return plan
  const box = roomBox(poly)
  const spanX = box.maxX - box.minX
  const spanZ = box.maxZ - box.minZ
  if (spanX < 0.6 || spanZ < 0.6) return plan
  let next = {
    ...plan,
    fixtures: (plan.fixtures || []).filter((item) => !pointInPolygon(item.x, item.z, poly)),
  }
  layout.forEach((entry) => {
    const tpl = fixtureTemplate(entry.type)
    const variant = variantOf(tpl, entry.variant)
    const w = variant?.w || tpl.w
    const d = variant?.d || tpl.d
    const h = variant?.h || tpl.h
    if (w > spanX + 0.15 || d > spanZ + 0.15) return
    let x = box.minX + spanX * (entry.x ?? 0.5)
    let z = box.minZ + spanZ * (entry.z ?? 0.5)
    let rotation = entry.rotation || 0
    const pad = 0.05
    const nudge = entry.nudge || 0
    const t = entry.t ?? 0.5
    if (entry.side === 's') {
      x = box.minX + spanX * t
      z = box.minZ + d / 2 + pad + nudge
      rotation = 0
    } else if (entry.side === 'n') {
      x = box.minX + spanX * t
      z = box.maxZ - d / 2 - pad - nudge
      rotation = 180
    } else if (entry.side === 'w') {
      x = box.minX + d / 2 + pad + nudge
      z = box.minZ + spanZ * t
      rotation = 90
    } else if (entry.side === 'e') {
      x = box.maxX - d / 2 - pad - nudge
      z = box.minZ + spanZ * t
      rotation = -90
    }
    if (!pointInPolygon(x, z, poly)) return
    const before = next.fixtures.length
    next = addFixture(next, entry.type, x, z, 0)
    const created = next.fixtures[before]
    next = updateFixture(next, created.id, {
      x: Math.round(x * 1000) / 1000,
      z: Math.round(z * 1000) / 1000,
      rotation,
      variant: variant?.id,
      w,
      d,
      h,
      ...(entry.flue ? { flue: entry.flue } : {}),
      ...(entry.flues ? { flues: entry.flues } : {}),
      ...(entry.shield === false ? { shield: false } : {}),
    })
  })
  return next
}

export function furnishAll(plan) {
  return visibleRooms(plan).reduce((current, room) => furnishRoom(current, room.id), plan)
}

function distToSegment(point, wall) {
  const hit = nearestWall([wall], point, 8)
  return hit ? hit.dist : Infinity
}

function alongExisting(a, b, walls) {
  const len = segmentLength(a, b)
  if (len < 0.2) return true
  return (walls || []).some((wall) => {
    const half = thicknessOf(wall) / 2 + 0.08
    if (distToSegment(a, wall) > half || distToSegment(b, wall) > half) return false
    const wlen = segmentLength(wall.a, wall.b) || 1
    const wx = (wall.b.x - wall.a.x) / wlen
    const wz = (wall.b.z - wall.a.z) / wlen
    return Math.abs((b.x - a.x) * wx + (b.z - a.z) * wz) / len > 0.9
  })
}

function pullOntoWall(point, walls) {
  const hit = nearestWall(walls, point, 0.55)
  if (!hit) return weld(point)
  return weld({ x: hit.x, z: hit.z })
}

export function snapRoomPoint(point, walls, grid = 0.1, options = {}) {
  return snapPoint(point, {
    walls,
    grid,
    radius: options.radius ?? 0.35,
    ortho: options.ortho,
    enabled: options.enabled !== false,
    origin: options.origin || null,
  }).point
}

export function drawRoom(plan, points, options = {}) {
  if (!points || points.length < 3) return plan
  const ring = points.map((point) => pullOntoWall(point, plan.walls))
  let next = plan
  const issued = issue(plan, 'draw')
  const drawId = issued.id
  next = { ...next, seq: issued.seq }
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    if (segmentLength(a, b) < 0.2 || alongExisting(a, b, next.walls)) continue
    if (options.partitions === false) continue
    next = addWall(next, a, b, 'interior')
    const created = next.walls[next.walls.length - 1]
    if (created) {
      next = {
        ...next,
        walls: next.walls.map((wall) => (wall.id === created.id ? { ...wall, drawId } : wall)),
      }
    }
  }
  next = withRooms(next)
  const center = centroid(ring)
  const room = (next.rooms || []).find((item) => pointInPolygon(center.x, center.z, item.polygon || []))
    || (next.rooms || []).find((item) => pointInPolygon(center.x, center.z, item.gross || []))
  if (!room) return next
  const type = options.type || 'huone'
  const named = ROOM_TYPES.find((item) => item.id === type)
  return updateRoom(next, room.id, {
    name: options.name || named?.name || 'Huone',
    type,
    showLabel: options.showLabel !== false,
    drawId,
    suppressed: false,
    cx: center.x,
    cz: center.z,
    ...(options.floorId ? { floorId: options.floorId } : {}),
    ...(options.interiorId ? { interiorId: options.interiorId } : {}),
    ...(options.ceilingId ? { ceilingId: options.ceilingId } : {}),
  })
}

export function detectRoomAt(plan, point) {
  const room = (plan.rooms || []).find((item) => pointInPolygon(point.x, point.z, item.polygon || item.gross || []))
  if (!room) return plan
  return updateRoom(plan, room.id, { suppressed: false, showLabel: true })
}

function nearSegment(point, a, b, radius) {
  if (!a || !b) return false
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2))
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t)) <= radius
}

function openingSymbolHit(plan, point) {
  return (plan.openings || []).find((item) => {
    if (item.hidden) return false
    const wall = (plan.walls || []).find((entry) => entry.id === item.wallId)
    if (!wall || wall.hidden) return false
    const fig = openingSymbol(wall, item, plan)
    if (nearSegment(point, fig.hinge, fig.leaf, 0.22)) return true
    const arc = fig.arc || []
    for (let i = 1; i < arc.length; i += 1) {
      if (nearSegment(point, arc[i - 1], arc[i], 0.18)) return true
    }
    return false
  })
}

export function hitTest(plan, point) {
  const opening = (plan.openings || []).find((item) => {
    const wall = (plan.walls || []).find((entry) => entry.id === item.wallId)
    if (!wall) return false
    const hit = nearestWall([wall], point, thicknessOf(wall, plan) + 0.18)
    if (!hit) return false
    const offset = hit.t * (segmentLength(wall.a, wall.b) || 1)
    return Math.abs(offset - item.offset) <= item.width / 2 + 0.08
  })
  if (opening) return { kind: 'opening', id: opening.id }
  const symbol = openingSymbolHit(plan, point)
  if (symbol) return { kind: 'opening', id: symbol.id }
  const wallHit = nearestWall(plan.walls, point, 0.36)
  if (wallHit) return { kind: 'wall', id: wallHit.wall.id, at: { x: wallHit.x, z: wallHit.z } }
  const room = visibleRooms(plan).find((item) => pointInPolygon(point.x, point.z, item.polygon || []))
  if (room) return { kind: 'room', id: room.id }
  return { kind: 'canvas' }
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

export const EAVE_OVERHANG = 0.5

export function roofModel(plan) {
  const box = planBounds(plan)
  const spanX = box.maxX - box.minX
  const spanZ = box.maxZ - box.minZ
  const alongX = spanX >= spanZ
  const type = ROOF_TYPES.some((item) => item.id === plan.roofType) ? plan.roofType : 'gable'
  const pitch = Number.isFinite(plan.roofPitch) ? plan.roofPitch : 25
  const half = Math.max(0.5, (alongX ? spanZ : spanX) / 2)
  const rise = type === 'flat' ? 0.18 : Math.max(1.1, Math.tan((pitch * Math.PI) / 180) * half)
  const shell = Number.isFinite(plan.exteriorThickness) ? plan.exteriorThickness : EXTERIOR_THICKNESS
  const eave = Number.isFinite(plan.eaveOverhang) ? plan.eaveOverhang : EAVE_OVERHANG
  return {
    ...box,
    type,
    wallHeight: plan.floorHeight || WALL_HEIGHT,
    rise,
    alongX,
    overhang: shell / 2 + eave,
  }
}

function roofCorners(model) {
  return {
    x0: model.minX - model.overhang,
    x1: model.maxX + model.overhang,
    z0: model.minZ - model.overhang,
    z1: model.maxZ + model.overhang,
    y0: model.wallHeight,
    y1: model.wallHeight + model.rise,
  }
}

export function roofOutline(model) {
  const { x0, x1, z0, z1, y0, y1 } = roofCorners(model)
  const edge = (a, b) => ({ a, b })
  if (model.type === 'shed') {
    return [
      edge([x0, y1, z0], [x1, y1, z0]),
      edge([x1, y1, z0], [x1, y0, z1]),
      edge([x1, y0, z1], [x0, y0, z1]),
      edge([x0, y0, z1], [x0, y1, z0]),
    ]
  }
  if (model.type === 'hip') {
    const inset = Math.min(x1 - x0, z1 - z0) / 2
    const zm = (model.minZ + model.maxZ) / 2
    const xm = (model.minX + model.maxX) / 2
    if (model.alongX) {
      const rx0 = x0 + inset
      const rx1 = x1 - inset
      return [
        edge([x0, y0, z0], [x1, y0, z0]),
        edge([x1, y0, z0], [x1, y0, z1]),
        edge([x1, y0, z1], [x0, y0, z1]),
        edge([x0, y0, z1], [x0, y0, z0]),
        edge([x0, y0, z0], [rx0, y1, zm]),
        edge([x1, y0, z0], [rx1, y1, zm]),
        edge([x1, y0, z1], [rx1, y1, zm]),
        edge([x0, y0, z1], [rx0, y1, zm]),
        edge([rx0, y1, zm], [rx1, y1, zm]),
      ]
    }
    const rz0 = z0 + inset
    const rz1 = z1 - inset
    return [
      edge([x0, y0, z0], [x1, y0, z0]),
      edge([x1, y0, z0], [x1, y0, z1]),
      edge([x1, y0, z1], [x0, y0, z1]),
      edge([x0, y0, z1], [x0, y0, z0]),
      edge([x0, y0, z0], [xm, y1, rz0]),
      edge([x1, y0, z0], [xm, y1, rz0]),
      edge([x1, y0, z1], [xm, y1, rz1]),
      edge([x0, y0, z1], [xm, y1, rz1]),
      edge([xm, y1, rz0], [xm, y1, rz1]),
    ]
  }
  if (model.type === 'flat') {
    const y = y1
    return [
      edge([x0, y, z0], [x1, y, z0]),
      edge([x1, y, z0], [x1, y, z1]),
      edge([x1, y, z1], [x0, y, z1]),
      edge([x0, y, z1], [x0, y, z0]),
    ]
  }
  if (model.alongX) {
    const zm = (model.minZ + model.maxZ) / 2
    return [
      edge([x0, y0, z0], [x1, y0, z0]),
      edge([x0, y0, z1], [x1, y0, z1]),
      edge([x0, y1, zm], [x1, y1, zm]),
      edge([x0, y0, z0], [x0, y1, zm]),
      edge([x0, y1, zm], [x0, y0, z1]),
      edge([x1, y0, z1], [x1, y1, zm]),
      edge([x1, y1, zm], [x1, y0, z0]),
      edge([x0, y0, z0], [x0, y0, z1]),
      edge([x1, y0, z0], [x1, y0, z1]),
    ]
  }
  const xm = (model.minX + model.maxX) / 2
  return [
    edge([x0, y0, z0], [x0, y0, z1]),
    edge([x1, y0, z0], [x1, y0, z1]),
    edge([xm, y1, z0], [xm, y1, z1]),
    edge([x0, y0, z0], [xm, y1, z0]),
    edge([xm, y1, z0], [x1, y0, z0]),
    edge([x1, y0, z1], [xm, y1, z1]),
    edge([xm, y1, z1], [x0, y0, z1]),
    edge([x0, y0, z0], [x1, y0, z0]),
    edge([x0, y0, z1], [x1, y0, z1]),
  ]
}

export function roofFaces(model) {
  const { x0, x1, z0, z1, y0, y1 } = roofCorners(model)
  const tri = (a, b, c) => [a, b, c]
  if (model.type === 'shed') {
    return [
      tri([x0, y1, z0], [x1, y1, z0], [x1, y0, z1]),
      tri([x0, y1, z0], [x1, y0, z1], [x0, y0, z1]),
    ]
  }
  if (model.type === 'hip') {
    const inset = Math.min(x1 - x0, z1 - z0) / 2
    const zm = (model.minZ + model.maxZ) / 2
    const xm = (model.minX + model.maxX) / 2
    if (model.alongX) {
      const rx0 = x0 + inset
      const rx1 = x1 - inset
      return [
        tri([x0, y0, z0], [x1, y0, z0], [rx1, y1, zm]),
        tri([x0, y0, z0], [rx1, y1, zm], [rx0, y1, zm]),
        tri([x0, y0, z1], [rx0, y1, zm], [rx1, y1, zm]),
        tri([x0, y0, z1], [rx1, y1, zm], [x1, y0, z1]),
        tri([x0, y0, z0], [rx0, y1, zm], [x0, y0, z1]),
        tri([x1, y0, z1], [rx1, y1, zm], [x1, y0, z0]),
      ]
    }
    const rz0 = z0 + inset
    const rz1 = z1 - inset
    return [
      tri([x0, y0, z0], [x0, y0, z1], [xm, y1, rz1]),
      tri([x0, y0, z0], [xm, y1, rz1], [xm, y1, rz0]),
      tri([x1, y0, z0], [xm, y1, rz0], [xm, y1, rz1]),
      tri([x1, y0, z0], [xm, y1, rz1], [x1, y0, z1]),
      tri([x0, y0, z0], [xm, y1, rz0], [x1, y0, z0]),
      tri([x0, y0, z1], [x1, y0, z1], [xm, y1, rz1]),
    ]
  }
  if (model.type === 'flat') {
    const y = y1
    return [
      tri([x0, y, z0], [x1, y, z0], [x1, y, z1]),
      tri([x0, y, z0], [x1, y, z1], [x0, y, z1]),
    ]
  }
  if (model.alongX) {
    const zm = (model.minZ + model.maxZ) / 2
    return [
      tri([x0, y0, z0], [x1, y0, z0], [x1, y1, zm]),
      tri([x0, y0, z0], [x1, y1, zm], [x0, y1, zm]),
      tri([x0, y0, z1], [x0, y1, zm], [x1, y1, zm]),
      tri([x0, y0, z1], [x1, y1, zm], [x1, y0, z1]),
      tri([x0, y0, z0], [x0, y1, zm], [x0, y0, z1]),
      tri([x1, y0, z1], [x1, y1, zm], [x1, y0, z0]),
    ]
  }
  const xm = (model.minX + model.maxX) / 2
  return [
    tri([x0, y0, z0], [x0, y0, z1], [xm, y1, z1]),
    tri([x0, y0, z0], [xm, y1, z1], [xm, y1, z0]),
    tri([x1, y0, z0], [xm, y1, z0], [xm, y1, z1]),
    tri([x1, y0, z0], [xm, y1, z1], [x1, y0, z1]),
    tri([x0, y0, z0], [xm, y1, z0], [x1, y0, z0]),
    tri([x0, y0, z1], [x1, y0, z1], [xm, y1, z1]),
  ]
}

export function doorLeafPose(opening, outward = 1) {
  const width = Math.max(0.2, opening?.width || 0.9)
  const hingeAtStart = (opening?.swing || 1) >= 0
  const hingeX = hingeAtStart ? -width / 2 : width / 2
  const extend = hingeAtStart ? 1 : -1
  const leafZ = opening?.inward ? -outward : outward
  const rotY = (extend > 0 ? -1 : 1) * (leafZ > 0 ? 1 : -1) * 1.05
  return { hingeX, extend, rotY, leafZ }
}

export function openingSymbol(wall, opening, plan = null) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const nx = -dz
  const nz = dx
  const from = opening.offset - opening.width / 2
  const to = opening.offset + opening.width / 2
  const at = (distance) => ({
    x: wall.a.x + dx * distance,
    z: wall.a.z + dz * distance,
  })
  const thick = plan
    ? thicknessOf(wall, plan)
    : (Number.isFinite(wall?.thickness) && wall.thickness > 0 ? wall.thickness : wallThickness(wall?.kind))
  const offsets = faceOffsets(wall, thick)
  const mid = (offsets.left + offsets.right) / 2
  const span = (offsets.left - offsets.right) / 2
  const jamb = (distance) => {
    const point = at(distance)
    return [
      { x: point.x + nx * offsets.left, z: point.z + nz * offsets.left },
      { x: point.x + nx * offsets.right, z: point.z + nz * offsets.right },
    ]
  }
  if (opening.kind === 'passage') {
    const a = at(from)
    const b = at(to)
    const faceLine = (offset) => ({
      x1: a.x + nx * offset,
      z1: a.z + nz * offset,
      x2: b.x + nx * offset,
      z2: b.z + nz * offset,
    })
    return {
      kind: 'passage',
      jambA: jamb(from),
      jambB: jamb(to),
      faces: [faceLine(offsets.left), faceLine(offsets.right)],
      boundary: { x1: a.x, z1: a.z, x2: b.x, z2: b.z },
      lintel: Boolean(opening.lintel),
      mergeSpaces: Boolean(opening.mergeSpaces),
    }
  }
  const hingeDist = opening.swing >= 0 ? from : to
  const hinge = at(hingeDist)
  const along = opening.swing >= 0 ? 1 : -1
  const outside = plan ? outwardNormal(wall, plan.walls || []) : { x: nx, z: nz }
  const leafSide = opening.inward ? { x: -outside.x, z: -outside.z } : outside
  const arc = []
  for (let i = 0; i <= 12; i += 1) {
    const t = (i / 12) * (Math.PI / 2)
    arc.push({
      x: hinge.x + dx * Math.cos(t) * opening.width * along + leafSide.x * Math.sin(t) * opening.width,
      z: hinge.z + dz * Math.cos(t) * opening.width * along + leafSide.z * Math.sin(t) * opening.width,
    })
  }
  const glass = [-0.62, 0, 0.62].map((factor) => {
    const a = at(from)
    const b = at(to)
    const offset = mid + span * factor
    return {
      x1: a.x + nx * offset,
      z1: a.z + nz * offset,
      x2: b.x + nx * offset,
      z2: b.z + nz * offset,
    }
  })
  return {
    kind: opening.kind === 'window' ? 'window' : 'door',
    hinge,
    leaf: arc[arc.length - 1],
    arc,
    glass,
    jambA: jamb(from),
    jambB: jamb(to),
  }
}

function roundMm(value) {
  return Math.round(value * 1000) / 1000
}

function boundsOf(points) {
  return (points || []).reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

export function dimensionChains(plan) {
  const box = planBounds(plan)
  if (!plan?.walls?.length || !Number.isFinite(box.minX)) return { chains: [], overall: [], rooms: [] }
  const near = (a, b) => Math.abs(a - b) <= 0.04
  const sideXs = { north: new Set([roundMm(box.minX), roundMm(box.maxX)]), south: new Set([roundMm(box.minX), roundMm(box.maxX)]) }
  const sideZs = { west: new Set([roundMm(box.minZ), roundMm(box.maxZ)]), east: new Set([roundMm(box.minZ), roundMm(box.maxZ)]) }
  ;(plan.walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((point) => {
      if (near(point.z, box.minZ)) sideXs.north.add(roundMm(point.x))
      if (near(point.z, box.maxZ)) sideXs.south.add(roundMm(point.x))
      if (near(point.x, box.minX)) sideZs.west.add(roundMm(point.z))
      if (near(point.x, box.maxX)) sideZs.east.add(roundMm(point.z))
    })
  })
  const chains = []
  const run = (coords, horizontal, at, normal) => {
    const sorted = [...coords].sort((a, b) => a - b)
    if (sorted.length < 3) return
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (b - a < 0.25) continue
      chains.push(horizontal
        ? { x1: a, z1: at, x2: b, z2: at, label: formatMm(b - a), nx: 0, nz: normal, kind: 'chain' }
        : { x1: at, z1: a, x2: at, z2: b, label: formatMm(b - a), nx: normal, nz: 0, kind: 'chain' })
    }
  }
  run(sideXs.north, true, box.minZ, -1)
  run(sideXs.south, true, box.maxZ, 1)
  run(sideZs.west, false, box.minX, -1)
  run(sideZs.east, false, box.maxX, 1)
  const overall = [
    { x1: box.minX, z1: box.maxZ, x2: box.maxX, z2: box.maxZ, label: formatMm(box.maxX - box.minX), nx: 0, nz: 1, kind: 'overall' },
    { x1: box.maxX, z1: box.minZ, x2: box.maxX, z2: box.maxZ, label: formatMm(box.maxZ - box.minZ), nx: 1, nz: 0, kind: 'overall' },
  ]
  const rooms = []
  ;(plan.rooms || []).forEach((room) => {
    const poly = room.gross?.length ? room.gross : room.polygon
    const inner = room.polygon?.length ? room.polygon : poly
    const gb = boundsOf(poly)
    const ib = boundsOf(inner)
    if (!Number.isFinite(gb.minX) || !Number.isFinite(ib.minX)) return
    const label = roomLabelPoint(room, plan.fixtures, plan.openings, plan.walls)
    const size = labelSize(room.name)
    const obstacles = roomObstacles(room, plan.fixtures, plan.openings, plan.walls)
    obstacles.push(inflateBox({ x: label.x - size.w / 2, z: label.z - size.h / 2, w: size.w, h: size.h }, 0.12))
    const place = (horizontal) => {
      const length = horizontal ? gb.maxX - gb.minX : gb.maxZ - gb.minZ
      if (length < 2.3) return
      const min = horizontal ? ib.minZ : ib.minX
      const max = horizontal ? ib.maxZ : ib.maxX
      const span = max - min
      if (span < 0.6) return
      const inset = Math.min(0.85, Math.max(0.55, span * 0.22))
      const lo = min + inset
      const hi = max - inset
      if (hi < lo) return
      let best = null
      for (let t = lo; t <= hi + 1e-6; t += 0.1) {
        const seg = horizontal
          ? { x1: ib.minX + 0.05, z1: t, x2: ib.maxX - 0.05, z2: t }
          : { x1: t, z1: ib.minZ + 0.05, x2: t, z2: ib.maxZ - 0.05 }
        const probes = [0.22, 0.5, 0.78].map((u) => (horizontal
          ? { x: ib.minX + (ib.maxX - ib.minX) * u, z: t }
          : { x: t, z: ib.minZ + (ib.maxZ - ib.minZ) * u }))
        if (!probes.every((point) => pointInPolygon(point.x, point.z, inner))) continue
        let clearance = 4
        obstacles.forEach((obstacle) => {
          clearance = Math.min(clearance, segmentGap(seg, obstacle))
        })
        if (clearance < 0.22) continue
        const wallClear = Math.min(Math.abs(t - min), Math.abs(max - t))
        const mid = (min + max) / 2
        const score = clearance * 6 + wallClear * 1.5 - Math.abs(t - mid) * 0.25
        if (!best || score > best.score) best = { seg, score }
      }
      if (!best) return
      rooms.push({ ...best.seg, label: formatMm(length), nx: 0, nz: 0, offset: 0, kind: 'room' })
    }
    place(true)
    place(false)
  })
  const inside = rooms.filter((dim) => {
    const horizontal = Math.abs(dim.z1 - dim.z2) < 0.02
    const echoesChain = chains.some((chain) => {
      if (chain.label !== dim.label) return false
      const chainH = Math.abs(chain.z1 - chain.z2) < 0.02
      if (horizontal !== chainH) return false
      if (horizontal) {
        const overlap = Math.min(Math.max(dim.x1, dim.x2), Math.max(chain.x1, chain.x2)) - Math.max(Math.min(dim.x1, dim.x2), Math.min(chain.x1, chain.x2))
        return overlap > 0.3 && Math.abs(dim.z1 - chain.z1) < 1.05
      }
      const overlap = Math.min(Math.max(dim.z1, dim.z2), Math.max(chain.z1, chain.z2)) - Math.max(Math.min(dim.z1, dim.z2), Math.min(chain.z1, chain.z2))
      return overlap > 0.3 && Math.abs(dim.x1 - chain.x1) < 1.05
    })
    return !echoesChain
  })
  return { chains, overall, rooms: inside }
}

export function openingDimensions(plan) {
  const box = planBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  return (plan.openings || []).map((opening) => {
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return null
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    const nx = -dz
    const nz = dx
    const from = opening.offset - opening.width / 2
    const to = opening.offset + opening.width / 2
    const a = { x: wall.a.x + dx * from, z: wall.a.z + dz * from }
    const b = { x: wall.a.x + dx * to, z: wall.a.z + dz * to }
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
    const outward = (mid.x - cx) * nx + (mid.z - cz) * nz
    const sign = wall.kind === 'exterior' ? (outward >= 0 ? 1 : -1) : -1
    return {
      id: `open:${opening.id}`,
      kind: 'opening',
      x1: a.x,
      z1: a.z,
      x2: b.x,
      z2: b.z,
      nx: nx * sign,
      nz: nz * sign,
      label: formatMm(opening.width),
      offset: 0.55,
    }
  }).filter(Boolean)
}

function sideWalls(plan, edge) {
  const box = planBounds(plan)
  const near = (a, b) => Math.abs(a - b) <= 0.08
  return (plan.walls || []).filter((wall) => {
    if (!wall?.a || !wall?.b) return false
    if (edge === 'north') return near(wall.a.z, box.minZ) && near(wall.b.z, box.minZ)
    if (edge === 'south') return near(wall.a.z, box.maxZ) && near(wall.b.z, box.maxZ)
    if (edge === 'west') return near(wall.a.x, box.minX) && near(wall.b.x, box.minX)
    return near(wall.a.x, box.maxX) && near(wall.b.x, box.maxX)
  })
}

export function openingChain(plan) {
  const box = planBounds(plan)
  if (!plan?.walls?.length || !Number.isFinite(box.minX)) return []
  const sides = [
    { id: 'north', horizontal: true, at: box.minZ, normal: -1, axis: 'x', lo: box.minX, hi: box.maxX },
    { id: 'south', horizontal: true, at: box.maxZ, normal: 1, axis: 'x', lo: box.minX, hi: box.maxX },
    { id: 'west', horizontal: false, at: box.minX, normal: -1, axis: 'z', lo: box.minZ, hi: box.maxZ },
    { id: 'east', horizontal: false, at: box.maxX, normal: 1, axis: 'z', lo: box.minZ, hi: box.maxZ },
  ]
  const dims = []
  sides.forEach((side) => {
    const coords = new Set([roundMm(side.lo), roundMm(side.hi)])
    sideWalls(plan, side.id).forEach((wall) => {
      const len = segmentLength(wall.a, wall.b) || 1
      const dx = (wall.b.x - wall.a.x) / len
      const dz = (wall.b.z - wall.a.z) / len
      ;(plan.openings || []).filter((opening) => opening.wallId === wall.id).forEach((opening) => {
        const from = opening.offset - opening.width / 2
        const to = opening.offset + opening.width / 2
        const a = side.axis === 'x' ? wall.a.x + dx * from : wall.a.z + dz * from
        const b = side.axis === 'x' ? wall.a.x + dx * to : wall.a.z + dz * to
        coords.add(roundMm(a))
        coords.add(roundMm(b))
      })
    })
    const sorted = [...coords].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (b - a < 0.18) continue
      dims.push(side.horizontal
        ? { x1: a, z1: side.at, x2: b, z2: side.at, label: formatMm(b - a), nx: 0, nz: side.normal, kind: 'opening', offset: 0.48 }
        : { x1: side.at, z1: a, x2: side.at, z2: b, label: formatMm(b - a), nx: side.normal, nz: 0, kind: 'opening', offset: 0.48 })
    }
  })
  return dims
}

export function openingTags(plan) {
  const box = planBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  return (plan.openings || []).map((opening) => {
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return null
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    let nx = -dz
    let nz = dx
    const x = wall.a.x + dx * opening.offset
    const z = wall.a.z + dz * opening.offset
    if ((x - cx) * nx + (z - cz) * nz < 0) {
      nx = -nx
      nz = -nz
    }
    const exterior = wall.kind === 'exterior' || wall.kind === 'bearing'
    const dist = exterior ? 0.2 : 0.26
    return {
      id: opening.id,
      x: x + nx * dist,
      z: z + nz * dist,
      label: formatMm(opening.width),
      vertical: Math.abs(dx) < Math.abs(dz),
    }
  }).filter(Boolean)
}

export function structureMarks(plan) {
  const catalog = structureCatalog(plan)
  if (!catalog.length) return []
  return (plan.walls || []).filter((wall) => wall?.a && wall?.b && !wall.hidden).map((wall) => {
    const coded = structureCode(plan, wall)
    if (!coded) return null
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    return {
      id: wall.id,
      x: (wall.a.x + wall.b.x) / 2,
      z: (wall.a.z + wall.b.z) / 2,
      code: coded.code,
      name: coded.name,
      vertical: Math.abs(dx) < Math.abs(dz),
    }
  }).filter(Boolean)
}

export function planDimensions(plan, display) {
  const show = normalizeDisplay(display || plan?.sheetDisplay?.plan || plan?.display)
  const dims = dimensionChains(plan)
  const list = []
  if (show.dims.openings) list.push(...openingChain(plan))
  if (show.dims.room) list.push(...dims.chains.map((dim) => ({ ...dim, kind: 'room', offset: 1.02 })))
  if (show.dims.overall) list.push(...dims.overall.map((dim) => ({ ...dim, offset: 1.58 })))
  if (show.dims.internal) list.push(...dims.rooms.map((dim) => ({ ...dim, kind: 'internal', offset: 0 })))
  return layoutDimensionLabels(list)
}

function dimTextBox(dim, textT, textSide) {
  const off = Number.isFinite(dim.offset) ? dim.offset : 0
  const nx = dim.nx || 0
  const nz = dim.nz || 0
  const x1 = dim.x1 + nx * off
  const z1 = dim.z1 + nz * off
  const x2 = dim.x2 + nx * off
  const z2 = dim.z2 + nz * off
  const len = Math.hypot(x2 - x1, z2 - z1) || 1
  let px = -((z2 - z1) / len)
  let pz = (x2 - x1) / len
  if (Math.hypot(nx, nz) > 0.2) {
    px = nx
    pz = nz
  }
  const tx = x1 + (x2 - x1) * textT + px * textSide * 0.2
  const tz = z1 + (z2 - z1) * textT + pz * textSide * 0.2
  const chars = Math.max(0.42, String(dim.label || '').length * 0.15)
  const vertical = Math.abs(x2 - x1) < Math.abs(z2 - z1)
  return vertical
    ? { tx, tz, tw: 0.28, th: chars }
    : { tx, tz, tw: chars, th: 0.26 }
}

function dimBoxesHit(a, b) {
  return Math.abs(a.tx - b.tx) < (a.tw + b.tw) / 2 && Math.abs(a.tz - b.tz) < (a.th + b.th) / 2
}

export function layoutDimensionLabels(list) {
  const placed = []
  return (list || []).map((dim) => {
    const len = Math.hypot(dim.x2 - dim.x1, dim.z2 - dim.z1)
    const tw = Math.max(0.48, String(dim.label || '').length * 0.17)
    const tries = []
    if (tw < len * 0.82) tries.push({ textT: 0.5, textSide: 0 })
    ;[0.5, 0.28, 0.72, 0.14, 0.86].forEach((textT) => {
      ;[1, -1, 1.7, -1.7].forEach((textSide) => tries.push({ textT, textSide }))
    })
    let chosen = tries[0]
    for (let i = 0; i < tries.length; i += 1) {
      const box = dimTextBox(dim, tries[i].textT, tries[i].textSide)
      if (!placed.some((item) => dimBoxesHit(item, box))) {
        chosen = tries[i]
        break
      }
    }
    placed.push(dimTextBox(dim, chosen.textT, chosen.textSide))
    return { ...dim, textT: chosen.textT, textSide: chosen.textSide }
  })
}

function dimensionSpan(dim) {
  const off = Number.isFinite(dim.offset) ? dim.offset : 0
  const nx = dim.nx || 0
  const nz = dim.nz || 0
  return {
    x1: dim.x1 + nx * off,
    z1: dim.z1 + nz * off,
    x2: dim.x2 + nx * off,
    z2: dim.z2 + nz * off,
  }
}

export function dedupeDimensions(list, minGap = 0.35) {
  const gap = Number.isFinite(minGap) ? minGap : 0.35
  const kept = []
  ;(list || []).forEach((dim) => {
    const span = dimensionSpan(dim)
    const horizontal = Math.abs(span.x2 - span.x1) >= Math.abs(span.z2 - span.z1)
    const duplicate = kept.some((other) => {
      if (String(other.label) !== String(dim.label)) return false
      const prev = dimensionSpan(other)
      const otherH = Math.abs(prev.x2 - prev.x1) >= Math.abs(prev.z2 - prev.z1)
      if (otherH !== horizontal) return false
      if (horizontal) {
        const overlap = Math.min(Math.max(span.x1, span.x2), Math.max(prev.x1, prev.x2)) - Math.max(Math.min(span.x1, span.x2), Math.min(prev.x1, prev.x2))
        return overlap > 0.15 && Math.abs((span.z1 + span.z2) / 2 - (prev.z1 + prev.z2) / 2) <= gap
      }
      const overlap = Math.min(Math.max(span.z1, span.z2), Math.max(prev.z1, prev.z2)) - Math.max(Math.min(span.z1, span.z2), Math.min(prev.z1, prev.z2))
      return overlap > 0.15 && Math.abs((span.x1 + span.x2) / 2 - (prev.x1 + prev.x2) / 2) <= gap
    })
    if (!duplicate) kept.push(dim)
  })
  return kept
}

function rotatedFootprint(fixture) {
  const tpl = fixtureTemplate(fixture.type)
  const hw = tpl.w / 2
  const hd = tpl.d / 2
  const rad = ((fixture.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => ({
    x: fixture.x + lx * cos + lz * sin,
    z: fixture.z - lx * sin + lz * cos,
  }))
}

function aabbOf(points) {
  const box = boundsOf(points)
  return { x: box.minX, z: box.minZ, w: box.maxX - box.minX, h: box.maxZ - box.minZ }
}

function labelSize(name) {
  const text = String(name || 'Huone')
  if (text.length > 8) {
    const half = Math.ceil(text.length / 2)
    return { w: Math.max(0.7, half * 0.15), h: 0.9 }
  }
  return { w: Math.max(0.7, text.length * 0.14), h: 0.58 }
}

function rectGap(a, b) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dz = Math.max(b.z - (a.z + a.h), a.z - (b.z + b.h))
  if (dx < 0 && dz < 0) return -Math.min(-dx, -dz)
  return Math.hypot(Math.max(0, dx), Math.max(0, dz))
}

function inflateBox(box, pad) {
  return { x: box.x - pad, z: box.z - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
}

function segmentGap(seg, box) {
  const horizontal = Math.abs(seg.z1 - seg.z2) < 1e-6
  if (horizontal) {
    const z = seg.z1
    const x1 = Math.min(seg.x1, seg.x2)
    const x2 = Math.max(seg.x1, seg.x2)
    const dz = z < box.z ? box.z - z : z > box.z + box.h ? z - (box.z + box.h) : 0
    const dx = x2 < box.x ? box.x - x2 : x1 > box.x + box.w ? x1 - (box.x + box.w) : 0
    if (dx === 0 && dz === 0) return -Math.max(0.001, Math.min(z - box.z, box.z + box.h - z))
    return Math.hypot(dx, dz)
  }
  const x = seg.x1
  const z1 = Math.min(seg.z1, seg.z2)
  const z2 = Math.max(seg.z1, seg.z2)
  const dx = x < box.x ? box.x - x : x > box.x + box.w ? x - (box.x + box.w) : 0
  const dz = z2 < box.z ? box.z - z2 : z1 > box.z + box.h ? z1 - (box.z + box.h) : 0
  if (dx === 0 && dz === 0) return -Math.max(0.001, Math.min(x - box.x, box.x + box.w - x))
  return Math.hypot(dx, dz)
}

function roomObstacles(room, fixtures, openings, walls) {
  const polygon = room?.polygon || []
  const boxes = []
  ;(fixtures || []).forEach((fixture) => {
    if (!pointInPolygon(fixture.x, fixture.z, polygon)) return
    boxes.push(inflateBox(aabbOf(rotatedFootprint(fixture)), 0.05))
  })
  ;(openings || []).forEach((opening) => {
    if (opening.kind === 'window') return
    const wall = (walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return
    const symbol = openingSymbol(wall, opening)
    if (!symbol.arc.some((point) => pointInPolygon(point.x, point.z, polygon))) return
    boxes.push(inflateBox(aabbOf(symbol.arc), 0.04))
  })
  return boxes
}

export function roomLabelPoint(room, fixtures = [], openings = [], walls = []) {
  if (Number.isFinite(room?.lx) && Number.isFinite(room?.lz)) return { x: room.lx, z: room.lz }
  const polygon = room?.polygon || []
  if (polygon.length < 3) return { x: room?.cx || 0, z: room?.cz || 0 }
  const box = boundsOf(polygon)
  const size = labelSize(room.name)
  const obstacles = roomObstacles(room, fixtures, openings, walls)
  const center = centroid(polygon)
  const search = (inset) => {
    const found = []
    const step = 0.2
    for (let x = box.minX + size.w / 2 + inset; x <= box.maxX - size.w / 2 - inset; x += step) {
      for (let z = box.minZ + size.h / 2 + inset; z <= box.maxZ - size.h / 2 - inset; z += step) {
        const rect = { x: x - size.w / 2, z: z - size.h / 2, w: size.w, h: size.h }
        const corners = [
          [rect.x + 0.03, rect.z + 0.03],
          [rect.x + rect.w - 0.03, rect.z + 0.03],
          [rect.x + rect.w - 0.03, rect.z + rect.h - 0.03],
          [rect.x + 0.03, rect.z + rect.h - 0.03],
        ]
        if (!corners.every(([px, pz]) => pointInPolygon(px, pz, polygon))) continue
        let clearance = 4
        obstacles.forEach((obstacle) => {
          clearance = Math.min(clearance, rectGap(rect, obstacle))
        })
        found.push({ x, z, clearance, dist: Math.hypot(x - center.x, z - center.z) })
      }
    }
    return found
  }
  const candidates = search(0.28)
  const open = candidates.filter((item) => item.clearance >= 0.35)
  const pool = open.length ? open : candidates
  if (pool.length) {
    pool.sort((a, b) => (a.dist - b.dist) || (b.clearance - a.clearance))
    return { x: pool[0].x, z: pool[0].z }
  }
  const loose = search(0.02)
  if (loose.length) {
    loose.sort((a, b) => (b.clearance - a.clearance) || (a.dist - b.dist))
    return { x: loose[0].x, z: loose[0].z }
  }
  return { x: center.x, z: center.z }
}

export function moveRoomLabel(plan, id, x, z) {
  return {
    ...plan,
    rooms: (plan.rooms || []).map((room) => {
      if (room.id !== id) return room
      if (!pointInPolygon(x, z, room.polygon || [])) return room
      return { ...room, lx: x, lz: z }
    }),
  }
}

function openingAreaOnEdge(plan, wall, edge) {
  if (!wall) return 0
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const along = (point) => (point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz
  const lo = Math.min(along(edge.a), along(edge.b))
  const hi = Math.max(along(edge.a), along(edge.b))
  let area = 0
  ;(plan.openings || []).forEach((opening) => {
    if (opening.wallId !== wall.id) return
    const overlap = Math.min(hi, opening.offset + opening.width / 2) - Math.max(lo, opening.offset - opening.width / 2)
    if (overlap > 0.02) area += overlap * (opening.height || (opening.kind === 'window' ? 1.2 : 2.1))
  })
  return area
}

export function materialsList(plan) {
  const rows = []
  const add = (group, id, area, roomName) => {
    const item = materialOf(group, id)
    const key = `${group}:${item.id}:${roomName || ''}`
    const found = rows.find((row) => row.key === key)
    if (found) found.area += area
    else rows.push({
      key,
      group,
      groupLabel: GROUP_LABEL[group] || group,
      id: item.id,
      name: item.name,
      color: item.color,
      area: area || 0,
      roomName: roomName || '',
      count: 1,
    })
  }
  visibleRooms(plan).forEach((room) => {
    const height = room.ceilingHeight || plan.floorHeight || WALL_HEIGHT
    add('floor', room.floorId || 'parquet', room.area || 0, room.name)
    add('ceiling', room.ceilingId || 'paint', room.area || 0, room.name)
    ;(room.walls || []).forEach((edge) => {
      const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
      const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
      const material = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
      const gross = segmentLength(edge.a, edge.b) * height
      add('interior', material, Math.max(0, gross - openingAreaOnEdge(plan, wall, edge)), room.name)
    })
  })
  const clad = claddingAreas(plan)
  const exteriorArea = clad.reduce((sum, row) => sum + (row.area || 0), 0)
  const shell = materialOf('exterior', plan.exteriorId)
  const shellLook = surfaceLook(plan, plan.exteriorId)
  rows.push({
    key: `exterior:${shell.id}`,
    group: 'exterior',
    groupLabel: 'Ulkoseinä',
    id: shell.id,
    name: shell.name,
    color: shellLook.color,
    code: shellLook.code,
    area: Math.max(0, exteriorArea - plinthArea(plan)),
    roomName: '',
    count: 1,
  })
  const box = planBounds(plan)
  const foot = Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxZ - box.minZ)
  const pitch = ((plan.roofPitch || 0) * Math.PI) / 180
  const slope = plan.roofType === 'flat' ? 1 : 1 / Math.max(0.35, Math.cos(pitch))
  add('roof', plan.roofId || 'metal', foot * slope, '')
  const roof = roofLook(plan)
  const roofRow = rows.find((row) => row.group === 'roof')
  if (roofRow) {
    roofRow.color = roof.color
    roofRow.code = roof.code
  }
  clad.forEach((row) => {
    rows.push({
      key: `facade:${row.key || row.id}`,
      group: 'facade',
      groupLabel: 'Julkisivu',
      id: row.id,
      name: row.name,
      color: row.color,
      code: row.code || '',
      pattern: row.pattern,
      count: 1,
      area: row.area,
    })
  })
  const plinth = plinthLook(plan)
  rows.push({
    key: `plinth:${plinth.id}`,
    group: 'plinth',
    groupLabel: 'Sokkeli',
    id: plinth.id,
    name: plinth.name,
    color: plinth.color,
    code: plinth.code,
    area: plinthArea(plan),
    roomName: '',
    count: 1,
  })
  coverBill(plan).forEach((row) => {
    rows.push({
      key: `cover:${row.id}`,
      group: 'cover',
      groupLabel: 'Katokset',
      id: row.kind,
      name: `${row.name}, ${row.frame}, ${row.roofing}`,
      color: row.frameColor,
      area: row.area,
      roomName: '',
      count: 1,
    })
  })
  groundBill(plan).forEach((row) => {
    rows.push({
      key: `ground:${row.id}`,
      group: 'ground',
      groupLabel: 'Maanalaiset',
      id: row.kind,
      name: row.name,
      color: '#0f766e',
      area: row.qty,
      unit: row.unit,
      roomName: '',
      count: 1,
    })
  })
  structureBill(plan).forEach((row) => {
    rows.push({
      key: `structure:${row.code}:${row.name}:${row.unit}`,
      group: 'structure',
      groupLabel: row.code,
      id: row.materialId || row.name,
      materialId: row.materialId,
      structureId: row.structureId,
      name: row.name,
      structureName: row.structureName,
      code: row.code,
      color: '#d6d3d1',
      area: row.qty,
      unit: row.unit,
      roomName: '',
      count: 1,
    })
  })
  return rows
}

export function formatArea(area) {
  return `${(area || 0).toFixed(1).replace('.', ',')} m²`
}

export function formatQuantity(qty, unit = 'm²') {
  const digits = unit === 'm³' ? 2 : 1
  return `${(qty || 0).toFixed(digits).replace('.', ',')} ${unit}`
}

export function formatMm(metres) {
  return String(Math.round((metres || 0) * 1000))
}

function ascii(value) {
  return pdfAscii(value)
}

export function drawingRatio(plan, drawW, drawH, worldW, worldH) {
  const chosen = plan?.drawingScale
  if (chosen === 50 || chosen === 100 || chosen === 200) return chosen
  const needW = worldW + 1.55
  const needH = worldH + 1.55
  if (needW * 20 <= drawW && needH * 20 <= drawH) return 50
  if (needW * 10 <= drawW && needH * 10 <= drawH) return 100
  return 200
}

export function sheetLayout(plan) {
  const paper = plan?.paper === 'a4' ? 'a4' : 'a3'
  const pageW = paper === 'a4' ? 297 : 420
  const pageH = paper === 'a4' ? 210 : 297
  const margin = 12
  const titleW = 102
  const titleH = 58
  const box = planBounds(plan || emptyPlan())
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const frame = { x: margin, y: margin, w: pageW - margin * 2, h: pageH - margin * 2 }
  const drawW = frame.w - titleW - 16
  const drawH = frame.h - 18
  const ratio = drawingRatio(plan, drawW, drawH, worldW, worldH)
  const scale = 1000 / ratio
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
    ratio,
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

function sheetOrigin(frame, title, box, content, scale) {
  const margin = 8
  const gap = 6
  const width = Math.max(1, (content.maxX - content.minX) * scale)
  const height = Math.max(1, (content.maxZ - content.minZ) * scale)
  const beside = Math.max(40, title.x - frame.x - gap - margin)
  const innerH = Math.max(40, frame.h - margin * 2)
  let left = frame.x + margin
  let top = frame.y + margin
  if (width <= beside && height <= innerH) {
    left += (beside - width) / 2
    top += (innerH - height) / 2
  } else {
    const right = left + width
    const bottom = top + height
    if (right > title.x - gap && bottom > title.y - gap) {
      const pushX = right - (title.x - gap)
      if (left - pushX >= frame.x + 3) left -= pushX
      else {
        left = frame.x + 3
        const pushY = (top + height) - (title.y - gap)
        if (top - pushY >= frame.y + 3) top -= pushY
      }
    }
  }
  return {
    ox: left - (content.minX - box.minX) * scale,
    oy: top - (content.minZ - box.minZ) * scale,
  }
}

export function viewLayout(plan) {
  const base = sheetLayout(plan)
  if (!plan?.walls?.length) return { ...base, building: base.box }
  const pad = 1.9
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
  const ratio = drawingRatio(plan, drawW, drawH, worldW, worldH)
  const scale = 1000 / ratio
  const spanX = base.box.maxX - base.box.minX
  const spanZ = base.box.maxZ - base.box.minZ
  const beside = base.title.x - base.frame.x - 14
  const innerH = base.frame.h - 16
  let extra = 1.55
  while (extra > 0.35 && ((spanX + extra * 2) * scale > beside || (spanZ + extra * 2) * scale > innerH)) extra -= 0.1
  const content = {
    minX: base.box.minX - extra,
    maxX: base.box.maxX + extra,
    minZ: base.box.minZ - extra,
    maxZ: base.box.maxZ + extra,
  }
  const placed = sheetOrigin(base.frame, base.title, box, content, scale)
  return {
    ...base,
    box,
    building: base.box,
    ratio,
    scale,
    ox: placed.ox,
    oy: placed.oy,
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

  const figures = wallFigures(plan.walls || [], plan.openings || [], (wall) => thicknessOf(wall, plan))
  const fillLoop = (points, rgb) => {
    if (!points || points.length < 3) return
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
    const start = points[0]
    let px = X(start.x)
    let py = Y(start.z)
    const rel = points.slice(1).map((point) => {
      const x = X(point.x)
      const y = Y(point.z)
      const step = [x - px, y - py]
      px = x
      py = y
      return step
    })
    rel.push([X(start.x) - px, Y(start.z) - py])
    doc.lines(rel, X(start.x), Y(start.z), [1, 1], 'F')
  }
  figures.exterior.forEach((loop) => fillLoop(loop.points, [63, 56, 52]))
  figures.interior.forEach((loop) => fillLoop(loop.points, [231, 229, 228]))
  figures.cladding.forEach((loop) => {
    const rgb = hexRgb(claddingOf(plan.exteriorId).color)
    fillLoop(loop.points, [rgb.r, rgb.g, rgb.b])
  })
  doc.setDrawColor(20)
  doc.setLineWidth(0.25)
  figures.core.forEach((loop) => {
    const start = loop.points[0]
    let px = X(start.x)
    let py = Y(start.z)
    const rel = loop.points.slice(1).map((point) => {
      const x = X(point.x)
      const y = Y(point.z)
      const step = [x - px, y - py]
      px = x
      py = y
      return step
    })
    rel.push([X(start.x) - px, Y(start.z) - py])
    doc.lines(rel, X(start.x), Y(start.z), [1, 1], 'S')
  })
  ;(plan.walls || []).forEach((wall) => {
    wallSolids(wall, plan.openings).cuts.forEach((cut) => {
      const symbol = openingSymbol(wall, cut.opening, plan)
      doc.setDrawColor(20)
      doc.setLineWidth(0.15)
      if (symbol.kind === 'window') {
        symbol.glass.forEach((line) => doc.line(X(line.x1), Y(line.z1), X(line.x2), Y(line.z2)))
        ;[symbol.jambA, symbol.jambB].forEach((jamb) => doc.line(X(jamb[0].x), Y(jamb[0].z), X(jamb[1].x), Y(jamb[1].z)))
      } else if (symbol.kind === 'passage') {
        doc.setLineWidth(0.12)
        ;(symbol.faces || []).forEach((line) => doc.line(X(line.x1), Y(line.z1), X(line.x2), Y(line.z2)))
        ;[symbol.jambA, symbol.jambB].forEach((jamb) => doc.line(X(jamb[0].x), Y(jamb[0].z), X(jamb[1].x), Y(jamb[1].z)))
        if (!symbol.mergeSpaces && symbol.boundary) {
          if (doc.setLineDashPattern) doc.setLineDashPattern([1.2, 0.8], 0)
          doc.line(X(symbol.boundary.x1), Y(symbol.boundary.z1), X(symbol.boundary.x2), Y(symbol.boundary.z2))
          if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)
        }
      } else {
        doc.line(X(symbol.hinge.x), Y(symbol.hinge.z), X(symbol.leaf.x), Y(symbol.leaf.z))
        for (let i = 0; i < symbol.arc.length - 1; i += 1) {
          doc.line(X(symbol.arc[i].x), Y(symbol.arc[i].z), X(symbol.arc[i + 1].x), Y(symbol.arc[i + 1].z))
        }
      }
    })
  })

  const sheetDisplay = normalizeDisplay(plan?.sheetDisplay?.plan || plan?.display)
  const dims = planDimensions(plan, sheetDisplay)
  doc.setDrawColor(40)
  doc.setTextColor(20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  dims.forEach((dim) => {
    const off = Number.isFinite(dim.offset) ? dim.offset : 0
    const x1 = X(dim.x1 + (dim.nx || 0) * off)
    const y1 = Y(dim.z1 + (dim.nz || 0) * off)
    const x2 = X(dim.x2 + (dim.nx || 0) * off)
    const y2 = Y(dim.z2 + (dim.nz || 0) * off)
    doc.setLineWidth(0.12)
    doc.line(x1, y1, x2, y2)
    doc.line(X(dim.ax ?? dim.x1), Y(dim.az ?? dim.z1), x1, y1)
    doc.line(X(dim.bx ?? dim.x2), Y(dim.bz ?? dim.z2), x2, y2)
    const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
    const textT = Number.isFinite(dim.textT) ? dim.textT : 0.5
    const alongX = x1 + (x2 - x1) * textT
    const alongY = y1 + (y2 - y1) * textT
    doc.text(dim.label, alongX, alongY, {
      align: 'center',
      baseline: 'middle',
      angle: vertical ? 90 : 0,
    })
  })

  if (sheetDisplay.openingSizes) {
    doc.setFontSize(6)
    openingTags(plan).forEach((tag) => {
      doc.text(tag.label, X(tag.x), Y(tag.z), { align: 'center', baseline: 'middle', angle: tag.vertical ? 90 : 0 })
    })
  }
  if (sheetDisplay.structures) {
    doc.setFontSize(6)
    structureMarks(plan).forEach((mark) => {
      doc.text(mark.code, X(mark.x), Y(mark.z), { align: 'center', baseline: 'middle', angle: mark.vertical ? 90 : 0 })
    })
    const catalog = structureCatalog(plan)
    if (catalog.length) {
      const rowH = 3.6
      const boxW = 78
      const boxH = 7 + catalog.length * rowH
      const lx = frame.x + 3
      const ly = frame.y + frame.h - boxH - 3
      doc.setDrawColor(28)
      doc.setLineWidth(0.2)
      doc.rect(lx, ly, boxW, boxH)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(ascii(translate(plan?.locale || 'fi', 'sheet.structures')), lx + 2, ly + 4.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      catalog.forEach((row, index) => {
        doc.text(ascii(`${row.code}  ${row.name}  U ${Number(row.u).toFixed(2)}`), lx + 2, ly + 8.2 + index * rowH)
      })
    }
  }

  const labels = layoutRoomLabels(visibleRooms(plan), {
    ratio: layout.ratio,
    showNames: sheetDisplay.roomNames,
    showAreas: sheetDisplay.areas,
    obstacles: labelObstacles(plan, layout.scale * 2.2),
  })
  labels.forEach((label) => {
    if (label.halo) {
      doc.setFillColor(251, 250, 247)
      const rw = Math.max(4, label.w * scale)
      const rh = Math.max(3, label.h * scale)
      doc.rect(X(label.x) - rw / 2, Y(label.z) - rh / 2, rw, rh, 'F')
    }
    if (label.leader) {
      doc.setDrawColor(120)
      doc.setLineWidth(0.1)
      doc.line(X(label.leader.x), Y(label.leader.z), X(label.x), Y(label.z))
    }
    doc.setTextColor(20)
    const gap = pdfLeadingMm(8)
    if (label.text) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(ascii(label.text), X(label.x), Y(label.z) - (label.area ? gap / 2 : 0), { align: 'center' })
    }
    if (label.area) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.text(ascii(label.area), X(label.x), Y(label.z) + (label.text ? gap / 2 : 0), { align: 'center' })
    }
  })

  const tx = title.x
  const ty = title.y
  doc.setDrawColor(20)
  doc.setLineWidth(0.3)
  doc.rect(tx, ty, title.w, title.h)
  doc.line(tx, ty + 8, tx + title.w, ty + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15)
  const locale = plan?.locale || 'fi'
  const tr = (key, vars) => translate(locale, key, vars)
  doc.text(ascii(tr('sheet.plan')), tx + 3, ty + 5.5)
  doc.setFont('helvetica', 'normal')
  const roof = ROOF_TYPES.find((item) => item.id === plan.roofType) || ROOF_TYPES[0]
  const rows = [
    ascii(plan.name || tr('sheet.defaultName')),
    ascii(tr('sheet.scale', { ratio: layout.ratio })),
    plan.paper === 'a4' ? ascii(tr('sheet.a4')) : ascii(tr('sheet.a3')),
    ascii(translate(locale, `roof.${roof.id}`) === `roof.${roof.id}` ? roof.name : translate(locale, `roof.${roof.id}`)),
    ascii(tr('sheet.rooms', { count: visibleRooms(plan).length })),
    ascii(tr('sheet.area', { area: formatArea(visibleRooms(plan).reduce((sum, room) => sum + room.area, 0)) })),
  ]
  const stack = fitLines({ height: title.h, count: rows.length, font: pdfLeadingMm(8) / 1.3, top: 11, bottom: 4 })
  doc.setFontSize(stack.font * 72 / 25.4)
  rows.forEach((row, index) => doc.text(row, tx + 3, ty + stack.ys[index]))
  const clad = claddingAreas(plan)
  if (clad.length) {
    doc.setFontSize(8)
    doc.text(ascii(tr('facade.sheet')), 16, title.y + 4)
    clad.slice(0, 6).forEach((row, index) => {
      doc.setFillColor(row.color)
      doc.rect(16, title.y + 7 + index * 5, 4, 3, 'F')
      doc.text(`${ascii(row.name)}  ${ascii(formatArea(row.area))}`, 22, title.y + 10 + index * 5)
    })
  }
  return doc
}

function drawElevationPage(doc, plan, side) {
  const layout = facadeLayout(plan, side)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const legendW = 58
  const drawW = pageW - margin * 2 - legendW
  const drawH = pageH - margin * 2 - 28
  const scale = Math.min(drawW / layout.length, drawH / Math.max(layout.height, 0.1))
  const ox = margin + (drawW - layout.length * scale) / 2
  const base = margin + 16 + layout.height * scale
  const X = (u) => ox + u * scale
  const Y = (y) => base - y * scale
  doc.setDrawColor(30)
  doc.setLineWidth(0.3)
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2)
  const paints = facadePaints(plan, side).filter((piece) => piece.materialId)
  const plinth = plinthLook(plan)
  const technical = finishesOf(plan).sceneStyle === 'technical'
  paints.forEach((piece) => {
    const item = claddingOf(piece.materialId)
    const look = surfaceLook(plan, item.id, { color: piece.color, colorCode: piece.colorCode })
    const y0 = Math.max(piece.y0, plinth.height)
    if (piece.y1 - y0 < 0.02) return
    const x = X(piece.u0)
    const y = Y(piece.y1)
    const w = Math.max(0.2, (piece.u1 - piece.u0) * scale)
    const h = Math.max(0.2, (piece.y1 - y0) * scale)
    const rgb = hexRgb(technical ? '#f8fafc' : look.color)
    doc.setFillColor(rgb.r, rgb.g, rgb.b)
    doc.setDrawColor(rgb.r, rgb.g, rgb.b)
    doc.rect(x, y, w, h, 'F')
    if (technical) return
    doc.setDrawColor(40, 30, 24)
    doc.setLineWidth(0.08)
    if (item.pattern === 'brick') {
      const course = Math.max(1.4, 0.065 * scale)
      for (let yy = y + course; yy < y + h; yy += course) doc.line(x, yy, x + w, yy)
    } else if (item.pattern === 'boards-h' || item.pattern === 'boards-v' || item.pattern === 'batten') {
      const step = Math.max(1.2, 0.12 * scale)
      const vertical = item.pattern !== 'boards-h'
      if (vertical) {
        for (let xx = x + step; xx < x + w; xx += step) doc.line(xx, y, xx, y + h)
      } else {
        for (let yy = y + step; yy < y + h; yy += step) doc.line(x, yy, x + w, yy)
      }
    }
  })
  const plinthRgb = hexRgb(technical ? '#f8fafc' : plinth.color)
  doc.setFillColor(plinthRgb.r, plinthRgb.g, plinthRgb.b)
  doc.setDrawColor(30)
  doc.rect(X(0), Y(plinth.height), Math.max(0.2, layout.length * scale), Math.max(0.2, plinth.height * scale), 'FD')
  layout.openings.forEach((opening) => {
    const colour = openingColour(plan, opening)
    const frame = hexRgb(technical ? '#f8fafc' : colour.color)
    const x = X(opening.u0)
    const y = Y(opening.y1)
    const w = (opening.u1 - opening.u0) * scale
    const h = (opening.y1 - opening.y0) * scale
    doc.setFillColor(frame.r, frame.g, frame.b)
    doc.setDrawColor(20)
    doc.setLineWidth(0.35)
    doc.rect(x, y, w, h, 'FD')
    if (opening.kind === 'window') {
      doc.setLineWidth(0.15)
      doc.line(x, y + h / 2, x + w, y + h / 2)
      doc.line(x + w / 2, y, x + w / 2, y + h)
    }
  })
  doc.setDrawColor(20)
  doc.setLineWidth(0.4)
  doc.line(X(0), Y(0), X(layout.length), Y(0))
  doc.line(X(0), Y(layout.height), X(layout.length), Y(layout.height))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(20)
  doc.text(formatMm(layout.length), (X(0) + X(layout.length)) / 2, Y(0) + 5, { align: 'center' })
  doc.text(formatMm(layout.height), X(layout.length) + 3, (Y(0) + Y(layout.height)) / 2, { angle: 90 })
  const lx = pageW - margin - legendW + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(ascii(translate(plan?.locale || 'fi', 'facade.sheet')), lx, margin + 8)
  doc.setFontSize(10)
  doc.text(ascii(`${layout.compass || ''}  ${layout.name}`), lx, margin + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const areas = []
  paints.forEach((piece) => {
    const area = (piece.u1 - piece.u0) * (piece.y1 - piece.y0)
    const found = areas.find((row) => row.id === piece.materialId)
    if (found) found.area += area
    else areas.push({ id: piece.materialId, area, item: claddingOf(piece.materialId) })
  })
  const lead = pdfLeadingMm(8)
  const rowPitch = lead * 2 + 1.2
  areas.forEach((row, index) => {
    const look = surfaceLook(plan, row.item.id, { color: row.color, colorCode: row.code })
    const rgb = hexRgb(look.color)
    const rowY = margin + 20 + index * rowPitch
    doc.setFillColor(rgb.r, rgb.g, rgb.b)
    doc.rect(lx, rowY, 5, 4, 'F')
    doc.setTextColor(20)
    doc.text(`${ascii(row.item.name)}${look.code ? ` ${ascii(look.code)}` : ''}`, lx + 7, rowY + 3)
    doc.text(ascii(formatArea(row.area)), lx + 7, rowY + 3 + lead)
  })
  const plinthRow = areas.length
  const plinthFill = hexRgb(plinth.color)
  const plinthY = margin + 20 + plinthRow * rowPitch
  doc.setFillColor(plinthFill.r, plinthFill.g, plinthFill.b)
  doc.rect(lx, plinthY, 5, 4, 'F')
  doc.setTextColor(20)
  doc.text(`${ascii(plinth.name)} ${ascii(plinth.code)}`, lx + 7, plinthY + 3)
  doc.setFontSize(8)
  doc.text(ascii(plan.name || 'Omakotitalo'), margin + 2, pageH - margin - 4)
}

function hexRgb(color) {
  const hex = String(color || '#cccccc').replace('#', '')
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0,
  }
}

export function buildElevationPdf(plan, side = 'north') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: plan?.paper === 'a4' ? 'a4' : 'a3' })
  const sides = side === 'all' ? FACADE_SIDES.map((item) => item.id) : [side]
  sides.forEach((id, index) => {
    if (index > 0) doc.addPage()
    drawElevationPage(doc, plan, id)
  })
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

function endCap(wall, at, dir, walls, plan) {
  const half = thicknessOf(wall, plan) / 2
  const others = incidentAt(at, walls, plan).filter((item) => item.wall.id !== wall.id)
  const ccw = (other) => {
    const cross = dir.x * other.dir.z - dir.z * other.dir.x
    const dot = dir.x * other.dir.x + dir.z * other.dir.z
    let ang = Math.atan2(cross, dot)
    if (ang < 0) ang += Math.PI * 2
    return ang
  }
  const left = others.slice().sort((a, b) => ccw(a) - ccw(b))[0] || null
  const right = others.slice().sort((a, b) => ccw(b) - ccw(a))[0] || null
  return {
    left: mitreCorner(at, dir, half, 1, left),
    right: mitreCorner(at, dir, half, -1, right),
  }
}

export function wallQuads(wall, openings, walls = [], plan = null) {
  const thick = (item) => thicknessOf(item, plan)
  return faceQuads(wall, openings, walls.length ? walls : [wall], thick)
}

function pointInQuad(point, quad) {
  return pointInPolygon(point.x, point.z, quad)
}

export function cornerCovered(plan) {
  if (!plan?.walls?.length) return false
  const box = planBounds(plan)
  const corner = { x: box.minX, z: box.minZ }
  const probe = { x: corner.x - 0.06, z: corner.z - 0.06 }
  return (plan.walls || []).some((wall) => wallQuads(wall, plan.openings, plan.walls, plan).some((quad) => pointInQuad(probe, quad)))
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
  ;[
    [{ x: 3.2, z: 0 }, 'door'],
    [{ x: 9.2, z: 0 }, 'window'],
    [{ x: 12, z: 2.4 }, 'window'],
    [{ x: 2.2, z: 9 }, 'window'],
    [{ x: 0, z: 2.4 }, 'window'],
    [{ x: 0, z: 7.2 }, 'window'],
    [{ x: 7, z: 2.8 }, 'door'],
    [{ x: 2.2, z: 5.5 }, 'door'],
    [{ x: 6.4, z: 5.5 }, 'door'],
    [{ x: 9.6, z: 5.5 }, 'door'],
  ].forEach(([point, kind]) => {
    const hit = nearestWall(plan.walls, point, 0.35)
    if (hit) plan = addOpening(plan, hit.wall.id, point, kind)
  })
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

export function familyHouse() {
  let plan = emptyPlan('Omakotitalo')
  plan = { ...plan, address: 'Kuusitie 4', exteriorId: 'cladding', roofId: 'metal', roofType: 'gable' }
  const outer = [[0, 0], [12, 0], [12, 9], [0, 9], [0, 0]]
  for (let i = 0; i < outer.length - 1; i += 1) {
    plan = addWall(plan, { x: outer[i][0], z: outer[i][1] }, { x: outer[i + 1][0], z: outer[i + 1][1] }, 'exterior')
  }
  const specs = [
    ['Eteinen', 'eteinen', 0, 0, 3.5, 5, 'laminate', 'paint'],
    ['Olohuone', 'olohuone', 3.5, 0, 8, 5, 'parquet', 'paint'],
    ['Keittiö', 'keittio', 8, 0, 12, 5, 'tile', 'tile'],
    ['Makuuhuone', 'makuuhuone', 0, 5, 4, 9, 'laminate', 'wallpaper'],
    ['Makuuhuone', 'makuuhuone', 4, 5, 8, 9, 'parquet', 'wallpaper'],
    ['Kylpyhuone', 'kylpyhuone', 8, 5, 10, 9, 'tile', 'tile'],
    ['Sauna', 'sauna', 10, 5, 12, 9, 'tile', 'panel'],
  ]
  specs.forEach(([name, type, x0, z0, x1, z1, floorId, interiorId]) => {
    plan = drawRoom(plan, [
      { x: x0, z: z0 },
      { x: x1, z: z0 },
      { x: x1, z: z1 },
      { x: x0, z: z1 },
    ], { name, type, partitions: true, floorId, interiorId, ceilingId: 'paint' })
  })
  const openAt = (point, kind) => {
    let best = null
    ;(plan.walls || []).forEach((wall) => {
      const hit = nearestWall([wall], point, 0.4)
      if (!hit) return
      if (!best || hit.dist < best.dist) best = { id: wall.id, dist: hit.dist }
    })
    if (best) plan = addOpening(plan, best.id, point, kind)
  }
  ;[
    [{ x: 1.7, z: 0 }, 'door'],
    [{ x: 3.5, z: 2.4 }, 'door'],
    [{ x: 8, z: 2.3 }, 'door'],
    [{ x: 2, z: 5 }, 'door'],
    [{ x: 6, z: 5 }, 'door'],
    [{ x: 9, z: 5 }, 'door'],
    [{ x: 10, z: 7 }, 'door'],
    [{ x: 5.6, z: 0 }, 'window'],
    [{ x: 10.1, z: 0 }, 'window'],
    [{ x: 0, z: 2.4 }, 'window'],
    [{ x: 0, z: 7 }, 'window'],
    [{ x: 12, z: 2.4 }, 'window'],
    [{ x: 12, z: 7 }, 'window'],
    [{ x: 2, z: 9 }, 'window'],
    [{ x: 6, z: 9 }, 'window'],
    [{ x: 11, z: 9 }, 'window'],
  ].forEach(([point, kind]) => openAt(point, kind))
  return plan
}
