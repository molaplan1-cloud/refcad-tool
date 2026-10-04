// What the Pohjakuva sheet draws. Saved on the plan and on each printed sheet.

export const DISPLAY_PRESETS = {
  plain: {
    preset: 'plain',
    dims: { overall: true, room: false, openings: false, internal: false },
    roomNames: true,
    areas: false,
    openingSizes: false,
    structures: false,
    fixtures: false,
  },
  measure: {
    preset: 'measure',
    dims: { overall: true, room: true, openings: true, internal: false },
    roomNames: true,
    areas: true,
    openingSizes: false,
    structures: false,
    fixtures: true,
  },
  all: {
    preset: 'all',
    dims: { overall: true, room: true, openings: true, internal: true },
    roomNames: true,
    areas: true,
    openingSizes: true,
    structures: true,
    fixtures: true,
  },
}

const ABBREV = {
  Kylpyhuone: 'KPH',
  Sauna: 'S',
  Makuuhuone: 'MH',
  Olohuone: 'OH',
  Keittiö: 'K',
  Eteinen: 'ET',
  Kodinhoitohuone: 'KHH',
  Autotalli: 'AT',
  Varasto: 'VA',
  Työhuone: 'TH',
  WC: 'WC',
}

function copyDisplay(source) {
  return {
    preset: source.preset,
    dims: { ...source.dims },
    roomNames: source.roomNames,
    areas: source.areas,
    openingSizes: source.openingSizes,
    structures: source.structures,
    fixtures: source.fixtures,
  }
}

export function normalizeDisplay(stored) {
  if (!stored) return copyDisplay(DISPLAY_PRESETS.measure)
  const base = stored.preset && DISPLAY_PRESETS[stored.preset]
    ? DISPLAY_PRESETS[stored.preset]
    : DISPLAY_PRESETS.measure
  return {
    preset: stored.preset || 'custom',
    dims: {
      overall: stored.dims?.overall ?? base.dims.overall,
      room: stored.dims?.room ?? base.dims.room,
      openings: stored.dims?.openings ?? base.dims.openings,
      internal: stored.dims?.internal ?? base.dims.internal,
    },
    roomNames: stored.roomNames ?? base.roomNames,
    areas: stored.areas ?? base.areas,
    openingSizes: stored.openingSizes ?? base.openingSizes,
    structures: stored.structures ?? base.structures,
    fixtures: stored.fixtures ?? base.fixtures,
  }
}

export function applyDisplay(plan, patch, sheet = 'plan') {
  const current = normalizeDisplay(plan?.sheetDisplay?.[sheet] || plan?.display)
  const next = patch.preset && DISPLAY_PRESETS[patch.preset]
    ? copyDisplay(DISPLAY_PRESETS[patch.preset])
    : {
      ...current,
      ...patch,
      dims: { ...current.dims, ...(patch.dims || {}) },
      preset: 'custom',
    }
  return {
    ...plan,
    display: next,
    sheetDisplay: { ...(plan?.sheetDisplay || {}), [sheet]: next },
  }
}

export function dimensionMode(display) {
  const dims = normalizeDisplay(display).dims
  const flags = [dims.overall, dims.room, dims.openings, dims.internal]
  if (flags.every((flag) => !flag)) return 'none'
  if (flags.every(Boolean)) return 'all'
  if (dims.overall && dims.room && dims.openings && !dims.internal) return 'outside'
  if (dims.overall && !dims.room && !dims.openings && !dims.internal) return 'overall'
  return 'custom'
}

export function dimensionsFromMode(mode) {
  if (mode === 'none') return { overall: false, room: false, openings: false, internal: false }
  if (mode === 'overall') return { overall: true, room: false, openings: false, internal: false }
  if (mode === 'outside') return { overall: true, room: true, openings: true, internal: false }
  if (mode === 'all') return { overall: true, room: true, openings: true, internal: true }
  return null
}

function boundsOf(poly) {
  return poly.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

function centroidOf(poly) {
  const sum = poly.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
  return { x: sum.x / poly.length, z: sum.z / poly.length }
}

function pointSegmentDistance(x, z, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-12) return Math.hypot(x - a.x, z - a.z)
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2))
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
}

