export const WATER_POINTS = [
  { id: 'sink', name: 'Allas', supply: 'both', flowCold: 0.2, flowHot: 0.2 },
  { id: 'basin', name: 'Pesuallas', supply: 'both', flowCold: 0.1, flowHot: 0.1 },
  { id: 'shower', name: 'Suihku', supply: 'both', flowCold: 0.2, flowHot: 0.2 },
  { id: 'bath', name: 'Kylpyamme', supply: 'both', flowCold: 0.3, flowHot: 0.3 },
  { id: 'wc', name: 'WC', supply: 'cold', flowCold: 0.1, flowHot: 0 },
  { id: 'washer', name: 'Pesukone', supply: 'cold', flowCold: 0.2, flowHot: 0 },
  { id: 'dishwasher', name: 'Astianpesukone', supply: 'cold', flowCold: 0.2, flowHot: 0 },
  { id: 'outdoor', name: 'Puutarhahana', supply: 'cold', flowCold: 0.2, flowHot: 0 },
  { id: 'well', name: 'Kaivo', supply: 'cold', flowCold: 0.2, flowHot: 0 },
  { id: 'rainwell', name: 'Sadevesikaivo', supply: 'cold', flowCold: 0.05, flowHot: 0 },
  { id: 'drain-link', name: 'Lattiakaivon kytkentä', supply: 'cold', flowCold: 0, flowHot: 0 },
]

export const HEAT_SOURCES = [
  { id: 'district', name: 'Kaukolämpö', voltage: 230, power: 150, electricKind: 'heatpump', cosPhi: 0.9 },
  { id: 'ground', name: 'Maalämpöpumppu', voltage: 400, power: 6000, electricKind: 'heatpump', cosPhi: 0.9, borehole: true },
  { id: 'air-water', name: 'Ilma-vesilämpöpumppu', voltage: 400, power: 5000, electricKind: 'heatpump', cosPhi: 0.9 },
  { id: 'direct-electric', name: 'Suora sähkö', voltage: 230, power: 0, electricKind: null, cosPhi: 1 },
  { id: 'oil', name: 'Öljykattila', voltage: 230, power: 400, electricKind: 'boiler', cosPhi: 1 },
  { id: 'pellet', name: 'Pelletti- tai puukattila', voltage: 230, power: 900, electricKind: 'boiler', cosPhi: 0.9 },
]

export const AIR_AIR = { name: 'Ilmalämpöpumppu', voltage: 230, power: 1500, electricKind: 'heatpump', cosPhi: 0.9 }

const WATTS = {
  olohuone: 40,
  makuuhuone: 35,
  keittio: 45,
  kylpyhuone: 60,
  wc: 50,
  sauna: 20,
  kodinhoitohuone: 45,
  eteinen: 30,
  tekninen: 25,
}

export function waterPointSpec(id) {
  return WATER_POINTS.find((item) => item.id === id) || WATER_POINTS[0]
}

export function sourceSpec(id) {
  return HEAT_SOURCES.find((item) => item.id === id) || HEAT_SOURCES[0]
}

export function normalizeHeating(plan) {
  return {
    source: 'district',
    distribution: 'floor',
    buffer: false,
    bufferLitres: 300,
    dhw: 'tank',
    dhwLitres: 300,
    dhwMode: 'electric',
    loopSpacing: 0.3,
    supplementAir: false,
    borehole: true,
    radiatorsSeeded: false,
    ...(plan?.heating || {}),
  }
}

export function pexSize(flowLs) {
  const flow = Math.max(0, Number(flowLs) || 0)
  if (flow <= 0.25) return 16
  if (flow <= 0.5) return 20
  if (flow <= 1) return 25
  if (flow <= 1.8) return 32
  return 40
}

export function heatFlowLs(powerW, deltaT = 10) {
  const power = Math.max(0, Number(powerW) || 0)
  const rise = Math.max(1, Number(deltaT) || 10)
  return power / (4180 * rise)
}

export function roomHeatLoss(area, kind) {
  const watts = WATTS[kind] || 40
  const power = Math.round(Math.max(0, Number(area) || 0) * watts)
  return { wattsPerM2: watts, power }
}

