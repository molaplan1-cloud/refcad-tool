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
    const len = hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
    if (near(wall.a, at)) {
      const dir = unit(wall.b.x - at.x, wall.b.z - at.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'a', len })
    } else if (near(wall.b, at)) {
      const dir = unit(wall.a.x - at.x, wall.a.z - at.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'b', len })
    } else if (segmentT(at, wall.a, wall.b) != null) {
      const dir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
      rays.push({ wall, dir, half, offsets: offsetsAlong(wall, thick, dir), end: 'mid', len })
      const back = { x: -dir.x, z: -dir.z }
      rays.push({ wall, dir: back, half, offsets: offsetsAlong(wall, thick, back), end: 'mid', len })
    }
  })
  return rays
}

function meet(at, dir, offsets, side, neighbor, ownLen) {
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
  const along = (hit.x - at.x) * dir.x + (hit.z - at.z) * dir.z
  const otherAlong = (hit.x - at.x) * neighbor.dir.x + (hit.z - at.z) * neighbor.dir.z
  // A mitre that runs past the far end of a short segment inverts into a spike.
  // Square that end instead so the faces stay a notch.
  if (Number.isFinite(ownLen) && along > ownLen + 0.001) return null
  if (Number.isFinite(neighbor.len) && otherAlong > neighbor.len + 0.001) return null
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
  const ownLen = hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const rays = raysAt(walls, at, thicknessOf).filter((ray) => ray.wall.id !== wall.id)
  if (!rays.length) return { left: square(1), right: square(-1) }
  const ranked = rays.map((ray) => ({ ...ray, ang: angleOf(dir, ray.dir) })).sort((a, b) => a.ang - b.ang)
  const ccw = ranked[0]
  const cw = ranked[ranked.length - 1]
  const leftHit = meet(at, dir, offsets, 1, ccw, ownLen)
  const rightHit = meet(at, dir, offsets, -1, cw, ownLen)
  // One mitred face and one squared face make a diagonal cap. A short
  // segment cannot hold that, so both faces butt instead.
  if (!leftHit || !rightHit) return { left: square(1), right: square(-1) }
  return { left: leftHit, right: rightHit }
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
  if (len < 0.02) return []
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

function samePoint(a, b, tol = 0.04) {
  return hypot(a.x - b.x, a.z - b.z) <= tol
}

// Connected walls become one reference polyline. At a branch, the straight
// continuation stays on the chain and the stem becomes its own chain.
export function joinedChains(walls) {
  const list = (walls || []).filter((wall) => wall?.a && wall?.b && hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) > 0.02)
  const unused = new Set(list.map((wall) => wall.id))
  const incident = (point, ignore) => list.filter((wall) => wall.id !== ignore && unused.has(wall.id) && (samePoint(wall.a, point) || samePoint(wall.b, point)))
  const chains = []
  while (unused.size) {
    const start = list.find((wall) => unused.has(wall.id)) 
    if (!start) break
    const segments = [{ wall: start, from: 'a', to: 'b' }]
    unused.delete(start.id)
    const push = (dir) => {
      for (let guard = 0; guard < list.length + 2; guard += 1) {
        const end = dir > 0 ? segments[segments.length - 1] : segments[0]
        const point = end.wall[dir > 0 ? end.to : end.from]
        const prev = dir > 0
          ? unit(point.x - end.wall[end.from].x, point.z - end.wall[end.from].z)
          : unit(point.x - end.wall[end.to].x, point.z - end.wall[end.to].z)
        const cands = incident(point, end.wall.id)
        if (!cands.length) break
        let best = cands[0]
        let bestTurn = Infinity
        cands.forEach((wall) => {
          const atA = samePoint(wall.a, point)
          const other = atA ? wall.b : wall.a
          const next = unit(other.x - point.x, other.z - point.z)
          const turn = Math.abs(Math.atan2(prev.x * next.z - prev.z * next.x, prev.x * next.x + prev.z * next.z))
          if (turn < bestTurn) {
            bestTurn = turn
            best = wall
          }
        })
        const atA = samePoint(best.a, point)
        const piece = dir > 0
          ? (atA ? { wall: best, from: 'a', to: 'b' } : { wall: best, from: 'b', to: 'a' })
          : (atA ? { wall: best, from: 'b', to: 'a' } : { wall: best, from: 'a', to: 'b' })
        if (dir > 0) segments.push(piece)
        else segments.unshift(piece)
        unused.delete(best.id)
      }
    }
    push(1)
    push(-1)
    const closed = segments.length > 1 && samePoint(segments[0].wall[segments[0].from], segments[segments.length - 1].wall[segments[segments.length - 1].to])
    chains.push({ segments, closed })
  }
  return chains
}

