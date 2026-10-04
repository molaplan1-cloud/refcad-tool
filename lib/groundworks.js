// Underground yard systems: energy wells, horizontal collectors and on-site wastewater.
// Geometry and service-run specs live here. Callers in the heating and yard
// modules write them onto the plan so this file does not import those modules.

import { applySlope } from './routeEdit.js'
import { normalizeHeating } from './hydronic.js'

export const YIELD_W_PER_M = 25
export const ANNUAL_KWH_PER_M = 110
export const MAX_BOREHOLE_M = 300

export const CLEARANCE = {
  plot: 7.5,
  building: 3,
  wellMin: 15,
  wellOk: 20,
  drinkingFail: 20,
  drinkingOk: 40,
  sewage: 20,
  storm: 5,
  wastePlot: 5,
  water: 20,
}

export const WASTE_UNIT_KINDS = [
  { id: 'holding', name: 'Umpisäiliö', w: 2.4, d: 1.6, volume: 8 },
  { id: 'septic', name: 'Saostussäiliö', w: 2.4, d: 1.4, chambers: 3 },
  { id: 'plant', name: 'Pienpuhdistamo', w: 1.8, d: 1.4, pump: true },
  { id: 'greyfilter', name: 'Harmaavesisuodatin', w: 1.2, d: 0.9 },
  { id: 'soakaway', name: 'Imeytyskaivo', w: 1.2, d: 1.2 },
  { id: 'stormwell', name: 'Sadevesikaivo', w: 0.9, d: 0.9 },
  { id: 'inspection', name: 'Tarkastuskaivo', w: 0.7, d: 0.7 },
]

export const GROUND_AREA_KINDS = [
  { id: 'loop', name: 'Vaakaputkisto' },
  { id: 'field', name: 'Imeytyskenttä' },
  { id: 'sandfilter', name: 'Maasuodattamo' },
  { id: 'waterbody', name: 'Vesistö' },
]

export const GROUND_LINE_KINDS = [
  { id: 'french', name: 'Salaoja' },
  { id: 'sewer', name: 'Viemäri' },
  { id: 'storm', name: 'Sadevesi' },
]

export const GROUND_TOOLS = [
  { id: 'borehole', name: 'Energiakaivo', mode: 'point' },
  { id: 'holding', name: 'Umpisäiliö', mode: 'point' },
  { id: 'septic', name: 'Saostussäiliö', mode: 'point' },
  { id: 'plant', name: 'Pienpuhdistamo', mode: 'point' },
  { id: 'greyfilter', name: 'Harmaavesisuodatin', mode: 'point' },
  { id: 'soakaway', name: 'Imeytyskaivo', mode: 'point' },
  { id: 'stormwell', name: 'Sadevesikaivo', mode: 'point' },
  { id: 'inspection', name: 'Tarkastuskaivo', mode: 'point' },
  { id: 'loop', name: 'Vaakaputkisto', mode: 'area' },
  { id: 'field', name: 'Imeytyskenttä', mode: 'area' },
  { id: 'sandfilter', name: 'Maasuodattamo', mode: 'area' },
  { id: 'waterbody', name: 'Vesistö', mode: 'area' },
  { id: 'french', name: 'Salaoja', mode: 'line' },
  { id: 'sewer', name: 'Viemäri', mode: 'line' },
  { id: 'storm', name: 'Sadevesi', mode: 'line' },
]

export const GROUND_COLLECTIONS = ['wells', 'loop', 'water', 'waste-units', 'waste-areas', 'waste-lines']

export const CLEARANCE_RADII = [3, 7.5, 20]

const SEWAGE_KINDS = new Set(['holding', 'septic', 'plant', 'greyfilter', 'soakaway'])
const STORM_KINDS = new Set(['stormwell', 'inspection'])

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function pointOf(point) {
  return { x: round3(point?.x), z: round3(point?.z) }
}

export function emptyGround() {
  return { mode: 'borehole', wells: [], loop: null, water: [] }
}

export function emptyWaste() {
  return { mode: 'municipal', units: [], areas: [], lines: [] }
}

function normalizeWell(raw, index) {
  return {
    id: raw?.id || `well-${index + 1}`,
    x: round3(raw?.x),
    z: round3(raw?.z),
    depth: Math.max(0, Number(raw?.depth) || 0),
    depthManual: Boolean(raw?.depthManual),
    hidden: Boolean(raw?.hidden),
  }
}

