// Wall plan geometry: mitred faces from offset-line intersections, then one
// silhouette so joints have no internal seams, notches or open corners.

function hypot(dx, dz) {
  return Math.hypot(dx || 0, dz || 0)
}

function unit(dx, dz) {
  const len = hypot(dx, dz) || 1
  return { x: dx / len, z: dz / len }
}

function add(a, b) {
  return { x: a.x + b.x, z: a.z + b.z }
}

function scale(v, k) {
  return { x: v.x * k, z: v.z * k }
}

function sub(a, b) {
  return { x: a.x - b.x, z: a.z - b.z }
}

function leftNormal(dir) {
  return { x: -dir.z, z: dir.x }
}

export function wallAlignment(wall) {
  if (wall?.align === 'left' || wall?.align === 'right') return wall.align
  return 'center'
}

// Offsets are along the left normal of a→b. The named face stays on the
// reference line; thickness is added on the other side. Centre grows both ways.
export function faceOffsets(wall, thickness) {
  const thick = Math.max(0.04, Number(thickness) || 0.2)
  const align = wallAlignment(wall)
  if (align === 'left') return { left: 0, right: -thick }
  if (align === 'right') return { left: thick, right: 0 }
  const half = thick / 2
  return { left: half, right: -half }
}

function offsetsAlong(wall, thickness, dir) {
  const forward = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const base = faceOffsets(wall, thickness)
  if (forward.x * dir.x + forward.z * dir.z >= 0) return base
  return { left: -base.right, right: -base.left }
}

function near(a, b, tol = 0.045) {
  return hypot(a.x - b.x, a.z - b.z) <= tol
}

function lineIntersect(p, d, q, e) {
  const den = d.x * e.z - d.z * e.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den
  return { x: p.x + d.x * t, z: p.z + d.z * t, t }
}

function segmentT(point, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-8) return null
  const t = ((point.x - a.x) * dx + (point.z - a.z) * dz) / len2
  if (t <= 0.02 || t >= 0.98) return null
  const x = a.x + dx * t
  const z = a.z + dz * t
  if (hypot(point.x - x, point.z - z) > 0.05) return null
  return t
}

function angleOf(base, dir) {
  let ang = Math.atan2(base.x * dir.z - base.z * dir.x, base.x * dir.x + base.z * dir.z)
  if (ang < 0) ang += Math.PI * 2
  return ang
}

function raysAt(walls, at, thicknessOf) {
  const rays = []
  ;(walls || []).forEach((wall) => {
    const thick = thicknessOf(wall)
    const half = Math.max(0.02, (Number(thick) || 0.2) / 2)
    if (near(wall.a, at)) {
      const dir = unit(wall.b.x - at.x, wall.b.z - at.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'a' })
    } else if (near(wall.b, at)) {
      const dir = unit(wall.a.x - at.x, wall.a.z - at.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'b' })
    } else if (segmentT(at, wall.a, wall.b) != null) {
      const dir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'mid' })
      const back = { x: -dir.x, z: -dir.z }
      rays.push({ wall, dir: back, half, offsets: offsetsAlong(wall, thick, back), end: 'mid' })
    }
  })
  return rays
}

function meet(at, dir, offsets, side, neighbor) {
  if (!neighbor?.offsets) return null
  const turn = angleOf(dir, neighbor.dir)
  if (turn < 0.06 || Math.abs(turn - Math.PI) < 0.08 || turn > Math.PI * 2 - 0.06) return null
  const n = leftNormal(dir)
  const nn = leftNormal(neighbor.dir)
  const own = side > 0 ? offsets.left : offsets.right
  const other = side > 0 ? neighbor.offsets.right : neighbor.offsets.left
  const p = add(at, scale(n, own))
  const q = add(at, scale(nn, other))
  const hit = lineIntersect(p, dir, q, neighbor.dir)
  if (!hit) return null
  const dist = hypot(hit.x - at.x, hit.z - at.z)
  const limit = Math.max(Math.abs(own), Math.abs(other), neighbor.half || 0) * 8 + 0.05
  if (dist > limit) return null
  return { x: hit.x, z: hit.z }
}

export function capAt(wall, at, dir, halfOrOffsets, walls, thicknessOf) {
  const offsets = typeof halfOrOffsets === 'number'
    ? { left: halfOrOffsets, right: -halfOrOffsets }
    : halfOrOffsets
  const n = leftNormal(dir)
  const square = (side) => add(at, scale(n, side > 0 ? offsets.left : offsets.right))
  const rays = raysAt(walls, at, thicknessOf).filter((ray) => ray.wall.id !== wall.id)
  if (!rays.length) return { left: square(1), right: square(-1) }
  const ranked = rays.map((ray) => ({ ...ray, ang: angleOf(dir, ray.dir) })).sort((a, b) => a.ang - b.ang)
  const ccw = ranked[0]
  const cw = ranked[ranked.length - 1]
  return {
    left: meet(at, dir, offsets, 1, ccw) || square(1),
    right: meet(at, dir, offsets, -1, cw) || square(-1),
  }
}