function obstacleClearance(x, z, obstacle) {
  if (obstacle.kind === 'route') {
    return pointSegmentDistance(x, z, { x: obstacle.x1, z: obstacle.z1 }, { x: obstacle.x2, z: obstacle.z2 })
  }
  const hw = (obstacle.w || 0.3) / 2
  const hh = (obstacle.h || 0.28) / 2
  const dx = Math.max(Math.abs(x - obstacle.x) - hw, 0)
  const dz = Math.max(Math.abs(z - obstacle.z) - hh, 0)
  if (dx === 0 && dz === 0) return -Math.min(hw - Math.abs(x - obstacle.x), hh - Math.abs(z - obstacle.z))
  return Math.hypot(dx, dz)
}

// Centre of the largest circle that fits in the room and clears devices.
// A concave room's centroid can sit on a wall; this point does not.
export function poleOfInaccessibility(polygon, obstacles = []) {
  if (!polygon || polygon.length < 3) return { x: 0, z: 0 }
  const box = boundsOf(polygon)
  const spanX = box.maxX - box.minX
  const spanZ = box.maxZ - box.minZ
  if (!(spanX > 0) || !(spanZ > 0)) return centroidOf(polygon)
  const target = centroidOf(polygon)
  let best = null
  const consider = (x, z) => {
    if (!pointInPolygon(x, z, polygon)) return
    let dist = Infinity
    for (let i = 0; i < polygon.length; i += 1) {
      dist = Math.min(dist, pointSegmentDistance(x, z, polygon[i], polygon[(i + 1) % polygon.length]))
    }
    obstacles.forEach((obstacle) => {
      dist = Math.min(dist, obstacleClearance(x, z, obstacle))
    })
    if (dist < 0) return
    const toward = Math.hypot(x - target.x, z - target.z)
    const better = !best
      || dist > best.dist + 0.015
      || (dist >= best.dist - 0.015 && toward < best.toward - 1e-4)
    if (better) best = { x, z, dist, toward }
  }
  let step = Math.max(0.04, Math.min(spanX, spanZ) / 24)
  for (let x = box.minX + step / 2; x < box.maxX; x += step) {
    for (let z = box.minZ + step / 2; z < box.maxZ; z += step) consider(x, z)
  }
  if (!best) return centroidOf(polygon)
  for (let pass = 0; pass < 3; pass += 1) {
    step /= 2
    const origin = best
    for (let x = origin.x - step * 3; x <= origin.x + step * 3; x += step) {
      for (let z = origin.z - step * 3; z <= origin.z + step * 3; z += step) consider(x, z)
    }
  }
  return { x: best.x, z: best.z }
}

function areaLabel(area) {
  return `${(Number(area) || 0).toFixed(1).replace('.', ',')} m²`
}

function blockSize(name, area, ratio) {
  const metres = ratio / 1000
  const nameW = name ? name.length * 3.5 * 0.55 * metres : 0
  const areaW = area ? area.length * 2.5 * 0.52 * metres : 0
  const gap = name && area ? 0.6 * metres : 0
  return {
    w: Math.max(0.28, nameW, areaW),
    h: (name ? 3.5 * metres : 0) + (area ? 2.5 * metres : 0) + gap,
  }
}

function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 0.08
    && Math.abs(a.z - b.z) < (a.h + b.h) / 2 + 0.06
}

const DEVICE_SHEET = {
  ahu: [42, 46],
  hood: [28, 20],
  silencer: [26, 16],
  valve: [18, 18],
  'outdoor-terminal': [18, 18],
  'exhaust-terminal': [18, 18],
  panel: [26, 22],
  manifold: [28, 16],
  'floor-manifold': [36, 22],
  'heat-source': [28, 20],
}

export function furnitureLabelObstacles(plan) {
  return (plan?.fixtures || [])
    .filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.z))
    .map((item) => {
      const w = Math.max(0.25, Number(item.w) || 0.6)
      const d = Math.max(0.25, Number(item.d) || 0.6)
      const turned = Math.round((((item.rotation || 0) % 180) + 180) % 180 / 90) % 2 === 1
      return { x: item.x, z: item.z, w: (turned ? d : w) + 0.08, h: (turned ? w : d) + 0.08, kind: 'furniture' }
    })
}

export function routeLabelObstacles(plan, pad = 0.14) {
  const layers = plan?.services?.layers || {}
  const routes = []
  ;(plan?.services?.runs || []).forEach((run) => {
    if (layers[run.system] === false) return
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      if (Math.hypot((b.x || 0) - (a.x || 0), (b.z || 0) - (a.z || 0)) < 0.05) continue
      routes.push({ kind: 'route', x1: a.x, z1: a.z, x2: b.x, z2: b.z, pad })
    }
  })
  return routes
}

