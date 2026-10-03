import { jsPDF } from 'jspdf'
import { COVER_TYPES, normalizeCover } from './covers.js'
import {
  GROUND_AREA_KINDS,
  GROUND_COLLECTIONS,
  GROUND_LINE_KINDS,
  GROUND_TOOLS,
  duplicateGroundItem,
  mapGroundItem,
  normalizeGround,
  normalizeWaste,
  plantPumpSpecs,
  removeGroundItem,
  wasteUnitSpec,
  yardHasUnderground,
} from './groundworks.js'
import { pdfAscii, translate } from './i18n.js'
import { planBounds, pointInPolygon, polygonArea, segmentLength } from './floorplan.js'
import { applyHeating, ensureServices, rewireElectric, rewireWater, syncGroundworks } from './services.js'
import { normalizeHeating } from './hydronic.js'

export const TERRACE_MATERIALS = [
  { id: 'wood', name: 'Puuterassi', color: '#d7b48c' },
  { id: 'composite', name: 'Komposiitti', color: '#8d8478' },
  { id: 'paving', name: 'Kivetys', color: '#c4bfb4' },
  { id: 'concrete', name: 'Betoni', color: '#b7b7b4' },
]

export const PATH_MATERIALS = [
  { id: 'gravel', name: 'Sora', color: '#c4b49a' },
  { id: 'paving', name: 'Kivetys', color: '#b7b1a6' },
  { id: 'asphalt', name: 'Asfaltti', color: '#6b7280' },
  { id: 'grass', name: 'Nurmi', color: '#8ea56a' },
]

export const PATH_KINDS = [
  { id: 'path', name: 'Kävelyreitti', width: 1.2 },
  { id: 'drive', name: 'Ajotie', width: 3 },
  { id: 'parking', name: 'Pysäköinti', width: 2.5 },
]

export const FENCE_KINDS = [
  { id: 'wood', name: 'Lauta-aita', height: 1.2 },
  { id: 'mesh', name: 'Verkkoaita', height: 1.5 },
  { id: 'hedge', name: 'Pensasaita', height: 1.6 },
  { id: 'stone', name: 'Kiviaita', height: 0.8 },
]

export const PLANTS = [
  { id: 'deciduous', name: 'Lehtipuu', canopy: 5 },
  { id: 'conifer', name: 'Havupuu', canopy: 3.5 },
  { id: 'fruit', name: 'Hedelmäpuu', canopy: 3 },
  { id: 'bush', name: 'Pensas', canopy: 1.4 },
  { id: 'hedge', name: 'Pensasaita', canopy: 1.2 },
]

export const BEDS = [
  { id: 'lawn', name: 'Nurmikko' },
  { id: 'flowerbed', name: 'Kukkapenkki' },
]

export const OBJECTS = [
  { id: 'gazebo', name: 'Grillikatos', w: 3.2, d: 3.2 },
  { id: 'grill', name: 'Puutarhagrilli', w: 0.7, d: 0.55 },
  { id: 'firepit', name: 'Nuotiopaikka', w: 1.3, d: 1.3 },
  { id: 'well', name: 'Kaivo', w: 1.1, d: 1.1, water: 'well' },
  { id: 'mailbox', name: 'Postilaatikko', w: 0.45, d: 0.35 },
  { id: 'light-pole', name: 'Pihavalaisin', w: 0.4, d: 0.4, electric: { kind: 'light', role: 'light', name: 'Pihavalaisin IP65', voltage: 230, power: 40, y: 2.5, ip: 'IP65', dedicated: false } },
  { id: 'light-bollard', name: 'Pollarivalaisin', w: 0.28, d: 0.28, electric: { kind: 'light', role: 'light', name: 'Pollari IP65', voltage: 230, power: 12, y: 0.55, ip: 'IP65', dedicated: false } },
  { id: 'flagpole', name: 'Lipputanko', w: 0.35, d: 0.35 },
  { id: 'playground', name: 'Leikkipaikka', w: 3.2, d: 2.4 },
  { id: 'bench', name: 'Puutarhapenkki', w: 1.6, d: 0.6 },
  { id: 'table', name: 'Puutarhapöytä', w: 1.5, d: 0.9 },
  { id: 'trash', name: 'Jätekatos', w: 2.4, d: 1.2 },
  { id: 'compost', name: 'Komposti', w: 1.1, d: 1.1 },
  { id: 'hottub', name: 'Poreallas', w: 2, d: 2, electric: { kind: 'hottub', role: 'power', name: 'Poreallas IP55', voltage: 230, power: 3000, y: 0.4, ip: 'IP55', dedicated: true } },
  { id: 'rainwell', name: 'Sadevesikaivo', w: 0.8, d: 0.8, water: 'rainwell' },
  { id: 'gate-opener', name: 'Portinavaaja', w: 0.4, d: 0.28, electric: { kind: 'gate', role: 'power', name: 'Portinavaaja IP54', voltage: 230, power: 200, y: 0.4, ip: 'IP54', dedicated: true } },
  { id: 'charger', name: 'Autolaturi', w: 0.45, d: 0.25, electric: { kind: 'ev', role: 'power', name: 'Autolaturi IP54', voltage: 400, power: 11000, y: 1.1, ip: 'IP54', dedicated: true } },
]

export const BUILDINGS = [
  { id: 'garage', name: 'Autotalli', w: 6, d: 6, height: 2.8, roof: 'gable' },
  { id: 'carport', name: 'Autokatos', w: 6, d: 5.5, height: 2.4, roof: 'shed' },
  { id: 'shed', name: 'Varasto', w: 3, d: 2.4, height: 2.4, roof: 'gable' },
  { id: 'sauna', name: 'Pihassauna', w: 3.5, d: 3, height: 2.6, roof: 'gable' },
]

export const ROOF_NAMES = [
  { id: 'gable', name: 'Harja' },
  { id: 'shed', name: 'Pulpetti' },
  { id: 'flat', name: 'Tasakatto' },
  { id: 'hip', name: 'Auma' },
]

const POINT_COLLECTIONS = new Set(['plants', 'objects', 'buildings'])

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function ascii(value) {
  return pdfAscii(value)
}