function pointAt(wall, distance) {
  const len = hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1
  return {
    x: wall.a.x + ((wall.b.x - wall.a.x) / len) * distance,
    z: wall.a.z + ((wall.b.z - wall.a.z) / len) * distance,
  }
}

function solidsOf(wall, openings) {
  const len = hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const cuts = (openings || [])
    .filter((item) => item.wallId === wall.id)
    .map((item) => ({
      from: Math.max(0, item.offset - item.width / 2),
      to: Math.min(len, item.offset + item.width / 2),
    }))
    .filter((item) => item.to - item.from > 0.04)
    .sort((a, b) => a.from - b.from)
  const solids = []
  let cursor = 0
  cuts.forEach((cut) => {
    if (cut.from - cursor > 0.02) solids.push({ from: cursor, to: cut.from })
    cursor = Math.max(cursor, cut.to)
  })
  if (len - cursor > 0.02) solids.push({ from: cursor, to: len })
  return { len, solids }
}

export function spanQuad(wall, from, to, walls, thicknessOf) {
  const len = hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const openings = []
  if (from > 0.03) openings.push({ wallId: wall.id, offset: from / 2, width: Math.max(0.05, from) })
  if (to < len - 0.03) openings.push({ wallId: wall.id, offset: (to + len) / 2, width: Math.max(0.05, len - to) })
  return faceQuads(wall, openings, walls, thicknessOf)[0] || null
}

export function faceQuads(wall, openings, walls, thicknessOf) {
  const thick = Math.max(0.04, thicknessOf(wall) || 0.2)
  const offsets = faceOffsets(wall, thick)
  const { len, solids } = solidsOf(wall, openings)
  if (len < 0.05) return []
  const dir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const n = leftNormal(dir)
  const capA = capAt(wall, wall.a, dir, offsets, walls, thicknessOf)
  const rev = { x: -dir.x, z: -dir.z }
  const capB = capAt(wall, wall.b, rev, { left: -offsets.right, right: -offsets.left }, walls, thicknessOf)
  const endB = {
    left: capB.right,
    right: capB.left,
  }
  return solids.map((span) => {
    const atStart = span.from <= 0.025
    const atEnd = span.to >= len - 0.025
    const a = pointAt(wall, span.from)
    const b = pointAt(wall, span.to)
    const startLeft = atStart ? capA.left : add(a, scale(n, offsets.left))
    const startRight = atStart ? capA.right : add(a, scale(n, offsets.right))
    const endLeft = atEnd ? endB.left : add(b, scale(n, offsets.left))
    const endRight = atEnd ? endB.right : add(b, scale(n, offsets.right))
    return [startLeft, endLeft, endRight, startRight]
  })
}

function pointInPoly(x, z, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x
    const zi = poly[i].z
    const xj = poly[j].x
    const zj = poly[j].z
    const hit = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-12) + xi
    if (hit) inside = !inside
  }
  return inside
}

function crosses(a, b, c, d) {
  const r = sub(b, a)
  const s = sub(d, c)
  const den = r.x * s.z - r.z * s.x
  if (Math.abs(den) < 1e-10) return null
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den
  if (t <= 0.004 || t >= 0.996 || u < -0.004 || u > 1.004) return null
  return t
}

function insideAny(x, z, polys) {
  return polys.some((poly) => pointInPoly(x, z, poly))
}

function boundaryFragments(polys) {
  const edges = []
  polys.forEach((poly) => {
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if (hypot(b.x - a.x, b.z - a.z) < 0.004) continue
      edges.push({ a, b })
    }
  })
  const pieces = []
  edges.forEach((edge) => {
    const cuts = [0, 1]
    edges.forEach((other) => {
      if (other === edge) return
      const t = crosses(edge.a, edge.b, other.a, other.b)
      if (t != null) cuts.push(t)
    })
    cuts.sort((a, b) => a - b)
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const t0 = cuts[i]
      const t1 = cuts[i + 1]
      if (t1 - t0 < 0.008) continue
      const at = (t) => ({
        x: edge.a.x + (edge.b.x - edge.a.x) * t,
        z: edge.a.z + (edge.b.z - edge.a.z) * t,
      })
      const a = at(t0)
      const b = at(t1)
      const mx = (a.x + b.x) / 2
      const mz = (a.z + b.z) / 2
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = hypot(dx, dz) || 1
      const ox = (-dz / len) * 0.004
      const oz = (dx / len) * 0.004
      const left = insideAny(mx + ox, mz + oz, polys)
      const right = insideAny(mx - ox, mz - oz, polys)
      if (left === right) continue
      pieces.push(left ? { a, b } : { a: b, b: a })
    }
  })
  return pieces
}