export function labelObstacles(plan, ppm = 22) {
  return [
    ...heatingLabelObstacles(plan),
    ...deviceLabelObstacles(plan, ppm),
    ...furnitureLabelObstacles(plan),
    ...routeLabelObstacles(plan),
  ]
}

export function deviceLabelObstacles(plan, ppm = 22) {
  const scale = Math.max(8, Number(ppm) || 22)
  const layers = plan?.services?.layers || {}
  return (plan?.services?.nodes || [])
    .filter((node) => Number.isFinite(node?.x) && Number.isFinite(node?.z) && layers[node.system] !== false)
    .map((node) => {
      const [w, h] = DEVICE_SHEET[node.kind] || [18, 18]
      return { x: node.x, z: node.z, w: w / scale, h: h / scale }
    })
}

export function heatingLabelObstacles(plan) {
  if (plan?.services?.layers?.heat === false) return []
  return (plan?.services?.nodes || [])
    .filter((node) => node.system === 'heat' && (node.kind === 'floor-manifold' || node.kind === 'actuator' || node.kind === 'heat-source'))
    .map((node) => ({
      x: node.x,
      z: node.z,
      w: node.kind === 'actuator' ? 0.28 : 0.9,
      h: node.kind === 'actuator' ? 0.28 : (node.kind === 'heat-source' ? 0.62 : 0.42),
    }))
}

export function layoutRoomLabels(rooms, options = {}) {
  const ratio = options.ratio || 100
  const showNames = options.showNames !== false
  const showAreas = options.showAreas !== false
  if (!showNames && !showAreas) return []
  const items = (rooms || []).filter((room) => room?.showLabel !== false && (room.polygon || []).length >= 3).map((room) => {
    const box = boundsOf(room.polygon)
    const full = String(room.name || 'Huone')
    const short = ABBREV[full] || full
    const span = Math.min(box.maxX - box.minX, box.maxZ - box.minZ)
    const preferShort = short !== full && blockSize(full, showAreas ? areaLabel(room.area) : '', ratio).w > span * 0.72
    const text = showNames ? (preferShort ? short : full) : ''
    const area = showAreas ? areaLabel(room.area) : ''
    const size = blockSize(text, area, ratio)
    const pinned = Number.isFinite(room.lx) && Number.isFinite(room.lz)
    const center = pinned ? { x: room.lx, z: room.lz } : poleOfInaccessibility(room.polygon, options.obstacles || [])
    return {
      id: room.id,
      roomName: full,
      text,
      area,
      x: center.x,
      z: center.z,
      w: size.w,
      h: size.h,
      box,
      pinned,
      abbreviated: text !== full,
      leader: null,
      polygon: room.polygon,
    }
  })

  const clamp = (item) => {
    const minX = item.box.minX + Math.min(item.w / 2, (item.box.maxX - item.box.minX) / 2)
    const maxX = item.box.maxX - Math.min(item.w / 2, (item.box.maxX - item.box.minX) / 2)
    const minZ = item.box.minZ + Math.min(item.h / 2, (item.box.maxZ - item.box.minZ) / 2)
    const maxZ = item.box.maxZ - Math.min(item.h / 2, (item.box.maxZ - item.box.minZ) / 2)
    item.x = Math.min(maxX, Math.max(minX, item.x))
    item.z = Math.min(maxZ, Math.max(minZ, item.z))
  }

  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (!overlaps(items[i], items[j])) continue
        const small = (items[i].box.maxX - items[i].box.minX) * (items[i].box.maxZ - items[i].box.minZ)
          <= (items[j].box.maxX - items[j].box.minX) * (items[j].box.maxZ - items[j].box.minZ)
          ? items[i]
          : items[j]
        const other = small === items[i] ? items[j] : items[i]
        if (!small.abbreviated && ABBREV[small.roomName] && showNames) {
          small.text = ABBREV[small.roomName]
          small.abbreviated = true
          const size = blockSize(small.text, small.area, ratio)
          small.w = size.w
          small.h = size.h
          continue
        }
        if (small.pinned) continue
        const dx = small.x - other.x
        const dz = small.z - other.z
        if (Math.abs(dx) >= Math.abs(dz)) small.x += Math.sign(dx || 1) * 0.18
        else small.z += Math.sign(dz || 1) * 0.14
        clamp(small)
      }
    }
  }

  items.forEach((item, index) => {
    if (item.pinned) return
    const other = items.find((candidate, otherIndex) => otherIndex !== index && overlaps(item, candidate))
    if (!other) return
    const outward = item.x >= other.x ? 1 : -1
    item.leader = { x: item.x, z: item.z }
    item.x = outward > 0
      ? item.box.maxX + item.w / 2 + 0.12
      : item.box.minX - item.w / 2 - 0.12
  })

  dodgeObstacles(items, options.obstacles || [], clamp)

  return items.map(({ box, pinned, polygon, ...item }) => item)
}

