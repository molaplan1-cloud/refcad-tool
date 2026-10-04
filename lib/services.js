import { jsPDF } from 'jspdf'
import { nearestWall, openingSymbol, planBounds, planDimensions, pointInPolygon, segmentLength, viewLayout, visibleRooms } from './floorplan.js'
import { fixtureServiceSpecs, isShowerType, waterNeed } from './furniture.js'
import { heatingLoads } from './roominfo.js'
import { climateOf } from './places.js'
import { annualHeatingKwh } from './structures.js'
import { attachGroundworks } from './groundworks.js'
import { applyVoltageDrop, deviceSpec, markingFor, planCircuits, segmentMark } from './electric.js'
import {
  applySlope,
  followEndpoint,
  heightMetres,
  hitRouteDetail,
  insertRisers,
  joinPoints,
  moveSegmentPoints,
  moveVertexPoints,
  routeLength,
  setRunMount,
  setSegmentLength,
  setSegmentMount,
  splitPoints,
  translatePoints,
} from './routeEdit.js'
import {
  AIR_AIR,
  floorHeatDensity,
  floorLoops,
  heatedArea,
  heatingObstacles,
  heatFlowLs,
  normalizeHeating,
  normalizeRoomHeating,
  pexSize,
  roomHeatLoss,
  sourceSpec,
  splitRadiatorLoad,
  tankElectric,
  waterPointSpec,
} from './hydronic.js'

export const SERVICE_SYSTEMS = [
  { id: 'iv', name: 'IV', title: 'Ilmanvaihto' },
  { id: 'water', name: 'LV', title: 'Käyttövesi' },
  { id: 'drain', name: 'Viemäri', title: 'Viemäri' },
  { id: 'electric', name: 'Sähkö', title: 'Sähkö' },
  { id: 'heat', name: 'Lämmitys', title: 'Lämmitys' },
  { id: 'ground', name: 'Maa', title: 'Maanalaiset' },
]

export const SERVICE_COLORS = {
  tulo: '#dc2626',
  poisto: '#ca8a04',
  ulko: '#2563eb',
  jate: '#166534',
  cold: '#1d4ed8',
  hot: '#dc2626',
  circ: '#ea580c',
  floorheat: '#d97706',
  drain: '#57534e',
  vent: '#78716c',
  electric: '#1c1917',
  'heat-supply': '#dc2626',
  'heat-return': '#2563eb',
}

export const CIRCUITS = [
  { id: 1, name: 'Valaistus' },
  { id: 2, name: 'Pistorasiat' },
  { id: 3, name: 'Liesi' },
  { id: 4, name: 'Kiuas' },
  { id: 5, name: 'Data' },
]

export const PLACEABLES = [
  { id: 'ahu', system: 'iv', name: 'IV-kone', mode: 'node', kind: 'ahu' },
  { id: 'valve-tulo', system: 'iv', name: 'Tuloventtiili', mode: 'node', kind: 'valve', role: 'tulo', flow: 8, size: 100 },
  { id: 'valve-poisto', system: 'iv', name: 'Poistoventtiili', mode: 'node', kind: 'valve', role: 'poisto', flow: 10, size: 100 },
  { id: 'hood', system: 'iv', name: 'Liesikupu', mode: 'node', kind: 'hood', role: 'poisto', flow: 25, size: 125 },
  { id: 'silencer', system: 'iv', name: 'Äänenvaimennin', mode: 'node', kind: 'silencer', size: 125 },
  { id: 'outdoor-terminal', system: 'iv', name: 'Ulkoilmapääte', mode: 'node', kind: 'outdoor-terminal', role: 'ulko' },
  { id: 'exhaust-terminal', system: 'iv', name: 'Jäteilmapääte', mode: 'node', kind: 'exhaust-terminal', role: 'jate' },
  { id: 'duct-tulo', system: 'iv', name: 'Tulokanava', mode: 'run', kind: 'tulo', size: 125 },
  { id: 'duct-poisto', system: 'iv', name: 'Poistokanava', mode: 'run', kind: 'poisto', size: 125 },
  { id: 'duct-ulko', system: 'iv', name: 'Ulkoilmakanava', mode: 'run', kind: 'ulko', size: 160 },
  { id: 'duct-jate', system: 'iv', name: 'Jäteilmakanava', mode: 'run', kind: 'jate', size: 160 },
  { id: 'manifold', system: 'water', name: 'Jakotukki', mode: 'node', kind: 'manifold' },
  { id: 'shutoff', system: 'water', name: 'Pääsulku', mode: 'node', kind: 'shutoff' },
  { id: 'cold', system: 'water', name: 'Kylmävesi', mode: 'run', kind: 'cold', size: 16 },
  { id: 'hot', system: 'water', name: 'Lämminvesi', mode: 'run', kind: 'hot', size: 16 },
  { id: 'circ', system: 'water', name: 'Kierto', mode: 'run', kind: 'circ', size: 16 },
  { id: 'floorheat', system: 'water', name: 'Lattialämmitys', mode: 'run', kind: 'floorheat', size: 16 },
  { id: 'floor-drain', system: 'drain', name: 'Lattiakaivo', mode: 'node', kind: 'floor-drain', size: 75 },
  { id: 'cleanout', system: 'drain', name: 'Puhdistus', mode: 'node', kind: 'cleanout', size: 110 },
  { id: 'drain-branch', system: 'drain', name: 'Viemärihaara', mode: 'run', kind: 'branch', size: 75, slope: 2 },
  { id: 'drain-main', system: 'drain', name: 'Kokoojaviemäri', mode: 'run', kind: 'main', size: 110, slope: 1 },
  { id: 'vent', system: 'drain', name: 'Tuuletusviemäri', mode: 'run', kind: 'vent', size: 110 },
  { id: 'panel', system: 'electric', name: 'Sähkökeskus', mode: 'node', kind: 'panel', circuit: 1 },
  { id: 'socket', system: 'electric', name: 'Pistorasia', mode: 'node', kind: 'socket', circuit: 2, wall: true },
  { id: 'switch', system: 'electric', name: 'Kytkin', mode: 'node', kind: 'switch', circuit: 1, wall: true },
  { id: 'light', system: 'electric', name: 'Valaisin', mode: 'node', kind: 'light', circuit: 1 },
  { id: 'junction', system: 'electric', name: 'Jakorasia', mode: 'node', kind: 'junction', circuit: 1 },
  { id: 'data', system: 'electric', name: 'Data', mode: 'node', kind: 'data', circuit: 5 },
  { id: 'antenna', system: 'electric', name: 'Antenni', mode: 'node', kind: 'antenna', circuit: 5 },
  { id: 'stove', system: 'electric', name: 'Liesi', mode: 'node', kind: 'stove', circuit: 3 },
  { id: 'oven', system: 'electric', name: 'Uuni', mode: 'node', kind: 'oven' },
  { id: 'heater', system: 'electric', name: 'Kiuas', mode: 'node', kind: 'heater', circuit: 4 },
  { id: 'radiator', system: 'electric', name: 'Sähköpatteri', mode: 'node', kind: 'radiator' },
  { id: 'ev', system: 'electric', name: 'Sähköauton lataus', mode: 'node', kind: 'ev' },
  { id: 'heatpump', system: 'electric', name: 'Lämpöpumppu', mode: 'node', kind: 'heatpump' },
  { id: 'iv-unit', system: 'electric', name: 'IV-kone', mode: 'node', kind: 'iv-unit' },
  { id: 'boiler', system: 'electric', name: 'Varaaja', mode: 'node', kind: 'boiler' },
  { id: 'washer', system: 'electric', name: 'Pesukone', mode: 'node', kind: 'washer', wall: true },
  { id: 'dishwasher', system: 'electric', name: 'Astianpesukone', mode: 'node', kind: 'dishwasher', wall: true },
  { id: 'wire', system: 'electric', name: 'Johto', mode: 'run', kind: 'wire', circuit: 1 },
  { id: 'wp-sink', system: 'water', name: 'Allas KV+LV', mode: 'node', kind: 'water-point', pointType: 'sink' },
  { id: 'wp-shower', system: 'water', name: 'Suihku KV+LV', mode: 'node', kind: 'water-point', pointType: 'shower' },
  { id: 'wp-wc', system: 'water', name: 'WC KV', mode: 'node', kind: 'water-point', pointType: 'wc' },
  { id: 'wp-washer', system: 'water', name: 'Pesukone KV', mode: 'node', kind: 'water-point', pointType: 'washer' },
  { id: 'wp-dishwasher', system: 'water', name: 'Astianpesukone KV', mode: 'node', kind: 'water-point', pointType: 'dishwasher' },
  { id: 'wp-outdoor', system: 'water', name: 'Puutarhahana KV', mode: 'node', kind: 'water-point', pointType: 'outdoor' },
  { id: 'wp-drain', system: 'water', name: 'Lattiakaivon kytkentä', mode: 'node', kind: 'water-point', pointType: 'drain-link' },
  { id: 'dhw-tank', system: 'water', name: 'Lämminvesivaraaja', mode: 'node', kind: 'dhw-tank' },
  { id: 'heat-source', system: 'heat', name: 'Lämmönlähde', mode: 'node', kind: 'heat-source' },
  { id: 'buffer-tank', system: 'heat', name: 'Puskurivaraaja', mode: 'node', kind: 'buffer-tank' },
  { id: 'floor-manifold', system: 'heat', name: 'Lattialämmityksen jakotukki', mode: 'node', kind: 'floor-manifold' },
  { id: 'heater-rad', system: 'heat', name: 'Patteri', mode: 'node', kind: 'heater-rad' },
  { id: 'thermostat', system: 'heat', name: 'Termostaatti', mode: 'node', kind: 'thermostat' },
]

const WET = new Set(['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'])

export function emptyServices() {
  return {
    layers: { iv: true, water: true, drain: true, electric: true, heat: true, ground: true },
    nodes: [],
    runs: [],
  }
}

export function ensureServices(plan) {
  const base = emptyServices()
  const current = plan?.services
  return {
    ...base,
    ...(current || {}),
    layers: { ...base.layers, ...(current?.layers || {}) },
    nodes: Array.isArray(current?.nodes) ? current.nodes : [],
    runs: Array.isArray(current?.runs) ? current.runs : [],
  }
}

export function layerVisible(plan, system) {
  return ensureServices(plan).layers[system] !== false
}

export function serviceItemVisible(plan, item) {
  if (!item || item.hidden) return false
  if (!layerVisible(plan, item.system)) return false
  const link = String(item.linkedFrom || '')
  const underground = link.startsWith('yard:ground:') || link.startsWith('yard:waste:') || item.kind === 'collector'
  if (underground && !layerVisible(plan, 'ground')) return false
  return true
}

function withGroundworks(plan) {
  const loads = heatingLoads(plan)
  const peakW = loads.reduce((sum, item) => sum + (Number(item.watts) || 0), 0)
  const climate = climateOf(plan)
  const setpoint = loads.length
    ? loads.reduce((sum, item) => sum + (Number(item.setpoint) || 21), 0) / loads.length
    : 21
  const annualKwh = annualHeatingKwh(peakW, setpoint, climate.outdoor, climate.degreeDays)
  return attachGroundworks(plan, { peakW, annualKwh })
}

export function syncGroundworks(plan) {
  return withGroundworks(plan)
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
}

export function asciiFold(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A')
    .replace(/²/g, '2').replace(/Ø/g, 'D').replace(/ø/g, 'd')
}

export function roomKind(room) {
  const type = fold(room?.type)
  const known = ['olohuone', 'keittio', 'makuuhuone', 'wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone', 'eteinen', 'vaatehuone', 'tekninen', 'tyohuone', 'autotalli', 'huone']
  if (known.includes(type) && type !== 'huone') return type
  const name = fold(room?.name)
  if (name.includes('olohuone')) return 'olohuone'
  if (name.includes('keitt')) return 'keittio'
  if (name.includes('makuu')) return 'makuuhuone'
  if (name.includes('kodinhoito')) return 'kodinhoitohuone'
  if (name.includes('vaate')) return 'vaatehuone'
  if (name.includes('tekn')) return 'tekninen'
  if (name.includes('tyohuone') || name.includes('työhuone')) return 'tyohuone'
  if (name.includes('autotalli')) return 'autotalli'
  if (name.includes('eteinen') || name === 'eteinen') return 'eteinen'
  if (name.includes('kylpy')) return 'kylpyhuone'
  if (name.includes('sauna')) return 'sauna'
  if (name === 'wc' || name.includes('wc')) return 'wc'
  return type || 'huone'
}

export function ductSize(flow) {
  const amount = Math.abs(Number(flow) || 0)
  if (amount <= 15) return 100
  if (amount <= 30) return 125
  return 160
}

export function serviceHeight(plan, system, kind) {
  const ceiling = plan?.floorHeight || 2.6
  if (system === 'iv') return round3(ceiling - 0.3)
  if (system === 'water' && kind === 'floorheat') return 0.02
  if (system === 'water') return 0.35
  if (system === 'drain' && kind === 'vent') return -0.05
  if (system === 'drain') return -0.05
  if (kind === 'light') return round3(ceiling - 0.08)
  if (kind === 'switch') return 1.1
  if (kind === 'panel') return 1.4
  if (kind === 'antenna') return 2.2
  if (kind === 'socket' || kind === 'data' || kind === 'washer' || kind === 'dishwasher' || kind === 'fridge' || kind === 'dryer' || kind === 'tv' || kind === 'towel') return 0.3
  if (kind === 'stove' || kind === 'heater' || kind === 'oven' || kind === 'radiator' || kind === 'ev' || kind === 'heatpump' || kind === 'boiler' || kind === 'dhw-tank' || kind === 'buffer-tank' || kind === 'heat-source') return 0.9
  if (kind === 'iv-unit') return 1.6
  return 0.4
}

function pushPoint(points, point) {
  const next = { x: round3(point.x), y: round3(point.y ?? 0), z: round3(point.z) }
  const prev = points[points.length - 1]
  if (prev && Math.hypot(prev.x - next.x, prev.y - next.y, prev.z - next.z) < 0.02) return
  points.push(next)
}

export function ortho(a, b) {
  const points = []
  const y0 = a?.y ?? b?.y ?? 0
  const y1 = b?.y ?? y0
  pushPoint(points, { x: a?.x || 0, y: y0, z: a?.z || 0 })
  pushPoint(points, { x: b?.x || 0, y: y0, z: a?.z || 0 })
  pushPoint(points, { x: b?.x || 0, y: y1, z: b?.z || 0 })
  if (points.length < 2) pushPoint(points, { x: (b?.x || 0) + 0.05, y: y1, z: b?.z || 0 })
  return points
}

function nearestPoint(points, target) {
  let best = points[0]
  let bestDist = Infinity
  points.forEach((point) => {
    const dist = Math.hypot(point.x - target.x, point.z - target.z)
    if (dist < bestDist) {
      best = point
      bestDist = dist
    }
  })
  return best
}

function sheetWorld(plan) {
  const layout = viewLayout(plan)
  const scale = layout.scale || 20
  const toX = (mm) => layout.box.minX + (mm - layout.ox) / scale
  const toZ = (mm) => layout.box.minZ + (mm - layout.oy) / scale
  const frame = layout.frame
  return {
    scale,
    minX: toX(frame.x + 8),
    maxX: toX(frame.x + frame.w - 8),
    minZ: toZ(frame.y + 8),
    maxZ: toZ(frame.y + frame.h - 8),
  }
}

function renderedLabelSize(text, scale) {
  const ppm = Math.max(16, (scale || 20) * 1.55)
  const font = 6.5
  const label = String(text || '')
  return {
    w: Math.max(0.7, label.length * font * 0.58 / ppm),
    h: Math.max(0.12, font * 1.35 / ppm),
  }
}

function polyBounds(poly) {
  return (poly || []).reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

function doorClearance(plan, room) {
  const poly = room?.polygon || room?.gross || []
  if (poly.length < 3) return []
  const boxes = []
  ;(plan?.openings || []).forEach((opening) => {
    if (opening.kind === 'window') return
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return
    const symbol = openingSymbol(wall, opening, plan)
    const pts = (symbol.arc || []).filter((point) => pointInPolygon(point.x, point.z, poly))
    if (pts.length < 3) return
    boxes.push({
      minX: Math.min(...pts.map((point) => point.x)),
      maxX: Math.max(...pts.map((point) => point.x)),
      minZ: Math.min(...pts.map((point) => point.z)),
      maxZ: Math.max(...pts.map((point) => point.z)),
    })
  })
  return boxes
}

function loopDrawOptions(plan, room, extra = {}) {
  return {
    spacing: extra.spacing || 0.3,
    maxLength: 100,
    pattern: extra.pattern,
    obstacles: extra.obstacles || [],
    doors: doorClearance(plan, room),
    inset: 0.13,
  }
}

export function manifoldCallouts(plan) {
  const services = plan?.services
  const nodes = services?.nodes || []
  const manifold = nodes.find((node) => node.system === 'heat' && node.kind === 'floor-manifold')
  if (!manifold) return []
  const trunks = (services.runs || []).filter((run) => (
    run.system === 'heat'
    && (run.role === 'supply' || run.role === 'return')
    && run.showMark
    && run.marking
    && (run.points || []).length >= 2
  ))
  if (!trunks.length) return []
  const supply = trunks.find((run) => run.role === 'supply')
  const ret = trunks.find((run) => run.role === 'return')
  const text = supply && ret ? 'Meno/Paluu PEX 25' : (supply || ret).marking
  const sheet = sheetWorld(plan)
  const size = renderedLabelSize(text, sheet.scale)
  const building = planBounds(plan)
  const rooms = visibleRooms(plan)
  const room = rooms.find((item) => pointInPolygon(manifold.x, manifold.z, item.polygon || item.gross || []))
  const poly = room?.polygon || room?.gross || []
  const roomBox = poly.length ? polyBounds(poly) : null
  const onSouth = !roomBox || roomBox.minZ - building.minZ < 0.55
  const sign = onSouth ? -1 : 1
  const dims = planDimensions(plan).filter((dim) => (onSouth ? (dim.nz || 0) < 0 : (dim.nz || 0) > 0))
  const chains = dims.map((dim) => dim.z1 + (dim.nz || 0) * (Number.isFinite(dim.offset) ? dim.offset : 0))
  const outerChain = chains.length
    ? (onSouth ? Math.min(...chains) : Math.max(...chains))
    : (onSouth ? building.minZ - 0.5 : building.maxZ + 0.5)
  const ppm = Math.max(16, sheet.scale * 1.55)
  const glyph = 4.2 / ppm
  const half = size.h / 2
  const clearance = Math.max(0.16, 8 / ppm)
  const glyphEdge = outerChain + sign * glyph
  const frameEdge = onSouth ? sheet.minZ + half + 0.04 : sheet.maxZ - half - 0.04
  const span = Math.abs(frameEdge - glyphEdge)
  const gap = span > half + clearance ? Math.min(clearance, Math.max(0.08, (span - half) / 2)) : Math.max(0.06, span * 0.25)
  let z = glyphEdge + sign * (gap + half)
  if (onSouth) z = Math.max(frameEdge, Math.min(glyphEdge + sign * 0.05, z))
  else z = Math.min(frameEdge, Math.max(glyphEdge + sign * 0.05, z))
  const halfW = size.w / 2
  const limitL = Math.max(sheet.minX + halfW, building.minX - 0.2)
  const limitR = Math.max(limitL, Math.min(sheet.maxX - halfW, building.maxX + 0.2))
  const texts = dims.map((dim) => ({
    x: dim.x1 + (dim.x2 - dim.x1) * (Number.isFinite(dim.textT) ? dim.textT : 0.5),
    w: Math.max(0.42, String(dim.label || '').length * 0.16),
  }))
  let x = Math.min(limitR, Math.max(limitL, manifold.x))
  if (texts.length) {
    let best = x
    let bestScore = -Infinity
    for (let step = limitL; step <= limitR + 0.001; step += 0.1) {
      const gapX = Math.min(...texts.map((item) => Math.abs(step - item.x) - (halfW + item.w) / 2))
      const score = gapX - Math.abs(step - manifold.x) * 0.15
      if (score > bestScore) {
        bestScore = score
        best = step
      }
    }
    x = best
  }
  const anchorRun = supply || ret
  return [{
    text,
    role: 'pair',
    x,
    z,
    w: size.w,
    h: size.h,
    anchor: nearestPoint(anchorRun.points, { x, z }),
  }]
}

const IV_LANE = { tulo: 0.18, poisto: -0.18, ulko: 0.4, jate: -0.4 }

function parallelDuct(points, dist) {
  if (!points || points.length < 2 || !dist) return (points || []).map((point) => ({ ...point }))
  const shifted = offsetPolyline(points, dist)
  return [{ ...points[0] }, ...shifted, { ...points[points.length - 1] }]
}

function separateIv(runs) {
  return ['tulo', 'poisto', 'ulko', 'jate'].flatMap((kind) => {
    const group = runs.filter((run) => run.kind === kind)
    if (!group.length) return []
    const lane = IV_LANE[kind] || 0
    const trunk = group.find((run) => run.role === 'trunk')
    if (!trunk || !lane) return group
    const shifted = parallelDuct(trunk.points, lane)
    return group.flatMap((run) => {
      if (run.role === 'trunk') return [{ ...run, points: shifted }]
      const target = run.points[run.points.length - 1]
      const y = Number.isFinite(target?.y) ? target.y : 0
      const hit = closestOn(shifted, target)
      const branch = ortho({ x: hit.x, y, z: hit.z }, { x: target.x, y, z: target.z })
      if (runLength({ points: branch }) < 0.05) return []
      return [{ ...run, points: branch }]
    })
  })
}

function offsetPolyline(points, dist) {
  if (!points || points.length < 2 || !dist) return (points || []).map((point) => ({ ...point }))
  const segs = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const nx = (-(b.z - a.z) / len) * dist
    const nz = ((b.x - a.x) / len) * dist
    segs.push({
      a: { x: a.x + nx, y: a.y || 0, z: a.z + nz },
      b: { x: b.x + nx, y: b.y || 0, z: b.z + nz },
      dx: b.x - a.x,
      dz: b.z - a.z,
    })
  }
  const out = [{ ...segs[0].a }]
  for (let i = 0; i < segs.length - 1; i += 1) {
    const left = segs[i]
    const right = segs[i + 1]
    const den = left.dx * right.dz - left.dz * right.dx
    if (Math.abs(den) < 1e-6) {
      out.push({ ...left.b })
      continue
    }
    const t = ((right.a.x - left.a.x) * right.dz - (right.a.z - left.a.z) * right.dx) / den
    out.push({
      x: left.a.x + left.dx * t,
      y: left.b.y,
      z: left.a.z + left.dz * t,
    })
  }
  out.push({ ...segs[segs.length - 1].b })
  return out
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function closestOn(points, target) {
  let best = null
  for (let i = 1; i < points.length; i += 1) {
    const hit = nearestWall([{ a: points[i - 1], b: points[i] }], target, 1e6)
    if (!hit) continue
    const y = (points[i - 1].y ?? 0) + ((points[i].y ?? 0) - (points[i - 1].y ?? 0)) * hit.t
    if (!best || hit.dist < best.dist) best = { x: hit.x, y, z: hit.z, dist: hit.dist }
  }
  if (best) return best
  const first = points[0] || { x: 0, y: 0, z: 0 }
  return { x: first.x, y: first.y || 0, z: first.z, dist: 0 }
}

function pointAlong(points, distance) {
  let left = distance
  for (let i = 1; i < points.length; i += 1) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z)
    if (seg >= left) {
      const t = seg ? left / seg : 0
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
        z: points[i - 1].z + (points[i].z - points[i - 1].z) * t,
      }
    }
    left -= seg
  }
  return points[points.length - 1]
}