function chainLoops(pieces) {
  const unused = pieces.map((piece) => ({ ...piece, used: false }))
  const buckets = new Map()
  const key = (p) => `${Math.round(p.x * 400)},${Math.round(p.z * 400)}`
  unused.forEach((piece, index) => {
    const id = key(piece.a)
    if (!buckets.has(id)) buckets.set(id, [])
    buckets.get(id).push(index)
  })
  const loops = []
  unused.forEach((piece, start) => {
    if (piece.used) return
    const loop = [piece.a]
    let current = piece.b
    piece.used = true
    for (let guard = 0; guard < unused.length + 2; guard += 1) {
      if (hypot(current.x - loop[0].x, current.z - loop[0].z) < 0.008) break
      loop.push(current)
      const next = (buckets.get(key(current)) || []).find((index) => !unused[index].used)
      if (next == null) break
      unused[next].used = true
      current = unused[next].b
    }
    if (loop.length >= 3) loops.push(loop)
  })
  return loops
}

function loopArea(poly) {
  let area = 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    area += a.x * b.z - b.x * a.z
  }
  return area / 2
}

export function silhouetteOf(quads) {
  const polys = (quads || []).filter((quad) => quad && quad.length >= 3)
  if (!polys.length) return []
  const fragments = boundaryFragments(polys)
  const loops = chainLoops(fragments).filter((loop) => Math.abs(loopArea(loop)) > 0.002)
  return loops.map((points) => ({ points, area: loopArea(points) }))
}

function outwardSign(wall, walls) {
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
  let cx = 0
  let cz = 0
  let n = 0
  ;(walls || []).forEach((item) => {
    cx += item.a.x + item.b.x
    cz += item.a.z + item.b.z
    n += 2
  })
  if (!n) return 1
  cx /= n
  cz /= n
  const dir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const normal = leftNormal(dir)
  const dot = (mid.x - cx) * normal.x + (mid.z - cz) * normal.z
  return dot >= 0 ? 1 : -1
}

function offsetPoint(wall, at, distance) {
  const dir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  return add(at, scale(leftNormal(dir), distance))
}

function collinearDirs(a, b) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z))
  const turn = Math.acos(dot)
  return turn < 0.12 || turn > Math.PI - 0.12
}

function shiftedEnd(wall, at, walls, distanceOf) {
  const own = offsetPoint(wall, at, distanceOf(wall))
  const away = near(wall.a, at)
    ? unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
    : unit(wall.a.x - wall.b.x, wall.a.z - wall.b.z)
  const angled = (walls || []).filter((other) => {
    if (!other || other.id === wall.id) return false
    let dir = null
    if (near(other.a, at)) dir = unit(other.b.x - at.x, other.b.z - at.z)
    else if (near(other.b, at)) dir = unit(other.a.x - at.x, other.a.z - at.z)
    else return false
    return !collinearDirs(away, dir)
  })
  if (!angled.length) return own
  const other = angled[0]
  const da = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const db = unit(other.b.x - other.a.x, other.b.z - other.a.z)
  const pa = add(at, scale(leftNormal(da), distanceOf(wall)))
  const pb = add(at, scale(leftNormal(db), distanceOf(other)))
  const hit = lineIntersect(pa, da, pb, db)
  if (!hit || hypot(hit.x - at.x, hit.z - at.z) > 1.2) return own
  return { x: hit.x, z: hit.z }
}

function shiftedWalls(walls, distanceOf) {
  return (walls || []).map((wall) => ({
    ...wall,
    a: shiftedEnd(wall, wall.a, walls, distanceOf),
    b: shiftedEnd(wall, wall.b, walls, distanceOf),
  }))
}

function bandQuads(walls, openings, thicknessOf, distanceOf, band) {
  const shifted = shiftedWalls(walls, distanceOf)
  const thick = () => band
  return shifted.flatMap((wall) => faceQuads(wall, openings, shifted, thick))
}

export function wallFigures(walls, openings, thicknessOf) {
  const list = walls || []
  const core = []
  const insulation = []
  const cladding = []
  list.forEach((wall) => {
    const quads = faceQuads(wall, openings, list, thicknessOf)
    const exterior = wall.kind !== 'interior' && wall.kind !== 'partition'
    quads.forEach((quad) => core.push({ quad, exterior, wallId: wall.id }))
  })
  const exteriorWalls = list.filter((wall) => wall.kind !== 'interior' && wall.kind !== 'partition')
  const along = (fraction) => (wall) => {
    const half = Math.max(0.02, (thicknessOf(wall) || 0.24) / 2)
    return outwardSign(wall, list) * half * fraction
  }
  bandQuads(exteriorWalls, openings, thicknessOf, along(0.42), 0.045).forEach((quad) => insulation.push(quad))
  bandQuads(exteriorWalls, openings, thicknessOf, along(1.08), 0.02).forEach((quad) => cladding.push(quad))
  const pack = (entries, role) => silhouetteOf(entries).map((loop) => ({ ...loop, role }))
  return {
    core: pack(core.map((item) => item.quad), 'core'),
    exterior: pack(core.filter((item) => item.exterior).map((item) => item.quad), 'exterior'),
    interior: pack(core.filter((item) => !item.exterior).map((item) => item.quad), 'interior'),
    insulation: pack(insulation, 'insulation'),
    cladding: pack(cladding, 'cladding'),
    quads: core,
  }
}

export function loopPath(points, close = true) {
  if (!points?.length) return ''
  const body = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.z}`).join(' ')
  return close ? `${body} Z` : body
}
