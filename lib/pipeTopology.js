// Refrigeration circuit topology. A combined condensing unit keeps the hot-gas
// run, receiver, filter-drier and sight glass inside the casing. A split system
// with a remote condenser draws four external segments:
//   hot gas: compressor discharge -> condenser inlet
//   liquid return: condenser outlet -> receiver inlet on the compressor unit
//   liquid supply: receiver outlet (after drier and sight glass) -> evaporator
//   suction: evaporator -> compressor suction

import { isRefrigerated } from './catalog.js'
import { comboBody, equipmentPorts, insideRefrigerated, internalCeiling, isOutdoorCategory, outlinePoints, pointInOutline, resolvedElevation, serviceSide, snapOutdoorUnit } from './placement.js'

export const PIPE_STYLES = {
  suction: {
    color: '#1d4ed8', pdf: [29, 78, 216], dash: null, pdfDash: [],
    layer: 'SUCTION', ltype: 'CONTINUOUS', legend: 'Imuputki', short: 'Imu',
  },
  liquid: {
    color: '#15803d', pdf: [21, 128, 61], dash: null, pdfDash: [],
    layer: 'LIQUID', ltype: 'CONTINUOUS', legend: 'Nesteputki, vastaanotin–höyrystin', short: 'Neste',
  },
  liquidReturn: {
    color: '#047857', pdf: [4, 120, 87], dash: '0.16 0.06 0.04 0.06', pdfDash: [2.2, 0.8, 0.4, 0.8],
    layer: 'LIQUID_RETURN', ltype: 'DASHDOT', legend: 'Nesteputki, lauhdutin–vastaanotin', short: 'Lauhdutin–vastaanotin',
  },
  hotgas: {
    color: '#b91c1c', pdf: [185, 28, 28], dash: '0.2 0.08', pdfDash: [2.4, 1],
    layer: 'HOTGAS', ltype: 'DASHED', legend: 'Kuumakaasuputki', short: 'Kuumakaasu',
  },
  drain: {
    color: '#c2410c', pdf: [194, 65, 12], dash: '0.22 0.14', pdfDash: [1.6, 1.1],
    layer: 'DRAIN', ltype: 'DASHED', legend: 'Kondenssivesi', short: 'Kondenssi',
  },
  drainHeat: {
    color: '#9a3412', pdf: [154, 52, 18], dash: '0.08 0.05 0.18 0.05', pdfDash: [0.6, 0.5, 1.8, 0.5],
    layer: 'DRAIN_HEAT', ltype: 'DASHED', legend: 'Kondenssivesi, eristetty ja lämmitetty', short: 'Kondenssi +lämpö',
  },
}

export const INTERNAL_LIQUID_TRAIN = 'Kompressoriyksikön sisällä: vastaanotin, kuivain ja näkölasi. Niitä ei piirretä erillisinä putkina.'

export function pipeAppearance(pipe, heatTraced = false) {
  if (pipe?.kind === 'drain' && heatTraced) return PIPE_STYLES.drainHeat
  if (pipe?.kind === 'liquid' && pipe.segment === 'return') return PIPE_STYLES.liquidReturn
  return PIPE_STYLES[pipe?.kind] || PIPE_STYLES.suction
}

function machineCat(eq) {
  if (!eq) return ''
  if (eq.category === 'combo' || eq.category === 'unit') return 'unit'
  return eq.category
}

function endsOf(pipeOrPoints) {
  const points = Array.isArray(pipeOrPoints) ? pipeOrPoints : (pipeOrPoints?.points || [])
  if (points.length < 2) return []
  return [points[0], points[points.length - 1]]
}

export function nearestEquipmentPort(rooms, point, reach = 0.75) {
  if (!point) return null
  let best = null
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      for (const port of Object.values(ports)) {
        const dist = Math.hypot(port.x - point.x, port.z - point.z)
        if (dist <= reach && (!best || dist < best.dist)) {
          best = { dist, port, eq, room, category: machineCat(eq) }
        }
      }
    }
  }
  return best
}

export function endAttachments(pipe, rooms, reach = 0.75) {
  return endsOf(pipe).map((point) => nearestEquipmentPort(rooms, point, reach)).filter(Boolean)
}

function tag(att) {
  return `${att.category}:${att.port.key}`
}

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

const PAIRS = {
  suction: new Set([
    pairKey('evaporator:suction', 'compressor:suction'),
    pairKey('evaporator:suction', 'unit:suction'),
  ]),
  hotgas: new Set([pairKey('compressor:discharge', 'condenser:hotgas')]),
  liquid: new Set([
    pairKey('condenser:liquid', 'compressor:liquidIn'),
    pairKey('compressor:liquidOut', 'evaporator:liquid'),
    pairKey('unit:liquid', 'evaporator:liquid'),
  ]),
}

function pairId(a, b) {
  return pairKey(tag(a), tag(b))
}

function portsMatching(rooms, kind) {
  const list = []
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      for (const port of Object.values(ports)) {
        if (port.kind !== kind) continue
        list.push({ ...port, eq, room, category: machineCat(eq), id: `${eq.id}:${port.key}` })
      }
    }
  }
  return list
}