function runLength(run) {
  let sum = 0
  const points = run?.points || []
  for (let i = 1; i < points.length; i += 1) {
    sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z)
  }
  return sum
}

function liesOnInterior(point, points) {
  if (!points || points.length < 2) return false
  const endA = points[0]
  const endB = points[points.length - 1]
  if (Math.hypot(point.x - endA.x, point.z - endA.z) < 0.05) return false
  if (Math.hypot(point.x - endB.x, point.z - endB.z) < 0.05) return false
  const hit = closestOn(points, point)
  return hit.dist <= 0.08
}

export function collectFittings(runs) {
  const bends = []
  const tees = []
  ;(runs || []).forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length - 1; i += 1) {
      const incoming = unitVector(points[i - 1], points[i])
      const outgoing = unitVector(points[i], points[i + 1])
      const dot = incoming.x * outgoing.x + incoming.y * outgoing.y + incoming.z * outgoing.z
      if (dot < 0.96) bends.push({ x: points[i].x, y: points[i].y, z: points[i].z })
    }
  })
  ;(runs || []).forEach((run) => {
    const points = run.points || []
    if (points.length < 2) return
    ;[points[0], points[points.length - 1]].forEach((end) => {
      const hit = (runs || []).some((other) => other !== run && liesOnInterior(end, other.points))
      if (hit) tees.push({ x: end.x, y: end.y, z: end.z })
    })
  })
  return { bends, tees: uniquePoints(tees) }
}

function unitVector(a, b) {
  const x = b.x - a.x
  const y = (b.y || 0) - (a.y || 0)
  const z = b.z - a.z
  const len = Math.hypot(x, y, z) || 1
  return { x: x / len, y: y / len, z: z / len }
}

function uniquePoints(points) {
  const kept = []
  points.forEach((point) => {
    if (!kept.some((item) => Math.hypot(item.x - point.x, item.z - point.z) < 0.08)) kept.push(point)
  })
  return kept
}

function balanceValves(valves) {
  const supply = (list) => list.filter((item) => item.role === 'tulo').reduce((sum, item) => sum + item.flow, 0)
  const extract = (list) => list.filter((item) => item.role === 'poisto').reduce((sum, item) => sum + item.flow, 0)
  const living = valves.find((item) => item.roomKind === 'olohuone' && item.role === 'tulo')
    || valves.find((item) => item.role === 'tulo')
  if (!living) return valves
  const other = supply(valves) - living.flow
  living.flow = Math.max(8, Math.round(extract(valves) - other))
  return valves
}

export function suggestAirflows(plan) {
  const valves = []
  visibleRooms(plan).forEach((room) => {
    const kind = roomKind(room)
    const area = room.area || 0
    const base = { roomId: room.id, roomKind: kind, x: room.cx, z: room.cz, name: room.name }
    if (kind === 'olohuone') {
      valves.push({ ...base, role: 'tulo', flow: Math.max(8, Math.round(area * 0.5)), kind: 'valve' })
    } else if (kind === 'makuuhuone') {
      valves.push({ ...base, role: 'tulo', flow: area < 12 ? 8 : 12, kind: 'valve' })
    } else if (kind === 'keittio') {
      const stove = (plan.fixtures || []).find((item) => item.type === 'stove' && pointInPolygon(item.x, item.z, room.gross || room.polygon || []))
      valves.push({
        ...base,
        role: 'poisto',
        flow: 25,
        kind: 'hood',
        name: 'Liesikupu',
        x: stove ? stove.x : room.cx,
        z: stove ? stove.z : room.cz,
      })
    } else if (kind === 'sauna') {
      const flow = Math.max(6, Math.round(area * 2))
      valves.push({ ...base, role: 'tulo', flow, kind: 'valve', z: room.cz - 0.35 })
      valves.push({ ...base, role: 'poisto', flow, kind: 'valve', z: room.cz + 0.35 })
    } else if (kind === 'wc') valves.push({ ...base, role: 'poisto', flow: 10, kind: 'valve' })
    else if (kind === 'kylpyhuone') valves.push({ ...base, role: 'poisto', flow: 15, kind: 'valve' })
    else if (kind === 'kodinhoitohuone') valves.push({ ...base, role: 'poisto', flow: 8, kind: 'valve' })
    else if (kind === 'vaatehuone') valves.push({ ...base, role: 'poisto', flow: 3, kind: 'valve' })
    else if (kind === 'tekninen') valves.push({ ...base, role: 'poisto', flow: 6, kind: 'valve' })
  })
  return balanceValves(valves)
}

export function airflowBalance(nodes) {
  const list = nodes || []
  const supply = list.filter((item) => item.system === 'iv' && item.role === 'tulo').reduce((sum, item) => sum + (item.flow || 0), 0)
  const extract = list.filter((item) => item.system === 'iv' && item.role === 'poisto').reduce((sum, item) => sum + (item.flow || 0), 0)
  return { supply, extract, delta: Math.round((supply - extract) * 10) / 10 }
}

function exteriorWalls(plan) {
  return (plan.walls || []).filter((wall) => wall.kind === 'exterior' || wall.kind === 'bearing')
}

function outwardNormal(wall, hit, box) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  let nx = -dz
  let nz = dx
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  if ((hit.x - cx) * nx + (hit.z - cz) * nz < 0) {
    nx = -nx
    nz = -nz
  }
  return { dx, dz, nx, nz }
}

function routeTree(origin, targets, kind) {
  if (!targets.length) return { runs: [], silencer: null }
  const y = origin.y
  const trunk = ortho(origin, { x: average(targets.map((item) => item.x)), y, z: average(targets.map((item) => item.z)) })
  const flow = targets.reduce((sum, item) => sum + (item.flow || 0), 0)
  const runs = [{
    system: 'iv',
    kind,
    role: 'trunk',
    size: ductSize(flow),
    flow,
    points: trunk,
  }]
  targets.forEach((target) => {
    const hit = closestOn(trunk, target)
    const branch = ortho({ x: hit.x, y, z: hit.z }, { x: target.x, y, z: target.z })
    if (runLength({ points: branch }) < 0.08) return
    runs.push({
      system: 'iv',
      kind,
      role: 'branch',
      size: ductSize(target.flow),
      flow: target.flow,
      points: branch,
    })
  })
  return { runs, silencer: pointAlong(trunk, Math.min(0.6, Math.max(0.2, runLength({ points: trunk }) * 0.35))) }
}

function buildIv(plan, seq) {
  const y = serviceHeight(plan, 'iv')
  const rooms = visibleRooms(plan)
  const box = planBounds(plan)
  const tech = rooms.find((room) => roomKind(room) === 'tekninen')
  const util = rooms.find((room) => roomKind(room) === 'kodinhoitohuone')
  const origin = tech
    ? { x: tech.cx, y, z: tech.cz }
    : util
      ? { x: util.cx, y, z: util.cz }
      : { x: box.minX + 1.05, y, z: box.minZ + 0.9 }
  const valves = suggestAirflows(plan)
  const nodes = [{
    id: seq(),
    system: 'iv',
    kind: 'ahu',
    name: 'IV-kone',
    x: round3(origin.x),
    y,
    z: round3(origin.z),
    size: 160,
  }]
  valves.forEach((valve) => {
    nodes.push({
      id: seq(),
      system: 'iv',
      kind: valve.kind,
      role: valve.role,
      name: valve.kind === 'hood' ? 'Liesikupu' : valve.role === 'tulo' ? 'Tulo' : 'Poisto',
      roomId: valve.roomId,
      roomKind: valve.roomKind,
      flow: valve.flow,
      size: ductSize(valve.flow),
      x: round3(valve.x),
      y,
      z: round3(valve.z),
    })
  })
  const supply = valves.filter((item) => item.role === 'tulo')
  const extract = valves.filter((item) => item.role === 'poisto')
  const trees = [routeTree(origin, supply, 'tulo'), routeTree(origin, extract, 'poisto')]
  const runs = trees.flatMap((tree) => tree.runs)
  trees.forEach((tree) => {
    if (!tree.silencer) return
    nodes.push({
      id: seq(),
      system: 'iv',
      kind: 'silencer',
      name: 'Äänenvaimennin',
      size: 125,
      x: round3(tree.silencer.x),
      y: round3(tree.silencer.y),
      z: round3(tree.silencer.z),
    })
  })
  const hit = nearestWall(exteriorWalls(plan), origin, 40)
  if (hit) {
    ;[
      { kind: 'ulko', nodeKind: 'outdoor-terminal', name: 'Ulkoilmapääte', along: -0.45 },
      { kind: 'jate', nodeKind: 'exhaust-terminal', name: 'Jäteilmapääte', along: 0.45 },
    ].forEach((stub) => {
      const frame = outwardNormal(hit.wall, hit, box)
      const px = hit.x + frame.dx * stub.along
      const pz = hit.z + frame.dz * stub.along
      const outside = { x: px + frame.nx * 0.7, y, z: pz + frame.nz * 0.7 }
      nodes.push({
        id: seq(),
        system: 'iv',
        kind: stub.nodeKind,
        role: stub.kind,
        name: stub.name,
        size: 160,
        x: round3(outside.x),
        y,
        z: round3(outside.z),
      })
      runs.push({
        system: 'iv',
        kind: stub.kind,
        role: 'trunk',
        size: 160,
        flow: 160,
        points: ortho(origin, outside),
      })
    })
  }
  return { nodes, runs }
}

function waterTargets(plan) {
  const rooms = visibleRooms(plan)
  const points = []
  ;(plan.fixtures || []).forEach((item) => {
    if (item.hidden) return
    const need = waterNeed(item)
    if (!need) return
    points.push({
      x: item.x,
      z: item.z,
      name: item.type,
      hot: need.hot,
      cold: need.cold,
      linkedFrom: `fix:${item.id}:water`,
    })
  })
  if (!points.some((item) => item.name === 'washer')) {
    const host = rooms.find((room) => roomKind(room) === 'kodinhoitohuone')
      || rooms.find((room) => roomKind(room) === 'kylpyhuone')
      || rooms.find((room) => roomKind(room) === 'wc')
    if (host) points.push({ x: host.cx + 0.35, z: host.cz, name: 'washer', hot: true, cold: true })
  }
  const box = planBounds(plan)
  points.push({ x: box.maxX + 0.28, z: box.minZ + 2.4, name: 'outdoor', hot: false, cold: true, outdoor: true })
  return points
}

function buildWater(plan, seq, options) {
  const y = serviceHeight(plan, 'water')
  const box = planBounds(plan)
  const inlet = { x: box.minX - 0.55, y, z: box.minZ + 1.35 }
  const shutoff = { x: box.minX + 0.4, y, z: inlet.z }
  const manifold = { x: box.minX + 1.15, y, z: box.minZ + 2.35 }
  const nodes = [
    { id: seq(), system: 'water', kind: 'inlet', name: 'Vesiliittymä', x: round3(inlet.x), y, z: round3(inlet.z) },
    { id: seq(), system: 'water', kind: 'shutoff', name: 'Pääsulku', x: round3(shutoff.x), y, z: round3(shutoff.z) },
    { id: seq(), system: 'water', kind: 'manifold', name: 'Jakotukki', x: round3(manifold.x), y, z: round3(manifold.z) },
  ]
  const targets = waterTargets(plan)
  targets.forEach((target) => {
    nodes.push({
      id: seq(),
      system: 'water',
      kind: target.outdoor ? 'outdoor-tap' : 'fixture',
      name: target.outdoor ? 'Puutarhahana' : target.name === 'washer' ? 'Pesukone' : 'Vesipiste',
      fixtureType: target.name,
      hot: target.hot,
      cold: target.cold,
      linkedFrom: target.linkedFrom,
      x: round3(target.x),
      y,
      z: round3(target.z),
    })
  })
  const runs = [{
    id: seq(),
    system: 'water',
    kind: 'cold',
    role: 'main',
    size: 25,
    points: [
      { ...inlet },
      { x: shutoff.x, y, z: shutoff.z },
      { x: manifold.x, y, z: manifold.z },
    ].map((point) => ({ x: round3(point.x), y, z: round3(point.z) })),
  }]
  const coldPoints = targets.filter((item) => item.cold)
  coldPoints.forEach((target) => {
    runs.push({
      id: seq(),
      system: 'water',
      kind: 'cold',
      role: 'branch',
      size: 16,
      points: ortho(manifold, { x: target.x, y, z: target.z }),
    })
  })
  const hotPoints = targets.filter((item) => item.hot)
  if (hotPoints.length) {
    const headerEnd = {
      x: average(hotPoints.map((item) => item.x)),
      y,
      z: average(hotPoints.map((item) => item.z)),
    }
    const header = ortho(manifold, headerEnd)
    runs.push({ id: seq(), system: 'water', kind: 'hot', role: 'header', size: 20, points: header })
    hotPoints.forEach((target) => {
      const hit = closestOn(header, target)
      const end = { x: target.x + 0.12, y, z: target.z }
      runs.push({
        id: seq(),
        system: 'water',
        kind: 'hot',
        role: 'branch',
        size: 16,
        points: ortho({ x: hit.x, y, z: hit.z }, end),
      })
    })
    let far = hotPoints[0]
    let best = 0
    hotPoints.forEach((item) => {
      const dist = Math.hypot(item.x - manifold.x, item.z - manifold.z)
      if (dist > best) {
        best = dist
        far = item
      }
    })
    if (best > 4) {
      runs.push({
        id: seq(),
        system: 'water',
        kind: 'circ',
        role: 'branch',
        size: 16,
        points: ortho(
          { x: far.x + 0.18, y, z: far.z + 0.18 },
          { x: manifold.x + 0.18, y, z: manifold.z + 0.18 },
        ),
      })
    }
  }
  if (options.floorHeating) {
    const rooms = visibleRooms(plan)
    const chosen = [
      rooms.find((room) => roomKind(room) === 'olohuone'),
      rooms.find((room) => roomKind(room) === 'kylpyhuone') || rooms.find((room) => roomKind(room) === 'wc'),
    ].filter(Boolean)
    chosen.forEach((room) => {
      const loop = heatingLoop(room)
      if (loop) {
        runs.push({
          id: seq(),
          system: 'water',
          kind: 'floorheat',
          role: 'loop',
          size: 16,
          points: loop,
        })
      }
    })
  }
  return { nodes, runs }
}

function heatingLoop(room) {
  const poly = room.polygon || []
  if (poly.length < 3) return null
  const minX = Math.min(...poly.map((point) => point.x))
  const maxX = Math.max(...poly.map((point) => point.x))
  const minZ = Math.min(...poly.map((point) => point.z))
  const maxZ = Math.max(...poly.map((point) => point.z))
  if (maxX - minX < 1.5 || maxZ - minZ < 1.5) return null
  const y = 0.02
  const x0 = minX + 0.45
  const x1 = maxX - 0.45
  const z0 = minZ + 0.45
  const z1 = maxZ - 0.45
  const rows = 5
  const points = []
  for (let i = 0; i < rows; i += 1) {
    const z = z0 + ((z1 - z0) * i) / (rows - 1)
    const left = { x: round3(x0), y, z: round3(z) }
    const right = { x: round3(x1), y, z: round3(z) }
    if (i % 2 === 0) points.push(left, right)
    else points.push(right, left)
  }
  return points
}

function buildDrain(plan, seq) {
  const box = planBounds(plan)
  const y0 = -0.05
  const x0 = box.minX + 0.55
  const x1 = box.maxX - 0.55
  const z = box.maxZ - 0.45
  const length = Math.max(0.2, x1 - x0)
  const y1 = round3(y0 - length * 0.01)
  const main = [
    { x: round3(x0), y: y0, z: round3(z) },
    { x: round3(x1), y: y1, z: round3(z) },
  ]
  const yAt = (x) => {
    const t = (x - x0) / length
    return y0 + (y1 - y0) * Math.max(0, Math.min(1, t))
  }
  const nodes = []
  const runs = [{
    id: seq(),
    system: 'drain',
    kind: 'main',
    role: 'main',
    size: 110,
    slope: 1,
    points: main,
  }]
  const ceiling = (plan.floorHeight || 2.6) + 0.55
  runs.push({
    id: seq(),
    system: 'drain',
    kind: 'vent',
    role: 'stack',
    size: 110,
    points: [
      { x: main[0].x, y: main[0].y, z: main[0].z },
      { x: main[0].x, y: round3(ceiling), z: main[0].z },
    ],
  })
  nodes.push({
    id: seq(),
    system: 'drain',
    kind: 'cleanout',
    name: 'Puhdistus',
    size: 110,
    x: main[1].x,
    y: main[1].y,
    z: main[1].z,
  })
  const rooms = visibleRooms(plan)
  const drainSpecs = fixtureServiceSpecs(plan.fixtures).filter((item) => item.system === 'drain')
  const usedDrains = new Set()
  rooms.filter((room) => WET.has(roomKind(room))).forEach((room) => {
    const poly = room.gross || room.polygon || []
    const inside = drainSpecs.filter((item) => item.kind === 'floor-drain' && pointInPolygon(item.x, item.z, poly))
    const chosen = inside.find((item) => item.fixtureType === 'floor-drain')
      || inside.find((item) => isShowerType(item.fixtureType))
      || inside[0]
    if (chosen?.linkedFrom) usedDrains.add(chosen.linkedFrom)
    nodes.push({
      id: seq(),
      system: 'drain',
      kind: 'floor-drain',
      name: 'Lattiakaivo',
      size: 75,
      roomId: room.id,
      linkedFrom: chosen?.linkedFrom,
      x: round3(chosen ? chosen.x : room.cx),
      y: -0.02,
      z: round3(chosen ? chosen.z : room.cz),
    })
  })
  drainSpecs.filter((item) => item.kind === 'floor-drain' && !usedDrains.has(item.linkedFrom)).forEach((item) => {
    nodes.push({
      id: seq(),
      system: 'drain',
      kind: 'floor-drain',
      name: 'Lattiakaivo',
      size: 75,
      fixtureType: item.fixtureType,
      linkedFrom: item.linkedFrom,
      x: round3(item.x),
      y: -0.02,
      z: round3(item.z),
    })
  })
  const drains = []
  nodes.filter((item) => item.kind === 'floor-drain').forEach((item) => drains.push({ ...item, size: 75 }))
  drainSpecs.filter((item) => item.kind === 'drain-point').forEach((item) => {
    drains.push({
      id: seq(),
      system: 'drain',
      kind: 'drain-point',
      name: 'Kalusteliitäntä',
      fixtureType: item.fixtureType,
      linkedFrom: item.linkedFrom,
      size: item.size || 50,
      x: round3(item.x),
      y: -0.02,
      z: round3(item.z),
    })
  })
  if (!(plan.fixtures || []).some((item) => item.type === 'washer')) {
    const host = rooms.find((room) => roomKind(room) === 'kodinhoitohuone')
      || rooms.find((room) => roomKind(room) === 'kylpyhuone')
      || rooms.find((room) => roomKind(room) === 'wc')
    if (host) {
      drains.push({
        id: seq(),
        system: 'drain',
        kind: 'drain-point',
        name: 'Pesukone',
        fixtureType: 'washer',
        size: 50,
        x: round3(host.cx + 0.35),
        y: -0.02,
        z: round3(host.cz),
      })
    }
  }
  drains.filter((item) => item.kind === 'drain-point').forEach((item) => nodes.push(item))
  drains.forEach((item) => {
    const meetX = Math.max(x0, Math.min(x1, item.x))
    const meet = { x: round3(meetX), y: round3(yAt(meetX)), z: round3(z) }
    const slope = (item.size >= 110 ? 1 : 2) / 100
    const horiz = Math.hypot(item.x - meet.x, item.z - meet.z)
    const start = { x: round3(item.x), y: round3(meet.y + horiz * slope), z: round3(item.z) }
    const points = [start]
    if (Math.abs(item.x - meet.x) > 0.05 && Math.abs(item.z - meet.z) > 0.05) {
      const drop = Math.abs(item.z - meet.z) * slope
      points.push({ x: round3(item.x), y: round3(start.y - drop), z: meet.z })
    }
    points.push(meet)
    runs.push({
      id: seq(),
      system: 'drain',
      kind: 'branch',
      role: 'branch',
      size: item.size,
      slope: item.size >= 110 ? 1 : 2,
      points,
    })
  })
  return { nodes, runs }
}

