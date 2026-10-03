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

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
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

export function splitRadiatorLoad(powerW, count) {
  const countSafe = Math.max(1, Number(count) || 1)
  const each = Math.max(200, Math.round((Number(powerW) || 0) / countSafe))
  return Array.from({ length: countSafe }, () => each)
}