export function highlightedPorts(rooms, kind, existingPoints = []) {
  const all = portsMatching(rooms, kind)
  const anchor = (existingPoints || []).map((point) => nearestEquipmentPort(rooms, point, 0.45)).find((hit) => hit && hit.port.kind === kind)
  if (!anchor || !PAIRS[kind]) return all
  return all.filter((port) => {
    const other = { category: port.category, port }
    return PAIRS[kind].has(pairId(anchor, other))
  })
}

export function snapPort(rooms, x, z, kind, existingPoints = [], maxDist = 0.7) {
  let best = null
  for (const port of highlightedPorts(rooms, kind, existingPoints)) {
    const dist = Math.hypot(port.x - x, port.z - z)
    if (dist <= maxDist && (!best || dist < best.dist)) best = { ...port, dist }
  }
  return best
}

function hintFor(kind, ends) {
  if (kind === 'hotgas') {
    return 'Kuumakaasuputki kulkee kompressorin paineliitännästä lauhduttimen kuumakaasuliitäntään. Yhdistelmäkoneikossa kuumakaasu on sisäinen eikä sitä piirretä.'
  }
  if (kind === 'suction') {
    return 'Imuputki kulkee höyrystimen imuliitännästä kompressorin tai koneikon imuliitäntään.'
  }
  if (kind === 'liquid') {
    const tags = (ends || []).filter(Boolean).map(tag)
    if (tags.includes('condenser:liquid') && tags.includes('evaporator:liquid')) {
      return 'Neste kulkee lauhduttimelta ensin kompressoriyksikön vastaanottimeen, ja vasta vastaanottimelta höyrystimelle.'
    }
    return 'Nesteputki kytketään joko lauhduttimen lähdöstä vastaanottimeen tai vastaanottimen lähdöstä höyrystimen paisuntaventtiilille. Koneikolta neste menee suoraan höyrystimelle.'
  }
  return 'Kondenssivesiputki lähtee höyrystimen kondenssivesiyhteestä.'
}

export function liquidSegment(pipe, rooms) {
  if (pipe?.segment === 'return' || pipe?.segment === 'supply') return pipe.segment
  const ends = endAttachments(pipe, rooms)
  if (ends.length < 2) return 'supply'
  return segmentFor('liquid', ends) || 'supply'
}

export function segmentFor(kind, ends) {
  if (kind !== 'liquid') return null
  const id = pairId(ends[0], ends[1])
  if (id === pairKey('condenser:liquid', 'compressor:liquidIn')) return 'return'
  return 'supply'
}

export function validateRoute(kind, points, rooms) {
  const tips = endsOf(points)
  if (tips.length < 2) return { ok: false, hint: 'Putki tarvitsee vähintään kaksi pistettä.' }
  if (kind === 'drain') {
    const hits = tips.map((point) => nearestEquipmentPort(rooms, point, 0.75))
    const drain = hits.find((hit) => hit?.port.key === 'drain')
    if (!drain) return { ok: false, hint: hintFor('drain') }
    const other = hits.find((hit) => hit && hit !== drain && hit.port.kind !== 'drain')
    if (other) return { ok: false, hint: 'Kondenssivesiputkea ei kytketä kylmäaineliitäntään.' }
    return { ok: true, segment: null, ends: hits.filter(Boolean) }
  }
  const ends = tips.map((point) => nearestEquipmentPort(rooms, point, 0.75))
  if (ends.some((hit) => !hit) || ends.some((hit) => hit.port.kind !== kind) || !PAIRS[kind]?.has(pairId(ends[0], ends[1]))) {
    return { ok: false, hint: hintFor(kind, ends), ends }
  }
  return { ok: true, segment: segmentFor(kind, ends), ends }
}

function crossT(a, b, c, d) {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = d.x - c.x
  const sz = d.z - c.z
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den
  if (t <= 0.02 || t >= 0.98 || u < 0 || u > 1) return null
  return t
}

export function outlineCrossings(points, rooms) {
  let n = 0
  for (let i = 1; i < points.length; i += 1) {
    for (const room of rooms || []) {
      const poly = outlinePoints(room)
      for (let e = 0; e < poly.length; e += 1) {
        if (crossT(points[i - 1], points[i], poly[e], poly[(e + 1) % poly.length]) != null) n += 1
      }
    }
  }
  return n
}

function dedupe(points) {
  const out = []
  points.forEach((point) => {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.z - point.z) < 0.04) {
      out[out.length - 1] = { ...prev, ...point, x: point.x, z: point.z }
      return
    }
    out.push({ ...point })
  })
  return out
}

function manhattan(a, b, rooms) {
  const viaX = dedupe([a, { x: b.x, z: a.z }, b])
  const viaZ = dedupe([a, { x: a.x, z: b.z }, b])
  return outlineCrossings(viaX, rooms) <= outlineCrossings(viaZ, rooms) ? viaX : viaZ
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

function hostRoom(rooms, point) {
  if (!point) return null
  const hits = (rooms || []).filter((room) => room && room.type !== 'yard' && pointInOutline(point.x, point.z, outlinePoints(room)))
  hits.sort((a, b) => (a.width || 0) * (a.depth || 0) - (b.width || 0) * (b.depth || 0))
  return hits[0] || null
}

function boundsOfRoom(room) {
  const poly = outlinePoints(room)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  poly.forEach((point) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  })
  return { minX, maxX, minZ, maxZ }
}

