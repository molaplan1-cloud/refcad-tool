// Covered yard structures: pergola, terrace roof, glazed porch, carport, awning, gazebo.

export const COVER_TYPES = [
  { id: 'pergola', name: 'Pergola', height: 2.4, pitch: 0, roofing: 'slats', frame: 'wood', postSpacing: 2.2, rafterSpacing: 0.55, sides: 'none' },
  { id: 'terrace-roof', name: 'Terassikatos', height: 2.5, pitch: 8, roofing: 'polycarbonate', frame: 'aluminium', postSpacing: 2.6, rafterSpacing: 0.7, sides: 'none' },
  { id: 'glass-porch', name: 'Lasikuisti', height: 2.5, pitch: 10, roofing: 'glass', frame: 'aluminium', postSpacing: 2.2, rafterSpacing: 0.7, sides: 'glazing' },
  { id: 'carport', name: 'Autokatos', height: 2.4, pitch: 6, roofing: 'metal', frame: 'steel', postSpacing: 3, rafterSpacing: 0.8, sides: 'none' },
  { id: 'awning', name: 'Markiisi', height: 2.3, pitch: 12, roofing: 'fabric', frame: 'aluminium', postSpacing: 3.2, rafterSpacing: 0.5, sides: 'none' },
  { id: 'gazebo', name: 'Paviljonki', height: 2.6, pitch: 22, roofing: 'metal', frame: 'wood', postSpacing: 2.4, rafterSpacing: 0.6, sides: 'none' },
]

export const COVER_FRAMES = [
  { id: 'wood', name: 'Puu', color: '#C4A574' },
  { id: 'painted-wood', name: 'Maalattu puu', color: '#F4F1EA' },
  { id: 'aluminium', name: 'Alumiini', color: '#C5CDD6' },
  { id: 'steel', name: 'Teräs', color: '#4B5563' },
]

export const COVER_ROOFS = [
  { id: 'slats', name: 'Avoin rima', transparent: false, slats: true },
  { id: 'polycarbonate', name: 'Kennolevy', transparent: true, opacity: 0.28, color: '#DBEAFE' },
  { id: 'glass', name: 'Lasikatto', transparent: true, opacity: 0.16, color: '#E0F2FE' },
  { id: 'metal', name: 'Pelti', transparent: false, color: '#334155' },
  { id: 'fabric', name: 'Kangas', transparent: true, opacity: 0.9, color: '#E7E5E4' },
  { id: 'louvre', name: 'Sälekatto', transparent: false, slats: true },
]

export const COVER_SIDES = [
  { id: 'none', name: 'Avoin' },
  { id: 'wall', name: 'Seinä' },
  { id: 'glazing', name: 'Lasiseinä' },
  { id: 'sliding', name: 'Liukulasi' },
  { id: 'curtain', name: 'Verho' },
]

export const COVER_TINTS = [
  { id: 'clear', name: 'Kirkas' },
  { id: 'opal', name: 'Opaali' },
]

export const COVER_GLASS = [
  { id: 'tempered', name: 'Karkaistu' },
  { id: 'laminated', name: 'Laminoitu' },
]

function specOf(kind) {
  return COVER_TYPES.find((item) => item.id === kind) || COVER_TYPES[0]
}

function frameOf(id) {
  return COVER_FRAMES.find((item) => item.id === id) || COVER_FRAMES[0]
}

export function roofLook(item) {
  const roof = COVER_ROOFS.find((entry) => entry.id === item?.roofing) || COVER_ROOFS[0]
  if (item?.roofing === 'polycarbonate' && item?.roofTint === 'opal') {
    return { ...roof, opacity: 0.48, color: '#F8FAFC' }
  }
  return roof
}

