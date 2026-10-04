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
    const center = pinned ? { x: room.lx, z: room.lz } : centroidOf(room.polygon)
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

  return items.map(({ box, pinned, ...item }) => item)
}

function obstacleHit(item, obstacle, x = item.x, z = item.z) {
  return Math.abs(x - obstacle.x) < (item.w + (obstacle.w || 0.3)) / 2 + 0.06
    && Math.abs(z - obstacle.z) < (item.h + (obstacle.h || 0.28)) / 2 + 0.05
}

function dodgeObstacles(items, obstacles, clamp) {
  if (!obstacles.length) return
  items.forEach((item) => {
    if (item.pinned) return
    const crowd = obstacles.filter((obstacle) => (
      obstacle.x >= item.box.minX - 0.25 && obstacle.x <= item.box.maxX + 0.25
      && obstacle.z >= item.box.minZ - 0.25 && obstacle.z <= item.box.maxZ + 0.25
    ))
    if (!crowd.length || !crowd.some((obstacle) => obstacleHit(item, obstacle))) return
    const spanX = item.box.maxX - item.box.minX
    const spanZ = item.box.maxZ - item.box.minZ
    const spots = []
    ;[0.12, 0.24, 0.4, 0.58, 0.76, 0.88].forEach((fx) => {
      ;[0.14, 0.32, 0.5, 0.68, 0.86].forEach((fz) => {
        spots.push({ x: item.box.minX + spanX * fx, z: item.box.minZ + spanZ * fz })
      })
    })
    const others = items.filter((other) => other !== item)
    const blocked = (x, z) => crowd.some((obstacle) => obstacleHit(item, obstacle, x, z))
      || others.some((other) => overlaps({ ...item, x, z }, other))
    const ranked = spots
      .map((spot) => ({
        ...spot,
        hits: crowd.filter((obstacle) => obstacleHit(item, obstacle, spot.x, spot.z)).length,
        clear: Math.min(...crowd.map((obstacle) => Math.hypot(spot.x - obstacle.x, spot.z - obstacle.z))),
        dist: Math.hypot(spot.x - item.x, spot.z - item.z),
      }))
      .sort((a, b) => a.hits - b.hits || a.dist - b.dist || b.clear - a.clear)
    const origin = { x: item.x, z: item.z }
    for (const spot of ranked) {
      item.x = spot.x
      item.z = spot.z
      clamp(item)
      if (!blocked(item.x, item.z)) return
    }
    item.x = origin.x
    item.z = origin.z
  })
}