function ringMetrics(inner) {
  const w = inner.maxX - inner.minX
  const d = inner.maxZ - inner.minZ
  return { w, d, per: 2 * (w + d) }
}

function ringPos(point, inner) {
  const { w, d } = ringMetrics(inner)
  const eps = 0.08
  if (Math.abs(point.z - inner.minZ) <= eps) return clamp(point.x - inner.minX, 0, w)
  if (Math.abs(point.x - inner.maxX) <= eps) return w + clamp(point.z - inner.minZ, 0, d)
  if (Math.abs(point.z - inner.maxZ) <= eps) return w + d + clamp(inner.maxX - point.x, 0, w)
  return w + d + w + clamp(inner.maxZ - point.z, 0, d)
}

function pointOnRing(distance, inner) {
  const { w, d, per } = ringMetrics(inner)
  let t = ((distance % per) + per) % per
  if (t <= w) return { x: inner.minX + t, z: inner.minZ }
  t -= w
  if (t <= d) return { x: inner.maxX, z: inner.minZ + t }
  t -= d
  if (t <= w) return { x: inner.maxX - t, z: inner.maxZ }
  t -= w
  return { x: inner.minX, z: inner.maxZ - t }
}

function ringCandidates(point, inner) {
  return [
    { x: inner.minX, z: clamp(point.z, inner.minZ, inner.maxZ) },
    { x: inner.maxX, z: clamp(point.z, inner.minZ, inner.maxZ) },
    { x: clamp(point.x, inner.minX, inner.maxX), z: inner.minZ },
    { x: clamp(point.x, inner.minX, inner.maxX), z: inner.maxZ },
  ]
}

function walkLength(from, to, inner) {
  const { per } = ringMetrics(inner)
  let delta = ringPos(to, inner) - ringPos(from, inner)
  if (delta > per / 2) delta -= per
  if (delta < -per / 2) delta += per
  return Math.abs(delta)
}

function bestOnRing(point, goal, inner) {
  return ringCandidates(point, inner).reduce((best, option) => {
    const interior = Math.hypot(option.x - point.x, option.z - point.z)
    const cost = interior * 4 + walkLength(option, goal, inner)
    return !best || cost < best.cost ? { option, cost } : best
  }, null).option
}

function jog(from, target) {
  if (Math.abs(from.x - target.x) < 0.02 || Math.abs(from.z - target.z) < 0.02) return [target]
  const alongX = Math.abs(target.x - from.x) >= Math.abs(target.z - from.z)
  return alongX
    ? [{ x: target.x, z: from.z }, target]
    : [{ x: from.x, z: target.z }, target]
}

function walkRing(from, to, inner) {
  const { w, d, per } = ringMetrics(inner)
  const start = ringPos(from, inner)
  const endPos = ringPos(to, inner)
  let delta = endPos - start
  if (delta > per / 2) delta -= per
  if (delta < -per / 2) delta += per
  if (Math.abs(delta) < 0.04) return []
  const corners = [0, w, w + d, 2 * w + d]
  const dir = Math.sign(delta)
  const steps = []
  let cursor = start
  const stop = start + delta
  for (let guard = 0; guard < 8; guard += 1) {
    let next = null
    corners.forEach((corner) => {
      let mark = corner
      if (dir > 0) {
        while (mark <= cursor + 1e-4) mark += per
        if (mark < stop - 1e-4 && (next == null || mark < next)) next = mark
      } else {
        while (mark >= cursor - 1e-4) mark -= per
        if (mark > stop + 1e-4 && (next == null || mark > next)) next = mark
      }
    })
    if (next == null) break
    steps.push(pointOnRing(next, inner))
    cursor = next
  }
  return steps
}

function nearestBoundary(point, bounds) {
  const options = [
    { dist: Math.abs(point.z - bounds.minZ), at: { x: clamp(point.x, bounds.minX, bounds.maxX), z: bounds.minZ }, ox: 0, oz: -1 },
    { dist: Math.abs(point.z - bounds.maxZ), at: { x: clamp(point.x, bounds.minX, bounds.maxX), z: bounds.maxZ }, ox: 0, oz: 1 },
    { dist: Math.abs(point.x - bounds.minX), at: { x: bounds.minX, z: clamp(point.z, bounds.minZ, bounds.maxZ) }, ox: -1, oz: 0 },
    { dist: Math.abs(point.x - bounds.maxX), at: { x: bounds.maxX, z: clamp(point.z, bounds.minZ, bounds.maxZ) }, ox: 1, oz: 0 },
  ]
  return options.reduce((best, item) => (item.dist < best.dist ? item : best))
}