export function normalizeCover(item = {}) {
  const spec = specOf(item.kind)
  const frame = frameOf(item.frame || spec.frame)
  const height = Number(item.height)
  const pitch = Number(item.pitch)
  return {
    ...item,
    kind: spec.id,
    name: spec.name,
    points: Array.isArray(item.points) ? item.points : [],
    wallId: item.wallId || '',
    attached: Boolean(item.wallId),
    height: Number.isFinite(height) && height > 1 ? height : spec.height,
    pitch: Number.isFinite(pitch) && pitch >= 0 ? pitch : spec.pitch,
    postSize: Number(item.postSize) > 0.04 ? Number(item.postSize) : 0.12,
    postSpacing: Number(item.postSpacing) > 0.4 ? Number(item.postSpacing) : spec.postSpacing,
    rafterSpacing: Number(item.rafterSpacing) > 0.2 ? Number(item.rafterSpacing) : spec.rafterSpacing,
    frame: frame.id,
    frameName: frame.name,
    frameColor: item.frameColor || frame.color,
    roofing: COVER_ROOFS.some((entry) => entry.id === item.roofing) ? item.roofing : spec.roofing,
    roofTint: item.roofTint === 'opal' ? 'opal' : 'clear',
    glassKind: item.glassKind === 'tempered' ? 'tempered' : 'laminated',
    sides: COVER_SIDES.some((entry) => entry.id === item.sides) ? item.sides : spec.sides,
    lights: Boolean(item.lights),
    heaters: Boolean(item.heaters),
  }
}

function hypot(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

function pointInPoly(x, z, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const zi = points[i].z
    const xj = points[j].x
    const zj = points[j].z
    const cross = ((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi)
    if (cross) inside = !inside
  }
  return inside
}

export function polygonArea(points) {
  if (!points || points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum) / 2
}

function distToSegment(point, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = dx * dx + dz * dz
  if (len < 1e-8) return Math.hypot(point.x - a.x, point.z - a.z)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / len))
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t))
}

export function coverBasis(item, wall) {
  const points = item.points || []
  if (points.length < 2) return null
  const centroid = points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
  centroid.x /= points.length
  centroid.z /= points.length
  let origin = points[0]
  let along = { x: 1, z: 0 }
  if (wall?.a && wall?.b && hypot(wall.a, wall.b) > 0.2) {
    const len = hypot(wall.a, wall.b)
    along = { x: (wall.b.x - wall.a.x) / len, z: (wall.b.z - wall.a.z) / len }
    origin = wall.a
  } else {
    let longest = 0
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      const span = hypot(point, next)
      if (span > longest) {
        longest = span
        const len = span || 1
        along = { x: (next.x - point.x) / len, z: (next.z - point.z) / len }
        origin = point
      }
    })
  }
  const left = { x: -along.z, z: along.x }
  const dot = (centroid.x - origin.x) * left.x + (centroid.z - origin.z) * left.z
  const outward = dot >= 0 ? left : { x: along.z, z: -along.x }
  const project = (point) => ({
    u: (point.x - origin.x) * along.x + (point.z - origin.z) * along.z,
    v: (point.x - origin.x) * outward.x + (point.z - origin.z) * outward.z,
  })
  const local = points.map(project)
  const u0 = Math.min(...local.map((point) => point.u))
  const u1 = Math.max(...local.map((point) => point.u))
  const v1 = Math.max(...local.map((point) => point.v), 0.2)
  const place = (u, v) => ({
    x: origin.x + along.x * u + outward.x * v,
    z: origin.z + along.z * u + outward.z * v,
  })
  return { origin, along, outward, project, place, u0, u1, v1 }
}

function onWall(a, b, wall) {
  if (!wall?.a || !wall?.b) return false
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  return distToSegment(mid, wall.a, wall.b) < 0.45
}

export function coverPosts(item, wall) {
  const cover = normalizeCover(item)
  const points = cover.points
  if (points.length < 3) return []
  const posts = []
  const seen = new Set()
  const push = (point) => {
    const key = `${Math.round(point.x * 20)}:${Math.round(point.z * 20)}`
    if (seen.has(key)) return
    if (wall && distToSegment(point, wall.a, wall.b) < 0.28) return
    seen.add(key)
    posts.push({ x: point.x, z: point.z })
  }
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length]
    if (onWall(a, b, wall)) return
    const len = hypot(a, b) || 1
    const count = Math.max(1, Math.round(len / cover.postSpacing))
    for (let step = 0; step <= count; step += 1) {
      const t = step / count
      push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  })
  return posts
}

