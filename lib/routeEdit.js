/** Shared geometry for editable ducts, pipes and cables. */

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

export const HEIGHT_PRESETS = [
  { id: 'ceiling', label: 'Katossa' },
  { id: 'false-ceiling', label: 'Alakatossa' },
  { id: 'wall', label: 'Seinäkorkeus' },
  { id: 'floor', label: 'Lattiassa' },
]

export function heightMetres(plan, mode, system) {
  const ceiling = Number(plan?.floorHeight) || 2.6
  if (mode === 'ceiling') return round3(system === 'iv' ? ceiling - 0.3 : ceiling - 0.08)
  if (mode === 'false-ceiling') return round3(Math.max(1.6, ceiling - 0.45))
  if (mode === 'wall') return 1.1
  if (mode === 'floor') return system === 'drain' ? -0.05 : 0.05
  return null
}

export function copyPoints(points) {
  return (points || []).map((point) => ({ ...point }))
}

export function riseMetres(points) {
  let rise = 0
  for (let i = 1; i < (points || []).length; i += 1) {
    const dy = (points[i].y || 0) - (points[i - 1].y || 0)
    const horizontal = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    if (horizontal < 0.05 && dy > 0.04) rise += dy
  }
  return Math.round(rise * 100) / 100
}

export function routeLength(points) {
  let sum = 0
  for (let i = 1; i < (points || []).length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    sum += Math.hypot(b.x - a.x, (b.y || 0) - (a.y || 0), b.z - a.z)
  }
  return sum
}

function sameSpot(a, b, tol = 0.02) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0), (a?.z || 0) - (b?.z || 0)) < tol
}

/** Turn a diagonal height change into a horizontal run plus a vertical riser. */
export function insertRisers(points) {
  const src = points || []
  if (src.length < 2) return copyPoints(src)
  const out = [{ ...src[0] }]
  for (let i = 1; i < src.length; i += 1) {
    const prev = out[out.length - 1]
    const point = { ...src[i] }
    const dx = point.x - prev.x
    const dz = point.z - prev.z
    const dy = (point.y || 0) - (prev.y || 0)
    const horizontal = Math.hypot(dx, dz)
    if (horizontal > 0.03 && Math.abs(dy) > 0.04) {
      out.push({ x: round3(point.x), y: prev.y, z: round3(point.z) })
      point.riser = true
      point.vertical = dy > 0 ? 'nousu' : 'lasku'
    } else if (horizontal <= 0.03 && Math.abs(dy) > 0.04) {
      point.riser = true
      point.vertical = dy > 0 ? 'nousu' : 'lasku'
    }
    point.x = round3(point.x)
    point.y = round3(point.y || 0)
    point.z = round3(point.z)
    if (!sameSpot(out[out.length - 1], point)) out.push(point)
  }
  return out
}

export function hitRouteDetail(points, point, vertexTol = 0.22, segmentTol = 0.28) {
  const pts = points || []
  let bestVertex = null
  pts.forEach((vertex, index) => {
    const dist = Math.hypot((vertex.x || 0) - (point?.x || 0), (vertex.z || 0) - (point?.z || 0))
    if (dist <= vertexTol && (!bestVertex || dist < bestVertex.dist)) bestVertex = { dist, vertexIndex: index }
  })
  if (bestVertex) return { vertexIndex: bestVertex.vertexIndex, segmentIndex: null, t: 0 }
  let best = null
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    let t = (((point?.x || 0) - a.x) * dx + ((point?.z || 0) - a.z) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const x = a.x + dx * t
    const z = a.z + dz * t
    const dist = Math.hypot((point?.x || 0) - x, (point?.z || 0) - z)
    if (dist <= segmentTol && (!best || dist < best.dist)) {
      best = {
        dist,
        segmentIndex: i - 1,
        t,
        x,
        z,
        y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t,
      }
    }
  }
  return best
}