function routeAlongWalls(from, to, room, inset) {
  const bounds = boundsOfRoom(room)
  const spanX = bounds.maxX - bounds.minX
  const spanZ = bounds.maxZ - bounds.minZ
  const pad = Math.min(Math.max(0.12, inset), spanX * 0.3, spanZ * 0.3)
  if (pad < 0.08 || spanX < 0.5 || spanZ < 0.5) return manhattan(from, to, [room])
  const inner = {
    minX: bounds.minX + pad,
    maxX: bounds.maxX - pad,
    minZ: bounds.minZ + pad,
    maxZ: bounds.maxZ - pad,
  }
  if (pointInOutline(to.x, to.z, outlinePoints(room))) {
    const end = ringCandidates(to, inner).reduce((best, option) => (
      Math.hypot(option.x - to.x, option.z - to.z) < Math.hypot(best.x - to.x, best.z - to.z) ? option : best
    ))
    const start = bestOnRing(from, end, inner)
    return dedupe([from, ...jog(from, start), ...walkRing(start, end, inner), ...jog(end, to)])
  }
  const wall = nearestBoundary(to, bounds)
  const exit = {
    x: clamp(wall.at.x - wall.ox * pad, inner.minX, inner.maxX),
    z: clamp(wall.at.z - wall.oz * pad, inner.minZ, inner.maxZ),
  }
  const start = bestOnRing(from, exit, inner)
  const past = (to.x - wall.at.x) * wall.ox + (to.z - wall.at.z) * wall.oz
  const clear = (room.wallThickness || 0.1) + 0.16
  if (past > 0.02 && past <= clear + 0.08) {
    return dedupe([from, ...jog(from, start), ...walkRing(start, exit, inner), exit, to])
  }
  const outside = { x: wall.at.x + wall.ox * clear, z: wall.at.z + wall.oz * clear }
  return dedupe([from, ...jog(from, start), ...walkRing(start, exit, inner), exit, outside, ...jog(outside, to)])
}

/** Orthogonal service route: along the cold-room walls at one inset, through a single sleeve. */
export function routeServiceLine(from, to, rooms, lane = 0) {
  const inset = 0.3 + (Number(lane) || 0) * 0.16
  const fromRoom = hostRoom(rooms, from)
  const toRoom = hostRoom(rooms, to)
  const cold = [fromRoom, toRoom].find((room) => room && isRefrigerated(room.type))
  let points
  if (cold && fromRoom === cold && toRoom !== cold) points = routeAlongWalls(from, to, cold, inset)
  else if (cold && toRoom === cold && fromRoom !== cold) points = routeAlongWalls(to, from, cold, inset).reverse()
  else if (fromRoom && fromRoom === toRoom) points = routeAlongWalls(from, to, fromRoom, inset)
  else if (fromRoom && fromRoom !== toRoom) points = routeAlongWalls(from, to, fromRoom, inset)
  else if (toRoom) points = routeAlongWalls(to, from, toRoom, inset).reverse()
  else points = manhattan(from, to, rooms)
  return insertSleeves(dedupe(points), rooms)
}

function insertSleeves(points, rooms) {
  const out = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    if (!out.length) out.push({ ...a })
    const hits = []
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    for (const room of rooms || []) {
      const poly = outlinePoints(room)
      for (let e = 0; e < poly.length; e += 1) {
        const t = crossT(a, b, poly[e], poly[(e + 1) % poly.length])
        if (t != null) hits.push(t)
      }
    }
    hits.sort((m, n) => m - n)
    let last = -1
    hits.forEach((t) => {
      if (t - last < 0.04) return
      last = t
      const dt = Math.min(0.12, len * 0.15) / len
      out.push({
        x: a.x + (b.x - a.x) * Math.max(0.03, t - dt),
        z: a.z + (b.z - a.z) * Math.max(0.03, t - dt),
        sleeve: true,
      })
      out.push({
        x: a.x + (b.x - a.x) * Math.min(0.97, t + dt),
        z: a.z + (b.z - a.z) * Math.min(0.97, t + dt),
        sleeve: true,
      })
    })
    out.push({ ...b })
  }
  return dedupe(out)
}

function portHeight(room, eq) {
  const base = resolvedElevation(room, eq)
  const h = eq.height || 0.4
  if (eq.category === 'evaporator') return base + h * 0.42
  if (eq.category === 'combo' || eq.category === 'unit') return base + comboBody(eq).height / 3
  return base + Math.min(0.55, h * 0.4)
}

function routePorts(from, to, rooms, fromY, toY, lane = 0) {
  const flat = routeServiceLine(from, to, rooms, lane)
  const host = hostRoom(rooms, from) || hostRoom(rooms, to)
  const ceiling = Math.max(fromY, toY, host ? internalCeiling(host) - 0.22 : 2.2)
  const points = stampServiceHeights(flat, fromY, toY, ceiling)
  const rise = toY - fromY
  if (Math.abs(rise) > 0.3 && points.length) {
    const index = rise >= 0 ? 0 : points.length - 1
    points[index] = { ...points[index], riser: true, vertical: rise >= 0 ? 'nousu' : 'lasku' }
  }
  return { points, riseM: Math.max(0, rise) }
}

function dedupe3(points) {
  const out = []
  points.forEach((point) => {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.z - point.z) < 0.03 && Math.abs((prev.y || 0) - (point.y || 0)) < 0.03) return
    out.push({ ...point })
  })
  return out
}