export function tankElectric(litres, mode) {
  if (mode !== 'electric') return { voltage: 230, power: 80, electricKind: 'boiler', name: 'LV-kierto', cosPhi: 1 }
  if (Number(litres) >= 200) return { voltage: 400, power: 6000, electricKind: 'boiler', name: 'Lämminvesivaraaja', cosPhi: 1 }
  return { voltage: 230, power: 3000, electricKind: 'boiler', name: 'Lämminvesivaraaja', cosPhi: 1 }
}

export const HEATING_METHODS = [
  { id: 'none', name: 'Ei lämmitystä' },
  { id: 'efloor', name: 'Sähköinen lattialämmitys' },
  { id: 'wfloor', name: 'Vesikiertoinen lattialämmitys' },
  { id: 'erad', name: 'Sähköpatterit' },
  { id: 'wrad', name: 'Vesipatterit' },
  { id: 'ceiling', name: 'Kattolämmitys' },
]

export const LOOP_SPACINGS = [0.1, 0.15, 0.2, 0.3]

const METHOD_IDS = new Set(HEATING_METHODS.map((item) => item.id))

const FLOOR_BLOCKS = new Set([
  'cabinet', 'wall-cab', 'sink', 'stove', 'oven', 'fridge', 'freezer', 'fridge-freezer',
  'dishwasher', 'island', 'shower', 'bath', 'spa', 'vanity', 'wardrobe', 'bench',
  'hall-cab', 'clean-cab', 'dry-cabinet', 'wc-store',
])

const WET_KINDS = new Set(['wc', 'kylpyhuone', 'sauna', 'kodinhoitohuone'])

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function roundMm(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function pointInPoly(x, z, points) {
  let inside = false
  for (let i = 0, j = (points || []).length - 1; i < (points || []).length; j = i, i += 1) {
    const a = points[i]
    const b = points[j]
    const hit = ((a.z > z) !== (b.z > z)) && (x < ((b.x - a.x) * (z - a.z)) / ((b.z - a.z) || 1e-9) + a.x)
    if (hit) inside = !inside
  }
  return inside
}

export function normalizeRoomHeating(room) {
  const raw = room?.heating
  if (!raw || typeof raw !== 'object') return null
  const methods = (Array.isArray(raw.methods) ? raw.methods : [])
    .map((item) => String(item))
    .filter((item) => METHOD_IDS.has(item))
  if (!methods.length) return null
  const spacing = Number(raw.spacing)
  const watts = Number(raw.wattsPerM2)
  return {
    methods,
    spacing: LOOP_SPACINGS.includes(spacing) ? spacing : 0.15,
    pattern: raw.pattern === 'spiral' ? 'spiral' : 'serpentine',
    wattsPerM2: Number.isFinite(watts) && watts > 0 ? watts : null,
  }
}

export function floorHeatDensity(kind, override) {
  if (Number(override) > 0) return Math.round(Number(override))
  return WET_KINDS.has(kind) ? 140 : 100
}

export function heatingObstacles(room, fixtures = []) {
  const poly = room?.polygon || []
  return (fixtures || []).flatMap((fixture) => {
    if (!fixture || fixture.hidden || !FLOOR_BLOCKS.has(fixture.type)) return []
    if (poly.length >= 3 && !pointInPoly(fixture.x, fixture.z, poly)) return []
    const w = Number(fixture.w) || 0.6
    const d = Number(fixture.d) || 0.6
    const rad = ((Number(fixture.rotation) || 0) * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const hw = (w * cos + d * sin) / 2 + 0.04
    const hd = (w * sin + d * cos) / 2 + 0.04
    return [{
      minX: fixture.x - hw,
      maxX: fixture.x + hw,
      minZ: fixture.z - hd,
      maxZ: fixture.z + hd,
      type: fixture.type,
    }]
  })
}

export function heatedArea(room, obstacles = []) {
  const base = Math.max(0, Number(room?.area) || 0)
  const blocked = (obstacles || []).reduce((sum, box) => (
    sum + Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxZ - box.minZ)
  ), 0)
  return Math.round(Math.max(0.3, base - blocked) * 10) / 10
}

function polyLength(points) {
  let sum = 0
  for (let i = 1; i < (points || []).length; i += 1) {
    sum += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  }
  return sum
}

function filletPolyline(points, radius) {
  if (!points || points.length < 3 || !(radius > 0.02)) return points || []
  const out = [{ ...points[0] }]
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const ab = { x: corner.x - prev.x, z: corner.z - prev.z }
    const cb = { x: corner.x - next.x, z: corner.z - next.z }
    const lab = Math.hypot(ab.x, ab.z) || 1
    const lcb = Math.hypot(cb.x, cb.z) || 1
    const trim = Math.min(radius, lab * 0.46, lcb * 0.46)
    if (trim < 0.03) {
      out.push({ ...corner })
      continue
    }
    const p1 = { x: corner.x - (ab.x / lab) * trim, y: corner.y || 0.02, z: corner.z - (ab.z / lab) * trim }
    const p2 = { x: corner.x - (cb.x / lcb) * trim, y: corner.y || 0.02, z: corner.z - (cb.z / lcb) * trim }
    out.push(p1)
    const steps = 5
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      const u = 1 - t
      out.push({
        x: round1(u * u * p1.x + 2 * u * t * corner.x + t * t * p2.x),
        y: corner.y || 0.02,
        z: round1(u * u * p1.z + 2 * u * t * corner.z + t * t * p2.z),
      })
    }
    out.push(p2)
  }
  out.push({ ...points[points.length - 1] })
  return out
}

