import { outlineOf } from './cadDraw.js'

function mmLabel(metres) {
  return String(Math.round(metres * 1000))
}

function push(segments, a, b) {
  segments.push(a[0], a[1], a[2], b[0], b[1], b[2])
}

function arrowHead(segments, tip, dir, perp) {
  const len = 0.16
  const spread = 0.055
  const back = [tip[0] - dir[0] * len, tip[1] - dir[1] * len, tip[2] - dir[2] * len]
  push(segments, tip, [back[0] + perp[0] * spread, back[1] + perp[1] * spread, back[2] + perp[2] * spread])
  push(segments, tip, [back[0] - perp[0] * spread, back[1] - perp[1] * spread, back[2] - perp[2] * spread])
}

export function dimensionCentroid(rooms) {
  const list = (rooms || []).filter((room) => room && room.type !== 'yard')
  if (!list.length) return { x: 0, z: 0 }
  return {
    x: list.reduce((sum, room) => sum + (room.x || 0), 0) / list.length,
    z: list.reduce((sum, room) => sum + (room.z || 0), 0) / list.length,
  }
}

/** Roof tag on the corner opposite the outward dimensions. */
export function technicalTagPosition(room, centroid = { x: room.x || 0, z: room.z || 0 }) {
  const xSide = (room.x || 0) >= centroid.x ? 1 : -1
  const zSide = (room.z || 0) >= centroid.z ? 1 : -1
  const halfW = (room.width || 2) / 2
  const halfD = (room.depth || 2) / 2
  return [
    (room.x || 0) - xSide * halfW * 0.42,
    (room.height || 3) + 0.55,
    (room.z || 0) - zSide * halfD * 0.42,
  ]
}

/** Overall length, width and height, offset outside the room. Values are millimetres. */
export function roomDimensionSpec(room, centroid = { x: room.x || 0, z: room.z || 0 }, gap = 0.72) {
  const pts = outlineOf(room)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  pts.forEach((point) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  })
  const xSide = (room.x || 0) >= centroid.x ? 1 : -1
  const zSide = (room.z || 0) >= centroid.z ? 1 : -1
  const height = room.height || 3
  const y = 0.05
  const lift = 0.08
  const past = 0.06
  const zEdge = zSide > 0 ? maxZ : minZ
  const xEdge = xSide > 0 ? maxX : minX
  const xLine = zEdge + zSide * gap
  const zLine = xEdge + xSide * gap
  const hGap = gap + 0.58
  const hx = xEdge + xSide * hGap
  const hz = zEdge + zSide * hGap
  const segments = []

  push(segments, [minX, y, zEdge + zSide * lift], [minX, y, xLine + zSide * past])
  push(segments, [maxX, y, zEdge + zSide * lift], [maxX, y, xLine + zSide * past])
  push(segments, [minX, y, xLine], [maxX, y, xLine])
  arrowHead(segments, [minX, y, xLine], [-1, 0, 0], [0, 0, zSide])
  arrowHead(segments, [maxX, y, xLine], [1, 0, 0], [0, 0, zSide])

  push(segments, [xEdge + xSide * lift, y, minZ], [zLine + xSide * past, y, minZ])
  push(segments, [xEdge + xSide * lift, y, maxZ], [zLine + xSide * past, y, maxZ])
  push(segments, [zLine, y, minZ], [zLine, y, maxZ])
  arrowHead(segments, [zLine, y, minZ], [0, 0, -1], [xSide, 0, 0])
  arrowHead(segments, [zLine, y, maxZ], [0, 0, 1], [xSide, 0, 0])

  const corner = [xEdge, 0, zEdge]
  const top = [xEdge, height, zEdge]
  const base = [hx, 0, hz]
  const cap = [hx, height, hz]
  push(segments, [corner[0] + xSide * lift, corner[1], corner[2] + zSide * lift], base)
  push(segments, [top[0] + xSide * lift, top[1], top[2] + zSide * lift], cap)
  push(segments, base, cap)
  const out = Math.hypot(xSide, zSide) || 1
  arrowHead(segments, base, [0, -1, 0], [xSide / out, 0, zSide / out])
  arrowHead(segments, cap, [0, 1, 0], [xSide / out, 0, zSide / out])

  const id = room.id || 'room'
  return {
    segments,
    labels: [
      { key: `${id}-x`, axis: 'x', text: mmLabel(maxX - minX), x: (minX + maxX) / 2, y: 0.22, z: xLine + zSide * 0.46 },
      { key: `${id}-z`, axis: 'z', text: mmLabel(maxZ - minZ), x: zLine + xSide * 0.46, y: 0.22, z: (minZ + maxZ) / 2 },
      { key: `${id}-y`, axis: 'y', text: mmLabel(height), x: hx + xSide * 0.42, y: height * 0.62, z: hz + zSide * 0.42 },
    ],
  }
}