/** Ceiling run with a vertical rise at the evaporator and a vertical drop at the valve. */
export function stampServiceHeights(points, fromY, toY, ceiling) {
  if (!points.length) return []
  const high = Math.max(ceiling, fromY, toY)
  const body = points.map((point, index) => ({
    ...point,
    y: index === 0 ? fromY : index === points.length - 1 ? toY : high,
  }))
  const out = []
  body.forEach((point, index) => {
    if (!index) {
      out.push(point)
      return
    }
    const prev = out[out.length - 1]
    const dx = point.x - prev.x
    const dz = point.z - prev.z
    const dy = point.y - prev.y
    const travel = Math.hypot(dx, dz) >= 0.02
    if (!travel) {
      out.push(point)
      return
    }
    const y = Math.max(prev.y, point.y)
    if (Math.abs(prev.y - y) > 0.04) out.push({ x: prev.x, z: prev.z, y })
    if (Math.abs(dx) >= 0.02 && Math.abs(dz) >= 0.02) out.push({ x: point.x, z: prev.z, y })
    if (Math.abs(point.y - y) > 0.04 || Math.abs(dy) > 0.04) out.push({ x: point.x, z: point.z, y })
    out.push(point)
  })
  return dedupe3(out)
}

/**
 * One ceiling run, one 90° turn, one straight penetration.
 * Liquid is the same polyline shifted along the wall by `gap`.
 */
function buildServicePair(evapSuction, valveSuction, evapLiquid, valveLiquid, room, evapY, valveY, gap, side) {
  const bounds = boundsOfRoom(room)
  const wall = nearestBoundary(valveSuction, bounds)
  const thick = room.wallThickness || 0.1
  const high = Math.max(evapY, valveY, internalCeiling(room) - 0.22)
  const alongX = Math.abs(wall.oz) > 0.5
  const spanPad = side ? 0.18 : 0.35
  const spanLo = (alongX ? bounds.minX : bounds.minZ) + spanPad
  const spanHi = (alongX ? bounds.maxX : bounds.maxZ) - spanPad
  const alongOf = (point) => (alongX ? point.x : point.z)
  const crossOf = (point) => (alongX ? point.z : point.x)
  const xz = (along, cross) => (alongX ? { x: along, z: cross } : { x: cross, z: along })
  const out = alongX ? wall.oz : wall.ox
  const wallCross = alongX ? wall.at.z : wall.at.x
  const sleeveCross = wallCross - out * (thick / 2)
  const evapAlong = alongOf(evapSuction)
  const evapCross = crossOf(evapSuction)
  // Offset across the ceiling run so the pair stays parallel through the sleeve.
  const liquidCross = evapCross + out * gap
  const alongShift = side ? (alongX ? side.x : side.z) : 0
  const beside = side && Math.abs(alongShift) > 0.5
  const limit = (value) => clamp(value, Math.min(spanLo, spanHi), Math.max(spanLo, spanHi))
  // Outdoor unit: drops stand just past the side panel, staggered so the pair stays apart,
  // then each turns 90° into its valve. Split systems still drop just outside the wall.
  const suctionDrop = beside
    ? xz(limit(alongOf(valveSuction) + alongShift * 0.16), crossOf(valveSuction))
    : xz(limit(alongOf(valveSuction)), wallCross + out * 0.04)
  const liquidDrop = beside
    ? xz(limit(alongOf(valveLiquid) + alongShift * 0.34), crossOf(valveLiquid))
    : xz(limit(alongOf(valveLiquid)), wallCross + out * 0.04)
  const suctionPlan = []
  const liquidForward = []
  const pushPlan = (list, along, cross) => {
    const point = xz(along, cross)
    const prev = list[list.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.z - point.z) < 0.02) return
    list.push(point)
  }
  pushPlan(suctionPlan, evapAlong, evapCross)
  pushPlan(suctionPlan, alongOf(suctionDrop), evapCross)
  pushPlan(suctionPlan, alongOf(suctionDrop), crossOf(suctionDrop))
  pushPlan(liquidForward, alongOf(evapLiquid), liquidCross)
  pushPlan(liquidForward, alongOf(liquidDrop), liquidCross)
  pushPlan(liquidForward, alongOf(liquidDrop), crossOf(liquidDrop))
  const plan = suctionPlan
  const liquidPlan = liquidForward.reverse()

  function reach(pts, target, y) {
    const prev = pts[pts.length - 1]
    if (Math.hypot(prev.x - target.x, prev.z - target.z) <= 0.03 && Math.abs((prev.y || 0) - y) <= 0.03) return
    if (Math.abs(prev.x - target.x) > 0.02 && Math.abs(prev.z - target.z) > 0.02) {
      pts.push({ x: target.x, z: prev.z, y: prev.y })
    }
    pts.push({ x: target.x, z: target.z, y })
  }

  function elevate(source, from, to, fromY, toY) {
    const pts = [{ x: from.x, z: from.z, y: fromY }]
    const start = source[0]
    reach(pts, start, fromY)
    if (Math.abs(high - fromY) > 0.03) pts.push({ x: start.x, z: start.z, y: high })
    source.forEach((point, index) => {
      if (index > 0) {
        const before = source[index - 1]
        const prevCross = crossOf(before)
        const nextCross = crossOf(point)
        if ((prevCross - sleeveCross) * (nextCross - sleeveCross) <= 0 && Math.abs(nextCross - prevCross) > 0.04) {
          const sleeve = xz(alongOf(point), sleeveCross)
          pts.push({ x: sleeve.x, z: sleeve.z, y: high, sleeve: true, sox: wall.ox, soz: wall.oz })
        }
        pts.push({ x: point.x, z: point.z, y: high })
      }
    })
    const end = source[source.length - 1]
    if (Math.abs(toY - high) > 0.03) pts.push({ x: end.x, z: end.z, y: toY })
    reach(pts, to, toY)
    return dedupe3(pts)
  }

  const suction = elevate(plan, evapSuction, valveSuction, evapY, valveY)
  const liquid = elevate(liquidPlan, valveLiquid, evapLiquid, valveY, evapY)
  return { suction, liquid, high }
}