function pushUTurn(points, xInner, zFrom, zTo, outward) {
  const radius = Math.abs(zTo - zFrom) / 2
  const mid = (zFrom + zTo) / 2
  const steps = 12
  for (let step = 1; step <= steps; step += 1) {
    const ang = -Math.PI / 2 + Math.PI * (step / steps)
    points.push({
      x: roundMm(xInner + outward * radius * Math.cos(ang)),
      y: 0.02,
      z: roundMm(mid + radius * Math.sin(ang)),
    })
  }
}

function serpentine(rows, x0, x1, spacing) {
  const radius = Math.max(0.05, (spacing || 0.3) / 2)
  const left = x0 + radius
  const right = x1 - radius
  if (right - left < 0.25 || rows.length < 2) {
    const points = []
    rows.forEach((z, index) => {
      const a = { x: roundMm(x0), y: 0.02, z: roundMm(z) }
      const b = { x: roundMm(x1), y: 0.02, z: roundMm(z) }
      if (index % 2 === 0) points.push(a, b)
      else points.push(b, a)
    })
    return filletPolyline(points, Math.min(radius, 0.16))
  }
  const points = []
  rows.forEach((z, index) => {
    const goingRight = index % 2 === 0
    const start = goingRight ? left : right
    const end = goingRight ? right : left
    if (!points.length) points.push({ x: roundMm(start), y: 0.02, z: roundMm(z) })
    points.push({ x: roundMm(end), y: 0.02, z: roundMm(z) })
    if (index < rows.length - 1) pushUTurn(points, end, z, rows[index + 1], goingRight ? 1 : -1)
  })
  return points
}

function blockedPoint(x, z, obstacles) {
  return (obstacles || []).some((box) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ)
}

function splitAround(points, obstacles) {
  if (!obstacles?.length) return points.length >= 2 ? [points] : []
  const parts = []
  let current = []
  const push = () => {
    if (current.length >= 2) parts.push(current)
    current = []
  }
  points.forEach((point, index) => {
    if (blockedPoint(point.x, point.z, obstacles)) {
      push()
      return
    }
    if (current.length) {
      const prev = current[current.length - 1]
      if (blockedPoint((prev.x + point.x) / 2, (prev.z + point.z) / 2, obstacles)) push()
    }
    if (index > 0 && !current.length) current.push(point)
    else current.push(point)
  })
  push()
  return parts
}

function spiralPoints(minX, maxX, minZ, maxZ, spacing) {
  const points = []
  let x0 = minX
  let x1 = maxX
  let z0 = minZ
  let z1 = maxZ
  let guard = 0
  const push = (x, z) => {
    const point = { x: round1(x), y: 0.02, z: round1(z) }
    const prev = points[points.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.z - point.z) < 0.04) return
    points.push(point)
  }
  while (x1 - x0 >= spacing * 0.75 && z1 - z0 >= spacing * 0.75 && guard < 48) {
    push(x0, z0)
    push(x1, z0)
    push(x1, z1)
    push(x0, z1)
    x0 += spacing
    z0 += spacing
    x1 -= spacing
    z1 -= spacing
    guard += 1
  }
  if (x1 - x0 > 0.05 && z1 - z0 > 0.05) push((x0 + x1) / 2, (z0 + z1) / 2)
  return filletPolyline(points, Math.min(0.16, spacing * 0.42))
}