function normalizeLoop(raw) {
  if (!raw?.points || raw.points.length < 3) return null
  return { id: raw.id || 'loop', points: raw.points.map(pointOf), hidden: Boolean(raw.hidden) }
}

function normalizeArea(raw, index, fallback) {
  if (!raw?.points || raw.points.length < 3) return null
  return {
    id: raw.id || `${fallback}-${index + 1}`,
    kind: raw.kind || fallback,
    points: raw.points.map(pointOf),
    hidden: Boolean(raw.hidden),
  }
}

export function wasteUnitSpec(kind) {
  return WASTE_UNIT_KINDS.find((item) => item.id === kind) || WASTE_UNIT_KINDS[0]
}

function normalizeUnit(raw, index) {
  const spec = wasteUnitSpec(raw?.kind)
  return {
    id: raw?.id || `waste-${index + 1}`,
    kind: spec.id,
    x: round3(raw?.x),
    z: round3(raw?.z),
    w: Number(raw?.w) || spec.w,
    d: Number(raw?.d) || spec.d,
    rotation: Number(raw?.rotation) || 0,
    volume: raw?.volume != null ? Number(raw.volume) || 0 : (spec.volume || 0),
    chambers: raw?.chambers != null ? Number(raw.chambers) || 0 : (spec.chambers || 0),
    accessNote: raw?.accessNote != null ? String(raw.accessNote) : (spec.id === 'holding' ? 'Tyhjennysauto pääsee säiliölle' : ''),
    pump: raw?.pump != null ? Boolean(raw.pump) : Boolean(spec.pump),
    hidden: Boolean(raw?.hidden),
  }
}

function normalizeLine(raw, index) {
  if (!raw?.points || raw.points.length < 2) return null
  const kind = GROUND_LINE_KINDS.some((item) => item.id === raw.kind) ? raw.kind : 'french'
  return { id: raw.id || `line-${index + 1}`, kind, points: raw.points.map(pointOf), hidden: Boolean(raw.hidden) }
}

export function normalizeGround(raw) {
  const base = emptyGround()
  if (!raw || typeof raw !== 'object') return base
  return {
    mode: raw.mode === 'loop' ? 'loop' : 'borehole',
    wells: Array.isArray(raw.wells) ? raw.wells.map(normalizeWell) : [],
    loop: normalizeLoop(raw.loop),
    water: (Array.isArray(raw.water) ? raw.water : []).map((item, index) => normalizeArea({ ...item, kind: 'waterbody' }, index, 'water')).filter(Boolean),
  }
}

export function normalizeWaste(raw) {
  const base = emptyWaste()
  if (!raw || typeof raw !== 'object') return base
  return {
    mode: raw.mode === 'onsite' ? 'onsite' : 'municipal',
    units: Array.isArray(raw.units) ? raw.units.map(normalizeUnit) : [],
    areas: (Array.isArray(raw.areas) ? raw.areas : []).map((item, index) => normalizeArea(item, index, item?.kind === 'sandfilter' ? 'sandfilter' : 'field')).filter(Boolean),
    lines: (Array.isArray(raw.lines) ? raw.lines : []).map(normalizeLine).filter(Boolean),
  }
}

export function sizeBoreholes({ peakW = 0, annualKwh = 0, yieldWPerM = YIELD_W_PER_M, annualKwhPerM = ANNUAL_KWH_PER_M, maxDepth = MAX_BOREHOLE_M } = {}) {
  const fromPeak = Math.max(0, Number(peakW) || 0) / Math.max(1, Number(yieldWPerM) || YIELD_W_PER_M)
  const fromYear = Math.max(0, Number(annualKwh) || 0) / Math.max(1, Number(annualKwhPerM) || ANNUAL_KWH_PER_M)
  const metres = Math.max(fromPeak, fromYear)
  if (!(metres > 1)) return { metres: 0, count: 0, depth: 0, depths: [] }
  const limit = Math.max(30, Number(maxDepth) || MAX_BOREHOLE_M)
  const count = Math.max(1, Math.ceil(metres / limit - 1e-9))
  const depth = round1(metres / count)
  return {
    metres: round1(metres),
    count,
    depth,
    depths: Array.from({ length: count }, () => depth),
    yieldWPerM,
    annualKwhPerM,
  }
}