/**
 * High-level fall to a sleeve beside the refrigerant penetration, then a vertical
 * drop outside into a trap. The open end sits 300 mm above the ground.
 * `beside` is the outer refrigerant drop, with sx/sz pointing out of the service side.
 */
function routeHighDrain(port, room, stubY, beside) {
  const bounds = boundsOfRoom(room)
  const anchor = beside || port
  const wall = nearestBoundary(anchor, bounds)
  const thick = room.wallThickness || 0.1
  const slope = 0.015
  const alongX = Math.abs(wall.oz) > 0.5
  const out = alongX ? wall.oz : wall.ox
  const wallCross = alongX ? wall.at.z : wall.at.x
  const spanLo = (alongX ? bounds.minX : bounds.minZ) + 0.18
  const spanHi = (alongX ? bounds.maxX : bounds.maxZ) - 0.18
  const alongOf = (point) => (alongX ? point.x : point.z)
  const crossOf = (point) => (alongX ? point.z : point.x)
  const xz = (along, cross) => (alongX ? { x: along, z: cross } : { x: cross, z: along })
  let drainAlong = alongOf(anchor)
  if (beside) {
    const shift = alongX ? beside.sx || 0 : beside.sz || 0
    const sign = Math.abs(shift) > 0.2 ? Math.sign(shift) : (drainAlong >= (spanLo + spanHi) / 2 ? 1 : -1)
    drainAlong = clamp(drainAlong + sign * 0.2, Math.min(spanLo, spanHi), Math.max(spanLo, spanHi))
  }
  const insideCross = wallCross - out * 0.04
  const sleeveCross = wallCross - out * (thick / 2)
  const lipCross = wallCross + out * 0.1
  const raw = []
  const push = (along, cross) => {
    const point = xz(along, cross)
    const prev = raw[raw.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.z - point.z) < 0.02) return
    raw.push(point)
  }
  push(alongOf(port), crossOf(port))
  push(alongOf(port), insideCross)
  push(drainAlong, insideCross)
  const sleeve = xz(drainAlong, sleeveCross)
  push(drainAlong, sleeveCross)
  push(drainAlong, lipCross)
  let y = stubY
  let prev = null
  const high = raw.map((point) => {
    if (!prev) {
      prev = point
      return { ...point, y: stubY }
    }
    const dist = Math.hypot(point.x - prev.x, point.z - prev.z)
    y -= slope * dist
    prev = point
    const next = { ...point, y }
    if (Math.hypot(point.x - sleeve.x, point.z - sleeve.z) < 0.02) {
      next.sleeve = true
      next.sox = wall.ox
      next.soz = wall.oz
    }
    return next
  })
  const exit = high[high.length - 1]
  const outletY = 0.3
  const belly = 0.08
  const ax = -wall.oz
  const az = wall.ox
  const knee = { x: exit.x + ax * 0.24, z: exit.z + az * 0.24 }
  const mouth = { x: knee.x + wall.ox * 0.2, z: knee.z + wall.oz * 0.2 }
  high.push({ x: exit.x, z: exit.z, y: outletY })
  high.push({ x: exit.x, z: exit.z, y: belly })
  high.push({ x: knee.x, z: knee.z, y: belly })
  high.push({ x: knee.x, z: knee.z, y: outletY })
  high.push({ x: mouth.x, z: mouth.z, y: outletY })
  return dedupe3(high)
}

function supportXYZ(point) {
  if (Array.isArray(point)) return { x: point[0], y: point[1] || 0, z: point[2] }
  return { x: point.x, y: point.y || 0, z: point.z }
}

function insideEnvelope(rooms, x, z) {
  return (rooms || []).some((room) => pointInOutline(x, z, outlinePoints(room)))
}

function nearestWallAim(rooms, x, z) {
  let best = null
  for (const room of rooms || []) {
    const poly = outlinePoints(room)
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const l2 = dx * dx + dz * dz || 1
      let t = ((x - a.x) * dx + (z - a.z) * dz) / l2
      t = Math.max(0, Math.min(1, t))
      const px = a.x + dx * t
      const pz = a.z + dz * t
      const dist = Math.hypot(px - x, pz - z)
      if (!best || dist < best.dist) {
        const len = dist || 1
        best = { nx: (px - x) / len, nz: (pz - z) / len }
      }
    }
  }
  return best || { nx: 0, nz: 1 }
}