export function emptyYard() {
  return {
    north: 0,
    plot: null,
    terraces: [],
    paths: [],
    fences: [],
    plants: [],
    beds: [],
    objects: [],
    buildings: [],
    covers: [],
    ground: { mode: 'borehole', wells: [], loop: null, water: [] },
    waste: { mode: 'municipal', units: [], areas: [], lines: [] },
  }
}

export function ensureYard(plan) {
  const yard = plan?.yard || {}
  const list = (key) => (Array.isArray(yard[key]) ? yard[key] : [])
  return {
    north: Number(yard.north) || 0,
    plot: yard.plot?.points?.length >= 3 ? { id: yard.plot.id || 'plot', points: yard.plot.points } : null,
    terraces: list('terraces'),
    paths: list('paths'),
    fences: list('fences'),
    plants: list('plants'),
    beds: list('beds'),
    objects: list('objects'),
    buildings: list('buildings'),
    covers: list('covers'),
    ground: normalizeGround(yard.ground),
    waste: normalizeWaste(yard.waste),
  }
}

export function hasYard(plan) {
  const yard = ensureYard(plan)
  return Boolean(yard.plot) || yardHasUnderground(yard) || ['terraces', 'paths', 'fences', 'plants', 'beds', 'objects', 'buildings', 'covers'].some((key) => yard[key].length)
}

export function plantSpec(id) {
  return PLANTS.find((item) => item.id === id) || PLANTS[0]
}

export function objectSpec(id) {
  return OBJECTS.find((item) => item.id === id) || OBJECTS[0]
}

export function buildingSpec(id) {
  return BUILDINGS.find((item) => item.id === id) || BUILDINGS[0]
}

export function materialName(list, id) {
  return (list.find((item) => item.id === id) || list[0]).name
}

export function formatMetres(value) {
  const n = Math.round((Number(value) || 0) * 100) / 100
  return `${n.toFixed(2).replace('.', ',')} m`
}

export function formatSquare(value) {
  const n = Math.round((Number(value) || 0) * 10) / 10
  return `${n.toFixed(1).replace('.', ',')} m²`
}

function boundsOf(points, seed) {
  return (points || []).reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), seed || { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

export function footprint(item) {
  const w = item.w || 1
  const d = item.d || 1
  const rot = ((item.rotation || 0) * Math.PI) / 180
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => ({
    x: (item.x || 0) + lx * c - lz * s,
    z: (item.z || 0) + lx * s + lz * c,
  }))
}

export function centroid(points) {
  if (!points?.length) return { x: 0, z: 0 }
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
  return { x: sum.x / points.length, z: sum.z / points.length }
}

export function yardBounds(plan) {
  const yard = ensureYard(plan)
  const points = []
  if (yard.plot) points.push(...yard.plot.points)
  yard.terraces.forEach((item) => points.push(...(item.points || [])))
  yard.paths.forEach((item) => points.push(...(item.points || [])))
  yard.fences.forEach((item) => points.push(...(item.points || [])))
  yard.beds.forEach((item) => points.push(...(item.points || [])))
  yard.plants.forEach((item) => points.push({ x: item.x, z: item.z }))
  yard.objects.forEach((item) => points.push(...footprint(item)))
  yard.buildings.forEach((item) => points.push(...footprint({ ...buildingSpec(item.kind), ...item })))
  yard.covers.forEach((item) => points.push(...(item.points || [])))
  yard.ground.wells.forEach((item) => {
    points.push({ x: item.x - 20, z: item.z - 20 }, { x: item.x + 20, z: item.z + 20 })
  })
  if (yard.ground.loop) points.push(...yard.ground.loop.points)
  yard.ground.water.forEach((item) => points.push(...(item.points || [])))
  yard.waste.units.forEach((item) => points.push(...footprint(item)))
  yard.waste.areas.forEach((item) => points.push(...(item.points || [])))
  yard.waste.lines.forEach((item) => points.push(...(item.points || [])))
  if (!points.length) {
    const box = planBounds(plan)
    return { minX: box.minX - 8, maxX: box.maxX + 8, minZ: box.minZ - 8, maxZ: box.maxZ + 8 }
  }
  return boundsOf(points)
}

export function sceneBounds(plan) {
  const house = planBounds(plan)
  if (!hasYard(plan)) return house
  const yard = yardBounds(plan)
  return {
    minX: Math.min(house.minX, yard.minX),
    maxX: Math.max(house.maxX, yard.maxX),
    minZ: Math.min(house.minZ, yard.minZ),
    maxZ: Math.max(house.maxZ, yard.maxZ),
  }
}

export function houseBox(plan) {
  const walls = (plan?.walls || []).filter((wall) => wall.kind !== 'interior')
  const source = walls.length ? walls : (plan?.walls || [])
  const points = source.flatMap((wall) => [wall.a, wall.b]).filter(Boolean)
  if (!points.length) return null
  return boundsOf(points)
}

function distToSegment(point, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return Math.hypot(point.x - a.x, point.z - a.z)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2))
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t))
}

function distToPolyline(point, points) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i += 1) best = Math.min(best, distToSegment(point, points[i], points[i + 1]))
  return best
}

export function plotMetrics(plan) {
  const points = ensureYard(plan).plot?.points || []
  if (points.length < 3) return { area: 0, perimeter: 0, edges: [] }
  const edges = points.map((a, index) => {
    const b = points[(index + 1) % points.length]
    return { index, a, b, length: segmentLength(a, b) }
  })
  return {
    area: Math.abs(polygonArea(points)),
    perimeter: edges.reduce((sum, edge) => sum + edge.length, 0),
    edges,
  }
}

export function setbackList(plan) {
  const plot = ensureYard(plan).plot?.points || []
  const house = houseBox(plan)
  if (plot.length < 3 || !house) return []
  const corners = [
    { x: house.minX, z: house.minZ },
    { x: house.maxX, z: house.minZ },
    { x: house.maxX, z: house.maxZ },
    { x: house.minX, z: house.maxZ },
  ]
  return plot.map((a, index) => {
    const b = plot[(index + 1) % plot.length]
    const dist = Math.min(...corners.map((corner) => distToSegment(corner, a, b)))
    return { index, a, b, length: segmentLength(a, b), dist, label: formatMetres(dist) }
  })
}