export function moveVertexPoints(points, index, at, { ortho = false } = {}) {
  const next = copyPoints(points)
  if (!next[index] || !at) return next
  let x = at.x
  let z = at.z
  const y = Number.isFinite(at.y) ? at.y : next[index].y
  if (ortho) {
    const anchor = next[index - 1] || next[index + 1]
    if (anchor) {
      if (Math.abs((x || 0) - anchor.x) >= Math.abs((z || 0) - anchor.z)) z = anchor.z
      else x = anchor.x
    }
  }
  next[index] = { ...next[index], x: round3(x), y: round3(y ?? next[index].y ?? 0), z: round3(z) }
  return insertRisers(next)
}

export function moveSegmentPoints(points, segmentIndex, dx, dz) {
  const next = copyPoints(points)
  const a = next[segmentIndex]
  const b = next[segmentIndex + 1]
  if (!a || !b) return next
  next[segmentIndex] = { ...a, x: round3(a.x + dx), z: round3(a.z + dz) }
  next[segmentIndex + 1] = { ...b, x: round3(b.x + dx), z: round3(b.z + dz) }
  return insertRisers(next)
}

export function insertVertexPoints(points, segmentIndex, at) {
  const next = copyPoints(points)
  const a = next[segmentIndex]
  const b = next[segmentIndex + 1]
  if (!a || !b || !at) return next
  const y = Number.isFinite(at.y) ? at.y : ((a.y || 0) + (b.y || 0)) / 2
  next.splice(segmentIndex + 1, 0, { x: round3(at.x), y: round3(y), z: round3(at.z) })
  return insertRisers(next)
}

export function removeVertexPoints(points, index) {
  if ((points || []).length <= 2) return copyPoints(points)
  return insertRisers(points.filter((_, i) => i !== index).map((point) => ({ ...point })))
}

export function splitPoints(points, segmentIndex, t = 0.5) {
  const pts = copyPoints(points)
  const a = pts[segmentIndex]
  const b = pts[segmentIndex + 1]
  if (!a || !b) return null
  const mid = {
    x: round3(a.x + (b.x - a.x) * t),
    y: round3((a.y || 0) + ((b.y || 0) - (a.y || 0)) * t),
    z: round3(a.z + (b.z - a.z) * t),
  }
  const left = [...pts.slice(0, segmentIndex + 1), mid]
  const right = [{ ...mid }, ...pts.slice(segmentIndex + 1)]
  if (left.length < 2 || right.length < 2) return null
  return { left, right }
}

export function joinPoints(a, b, tol = 0.45) {
  const left = copyPoints(a)
  const right = copyPoints(b)
  if (left.length < 2 || right.length < 2) return null
  const pairs = [
    { reverseA: true, reverseB: false, d: Math.hypot(left[0].x - right[0].x, left[0].z - right[0].z) },
    { reverseA: true, reverseB: true, d: Math.hypot(left[0].x - right[right.length - 1].x, left[0].z - right[right.length - 1].z) },
    { reverseA: false, reverseB: false, d: Math.hypot(left[left.length - 1].x - right[0].x, left[left.length - 1].z - right[0].z) },
    { reverseA: false, reverseB: true, d: Math.hypot(left[left.length - 1].x - right[right.length - 1].x, left[left.length - 1].z - right[right.length - 1].z) },
  ].sort((p, q) => p.d - q.d)[0]
  if (pairs.d > tol) return null
  const head = pairs.reverseA ? [...left].reverse() : left
  const tail = (pairs.reverseB ? [...right].reverse() : right).slice(1)
  return insertRisers([...head, ...tail])
}

/** Mount a whole run at `y`, keeping the device ends and adding risers up to the new height. */
export function setRunMount(points, y, mode) {
  const src = points || []
  if (src.length < 2) return copyPoints(src)
  const height = round3(y)
  if (src.length === 2) {
    const a = src[0]
    const b = src[1]
    return insertRisers([
      { ...a },
      { x: a.x, y: height, z: a.z, heightMode: mode },
      { x: b.x, y: height, z: b.z, heightMode: mode },
      { ...b },
    ])
  }
  return insertRisers(src.map((point, index) => {
    if (index === 0 || index === src.length - 1) return { ...point }
    return { ...point, y: height, heightMode: mode }
  }))
}