/** Ceiling rods only under the roof, inside the room. Outdoor verticals get wall clips. */
export function pipeSupports(points, rooms) {
  const hangers = []
  const wallClips = []
  const list = points || []
  for (let i = 1; i < list.length; i += 1) {
    const a = supportXYZ(list[i - 1])
    const b = supportXYZ(list[i])
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const horiz = Math.hypot(dx, dz)
    const vert = Math.abs(dy)
    if (horiz >= 0.42 && vert <= 0.08) {
      const count = Math.max(1, Math.round(horiz / 0.72))
      for (let step = 1; step <= count; step += 1) {
        const t = step / (count + 1)
        const x = a.x + dx * t
        const y = a.y + dy * t
        const z = a.z + dz * t
        if (insideEnvelope(rooms, x, z)) hangers.push({ x, y, z })
      }
    }
    if (vert >= 0.35 && horiz < 0.08) {
      const count = Math.max(1, Math.min(3, Math.round(vert / 0.55)))
      for (let step = 1; step <= count; step += 1) {
        const t = step / (count + 1)
        const x = a.x + dx * t
        const y = a.y + dy * t
        const z = a.z + dz * t
        if (insideEnvelope(rooms, x, z)) continue
        const aim = nearestWallAim(rooms, x, z)
        wallClips.push({ x, y, z, nx: aim.nx, nz: aim.nz })
      }
    }
  }
  return { hangers, wallClips }
}

export function outdoorMoves(rooms) {
  const moves = []
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      if (!isOutdoorCategory(eq.category)) continue
      const wx = room.x + eq.x
      const wz = room.z + eq.z
      if (!insideRefrigerated(rooms, wx, wz)) continue
      const snapped = snapOutdoorUnit(rooms, eq, wx, wz, { mount: eq.mount === 'roof' ? 'roof' : 'wall' })
      if (insideRefrigerated(rooms, snapped.x, snapped.z)) continue
      moves.push({
        roomId: room.id,
        eqId: eq.id,
        name: eq.name || 'Ulkoyksikkö',
        x: snapped.x,
        z: snapped.z,
        rotation: snapped.rotation,
        mount: snapped.mount,
        elevation: snapped.elevation,
      })
    }
  }
  return moves
}

export function drainOutlet(room, port) {
  const poly = outlinePoints(room)
  let best = null
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const l2 = dx * dx + dz * dz || 1
    let t = ((port.x - a.x) * dx + (port.z - a.z) * dz) / l2
    t = Math.max(0.08, Math.min(0.92, t))
    const x = a.x + dx * t
    const z = a.z + dz * t
    const dist = Math.hypot(x - port.x, z - port.z)
    let ox = -dz
    let oz = dx
    const olen = Math.hypot(ox, oz) || 1
    ox /= olen
    oz /= olen
    if (ox * (x - room.x) + oz * (z - room.z) < 0) {
      ox = -ox
      oz = -oz
    }
    if (!best || dist < best.dist) best = { dist, x, z, ox, oz }
  }
  const thick = room.wallThickness || 0.1
  return {
    x: best.x + best.ox * (thick + 0.7),
    z: best.z + best.oz * (thick + 0.7),
  }
}

function collect(rooms) {
  const evaps = []
  const units = []
  const compressors = []
  const condensers = []
  for (const room of rooms || []) {
    for (const eq of room.equipment || []) {
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      const row = { room, eq, ports }
      if (eq.category === 'evaporator') evaps.push(row)
      else if (eq.category === 'combo' || eq.category === 'unit') units.push(row)
      else if (eq.category === 'compressor') compressors.push(row)
      else if (eq.category === 'condenser') condensers.push(row)
    }
  }
  return { evaps, units, compressors, condensers }
}

function nearestMachine(evap, machines) {
  const origin = evap.ports.suction
  let best = null
  machines.forEach((machine) => {
    const dist = Math.hypot(machine.ports.suction.x - origin.x, machine.ports.suction.z - origin.z)
    if (!best || dist < best.dist) best = { machine, dist }
  })
  return best?.machine || null
}

function pipeRecord(id, fields, rooms) {
  const host = fields.roomTempC
  return {
    id,
    auto: true,
    refrigerant: 'R449A',
    teC: -8,
    tcC: 40,
    roomTempC: host ?? 2,
    ...fields,
  }
}