export function hitTestYard(plan, point, tol = 0.35) {
  const yard = ensureYard(plan)
  const near = (item, radius) => Math.hypot((item.x || 0) - point.x, (item.z || 0) - point.z) <= radius
  for (const item of yard.objects) {
    const spec = objectSpec(item.kind)
    if (near(item, Math.max(tol, Math.max(item.w || spec.w, item.d || spec.d) * 0.55))) {
      return { kind: 'yard', collection: 'objects', id: item.id, movable: true }
    }
  }
  for (const item of yard.plants) {
    const canopy = item.canopy || plantSpec(item.kind).canopy
    if (near(item, Math.max(tol, Math.min(1.1, canopy * 0.38)))) {
      return { kind: 'yard', collection: 'plants', id: item.id, movable: true }
    }
  }
  for (const item of yard.buildings) {
    const spec = buildingSpec(item.kind)
    if (pointInPolygon(point.x, point.z, footprint({ ...spec, ...item }))) {
      return { kind: 'yard', collection: 'buildings', id: item.id, movable: true }
    }
  }
  for (const item of yard.fences) {
    if ((item.points || []).length >= 2 && distToPolyline(point, item.points) <= Math.max(tol, 0.28)) {
      return { kind: 'yard', collection: 'fences', id: item.id, movable: false }
    }
  }
  for (const item of yard.paths) {
    const width = item.width || PATH_KINDS.find((entry) => entry.id === item.kind)?.width || 1.2
    if ((item.points || []).length >= 2 && distToPolyline(point, item.points) <= width / 2 + 0.08) {
      return { kind: 'yard', collection: 'paths', id: item.id, movable: false }
    }
  }
  for (const item of yard.ground.wells) {
    if (near(item, 0.9)) return { kind: 'yard', collection: 'wells', id: item.id, movable: true }
  }
  for (const item of yard.waste.units) {
    if (near(item, Math.max(tol, Math.max(item.w || 1, item.d || 1) * 0.6))) {
      return { kind: 'yard', collection: 'waste-units', id: item.id, movable: true }
    }
  }
  for (const item of yard.waste.lines) {
    if ((item.points || []).length >= 2 && distToPolyline(point, item.points) <= Math.max(tol, 0.35)) {
      return { kind: 'yard', collection: 'waste-lines', id: item.id, movable: false }
    }
  }
  for (const item of yard.waste.areas) {
    if (pointInPolygon(point.x, point.z, item.points || [])) return { kind: 'yard', collection: 'waste-areas', id: item.id, movable: false }
  }
  if (yard.ground.loop && pointInPolygon(point.x, point.z, yard.ground.loop.points || [])) {
    return { kind: 'yard', collection: 'loop', id: yard.ground.loop.id, movable: false }
  }
  for (const item of yard.ground.water) {
    if (pointInPolygon(point.x, point.z, item.points || [])) return { kind: 'yard', collection: 'water', id: item.id, movable: false }
  }
  for (const item of yard.covers) {
    if (pointInPolygon(point.x, point.z, item.points || [])) return { kind: 'yard', collection: 'covers', id: item.id, movable: false }
  }
  for (const item of yard.terraces) {
    if (pointInPolygon(point.x, point.z, item.points || [])) return { kind: 'yard', collection: 'terraces', id: item.id, movable: false }
  }
  for (const item of yard.beds) {
    if (pointInPolygon(point.x, point.z, item.points || [])) return { kind: 'yard', collection: 'beds', id: item.id, movable: false }
  }
  if (yard.plot && pointInPolygon(point.x, point.z, yard.plot.points)) {
    return { kind: 'yard', collection: 'plot', id: yard.plot.id, movable: false }
  }
  return null
}

export function snapYardPoint(point, plan, { grid = 0.1, radius = 0.35, origin = null, ortho = false } = {}) {
  const yard = ensureYard(plan)
  const candidates = []
  const push = (x, z, kind) => candidates.push({ x, z, kind, d: Math.hypot(x - point.x, z - point.z) })
  const vertices = []
  if (yard.plot) vertices.push(...yard.plot.points)
  ;(plan.walls || []).forEach((wall) => vertices.push(wall.a, wall.b))
  yard.buildings.forEach((item) => vertices.push(...footprint({ ...buildingSpec(item.kind), ...item })))
  yard.covers.forEach((item) => vertices.push(...(item.points || [])))
  vertices.forEach((vertex) => { if (vertex) push(vertex.x, vertex.z, 'corner') })
  if (grid > 0) push(Math.round(point.x / grid) * grid, Math.round(point.z / grid) * grid, 'grid')
  let best = candidates.filter((item) => item.d <= radius).sort((a, b) => a.d - b.d)[0]
  let next = best ? { x: round3(best.x), z: round3(best.z) } : { x: round3(point.x), z: round3(point.z) }
  if (ortho && origin) {
    const dx = Math.abs(next.x - origin.x)
    const dz = Math.abs(next.z - origin.z)
    next = dx >= dz ? { x: next.x, z: origin.z } : { x: origin.x, z: next.z }
  }
  return { point: next, kind: best?.kind || (ortho ? 'edge' : 'grid') }
}

function issue(plan) {
  const seq = (plan?.seq || 1) + 1
  return { seq, id: `yard-${seq}` }
}

function attachWall(plan, points) {
  let best = null
  ;(plan.walls || []).filter((wall) => wall.kind !== 'interior').forEach((wall) => {
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length]
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
      const dist = distToSegment(mid, wall.a, wall.b)
      if (dist < 0.45 && (!best || dist < best.dist)) best = { dist, id: wall.id }
    })
  })
  return best?.id || ''
}

export function setPlot(plan, points) {
  if (!points || points.length < 3) return plan
  const yard = ensureYard(plan)
  const id = yard.plot?.id || issue(plan).id
  const seq = yard.plot ? plan.seq : (plan.seq || 1) + 1
  return { ...plan, seq, yard: { ...yard, plot: { id, points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })) } } }
}