export function suggestWellSpots(box, count) {
  const spots = []
  const total = Math.max(1, Number(count) || 1)
  const x = round3((box?.maxX || 0) + 8)
  const z0 = box?.minZ || 0
  for (let i = 0; i < total; i += 1) spots.push({ x, z: round3(z0 + i * 20) })
  return spots
}

export function suggestLoopPoints(box, peakW) {
  const area = Math.max(40, (Number(peakW) || 0) / 20)
  const width = round1(Math.sqrt(area * 1.5))
  const depth = round1(area / width)
  const x0 = round3((box?.maxX || 0) + 4)
  const z0 = round3(box?.minZ || 0)
  return [
    { x: x0, z: z0 },
    { x: round3(x0 + width), z: z0 },
    { x: round3(x0 + width), z: round3(z0 + depth) },
    { x: x0, z: round3(z0 + depth) },
  ]
}

export function visualBoreholeDepth(depth) {
  const metres = Math.max(0, Number(depth) || 0)
  if (!(metres > 0)) return 1.5
  return Math.min(6, Math.max(1.2, metres / 40))
}

function pointInPoly(x, z, points) {
  let inside = false
  const poly = points || []
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]
    const b = poly[j]
    const hit = ((a.z > z) !== (b.z > z)) && (x < ((b.x - a.x) * (z - a.z)) / ((b.z - a.z) || 1e-9) + a.x)
    if (hit) inside = !inside
  }
  return inside
}

function distToSegment(point, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return Math.hypot(point.x - a.x, point.z - a.z)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2))
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t))
}

function distToPolyEdge(point, points) {
  const poly = points || []
  if (poly.length < 2) return Infinity
  let best = Infinity
  for (let i = 0; i < poly.length; i += 1) best = Math.min(best, distToSegment(point, poly[i], poly[(i + 1) % poly.length]))
  return best
}

function polygonArea(points) {
  const poly = points || []
  let sum = 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum) / 2
}