export function autoCircuit(rooms, options = {}) {
  const nextId = options.id || (() => `pipe-${Math.random().toString(36).slice(2, 9)}`)
  const refrigerant = options.refrigerant || 'R449A'
  const teC = options.teC ?? -8
  const tcC = options.tcC ?? 40
  const { evaps, units, compressors, condensers } = collect(rooms)
  if (!evaps.length) return { ok: false, hint: 'Sijoita ensin höyrystin.', pipes: [] }
  const racks = []
  compressors.forEach((compressor) => {
    let condenser = null
    condensers.forEach((item) => {
      const dist = Math.hypot(item.ports.hotgas.x - compressor.ports.discharge.x, item.ports.hotgas.z - compressor.ports.discharge.z)
      if (!condenser || dist < condenser.dist) condenser = { item, dist }
    })
    if (condenser) racks.push({ ...compressor, condenser: condenser.item })
  })
  const machines = [
    ...units.map((unit) => ({ type: 'unit', suction: unit.ports.suction, row: unit })),
    ...racks.map((rack) => ({ type: 'rack', suction: rack.ports.suction, row: rack })),
  ]
  const moves = outdoorMoves(rooms)
  if (moves.length && !options.ignorePlacement) {
    const names = [...new Set(moves.map((move) => move.name))].join(', ')
    return {
      ok: false,
      hint: `${names} on kylmähuoneen sisällä. Siirrä ulkoseinälle ennen putkitusta. Putkea ei vedetä huoneen poikki.`,
      offerMove: true,
      moves,
      pipes: [],
    }
  }
  if (!machines.length) {
    return {
      ok: false,
      hint: condensers.length && !compressors.length
        ? 'Kaukoylauhdutin tarvitsee kompressoriyksikön, jossa on vastaanotin.'
        : 'Sijoita koneikko tai kompressori ja erillinen lauhdutin.',
      pipes: [],
    }
  }
  const groups = new Map()
  evaps.forEach((evap) => {
    const machine = nearestMachine(evap, machines.map((item) => ({ ports: { suction: item.suction }, ref: item })))
    const key = machine.ref.type === 'unit' ? `unit:${machine.ref.row.eq.id}` : `rack:${machine.ref.row.eq.id}`
    if (!groups.has(key)) groups.set(key, { machine: machine.ref, evaps: [] })
    groups.get(key).evaps.push(evap)
  })
  const pipes = []
  groups.forEach((group) => {
    const { machine } = group
    group.evaps.forEach((evap, index) => {
      const lane = index - (group.evaps.length - 1) / 2
      const valveY = portHeight(machine.row.room, machine.row.eq)
      const evapY = portHeight(evap.room, evap.eq)
      const liquidPort = machine.type === 'unit' ? machine.row.ports.liquid : machine.row.ports.liquidOut
      const side = machine.type === 'unit' ? serviceSide(machine.row.eq) : null
      const pair = isRefrigerated(evap.room.type)
        ? buildServicePair(evap.ports.suction, machine.suction, evap.ports.liquid, liquidPort, evap.room, evapY, valveY, 0.16 + lane * 0.05, side)
        : null
      const suctionPoints = pair
        ? pair.suction
        : routePorts(evap.ports.suction, machine.suction, rooms, evapY, valveY, lane).points
      pipes.push(pipeRecord(nextId(), {
        kind: 'suction',
        segment: null,
        points: suctionPoints,
        riseM: Math.max(0, valveY - evapY),
        refrigerant, teC, tcC,
        roomTempC: evap.room.temp,
        fromName: evap.eq.name,
        toName: machine.row.eq.name,
      }))
      const liquidPoints = pair
        ? pair.liquid
        : routePorts(liquidPort, evap.ports.liquid, rooms, valveY, evapY, lane + 1).points
      pipes.push(pipeRecord(nextId(), {
        kind: 'liquid',
        segment: 'supply',
        points: liquidPoints,
        riseM: Math.max(0, evapY - valveY),
        refrigerant, teC, tcC,
        roomTempC: evap.room.temp,
        fromName: machine.type === 'unit' ? `${machine.row.eq.name} (näkölasi)` : `${machine.row.eq.name} (näkölasi)`,
        toName: evap.eq.name,
      }))
      const panY = resolvedElevation(evap.room, evap.eq) + 0.045
      const drainBeside = side ? {
        x: machine.suction.x + side.x * 0.34,
        z: machine.suction.z + side.z * 0.34,
        sx: side.x,
        sz: side.z,
      } : null
      const drainPoints = routeHighDrain(evap.ports.drain, evap.room, panY, drainBeside)
      pipes.push(pipeRecord(nextId(), {
        kind: 'drain',
        segment: null,
        points: dedupe3(drainPoints),
        riseM: 0,
        refrigerant, teC, tcC,
        roomTempC: evap.room.temp,
        fromName: evap.eq.name,
        toName: 'Viemäri',
      }))
    })
    if (machine.type === 'rack') {
      const compressor = machine.row
      const condenser = compressor.condenser
      const hot = routePorts(
        compressor.ports.discharge,
        condenser.ports.hotgas,
        rooms,
        portHeight(compressor.room, compressor.eq),
        portHeight(condenser.room, condenser.eq),
        0,
      )
      pipes.push(pipeRecord(nextId(), {
        kind: 'hotgas',
        segment: null,
        points: hot.points,
        riseM: hot.riseM,
        refrigerant, teC, tcC,
        roomTempC: compressor.room.temp ?? 20,
        fromName: compressor.eq.name,
        toName: condenser.eq.name,
      }))
      const back = routePorts(
        condenser.ports.liquid,
        compressor.ports.liquidIn,
        rooms,
        portHeight(condenser.room, condenser.eq),
        portHeight(compressor.room, compressor.eq),
        0.8,
      )
      pipes.push(pipeRecord(nextId(), {
        kind: 'liquid',
        segment: 'return',
        points: back.points,
        riseM: back.riseM,
        refrigerant, teC, tcC,
        roomTempC: compressor.room.temp ?? 20,
        fromName: condenser.eq.name,
        toName: `${compressor.eq.name} (vastaanotin)`,
      }))
    }
  })
  const hot = pipes.filter((pipe) => pipe.kind === 'hotgas').length
  const notice = hot
    ? 'Piiri luotiin: imu höyrystimeltä kompressorille, kuumakaasu lauhduttimelle, neste lauhduttimelta vastaanottimeen ja vastaanottimelta höyrystimelle. Vastaanotin, kuivain ja näkölasi ovat kompressoriyksikön sisällä.'
    : 'Koneikkopiiri luotiin: imu höyrystimeltä koneikolle ja neste koneikolta höyrystimelle. Kuumakaasu, vastaanotin, kuivain ja näkölasi ovat koneikon sisällä.'
  return { ok: true, pipes, notice, hint: '' }
}