export function setSegmentMount(points, segmentIndex, y, mode) {
  const next = copyPoints(points)
  const a = next[segmentIndex]
  const b = next[segmentIndex + 1]
  if (!a || !b) return next
  const mounted = setRunMount([a, b], y, mode)
  next.splice(segmentIndex, 2, ...mounted)
  return insertRisers(next)
}

export function setPointsHeight(points, y, { from = 0, to = null, mode = null } = {}) {
  const end = to == null ? Math.max(0, (points || []).length - 1) : to
  const next = (points || []).map((point, index) => {
    if (index < from || index > end) return { ...point }
    return { ...point, y: round3(y), heightMode: mode || point.heightMode || undefined }
  })
  return insertRisers(next)
}

export function setSegmentLength(points, segmentIndex, metres) {
  const next = copyPoints(points)
  const a = next[segmentIndex]
  const b = next[segmentIndex + 1]
  if (!a || !b) return next
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz) || 1
  const target = Math.max(0.05, Number(metres) || 0)
  next[segmentIndex + 1] = {
    ...b,
    x: round3(a.x + (dx / len) * target),
    z: round3(a.z + (dz / len) * target),
  }
  return next
}

export function translatePoints(points, dx, dz, dy = 0) {
  return (points || []).map((point) => ({
    ...point,
    x: round3(point.x + dx),
    z: round3(point.z + dz),
    y: round3((point.y || 0) + dy),
  }))
}

export function applySlope(points, slopePercent) {
  const slope = (Number(slopePercent) || 0) / 100
  const src = points || []
  if (!src.length) return []
  let cursor = src[0].y || 0
  return src.map((point, index) => {
    if (index === 0) return { ...point, y: round3(cursor) }
    const prev = src[index - 1]
    const horizontal = Math.hypot(point.x - prev.x, point.z - prev.z)
    if (horizontal < 0.03) {
      cursor = point.y || cursor
      return { ...point, y: round3(point.y || cursor) }
    }
    cursor -= horizontal * slope
    return { ...point, y: round3(cursor) }
  })
}

/** Move the endpoint closest to `from` onto `to`. Returns the same array when nothing is close enough. */
export function followEndpoint(points, from, to, tol = 0.55) {
  const src = points || []
  if (!src.length || !from || !to) return src
  const last = src.length - 1
  const d0 = Math.hypot(src[0].x - from.x, src[0].z - from.z)
  const d1 = Math.hypot(src[last].x - from.x, src[last].z - from.z)
  if (Math.min(d0, d1) > tol) return src
  const index = d0 <= d1 ? 0 : last
  const next = copyPoints(src)
  const y = Number.isFinite(to.y) ? to.y : next[index].y
  next[index] = { ...next[index], x: round3(to.x), y: round3(y ?? 0), z: round3(to.z) }
  return insertRisers(next)
}

export function materialOptions(system) {
  if (system === 'iv') return ['Pelti', 'Muovi', 'Alumiini']
  if (system === 'water' || system === 'heat') return ['PEX', 'Kupari', 'Komposiitti']
  if (system === 'drain') return ['PP', 'PVC', 'Valurauta']
  return ['MMJ 3x1,5', 'MMJ 3x2,5', 'MMJ 5x2,5', 'MMJ 4x1,5 S', 'MCMK 3x1,5', 'MCMK 3x2,5', 'MCMK 5x2,5']
}

export function insulationOptions(system) {
  if (system === 'electric') return ['Ei', 'Putkitus', 'Palosuojaus']
  if (system === 'drain') return ['Ei', 'Solukumi 9 mm', 'Lämmityskaapeli']
  return ['Ei', 'Solukumi 9 mm', 'Solukumi 13 mm', 'Vuorivilla']
}