function pointInPolygon(x, z, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const cross = ((a.z > z) !== (b.z > z)) && (x < ((b.x - a.x) * (z - a.z)) / ((b.z - a.z) || 1e-9) + a.x)
    if (cross) inside = !inside
  }
  return inside
}

function labelInside(item, x, z) {
  const polygon = item.polygon
  if (!polygon || polygon.length < 3) return true
  const hw = Math.max(0.04, item.w / 2 - 0.03)
  const hh = Math.max(0.04, item.h / 2 - 0.03)
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].every(([dx, dz]) => pointInPolygon(x + dx, z + dz, polygon))
}

function segmentHitsRect(x1, z1, x2, z2, left, top, right, bottom) {
  const inside = (x, z) => x >= left && x <= right && z >= top && z <= bottom
  if (inside(x1, z1) || inside(x2, z2)) return true
  const edges = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ]
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const det = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx)
    if (Math.abs(det) < 1e-9) return false
    const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / det
    const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / det
    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }
  return edges.some(([ax, az, bx, bz]) => cross(x1, z1, x2, z2, ax, az, bx, bz))
}

function obstacleHit(item, obstacle, x = item.x, z = item.z) {
  if (obstacle.kind === 'route') {
    const pad = obstacle.pad ?? 0.12
    return segmentHitsRect(
      obstacle.x1, obstacle.z1, obstacle.x2, obstacle.z2,
      x - item.w / 2 - pad, z - item.h / 2 - pad, x + item.w / 2 + pad, z + item.h / 2 + pad,
    )
  }
  return Math.abs(x - obstacle.x) < (item.w + (obstacle.w || 0.3)) / 2 + 0.12
    && Math.abs(z - obstacle.z) < (item.h + (obstacle.h || 0.28)) / 2 + 0.22
}

function touchesRoom(obstacle, box) {
  if (obstacle.kind === 'route') {
    return segmentHitsRect(
      obstacle.x1, obstacle.z1, obstacle.x2, obstacle.z2,
      box.minX - 0.2, box.minZ - 0.2, box.maxX + 0.2, box.maxZ + 0.2,
    )
  }
  const hw = (obstacle.w || 0.3) / 2
  const hh = (obstacle.h || 0.28) / 2
  return obstacle.x + hw >= box.minX - 0.2 && obstacle.x - hw <= box.maxX + 0.2
    && obstacle.z + hh >= box.minZ - 0.2 && obstacle.z - hh <= box.maxZ + 0.2
}

function dodgeObstacles(items, obstacles, clamp) {
  if (!obstacles.length) return
  items.forEach((item) => {
    if (item.pinned) return
    const crowd = obstacles.filter((obstacle) => touchesRoom(obstacle, item.box))
    if (!crowd.length) return
    const spanX = item.box.maxX - item.box.minX
    const spanZ = item.box.maxZ - item.box.minZ
    const spots = [{ x: item.x, z: item.z }]
    ;[0.16, 0.3, 0.44, 0.58, 0.72, 0.86].forEach((fx) => {
      ;[0.18, 0.34, 0.5, 0.66, 0.82].forEach((fz) => {
        spots.push({ x: item.box.minX + spanX * fx, z: item.box.minZ + spanZ * fz })
      })
    })
    const others = items.filter((other) => other !== item)
    const origin = { x: item.x, z: item.z }
    const ranked = spots.map((spot) => {
      item.x = spot.x
      item.z = spot.z
      clamp(item)
      const placed = { x: item.x, z: item.z }
      const hits = crowd.filter((obstacle) => obstacleHit(item, obstacle, placed.x, placed.z)).length
        + (others.some((other) => overlaps({ ...item, x: placed.x, z: placed.z }, other)) ? 1 : 0)
      item.x = origin.x
      item.z = origin.z
      return {
        ...placed,
        hits,
        inside: labelInside(item, placed.x, placed.z),
        dist: Math.hypot(placed.x - origin.x, placed.z - origin.z),
      }
    }).sort((a, b) => Number(b.inside) - Number(a.inside) || a.hits - b.hits || a.dist - b.dist)
    const best = ranked[0]
    if (!best) return
    item.x = best.x
    item.z = best.z
    item.halo = best.hits > 0
  })
}
