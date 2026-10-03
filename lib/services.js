import { jsPDF } from 'jspdf'
import { nearestWall, planBounds, pointInPolygon, segmentLength, visibleRooms } from './floorplan.js'
import { heatingLoads } from './roominfo.js'
import { applyVoltageDrop, deviceSpec, markingFor, planCircuits } from './electric.js'
import {
  AIR_AIR,
  floorLoops,
  heatFlowLs,
  normalizeHeating,
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

const HOT_COLD = new Set(['sink', 'basin', 'shower', 'bath', 'washer'])
const COLD_ONLY = new Set(['toilet', 'dishwasher'])
const WET = new Set(['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'])

export function emptyServices() {
  return {
    layers: { iv: true, water: true, drain: true, electric: true, heat: true },
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
  const known = ['olohuone', 'keittio', 'makuuhuone', 'wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone', 'eteinen', 'vaatehuone', 'tekninen', 'huone']
  if (known.includes(type) && type !== 'huone') return type
  const name = fold(room?.name)
  if (name.includes('olohuone')) return 'olohuone'
  if (name.includes('keitt')) return 'keittio'
  if (name.includes('makuu')) return 'makuuhuone'
  if (name.includes('kodinhoito')) return 'kodinhoitohuone'
  if (name.includes('vaate')) return 'vaatehuone'
  if (name.includes('tekn')) return 'tekninen'
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
  if (kind === 'socket' || kind === 'data' || kind === 'washer' || kind === 'dishwasher') return 0.3
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
      { kind: 'ulko', along: -0.45 },
      { kind: 'jate', along: 0.45 },
    ].forEach((stub) => {
      const frame = outwardNormal(hit.wall, hit, box)
      const px = hit.x + frame.dx * stub.along
      const pz = hit.z + frame.dz * stub.along
      const outside = { x: px + frame.nx * 0.7, y, z: pz + frame.nz * 0.7 }
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
  const fixtures = (plan.fixtures || []).filter((item) => HOT_COLD.has(item.type) || COLD_ONLY.has(item.type))
  const points = fixtures.map((item) => ({
    x: item.x,
    z: item.z,
    name: item.type,
    hot: HOT_COLD.has(item.type),
    cold: true,
  }))
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
  rooms.filter((room) => WET.has(roomKind(room))).forEach((room) => {
    const shower = (plan.fixtures || []).find((item) => item.type === 'shower' && pointInPolygon(item.x, item.z, room.gross || room.polygon || []))
    nodes.push({
      id: seq(),
      system: 'drain',
      kind: 'floor-drain',
      name: 'Lattiakaivo',
      size: 75,
      roomId: room.id,
      x: round3(shower ? shower.x : room.cx),
      y: -0.02,
      z: round3(shower ? shower.z : room.cz),
    })
  })
  const drains = []
  nodes.filter((item) => item.kind === 'floor-drain').forEach((item) => drains.push({ ...item, size: 75 }))
  ;(plan.fixtures || []).forEach((item) => {
    if (!HOT_COLD.has(item.type) && !COLD_ONLY.has(item.type)) return
    if (item.type === 'shower') return
    drains.push({
      id: seq(),
      system: 'drain',
      kind: 'drain-point',
      name: 'Kalusteliitäntä',
      fixtureType: item.type,
      size: 50,
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
  const stove = (plan.fixtures || []).find((item) => item.type === 'stove')
  if (stove) {
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'stove',
      name: 'Liesi',
      circuit: 3,
      x: round3(stove.x),
      y: serviceHeight(plan, 'electric', 'stove'),
      z: round3(stove.z),
    })
  }
  const heater = (plan.fixtures || []).find((item) => item.type === 'heater')
  if (heater) {
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'heater',
      name: 'Kiuas',
      circuit: 4,
      x: round3(heater.x),
      y: serviceHeight(plan, 'electric', 'heater'),
      z: round3(heater.z),
    })
  }
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
  const trunkY = {
    1: serviceHeight(plan, 'electric', 'light') - 0.05,
    2: 0.35,
    3: 0.55,
    4: 0.55,
    5: 0.4,
  }
  CIRCUITS.forEach((circuit) => {
    nodes.push({
      id: seq(),
      system: 'electric',
      kind: 'junction',
      name: 'Jakorasia',
      circuit: circuit.id,
      x: round3(panel.x + 0.28),
      y: trunkY[circuit.id],
      z: round3(panel.z + circuit.id * 0.14),
    })
  })
  const runs = []
  CIRCUITS.forEach((circuit) => {
    const devices = nodes.filter((item) => item.system === 'electric' && item.circuit === circuit.id && item.kind !== 'panel' && item.kind !== 'junction')
    if (!devices.length) return
    const y = trunkY[circuit.id]
    const shift = (circuit.id - 1) * 0.08
    const origin = { x: panel.x, y, z: panel.z + shift }
    const end = {
      x: average(devices.map((item) => item.x)),
      y,
      z: average(devices.map((item) => item.z)) + shift,
    }
    const trunk = ortho(origin, end)
    runs.push({ id: seq(), system: 'electric', kind: 'wire', role: 'trunk', circuit: circuit.id, points: trunk })
    devices.forEach((device) => {
      const hit = closestOn(trunk, device)
      runs.push({
        id: seq(),
        system: 'electric',
        kind: 'wire',
        role: 'branch',
        circuit: circuit.id,
        points: ortho({ x: hit.x, y, z: hit.z }, { x: device.x, y: device.y, z: device.z }),
      })
    })
  })
  return { nodes, runs }
}

const BUILDERS = { iv: buildIv, water: buildWater, drain: buildDrain, electric: buildElectric }

export function autoRoute(plan, system, options = {}) {
  const current = ensureServices(plan)
  let cursor = plan?.seq || 1
  const seq = () => {
    cursor += 1
    return `svc-${cursor}`
  }
  const built = (BUILDERS[system] || buildIv)(plan, seq, options)
  const stamp = (item) => ({ ...item, id: item.id || seq(), system })
  return {
    ...plan,
    seq: cursor,
    services: {
      ...current,
      layers: { ...current.layers, [system]: current.layers[system] !== false },
      nodes: [...current.nodes.filter((item) => item.system !== system), ...built.nodes.map(stamp)],
      runs: [...current.runs.filter((item) => item.system !== system), ...built.runs.map(stamp)],
    },
  }
}

export function autoRouteAll(plan, options = {}) {
  return ['iv', 'water', 'drain', 'electric'].reduce((current, system) => autoRoute(current, system, options), plan)
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

export function rewireElectric(plan) {
  const services = ensureServices(plan)
  let seq = plan?.seq || 1
  const nid = () => {
    seq += 1
    return `svc-${seq}`
  }
  let nodes = (services.nodes || []).map((node) => ({ ...node }))
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
    .filter((node) => node.system === 'electric' && node.kind !== 'panel' && node.kind !== 'junction')
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
  const fresh = []
  planned.circuits.forEach((circuit) => {
    const members = nodes.filter((node) => circuit.deviceIds.includes(node.id) && !lockedDevices.has(node.id))
    if (!members.length) return
    const y = circuit.phases >= 3 ? 0.55 : circuit.role === 'light' ? serviceHeight(plan, 'electric', 'light') - 0.08 : 0.35
    const pushRun = (points, deviceId, showMark) => {
      fresh.push({
        id: nid(),
        system: 'electric',
        kind: 'wire',
        role: deviceId ? 'branch' : 'trunk',
        circuit: circuit.id,
        deviceId: deviceId || undefined,
        points,
        cable: circuit.cable,
        marking: showMark ? markingFor(circuit) : '',
        showMark: Boolean(showMark),
        locked: false,
        fuse: circuit.fuse,
        rcd: circuit.rcd,
      })
    }
    if (members.length === 1) {
      const device = members[0]
      pushRun(ortho({ x: panel.x, y, z: panel.z }, { x: device.x, y: device.y || y, z: device.z }), device.id, true)
      return
    }
    const end = {
      x: average(members.map((item) => item.x)),
      y,
      z: average(members.map((item) => item.z)),
    }
    const trunk = ortho({ x: panel.x, y, z: panel.z }, end)
    pushRun(trunk, null, true)
    members.forEach((device) => {
      const hit = closestOn(trunk, device)
      pushRun(ortho({ x: hit.x, y, z: hit.z }, { x: device.x, y: device.y || y, z: device.z }), device.id, false)
    })
  })
  const circuits = planned.circuits.map((circuit) => {
    const related = [...fresh, ...locked].filter((run) => run.circuit === circuit.id || circuit.deviceIds.includes(run.deviceId))
    const longest = related.reduce((max, run) => Math.max(max, polylineMetres(run.points)), 0)
    return applyVoltageDrop(circuit, longest)
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
  let nodes = services.nodes.filter((node) => node.system !== 'electric' || !node.linkedFrom || keepIds.has(node.linkedFrom))
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

export function rewireHeat(plan) {
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
      make({ kind: 'heat-supply', role: 'supply', size: 25, points: ortho({ x: origin.x, y, z: origin.z }, { x: manifold.x, y, z: manifold.z }), marking: 'Menoputki PEX 25' })
      make({ kind: 'heat-return', role: 'return', size: 25, points: ortho({ x: manifold.x, y: y, z: manifold.z + 0.18 }, { x: origin.x, y, z: origin.z + 0.18 }), marking: 'Paluu PEX 25' })
      floorRooms.forEach((room) => {
        const lockedRoom = services.runs.some((run) => run.system === 'heat' && run.locked && run.roomId === room.id && run.kind === 'floorheat')
        if (lockedRoom) return
        const drawn = floorLoops(room, { spacing: heating.loopSpacing || 0.3, maxLength: 100 })
        const loss = designHeatLoss(room, loads)
        drawn.forEach((loop) => {
          const flow = heatFlowLs(loss.power / Math.max(1, drawn.length), 5)
          loops.push({ roomId: room.id, roomName: room.name, index: loop.index, length: loop.length, spacing: loop.spacing, power: Math.round(loss.power / drawn.length), flow: Math.round(flow * 1000) / 1000, size: pexSize(flow) })
          make({
            kind: 'floorheat',
            role: 'loop',
            roomId: room.id,
            size: 16,
            length: loop.length,
            points: loop.points,
            marking: `${loop.length.toFixed(0)} m`,
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
      demand,
      demandPower: demand.reduce((sum, item) => sum + item.watts, 0),
      totalPower: Math.round([...loops.map((item) => item.power), ...radRows.map((item) => item.power)].reduce((sum, value) => sum + value, 0)),
    }
    return syncLinkedElectric({
      ...plan,
      seq,
      heating,
      services: { ...services, nodes, runs: [...kept, ...fresh], heat: report },
    }, electricLinks(nodes, heating))
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
        x: round3(room.cx),
        z: round3(room.cz),
        y: 0.25,
        auto: true,
      })
    })
    heating = { ...heating, radiatorsSeeded: true }
  }
  assignRadiatorPower(nodes, rooms, loads, 'radiator')
  const kept = services.runs.filter((run) => run.system !== 'heat' || run.locked)
  const electricRads = nodes.filter((item) => item.system === 'electric' && item.kind === 'radiator')
  return rewireElectric({
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
        demand,
        demandPower: demand.reduce((sum, item) => sum + item.watts, 0),
        totalPower: electricRads.reduce((sum, item) => sum + (item.power || 0), 0),
      },
    },
  })
}

export function refreshHeat(plan) {
  if (!plan?.heating) return plan
  return rewireHeat(plan)
}

export function applyHeating(plan, patch) {
  const heating = normalizeHeating({ heating: { ...(plan?.heating || {}), ...patch } })
  return rewireWater(rewireHeat({ ...plan, heating }))
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

export function updateServiceNode(plan, id, patch) {
  const services = ensureServices(plan)
  const current = services.nodes.find((item) => item.id === id)
  const next = {
    ...plan,
    services: {
      ...services,
      nodes: services.nodes.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, ...(patch && Object.prototype.hasOwnProperty.call(patch, 'power') ? { powerManual: true } : {}) } : item)),
    },
  }
  if (current?.system === 'water' || patch?.system === 'water') return rewireWater(next)
  if (current?.system === 'heat' || patch?.system === 'heat') return rewireHeat(next)
  return current?.system === 'electric' || patch?.system === 'electric' ? rewireElectric(next) : next
}

export function updateServiceRun(plan, id, patch) {
  const services = ensureServices(plan)
  return {
    ...plan,
    services: {
      ...services,
      runs: services.runs.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)),
    },
  }
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
  if (bestRun) return { target: 'run', id: bestRun.run.id, system: bestRun.run.system }
  return null
}

export function serviceMenuSpec(kindOrTarget) {
  const target = typeof kindOrTarget === 'string' ? { kind: kindOrTarget } : (kindOrTarget || {})
  const kind = target.kind
  const system = target.system
  if (kind === 'run' || target.points) {
    if (system === 'drain' || kind === 'branch' || kind === 'main' || kind === 'vent') return ['size', 'slope', 'delete']
    if (system === 'electric' || kind === 'wire') return ['circuit', 'lock', 'delete']
    if (system === 'water' || kind === 'cold' || kind === 'hot' || kind === 'circ' || kind === 'floorheat') return ['kind', 'size', 'delete']
    return ['kind', 'size', 'delete']
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
  const nodes = ensureServices(plan).nodes.filter((item) => item.system === 'electric')
  return CIRCUITS.map((circuit) => {
    const devices = nodes.filter((item) => item.circuit === circuit.id && item.kind !== 'junction')
    return { ...circuit, count: devices.length, devices: devices.map((item) => item.name || item.kind) }
  })
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
    doc.setLineWidth(run.system === 'electric' ? 0.35 : 0.8)
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      doc.line(X(points[i - 1].x), Y(points[i - 1].z), X(points[i].x), Y(points[i].z))
    }
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