function socketCount(kind) {
  if (kind === 'olohuone' || kind === 'makuuhuone' || kind === 'keittio') return 2
  return 1
}

function socketSpots(room, count) {
  const poly = room.polygon || []
  if (poly.length < 2) return [{ x: room.cx, z: room.cz }]
  const edges = []
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    edges.push({ a, b, len: Math.hypot(b.x - a.x, b.z - a.z) })
  }
  edges.sort((a, b) => b.len - a.len)
  const spots = []
  for (let i = 0; i < count; i += 1) {
    const edge = edges[i % edges.length]
    const t = count === 1 ? 0.5 : (i % 2 ? 0.7 : 0.34)
    const x = edge.a.x + (edge.b.x - edge.a.x) * t
    const z = edge.a.z + (edge.b.z - edge.a.z) * t
    const dx = (room.cx || x) - x
    const dz = (room.cz || z) - z
    const mag = Math.hypot(dx, dz) || 1
    spots.push({ x: x + (dx / mag) * 0.16, z: z + (dz / mag) * 0.16 })
  }
  return spots
}

function switchSpot(plan, room) {
  const hit = nearestWall(plan.walls, { x: room.cx, z: room.cz }, 40)
  if (!hit) return { x: room.cx, z: room.cz }
  const dx = hit.x - room.cx
  const dz = hit.z - room.cz
  const mag = Math.hypot(dx, dz) || 1
  const reach = Math.min(0.75, mag * 0.5)
  const x = room.cx + (dx / mag) * reach
  const z = room.cz + (dz / mag) * reach
  if (pointInPolygon(x, z, room.polygon || [])) return { x, z }
  return { x: room.cx, z: room.cz }
}

function buildElectric(plan, seq) {
  const rooms = visibleRooms(plan)
  const hall = rooms.find((room) => roomKind(room) === 'eteinen')
  const box = planBounds(plan)
  const panel = hall
    ? { x: hall.cx, z: hall.cz }
    : { x: box.minX + (box.maxX - box.minX) * 0.28, z: box.minZ + 0.55 }
  const nodes = [{
    id: seq(),
    system: 'electric',
    kind: 'panel',
    name: 'Sähkökeskus',
    circuit: 1,
    x: round3(panel.x),
    y: serviceHeight(plan, 'electric', 'panel'),
    z: round3(panel.z),
  }]
  rooms.forEach((room) => {
    const kind = roomKind(room)
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'light',
      name: 'Valaisin',
      circuit: 1,
      roomId: room.id,
      x: round3(room.cx),
      y: serviceHeight(plan, 'electric', 'light'),
      z: round3(room.cz),
    })
    const sw = switchSpot(plan, room)
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'switch',
      name: 'Kytkin',
      circuit: 1,
      roomId: room.id,
      x: round3(sw.x),
      y: serviceHeight(plan, 'electric', 'switch'),
      z: round3(sw.z),
    })
    socketSpots(room, socketCount(kind)).forEach((spot) => {
      nodes.push({
        id: seq(),
        system: 'electric',
        kind: 'socket',
        name: 'Pistorasia',
        circuit: 2,
        roomId: room.id,
        roomKind: kind,
        x: round3(spot.x),
        y: serviceHeight(plan, 'electric', 'socket'),
        z: round3(spot.z),
      })
    })
  })
  fixtureServiceSpecs(plan.fixtures).filter((item) => item.system === 'electric').forEach((spec) => {
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: spec.kind,
      role: spec.role,
      name: spec.name,
      voltage: spec.voltage,
      power: spec.power,
      dedicated: spec.dedicated,
      connection: spec.connection,
      cosPhi: spec.cosPhi ?? 1,
      fixtureType: spec.fixtureType,
      linkedFrom: spec.linkedFrom,
      circuit: spec.circuit || (spec.kind === 'stove' ? 3 : spec.kind === 'heater' ? 4 : spec.kind === 'light' || spec.kind === 'switch' ? 1 : 2),
      x: round3(spec.x),
      y: serviceHeight(plan, 'electric', spec.kind),
      z: round3(spec.z),
    })
  })
  const living = rooms.find((room) => roomKind(room) === 'olohuone')
  if (living) {
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'data',
      name: 'Data',
      circuit: 5,
      x: round3(living.cx + 0.7),
      y: serviceHeight(plan, 'electric', 'data'),
      z: round3(living.cz),
    })
  }
  nodes.push({
    id: seq(),
    system: 'electric',
    kind: 'antenna',
    name: 'Antenni',
    circuit: 5,
    x: round3(panel.x - 0.45),
    y: serviceHeight(plan, 'electric', 'antenna'),
    z: round3(panel.z),
  })
  return { nodes, runs: [] }
}

const BUILDERS = { iv: buildIv, water: buildWater, drain: buildDrain, electric: buildElectric }

const UNIQUE_EQUIPMENT = new Set(['ahu', 'panel', 'manifold', 'kv-manifold', 'lv-manifold', 'inlet', 'shutoff', 'dhw-tank', 'heat-source', 'floor-manifold', 'buffer-tank', 'outdoor-terminal', 'exhaust-terminal'])

function sameDevice(a, b) {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.role && b.role && a.role !== b.role) return false
  return Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0)) < 0.5
}

function runOverlaps(run, locked) {
  const a = run?.points || []
  if (a.length < 2) return false
  return locked.some((other) => {
    const b = other.points || []
    if (b.length < 2) return false
    if (other.kind && run.kind && other.kind !== run.kind) return false
    const close = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.45
    return (close(a[0], b[0]) && close(a[a.length - 1], b[b.length - 1]))
      || (close(a[0], b[b.length - 1]) && close(a[a.length - 1], b[0]))
  })
}

function hasKind(nodes, ...kinds) {
  return nodes.some((node) => kinds.includes(node.kind))
}

export function missingEquipment(plan, system) {
  const nodes = ensureServices(plan).nodes.filter((node) => node.system === system)
  const missing = []
  if (system === 'iv') {
    if (!hasKind(nodes, 'ahu')) missing.push('IV-kone')
    if (!hasKind(nodes, 'valve', 'hood')) missing.push('Tuloventtiili tai poistoventtiili')
  } else if (system === 'electric') {
    if (!hasKind(nodes, 'panel')) missing.push('Sähkökeskus')
    if (!nodes.some((node) => !['panel', 'junction', 'heater-control'].includes(node.kind))) missing.push('Pistorasia, valaisin tai kytkin')
  } else if (system === 'water') {
    if (!hasKind(nodes, 'manifold', 'kv-manifold')) missing.push('Jakotukki')
    if (!hasKind(nodes, 'fixture', 'water-point', 'outdoor-tap')) missing.push('Vesipiste')
  } else if (system === 'drain') {
    if (!hasKind(nodes, 'floor-drain')) missing.push('Lattiakaivo')
  } else if (system === 'heat') {
    if (!hasKind(nodes, 'floor-manifold', 'heat-source', 'heater-rad')) missing.push('Lattialämmityksen jakotukki tai lämmönlähde')
  }
  return missing
}

function canRouteEquipment(system, nodes) {
  if (system === 'iv') return hasKind(nodes, 'ahu') && (hasKind(nodes, 'valve', 'hood') || hasKind(nodes, 'outdoor-terminal', 'exhaust-terminal'))
  if (system === 'electric') return hasKind(nodes, 'panel') && nodes.some((node) => !['panel', 'junction', 'heater-control'].includes(node.kind))
  if (system === 'water') return hasKind(nodes, 'manifold', 'kv-manifold') && hasKind(nodes, 'fixture', 'water-point', 'outdoor-tap')
  if (system === 'drain') return hasKind(nodes, 'floor-drain')
  if (system === 'heat') return hasKind(nodes, 'heat-source', 'floor-manifold', 'heater-rad') && nodes.filter((node) => ['heat-source', 'floor-manifold', 'heater-rad'].includes(node.kind)).length >= 1 && (hasKind(nodes, 'heater-rad') || (hasKind(nodes, 'heat-source') && hasKind(nodes, 'floor-manifold')))
  return false
}

function anchorRuns(builtNodes, builtRuns, existing) {
  const used = new Set()
  const pairs = []
  existing.forEach((node) => {
    let best = null
    let bestD = Infinity
    builtNodes.forEach((built) => {
      if (used.has(built)) return
      if (built.kind !== node.kind) return
      if (node.role && built.role && node.role !== built.role) return
      const dist = Math.hypot((built.x || 0) - (node.x || 0), (built.z || 0) - (node.z || 0))
      if (dist < bestD) {
        bestD = dist
        best = built
      }
    })
    if (!best) return
    used.add(best)
    pairs.push({ built: best, dx: (node.x || 0) - (best.x || 0), dz: (node.z || 0) - (best.z || 0) })
  })
  return builtRuns.map((run) => ({
    ...run,
    points: (run.points || []).map((point) => {
      let best = null
      let bestD = 0.45
      pairs.forEach((pair) => {
        const dist = Math.hypot(point.x - pair.built.x, point.z - pair.built.z)
        if (dist < bestD) {
          bestD = dist
          best = pair
        }
      })
      if (!best || (Math.abs(best.dx) < 0.001 && Math.abs(best.dz) < 0.001)) return { ...point }
      return { ...point, x: round3(point.x + best.dx), z: round3(point.z + best.dz) }
    }),
  }))
}

function routeIvExisting(existing) {
  const ahu = existing.find((node) => node.kind === 'ahu')
  if (!ahu) return []
  const y = Number.isFinite(ahu.y) ? ahu.y : 2.3
  const origin = { x: ahu.x, y, z: ahu.z }
  const supply = existing.filter((node) => node.kind === 'valve' && node.role === 'tulo')
  const extract = existing.filter((node) => (node.kind === 'valve' && node.role === 'poisto') || node.kind === 'hood')
  const runs = []
  if (supply.length) runs.push(...routeTree(origin, supply, 'tulo').runs)
  if (extract.length) runs.push(...routeTree(origin, extract, 'poisto').runs)
  const outdoor = existing.find((node) => node.kind === 'outdoor-terminal')
  const exhaust = existing.find((node) => node.kind === 'exhaust-terminal')
  const supplyFlow = Math.round(supply.reduce((sum, item) => sum + (item.flow || 0), 0))
  const extractFlow = Math.round(extract.reduce((sum, item) => sum + (item.flow || 0), 0))
  if (outdoor) {
    runs.push({ system: 'iv', kind: 'ulko', role: 'trunk', size: 160, flow: supplyFlow, points: ortho(origin, { x: outdoor.x, y, z: outdoor.z }) })
  }
  if (exhaust) {
    runs.push({ system: 'iv', kind: 'jate', role: 'trunk', size: 160, flow: extractFlow, points: ortho(origin, { x: exhaust.x, y, z: exhaust.z }) })
  }
  return separateIv(runs)
}

function wantsCold(node) {
  if (node.kind === 'water-point') return node.supply !== 'hot' && (node.flowCold == null || node.flowCold > 0)
  if (node.cold != null) return Boolean(node.cold)
  return node.kind === 'outdoor-tap' || node.kind === 'fixture'
}

function wantsHot(node) {
  if (node.kind === 'water-point') return node.supply !== 'cold' && (node.flowHot == null || node.flowHot > 0)
  if (node.hot != null) return Boolean(node.hot)
  return false
}

function routeWaterExisting(plan, existing, options) {
  const y = 0.35
  const inlet = existing.find((node) => node.kind === 'inlet')
  const shutoff = existing.find((node) => node.kind === 'shutoff')
  const manifold = existing.find((node) => node.kind === 'manifold' || node.kind === 'kv-manifold')
  const targets = existing.filter((node) => node.kind === 'fixture' || node.kind === 'water-point' || node.kind === 'outdoor-tap')
  if (!manifold || !targets.length) return []
  const runs = []
  const main = [inlet, shutoff, manifold].filter(Boolean)
  if (main.length >= 2) {
    runs.push({
      system: 'water',
      kind: 'cold',
      role: 'main',
      size: 25,
      points: main.map((point) => ({ x: round3(point.x), y, z: round3(point.z) })),
    })
  }
  targets.filter(wantsCold).forEach((target) => {
    runs.push({
      system: 'water',
      kind: 'cold',
      role: 'branch',
      size: 16,
      deviceId: target.id,
      points: ortho(manifold, { x: target.x, y, z: target.z }),
    })
  })
  const hotPoints = targets.filter(wantsHot)
  if (hotPoints.length) {
    const tank = existing.find((node) => node.kind === 'dhw-tank' || node.kind === 'dhw-exchanger')
    const lv = existing.find((node) => node.kind === 'lv-manifold')
    const hotOrigin = lv || tank || manifold
    const headerEnd = {
      x: average(hotPoints.map((item) => item.x)),
      y,
      z: average(hotPoints.map((item) => item.z)),
    }
    const header = ortho(hotOrigin, headerEnd)
    runs.push({ system: 'water', kind: 'hot', role: 'header', size: 20, points: header })
    hotPoints.forEach((target) => {
      const hit = closestOn(header, target)
      runs.push({
        system: 'water',
        kind: 'hot',
        role: 'branch',
        size: 16,
        deviceId: target.id,
        points: ortho({ x: hit.x, y, z: hit.z }, { x: target.x + 0.12, y, z: target.z }),
      })
    })
    let far = hotPoints[0]
    let best = 0
    hotPoints.forEach((item) => {
      const dist = Math.hypot(item.x - hotOrigin.x, item.z - hotOrigin.z)
      if (dist > best) {
        best = dist
        far = item
      }
    })
    if (best > 4) {
      runs.push({
        system: 'water',
        kind: 'circ',
        role: 'branch',
        size: 16,
        points: ortho(
          { x: far.x + 0.18, y, z: far.z + 0.18 },
          { x: hotOrigin.x + 0.18, y, z: hotOrigin.z + 0.18 },
        ),
      })
    }
  }
  if (options.floorHeating) {
    const rooms = visibleRooms(plan)
    const chosen = [
      rooms.find((room) => roomKind(room) === 'olohuone'),
      rooms.find((room) => roomKind(room) === 'kylpyhuone') || rooms.find((room) => roomKind(room) === 'wc'),
    ].filter(Boolean)
    chosen.forEach((room) => {
      const loop = heatingLoop(room)
      if (loop) runs.push({ system: 'water', kind: 'floorheat', role: 'loop', size: 16, points: loop })
    })
  }
  return runs
}

function routeDrainExisting(plan, existing) {
  let cursor = 0
  const seq = () => {
    cursor += 1
    return `drain-tmp-${cursor}`
  }
  const built = buildDrain(plan, seq)
  return anchorRuns(built.nodes, built.runs, existing)
}

function routeElectricExisting(plan, existing) {
  const panel = existing.find((node) => node.kind === 'panel')
  if (!panel) return { runs: [], electric: null }
  const devices = existing.filter((node) => !['panel', 'junction', 'heater-control'].includes(node.kind))
  if (!devices.length) return { runs: [], electric: null }
  const groups = new Map()
  devices.forEach((device) => {
    const id = device.circuit || (device.kind === 'light' || device.kind === 'switch' ? 1 : 2)
    const list = groups.get(id) || []
    list.push(device)
    groups.set(id, list)
  })
  const runs = []
  const circuits = []
  groups.forEach((list, id) => {
    let cursor = panel
    const ordered = chainOrder(panel, list)
    ordered.forEach((device) => {
      const points = ortho(
        { x: cursor.x, y: cursor.y || panel.y || 1.4, z: cursor.z },
        { x: device.x, y: device.y || serviceHeight(plan, 'electric', device.kind), z: device.z },
      )
      runs.push({
        system: 'electric',
        kind: 'wire',
        circuit: id,
        role: device.dedicated ? 'radial' : 'chain',
        deviceId: device.id,
        roomId: device.roomId || '',
        points,
      })
      cursor = device
    })
    const length = Math.round(runs.filter((run) => run.circuit === id).reduce((sum, run) => sum + polylineMetres(run.points), 0) * 10) / 10
    circuits.push({
      id,
      description: CIRCUITS.find((item) => item.id === id)?.name || '',
      deviceIds: list.map((item) => item.id),
      devices: list.map((item) => item.name || item.kind),
      rooms: [...new Set(list.map((item) => item.roomId).filter(Boolean))],
      length,
      topology: list.some((item) => item.kind === 'light') ? 'lighting' : 'socket',
    })
  })
  return {
    runs,
    electric: {
      circuits,
      totalPower: existing.reduce((sum, node) => sum + (Number(node.power) || 0), 0),
    },
  }
}

function routeHeatExisting(existing) {
  const y = 0.4
  const source = existing.find((node) => node.kind === 'heat-source')
  const manifold = existing.find((node) => node.kind === 'floor-manifold')
  const rads = existing.filter((node) => node.kind === 'heater-rad')
  const runs = []
  if (source && manifold) {
    runs.push({ system: 'heat', kind: 'heat-supply', role: 'main', size: 25, points: ortho({ x: source.x, y, z: source.z }, { x: manifold.x, y, z: manifold.z }) })
    runs.push({ system: 'heat', kind: 'heat-return', role: 'main', size: 25, points: ortho({ x: source.x + 0.12, y, z: source.z }, { x: manifold.x + 0.12, y, z: manifold.z }) })
  }
  const origin = manifold || source
  if (origin) {
    rads.forEach((rad) => {
      runs.push({ system: 'heat', kind: 'heat-supply', role: 'branch', deviceId: rad.id, points: ortho({ x: origin.x, y, z: origin.z }, { x: rad.x, y: rad.y || 0.25, z: rad.z }) })
    })
  }
  return runs
}

function routesFromEquipment(plan, system, existing, options) {
  if (system === 'iv') return { runs: routeIvExisting(existing) }
  if (system === 'water') return { runs: routeWaterExisting(plan, existing, options) }
  if (system === 'drain') return { runs: routeDrainExisting(plan, existing) }
  if (system === 'electric') return routeElectricExisting(plan, existing)
  if (system === 'heat') return { runs: routeHeatExisting(existing) }
  return { runs: [] }
}

export function equipmentSnapshot(plan, systems) {
  const wanted = new Set(systems)
  return ensureServices(plan).nodes
    .filter((node) => wanted.has(node.system))
    .map((node) => ({
      id: node.id,
      system: node.system,
      kind: node.kind,
      role: node.role || '',
      name: node.name || '',
      x: node.x,
      y: node.y,
      z: node.z,
      size: node.size ?? null,
      w: node.w ?? null,
      d: node.d ?? null,
      flow: node.flow ?? null,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export function suggestEquipment(plan, system, options = {}) {
  const systems = system === 'lvi' ? ['water', 'drain', 'heat'] : [system]
  const proposals = []
  systems.forEach((id) => {
    const existing = ensureServices(plan).nodes.filter((node) => node.system === id)
    if (id === 'heat') {
      if (!existing.some((node) => node.kind === 'floor-manifold')) {
        const spot = techSpot(plan)
        proposals.push({
          id: `sug-heat-${proposals.length}`,
          system: 'heat',
          kind: 'floor-manifold',
          name: 'Lattialämmityksen jakotukki',
          x: spot.x,
          y: 0.5,
          z: spot.z,
          ghost: true,
          suggested: true,
        })
      }
      return
    }
    const builder = BUILDERS[id]
    if (!builder) return
    let cursor = 0
    const seq = () => {
      cursor += 1
      return `sug-${id}-${cursor}`
    }
    const built = builder(plan, seq, options)
    built.nodes.forEach((node) => {
      if (UNIQUE_EQUIPMENT.has(node.kind) && (existing.some((item) => item.kind === node.kind) || proposals.some((item) => item.kind === node.kind && item.system === id))) return
      if (existing.some((kept) => sameDevice(kept, node))) return
      proposals.push({ ...node, system: id, ghost: true, suggested: true })
    })
  })
  return { proposals }
}

export function acceptEquipment(plan, system, options = {}) {
  const { proposals } = suggestEquipment(plan, system, options)
  if (!proposals.length) return plan
  const services = ensureServices(plan)
  let seq = plan?.seq || 1
  const nodes = services.nodes.map((node) => ({ ...node }))
  proposals.forEach((node) => {
    seq += 1
    const next = { ...node, id: `svc-${seq}`, auto: false }
    delete next.ghost
    delete next.suggested
    nodes.push(next)
  })
  return { ...plan, seq, services: { ...services, nodes } }
}

export function autoRoute(plan, system, options = {}) {
  const current = ensureServices(plan)
  const frozen = JSON.parse(JSON.stringify(current.nodes))
  const existing = frozen.filter((node) => node.system === system)
  const missing = missingEquipment({ ...plan, services: { ...current, nodes: frozen } }, system)
  const kept = current.runs.filter((run) => run.system === system && (run.locked || run.manual))
  let fresh = []
  let electric = current.electric
  if (canRouteEquipment(system, existing)) {
    const built = routesFromEquipment(plan, system, existing, options)
    fresh = (built.runs || []).filter((run) => !runOverlaps(run, kept))
    if (built.electric) electric = built.electric
  }
  let cursor = plan?.seq || 1
  const seq = () => {
    cursor += 1
    return `svc-${cursor}`
  }
  const stamped = fresh.map((run) => ({ ...run, id: seq(), system, locked: false, manual: false }))
  const replace = stamped.length > 0
  return {
    ...plan,
    seq: cursor,
    routeNotice: missing.length ? `Puuttuu: ${missing.join(', ')}` : '',
    services: {
      ...current,
      electric,
      layers: { ...current.layers, [system]: current.layers[system] !== false },
      nodes: frozen,
      runs: replace
        ? [...current.runs.filter((run) => run.system !== system || run.locked || run.manual), ...stamped]
        : current.runs.map((run) => ({ ...run })),
    },
  }
}

export function autoRouteAll(plan, options = {}) {
  return ['iv', 'water', 'drain', 'electric', 'heat'].reduce((current, system) => {
    const next = autoRoute(current, system, options)
    const { routeNotice, ...rest } = next
    return { ...rest, routeNotice: [current.routeNotice, routeNotice].filter(Boolean).join(' · ') }
  }, plan)
}

export function designServices(plan, options = {}) {
  return ['iv', 'water', 'drain', 'electric'].reduce((current, system) => {
    const placed = acceptEquipment(current, system, options)
    const routed = autoRoute(placed, system, options)
    const { routeNotice, ...rest } = routed
    return rest
  }, plan)
}

export function setServiceLayer(plan, system, visible) {
  const services = ensureServices(plan)
  return { ...plan, services: { ...services, layers: { ...services.layers, [system]: Boolean(visible) } } }
}

function distanceToPolygon(x, z, points) {
  let best = Infinity
  for (let i = 0; i < (points || []).length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2))
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)))
  }
  return best
}