function chunkByLength(points, maxLength) {
  if (points.length < 2) return []
  const chunks = []
  let batch = [points[0]]
  let length = 0
  for (let i = 1; i < points.length; i += 1) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    if (batch.length > 1 && length + step > maxLength + 0.05) {
      chunks.push(batch)
      batch = [points[i - 1], points[i]]
      length = step
    } else {
      batch.push(points[i])
      length += step
    }
  }
  if (batch.length >= 2) chunks.push(batch)
  return chunks
}

function packLoops(parts, spacing, maxLength) {
  const loops = []
  parts.forEach((points) => {
    chunkByLength(points, maxLength).forEach((chunk) => {
      const length = round1(polyLength(chunk))
      if (length < 0.8) return
      loops.push({ points: chunk, length, spacing, index: loops.length + 1 })
    })
  })
  return loops
}

export function floorLoops(room, options = {}) {
  const poly = room?.polygon || []
  if (poly.length < 3) return []
  const spacing = Math.min(0.6, Math.max(0.1, Number(options.spacing) || 0.3))
  const maxLength = Number(options.maxLength) || 100
  const inset = Number.isFinite(options.inset) ? options.inset : 0.13
  let minX = Math.min(...poly.map((point) => point.x)) + inset
  let maxX = Math.max(...poly.map((point) => point.x)) - inset
  let minZ = Math.min(...poly.map((point) => point.z)) + inset
  let maxZ = Math.max(...poly.map((point) => point.z)) - inset
  const plain = { minX, maxX, minZ, maxZ }
  ;(options.doors || []).forEach((door) => {
    if (door.minZ <= minZ + 0.08 && door.maxZ > minZ) minZ = Math.max(minZ, door.maxZ + 0.04)
    if (door.maxZ >= maxZ - 0.08 && door.minZ < maxZ) maxZ = Math.min(maxZ, door.minZ - 0.04)
    if (door.minX <= minX + 0.08 && door.maxX > minX) minX = Math.max(minX, door.maxX + 0.04)
    if (door.maxX >= maxX - 0.08 && door.minX < maxX) maxX = Math.min(maxX, door.minX - 0.04)
  })
  if (maxX - minX < 0.7 || maxZ - minZ < 0.55) {
    minX = plain.minX
    maxX = plain.maxX
    minZ = plain.minZ
    maxZ = plain.maxZ
  }
  if (maxX - minX < 0.8 || maxZ - minZ < 0.6) return []
  const obstacles = options.obstacles || []
  const pattern = options.pattern === 'spiral' ? 'spiral' : 'serpentine'
  if (pattern === 'serpentine' && !obstacles.length) {
    const rows = []
    for (let z = minZ; z <= maxZ + 0.001; z += spacing) rows.push(z)
    if (rows.length < 2) return []
    const loops = []
    let batch = []
    const flush = () => {
      if (!batch.length) return
      const points = serpentine(batch, minX, maxX, spacing)
      loops.push({ points, length: round1(polyLength(points)), spacing, index: loops.length + 1 })
      batch = []
    }
    rows.forEach((z) => {
      const candidate = serpentine([...batch, z], minX, maxX, spacing)
      if (batch.length && polyLength(candidate) > maxLength + 0.05) flush()
      batch.push(z)
    })
    flush()
    return loops
  }
  const points = pattern === 'spiral'
    ? spiralPoints(minX, maxX, minZ, maxZ, spacing)
    : serpentine(
      Array.from({ length: Math.max(2, Math.floor((maxZ - minZ) / spacing) + 1) }, (_, index) => minZ + index * spacing)
        .filter((z) => z <= maxZ + 0.001),
      minX,
      maxX,
      spacing,
    )
  return packLoops(splitAround(points, obstacles), spacing, maxLength)
}

export function splitRadiatorLoad(powerW, count) {
  const countSafe = Math.max(1, Number(count) || 1)
  const each = Math.max(200, Math.round((Number(powerW) || 0) / countSafe))
  return Array.from({ length: countSafe }, () => each)
}