export function addTerrace(plan, points, extra = {}) {
  if (!points || points.length < 3) return plan
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = {
    id,
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
    material: extra.material || 'wood',
    railing: extra.railing !== false,
    steps: Boolean(extra.steps),
    wallId: extra.wallId || attachWall(plan, points),
  }
  return { ...plan, seq, yard: { ...yard, terraces: [...yard.terraces, item] } }
}

export function addPath(plan, points, extra = {}) {
  if (!points || points.length < 2) return plan
  const kind = PATH_KINDS.some((item) => item.id === extra.kind) ? extra.kind : 'path'
  const spec = PATH_KINDS.find((item) => item.id === kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = {
    id,
    kind,
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
    width: Number(extra.width) || spec.width,
    material: extra.material || (kind === 'drive' ? 'asphalt' : kind === 'parking' ? 'paving' : 'gravel'),
  }
  return { ...plan, seq, yard: { ...yard, paths: [...yard.paths, item] } }
}

export function addFence(plan, points, extra = {}) {
  if (!points || points.length < 2) return plan
  const kind = FENCE_KINDS.some((item) => item.id === extra.kind) ? extra.kind : 'wood'
  const spec = FENCE_KINDS.find((item) => item.id === kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = {
    id,
    kind,
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
    height: Number(extra.height) || spec.height,
    gates: Array.isArray(extra.gates) ? extra.gates : [],
  }
  return { ...plan, seq, yard: { ...yard, fences: [...yard.fences, item] } }
}

export function addBed(plan, points, kind = 'lawn') {
  if (!points || points.length < 3) return plan
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = {
    id,
    kind: kind === 'flowerbed' ? 'flowerbed' : 'lawn',
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
  }
  return { ...plan, seq, yard: { ...yard, beds: [...yard.beds, item] } }
}

export function addPlant(plan, kind, x, z, canopy) {
  const spec = plantSpec(kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = { id, kind: spec.id, x: round3(x), z: round3(z), canopy: Number(canopy) || spec.canopy }
  return { ...plan, seq, yard: { ...yard, plants: [...yard.plants, item] } }
}

export function addObject(plan, kind, x, z, rotation = 0, options = {}) {
  const spec = objectSpec(kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = { id, kind: spec.id, x: round3(x), z: round3(z), rotation, w: spec.w, d: spec.d }
  const next = { ...plan, seq, yard: { ...yard, objects: [...yard.objects, item] } }
  if (options.sync === false || (!spec.electric && !spec.water)) return next
  return syncYardServices(next)
}

export function addBuilding(plan, kind, x, z, rotation = 0) {
  const spec = buildingSpec(kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const item = { id, kind: spec.id, x: round3(x), z: round3(z), rotation, w: spec.w, d: spec.d, height: spec.height, roof: spec.roof }
  return { ...plan, seq, yard: { ...yard, buildings: [...yard.buildings, item] } }
}

export function addCover(plan, points, extra = {}) {
  if (!points || points.length < 3) return plan
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const wallId = extra.wallId || attachWall(plan, points)
  const item = normalizeCover({
    ...extra,
    id,
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
    wallId,
  })
  const next = { ...plan, seq, yard: { ...yard, covers: [...yard.covers, item] } }
  return item.lights || item.heaters ? syncYardServices(next) : next
}

const GROUND_SET = new Set(GROUND_COLLECTIONS)

export function updateYardItem(plan, collection, id, patch) {
  const yard = ensureYard(plan)
  if (collection === 'north') return { ...plan, yard: { ...yard, north: Number(patch.north) || 0 } }
  if (collection === 'plot') {
    const plot = { ...(yard.plot || { id: id || 'plot', points: [] }), ...patch }
    return { ...plan, yard: { ...yard, plot } }
  }
  if (collection === 'wells') {
    const ground = normalizeGround(yard.ground)
    ground.wells = ground.wells.map((item) => {
      if (item.id !== id) return item
      const next = { ...item, ...patch, id: item.id }
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'depth')) next.depthManual = true
      return next
    })
    return syncGroundworks({ ...plan, yard: { ...yard, ground } })
  }
  if (collection === 'waste-units') {
    const waste = normalizeWaste(yard.waste)
    waste.units = waste.units.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item))
    return syncYardServices({ ...plan, yard: { ...yard, waste } })
  }
  if (collection === 'waste-areas' || collection === 'waste-lines' || collection === 'water' || collection === 'loop') {
    const mapped = mapGroundItem(yard, collection, id, (point) => point)
    if (!mapped) return plan
    if (collection === 'waste-areas') {
      mapped.waste.areas = mapped.waste.areas.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, points: patch.points || item.points } : item))
    } else if (collection === 'waste-lines') {
      mapped.waste.lines = mapped.waste.lines.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, points: patch.points || item.points } : item))
    } else if (collection === 'water') {
      mapped.ground.water = mapped.ground.water.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, points: patch.points || item.points } : item))
    } else if (mapped.ground.loop && mapped.ground.loop.id === id) {
      mapped.ground.loop = { ...mapped.ground.loop, ...patch, id: mapped.ground.loop.id, points: patch.points || mapped.ground.loop.points }
    }
    return syncGroundworks({ ...plan, yard: mapped })
  }
  if (collection === 'covers') {
    const covers = yard.covers.map((item) => (item.id === id ? normalizeCover({ ...item, ...patch, id: item.id }) : item))
    return syncYardServices({ ...plan, yard: { ...yard, covers } })
  }
  const list = (yard[collection] || []).map((item) => (item.id === id ? { ...item, ...patch } : item))
  const next = { ...plan, yard: { ...yard, [collection]: list } }
  if (collection === 'objects') return syncYardServices(next)
  return next
}