function roomAtPoint(rooms, x, z) {
  const inside = (rooms || []).find((room) => pointInPolygon(x, z, room.polygon || room.gross || []))
  if (inside) return inside
  let best = null
  ;(rooms || []).forEach((room) => {
    const dist = distanceToPolygon(x, z, room.polygon || room.gross || [])
    if (dist <= 0.45 && (!best || dist < best.dist)) best = { dist, room }
  })
  return best?.room || null
}

function polylineMetres(points) {
  let sum = 0
  for (let i = 1; i < (points || []).length; i += 1) {
    sum += Math.hypot(points[i].x - points[i - 1].x, (points[i].y || 0) - (points[i - 1].y || 0), points[i].z - points[i - 1].z)
  }
  return sum
}

function chainOrder(origin, devices) {
  const left = [...devices]
  const ordered = []
  let cursor = origin
  while (left.length) {
    let best = 0
    let bestD = Infinity
    left.forEach((item, index) => {
      const dist = Math.hypot(item.x - cursor.x, item.z - cursor.z)
      if (dist < bestD) {
        bestD = dist
        best = index
      }
    })
    const next = left.splice(best, 1)[0]
    ordered.push(next)
    cursor = next
  }
  return ordered
}

function routeElectricTopology({ plan, panel, nodes, circuits, nid, lockedDevices }) {
  const fresh = []
  const ceiling = serviceHeight(plan, 'electric', 'light')
  const socketY = serviceHeight(plan, 'electric', 'socket')
  const addWire = (circuit, extra) => {
    fresh.push({
      id: nid(),
      system: 'electric',
      kind: 'wire',
      circuit: circuit.id,
      cable: circuit.cable,
      marking: extra.marking || '',
      showMark: Boolean(extra.showMark),
      locked: false,
      fuse: circuit.fuse,
      rcd: circuit.rcd,
      role: extra.role,
      roomId: extra.roomId || '',
      deviceId: extra.deviceId,
      points: extra.points,
    })
  }
  const daisy = (circuit, from, lights, roomId) => {
    let cursor = from
    lights.forEach((light, index) => {
      if (lockedDevices.has(light.id)) return
      addWire(circuit, {
        role: 'luminaire',
        roomId,
        deviceId: light.id,
        showMark: index === 0,
        marking: index === 0 ? segmentMark(circuit) : '',
        points: ortho({ x: cursor.x, y: ceiling, z: cursor.z }, { x: light.x, y: light.y || ceiling, z: light.z }),
      })
      cursor = light
    })
  }
  circuits.forEach((circuit) => {
    const members = nodes.filter((node) => circuit.deviceIds.includes(node.id) && !lockedDevices.has(node.id))
    if (!members.length) return
    if (circuit.topology === 'lighting' || circuit.role === 'light') {
      const groups = new Map()
      members.forEach((device) => {
        const key = device.roomId || 'talo'
        const list = groups.get(key) || []
        list.push(device)
        groups.set(key, list)
      })
      const boxes = []
      ;[...groups.entries()]
        .map(([roomId, devices]) => {
          const userBox = nodes.find((node) => node.kind === 'junction' && !node.autoBox && (roomId === 'talo' ? !node.roomId : node.roomId === roomId))
          if (userBox) {
            userBox.circuit = circuit.id
            return { roomId, devices, box: userBox }
          }
          const room = visibleRooms(plan).find((item) => item.id === roomId)
          const anchor = devices.find((item) => item.kind === 'light') || devices[0]
          const cx = room?.cx ?? anchor?.x ?? panel.x
          const cz = room?.cz ?? anchor?.z ?? panel.z
          const sw = devices.find((item) => item.kind === 'switch')
          let x = cx
          let z = cz
          if (sw && Math.hypot(sw.x - cx, sw.z - cz) > 0.05) {
            const dx = sw.x - cx
            const dz = sw.z - cz
            const mag = Math.hypot(dx, dz) || 1
            const step = Math.min(0.45, mag * 0.45)
            x += (dx / mag) * step
            z += (dz / mag) * step
          } else {
            x += 0.35
          }
          const box = {
            id: nid(),
            system: 'electric',
            kind: 'junction',
            name: 'Jakorasia',
            autoBox: true,
            circuit: circuit.id,
            roomId: roomId === 'talo' ? '' : roomId,
            roomName: room?.name || devices.find((item) => item.roomName)?.roomName || '',
            x: round3(x),
            z: round3(z),
            y: ceiling,
          }
          nodes.push(box)
          return { roomId, devices, box }
        })
        .sort((a, b) => Math.hypot(a.box.x - panel.x, a.box.z - panel.z) - Math.hypot(b.box.x - panel.x, b.box.z - panel.z))
        .forEach((entry, index, all) => {
          boxes.push(entry)
          const prev = index === 0 ? panel : all[index - 1].box
          addWire(circuit, {
            role: 'trunk',
            roomId: entry.roomId,
            showMark: true,
            marking: segmentMark(circuit),
            points: ortho({ x: prev.x, y: index === 0 ? panel.y : ceiling, z: prev.z }, { x: entry.box.x, y: ceiling, z: entry.box.z }),
          })
        })
      const paired = new Set()
      const twoWay = members.filter((item) => item.kind === 'switch' && (item.switchStyle === 'two-way' || item.switchStyle === 'vaihto'))
      twoWay.forEach((sw) => {
        if (paired.has(sw.id)) return
        const mate = twoWay.find((other) => other.id !== sw.id && !paired.has(other.id) && (
          (sw.pairId && other.pairId === sw.pairId) || (!sw.pairId && !other.pairId && (other.roomId || 'talo') === (sw.roomId || 'talo'))
        ))
        if (!mate) return
        paired.add(sw.id)
        paired.add(mate.id)
        const home = boxes.find((item) => item.roomId === (sw.roomId || 'talo')) || boxes[0]
        if (!home) return
        addWire(circuit, {
          role: 'switch-drop',
          roomId: home.roomId,
          deviceId: sw.id,
          showMark: true,
          marking: segmentMark(circuit, { switched: true, cores: 4 }),
          points: ortho({ x: home.box.x, y: ceiling, z: home.box.z }, { x: sw.x, y: sw.y || 1.1, z: sw.z }),
        })
        addWire(circuit, {
          role: 'traveler',
          roomId: home.roomId,
          deviceId: mate.id,
          showMark: true,
          marking: segmentMark(circuit, { switched: true, cores: 4 }),
          points: ortho({ x: sw.x, y: sw.y || 1.1, z: sw.z }, { x: mate.x, y: mate.y || 1.1, z: mate.z }),
        })
      })
      boxes.forEach((entry) => {
        const switchesHere = entry.devices.filter((item) => item.kind === 'switch' && !paired.has(item.id))
        const lights = entry.devices.filter((item) => item.kind === 'light')
        const series = switchesHere.find((item) => item.switchStyle === 'series' || item.switchStyle === 'sarja')
        switchesHere.forEach((sw) => {
          if (lockedDevices.has(sw.id)) return
          addWire(circuit, {
            role: 'switch-drop',
            roomId: entry.roomId,
            deviceId: sw.id,
            showMark: true,
            marking: segmentMark(circuit, { switched: true, cores: sw === series ? 4 : 3 }),
            points: ortho({ x: entry.box.x, y: ceiling, z: entry.box.z }, { x: sw.x, y: sw.y || 1.1, z: sw.z }),
          })
        })
        if (series && lights.length) {
          const tagged = lights.some((item) => Number(item.gang) === 2)
          const first = tagged ? lights.filter((item) => Number(item.gang) !== 2) : lights.slice(0, Math.ceil(lights.length / 2))
          const second = tagged ? lights.filter((item) => Number(item.gang) === 2) : lights.slice(Math.ceil(lights.length / 2))
          daisy(circuit, entry.box, first, entry.roomId)
          daisy(circuit, entry.box, second, entry.roomId)
        } else {
          daisy(circuit, entry.box, lights, entry.roomId)
        }
      })
      return
    }
    if (circuit.topology === 'socket' || circuit.role === 'socket') {
      const radial = members.filter((item) => item.feed === 'radial' || item.dedicated)
      const chained = members.filter((item) => item.feed !== 'radial' && !item.dedicated)
      radial.forEach((device) => {
        addWire(circuit, {
          role: 'radial',
          roomId: device.roomId,
          deviceId: device.id,
          showMark: true,
          marking: segmentMark(circuit),
          points: ortho({ x: panel.x, y: socketY, z: panel.z }, { x: device.x, y: device.y || socketY, z: device.z }),
        })
      })
      let cursor = { x: panel.x, y: socketY, z: panel.z }
      chainOrder(panel, chained).forEach((device) => {
        addWire(circuit, {
          role: 'chain',
          roomId: device.roomId,
          deviceId: device.id,
          showMark: true,
          marking: segmentMark(circuit),
          points: ortho(cursor, { x: device.x, y: device.y || socketY, z: device.z }),
        })
        cursor = { x: device.x, y: device.y || socketY, z: device.z }
      })
      return
    }
    members.forEach((device) => {
      if (device.kind === 'heater') {
        let control = nodes.find((node) => node.kind === 'heater-control' && (node.heaterId === device.id || (!node.heaterId && node.roomId && node.roomId === device.roomId)))
        if (!control) {
          control = {
            id: nid(),
            system: 'electric',
            kind: 'heater-control',
            name: 'Kiukaan ohjaus',
            autoBox: true,
            heaterId: device.id,
            circuit: circuit.id,
            roomId: device.roomId,
            roomName: device.roomName,
            x: round3(device.x + 0.55),
            z: round3(device.z),
            y: 1.5,
          }
          nodes.push(control)
        } else {
          control.circuit = circuit.id
          control.heaterId = control.heaterId || device.id
        }
        addWire(circuit, {
          role: 'radial',
          roomId: device.roomId,
          deviceId: control.id,
          showMark: true,
          marking: segmentMark(circuit),
          points: ortho({ x: panel.x, y: panel.y, z: panel.z }, { x: control.x, y: control.y, z: control.z }),
        })
        addWire(circuit, {
          role: 'link',
          roomId: device.roomId,
          deviceId: device.id,
          showMark: true,
          marking: segmentMark(circuit),
          points: ortho({ x: control.x, y: control.y, z: control.z }, { x: device.x, y: device.y || 0.9, z: device.z }),
        })
        return
      }
      const y = circuit.phases >= 3 ? 0.55 : (device.y || 0.9)
      addWire(circuit, {
        role: 'radial',
        roomId: device.roomId,
        deviceId: device.id,
        showMark: true,
        marking: circuit.role === 'signal' ? markingFor(circuit) : segmentMark(circuit),
        points: ortho({ x: panel.x, y: panel.y, z: panel.z }, { x: device.x, y, z: device.z }),
      })
    })
  })
  return { nodes, runs: fresh }
}

export function rewireElectric(plan) {
  const services = ensureServices(plan)
  let seq = plan?.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = (services.nodes || [])
    .map((node) => ({ ...node }))
    .filter((node) => !(node.autoBox && (node.kind === 'junction' || node.kind === 'heater-control')))
  const electric = nodes.filter((node) => node.system === 'electric')
  if (!electric.some((node) => node.kind !== 'panel' && node.kind !== 'junction')) {
    return { ...plan, services: { ...services, nodes } }
  }
  let panel = electric.find((node) => node.kind === 'panel')
  if (!panel) {
    const anchor = electric.find((node) => node.kind !== 'junction') || electric[0]
    panel = {
      id: nid(),
      system: 'electric',
      kind: 'panel',
      name: 'Sähkökeskus',
      voltage: 400,
      x: round3((anchor?.x || 0) + 0.2),
      z: round3((anchor?.z || 0) - 1.2),
      y: serviceHeight(plan, 'electric', 'panel'),
    }
    nodes.push(panel)
  }
  const rooms = visibleRooms(plan)
  const loads = nodes
    .filter((node) => node.system === 'electric' && node.kind !== 'panel' && node.kind !== 'junction' && node.kind !== 'heater-control')
    .map((node) => {
      const room = roomAtPoint(rooms, node.x, node.z)
      return {
        ...node,
        roomId: node.roomId || room?.id || '',
        roomKind: node.roomKind || (room ? roomKind(room) : ''),
        roomName: node.roomName || room?.name || '',
      }
    })
  const planned = planCircuits(loads)
  const byId = new Map(planned.devices.filter((device) => device.id).map((device) => [device.id, device]))
  nodes = nodes.map((node) => {
    const next = byId.get(node.id)
    if (!next) return node
    return { ...node, ...next, id: node.id, x: node.x, y: node.y, z: node.z }
  })
  const locked = services.runs.filter((run) => run.system === 'electric' && run.locked)
  const lockedDevices = new Set(locked.map((run) => run.deviceId).filter(Boolean))
  const routed = routeElectricTopology({ plan, panel, nodes, circuits: planned.circuits, nid, lockedDevices })
  nodes = routed.nodes
  const fresh = routed.runs
  const circuits = planned.circuits.map((circuit) => {
    const related = [...fresh, ...locked].filter((run) => run.circuit === circuit.id || circuit.deviceIds.includes(run.deviceId))
    const total = related.reduce((sum, run) => sum + polylineMetres(run.points), 0)
    const trunk = related.filter((run) => run.role === 'trunk').reduce((sum, run) => sum + polylineMetres(run.points), 0)
    let path = total
    if (circuit.topology === 'lighting') {
      const byRoom = new Map()
      related.filter((run) => run.role && run.role !== 'trunk').forEach((run) => {
        const key = run.roomId || 'talo'
        byRoom.set(key, (byRoom.get(key) || 0) + polylineMetres(run.points))
      })
      path = trunk + Math.max(0, ...byRoom.values(), 0)
    }
    const sized = applyVoltageDrop(circuit, path || total)
    return { ...sized, length: Math.round(total * 10) / 10 }
  })
  const circuitById = new Map(circuits.map((circuit) => [circuit.id, circuit]))
  nodes = nodes.map((node) => {
    const circuit = circuitById.get(node.circuit)
    if (!circuit || node.system !== 'electric') return node
    const dropNote = circuit.warning && !String(node.warning || '').includes('Jännitehäviö') ? circuit.warning : ''
    return {
      ...node,
      dropPct: circuit.dropPct,
      cableLength: circuit.length,
      warning: [node.warning, dropNote].filter(Boolean).join('. '),
    }
  })
  const kept = services.runs.filter((run) => run.system !== 'electric' || run.locked)
  return {
    ...plan,
    seq,
    services: {
      ...services,
      nodes,
      runs: [...kept, ...fresh],
      electric: {
        totalPower: planned.totalPower,
        mainFuse: planned.mainFuse,
        mainAmps: planned.mainAmps,
        phaseLoads: planned.phaseLoads,
        circuits,
      },
    },
  }
}

function chainPoints(points, y) {
  const out = []
  points.forEach((point, index) => {
    const at = { x: round3(point.x), y, z: round3(point.z) }
    if (!out.length) {
      out.push(at)
      return
    }
    const prev = out[out.length - 1]
    if (Math.abs(prev.x - at.x) > 0.02) out.push({ x: at.x, y, z: prev.z })
    if (Math.abs(prev.z - at.z) > 0.02 || Math.abs((out[out.length - 1].x) - at.x) > 0.02) out.push(at)
  })
  return out.length > 1 ? out : [...out, { x: round3((points[0]?.x || 0) + 0.05), y, z: round3(points[0]?.z || 0) }]
}

function openingCenter(wall, opening) {
  const len = segmentLength(wall.a, wall.b) || 1
  const t = (opening.offset || 0) / len
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  }
}

function inwardFromWall(wall, point, rooms) {
  const len = segmentLength(wall.a, wall.b) || 1
  let nx = -(wall.b.z - wall.a.z) / len
  let nz = (wall.b.x - wall.a.x) / len
  const probeA = { x: point.x + nx * 0.35, z: point.z + nz * 0.35 }
  const probeB = { x: point.x - nx * 0.35, z: point.z - nz * 0.35 }
  const inside = (probe) => rooms.some((room) => pointInPolygon(probe.x, probe.z, room.polygon || []))
  if (!inside(probeA) && inside(probeB)) {
    nx = -nx
    nz = -nz
  }
  return { x: round3(point.x + nx * 0.32), z: round3(point.z + nz * 0.32) }
}

function techSpot(plan) {
  const rooms = visibleRooms(plan)
  const tech = rooms.find((room) => roomKind(room) === 'tekninen')
    || rooms.find((room) => roomKind(room) === 'kodinhoitohuone')
    || rooms.find((room) => roomKind(room) === 'eteinen')
  if (tech) return { x: round3(tech.cx), z: round3(tech.cz) }
  const box = planBounds(plan)
  return { x: round3(box.minX + 1.3), z: round3(box.minZ + 1.4) }
}

function stampWaterPoint(node, rooms) {
  const spec = waterPointSpec(node.pointType)
  const supply = node.supply || spec.supply
  const room = roomAtPoint(rooms, node.x, node.z)
  return {
    ...node,
    name: node.name || spec.name,
    supply,
    flowCold: node.flowManual ? Number(node.flowCold) || 0 : spec.flowCold,
    flowHot: supply === 'cold' ? 0 : (node.flowManual ? Number(node.flowHot) || 0 : spec.flowHot),
    circulation: Boolean(node.circulation),
    roomId: room?.id || node.roomId || '',
    roomName: room?.name || node.roomName || '',
    roomKind: room ? roomKind(room) : (node.roomKind || ''),
  }
}

function syncLinkedElectric(plan, wanted) {
  const services = ensureServices(plan)
  const keepIds = new Set(wanted.map((item) => item.linkedFrom))
  let seq = plan.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = services.nodes.filter((node) => node.system !== 'electric' || !node.linkedFrom || keepIds.has(node.linkedFrom) || String(node.linkedFrom).startsWith('yard:'))
  wanted.forEach((spec) => {
    const existing = nodes.find((node) => node.linkedFrom === spec.linkedFrom)
    const fields = {
      system: 'electric',
      kind: spec.kind,
      name: spec.name,
      voltage: spec.voltage,
      power: spec.power,
      cosPhi: spec.cosPhi ?? 1,
      connection: 'fixed',
      circuitMode: 'auto',
      linkedFrom: spec.linkedFrom,
      x: round3(spec.x),
      z: round3(spec.z),
    }
    ;['dedicated', 'rcd', 'wet', 'roomId', 'roomName', 'roomKind', 'role'].forEach((key) => {
      if (spec[key] != null) fields[key] = spec[key]
    })
    if (existing) {
      nodes = nodes.map((node) => (node.linkedFrom === spec.linkedFrom ? { ...node, ...fields, id: node.id, y: node.y } : node))
    } else {
      nodes.push({ id: nid(), y: serviceHeight(plan, 'electric', spec.kind), ...fields })
    }
  })
  return rewireElectric({ ...plan, seq, services: { ...services, nodes } })
}

function electricLinks(nodes, heating) {
  const wanted = []
  nodes.forEach((node) => {
    if (node.kind === 'dhw-tank') {
      const spec = tankElectric(node.litres || heating.dhwLitres, node.tankMode || heating.dhwMode)
      wanted.push({ ...spec, kind: spec.electricKind, linkedFrom: node.id, x: node.x + 0.45, z: node.z })
    }
    if (node.kind === 'heat-source') {
      const spec = sourceSpec(node.source || heating.source)
      if (spec.power > 0 && spec.electricKind) {
        wanted.push({ ...spec, kind: spec.electricKind, name: spec.name, linkedFrom: node.id, x: node.x + 0.45, z: node.z })
      }
    }
    if (node.kind === 'air-air') {
      wanted.push({ ...AIR_AIR, kind: AIR_AIR.electricKind, linkedFrom: node.id, x: node.x + 0.45, z: node.z })
    }
    if (node.kind === 'thermostat' || node.kind === 'actuator') {
      wanted.push({
        kind: node.kind,
        name: node.name || (node.kind === 'thermostat' ? 'Termostaatti' : 'Toimilaite'),
        voltage: 230,
        power: node.kind === 'thermostat' ? 5 : 3,
        cosPhi: 1,
        dedicated: false,
        role: 'socket',
        roomId: node.roomId || '',
        roomName: node.roomName || '',
        roomKind: node.roomKind || '',
        linkedFrom: node.id,
        x: node.x + 0.16,
        z: node.z,
      })
    }
    if (node.kind === 'floor-manifold') {
      wanted.push({
        kind: 'manifold-pump',
        name: 'Jakotukin pumppu ja ohjaus',
        voltage: 230,
        power: 90,
        cosPhi: 0.9,
        dedicated: true,
        role: 'power',
        linkedFrom: node.id,
        x: node.x + 0.38,
        z: node.z,
      })
    }
  })
  return wanted
}

