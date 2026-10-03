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