function forwardOf(seg) {
  const a = seg.wall[seg.from]
  const b = seg.wall[seg.to]
  return { a, b, dir: unit(b.x - a.x, b.z - a.z), len: hypot(b.x - a.x, b.z - a.z) }
}

// One sign for the whole chain, taken from its longest run, so a recess jamb
// keeps the exterior on the same side as the wall it turns out of.
function chainExteriorLeft(chain, walls) {
  let longest = chain.segments[0]
  let best = -1
  chain.segments.forEach((seg) => {
    const len = hypot(seg.wall.b.x - seg.wall.a.x, seg.wall.b.z - seg.wall.a.z)
    if (len > best) {
      best = len
      longest = seg
    }
  })
  const wall = longest.wall
  const sign = outwardSign(wall, walls)
  const wallDir = unit(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const travel = forwardOf(longest).dir
  const same = wallDir.x * travel.x + wallDir.z * travel.z >= 0
  const leftIsOut = same ? sign > 0 : sign < 0
  return leftIsOut ? 1 : -1
}

function facePair(seg, thicknessOf, exteriorLeft) {
  const thick = Math.max(0.04, thicknessOf(seg.wall) || 0.2)
  const base = faceOffsets(seg.wall, thick)
  const wallDir = unit(seg.wall.b.x - seg.wall.a.x, seg.wall.b.z - seg.wall.a.z)
  const travel = forwardOf(seg).dir
  const align = wallDir.x * travel.x + wallDir.z * travel.z >= 0 ? 1 : -1
  const left = base.left * align
  const right = base.right * align
  const exterior = exteriorLeft > 0 ? Math.max(left, right) : Math.min(left, right)
  const interior = exteriorLeft > 0 ? Math.min(left, right) : Math.max(left, right)
  return { interior, exterior, thick }
}

function pointAtChain(seg, chainDist) {
  const dir = forwardOf(seg).dir
  const origin = seg.wall[seg.from]
  return { x: origin.x + dir.x * chainDist, z: origin.z + dir.z * chainDist }
}

function tryMitre(at, arriveDir, arriveOff, leaveDir, leaveOff, arriveLen, leaveLen) {
  const p = add(at, scale(leftNormal(arriveDir), arriveOff))
  const q = add(at, scale(leftNormal(leaveDir), leaveOff))
  const hit = lineIntersect(p, arriveDir, q, leaveDir)
  if (!hit) return null
  const back = (at.x - hit.x) * arriveDir.x + (at.z - hit.z) * arriveDir.z
  const fwd = (hit.x - at.x) * leaveDir.x + (hit.z - at.z) * leaveDir.z
  if (back > arriveLen + 0.001 || fwd > leaveLen + 0.001) return null
  const reach = Math.max(Math.abs(arriveOff), Math.abs(leaveOff))
  if (arriveLen + 0.001 < reach || leaveLen + 0.001 < reach) return null
  const dist = hypot(hit.x - at.x, hit.z - at.z)
  const limit = Math.max(Math.abs(arriveOff), Math.abs(leaveOff), 0.05) * 8 + 0.02
  if (dist > limit) return null
  return { x: hit.x, z: hit.z }
}

function ownSquare(point, dir, distA, distB) {
  const n = leftNormal(dir)
  return { a: add(point, scale(n, distA)), b: add(point, scale(n, distB)) }
}

function joinedEnd(point, ownDir, ownA, ownB, ownLen, otherDir, otherA, otherB, otherLen, otherArrives) {
  const square = ownSquare(point, ownDir, ownA, ownB)
  if (!otherDir) return square
  const arriveDir = otherArrives ? otherDir : ownDir
  const leaveDir = otherArrives ? ownDir : otherDir
  const arriveA = otherArrives ? otherA : ownA
  const arriveB = otherArrives ? otherB : ownB
  const leaveA = otherArrives ? ownA : otherA
  const leaveB = otherArrives ? ownB : otherB
  const arriveLen = otherArrives ? otherLen : ownLen
  const leaveLen = otherArrives ? ownLen : otherLen
  const hitA = tryMitre(point, arriveDir, arriveA, leaveDir, leaveA, arriveLen, leaveLen)
  const hitB = tryMitre(point, arriveDir, arriveB, leaveDir, leaveB, arriveLen, leaveLen)
  if (!hitA || !hitB) return square
  return { a: hitA, b: hitB }
}

function chainSpans(seg, openings) {
  const len = hypot(seg.wall.b.x - seg.wall.a.x, seg.wall.b.z - seg.wall.a.z)
  const { solids } = solidsOf(seg.wall, openings)
  return solids.map((span) => {
    const chainFrom = seg.from === 'a' ? span.from : len - span.to
    const chainTo = seg.from === 'a' ? span.to : len - span.from
    const lo = Math.min(chainFrom, chainTo)
    const hi = Math.max(chainFrom, chainTo)
    return {
      start: pointAtChain(seg, lo),
      end: pointAtChain(seg, hi),
      atStart: lo <= 0.025,
      atEnd: hi >= len - 0.025,
    }
  })
}

function neighborUsable(neighbor, openings, atStart) {
  if (!neighbor) return null
  const spans = chainSpans(neighbor, openings)
  const covers = atStart ? spans.some((span) => span.atStart) : spans.some((span) => span.atEnd)
  return covers ? neighbor : null
}

function quadsOnChain(chain, walls, openings, thicknessOf, edgesOf) {
  const quads = []
  const count = chain.segments.length
  chain.segments.forEach((seg, index) => {
    const prev = index > 0 ? chain.segments[index - 1] : (chain.closed ? chain.segments[count - 1] : null)
    const next = index < count - 1 ? chain.segments[index + 1] : (chain.closed ? chain.segments[0] : null)
    const edges = edgesOf(seg)
    const prevEdges = prev ? edgesOf(prev) : null
    const nextEdges = next ? edgesOf(next) : null
    const travel = forwardOf(seg)
    chainSpans(seg, openings).forEach((span) => {
      const prevSeg = span.atStart ? neighborUsable(prev, openings, false) : null
      const nextSeg = span.atEnd ? neighborUsable(next, openings, true) : null
      const prevTravel = prevSeg ? forwardOf(prevSeg) : null
      const nextTravel = nextSeg ? forwardOf(nextSeg) : null
      const start = joinedEnd(
        span.start, travel.dir, edges[0], edges[1], travel.len,
        prevTravel?.dir, prevEdges?.[0], prevEdges?.[1], prevTravel?.len || 0, true,
      )
      const end = joinedEnd(
        span.end, travel.dir, edges[0], edges[1], travel.len,
        nextTravel?.dir, nextEdges?.[0], nextEdges?.[1], nextTravel?.len || 0, false,
      )
      const quad = [start.a, end.a, end.b, start.b]
      const area = Math.abs(loopArea(quad))
      if (area > 0.0004) quads.push({ quad, wallId: seg.wall.id })
    })
  })
  return quads
}

// Adjacent mitred quads share an end edge. Stitch them into one ribbon so a
// thin band stays a band: the silhouette union drops edges shorter than its
// probe and then fills the whole room.
function stitchRibbons(quads) {
  const items = (quads || []).filter((quad) => quad && quad.length >= 4 && Math.abs(loopArea(quad)) > 0.0002)
  const used = new Array(items.length).fill(false)
  const close = (a, b) => hypot(a.x - b.x, a.z - b.z) < 0.012
  const continues = (prev, next) => close(prev[1], next[0]) && close(prev[2], next[3])
  const ribbons = []
  items.forEach((_, start) => {
    if (used[start]) return
    const run = [start]
    used[start] = true
    let grew = true
    while (grew) {
      grew = false
      const head = items[run[0]]
      const tail = items[run[run.length - 1]]
      for (let index = 0; index < items.length; index += 1) {
        if (used[index]) continue
        if (continues(tail, items[index])) {
          run.push(index)
          used[index] = true
          grew = true
          break
        }
        if (continues(items[index], head)) {
          run.unshift(index)
          used[index] = true
          grew = true
          break
        }
      }
    }
    const outer = [items[run[0]][0]]
    const inner = [items[run[0]][3]]
    run.forEach((index) => {
      outer.push(items[index][1])
      inner.push(items[index][2])
    })
    const points = [...outer, ...inner.reverse()]
    if (Math.abs(loopArea(points)) > 0.0004) ribbons.push(points)
  })
  return ribbons
}

function edgesBetween(seg, thicknessOf, exteriorLeft, fromFrac, toFrac) {
  const faces = facePair(seg, thicknessOf, exteriorLeft)
  const at = (fraction) => faces.interior + (faces.exterior - faces.interior) * fraction
  return [at(fromFrac), at(toFrac)]
}

export function fractionQuad(wall, walls, fraction0, fraction1, thicknessOf) {
  if (!wall?.a || !wall?.b) return null
  const thick = thicknessOf || ((item) => item?.thickness || 0.24)
  const list = (walls || []).some((item) => item.id === wall.id) ? walls : [wall, ...(walls || [])]
  const chain = joinedChains(list).find((item) => item.segments.some((seg) => seg.wall.id === wall.id))
  if (!chain) return null
  const exteriorLeft = chainExteriorLeft(chain, list)
  const quads = quadsOnChain(chain, list, [], thick, (seg) => (
    seg.wall.id === wall.id
      ? edgesBetween(seg, thick, exteriorLeft, fraction0, fraction1)
      : edgesBetween(seg, thick, exteriorLeft, fraction0, fraction1)
  )).filter((item) => item.wallId === wall.id)
  return quads[0]?.quad || null
}

function decorativeEdges(seg, thicknessOf, exteriorLeft, fraction, width) {
  const faces = facePair(seg, thicknessOf, exteriorLeft)
  const mid = (faces.interior + faces.exterior) / 2
  const pos = mid + (faces.exterior - mid) * fraction
  return [pos - width / 2, pos + width / 2]
}

export function wallFigures(walls, openings, thicknessOf) {
  const list = walls || []
  const thick = thicknessOf || ((wall) => wall?.thickness || 0.24)
  const core = []
  joinedChains(list).forEach((chain) => {
    const exteriorLeft = chainExteriorLeft(chain, list)
    quadsOnChain(chain, list, openings, thick, (seg) => {
      const faces = facePair(seg, thick, exteriorLeft)
      return [faces.interior, faces.exterior]
    }).forEach((item) => {
      const wall = list.find((entry) => entry.id === item.wallId)
      const exterior = !wall || (wall.kind !== 'interior' && wall.kind !== 'partition')
      core.push({ quad: item.quad, exterior: Boolean(exterior), wallId: item.wallId })
    })
  })
  const exteriorWalls = list.filter((wall) => wall.kind !== 'interior' && wall.kind !== 'partition')
  const insulation = []
  const cladding = []
  joinedChains(exteriorWalls).forEach((chain) => {
    const exteriorLeft = chainExteriorLeft(chain, list)
    quadsOnChain(chain, exteriorWalls, openings, thick, (seg) => decorativeEdges(seg, thick, exteriorLeft, 0.42, 0.045))
      .forEach((item) => insulation.push(item.quad))
    quadsOnChain(chain, exteriorWalls, openings, thick, (seg) => decorativeEdges(seg, thick, exteriorLeft, 1.08, 0.02))
      .forEach((item) => cladding.push(item.quad))
  })
  const pack = (entries, role) => silhouetteOf(entries).map((loop) => ({ ...loop, role }))
  const ribbons = (entries, role) => stitchRibbons(entries).map((points) => ({ points, role, area: loopArea(points) }))
  return {
    core: pack(core.map((item) => item.quad), 'core'),
    exterior: pack(core.filter((item) => item.exterior).map((item) => item.quad), 'exterior'),
    interior: pack(core.filter((item) => !item.exterior).map((item) => item.quad), 'interior'),
    insulation: ribbons(insulation, 'insulation'),
    cladding: ribbons(cladding, 'cladding'),
    quads: core,
  }
}

export function loopPath(points, close = true) {
  if (!points?.length) return ''
  const body = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.z}`).join(' ')
  return close ? `${body} Z` : body
}