function spanOf(room, axis) {
  const pts = outlineOf(room)
  let min = Infinity
  let max = -Infinity
  pts.forEach((point) => {
    const value = axis === 'x' ? point.x : point.z
    min = Math.min(min, value)
    max = Math.max(max, value)
  })
  return { min, max }
}

function dimLine(segments, a, b) {
  push(segments, a, b)
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const dir = [dx / len, dy / len, dz / len]
  const perp = Math.abs(dir[1]) > 0.5 ? [1, 0, 0] : [0, 1, 0]
  arrowHead(segments, a, [-dir[0], -dir[1], -dir[2]], perp)
  arrowHead(segments, b, dir, perp)
}

/** Light lines and dark chips in dark mode; dark lines and light chips otherwise. */
export function dimensionStyle(theme) {
  const dark = theme === 'dark'
  return {
    line: dark ? '#f4f7fb' : '#1a1d21',
    chipBg: dark ? '#14161a' : '#ffffff',
    chipFg: dark ? '#f8fafc' : '#1a1d21',
    chipBorder: dark ? '#f4f7fb' : '#1a1d21',
  }
}

function faceRuns(rooms, along, side) {
  const face = along === 'x' ? 'z' : 'x'
  let extreme = side > 0 ? -Infinity : Infinity
  rooms.forEach((room) => {
    const span = spanOf(room, face)
    extreme = side > 0 ? Math.max(extreme, span.max) : Math.min(extreme, span.min)
  })
  const runs = []
  rooms.forEach((room) => {
    const span = spanOf(room, face)
    const edge = side > 0 ? span.max : span.min
    if (Math.abs(edge - extreme) > 0.4) return
    const measure = spanOf(room, along)
    if (measure.max - measure.min < 0.4) return
    const covered = runs.some((run) => measure.min >= run.a - 0.05 && measure.max <= run.b + 0.05)
    if (covered) return
    runs.push({ a: measure.min, b: measure.max, face: edge })
  })
  runs.sort((p, q) => p.a - q.a)
  return { extreme, runs }
}

/**
 * One overall and one exterior chain per side, close to the building.
 * A chain that repeats the overall is omitted. Extension lines meet the face.
 */