function wallBox(walls) {
  const ext = (walls || []).filter((wall) => wall?.kind !== 'interior' && wall?.a && wall?.b)
  const source = ext.length ? ext : (walls || []).filter((wall) => wall?.a && wall?.b)
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  source.forEach((wall) => {
    ;[wall.a, wall.b].forEach((point) => {
      box.minX = Math.min(box.minX, point.x)
      box.maxX = Math.max(box.maxX, point.x)
      box.minZ = Math.min(box.minZ, point.z)
      box.maxZ = Math.max(box.maxZ, point.z)
    })
  })
  if (!Number.isFinite(box.minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  return box
}

function buildingDistance(plan, x, z) {
  let best = Infinity
  ;(plan?.walls || []).filter((wall) => wall?.kind !== 'interior' && wall?.a && wall?.b).forEach((wall) => {
    best = Math.min(best, distToSegment({ x, z }, wall.a, wall.b))
  })
  const buildings = plan?.yard?.buildings || []
  buildings.forEach((item) => {
    const w = item.w || 1
    const d = item.d || 1
    const poly = [
      { x: item.x - w / 2, z: item.z - d / 2 },
      { x: item.x + w / 2, z: item.z - d / 2 },
      { x: item.x + w / 2, z: item.z + d / 2 },
      { x: item.x - w / 2, z: item.z + d / 2 },
    ]
    best = Math.min(best, pointInPoly(x, z, poly) ? 0 : distToPolyEdge({ x, z }, poly))
  })
  return best
}

function plotDistance(points, x, z) {
  if (!points || points.length < 3) return null
  if (!pointInPoly(x, z, points)) return 0
  return distToPolyEdge({ x, z }, points)
}

function pushWarning(list, entry) {
  list.push({
    ...entry,
    metres: round1(entry.metres),
    text: entry.text,
  })
}

export function groundWarnings(plan) {
  const yard = plan?.yard || {}
  const ground = normalizeGround(yard.ground)
  const waste = normalizeWaste(yard.waste)
  const warnings = []
  const activeWells = ground.mode === 'loop' ? [] : ground.wells.filter((item) => !item.hidden)
  const drinking = (yard.objects || []).filter((item) => item.kind === 'well')
  const sewageUnits = waste.units.filter((item) => SEWAGE_KINDS.has(item.kind) && !item.hidden)
  const stormUnits = waste.units.filter((item) => STORM_KINDS.has(item.kind) && !item.hidden)
  const sewageAreas = waste.areas.filter((item) => (item.kind === 'field' || item.kind === 'sandfilter') && !item.hidden)
  const seen = new Set()

  activeWells.forEach((well) => {
    const plot = plotDistance(yard.plot?.points, well.x, well.z)
    if (plot != null && plot < CLEARANCE.plot) {
      pushWarning(warnings, {
        level: 'fail',
        code: 'plot',
        subject: well.id,
        metres: plot,
        need: CLEARANCE.plot,
        text: `Energiakaivo: etäisyys rajaan ${round1(plot)} m, vaatimus ${CLEARANCE.plot} m`,
      })
    }
    const building = buildingDistance(plan, well.x, well.z)
    if (Number.isFinite(building) && building < CLEARANCE.building) {
      pushWarning(warnings, {
        level: 'fail',
        code: 'building',
        subject: well.id,
        metres: building,
        need: CLEARANCE.building,
        text: `Energiakaivo: etäisyys rakennukseen ${round1(building)} m, vaatimus ${CLEARANCE.building} m`,
      })
    }
    activeWells.forEach((other) => {
      if (other.id === well.id) return
      const key = [well.id, other.id].sort().join('|')
      if (seen.has(key)) return
      seen.add(key)
      const gap = Math.hypot(well.x - other.x, well.z - other.z)
      if (gap < CLEARANCE.wellMin) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'spacing',
          subject: key,
          metres: gap,
          need: CLEARANCE.wellMin,
          text: `Energiakaivojen väli ${round1(gap)} m, alle ${CLEARANCE.wellMin} m`,
        })
      } else if (gap < CLEARANCE.wellOk) {
        pushWarning(warnings, {
          level: 'warn',
          code: 'spacing',
          subject: key,
          metres: gap,
          need: CLEARANCE.wellOk,
          text: `Energiakaivojen väli ${round1(gap)} m, suositus vähintään ${CLEARANCE.wellOk} m`,
        })
      }
    })
    drinking.forEach((item) => {
      const gap = Math.hypot(well.x - item.x, well.z - item.z)
      if (gap < CLEARANCE.drinkingFail) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'drinking',
          subject: well.id,
          metres: gap,
          need: CLEARANCE.drinkingFail,
          text: `Etäisyys kaivoon ${round1(gap)} m, alle ${CLEARANCE.drinkingFail} m`,
        })
      } else if (gap < CLEARANCE.drinkingOk) {
        pushWarning(warnings, {
          level: 'warn',
          code: 'drinking',
          subject: well.id,
          metres: gap,
          need: CLEARANCE.drinkingOk,
          text: `Etäisyys kaivoon ${round1(gap)} m, suositus vähintään ${CLEARANCE.drinkingOk} m`,
        })
      }
    })
    ;[...sewageUnits.map((item) => ({ id: item.id, gap: Math.hypot(well.x - item.x, well.z - item.z) })), ...sewageAreas.map((item) => ({
      id: item.id,
      gap: pointInPoly(well.x, well.z, item.points) ? 0 : distToPolyEdge(well, item.points),
    }))].forEach((item) => {
      if (item.gap < CLEARANCE.sewage) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'sewage',
          subject: `${well.id}|${item.id}`,
          metres: item.gap,
          need: CLEARANCE.sewage,
          text: `Etäisyys jätevesijärjestelmään ${round1(item.gap)} m, vaatimus ${CLEARANCE.sewage} m`,
        })
      }
    })
    stormUnits.forEach((item) => {
      const gap = Math.hypot(well.x - item.x, well.z - item.z)
      if (gap < CLEARANCE.storm) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'storm',
          subject: `${well.id}|${item.id}`,
          metres: gap,
          need: CLEARANCE.storm,
          text: `Etäisyys sadevesikaivoon ${round1(gap)} m, suositus vähintään ${CLEARANCE.storm} m`,
        })
      }
    })
  })

  const wasteTargets = [...sewageUnits, ...sewageAreas]
  wasteTargets.forEach((item) => {
    const at = item.points ? centroid(item.points) : item
    const plot = plotDistance(yard.plot?.points, at.x, at.z)
    if (plot != null && plot < CLEARANCE.wastePlot) {
      pushWarning(warnings, {
        level: 'fail',
        code: 'waste-plot',
        subject: item.id,
        metres: plot,
        need: CLEARANCE.wastePlot,
        text: `Jätevesi: etäisyys rajaan ${round1(plot)} m, vaatimus ${CLEARANCE.wastePlot} m`,
      })
    }
    drinking.forEach((well) => {
      const gap = item.points
        ? (pointInPoly(well.x, well.z, item.points) ? 0 : distToPolyEdge(well, item.points))
        : Math.hypot(at.x - well.x, at.z - well.z)
      if (gap < CLEARANCE.sewage) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'waste-well',
          subject: item.id,
          metres: gap,
          need: CLEARANCE.sewage,
          text: `Jätevesi: etäisyys kaivoon ${round1(gap)} m, vaatimus ${CLEARANCE.sewage} m`,
        })
      }
    })
    ground.water.forEach((body) => {
      const gap = item.points
        ? Math.min(...item.points.map((point) => (pointInPoly(point.x, point.z, body.points) ? 0 : distToPolyEdge(point, body.points))))
        : (pointInPoly(at.x, at.z, body.points) ? 0 : distToPolyEdge(at, body.points))
      if (gap < CLEARANCE.water) {
        pushWarning(warnings, {
          level: 'fail',
          code: 'waste-water',
          subject: item.id,
          metres: gap,
          need: CLEARANCE.water,
          text: `Jätevesi: etäisyys vesistöön ${round1(gap)} m, vaatimus ${CLEARANCE.water} m`,
        })
      }
    })
  })
  return warnings
}