function pushBranch(fresh, seq, origin, targets, flowKey, kind, y) {
  const active = targets.filter((item) => (item[flowKey] || 0) > 0)
  if (!active.length) return
  const sum = active.reduce((total, item) => total + item[flowKey], 0)
  const make = (points, extra) => {
    seq.n += 1
    fresh.push({
      id: `svc-${seq.n}`,
      system: 'water',
      kind,
      size: pexSize(extra.flow),
      flow: Math.round(extra.flow * 1000) / 1000,
      marking: extra.showMark ? `PEX ${pexSize(extra.flow)}` : '',
      showMark: Boolean(extra.showMark),
      locked: false,
      y,
      points,
      ...extra,
    })
  }
  if (active.length === 1) {
    const target = active[0]
    make(ortho({ x: origin.x, y, z: origin.z }, { x: target.x, y, z: target.z }), {
      role: 'branch',
      flow: target[flowKey],
      deviceId: target.id,
      showMark: true,
    })
    return
  }
  const end = { x: average(active.map((item) => item.x)), y, z: average(active.map((item) => item.z)) }
  const trunk = ortho({ x: origin.x, y, z: origin.z }, end)
  make(trunk, { role: 'header', flow: sum, showMark: true })
  active.forEach((target) => {
    const hit = closestOn(trunk, target)
    make(ortho({ x: hit.x, y, z: hit.z }, { x: target.x, y, z: target.z }), {
      role: 'branch',
      flow: target[flowKey],
      deviceId: target.id,
      showMark: false,
    })
  })
}

export function rewireWater(plan) {
  const services = ensureServices(plan)
  const heating = normalizeHeating(plan)
  let seq = plan?.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = (services.nodes || []).map((node) => ({ ...node }))
  const rooms = visibleRooms(plan)
  const hasDriven = nodes.some((node) => node.system === 'water' && (node.kind === 'water-point' || node.kind === 'dhw-tank' || node.kind === 'dhw-exchanger'))
  if (!hasDriven) return { ...plan, heating, services: { ...services, nodes } }
  nodes = nodes.map((node) => (node.kind === 'water-point' ? stampWaterPoint(node, rooms) : node))
  const points = nodes.filter((node) => node.kind === 'water-point')
  const box = planBounds(plan)
  const ensure = (kind, name, x, z, extra = {}) => {
    let node = nodes.find((item) => item.kind === kind && item.system === 'water')
    if (!node) {
      node = { id: nid(), system: 'water', kind, name, x: round3(x), z: round3(z), y: kind === 'dhw-tank' ? 0.9 : 0.35, auto: true, ...extra }
      nodes.push(node)
    }
    return node
  }
  const inlet = ensure('inlet', 'Vesiliittymä', box.minX + 0.55, box.minZ + 1.15)
  const shutoff = ensure('shutoff', 'Pääsulku', inlet.x + 0.7, inlet.z)
  const kv = ensure('kv-manifold', 'KV-jakotukki', shutoff.x + 0.7, shutoff.z + 0.45)
  const coldPoints = points.filter((item) => item.pointType !== 'drain-link' && item.flowCold > 0)
  const hotPoints = points.filter((item) => item.supply !== 'cold' && item.flowHot > 0)
  let tank = nodes.find((item) => item.kind === 'dhw-tank')
  let exchanger = nodes.find((item) => item.kind === 'dhw-exchanger')
  if (hotPoints.length && heating.dhw === 'exchanger') {
    nodes = nodes.filter((item) => item.kind !== 'dhw-tank' || item.auto !== true)
    tank = nodes.find((item) => item.kind === 'dhw-tank')
    if (!exchanger && !tank) {
      exchanger = { id: nid(), system: 'water', kind: 'dhw-exchanger', name: 'Käyttöveden siirrin', x: round3(kv.x + 0.2), z: round3(kv.z + 0.7), y: 1.3, auto: true }
      nodes.push(exchanger)
    }
  } else if (hotPoints.length && !tank) {
    tank = {
      id: nid(),
      system: 'water',
      kind: 'dhw-tank',
      name: 'Lämminvesivaraaja',
      litres: heating.dhwLitres || 300,
      tankMode: heating.dhwMode || 'electric',
      x: round3(kv.x + 0.15),
      z: round3(kv.z + 0.75),
      y: 0.9,
      auto: true,
    }
    nodes.push(tank)
  }
  if (tank) {
    tank.litres = tank.litres || heating.dhwLitres || 300
    tank.tankMode = tank.tankMode || heating.dhwMode || 'electric'
  }
  const hotOrigin = tank || exchanger
  const lv = hotPoints.length && hotOrigin ? ensure('lv-manifold', 'LV-jakotukki', hotOrigin.x + 0.55, hotOrigin.z) : null
  const fresh = []
  const counter = { n: seq }
  const y = 0.35
  const coldSum = coldPoints.reduce((sum, item) => sum + item.flowCold, 0)
  counter.n += 1
  fresh.push({
    id: `svc-${counter.n}`,
    system: 'water',
    kind: 'cold',
    role: 'main',
    size: pexSize(coldSum),
    flow: Math.round(coldSum * 1000) / 1000,
    marking: `PEX ${pexSize(coldSum)}`,
    showMark: true,
    locked: false,
    points: chainPoints([inlet, shutoff, kv], y),
  })
  pushBranch(fresh, counter, kv, coldPoints, 'flowCold', 'cold', y)
  if (lv && hotOrigin) {
    const hotSum = hotPoints.reduce((sum, item) => sum + item.flowHot, 0)
    counter.n += 1
    fresh.push({
      id: `svc-${counter.n}`,
      system: 'water',
      kind: 'hot',
      role: 'main',
      size: pexSize(hotSum),
      flow: Math.round(hotSum * 1000) / 1000,
      marking: `PEX ${pexSize(hotSum)}`,
      showMark: true,
      locked: false,
      points: ortho({ x: hotOrigin.x, y, z: hotOrigin.z }, { x: lv.x, y, z: lv.z }),
    })
    pushBranch(fresh, counter, lv, hotPoints, 'flowHot', 'hot', y)
    const circulating = hotPoints.filter((item) => item.circulation)
    if (circulating.length) {
      const far = circulating.reduce((best, item) => (Math.hypot(item.x - lv.x, item.z - lv.z) > Math.hypot(best.x - lv.x, best.z - lv.z) ? item : best))
      counter.n += 1
      fresh.push({
        id: `svc-${counter.n}`,
        system: 'water',
        kind: 'circ',
        role: 'return',
        size: 16,
        marking: 'PEX 16 kierto',
        showMark: true,
        locked: false,
        points: ortho({ x: far.x + 0.16, y, z: far.z + 0.16 }, { x: hotOrigin.x + 0.16, y, z: hotOrigin.z + 0.16 }),
      })
    }
  }
  seq = counter.n
  const locked = services.runs.filter((run) => run.system === 'water' && run.locked)
  const lockedDevices = new Set(locked.map((run) => run.deviceId).filter(Boolean))
  const routed = fresh.filter((run) => !run.deviceId || !lockedDevices.has(run.deviceId))
  const kept = services.runs.filter((run) => run.system !== 'water' || run.locked)
  const summary = {
    coldFlow: Math.round(coldSum * 1000) / 1000,
    hotFlow: Math.round(hotPoints.reduce((sum, item) => sum + item.flowHot, 0) * 1000) / 1000,
    coldSize: pexSize(coldSum),
    hotSize: pexSize(hotPoints.reduce((sum, item) => sum + item.flowHot, 0)),
    points: points.map((item) => ({ id: item.id, name: item.name, supply: item.supply, flowCold: item.flowCold, flowHot: item.flowHot, circulation: item.circulation })),
  }
  return syncLinkedElectric({
    ...plan,
    seq,
    heating,
    services: { ...services, nodes, runs: [...kept, ...routed], water: summary },
  }, electricLinks(nodes, heating))
}

function heatDemand(loads) {
  return (loads || []).filter((item) => item.watts > 0).map((item) => ({
    roomId: item.roomId,
    name: item.name,
    setpoint: item.setpoint,
    watts: Math.round(item.watts),
    wattsPerM2: Math.round((item.wattsPerM2 || 0) * 10) / 10,
  }))
}

function designHeatLoss(room, loads) {
  const calculated = (loads || []).find((item) => item.roomId === room.id)
  if (calculated && Number(calculated.watts) > 0) {
    return { wattsPerM2: calculated.wattsPerM2, power: Math.round(calculated.watts) }
  }
  return roomHeatLoss(room.area, room.kindName)
}

function assignRadiatorPower(nodes, rooms, loads, kind) {
  const grouped = new Map()
  nodes.filter((item) => item.kind === kind && item.roomId).forEach((node) => {
    const list = grouped.get(node.roomId) || []
    list.push(node)
    grouped.set(node.roomId, list)
  })
  grouped.forEach((list, roomId) => {
    const room = rooms.find((item) => item.id === roomId)
    if (!room) return
    const auto = list.filter((node) => !node.powerManual)
    if (!auto.length) return
    const reserved = list.filter((node) => node.powerManual).reduce((sum, node) => sum + (Number(node.power) || 0), 0)
    const loss = designHeatLoss(room, loads)
    const shares = splitRadiatorLoad(Math.max(0, loss.power - reserved), auto.length)
    auto.forEach((node, index) => {
      node.power = shares[index]
    })
  })
}

function radiatorSpots(plan, rooms) {
  const spots = []
  ;(plan.openings || []).filter((item) => item.kind === 'window').forEach((opening) => {
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    if (!wall) return
    const center = openingCenter(wall, opening)
    const inside = inwardFromWall(wall, center, rooms)
    const room = roomAtPoint(rooms, inside.x, inside.z)
    if (!room || roomKind(room) === 'sauna') return
    spots.push({ ...inside, room, windowId: opening.id })
  })
  return spots
}

function rewireHeatClassic(plan) {
  const services = ensureServices(plan)
  let heating = normalizeHeating(plan)
  let seq = plan?.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = (services.nodes || []).map((node) => ({ ...node }))
  const rooms = visibleRooms(plan).map((room) => ({ ...room, kindName: roomKind(room) }))
  const loads = heatingLoads(plan)
  const demand = heatDemand(loads)
  const spot = techSpot(plan)
  const ensure = (kind, name, x, z, extra = {}) => {
    let node = nodes.find((item) => item.kind === kind)
    if (!node) {
      node = { id: nid(), system: 'heat', kind, name, x: round3(x), z: round3(z), y: 0.9, auto: true, ...extra }
      nodes.push(node)
    }
    return node
  }
  const direct = heating.source === 'direct-electric' || heating.distribution === 'none'
  if (heating.source === 'direct-electric') heating = { ...heating, distribution: 'none' }
  if (!direct) {
    const source = ensure('heat-source', sourceSpec(heating.source).name, spot.x, spot.z, { source: heating.source })
    source.source = source.source || heating.source
    source.name = sourceSpec(source.source || heating.source).name
    let anchor = source
    if (heating.buffer) {
      anchor = ensure('buffer-tank', 'Puskurivaraaja', source.x + 0.8, source.z, { litres: heating.bufferLitres || 300 })
      anchor.litres = anchor.litres || heating.bufferLitres || 300
    }
    const useFloor = heating.distribution === 'floor' || heating.distribution === 'both'
    const useRad = heating.distribution === 'radiator' || heating.distribution === 'both'
    let manifold = null
    if (useFloor) manifold = ensure('floor-manifold', 'Lattialämmityksen jakotukki', anchor.x + 0.9, anchor.z + 0.4)
    if (!useRad) heating = { ...heating, radiatorsSeeded: false }
    if (useRad && !heating.radiatorsSeeded && !nodes.some((item) => item.kind === 'heater-rad')) {
      const groups = new Map()
      radiatorSpots(plan, rooms).forEach((item) => {
        const list = groups.get(item.room.id) || []
        list.push(item)
        groups.set(item.room.id, list)
      })
      rooms.filter((room) => room.kindName !== 'sauna' && (room.area || 0) >= 4).forEach((room) => {
        const windows = groups.get(room.id) || [{ x: room.cx, z: room.cz, room }]
        const loss = designHeatLoss(room, loads)
        const shares = splitRadiatorLoad(loss.power, windows.length)
        windows.forEach((window, index) => {
          nodes.push({
            id: nid(),
            system: 'heat',
            kind: 'heater-rad',
            name: `Patteri ${room.name || ''}`.trim(),
            roomId: room.id,
            roomName: room.name,
            roomKind: room.kindName,
            power: shares[index],
            x: round3(window.x),
            z: round3(window.z),
            y: 0.25,
            auto: true,
          })
        })
      })
      heating = { ...heating, radiatorsSeeded: true }
    }
    if (useRad) assignRadiatorPower(nodes, rooms, loads, 'heater-rad')
    if (heating.supplementAir && !nodes.some((item) => item.kind === 'air-air')) {
      const living = rooms.find((room) => room.kindName === 'olohuone') || rooms[0]
      nodes.push({
        id: nid(),
        system: 'heat',
        kind: 'air-air',
        name: AIR_AIR.name,
        x: round3((living?.cx || spot.x) + 0.4),
        z: round3(living?.cz || spot.z),
        y: 1.8,
        auto: true,
      })
    }
    const floorRooms = useFloor ? rooms.filter((room) => room.kindName !== 'sauna' && (room.area || 0) >= 4) : []
    floorRooms.forEach((room) => {
      if (nodes.some((item) => item.kind === 'thermostat' && item.roomId === room.id)) return
      nodes.push({
        id: nid(),
        system: 'heat',
        kind: 'thermostat',
        name: `Termostaatti ${room.name || ''}`.trim(),
        roomId: room.id,
        roomName: room.name,
        x: round3(room.cx),
        z: round3((room.cz || 0) + 0.35),
        y: 1.1,
        auto: true,
      })
    })
    const fresh = []
    const y = 0.35
    const make = (run) => {
      seq += 1
      fresh.push({ id: `svc-${seq}`, system: 'heat', locked: false, showMark: true, ...run })
    }
    if (heating.buffer && anchor && source) {
      make({ kind: 'heat-supply', role: 'main', size: 25, points: ortho({ x: source.x, y, z: source.z }, { x: anchor.x, y, z: anchor.z }), marking: 'PEX 25' })
    }
    const loops = []
    if (manifold) {
      const origin = anchor
      const supplyPts = ortho({ x: origin.x, y, z: origin.z }, { x: manifold.x, y, z: manifold.z })
      make({ kind: 'heat-supply', role: 'supply', size: 25, points: supplyPts, marking: 'Meno PEX 25' })
      make({ kind: 'heat-return', role: 'return', size: 25, points: offsetPolyline(supplyPts, 0.1), marking: 'Paluu PEX 25' })
      let outlet = 0
      floorRooms.forEach((room) => {
        const lockedRoom = services.runs.some((run) => run.system === 'heat' && run.locked && run.roomId === room.id && run.kind === 'floorheat')
        if (lockedRoom) return
        const drawn = floorLoops(room, loopDrawOptions(plan, room, { spacing: heating.loopSpacing || 0.3 }))
        const loss = designHeatLoss(room, loads)
        drawn.forEach((loop) => {
          outlet += 1
          const flow = heatFlowLs(loss.power / Math.max(1, drawn.length), 5)
          loops.push({ roomId: room.id, roomName: room.name, index: outlet, length: loop.length, spacing: loop.spacing, area: Math.round((room.area || 0) * 10) / 10, power: Math.round(loss.power / drawn.length), flow: Math.round(flow * 1000) / 1000, size: pexSize(flow) })
          make({
            kind: 'floorheat',
            role: 'loop',
            roomId: room.id,
            loopIndex: outlet,
            size: 16,
            length: loop.length,
            dashed: true,
            points: loop.points,
            marking: `L${outlet}`,
            showMark: false,
          })
        })
        if (!nodes.some((item) => item.kind === 'actuator' && item.roomId === room.id)) {
          nodes.push({
            id: nid(),
            system: 'heat',
            kind: 'actuator',
            name: `Toimilaite ${room.name || ''}`.trim(),
            roomId: room.id,
            roomName: room.name,
            x: round3(manifold.x + 0.15),
            z: round3(manifold.z + 0.22 * (floorRooms.indexOf(room) + 1)),
            y: 0.5,
            auto: true,
          })
        }
      })
    }
    const radiators = nodes.filter((item) => item.kind === 'heater-rad')
    const radRows = []
    if (useRad && radiators.length) {
      const ordered = [...radiators].sort((a, b) => a.x - b.x || a.z - b.z)
      const totalPower = ordered.reduce((sum, item) => sum + (item.power || 0), 0)
      const flow = heatFlowLs(totalPower, 10)
      const size = pexSize(flow)
      const path = chainPoints([anchor, ...ordered], y)
      const back = chainPoints([ordered[ordered.length - 1], anchor].map((item, index) => ({ x: item.x, z: item.z + (index === 0 ? 0.16 : 0.16) })), y)
      make({ kind: 'heat-supply', role: 'radiator', size, flow: Math.round(flow * 1000) / 1000, points: path, marking: `PEX ${size}` })
      make({ kind: 'heat-return', role: 'radiator', size, points: back, marking: `PEX ${size} paluu` })
      ordered.forEach((item) => {
        const flowEach = heatFlowLs(item.power || 0, 10)
        radRows.push({ id: item.id, name: item.name, roomName: item.roomName, power: item.power, flow: Math.round(flowEach * 1000) / 1000, size: pexSize(flowEach) })
      })
    }
    seq = Math.max(seq, ...fresh.map((run) => Number(String(run.id).replace('svc-', '')) || 0))
    const kept = services.runs.filter((run) => run.system !== 'heat' || run.locked)
    const report = {
      source: sourceSpec(heating.source).name,
      sourceId: heating.source,
      distribution: heating.distribution,
      buffer: heating.buffer ? `${heating.bufferLitres} l` : '',
      borehole: heating.source === 'ground' && heating.borehole !== false,
      supplementAir: Boolean(heating.supplementAir),
      loops,
      radiators: radRows,
      manifolds: nodes.filter((item) => item.kind === 'floor-manifold').map((item) => ({
        id: item.id,
        name: item.name,
        outlets: loops.filter((loop) => !loop.manifoldId || loop.manifoldId === item.id).length,
        rooms: [...new Set(loops.map((loop) => loop.roomName).filter(Boolean))],
      })),
      demand,
      demandPower: demand.reduce((sum, item) => sum + item.watts, 0),
      totalPower: Math.round([...loops.map((item) => item.power), ...radRows.map((item) => item.power)].reduce((sum, value) => sum + value, 0)),
    }
    return annotateHeatElectric(syncLinkedElectric({
      ...plan,
      seq,
      heating,
      services: { ...services, nodes, runs: [...kept, ...fresh], heat: report },
    }, electricLinks(nodes, heating)))
  }
  if (!heating.radiatorsSeeded) {
    rooms.filter((room) => room.kindName !== 'sauna' && (room.area || 0) >= 4).forEach((room) => {
      if (nodes.some((item) => item.system === 'electric' && item.kind === 'radiator' && item.roomId === room.id)) return
      const loss = designHeatLoss(room, loads)
      nodes.push({
        id: nid(),
        system: 'electric',
        kind: 'radiator',
        name: `Sähköpatteri ${room.name || ''}`.trim(),
        roomId: room.id,
        voltage: 230,
        power: Math.max(300, loss.power),
        cosPhi: 1,
        connection: 'fixed',
        circuitMode: 'auto',
        dedicated: true,
        roomKind: room.kindName,
        x: round3(room.cx),
        z: round3(room.cz),
        y: 0.25,
        auto: true,
        heatAuto: true,
      })
    })
    heating = { ...heating, radiatorsSeeded: true }
  }
  assignRadiatorPower(nodes, rooms, loads, 'radiator')
  const kept = services.runs.filter((run) => run.system !== 'heat' || run.locked)
  const electricRads = nodes.filter((item) => item.system === 'electric' && item.kind === 'radiator')
  return annotateHeatElectric(rewireElectric({
    ...plan,
    seq,
    heating,
    services: {
      ...services,
      nodes,
      runs: kept,
      heat: {
        source: sourceSpec(heating.source).name,
        sourceId: heating.source,
        distribution: 'none',
        loops: [],
        radiators: electricRads.map((item) => ({ id: item.id, name: item.name, roomName: item.roomName, power: item.power, flow: 0, size: 0 })),
        manifolds: [],
        demand,
        demandPower: demand.reduce((sum, item) => sum + item.watts, 0),
        totalPower: electricRads.reduce((sum, item) => sum + (item.power || 0), 0),
      },
    },
  }))
}

function wallSpot(room, along = 0.42) {
  const poly = room?.polygon || []
  if (poly.length < 2) return { x: room?.cx || 0, z: room?.cz || 0 }
  let best = { a: poly[0], b: poly[1], len: 0 }
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > best.len) best = { a, b, len }
  }
  const x = best.a.x + (best.b.x - best.a.x) * along
  const z = best.a.z + (best.b.z - best.a.z) * along
  const cx = room.cx ?? x
  const cz = room.cz ?? z
  const mag = Math.hypot(cx - x, cz - z) || 1
  return { x: round3(x + ((cx - x) / mag) * 0.2), z: round3(z + ((cz - z) / mag) * 0.2) }
}

function zoneOutline(room) {
  const poly = room?.polygon || []
  if (poly.length < 3) return []
  const cx = room.cx ?? poly.reduce((sum, point) => sum + point.x, 0) / poly.length
  const cz = room.cz ?? poly.reduce((sum, point) => sum + point.z, 0) / poly.length
  const ring = poly.map((point) => {
    const mag = Math.hypot(cx - point.x, cz - point.z) || 1
    return {
      x: round3(point.x + ((cx - point.x) / mag) * 0.12),
      y: 0.02,
      z: round3(point.z + ((cz - point.z) / mag) * 0.12),
    }
  })
  return [...ring, ring[0]]
}