export function moveYardItem(plan, collection, id, x, z) {
  const yard = ensureYard(plan)
  if (collection === 'wells' || collection === 'waste-units') {
    const mapped = mapGroundItem(yard, collection, id, () => ({ x, z }))
    if (!mapped) return plan
    const next = { ...plan, yard: mapped }
    return collection === 'waste-units' ? syncYardServices(next) : syncGroundworks(next)
  }
  if (!POINT_COLLECTIONS.has(collection)) return plan
  return {
    ...plan,
    yard: {
      ...yard,
      [collection]: yard[collection].map((item) => (item.id === id ? { ...item, x: round3(x), z: round3(z) } : item)),
    },
  }
}

export function rotateYardItem(plan, collection, id, delta = 90) {
  if (!POINT_COLLECTIONS.has(collection) || collection === 'plants') return plan
  const yard = ensureYard(plan)
  return {
    ...plan,
    yard: {
      ...yard,
      [collection]: yard[collection].map((item) => (item.id === id ? { ...item, rotation: Math.round(((item.rotation || 0) + delta) % 360) } : item)),
    },
  }
}

export function duplicateYardItem(plan, collection, id) {
  const yard = ensureYard(plan)
  if (collection === 'plot') return plan
  if (GROUND_SET.has(collection)) {
    const { seq, id: nextId } = issue(plan)
    const copied = duplicateGroundItem(yard, collection, id, nextId)
    if (copied === yard) return plan
    const next = { ...plan, seq, yard: copied }
    return collection === 'waste-units' ? syncYardServices(next) : syncGroundworks(next)
  }
  const item = (yard[collection] || []).find((entry) => entry.id === id)
  if (!item) return plan
  const { seq, id: nextId } = issue(plan)
  const copy = { ...item, id: nextId }
  if (Array.isArray(copy.points)) copy.points = copy.points.map((point) => ({ x: round3(point.x + 0.8), z: round3(point.z + 0.8) }))
  if (Number.isFinite(copy.x)) {
    copy.x = round3(copy.x + 0.8)
    copy.z = round3(copy.z + 0.8)
  }
  const next = { ...plan, seq, yard: { ...yard, [collection]: [...yard[collection], copy] } }
  return collection === 'objects' || collection === 'covers' ? syncYardServices(next) : next
}

export function deleteYardItem(plan, collection, id) {
  const yard = ensureYard(plan)
  if (collection === 'plot') return syncYardServices({ ...plan, yard: { ...yard, plot: null } })
  if (GROUND_SET.has(collection)) {
    const removed = removeGroundItem(yard, collection, id)
    const next = { ...plan, yard: removed }
    return collection === 'waste-units' ? syncYardServices(next) : syncGroundworks(next)
  }
  const next = { ...plan, yard: { ...yard, [collection]: (yard[collection] || []).filter((item) => item.id !== id) } }
  return collection === 'objects' || collection === 'covers' ? syncYardServices(next) : next
}

export function yardItem(plan, collection, id) {
  const yard = ensureYard(plan)
  if (collection === 'plot') return yard.plot
  if (collection === 'wells') return yard.ground.wells.find((item) => item.id === id) || null
  if (collection === 'loop') return yard.ground.loop && yard.ground.loop.id === id ? yard.ground.loop : null
  if (collection === 'water') return yard.ground.water.find((item) => item.id === id) || null
  if (collection === 'waste-units') return yard.waste.units.find((item) => item.id === id) || null
  if (collection === 'waste-areas') return yard.waste.areas.find((item) => item.id === id) || null
  if (collection === 'waste-lines') return yard.waste.lines.find((item) => item.id === id) || null
  return (yard[collection] || []).find((item) => item.id === id) || null
}

export function yardTitle(plan, hit) {
  if (!hit) return 'Piha'
  if (hit.collection === 'plot') return 'Tontti'
  if (hit.collection === 'north') return 'Pohjoinen'
  const item = yardItem(plan, hit.collection, hit.id)
  if (!item) return 'Piha'
  if (hit.collection === 'plants') return plantSpec(item.kind).name
  if (hit.collection === 'objects') return objectSpec(item.kind).name
  if (hit.collection === 'buildings') return buildingSpec(item.kind).name
  if (hit.collection === 'terraces') return 'Terassi'
  if (hit.collection === 'paths') return PATH_KINDS.find((entry) => entry.id === item.kind)?.name || 'Reitti'
  if (hit.collection === 'fences') return FENCE_KINDS.find((entry) => entry.id === item.kind)?.name || 'Aita'
  if (hit.collection === 'beds') return BEDS.find((entry) => entry.id === item.kind)?.name || 'Alue'
  if (hit.collection === 'covers') return COVER_TYPES.find((entry) => entry.id === item.kind)?.name || 'Katos'
  if (hit.collection === 'wells') return 'Energiakaivo'
  if (hit.collection === 'loop') return 'Vaakaputkisto'
  if (hit.collection === 'water') return 'Vesistö'
  if (hit.collection === 'waste-units') return wasteUnitSpec(item.kind).name
  if (hit.collection === 'waste-areas') return GROUND_AREA_KINDS.find((entry) => entry.id === item.kind)?.name || 'Käsittelykenttä'
  if (hit.collection === 'waste-lines') return GROUND_LINE_KINDS.find((entry) => entry.id === item.kind)?.name || 'Putki'
  return 'Piha'
}

function upsert(nodes, spec, seq) {
  const existing = nodes.find((node) => node.linkedFrom === spec.linkedFrom && node.system === spec.system)
  if (existing) {
    return nodes.map((node) => (node === existing ? { ...node, ...spec, id: node.id, circuitMode: node.circuitMode || spec.circuitMode, circuit: node.circuit } : node))
  }
  seq.n += 1
  nodes.push({ id: `svc-${seq.n}`, ...spec })
  return nodes
}