function centroid(points) {
  const poly = points || []
  if (!poly.length) return { x: 0, z: 0 }
  const sum = poly.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
  return { x: sum.x / poly.length, z: sum.z / poly.length }
}

function heatAnchor(plan) {
  const node = (plan?.services?.nodes || []).find((item) => item.kind === 'heat-source')
  if (node) return { x: round3(node.x), z: round3(node.z) }
  const box = wallBox(plan?.walls)
  return { x: round3(box.minX + 1.3), z: round3(box.minZ + 1.4) }
}

function houseOutlet(plan, target) {
  let best = null
  ;(plan?.walls || []).filter((wall) => wall?.kind !== 'interior' && wall?.a && wall?.b).forEach((wall) => {
    const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
    const dist = Math.hypot(mid.x - target.x, mid.z - target.z)
    if (!best || dist < best.dist) best = { dist, mid }
  })
  if (!best) return { x: round3(target.x), z: round3(target.z) }
  const dx = target.x - best.mid.x
  const dz = target.z - best.mid.z
  const len = Math.hypot(dx, dz) || 1
  return { x: round3(best.mid.x + (dx / len) * 0.6), z: round3(best.mid.z + (dz / len) * 0.6) }
}

function distributionPipes(points) {
  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minZ = Math.min(...points.map((point) => point.z))
  const maxZ = Math.max(...points.map((point) => point.z))
  const alongX = (maxX - minX) >= (maxZ - minZ)
  const lines = []
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4
    if (alongX) {
      const z = round3(minZ + (maxZ - minZ) * t)
      lines.push([{ x: round3(minX + 0.4), z }, { x: round3(maxX - 0.4), z }])
    } else {
      const x = round3(minX + (maxX - minX) * t)
      lines.push([{ x, z: round3(minZ + 0.4) }, { x, z: round3(maxZ - 0.4) }])
    }
  }
  return lines
}

function lowEdge(points) {
  let best = null
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const z = (a.z + b.z) / 2
    if (!best || z > best.z) best = { z, points: [a, b] }
  }
  return best?.points || points.slice(0, 2)
}

function sloped(points, slope, y0) {
  return applySlope(points.map((point, index) => ({ x: point.x, z: point.z, y: index === 0 ? y0 : y0 })), slope)
}