function annotateHeatElectric(plan) {
  const services = ensureServices(plan)
  const kinds = new Set(['floor-heat', 'ceiling-heat', 'manifold-pump', 'thermostat', 'actuator', 'radiator'])
  const electric = services.nodes
    .filter((node) => node.system === 'electric' && (node.heatAuto || kinds.has(node.kind)) && (node.heatAuto || node.linkedFrom || node.kind === 'radiator' || node.kind === 'floor-heat' || node.kind === 'ceiling-heat' || node.kind === 'manifold-pump'))
    .filter((node) => kinds.has(node.kind))
    .map((node) => ({
      id: node.id,
      name: node.name,
      roomName: node.roomName || '',
      roomId: node.roomId || '',
      kind: node.kind,
      power: node.power || 0,
      voltage: node.voltage || 230,
      circuit: node.circuit || '',
      cable: node.cable || '',
      rcd: Boolean(node.rcd),
      area: node.heatArea || undefined,
      wattsPerM2: node.wattsPerM2 || undefined,
    }))
  return {
    ...plan,
    services: {
      ...services,
      heat: { ...(services.heat || {}), electric },
    },
  }
}

function inheritedMethods(room, heating, houseActive) {
  if (!houseActive) return []
  const direct = heating.source === 'direct-electric' || heating.distribution === 'none'
  const big = room.kindName !== 'sauna' && (room.area || 0) >= 4
  if (!big) return []
  if (direct) return ['erad']
  const methods = []
  if (heating.distribution === 'floor' || heating.distribution === 'both') methods.push('wfloor')
  if (heating.distribution === 'radiator' || heating.distribution === 'both') methods.push('wrad')
  return methods
}

function rewireHeatPerRoom(plan) {
  const services = ensureServices(plan)
  const houseActive = Boolean(plan?.heating)
  let heating = normalizeHeating(plan)
  let seq = plan?.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = (services.nodes || []).map((node) => ({ ...node })).filter((node) => {
    if (node.heatAuto) return false
    if (node.system === 'heat' && node.auto && ['thermostat', 'actuator', 'heater-rad'].includes(node.kind)) return false
    if (node.system === 'electric' && node.auto && node.kind === 'radiator' && !node.powerManual) return false
    return true
  })
  const rooms = visibleRooms(plan).map((room) => ({ ...room, kindName: roomKind(room) }))
  const loads = heatingLoads(plan)
  const demand = heatDemand(loads)
  const chosen = rooms.map((room) => {
    const explicit = normalizeRoomHeating(room)
    if (explicit) {
      return {
        room,
        methods: explicit.methods.filter((item) => item !== 'none'),
        spacing: explicit.spacing,
        pattern: explicit.pattern,
        wattsPerM2: explicit.wattsPerM2,
      }
    }
    return {
      room,
      methods: inheritedMethods(room, heating, houseActive),
      spacing: heating.loopSpacing || 0.3,
      pattern: 'serpentine',
      wattsPerM2: null,
    }
  })
  const wants = (id) => chosen.filter((item) => item.methods.includes(id))
  const water = wants('wfloor').length + wants('wrad').length > 0
  const spot = techSpot(plan)
  const ensure = (kind, name, x, z, extra = {}) => {
    let node = nodes.find((item) => item.kind === kind && item.system === 'heat')
    if (!node) {
      node = { id: nid(), system: 'heat', kind, name, x: round3(x), z: round3(z), y: 0.9, auto: true, ...extra }
      nodes.push(node)
    }
    return node
  }
  let source = null
  let anchor = null
  if (water) {
    const sourceId = heating.source === 'direct-electric' ? 'district' : heating.source
    source = ensure('heat-source', sourceSpec(sourceId).name, spot.x, spot.z, { source: sourceId })
    source.source = source.source && source.source !== 'direct-electric' ? source.source : sourceId
    source.name = sourceSpec(source.source).name
    anchor = source
    if (heating.buffer && houseActive) {
      anchor = ensure('buffer-tank', 'Puskurivaraaja', source.x + 0.8, source.z, { litres: heating.bufferLitres || 300 })
      anchor.litres = anchor.litres || heating.bufferLitres || 300
    }
  }
  let manifolds = nodes.filter((item) => item.system === 'heat' && item.kind === 'floor-manifold')
  if (wants('wfloor').length && !manifolds.length) {
    const node = {
      id: nid(),
      system: 'heat',
      kind: 'floor-manifold',
      name: 'Lattialämmityksen jakotukki',
      x: round3((anchor?.x || spot.x) + 0.9),
      z: round3((anchor?.z || spot.z) + 0.35),
      y: 0.5,
      auto: true,
      suggested: true,
    }
    nodes.push(node)
    manifolds = [node]
  }
  const manifold = manifolds[0] || null
  const fresh = []
  const make = (run) => {
    seq += 1
    fresh.push({ id: `svc-${seq}`, system: 'heat', locked: false, showMark: false, ...run })
  }
  const yPipe = 0.35
  if (heating.buffer && anchor && source && anchor !== source) {
    make({ kind: 'heat-supply', role: 'main', size: 25, points: ortho({ x: source.x, y: yPipe, z: source.z }, { x: anchor.x, y: yPipe, z: anchor.z }), marking: 'PEX 25', showMark: true })
  }
  if (manifold && anchor) {
    const trunk = ortho({ x: anchor.x, y: yPipe, z: anchor.z }, { x: manifold.x, y: yPipe, z: manifold.z })
    make({ kind: 'heat-supply', role: 'supply', size: 25, points: trunk, marking: 'Meno PEX 25', showMark: true })
    make({ kind: 'heat-return', role: 'return', size: 25, points: offsetPolyline(trunk, 0.1), marking: 'Paluu PEX 25', showMark: true })
  }
  const loops = []
  let outlet = 0
  const placeThermostat = (room, sensor) => {
    const existing = nodes.find((node) => node.kind === 'thermostat' && node.roomId === room.id)
    if (existing) {
      if (sensor && !existing.sensor) {
        existing.sensor = true
        const inward = { x: room.cx ?? existing.x, z: room.cz ?? existing.z }
        const mag = Math.hypot(inward.x - existing.x, inward.z - existing.z) || 1
        make({
          kind: 'sensor',
          role: 'sensor',
          roomId: room.id,
          dashed: true,
          size: 0,
          points: [
            { x: existing.x, y: 0.02, z: existing.z },
            {
              x: round3(existing.x + ((inward.x - existing.x) / mag) * 0.55),
              y: 0.02,
              z: round3(existing.z + ((inward.z - existing.z) / mag) * 0.55),
            },
          ],
          marking: 'Anturi',
          showMark: true,
        })
      }
      return
    }
    const spotOnWall = wallSpot(room, 0.38)
    nodes.push({
      id: nid(),
      system: 'heat',
      kind: 'thermostat',
      name: `Termostaatti ${room.name || ''}`.trim(),
      roomId: room.id,
      roomName: room.name,
      roomKind: room.kindName,
      sensor: Boolean(sensor),
      x: spotOnWall.x,
      z: spotOnWall.z,
      y: 1.1,
      auto: true,
    })
    if (sensor) {
      const inward = { x: room.cx ?? spotOnWall.x, z: room.cz ?? spotOnWall.z }
      const mag = Math.hypot(inward.x - spotOnWall.x, inward.z - spotOnWall.z) || 1
      const end = {
        x: round3(spotOnWall.x + ((inward.x - spotOnWall.x) / mag) * 0.55),
        y: 0.02,
        z: round3(spotOnWall.z + ((inward.z - spotOnWall.z) / mag) * 0.55),
      }
      make({
        kind: 'sensor',
        role: 'sensor',
        roomId: room.id,
        dashed: true,
        size: 0,
        points: [{ x: spotOnWall.x, y: 0.02, z: spotOnWall.z }, end],
        marking: 'Anturi',
        showMark: true,
      })
    }
  }
  wants('wfloor').forEach(({ room, spacing, pattern }, index) => {
    const lockedRoom = services.runs.some((run) => run.system === 'heat' && run.locked && run.roomId === room.id && (run.kind === 'floorheat' || run.kind === 'efloor'))
    const obstacles = heatingObstacles(room, plan.fixtures)
    const area = heatedArea(room, obstacles)
    if (!lockedRoom) {
      const outline = zoneOutline(room)
      if (outline.length > 2) {
        make({ kind: 'heat-zone', role: 'zone', roomId: room.id, dashed: true, size: 0, points: outline })
      }
      const drawn = manifold ? floorLoops(room, loopDrawOptions(plan, room, { spacing, pattern, obstacles })) : []
      const loss = designHeatLoss(room, loads)
      drawn.forEach((loop) => {
        outlet += 1
        const power = Math.round(loss.power / Math.max(1, drawn.length))
        const flow = heatFlowLs(power, 5)
        loops.push({
          roomId: room.id,
          roomName: room.name,
          index: loop.index,
          outlet,
          manifoldId: manifold.id,
          length: loop.length,
          spacing: loop.spacing,
          pattern,
          area,
          power,
          flow: Math.round(flow * 1000) / 1000,
          size: pexSize(flow),
        })
        make({
          kind: 'floorheat',
          role: 'loop',
          roomId: room.id,
          loopIndex: loop.index,
          outlet,
          manifoldId: manifold.id,
          size: 16,
          length: loop.length,
          dashed: true,
          points: loop.points,
          marking: `L${outlet}`,
          showMark: false,
        })
        const start = loop.points[0]
        if (start && manifold) {
          const lane = (index % 5) * 0.06
          const supply = ortho({ x: manifold.x + lane, y: 0.02, z: manifold.z }, { x: start.x, y: 0.02, z: start.z })
          make({
            kind: 'heat-supply',
            role: 'feeder',
            roomId: room.id,
            outlet,
            manifoldId: manifold.id,
            size: 16,
            dashed: true,
            points: supply,
          })
          make({
            kind: 'heat-return',
            role: 'feeder',
            roomId: room.id,
            outlet,
            manifoldId: manifold.id,
            size: 16,
            dashed: true,
            points: offsetPolyline(supply, 0.08),
          })
        }
      })
    }
    placeThermostat(room, false)
    if (manifold) {
      nodes.push({
        id: nid(),
        system: 'heat',
        kind: 'actuator',
        name: `Toimilaite ${room.name || ''}`.trim(),
        roomId: room.id,
        roomName: room.name,
        roomKind: room.kindName,
        manifoldId: manifold.id,
        x: round3(manifold.x + 0.18),
        z: round3(manifold.z + 0.22 * (index + 1)),
        y: 0.5,
        auto: true,
      })
    }
  })
  if (manifold) manifold.outlets = outlet
  wants('wrad').forEach(({ room }) => {
    const existing = nodes.filter((item) => item.kind === 'heater-rad' && item.roomId === room.id)
    if (!existing.length) {
      const windows = radiatorSpots(plan, rooms).filter((item) => item.room?.id === room.id)
      const spots = windows.length ? windows : [{ ...wallSpot(room, 0.62), room }]
      const loss = designHeatLoss(room, loads)
      const shares = splitRadiatorLoad(loss.power, spots.length)
      spots.forEach((window, index) => {
        nodes.push({
          id: nid(),
          system: 'heat',
          kind: 'heater-rad',
          name: `Patteri ${room.name || ''}`.trim(),
          roomId: room.id,
          roomName: room.name,
          roomKind: room.kindName,
          power: shares[index],
          x: round3(window.x),
          z: round3(window.z),
          y: 0.25,
          auto: true,
        })
      })
    }
  })
  assignRadiatorPower(nodes, rooms, loads, 'heater-rad')
  const radRows = []
  const waterRooms = new Set(wants('wrad').map((entry) => entry.room.id))
  const waterRads = nodes.filter((node) => node.kind === 'heater-rad' && waterRooms.has(node.roomId))
  if (waterRads.length && anchor) {
    const ordered = [...waterRads].sort((a, b) => a.x - b.x || a.z - b.z)
    const totalPower = ordered.reduce((sum, item) => sum + (item.power || 0), 0)
    const flow = heatFlowLs(totalPower, 10)
    const size = pexSize(flow)
    make({ kind: 'heat-supply', role: 'radiator', size, flow: Math.round(flow * 1000) / 1000, points: chainPoints([anchor, ...ordered], yPipe), marking: `PEX ${size}`, showMark: true })
    make({ kind: 'heat-return', role: 'radiator', size, points: chainPoints(ordered.map((item) => ({ x: item.x, z: item.z + 0.16 })).concat([{ x: anchor.x, z: anchor.z + 0.16 }]), yPipe), marking: `PEX ${size} paluu`, showMark: true })
    ordered.forEach((item) => {
      const flowEach = heatFlowLs(item.power || 0, 10)
      radRows.push({ id: item.id, name: item.name, roomName: item.roomName, power: item.power, flow: Math.round(flowEach * 1000) / 1000, size: pexSize(flowEach) })
    })
  }
  const pushMat = (room, kind, marking) => {
    const obstacles = heatingObstacles(room, plan.fixtures)
    const area = heatedArea(room, obstacles)
    const choice = chosen.find((item) => item.room.id === room.id)
    const outline = zoneOutline(room)
    if (outline.length > 2) make({ kind: 'heat-zone', role: 'zone', roomId: room.id, dashed: true, size: 0, points: outline })
    const drawn = floorLoops(room, loopDrawOptions(plan, room, {
      spacing: choice?.spacing || 0.15,
      pattern: choice?.pattern || 'serpentine',
      obstacles,
    }))
    drawn.forEach((loop) => {
      make({
        kind,
        role: 'loop',
        roomId: room.id,
        size: 0,
        length: loop.length,
        dashed: true,
        points: loop.points,
        marking,
        showMark: true,
      })
    })
    return { area, choice }
  }
  wants('efloor').forEach(({ room, wattsPerM2 }) => {
    const { area } = pushMat(room, 'efloor', 'Sähkökaapeli')
    const density = floorHeatDensity(room.kindName, wattsPerM2)
    const power = Math.max(200, Math.round(area * density))
    placeThermostat(room, true)
    nodes.push({
      id: nid(),
      system: 'electric',
      kind: 'floor-heat',
      name: `Lattialämmitys ${room.name || ''}`.trim(),
      roomId: room.id,
      roomName: room.name,
      roomKind: room.kindName,
      voltage: 230,
      power,
      cosPhi: 1,
      connection: 'fixed',
      circuitMode: 'auto',
      dedicated: true,
      role: 'power',
      rcd: ['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'].includes(room.kindName),
      wet: ['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'].includes(room.kindName),
      heatArea: area,
      wattsPerM2: density,
      x: round3((room.cx || 0) + 0.2),
      z: round3(room.cz || 0),
      y: 1.1,
      auto: true,
      heatAuto: true,
    })
  })
  wants('ceiling').forEach(({ room }) => {
    const { area } = pushMat(room, 'ceiling', 'Kattolämmitys')
    const loss = designHeatLoss(room, loads)
    const power = Math.max(loss.power, Math.round(area * 40))
    placeThermostat(room, false)
    nodes.push({
      id: nid(),
      system: 'electric',
      kind: 'ceiling-heat',
      name: `Kattolämmitys ${room.name || ''}`.trim(),
      roomId: room.id,
      roomName: room.name,
      roomKind: room.kindName,
      voltage: 230,
      power,
      cosPhi: 1,
      connection: 'fixed',
      circuitMode: 'auto',
      dedicated: true,
      role: 'power',
      rcd: ['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'].includes(room.kindName),
      heatArea: area,
      x: round3(room.cx || 0),
      z: round3((room.cz || 0) + 0.25),
      y: 1.1,
      auto: true,
      heatAuto: true,
    })
  })
  wants('erad').forEach(({ room }) => {
    const windows = radiatorSpots(plan, rooms).filter((item) => item.room?.id === room.id)
    const spots = windows.length ? windows : [{ ...wallSpot(room, 0.62) }]
    const loss = designHeatLoss(room, loads)
    const shares = splitRadiatorLoad(loss.power, spots.length)
    spots.forEach((window, index) => {
      nodes.push({
        id: nid(),
        system: 'electric',
        kind: 'radiator',
        name: `Sähköpatteri ${room.name || ''} ${index + 1}`.trim(),
        roomId: room.id,
        roomName: room.name,
        roomKind: room.kindName,
        voltage: 230,
        power: shares[index],
        cosPhi: 1,
        connection: 'fixed',
        circuitMode: 'auto',
        dedicated: true,
        role: 'power',
        x: round3(window.x),
        z: round3(window.z),
        y: 0.25,
        auto: true,
        heatAuto: true,
      })
    })
  })
  if (houseActive && heating.supplementAir && !nodes.some((item) => item.kind === 'air-air')) {
    const living = rooms.find((room) => room.kindName === 'olohuone') || rooms[0]
    nodes.push({
      id: nid(),
      system: 'heat',
      kind: 'air-air',
      name: AIR_AIR.name,
      x: round3((living?.cx || spot.x) + 0.4),
      z: round3(living?.cz || spot.z),
      y: 1.8,
      auto: true,
    })
  }
  const kept = services.runs.filter((run) => run.system !== 'heat' || run.locked)
  const freshFiltered = fresh.filter((run) => {
    if (!run.roomId) return true
    return !services.runs.some((locked) => locked.system === 'heat' && locked.locked && locked.roomId === run.roomId && locked.kind === run.kind)
  })
  const report = {
    source: source ? sourceSpec(source.source || heating.source).name : sourceSpec(heating.source).name,
    sourceId: source?.source || heating.source,
    distribution: heating.distribution,
    buffer: heating.buffer ? `${heating.bufferLitres} l` : '',
    borehole: heating.source === 'ground' && heating.borehole !== false,
    supplementAir: Boolean(heating.supplementAir),
    loops,
    radiators: radRows,
    manifolds: manifolds.map((item) => ({
      id: item.id,
      name: item.name,
      suggested: Boolean(item.suggested || item.auto),
      outlets: loops.filter((loop) => loop.manifoldId === item.id).length,
      rooms: [...new Set(loops.filter((loop) => loop.manifoldId === item.id).map((loop) => loop.roomName))],
    })),
    demand,
    demandPower: demand.reduce((sum, item) => sum + item.watts, 0),
    totalPower: Math.round([...loops.map((item) => item.power), ...radRows.map((item) => item.power), ...nodes.filter((item) => item.heatAuto && (item.kind === 'floor-heat' || item.kind === 'ceiling-heat' || item.kind === 'radiator')).map((item) => item.power || 0)].reduce((sum, value) => sum + value, 0)),
  }
  return annotateHeatElectric(syncLinkedElectric({
    ...plan,
    seq,
    heating: houseActive ? heating : plan.heating,
    services: { ...services, nodes, runs: [...kept, ...freshFiltered], heat: report },
  }, electricLinks(nodes, heating)))
}

export function rewireHeat(plan) {
  if ((visibleRooms(plan) || []).some((room) => normalizeRoomHeating(room))) return rewireHeatPerRoom(plan)
  return rewireHeatClassic(plan)
}

export function suggestFloorManifold(plan) {
  const services = ensureServices(plan)
  const spot = techSpot(plan)
  if (services.nodes.some((node) => node.kind === 'floor-manifold')) return rewireHeat(plan)
  return addServiceNode(plan, {
    system: 'heat',
    kind: 'floor-manifold',
    name: 'Lattialämmityksen jakotukki',
    x: spot.x,
    z: spot.z,
    y: 0.5,
    auto: false,
    suggested: true,
  })
}

export function refreshHeat(plan) {
  if (!plan?.heating && !(plan.rooms || []).some((room) => normalizeRoomHeating(room))) return plan
  return withGroundworks(rewireHeat(plan))
}

export function applyHeating(plan, patch) {
  const heating = normalizeHeating({ heating: { ...(plan?.heating || {}), ...patch } })
  return withGroundworks(rewireWater(rewireHeat({ ...plan, heating })))
}

export function addServiceNode(plan, node) {
  const services = ensureServices(plan)
  const seq = (plan?.seq || 1) + 1
  const kind = node?.kind || 'valve'
  const system = node?.system || 'iv'
  const spec = system === 'electric' ? deviceSpec(kind) : null
  const water = kind === 'water-point' ? waterPointSpec(node?.pointType) : null
  const tank = kind === 'dhw-tank' || kind === 'buffer-tank'
  const created = {
    ...node,
    id: `svc-${seq}`,
    system,
    kind,
    name: node?.name || spec?.name || water?.name || (kind === 'dhw-tank' ? 'Lämminvesivaraaja' : undefined),
    voltage: node?.voltage != null ? node.voltage : spec?.voltage,
    power: node?.power != null ? node.power : spec?.power,
    cosPhi: node?.cosPhi != null ? node.cosPhi : spec?.cosPhi,
    connection: node?.connection || spec?.connection,
    circuitMode: node?.circuitMode || (system === 'electric' ? 'auto' : undefined),
    supply: node?.supply || water?.supply,
    flowCold: node?.flowCold != null ? node.flowCold : water?.flowCold,
    flowHot: node?.flowHot != null ? node.flowHot : water?.flowHot,
    pointType: node?.pointType || water?.id,
    litres: node?.litres || (tank ? (kind === 'buffer-tank' ? (plan?.heating?.bufferLitres || 300) : (plan?.heating?.dhwLitres || 300)) : undefined),
    tankMode: node?.tankMode || (kind === 'dhw-tank' ? (plan?.heating?.dhwMode || 'electric') : undefined),
    source: node?.source || (kind === 'heat-source' ? normalizeHeating(plan).source : undefined),
    x: round3(node?.x),
    z: round3(node?.z),
    y: round3(Number.isFinite(node?.y) ? node.y : serviceHeight(plan, system, kind)),
  }
  const next = { ...plan, seq, services: { ...services, nodes: [...services.nodes, created] } }
  if (system === 'electric') return rewireElectric(next)
  if (system === 'water') return rewireWater(next)
  if (system === 'heat') return rewireHeat(next)
  return next
}