export function syncYardServices(plan) {
  const yard = ensureYard(plan)
  const services = ensureServices(plan)
  const seq = { n: plan?.seq || 1 }
  const electric = []
  const water = []
  yard.objects.forEach((item) => {
    const spec = objectSpec(item.kind)
    if (spec.electric) {
      electric.push({
        system: 'electric',
        kind: spec.electric.kind,
        role: spec.electric.role,
        name: spec.electric.name,
        voltage: spec.electric.voltage,
        power: spec.electric.power,
        cosPhi: 1,
        connection: 'fixed',
        dedicated: Boolean(spec.electric.dedicated),
        outdoor: true,
        rcd: true,
        ip: spec.electric.ip,
        circuitMode: 'auto',
        linkedFrom: `yard:${item.id}`,
        roomId: 'piha',
        roomName: 'Piha',
        x: round3(item.x),
        z: round3(item.z),
        y: spec.electric.y,
      })
    }
    if (spec.water) {
      water.push({
        system: 'water',
        kind: 'water-point',
        pointType: spec.water,
        name: spec.name,
        linkedFrom: `yard:${item.id}`,
        outdoor: true,
        x: round3(item.x),
        z: round3(item.z),
        y: 0.15,
      })
    }
  })
  yard.covers.forEach((raw) => {
    const item = normalizeCover(raw)
    if ((item.points || []).length < 3 || (!item.lights && !item.heaters)) return
    const at = centroid(item.points)
    const base = {
      system: 'electric',
      cosPhi: 1,
      connection: 'fixed',
      outdoor: true,
      rcd: true,
      ip: 'IP65',
      circuitMode: 'auto',
      roomId: 'piha',
      roomName: 'Piha',
      x: round3(at.x),
      z: round3(at.z),
    }
    if (item.lights) {
      electric.push({
        ...base,
        kind: 'light',
        role: 'light',
        name: `${item.name} valaisin`,
        voltage: 230,
        power: 80,
        dedicated: false,
        linkedFrom: `yard:cover:${item.id}:light`,
        y: round3(Math.max(1.6, item.height - 0.15)),
      })
    }
    if (item.heaters) {
      electric.push({
        ...base,
        kind: 'patio-heater',
        role: 'power',
        name: `${item.name} lämmitin`,
        voltage: 230,
        power: 2000,
        dedicated: true,
        linkedFrom: `yard:cover:${item.id}:heater`,
        y: round3(Math.max(1.4, item.height - 0.35)),
      })
    }
  })
  plantPumpSpecs({ ...plan, yard }).forEach((spec) => electric.push(spec))
  const keep = new Set([...electric, ...water].map((item) => item.linkedFrom))
  let nodes = (services.nodes || []).filter((node) => !node.linkedFrom || !String(node.linkedFrom).startsWith('yard:') || keep.has(node.linkedFrom))
  if (electric.length && !nodes.some((node) => node.system === 'electric' && node.kind === 'panel')) {
    const box = planBounds(plan)
    seq.n += 1
    nodes.push({
      id: `svc-${seq.n}`,
      system: 'electric',
      kind: 'panel',
      name: 'Sähkökeskus',
      voltage: 400,
      x: round3(box.minX + 1.2),
      z: round3(box.minZ + 1.4),
      y: 1.5,
    })
  }
  electric.forEach((spec) => { nodes = upsert(nodes, spec, seq) })
  water.forEach((spec) => { nodes = upsert(nodes, spec, seq) })
  const seeded = { ...plan, seq: seq.n, yard, services: { ...services, nodes } }
  return syncGroundworks(rewireWater(rewireElectric(seeded)))
}

export function addEnergyWell(plan, x, z) {
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const ground = normalizeGround(yard.ground)
  ground.mode = 'borehole'
  ground.wells = [...ground.wells, { id, x: round3(x), z: round3(z), depth: 0, depthManual: false }]
  const next = { ...plan, seq, yard: { ...yard, ground } }
  const heating = normalizeHeating(next)
  if (heating.source !== 'ground' || heating.borehole === false) {
    return applyHeating(next, { source: 'ground', borehole: true })
  }
  return syncGroundworks(next)
}

export function addWasteUnit(plan, kind, x, z) {
  const spec = wasteUnitSpec(kind)
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const waste = normalizeWaste(yard.waste)
  waste.mode = 'onsite'
  waste.units = [...waste.units, {
    id,
    kind: spec.id,
    x: round3(x),
    z: round3(z),
    w: spec.w,
    d: spec.d,
    rotation: 0,
    volume: spec.volume || 0,
    chambers: spec.chambers || 0,
    accessNote: spec.id === 'holding' ? 'Tyhjennysauto pääsee säiliölle' : '',
    pump: Boolean(spec.pump),
  }]
  const next = { ...plan, seq, yard: { ...yard, waste } }
  return spec.pump ? syncYardServices(next) : syncGroundworks(next)
}

export function addGroundArea(plan, kind, points) {
  if (!points || points.length < 3) return plan
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const rounded = points.map((point) => ({ x: round3(point.x), z: round3(point.z) }))
  if (kind === 'loop') {
    const ground = normalizeGround(yard.ground)
    ground.mode = 'loop'
    ground.loop = { id, points: rounded }
    return applyHeating({ ...plan, seq, yard: { ...yard, ground } }, { source: 'ground', borehole: false })
  }
  if (kind === 'waterbody') {
    const ground = normalizeGround(yard.ground)
    ground.water = [...ground.water, { id, kind: 'waterbody', points: rounded }]
    return { ...plan, seq, yard: { ...yard, ground } }
  }
  const waste = normalizeWaste(yard.waste)
  waste.mode = 'onsite'
  waste.areas = [...waste.areas, { id, kind: kind === 'sandfilter' ? 'sandfilter' : 'field', points: rounded }]
  return syncGroundworks({ ...plan, seq, yard: { ...yard, waste } })
}

export function addGroundLine(plan, kind, points) {
  if (!points || points.length < 2) return plan
  const { seq, id } = issue(plan)
  const yard = ensureYard(plan)
  const waste = normalizeWaste(yard.waste)
  const lineKind = kind === 'sewer' || kind === 'storm' ? kind : 'french'
  waste.mode = waste.units.length || waste.areas.length ? 'onsite' : waste.mode
  waste.lines = [...waste.lines, {
    id,
    kind: lineKind,
    points: points.map((point) => ({ x: round3(point.x), z: round3(point.z) })),
  }]
  return syncGroundworks({ ...plan, seq, yard: { ...yard, waste } })
}