export function groundRunSpecs(plan) {
  const heating = normalizeHeating(plan)
  const ground = normalizeGround(plan?.yard?.ground)
  const waste = normalizeWaste(plan?.yard?.waste)
  const specs = []
  const anchor = heatAnchor(plan)
  if (heating.source === 'ground' && heating.borehole !== false) {
    ground.wells.filter((item) => !item.hidden).forEach((well) => {
      specs.push({
        system: 'heat',
        kind: 'collector',
        dashed: true,
        locked: true,
        linkedFrom: `yard:ground:${well.id}`,
        size: 40,
        points: [
          { x: well.x, y: -0.8, z: well.z },
          { x: anchor.x, y: -0.8, z: anchor.z },
        ],
      })
    })
  }
  if (heating.source === 'ground' && heating.borehole === false && ground.loop && !ground.loop.hidden) {
    const at = centroid(ground.loop.points)
    specs.push({
      system: 'heat',
      kind: 'collector',
      dashed: true,
      locked: true,
      linkedFrom: `yard:ground:${ground.loop.id}`,
      size: 40,
      points: [
        { x: round3(at.x), y: -0.8, z: round3(at.z) },
        { x: anchor.x, y: -0.8, z: anchor.z },
      ],
    })
  }
  waste.units.filter((item) => !item.hidden).forEach((unit) => {
    const sewage = SEWAGE_KINDS.has(unit.kind)
    const storm = unit.kind === 'stormwell' || unit.kind === 'soakaway'
    if (!sewage && !storm) return
    const outlet = houseOutlet(plan, unit)
    const slope = sewage ? 1 : 0.5
    specs.push({
      system: 'drain',
      kind: sewage ? 'main' : 'storm',
      slope,
      size: 110,
      dashed: false,
      locked: true,
      linkedFrom: `yard:waste:${unit.id}:${sewage ? 'sewer' : 'storm'}`,
      points: sloped([outlet, { x: unit.x, z: unit.z }], slope, -0.4),
    })
  })
  waste.lines.filter((item) => !item.hidden).forEach((line) => {
    const slope = line.kind === 'sewer' ? 1 : 0.5
    specs.push({
      system: 'drain',
      kind: line.kind === 'sewer' ? 'main' : 'storm',
      slope,
      size: 110,
      dashed: line.kind === 'french',
      locked: true,
      linkedFrom: `yard:waste:${line.id}:line`,
      points: sloped(line.points, slope, -0.45),
    })
  })
  const sewageUnits = waste.units.filter((item) => SEWAGE_KINDS.has(item.kind) && !item.hidden)
  waste.areas.filter((item) => !item.hidden && (item.kind === 'field' || item.kind === 'sandfilter')).forEach((area) => {
    distributionPipes(area.points).forEach((pts, index) => {
      specs.push({
        system: 'drain',
        kind: 'branch',
        slope: 0.5,
        size: 110,
        dashed: true,
        locked: true,
        linkedFrom: `yard:waste:${area.id}:dist:${index}`,
        points: sloped(pts, 0.5, -0.6),
      })
    })
    if (area.kind === 'sandfilter') {
      specs.push({
        system: 'drain',
        kind: 'main',
        slope: 0.5,
        size: 110,
        dashed: true,
        locked: true,
        linkedFrom: `yard:waste:${area.id}:collector`,
        points: sloped(lowEdge(area.points), 0.5, -0.9),
      })
    }
    if (sewageUnits.length) {
      const at = centroid(area.points)
      let nearest = sewageUnits[0]
      sewageUnits.forEach((unit) => {
        if (Math.hypot(unit.x - at.x, unit.z - at.z) < Math.hypot(nearest.x - at.x, nearest.z - at.z)) nearest = unit
      })
      specs.push({
        system: 'drain',
        kind: 'main',
        slope: 1,
        size: 110,
        dashed: false,
        locked: true,
        linkedFrom: `yard:waste:${area.id}:feed`,
        points: sloped([{ x: nearest.x, z: nearest.z }, { x: round3(at.x), z: round3(at.z) }], 1, -0.55),
      })
    }
  })
  return specs
}

function ownedLink(link) {
  const value = String(link || '')
  return value.startsWith('yard:ground:') || value.startsWith('yard:waste:')
}

export function mergeGroundRuns(runs, specs, seqStart = 1) {
  const previous = new Map()
  ;(runs || []).forEach((run) => {
    if (ownedLink(run.linkedFrom)) previous.set(run.linkedFrom, run)
  })
  const kept = (runs || []).filter((run) => !ownedLink(run.linkedFrom))
  let seq = seqStart || 1
  const added = (specs || []).map((spec) => {
    const prev = previous.get(spec.linkedFrom)
    if (prev?.manual) return prev
    seq += 1
    return { ...spec, id: prev?.id || `svc-g${seq}`, locked: true, manual: false }
  })
  return { runs: [...kept, ...added], seq }
}