export function addServiceRun(plan, run) {
  const services = ensureServices(plan)
  const seq = (plan?.seq || 1) + 1
  const system = run?.system || 'iv'
  const kind = run?.kind || 'tulo'
  const y = serviceHeight(plan, system, kind)
  const explicit = (run?.points || []).length > 0 && (run.points || []).every((point) => Number.isFinite(point.y))
  let points = (run?.points || []).map((point) => ({ x: round3(point.x), y: round3(point.y ?? y), z: round3(point.z) }))
  if (!explicit && system === 'drain' && kind === 'vent' && points.length) {
    points = [
      { x: points[0].x, y: -0.05, z: points[0].z },
      { x: points[0].x, y: round3((plan?.floorHeight || 2.6) + 0.55), z: points[0].z },
    ]
  } else if (!explicit && system === 'drain' && kind !== 'vent' && points.length >= 2) {
    const slope = (run?.slope || (run?.size >= 110 ? 1 : 2)) / 100
    let cursor = points[0].y
    points = points.map((point, index) => {
      if (index === 0) return point
      cursor -= Math.hypot(point.x - points[index - 1].x, point.z - points[index - 1].z) * slope
      return { ...point, y: round3(cursor) }
    })
  }
  const created = {
    ...run,
    id: `svc-${seq}`,
    system,
    kind,
    size: run?.size,
    slope: run?.slope,
    points,
    locked: run?.locked != null ? Boolean(run.locked) : (system === 'electric' || system === 'water' || system === 'heat'),
  }
  return { ...plan, seq, services: { ...services, runs: [...services.runs, created] } }
}

function refreshElectricLengths(plan) {
  const services = ensureServices(plan)
  const circuits = services.electric?.circuits
  if (!circuits?.length) return plan
  const runs = services.runs.filter((run) => run.system === 'electric')
  const nextCircuits = circuits.map((circuit) => {
    const related = runs.filter((run) => run.circuit === circuit.id || (circuit.deviceIds || []).includes(run.deviceId))
    const total = related.reduce((sum, run) => sum + routeLength(run.points), 0)
    const trunk = related.filter((run) => run.role === 'trunk').reduce((sum, run) => sum + routeLength(run.points), 0)
    let path = total
    if (circuit.topology === 'lighting') {
      const byRoom = new Map()
      related.filter((run) => run.role && run.role !== 'trunk').forEach((run) => {
        const key = run.roomId || 'talo'
        byRoom.set(key, (byRoom.get(key) || 0) + routeLength(run.points))
      })
      path = trunk + Math.max(0, ...byRoom.values(), 0)
    }
    const baseWarning = String(circuit.warning || '').split('. ').filter((part) => part && !part.startsWith('Jännitehäviö')).join('. ')
    const sized = applyVoltageDrop({ ...circuit, warning: baseWarning }, path || total)
    return { ...sized, length: Math.round(total * 10) / 10 }
  })
  const circuitById = new Map(nextCircuits.map((circuit) => [circuit.id, circuit]))
  const nodes = services.nodes.map((node) => {
    const circuit = circuitById.get(node.circuit)
    if (!circuit || node.system !== 'electric') return node
    return { ...node, dropPct: circuit.dropPct, cableLength: circuit.length }
  })
  return {
    ...plan,
    services: { ...services, nodes, electric: { ...services.electric, circuits: nextCircuits } },
  }
}

export function commitRunGeometry(plan, id, points, extra = {}) {
  const services = ensureServices(plan)
  const run = services.runs.find((item) => item.id === id)
  if (!run) return plan
  const fallbackY = serviceHeight(plan, run.system, run.kind)
  const stamped = (points || []).map((point) => ({
    ...point,
    x: round3(point.x),
    y: round3(Number.isFinite(point.y) ? point.y : fallbackY),
    z: round3(point.z),
  }))
  const nextPoints = extra.risers === false ? stamped : insertRisers(stamped)
  const length = Math.round(routeLength(nextPoints) * 10) / 10
  const next = {
    ...plan,
    services: {
      ...services,
      runs: services.runs.map((item) => (item.id === id ? {
        ...item,
        ...extra,
        id: item.id,
        points: nextPoints,
        length,
        locked: extra.locked != null ? Boolean(extra.locked) : true,
        manual: true,
      } : item)),
    },
  }
  return refreshElectricLengths(next)
}

export function followMovedNode(plan, id, previous) {
  if (!previous) return plan
  const services = ensureServices(plan)
  const node = services.nodes.find((item) => item.id === id)
  if (!node) return plan
  const moved = Math.hypot(node.x - previous.x, node.z - previous.z) > 0.01
    || Math.abs((node.y || 0) - (previous.y || 0)) > 0.01
  if (!moved) return plan
  let next = plan
  services.runs.forEach((run) => {
    const linked = run.deviceId === id
    const ends = run.points || []
    const near = ends.length > 0 && (
      Math.hypot(ends[0].x - previous.x, ends[0].z - previous.z) < 0.5
      || Math.hypot(ends[ends.length - 1].x - previous.x, ends[ends.length - 1].z - previous.z) < 0.5
    )
    if (!linked && !near) return
    if (!run.locked && (run.system === 'electric' || run.system === 'water' || run.system === 'heat')) return
    const points = followEndpoint(run.points, previous, { x: node.x, y: node.y, z: node.z }, 0.6)
    if (points === run.points) return
    next = commitRunGeometry(next, run.id, points, { locked: true })
  })
  return next
}

export function updateServiceNode(plan, id, patch) {
  const services = ensureServices(plan)
  const current = services.nodes.find((item) => item.id === id)
  const previous = current ? { x: current.x, y: current.y, z: current.z } : null
  const next = {
    ...plan,
    services: {
      ...services,
      nodes: services.nodes.map((item) => (item.id === id ? {
      ...item,
      ...patch,
      id: item.id,
      ...(patch && Object.prototype.hasOwnProperty.call(patch, 'power') ? { powerManual: true } : {}),
      ...((item.kind === 'junction' || item.kind === 'heater-control') ? { autoBox: false } : {}),
    } : item)),
    },
  }
  let routed = next
  if (current?.system === 'water' || patch?.system === 'water') routed = rewireWater(next)
  else if (current?.system === 'heat' || patch?.system === 'heat') routed = rewireHeat(next)
  else if (current?.system === 'electric' || patch?.system === 'electric') routed = rewireElectric(next)
  return followMovedNode(routed, id, previous)
}

const RUN_GEOMETRY_KEYS = ['points', 'heightMode', 'material', 'insulation', 'label', 'size', 'cable', 'slope', 'segmentHeight', 'segmentLength']
const RUN_SHAPE_KEYS = ['points', 'heightMode', 'segmentHeight', 'slope', 'segmentLength']

export function updateServiceRun(plan, id, patch) {
  const services = ensureServices(plan)
  const current = services.runs.find((item) => item.id === id)
  if (!current) return plan
  const touches = patch && RUN_GEOMETRY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key))
  const reshapes = patch && RUN_SHAPE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(patch, key))
  let points = current.points
  if (patch?.points) points = patch.points
  if (patch?.heightMode && !patch.points) {
    const y = heightMetres(plan, patch.heightMode, current.system)
    if (y != null) points = setRunMount(current.points, y, patch.heightMode)
  }
  if (patch?.segmentHeight) {
    const spec = patch.segmentHeight
    const y = Number.isFinite(spec.y) ? spec.y : heightMetres(plan, spec.mode, current.system)
    if (y != null) points = setSegmentMount(points, spec.index || 0, y, spec.mode)
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'slope') && current.system === 'drain') {
    points = applySlope(points, patch.slope)
  }
  if (patch?.segmentLength) points = setSegmentLength(points, patch.segmentLength.index, patch.segmentLength.metres)
  const shaped = reshapes ? insertRisers(points) : current.points
  const length = Math.round(routeLength(shaped) * 10) / 10
  let electric = services.electric
  if (patch?.cable && current.circuit && electric?.circuits) {
    electric = {
      ...electric,
      circuits: electric.circuits.map((circuit) => (
        circuit.id === current.circuit ? { ...circuit, cable: patch.cable } : circuit
      )),
    }
  }
  const { segmentHeight, segmentLength, points: _points, ...rest } = patch || {}
  const next = {
    ...plan,
    services: {
      ...services,
      electric,
      runs: services.runs.map((item) => (item.id === id ? {
        ...item,
        ...rest,
        id: item.id,
        points: shaped,
        length,
        locked: patch && Object.prototype.hasOwnProperty.call(patch, 'locked') ? Boolean(patch.locked) : (touches ? true : item.locked),
        manual: touches ? true : item.manual,
      } : item)),
    },
  }
  if (patch?.points || patch?.heightMode || patch?.segmentHeight || patch?.slope || patch?.segmentLength) return refreshElectricLengths(next)
  return next
}

export function dragServiceRun(plan, drag, world, options = {}) {
  if (!drag?.basePoints || !world) return plan
  let points = drag.basePoints
  if (drag.mode === 'vertex') {
    const base = drag.basePoints[drag.index] || { x: 0, y: 0, z: 0 }
    let x = base.x + (world.x - drag.origin.x)
    let z = base.z + (world.z - drag.origin.z)
    if (options.grid && !options.free) {
      const grid = options.grid
      x = Math.round(x / grid) * grid
      z = Math.round(z / grid) * grid
    }
    points = moveVertexPoints(drag.basePoints, drag.index, { x, y: Number.isFinite(world.y) ? world.y : base.y, z }, { ortho: Boolean(options.ortho) })
  }
  else if (drag.mode === 'segment') {
    let dx = world.x - drag.origin.x
    let dz = world.z - drag.origin.z
    if (options.ortho) {
      if (Math.abs(dx) >= Math.abs(dz)) dz = 0
      else dx = 0
    }
    points = moveSegmentPoints(drag.basePoints, drag.index ?? 0, dx, dz)
  } else {
    points = translatePoints(drag.basePoints, world.x - drag.origin.x, world.z - drag.origin.z)
  }
  return commitRunGeometry(plan, drag.id, points, { locked: true })
}

export function splitServiceRun(plan, id, segmentIndex = 0, t = 0.5) {
  const services = ensureServices(plan)
  const run = services.runs.find((item) => item.id === id)
  if (!run) return plan
  const index = Number.isFinite(segmentIndex) ? segmentIndex : Math.max(0, (run.points || []).length - 2)
  const parts = splitPoints(run.points, index, t)
  if (!parts) return plan
  const seq = (plan?.seq || 1) + 1
  const node = services.nodes.find((item) => item.id === run.deviceId)
  const owns = (points) => {
    if (!node) return false
    const end = points[points.length - 1]
    const start = points[0]
    return Math.hypot(end.x - node.x, end.z - node.z) < 0.5 || Math.hypot(start.x - node.x, start.z - node.z) < 0.5
  }
  const left = { ...run, points: parts.left, locked: true, manual: true, length: Math.round(routeLength(parts.left) * 10) / 10, deviceId: owns(parts.left) ? run.deviceId : undefined }
  const right = {
    ...run,
    id: `svc-${seq}`,
    points: parts.right,
    locked: true,
    manual: true,
    showMark: false,
    length: Math.round(routeLength(parts.right) * 10) / 10,
    deviceId: owns(parts.right) ? run.deviceId : undefined,
  }
  return refreshElectricLengths({
    ...plan,
    seq,
    services: { ...services, runs: services.runs.flatMap((item) => (item.id === id ? [left, right] : [item])) },
  })
}

export function joinServiceRuns(plan, id, otherId) {
  const services = ensureServices(plan)
  const run = services.runs.find((item) => item.id === id)
  if (!run) return plan
  const candidates = services.runs.filter((item) => item.system === run.system && item.id !== id && (!otherId || item.id === otherId))
  let best = null
  candidates.forEach((other) => {
    const joined = joinPoints(run.points, other.points, 0.6)
    if (!joined) return
    const d = routeLength(joined)
    if (!best || d < best.d) best = { other, joined, d }
  })
  if (!best) return plan
  const length = Math.round(routeLength(best.joined) * 10) / 10
  return refreshElectricLengths({
    ...plan,
    services: {
      ...services,
      runs: services.runs
        .filter((item) => item.id !== best.other.id)
        .map((item) => (item.id === id ? { ...item, points: best.joined, locked: true, manual: true, length, deviceId: item.deviceId || best.other.deviceId } : item)),
    },
  })
}

export function rerouteRun(plan, id) {
  const services = ensureServices(plan)
  const run = services.runs.find((item) => item.id === id)
  if (!run) return plan
  const unlocked = {
    ...plan,
    services: {
      ...services,
      runs: services.runs.map((item) => (item.id === id ? { ...item, locked: false, manual: false } : item)),
    },
  }
  return autoRoute(unlocked, run.system)
}

export function rerouteSystem(plan, system) {
  const services = ensureServices(plan)
  const unlocked = {
    ...plan,
    services: {
      ...services,
      runs: services.runs.map((item) => (item.system === system ? { ...item, locked: false, manual: false } : item)),
    },
  }
  return autoRoute(unlocked, system)
}

export function deleteServiceNode(plan, id) {
  const services = ensureServices(plan)
  const current = services.nodes.find((item) => item.id === id)
  const drop = new Set([id, ...services.nodes.filter((item) => item.linkedFrom === id).map((item) => item.id)])
  const next = {
    ...plan,
    services: {
      ...services,
      nodes: services.nodes.filter((item) => !drop.has(item.id)),
      runs: services.runs.filter((run) => !drop.has(run.deviceId)),
    },
  }
  if (current?.system === 'water') return rewireWater(next)
  if (current?.system === 'heat') return rewireHeat(next)
  return current?.system === 'electric' || drop.size > 1 ? rewireElectric(next) : next
}

export function deleteServiceRun(plan, id) {
  const services = ensureServices(plan)
  return { ...plan, services: { ...services, runs: services.runs.filter((item) => item.id !== id) } }
}

export function snapServicePoint(point, plan, options = {}) {
  const grid = options.grid ?? 0.1
  let x = Math.round((point?.x || 0) / grid) * grid
  let z = Math.round((point?.z || 0) / grid) * grid
  const nodes = options.nodes || ensureServices(plan).nodes
  let best = null
  nodes.forEach((node) => {
    if (options.system && node.system && node.system !== options.system && options.system !== node.system) return
    const dist = Math.hypot((node.x || 0) - (point?.x || 0), (node.z || 0) - (point?.z || 0))
    if (dist <= (options.nodeSnap ?? 0.3) && (!best || dist < best.dist)) best = { dist, x: node.x, z: node.z }
  })
  if (best) return { x: round3(best.x), z: round3(best.z) }
  if (options.mode === 'wall') {
    const hit = nearestWall(plan?.walls || [], { x, z }, 0.45)
    if (hit) return { x: round3(hit.x), z: round3(hit.z), wallId: hit.wall.id }
  }
  return { x: round3(x), z: round3(z) }
}

function polylineDistance(point, points) {
  let best = Infinity
  for (let i = 1; i < (points || []).length; i += 1) {
    const hit = nearestWall([{ a: points[i - 1], b: points[i] }], point, 8)
    if (hit) best = Math.min(best, hit.dist)
  }
  return best
}

export function hitService(plan, point) {
  const services = ensureServices(plan)
  const nodes = services.nodes.filter((item) => layerVisible(plan, item.system))
  let bestNode = null
  nodes.forEach((node) => {
    const dist = Math.hypot((node.x || 0) - (point?.x || 0), (node.z || 0) - (point?.z || 0))
    if (dist <= 0.35 && (!bestNode || dist < bestNode.dist)) bestNode = { dist, node }
  })
  if (bestNode) return { target: 'node', id: bestNode.node.id, system: bestNode.node.system }
  const runs = services.runs.filter((item) => layerVisible(plan, item.system))
  let bestRun = null
  runs.forEach((run) => {
    const dist = polylineDistance(point, run.points)
    if (dist <= 0.25 && (!bestRun || dist < bestRun.dist)) bestRun = { dist, run }
  })
  if (bestRun) {
    const detail = hitRouteDetail(bestRun.run.points, point, 0.18, 0.25)
    return {
      target: 'run',
      id: bestRun.run.id,
      system: bestRun.run.system,
      segmentIndex: detail?.segmentIndex ?? detail?.vertexIndex ?? 0,
      vertexIndex: detail?.vertexIndex ?? null,
    }
  }
  return null
}

export function serviceMenuSpec(kindOrTarget) {
  const target = typeof kindOrTarget === 'string' ? { kind: kindOrTarget } : (kindOrTarget || {})
  const kind = target.kind
  const system = target.system
  if (kind === 'run' || target.points) {
    const edit = ['height', 'material', 'insulation', 'label', 'lock', 'reroute', 'split']
    if (system === 'drain' || kind === 'branch' || kind === 'main' || kind === 'vent') return ['size', 'slope', ...edit, 'delete']
    if (system === 'electric' || kind === 'wire') return ['circuit', ...edit, 'delete']
    if (system === 'water' || kind === 'cold' || kind === 'hot' || kind === 'circ' || kind === 'floorheat') return ['kind', 'size', ...edit, 'delete']
    return ['kind', 'size', ...edit, 'delete']
  }
  if (kind === 'valve') return ['flow', 'role', 'size', 'delete']
  if (kind === 'hood') return ['flow', 'delete']
  if (kind === 'silencer') return ['size', 'delete']
  if (kind === 'ahu' || kind === 'panel' || kind === 'manifold' || kind === 'shutoff' || kind === 'inlet') return ['name', 'delete']
  if (['socket', 'switch', 'light', 'stove', 'oven', 'heater', 'radiator', 'ev', 'heatpump', 'iv-unit', 'boiler', 'washer', 'dishwasher'].includes(kind) || (system === 'electric' && !['panel', 'junction', 'data', 'antenna'].includes(kind) && !target.points)) {
    return ['voltage', 'power', 'cos', 'connection', 'circuit', 'delete']
  }
  if (system === 'electric' || ['junction', 'data', 'antenna'].includes(kind)) return ['circuit', 'delete']
  if (kind === 'water-point') return ['supply', 'flow', 'circulation', 'delete']
  if (kind === 'dhw-tank' || kind === 'buffer-tank') return ['volume', 'mode', 'delete']
  if (kind === 'heat-source') return ['source', 'delete']
  if (kind === 'heater-rad') return ['power', 'delete']
  if (kind === 'thermostat' || kind === 'actuator' || kind === 'kv-manifold' || kind === 'lv-manifold' || kind === 'floor-manifold' || kind === 'dhw-exchanger' || kind === 'air-air') return ['name', 'delete']
  if (kind === 'wire') return ['circuit', 'lock', 'delete']
  if (kind === 'floor-drain' || kind === 'drain-point' || kind === 'cleanout') return ['size', 'delete']
  return ['name', 'size', 'delete']
}

export function runColor(run) {
  if (!run) return SERVICE_COLORS.electric
  if (run.system === 'iv') return SERVICE_COLORS[run.kind] || SERVICE_COLORS.tulo
  if (run.system === 'water') return SERVICE_COLORS[run.kind] || SERVICE_COLORS.cold
  if (run.system === 'drain') return run.kind === 'vent' ? SERVICE_COLORS.vent : SERVICE_COLORS.drain
  if (run.system === 'heat') {
    if (run.kind === 'collector') return '#0f766e'
    if (run.kind === 'floorheat') return SERVICE_COLORS.floorheat
    if (run.kind === 'heat-return' || run.role === 'return') return SERVICE_COLORS['heat-return']
    return SERVICE_COLORS['heat-supply']
  }
  return SERVICE_COLORS.electric
}

export function nodeColor(node) {
  if (!node) return '#1c1917'
  if (node.system === 'iv') {
    if (node.kind === 'hood' || node.role === 'poisto') return SERVICE_COLORS.poisto
    if (node.role === 'tulo' || node.kind === 'valve') return SERVICE_COLORS.tulo
    return '#334155'
  }
  if (node.system === 'water') {
    if (node.supply === 'both' || node.kind === 'dhw-tank' || node.kind === 'lv-manifold') return SERVICE_COLORS.hot
    return SERVICE_COLORS.cold
  }
  if (node.system === 'heat') return node.kind === 'floor-manifold' ? SERVICE_COLORS.floorheat : SERVICE_COLORS['heat-supply']
  if (node.system === 'drain') return SERVICE_COLORS.drain
  return SERVICE_COLORS.electric
}

function nodeLabel(node) {
  if (node.kind === 'water-point') return node.name || 'Vesipiste'
  if (node.kind === 'valve' && node.role === 'tulo') return 'Tuloventtiili'
  if (node.kind === 'valve') return 'Poistoventtiili'
  const names = {
    ahu: 'IV-kone',
    hood: 'Liesikupu',
    silencer: 'Äänenvaimennin',
    inlet: 'Vesiliittymä',
    shutoff: 'Pääsulku',
    manifold: 'Jakotukki',
    fixture: 'Vesipiste',
    'outdoor-tap': 'Puutarhahana',
    'floor-drain': 'Lattiakaivo',
    'drain-point': 'Kalusteliitäntä',
    cleanout: 'Puhdistusluukku',
    panel: 'Sähkökeskus',
    socket: 'Pistorasia',
    switch: 'Kytkin',
    light: 'Valaisin',
    junction: 'Jakorasia',
    data: 'Datapiste',
    antenna: 'Antennipiste',
    stove: 'Liesi',
    oven: 'Uuni',
    heater: 'Kiuas',
    radiator: 'Sähköpatteri',
    ev: 'Sähköauton lataus',
    heatpump: 'Lämpöpumppu',
    'iv-unit': 'IV-kone',
    boiler: 'Varaaja',
    washer: 'Pesukone',
    dishwasher: 'Astianpesukone',
    'water-point': 'Vesipiste',
    'dhw-tank': 'Lämminvesivaraaja',
    'dhw-exchanger': 'Käyttöveden siirrin',
    'kv-manifold': 'KV-jakotukki',
    'lv-manifold': 'LV-jakotukki',
    'heat-source': 'Lämmönlähde',
    'buffer-tank': 'Puskurivaraaja',
    'floor-manifold': 'Lattialämmityksen jakotukki',
    'heater-rad': 'Patteri',
    thermostat: 'Termostaatti',
    actuator: 'Toimilaite',
    'air-air': 'Ilmalämpöpumppu',
  }
  return names[node.kind] || node.name || 'Osa'
}