export function coverMembers(item, wall) {
  const cover = normalizeCover(item)
  const basis = coverBasis(cover, wall)
  if (!basis) return { posts: [], rafters: [], beams: [], roof: [] }
  const posts = coverPosts(cover, wall)
  const pitch = Math.tan((cover.pitch * Math.PI) / 180)
  const yAt = (v) => cover.height + Math.max(0, v) * pitch
  const rafters = []
  const step = cover.rafterSpacing
  for (let u = basis.u0 + step / 2; u < basis.u1 - 0.05; u += step) {
    const start = basis.place(u, 0.05)
    const end = basis.place(u, basis.v1)
    const mid = basis.place(u, basis.v1 / 2)
    if (!pointInPoly(mid.x, mid.z, cover.points) && !pointInPoly(end.x, end.z, cover.points)) continue
    rafters.push({
      a: { ...start, y: yAt(0.05) },
      b: { ...end, y: yAt(basis.v1) },
    })
  }
  const beams = []
  cover.points.forEach((a, index) => {
    const b = cover.points[(index + 1) % cover.points.length]
    if (onWall(a, b, wall)) return
    const va = basis.project(a).v
    const vb = basis.project(b).v
    beams.push({ a: { ...a, y: yAt(va) }, b: { ...b, y: yAt(vb) } })
  })
  const roof = cover.points.map((point) => {
    const local = basis.project(point)
    return { x: point.x, z: point.z, y: yAt(local.v) }
  })
  return { posts, rafters, beams, roof, height: cover.height }
}

export function coverOverhang(plan, wall, opening) {
  const covers = plan?.yard?.covers || []
  if (!wall?.a || !wall?.b || !opening || !covers.length) return null
  const len = hypot(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const t = Math.max(0, Math.min(1, (opening.offset || 0) / len))
  const px = wall.a.x + (wall.b.x - wall.a.x) * t
  const pz = wall.a.z + (wall.b.z - wall.a.z) * t
  let best = null
  covers.forEach((raw) => {
    const cover = normalizeCover(raw)
    if (!cover.wallId || cover.wallId !== wall.id || cover.points.length < 3) return
    const basis = coverBasis(cover, wall)
    if (!basis) return
    const depth = basis.v1
    if (depth < 0.35) return
    const half = (opening.width || 1.2) / 2
    const probe = [0, -half * 0.45, half * 0.45].some((along) => {
      const spot = basis.place((px - basis.origin.x) * basis.along.x + (pz - basis.origin.z) * basis.along.z + along, Math.min(0.7, depth * 0.45))
      return pointInPoly(spot.x, spot.z, cover.points)
    })
    if (!probe) return
    const sill = opening.kind === 'window' ? (Number.isFinite(opening.sill) ? opening.sill : 0.9) : 0
    const head = sill + (opening.height || (opening.kind === 'window' ? 1.2 : 2.1))
    const gap = Math.max(0, cover.height - head)
    if (!best || depth > best.depth) best = { depth, gap, id: cover.id }
  })
  return best
}

export function coverBill(plan) {
  return (plan?.yard?.covers || []).map((raw) => {
    const item = normalizeCover(raw)
    const roof = roofLook(item)
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      frame: item.frameName,
      frameColor: item.frameColor,
      roofing: COVER_ROOFS.find((entry) => entry.id === item.roofing)?.name || item.roofing,
      roofingId: item.roofing,
      transparent: Boolean(roof.transparent),
      area: polygonArea(item.points),
      posts: coverPosts(item, null).length,
      lights: item.lights,
      heaters: item.heaters,
    }
  }).filter((row) => row.area > 0.05)
}