function assignDepths(wells, sized) {
  if (!wells.length || !(sized.metres > 0)) return wells
  const depth = round1(Math.min(MAX_BOREHOLE_M, sized.metres / wells.length))
  return wells.map((well) => (well.depthManual ? well : { ...well, depth }))
}

export function attachGroundworks(plan, demand = {}) {
  const heating = normalizeHeating(plan)
  const yard = { ...(plan?.yard || {}) }
  let ground = normalizeGround(yard.ground)
  const waste = normalizeWaste(yard.waste)
  const box = wallBox(plan?.walls)
  if (heating.source === 'ground' && heating.borehole !== false && ground.wells.length === 0 && (Number(demand.peakW) || 0) > 0) {
    const sized = sizeBoreholes(demand)
    const count = Math.max(1, sized.count || 1)
    ground = {
      ...ground,
      mode: 'borehole',
      wells: suggestWellSpots(box, count).map((spot, index) => ({
        id: `bhk-${index + 1}`,
        x: spot.x,
        z: spot.z,
        depth: sized.depth || 0,
        depthManual: false,
      })),
    }
  } else if (heating.source === 'ground' && heating.borehole !== false) {
    ground = { ...ground, mode: 'borehole', wells: assignDepths(ground.wells, sizeBoreholes(demand)) }
  }
  if (heating.source === 'ground' && heating.borehole === false) {
    ground = {
      ...ground,
      mode: 'loop',
      loop: ground.loop || { id: 'loop-1', points: suggestLoopPoints(box, demand.peakW) },
    }
  }
  const next = { ...plan, yard: { ...yard, ground, waste } }
  const merged = mergeGroundRuns(plan?.services?.runs || [], groundRunSpecs(next), plan?.seq || 1)
  return {
    ...next,
    seq: Math.max(plan?.seq || 1, merged.seq),
    services: { ...(plan?.services || {}), runs: merged.runs },
  }
}

export function plantPumpSpecs(plan) {
  const waste = normalizeWaste(plan?.yard?.waste)
  return waste.units.filter((unit) => unit.pump && !unit.hidden).map((unit) => ({
    system: 'electric',
    kind: 'treatment-pump',
    role: 'power',
    name: 'Pienpuhdistamon pumppu',
    voltage: 230,
    power: 400,
    cosPhi: 1,
    connection: 'fixed',
    dedicated: true,
    outdoor: true,
    rcd: true,
    ip: 'IP68',
    circuitMode: 'auto',
    linkedFrom: `yard:waste:${unit.id}:pump`,
    roomId: 'piha',
    roomName: 'Piha',
    x: round3(unit.x),
    z: round3(unit.z),
    y: -0.4,
  }))
}

export function groundBill(plan) {
  const ground = normalizeGround(plan?.yard?.ground)
  const waste = normalizeWaste(plan?.yard?.waste)
  const rows = []
  if (ground.mode !== 'loop') {
    ground.wells.forEach((well) => {
      rows.push({ id: well.id, kind: 'borehole', name: `Energiakaivo ${round1(well.depth)} m`, qty: well.depth, unit: 'm' })
    })
  }
  if (ground.mode === 'loop' && ground.loop) {
    rows.push({ id: ground.loop.id, kind: 'loop', name: 'Vaakaputkisto', qty: round1(polygonArea(ground.loop.points)), unit: 'm²' })
  }
  waste.units.forEach((unit) => {
    const spec = wasteUnitSpec(unit.kind)
    let name = spec.name
    if (unit.kind === 'holding') name = `${spec.name} ${round1(unit.volume)} m³`
    if (unit.kind === 'septic') name = `${spec.name}, ${unit.chambers} osastoa`
    rows.push({
      id: unit.id,
      kind: unit.kind,
      name,
      qty: unit.kind === 'holding' ? unit.volume : 1,
      unit: unit.kind === 'holding' ? 'm³' : 'kpl',
    })
  })
  waste.areas.forEach((area) => {
    const spec = GROUND_AREA_KINDS.find((item) => item.id === area.kind)
    rows.push({ id: area.id, kind: area.kind, name: spec?.name || area.kind, qty: round1(polygonArea(area.points)), unit: 'm²' })
  })
  return rows
}