const IV_RUN = { tulo: 'Tulo', poisto: 'Poisto', ulko: 'Ulko', jate: 'Jäte' }
const WATER_RUN = { cold: 'Kylmävesi', hot: 'Lämminvesi', circ: 'Kierto', floorheat: 'Lattialämmitys' }
const DRAIN_RUN = { branch: 'Viemärihaara', main: 'Kokoojaviemäri', vent: 'Tuuletusviemäri' }

export function serviceObjectTitle(target) {
  if (!target) return 'Talotekniikka'
  if (Array.isArray(target.points)) {
    if (target.system === 'iv') {
      const role = IV_RUN[target.kind] || ''
      return `IV-kanava Ø${target.size || 100}${role ? ` ${role}` : ''}`
    }
    if (target.system === 'water') return `${WATER_RUN[target.kind] || 'Putki'} PEX ${target.size || 16}`
    if (target.system === 'drain') return `${DRAIN_RUN[target.kind] || 'Viemäri'} DN${target.size || 110}`
    if (target.system === 'heat') return target.kind === 'floorheat' ? `Lattialämmityspiiri ${target.length || ''} m` : `Lämmitysputki PEX ${target.size || 25}`
    return 'Sähköjohto'
  }
  const generic = target.name === 'Tulo' || target.name === 'Poisto' || !target.name
  return generic ? nodeLabel(target) : target.name
}

export function partsList(plan, system) {
  const services = ensureServices(plan)
  const nodes = services.nodes.filter((item) => !system || item.system === system)
  const runs = services.runs.filter((item) => !system || item.system === system)
  const rows = []
  const grouped = new Map()
  nodes.forEach((node) => {
    const name = nodeLabel(node)
    grouped.set(name, (grouped.get(name) || 0) + 1)
  })
  grouped.forEach((qty, name) => rows.push({ name, qty, unit: 'kpl' }))
  const lengths = new Map()
  runs.forEach((run) => {
    const size = run.size || (run.system === 'electric' ? 0 : 0)
    const key = `${run.system}:${size}`
    lengths.set(key, { system: run.system, size, metres: (lengths.get(key)?.metres || 0) + runLength(run) })
  })
  lengths.forEach((entry) => {
    const metres = Math.round(entry.metres * 10) / 10
    if (metres <= 0) return
    let name = 'Johto'
    if (entry.system === 'iv') name = `Kanava Ø${entry.size}`
    else if (entry.system === 'water') name = `PEX ${entry.size}`
    else if (entry.system === 'drain') name = `Viemäri DN${entry.size}`
    else if (entry.system === 'heat') name = `Lämmitysputki PEX ${entry.size || 16}`
    rows.push({ name, size: entry.size || undefined, qty: metres, unit: 'm' })
  })
  const fittings = collectFittings(runs)
  if (fittings.bends.length) rows.push({ name: system === 'electric' ? 'Kulmanmuutos' : 'Käyrä', qty: fittings.bends.length, unit: 'kpl' })
  if (fittings.tees.length) rows.push({ name: system === 'electric' ? 'Haaroitus' : 'T-haara', qty: fittings.tees.length, unit: 'kpl' })
  return rows
}

export function circuitList(plan) {
  const services = ensureServices(plan)
  const live = services.electric?.circuits
  if (live?.length) {
    return live.map((circuit) => ({
      id: circuit.id,
      name: circuit.description || '',
      count: (circuit.deviceIds || circuit.devices || []).length,
      devices: circuit.devices || [],
      rooms: circuit.rooms || [],
      length: circuit.length || 0,
      topology: circuit.topology || '',
    }))
  }
  const nodes = services.nodes.filter((item) => item.system === 'electric' && item.kind !== 'junction' && item.kind !== 'panel' && item.kind !== 'heater-control')
  const ids = [...new Set(nodes.map((item) => item.circuit).filter(Boolean))]
  return ids.map((id) => {
    const devices = nodes.filter((item) => item.circuit === id)
    return { id, name: '', count: devices.length, devices: devices.map((item) => item.name || item.kind), rooms: [], length: 0, topology: '' }
  })
}

export function assignDeviceCircuit(plan, deviceId, circuitId) {
  const services = ensureServices(plan)
  const circuit = Number(circuitId)
  const nodes = services.nodes.map((node) => {
    if (node.kind === 'panel' || node.kind === 'junction' || node.autoBox) return node
    if (node.id === deviceId || (node.system === 'electric' && node.circuit === circuit && node.kind !== 'heater-control')) {
      return { ...node, circuitMode: 'manual', circuit }
    }
    return node
  })
  return rewireElectric({ ...plan, services: { ...services, nodes } })
}

export function serviceLegend(system) {
  if (system === 'iv') {
    return [
      { name: 'Tuloilma', color: SERVICE_COLORS.tulo },
      { name: 'Poistoilma', color: SERVICE_COLORS.poisto },
      { name: 'Ulkoilma', color: SERVICE_COLORS.ulko },
      { name: 'Jäteilma', color: SERVICE_COLORS.jate },
    ]
  }
  if (system === 'water') {
    return [
      { name: 'Kylmä vesi', color: SERVICE_COLORS.cold },
      { name: 'Lämmin vesi', color: SERVICE_COLORS.hot },
      { name: 'Kierto', color: SERVICE_COLORS.circ },
      { name: 'Lattialämmitys', color: SERVICE_COLORS.floorheat },
    ]
  }
  if (system === 'drain') {
    return [
      { name: 'Viemäri', color: SERVICE_COLORS.drain },
      { name: 'Tuuletusviemäri', color: SERVICE_COLORS.vent },
    ]
  }
  if (system === 'heat') {
    return [
      { name: 'Menovesi', color: SERVICE_COLORS['heat-supply'] },
      { name: 'Paluuvesi', color: SERVICE_COLORS['heat-return'] },
      { name: 'Lattialämmitys', color: SERVICE_COLORS.floorheat },
    ]
  }
  return [{ name: 'Sähköjohto', color: SERVICE_COLORS.electric }]
}

export function pipeRadius(run) {
  const size = Number(run?.size) || (run?.system === 'water' ? 16 : run?.system === 'electric' ? 8 : 100)
  if (run?.system === 'water') return Math.max(0.012, size / 2000)
  if (run?.system === 'electric') return 0.008
  if (run?.system === 'drain') return Math.max(0.02, size / 2000)
  return Math.max(0.025, size / 2000)
}

function hexRgb(hex) {
  const value = String(hex || '#000000').replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ]
}

export function serviceSheet(plan, system) {
  const meta = SERVICE_SYSTEMS.find((item) => item.id === system) || SERVICE_SYSTEMS[0]
  const balance = system === 'iv' ? airflowBalance(ensureServices(plan).nodes) : null
  return {
    title: asciiFold(meta.title),
    legend: serviceLegend(system).map((item) => asciiFold(item.name)),
    parts: partsList(plan, system).map((row) => asciiFold(`${row.name} ${row.qty} ${row.unit}`)),
    circuits: system === 'electric' ? circuitList(plan).map((item) => asciiFold(`${item.id} ${item.name} ${item.count}`)) : [],
    balance: balance ? asciiFold(`Tulo ${balance.supply} l/s Poisto ${balance.extract} l/s`) : '',
  }
}

export function buildServicePdf(plan, system) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: plan?.paper === 'a4' ? 'a4' : 'a3' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const meta = SERVICE_SYSTEMS.find((item) => item.id === system) || SERVICE_SYSTEMS[0]
  const box = planBounds(plan)
  const sheet = serviceSheet(plan, system)
  doc.setDrawColor(28)
  doc.setLineWidth(0.3)
  doc.rect(8, 8, pageW - 16, pageH - 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(sheet.title, 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(asciiFold(plan?.name || 'Pohjakuva'), 14, 24)
  if (sheet.balance) doc.text(sheet.balance, 14, 30)
  const draw = { x: 14, y: 36, w: pageW - 118, h: pageH - 78 }
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const scale = Math.min(draw.w / (worldW + 1.6), draw.h / (worldH + 1.6))
  const X = (x) => draw.x + ((x - box.minX) + 0.8) * scale
  const Y = (z) => draw.y + ((z - box.minZ) + 0.8) * scale
  doc.setDrawColor(120)
  doc.setLineWidth(0.35)
  ;(plan?.walls || []).forEach((wall) => {
    doc.line(X(wall.a.x), Y(wall.a.z), X(wall.b.x), Y(wall.b.z))
  })
  ensureServices(plan).runs.filter((run) => run.system === system).forEach((run) => {
    const [red, green, blue] = hexRgb(runColor(run))
    doc.setDrawColor(red, green, blue)
    const heatFloor = run.system === 'heat' && (run.dashed || run.kind === 'floorheat' || run.kind === 'efloor' || run.kind === 'ceiling' || run.role === 'feeder' || run.role === 'loop')
    doc.setLineWidth(run.system === 'electric' || heatFloor ? 0.35 : 0.8)
    if (heatFloor && doc.setLineDashPattern) doc.setLineDashPattern([1.4, 0.9], 0)
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      doc.line(X(points[i - 1].x), Y(points[i - 1].z), X(points[i].x), Y(points[i].z))
    }
    if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)
  })
  doc.setFontSize(7)
  ensureServices(plan).nodes.filter((node) => node.system === system && (node.flow || node.kind === 'ahu' || node.kind === 'panel')).forEach((node) => {
    doc.setTextColor(40)
    const label = node.flow ? `${node.flow} l/s` : asciiFold(node.name || '')
    doc.text(asciiFold(label), X(node.x) + 1.5, Y(node.z) - 1.2)
  })
  let legendY = pageH - 24
  serviceLegend(system).forEach((item, index) => {
    const [red, green, blue] = hexRgb(item.color)
    doc.setFillColor(red, green, blue)
    doc.rect(14 + index * 48, legendY, 6, 3, 'F')
    doc.setTextColor(20)
    doc.setFontSize(8)
    doc.text(asciiFold(item.name), 21 + index * 48, legendY + 2.6)
  })
  let textY = 40
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text('Materiaaliluettelo', pageW - 98, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  sheet.parts.forEach((line) => {
    doc.text(line, pageW - 98, textY)
    textY += 4.4
  })
  if (sheet.circuits.length) {
    textY += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Virtapiirit', pageW - 98, textY)
    textY += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    sheet.circuits.forEach((line) => {
      doc.text(line, pageW - 98, textY)
      textY += 4.4
    })
  }
  return doc
}

export function electricSummary(plan) {
  const services = ensureServices(plan)
  if (services.electric?.circuits) return services.electric
  const loads = (services.nodes || []).filter((node) => node.system === 'electric' && node.kind !== 'panel' && node.kind !== 'junction')
  if (!loads.length) {
    return { circuits: [], phaseLoads: { L1: 0, L2: 0, L3: 0 }, totalPower: 0, mainFuse: '', mainAmps: 0 }
  }
  return planCircuits(loads)
}

function pdfText(value) {
  return asciiFold(value)
}

export function buildElectricPdf(plan) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const report = electricSummary(plan)
  const services = ensureServices(plan)
  const box = planBounds(plan)
  const draw = { x: 14, y: 28, w: pageW - 28, h: pageH - 48 }
  const worldW = Math.max(1, box.maxX - box.minX)
  const worldH = Math.max(1, box.maxZ - box.minZ)
  const scale = Math.min(draw.w / (worldW + 1.6), draw.h / (worldH + 1.6))
  const X = (x) => draw.x + ((x - box.minX) + 0.8) * scale
  const Y = (z) => draw.y + ((z - box.minZ) + 0.8) * scale
  doc.setDrawColor(28)
  doc.setLineWidth(0.3)
  doc.rect(8, 8, pageW - 16, pageH - 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Sahko', 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(pdfText(plan?.name || 'Pohjakuva'), 70, 18)
  doc.setDrawColor(120)
  doc.setLineWidth(0.35)
  ;(plan?.walls || []).forEach((wall) => {
    doc.line(X(wall.a.x), Y(wall.a.z), X(wall.b.x), Y(wall.b.z))
  })
  doc.setDrawColor(28)
  doc.setLineWidth(0.4)
  services.runs.filter((run) => run.system === 'electric').forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      doc.line(X(points[i - 1].x), Y(points[i - 1].z), X(points[i].x), Y(points[i].z))
    }
    const label = run.showMark ? (run.marking || '') : ''
    if (!label || points.length < 2) return
    let best = 0
    let mid = points[0]
    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
      if (len >= best) {
        best = len
        mid = { x: (points[i].x + points[i - 1].x) / 2, z: (points[i].z + points[i - 1].z) / 2 }
      }
    }
    doc.setFontSize(7)
    doc.text(pdfText(label), X(mid.x), Y(mid.z) - 1.4)
  })
  doc.setFontSize(8)
  services.nodes.filter((node) => node.system === 'electric').forEach((node) => {
    doc.setFillColor(255)
    doc.circle(X(node.x), Y(node.z), 1.3, 'FD')
    if (node.circuit && node.kind !== 'junction' && node.kind !== 'panel') {
      doc.text(`R${node.circuit}`, X(node.x) + 1.8, Y(node.z) - 1.2)
    } else if (node.kind === 'panel') {
      doc.text('SK', X(node.x) + 1.8, Y(node.z) - 1.2)
    }
  })

  const columns = [
    ['Ryhma', 12],
    ['Kuvaus', 38],
    ['Laitteet', 52],
    ['V', 14],
    ['Vaihe', 16],
    ['Teho', 18],
    ['Virta', 16],
    ['Sulake', 16],
    ['RCD', 16],
    ['Kaapeli', 32],
    ['Pituus', 16],
  ]
  const writeSchedule = (rows) => {
    doc.addPage('a3', 'landscape')
    doc.setDrawColor(28)
    doc.rect(8, 8, pageW - 16, pageH - 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(pdfText('Ryhmäluettelo'), 14, 18)
    doc.setFontSize(10)
    const loads = report.phaseLoads || {}
    doc.setFont('helvetica', 'normal')
    doc.text(pdfText(`Kokonaisteho ${Math.round(report.totalPower || 0)} W   Paasulake ${report.mainFuse || '-'}   L1 ${loads.L1 || 0} A   L2 ${loads.L2 || 0} A   L3 ${loads.L3 || 0} A`), 14, 26)
    let x = 14
    let y = 34
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    columns.forEach(([title, width]) => {
      doc.text(pdfText(title), x, y)
      x += width
    })
    y += 3
    doc.setLineWidth(0.2)
    doc.line(14, y, pageW - 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    rows.forEach((circuit) => {
      if (y > pageH - 16) {
        doc.addPage('a3', 'landscape')
        y = 18
      }
      const cells = [
        `R${circuit.id}`,
        circuit.description || '',
        (circuit.devices || []).join(', '),
        circuit.voltage ? String(circuit.voltage) : '',
        circuit.phase || '',
        circuit.power ? `${circuit.power} W` : '',
        circuit.current ? `${circuit.current} A` : '',
        circuit.fuse ? `${circuit.fuse} A` : '',
        circuit.rcd || '',
        circuit.cable || '',
        circuit.length ? `${circuit.length} m` : '',
      ]
      x = 14
      cells.forEach((cell, index) => {
        const width = columns[index][1] - 2
        doc.text(pdfText(cell).slice(0, Math.max(8, Math.floor(width / 1.7))), x, y)
        x += columns[index][1]
      })
      y += 5.2
      if (circuit.warning) {
        doc.setTextColor(160, 30, 30)
        doc.text(pdfText(circuit.warning).slice(0, 140), 20, y)
        doc.setTextColor(20)
        y += 4.6
      }
    })
  }
  writeSchedule(report.circuits || [])

  doc.addPage('a3', 'landscape')
  doc.setDrawColor(28)
  doc.rect(8, 8, pageW - 16, pageH - 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20)
  doc.text(pdfText('Pääkaavio'), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(pdfText(`Sahkokeskus   ${report.mainFuse || ''}`), 14, 26)
  const circuits = report.circuits || []
  const busY = 58
  const left = 28
  const right = pageW - 28
  doc.setLineWidth(0.6)
  doc.line(pageW / 2, 32, pageW / 2, busY - 12)
  doc.rect(pageW / 2 - 16, busY - 12, 32, 8)
  doc.setFontSize(8)
  doc.text(pdfText(report.mainFuse || '-'), pageW / 2 - 12, busY - 6.6)
  doc.line(pageW / 2, busY - 4, pageW / 2, busY)
  doc.setLineWidth(0.9)
  doc.line(left, busY, right, busY)
  const count = Math.max(circuits.length, 1)
  circuits.forEach((circuit, index) => {
    const x = count === 1 ? pageW / 2 : left + (index * (right - left)) / (count - 1)
    doc.setLineWidth(0.35)
    doc.line(x, busY, x, busY + 16)
    doc.rect(x - 8, busY + 16, 16, 8)
    doc.setFontSize(7)
    doc.text(circuit.fuse ? `${circuit.fuse}A` : '-', x - 6, busY + 21.4)
    let cursor = busY + 24
    if (circuit.rcd) {
      doc.circle(x, cursor + 5, 4)
      doc.text('30', x - 2.4, cursor + 6)
      cursor += 12
    }
    doc.line(x, cursor, x, cursor + 8)
    cursor += 14
    doc.setFont('helvetica', 'bold')
    doc.text(`R${circuit.id}`, x - 4, cursor)
    doc.setFont('helvetica', 'normal')
    const desc = pdfText(circuit.description || '').slice(0, 18)
    doc.text(desc, x - 12, cursor + 5)
    doc.text(pdfText(circuit.cable || '').slice(0, 18), x - 14, cursor + 10)
  })
  return doc
}

function drawServicePlan(doc, plan, system, title) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const box = planBounds(plan)
  doc.setDrawColor(28)
  doc.rect(8, 8, pageW - 16, pageH - 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(pdfText(title), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(pdfText(plan?.name || 'Pohjakuva'), 90, 18)
  const draw = { x: 14, y: 28, w: pageW - 28, h: pageH - 42 }
  const scale = Math.min(draw.w / (Math.max(1, box.maxX - box.minX) + 1.6), draw.h / (Math.max(1, box.maxZ - box.minZ) + 1.6))
  const X = (x) => draw.x + ((x - box.minX) + 0.8) * scale
  const Y = (z) => draw.y + ((z - box.minZ) + 0.8) * scale
  doc.setDrawColor(120)
  doc.setLineWidth(0.3)
  ;(plan?.walls || []).forEach((wall) => doc.line(X(wall.a.x), Y(wall.a.z), X(wall.b.x), Y(wall.b.z)))
  ensureServices(plan).runs.filter((run) => run.system === system).forEach((run) => {
    const [red, green, blue] = hexRgb(runColor(run))
    doc.setDrawColor(red, green, blue)
    doc.setLineWidth(run.kind === 'floorheat' ? 0.25 : 0.55)
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) doc.line(X(points[i - 1].x), Y(points[i - 1].z), X(points[i].x), Y(points[i].z))
    if (run.marking && points.length > 1) {
      const mid = points[Math.floor(points.length / 2)]
      doc.setFontSize(7)
      doc.setTextColor(20)
      doc.text(pdfText(run.marking), X(mid.x), Y(mid.z) - 1)
    }
  })
}

export function buildHydronicPdf(plan) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  drawServicePlan(doc, plan, 'water', 'Kayttovesi')
  doc.addPage('a3', 'landscape')
  drawServicePlan(doc, plan, 'heat', 'Lammitys')
  doc.addPage('a3', 'landscape')
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const heat = ensureServices(plan).heat || {}
  const heating = normalizeHeating(plan)
  doc.setDrawColor(28)
  doc.rect(8, 8, pageW - 16, pageH - 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(pdfText('Lammitysjarjestelman periaate ja piirit'), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(pdfText(`${heat.source || sourceSpec(heating.source).name}  ${heating.buffer ? `puskuri ${heating.bufferLitres} l` : 'ei puskuria'}  ${heating.distribution}`), 14, 26)
  let y = 36
  doc.setFontSize(8)
  ;(heat.loops || []).forEach((loop) => {
    doc.text(pdfText(`${loop.roomName} piiri ${loop.index}  ${loop.length} m  jako ${loop.spacing} m  ${loop.power} W`), 14, y)
    y += 5
  })
  ;(heat.radiators || []).forEach((row) => {
    doc.text(pdfText(`${row.name}  ${row.power} W  ${row.flow} l/s  PEX ${row.size}`), 14, y)
    y += 5
  })
  const boxes = [
    heat.source || 'Lahde',
    heating.buffer ? `Puskuri ${heating.bufferLitres} l` : null,
    heating.distribution === 'radiator' ? 'Patterit' : 'Lattialammitys',
    heating.dhw === 'exchanger' ? 'Siirrin' : `Varaaja ${heating.dhwLitres} l`,
  ].filter(Boolean)
  boxes.forEach((label, index) => {
    const x = 20 + index * 70
    doc.rect(x, pageH - 40, 58, 16)
    doc.text(pdfText(label).slice(0, 22), x + 3, pageH - 30)
    if (index < boxes.length - 1) doc.line(x + 58, pageH - 32, x + 70, pageH - 32)
  })
  return doc
}