export function buildingDimensionSpec(rooms) {
  const list = (rooms || []).filter((room) => room && room.type !== 'yard')
  if (!list.length) return { segments: [], labels: [] }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  list.forEach((room) => {
    const sx = spanOf(room, 'x')
    const sz = spanOf(room, 'z')
    minX = Math.min(minX, sx.min)
    maxX = Math.max(maxX, sx.max)
    minZ = Math.min(minZ, sz.min)
    maxZ = Math.max(maxZ, sz.max)
  })
  const y = 0.16
  const chainGap = 0.48
  const overallGap = 1.08
  const segments = []
  const labels = []
  const xOverall = maxX - minX
  const zOverall = maxZ - minZ
  const south = faceRuns(list, 'x', 1)
  const east = faceRuns(list, 'z', 1)
  const xChainUseful = south.runs.length > 1 || (south.runs.length === 1 && Math.abs((south.runs[0].b - south.runs[0].a) - xOverall) > 0.05)
  const zChainUseful = east.runs.length > 1 || (east.runs.length === 1 && Math.abs((east.runs[0].b - east.runs[0].a) - zOverall) > 0.05)

  const addFlat = (key, text, x1, z1, x2, z2, label) => {
    dimLine(segments, [x1, y, z1], [x2, y, z2])
    labels.push({ key, text, x: label.x, y: 0.28, z: label.z })
  }

  if (xChainUseful) {
    const z = south.extreme + chainGap
    south.runs.forEach((run, index) => {
      push(segments, [run.a, y, run.face], [run.a, y, z + 0.1])
      push(segments, [run.b, y, run.face], [run.b, y, z + 0.1])
      addFlat(`chain-x-${index}`, mmLabel(run.b - run.a), run.a, z, run.b, z, { x: (run.a + run.b) / 2, z: z + 0.02 })
    })
  }
  push(segments, [minX, y, maxZ], [minX, y, maxZ + overallGap + 0.1])
  push(segments, [maxX, y, maxZ], [maxX, y, maxZ + overallGap + 0.1])
  addFlat('overall-x', mmLabel(xOverall), minX, maxZ + overallGap, maxX, maxZ + overallGap, { x: (minX + maxX) / 2, z: maxZ + overallGap + 0.02 })

  if (zChainUseful) {
    const x = east.extreme + chainGap
    east.runs.forEach((run, index) => {
      push(segments, [run.face, y, run.a], [x + 0.1, y, run.a])
      push(segments, [run.face, y, run.b], [x + 0.1, y, run.b])
      addFlat(`chain-z-${index}`, mmLabel(run.b - run.a), x, run.a, x, run.b, { x: x + 0.02, z: (run.a + run.b) / 2 })
    })
  }
  push(segments, [maxX, y, minZ], [maxX + overallGap + 0.1, y, minZ])
  push(segments, [maxX, y, maxZ], [maxX + overallGap + 0.1, y, maxZ])
  addFlat('overall-z', mmLabel(zOverall), maxX + overallGap, minZ, maxX + overallGap, maxZ, { x: maxX + overallGap + 0.02, z: (minZ + maxZ) / 2 })

  const seenHeight = new Set()
  list.forEach((room) => {
    const mm = Math.round((room.height || 3) * 1000)
    if (seenHeight.has(mm)) return
    seenHeight.add(mm)
    const span = spanOf(room, 'x')
    const depth = spanOf(room, 'z')
    const h = room.height || 3
    let x = span.min - 0.62
    const z = (depth.min + depth.max) / 2
    const crowded = labels.some((label) => label.key.startsWith('h-') && Math.abs(label.z - z) < 1.3)
    if (crowded) x -= 0.7
    push(segments, [span.min, 0.04, z], [x - 0.06, 0.04, z])
    push(segments, [span.min, h, z], [x - 0.06, h, z])
    dimLine(segments, [x, 0.04, z], [x, h, z])
    labels.push({ key: `h-${mm}`, text: mmLabel(h), x: x - 0.28, y: h * 0.5, z })
  })

  return { segments, labels }
}

/** Pull room-name tags apart in plan so neighbouring names do not occupy the same point. */
export function layoutRoomTags(rooms) {
  const items = (rooms || []).filter((room) => room && room.type !== 'yard').map((room) => ({
    id: room.id,
    name: room.name || room.label || 'Huone',
    ax: room.x || 0,
    az: room.z || 0,
    x: room.x || 0,
    z: room.z || 0,
    y: Math.max(1.05, (room.height || 3) * 0.46),
    area: Math.max(0.4, (room.width || 1) * (room.depth || 1)),
  }))
  const minDist = 2.05
  for (let pass = 0; pass < 10; pass += 1) {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const dx = items[j].x - items[i].x
        const dz = items[j].z - items[i].z
        const dist = Math.hypot(dx, dz) || 0.001
        if (dist >= minDist) continue
        const push = (minDist - dist) / 2
        const ux = dx / dist
        const uz = dz / dist
        const share = items[i].area + items[j].area
        const si = items[j].area / share
        const sj = items[i].area / share
        items[i].x -= ux * push * si * 2
        items[i].z -= uz * push * si * 2
        items[j].x += ux * push * sj * 2
        items[j].z += uz * push * sj * 2
      }
    }
  }
  return items.map((item) => ({
    ...item,
    leader: Math.hypot(item.x - item.ax, item.z - item.az) > 0.4,
  }))
}