export function yardHasUnderground(yard) {
  const ground = normalizeGround(yard?.ground)
  const waste = normalizeWaste(yard?.waste)
  return ground.wells.length > 0 || Boolean(ground.loop) || ground.water.length > 0 || waste.units.length > 0 || waste.areas.length > 0 || waste.lines.length > 0
}

export function removeGroundItem(yard, collection, id) {
  const ground = normalizeGround(yard?.ground)
  const waste = normalizeWaste(yard?.waste)
  if (collection === 'wells') ground.wells = ground.wells.filter((item) => item.id !== id)
  else if (collection === 'loop') ground.loop = null
  else if (collection === 'water') ground.water = ground.water.filter((item) => item.id !== id)
  else if (collection === 'waste-units') waste.units = waste.units.filter((item) => item.id !== id)
  else if (collection === 'waste-areas') waste.areas = waste.areas.filter((item) => item.id !== id)
  else if (collection === 'waste-lines') waste.lines = waste.lines.filter((item) => item.id !== id)
  else return yard
  return { ...yard, ground, waste }
}

export function mapGroundItem(yard, collection, id, mapPoint) {
  const ground = normalizeGround(yard?.ground)
  const waste = normalizeWaste(yard?.waste)
  const shift = (point) => {
    const next = mapPoint(point) || point
    return { ...point, x: round3(next.x), z: round3(next.z) }
  }
  if (collection === 'wells') ground.wells = ground.wells.map((item) => (item.id === id ? { ...item, ...shift(item) } : item))
  else if (collection === 'waste-units') waste.units = waste.units.map((item) => (item.id === id ? { ...item, ...shift(item) } : item))
  else if (collection === 'loop' && ground.loop && ground.loop.id === id) ground.loop = { ...ground.loop, points: ground.loop.points.map(shift) }
  else if (collection === 'water') ground.water = ground.water.map((item) => (item.id === id ? { ...item, points: item.points.map(shift) } : item))
  else if (collection === 'waste-areas') waste.areas = waste.areas.map((item) => (item.id === id ? { ...item, points: item.points.map(shift) } : item))
  else if (collection === 'waste-lines') waste.lines = waste.lines.map((item) => (item.id === id ? { ...item, points: item.points.map(shift) } : item))
  else return null
  return { ...yard, ground, waste }
}

export function duplicateGroundItem(yard, collection, id, nextId) {
  const ground = normalizeGround(yard?.ground)
  const waste = normalizeWaste(yard?.waste)
  const shiftPoints = (points) => (points || []).map((point) => ({ x: round3(point.x + 0.8), z: round3(point.z + 0.8) }))
  if (collection === 'wells') {
    const item = ground.wells.find((entry) => entry.id === id)
    if (!item) return yard
    ground.wells = [...ground.wells, { ...item, id: nextId, x: round3(item.x + 0.8), z: round3(item.z + 0.8) }]
  } else if (collection === 'waste-units') {
    const item = waste.units.find((entry) => entry.id === id)
    if (!item) return yard
    waste.units = [...waste.units, { ...item, id: nextId, x: round3(item.x + 0.8), z: round3(item.z + 0.8) }]
  } else if (collection === 'loop' && ground.loop) {
    ground.loop = { ...ground.loop, id: nextId, points: shiftPoints(ground.loop.points) }
  } else if (collection === 'water') {
    const item = ground.water.find((entry) => entry.id === id)
    if (!item) return yard
    ground.water = [...ground.water, { ...item, id: nextId, points: shiftPoints(item.points) }]
  } else if (collection === 'waste-areas') {
    const item = waste.areas.find((entry) => entry.id === id)
    if (!item) return yard
    waste.areas = [...waste.areas, { ...item, id: nextId, points: shiftPoints(item.points) }]
  } else if (collection === 'waste-lines') {
    const item = waste.lines.find((entry) => entry.id === id)
    if (!item) return yard
    waste.lines = [...waste.lines, { ...item, id: nextId, points: shiftPoints(item.points) }]
  } else return yard
  return { ...yard, ground, waste }
}