export function addGroundDraw(plan, kind, points) {
  const spec = GROUND_TOOLS.find((item) => item.id === kind)
  if (!spec) return plan
  if (spec.mode === 'point') {
    const point = points?.[points.length - 1]
    if (!point) return plan
    if (kind === 'borehole') return addEnergyWell(plan, point.x, point.z)
    return addWasteUnit(plan, kind, point.x, point.z)
  }
  if (spec.mode === 'line') return addGroundLine(plan, kind, points)
  return addGroundArea(plan, kind, points)
}

export function applyExampleYard(plan) {
  let next = setPlot(plan, [
    { x: -8, z: -10 },
    { x: 22, z: -10 },
    { x: 24, z: 18 },
    { x: 14, z: 22 },
    { x: -10, z: 18 },
  ])
  next = addTerrace(next, [
    { x: 1.2, z: 0 },
    { x: 6.4, z: 0 },
    { x: 6.4, z: -3.4 },
    { x: 1.2, z: -3.4 },
  ], { material: 'wood', railing: true, steps: true })
  next = addBed(next, [
    { x: -7.2, z: -6 },
    { x: -0.4, z: -6 },
    { x: -0.4, z: 16.5 },
    { x: -7.2, z: 16.5 },
  ], 'lawn')
  next = addBed(next, [
    { x: 0.4, z: 9.4 },
    { x: 12, z: 9.4 },
    { x: 12, z: 16.2 },
    { x: 0.4, z: 16.2 },
  ], 'lawn')
  next = addBed(next, [
    { x: 7.1, z: -1.15 },
    { x: 10.6, z: -1.15 },
    { x: 10.6, z: -2.7 },
    { x: 7.1, z: -2.7 },
  ], 'flowerbed')
  next = addPath(next, [{ x: 3.5, z: -3.4 }, { x: 3.5, z: -9.4 }], { kind: 'path', material: 'paving', width: 1.2 })
  next = addPath(next, [{ x: 12.3, z: 2.4 }, { x: 22.6, z: 2.4 }, { x: 22.6, z: -9.5 }], { kind: 'drive', material: 'asphalt', width: 3 })
  next = addPath(next, [{ x: 14.2, z: 6.2 }, { x: 20.2, z: 6.2 }], { kind: 'parking', material: 'paving', width: 2.6 })
  next = addFence(next, [{ x: -7.4, z: -9.3 }, { x: 21.4, z: -9.3 }], { kind: 'wood', height: 1.2, gates: [{ segment: 0, offset: 8.6, width: 1.4 }] })
  next = addFence(next, [{ x: 21.6, z: -9.1 }, { x: 23.2, z: 17.2 }], { kind: 'mesh', height: 1.5, gates: [{ segment: 0, offset: 10.5, width: 3.2 }] })
  next = addFence(next, [{ x: 23, z: 17.4 }, { x: 14.2, z: 21.2 }, { x: -9.2, z: 17.4 }], { kind: 'stone', height: 0.7 })
  next = addFence(next, [{ x: -9.3, z: 17.2 }, { x: -7.5, z: -9.2 }], { kind: 'hedge', height: 1.6 })
  ;[
    ['deciduous', -4.2, 2.6, 5.5],
    ['conifer', -5.2, 7.2, 3.6],
    ['fruit', -4.4, 11.4, 3],
    ['bush', -2.2, 14.6, 1.5],
    ['hedge', -6.2, 4.8, 1.2],
    ['deciduous', 6.5, 13.2, 6],
    ['conifer', 18.5, 15.2, 4],
    ['fruit', 2.2, 12.4, 2.8],
    ['bush', 9.2, -2, 1.1],
  ].forEach(([kind, x, z, canopy]) => { next = addPlant(next, kind, x, z, canopy) })
  ;[
    ['gazebo', -3.2, 5.4, 0],
    ['grill', 8.6, -1.9, 0],
    ['firepit', 4.6, 12.8, 0],
    ['well', -5.6, 14.2, 0],
    ['mailbox', 2.2, -8.4, 0],
    ['light-pole', 4.6, -5.2, 0],
    ['light-bollard', 2.8, -6.4, 0],
    ['light-bollard', 5.4, -4.2, 0],
    ['flagpole', 11.2, -6.2, 0],
    ['playground', 16.4, 14.4, 0],
    ['bench', 3.2, -1.7, 0],
    ['table', 4.8, -1.6, 0],
    ['trash', 18.2, 11.6, 0],
    ['compost', -6.4, 10.2, 0],
    ['hottub', 9.2, -4.2, 0],
    ['rainwell', 19.4, 0.6, 0],
    ['gate-opener', 6.4, -8.8, 0],
    ['charger', 15.6, 8.6, 90],
  ].forEach(([kind, x, z, rotation]) => { next = addObject(next, kind, x, z, rotation, { sync: false }) })
  next = addBuilding(next, 'garage', 17.2, 9.2, 0)
  next = addBuilding(next, 'carport', 18.4, 16.2, 0)
  next = addBuilding(next, 'shed', -5.4, 16.2, 0)
  next = addBuilding(next, 'sauna', 8.2, 13.6, 0)
  return { ...next, yard: { ...ensureYard(next), north: 0 } }
}

export function siteViewLayout(plan) {
  const paper = plan?.paper === 'a4' ? 'a4' : 'a3'
  const pageW = paper === 'a4' ? 297 : 420
  const pageH = paper === 'a4' ? 210 : 297
  const margin = 12
  const titleW = 108
  const titleH = 64
  const raw = yardBounds(plan)
  const pad = 1.8
  const box = { minX: raw.minX - pad, maxX: raw.maxX + pad, minZ: raw.minZ - pad, maxZ: raw.maxZ + pad }
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const frame = { x: margin, y: margin, w: pageW - margin * 2, h: pageH - margin * 2 }
  const drawW = frame.w - titleW - 18
  const drawH = frame.h - 18
  const ratio = [100, 200, 500, 1000].find((item) => worldW * (1000 / item) <= drawW && worldH * (1000 / item) <= drawH) || 1000
  const scale = 1000 / ratio
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
    building: planBounds(plan),
    ox: frame.x + 12 + Math.max(0, (drawW - worldW * scale) / 2),
    oy: frame.y + 8 + Math.max(0, (drawH - worldH * scale) / 2),
    title: {
      x: frame.x + frame.w - titleW - 2,
      y: frame.y + frame.h - titleH - 2,
      w: titleW,
      h: titleH,
    },
  }
}

