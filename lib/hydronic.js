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

function serpentine(rows, x0, x1) {
  const points = []
  rows.forEach((z, index) => {
    const left = { x: round1(x0), y: 0.02, z: round1(z) }
    const right = { x: round1(x1), y: 0.02, z: round1(z) }
    if (index % 2 === 0) points.push(left, right)
    else points.push(right, left)
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
  return points
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
  const inset = Number.isFinite(options.inset) ? options.inset : 0.35
  const minX = Math.min(...poly.map((point) => point.x)) + inset
  const maxX = Math.max(...poly.map((point) => point.x)) - inset
  const minZ = Math.min(...poly.map((point) => point.z)) + inset
  const maxZ = Math.max(...poly.map((point) => point.z)) - inset
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
      const points = serpentine(batch, minX, maxX)
      loops.push({ points, length: round1(polyLength(points)), spacing, index: loops.length + 1 })
      batch = []
    }
    rows.forEach((z) => {
      const candidate = serpentine([...batch, z], minX, maxX)
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
    )
  return packLoops(splitAround(points, obstacles), spacing, maxLength)
}

export function splitRadiatorLoad(powerW, count) {
  const countSafe = Math.max(1, Number(count) || 1)
  const each = Math.max(200, Math.round((Number(powerW) || 0) / countSafe))
  return Array.from({ length: countSafe }, () => each)
}
