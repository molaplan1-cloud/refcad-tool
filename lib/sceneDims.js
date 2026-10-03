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

function axisBreaks(rooms, axis) {
  const values = new Set()
  rooms.forEach((room) => {
    const span = spanOf(room, axis)
    values.add(Math.round(span.min * 1000) / 1000)
    values.add(Math.round(span.max * 1000) / 1000)
  })
  return [...values].sort((a, b) => a - b)
}

function chainRuns(rooms, axis, breaks) {
  const runs = []
  for (let i = 0; i < breaks.length - 1; i += 1) {
    const a = breaks[i]
    const b = breaks[i + 1]
    if (b - a < 0.12) continue
    const mid = (a + b) / 2
    const covered = rooms.some((room) => {
      const span = spanOf(room, axis)
      return mid > span.min + 0.02 && mid < span.max - 0.02
    })
    if (covered) runs.push({ a, b })
  }
  return runs
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

/**
 * Overall size per axis, plus a chain of the room runs.
 * A chain that is a single run equal to the overall is omitted so the value is not repeated.
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
  const y = 0.22
  const chainGap = 0.78
  const overallGap = 1.62
  const segments = []
  const labels = []

  const addRun = (key, text, x1, z1, x2, z2, label) => {
    dimLine(segments, [x1, y, z1], [x2, y, z2])
    labels.push({ key, text, x: label.x, y: 0.46, z: label.z })
  }

  const xRuns = chainRuns(list, 'x', axisBreaks(list, 'x'))
  const zRuns = chainRuns(list, 'z', axisBreaks(list, 'z'))
  const xOverall = maxX - minX
  const zOverall = maxZ - minZ
  const xChainUseful = xRuns.length > 1 || (xRuns.length === 1 && Math.abs((xRuns[0].b - xRuns[0].a) - xOverall) > 0.05)
  const zChainUseful = zRuns.length > 1 || (zRuns.length === 1 && Math.abs((zRuns[0].b - zRuns[0].a) - zOverall) > 0.05)

  if (xChainUseful) {
    xRuns.forEach((run, index) => {
      const z = maxZ + chainGap
      addRun(`chain-x-${index}`, mmLabel(run.b - run.a), run.a, z, run.b, z, { x: (run.a + run.b) / 2, z: z + 0.42 })
    })
  }
  addRun('overall-x', mmLabel(xOverall), minX, maxZ + overallGap, maxX, maxZ + overallGap, { x: (minX + maxX) / 2, z: maxZ + overallGap + 0.42 })

  if (zChainUseful) {
    zRuns.forEach((run, index) => {
      const x = maxX + chainGap
      addRun(`chain-z-${index}`, mmLabel(run.b - run.a), x, run.a, x, run.b, { x: x + 0.5, z: (run.a + run.b) / 2 })
    })
  }
  addRun('overall-z', mmLabel(zOverall), maxX + overallGap, minZ, maxX + overallGap, maxZ, { x: maxX + overallGap + 0.5, z: (minZ + maxZ) / 2 })

  const seenHeight = new Set()
  list.forEach((room) => {
    const mm = Math.round((room.height || 3) * 1000)
    if (seenHeight.has(mm)) return
    seenHeight.add(mm)
    const index = seenHeight.size - 1
    const span = spanOf(room, 'x')
    const depth = spanOf(room, 'z')
    const x = Math.max(span.max, maxX) + overallGap + 0.95 + index * 0.7
    const z = depth.max
    const h = room.height || 3
    dimLine(segments, [x, 0.05, z], [x, h, z])
    labels.push({ key: `h-${mm}`, text: mmLabel(h), x: x + 0.46, y: h * 0.55, z })
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
    y: (room.height || 3) + 0.42,
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