export function buildSitePdf(plan) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: plan?.paper === 'a4' ? 'a4' : 'a3' })
  const layout = siteViewLayout(plan)
  const yard = ensureYard(plan)
  const metrics = plotMetrics(plan)
  const { box, scale, ox, oy, frame, title } = layout
  const X = (x) => ox + (x - box.minX) * scale
  const Y = (z) => oy + (z - box.minZ) * scale
  doc.setDrawColor(28)
  doc.setLineWidth(0.35)
  doc.rect(frame.x, frame.y, frame.w, frame.h)
  const poly = (points, close, width = 0.25) => {
    if (!points || points.length < 2) return
    doc.setLineWidth(width)
    const ring = close ? [...points, points[0]] : points
    for (let i = 0; i < ring.length - 1; i += 1) {
      doc.line(X(ring[i].x), Y(ring[i].z), X(ring[i + 1].x), Y(ring[i + 1].z))
    }
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(28)
  if (yard.plot) {
    doc.setDrawColor(28)
    poly(yard.plot.points, true, 0.45)
    const center = centroid(yard.plot.points)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(ascii(`Tontti ${formatSquare(metrics.area)}`), X(center.x), Y(center.z))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    metrics.edges.forEach((edge) => {
      const mx = (edge.a.x + edge.b.x) / 2
      const mz = (edge.a.z + edge.b.z) / 2
      doc.text(ascii(formatMetres(edge.length)), X(mx), Y(mz) - 1.2)
    })
    setbackList(plan).forEach((edge) => {
      doc.setTextColor(15, 90, 80)
      doc.text(ascii(edge.label), X((edge.a.x + edge.b.x) / 2), Y((edge.a.z + edge.b.z) / 2) + 2.4)
    })
    doc.setTextColor(28)
  }
  yard.beds.forEach((bed) => poly(bed.points, true, 0.15))
  yard.terraces.forEach((item) => poly(item.points, true, 0.3))
  yard.paths.forEach((item) => {
    doc.setDrawColor(item.material === 'asphalt' ? 70 : 90)
    poly(item.points, false, Math.max(0.4, (item.width || 1) * scale * 0.35))
    doc.setDrawColor(28)
  })
  yard.fences.forEach((item) => poly(item.points, false, item.kind === 'hedge' ? 0.7 : 0.35))
  yard.plants.forEach((item) => {
    const radius = ((item.canopy || plantSpec(item.kind).canopy) / 2) * scale
    doc.circle(X(item.x), Y(item.z), Math.max(0.8, radius))
    doc.setFontSize(5.5)
    doc.text(ascii(plantSpec(item.kind).name), X(item.x), Y(item.z) + radius + 2)
  })
  yard.objects.forEach((item) => {
    const spec = objectSpec(item.kind)
    doc.rect(X(item.x) - (spec.w * scale) / 2, Y(item.z) - (spec.d * scale) / 2, spec.w * scale, spec.d * scale)
  })
  yard.buildings.forEach((item) => {
    const spec = { ...buildingSpec(item.kind), ...item }
    doc.setLineWidth(0.45)
    doc.rect(X(item.x) - (spec.w * scale) / 2, Y(item.z) - (spec.d * scale) / 2, spec.w * scale, spec.d * scale)
    doc.setFontSize(6)
    doc.text(ascii(buildingSpec(item.kind).name), X(item.x), Y(item.z))
  })
  ;(plan.walls || []).forEach((wall) => {
    doc.setDrawColor(20)
    doc.setLineWidth(wall.kind === 'interior' ? 0.2 : 0.55)
    doc.line(X(wall.a.x), Y(wall.a.z), X(wall.b.x), Y(wall.b.z))
  })
  const nx = frame.x + frame.w - 28
  const ny = frame.y + 22
  const north = (yard.north || 0) * Math.PI / 180
  doc.setDrawColor(20)
  doc.circle(nx, ny, 6)
  doc.line(nx, ny, nx + Math.sin(north) * 5, ny - Math.cos(north) * 5)
  doc.setFontSize(8)
  doc.text('N', nx + Math.sin(north) * 8 - 1, ny - Math.cos(north) * 8)
  doc.setDrawColor(20)
  doc.setFillColor(255)
  doc.rect(title.x, title.y, title.w, title.h)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const locale = plan?.locale || 'fi'
  const tr = (key, vars) => translate(locale, key, vars)
  doc.text(ascii(tr('sheet.site')), title.x + 3, title.y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const lines = [
    plan?.name || tr('sheet.plan'),
    tr('sheet.scale', { ratio: layout.ratio }),
    plan?.paper === 'a4' ? tr('sheet.a4') : tr('sheet.a3'),
    metrics.area ? tr('sheet.plot', { area: formatSquare(metrics.area) }) : tr('yard.plot'),
    tr('sheet.north', { deg: Math.round(yard.north || 0) }),
    `Rakennuksia ${1 + yard.buildings.length}`,
  ]
  lines.forEach((line, index) => doc.text(ascii(line), title.x + 3, title.y + 12 + index * 4.2))
  const metres = worldSpan(layout) >= 20 ? 10 : 5
  const bar = Math.min(title.w - 10, metres * scale)
  const sy = title.y + title.h - 5
  doc.setFontSize(6)
  doc.text('0', title.x + 3, sy - 1.5)
  doc.text(`${metres} m`, title.x + 3 + bar - 8, sy - 1.5)
  for (let i = 0; i < metres; i += 1) {
    doc.setFillColor(i % 2 ? 255 : 28)
    doc.rect(title.x + 3 + (bar / metres) * i, sy, bar / metres, 2.2, 'FD')
  }
  return doc
}

function worldSpan(layout) {
  return Math.max(layout.worldW, layout.worldH)
}
