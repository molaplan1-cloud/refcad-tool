// CAD selection and editing for the floor plan and the cold-room designer.
// Geometry stays associative: wall joints within a weld tolerance move together,
// openings keep their place along a wall, and service endpoints follow devices.

import { syncFixtureServices } from './fixtureServices.js'
import { detectRooms, fixtureTemplate, segmentLength } from './floorplan.js'
import { followEndpoint, riseMetres, routeLength } from './routeEdit.js'
import {
  commitRunGeometry,
  ensureServices,
  followMovedNode,
  layerVisible,
  refreshHeat,
  rewireElectric,
  rewireHeat,
  rewireWater,
} from './services.js'
import { GROUND_COLLECTIONS, mapGroundItem, removeGroundItem } from './groundworks.js'
import { ensureYard, footprint, syncYardServices } from './yard.js'

export const FLOOR_CLIPBOARD_KEY = 'refcad-clipboard-v1'
export const DESIGNER_CLIPBOARD_KEY = 'refcad-designer-clipboard-v1'
const WELD = 0.08

export const SELECT_TYPES = [
  { id: 'all', label: 'Kaikki' },
  { id: 'wall', label: 'Seinät' },
  { id: 'exterior', label: 'Ulkoseinät' },
  { id: 'interior', label: 'Väliseinät' },
  { id: 'bearing', label: 'Kantavat seinät' },
  { id: 'door', label: 'Ovet' },
  { id: 'window', label: 'Ikkunat' },
  { id: 'fixture', label: 'Kalusteet' },
  { id: 'room', label: 'Huoneet' },
  { id: 'electric', label: 'Sähkö' },
  { id: 'water', label: 'Vesi' },
  { id: 'drain', label: 'Viemäri' },
  { id: 'iv', label: 'Ilmanvaihto' },
  { id: 'heat', label: 'Lämmitys' },
  { id: 'yard', label: 'Piha' },
]

export const CAD_LAYERS = [
  { id: 'exterior', label: 'Ulkoseinä' },
  { id: 'interior', label: 'Väliseinä' },
  { id: 'bearing', label: 'Kantava' },
  { id: 'fixture', label: 'Kaluste' },
  { id: 'electric', label: 'Sähkö' },
  { id: 'water', label: 'Vesi' },
  { id: 'drain', label: 'Viemäri' },
  { id: 'iv', label: 'Ilmanvaihto' },
  { id: 'heat', label: 'Lämmitys' },
  { id: 'yard', label: 'Piha' },
]

export const CAD_COMMANDS = [
  { id: 'move', label: 'Siirrä', short: 'M', testid: 'cad-move' },
  { id: 'copy', label: 'Kopioi', short: 'C', testid: 'cad-copy' },
  { id: 'rotate', label: 'Käännä', short: 'E', testid: 'cad-rotate' },
  { id: 'scale', label: 'Skaalaa', short: 'S', testid: 'cad-scale' },
  { id: 'mirror', label: 'Peilaa', short: 'F', testid: 'cad-mirror' },
  { id: 'array', label: 'Sarja', short: 'B', testid: 'cad-array' },
  { id: 'offset', label: 'Siirtokopio', short: 'O', testid: 'cad-offset' },
  { id: 'stretch', label: 'Venytä', short: 'T', testid: 'cad-stretch' },
  { id: 'align', label: 'Tasaa', short: 'N', testid: 'cad-align' },
  { id: 'measure', label: 'Mittaa', short: 'D', testid: 'cad-measure' },
]

const YARD_POINTS = ['objects', 'buildings', 'plants']
const YARD_LINES = ['terraces', 'paths', 'fences', 'beds']

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function pt(x, z, extra) {
  return { ...(extra || {}), x: round3(x), z: round3(z) }
}

function near(a, b, tol = WELD) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) <= tol
}

export function selectionKey(item) {
  if (!item) return ''
  return `${item.kind}:${item.collection || ''}:${item.id}`
}

export function selectionBox(a, b) {
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
    mode: a.x <= b.x ? 'window' : 'crossing',
  }
}

export function pointInSelection(point, box) {
  return point.x >= box.minX - 1e-9 && point.x <= box.maxX + 1e-9 && point.z >= box.minZ - 1e-9 && point.z <= box.maxZ + 1e-9
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

function segmentsCross(a, b, c, d) {
  const ab = cross(a, b, c) * cross(a, b, d)
  const cd = cross(c, d, a) * cross(c, d, b)
  return ab < -1e-9 && cd < -1e-9
}

function segmentHitsRect(a, b, box) {
  if (pointInSelection(a, box) || pointInSelection(b, box)) return true
  const corners = [
    { x: box.minX, z: box.minZ },
    { x: box.maxX, z: box.minZ },
    { x: box.maxX, z: box.maxZ },
    { x: box.minX, z: box.maxZ },
  ]
  for (let i = 0; i < 4; i += 1) {
    if (segmentsCross(a, b, corners[i], corners[(i + 1) % 4])) return true
  }
  return false
}

function allInside(points, box) {
  return points.length > 0 && points.every((point) => pointInSelection(point, box))
}

function anyHit(points, box, closed = false) {
  if (points.some((point) => pointInSelection(point, box))) return true
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentHitsRect(points[i], points[i + 1], box)) return true
  }
  if (closed && points.length > 2 && segmentHitsRect(points[points.length - 1], points[0], box)) return true
  return false
}

function hits(points, box, closed = false) {
  if (box.mode === 'window') return allInside(points, box)
  return anyHit(points, box, closed)
}

export function mergeSelection(current, hitsList, { shift = false, ctrl = false } = {}) {
  const list = Array.isArray(current) ? current : []
  const incoming = hitsList || []
  if (!shift && !ctrl) return incoming.map((item) => ({ ...item }))
  const next = list.map((item) => ({ ...item }))
  incoming.forEach((hit) => {
    const key = selectionKey(hit)
    const index = next.findIndex((item) => selectionKey(item) === key)
    if (index >= 0) next.splice(index, 1)
    else next.push({ ...hit })
  })
  return next
}

export function mergeIds(current, hitsList, { shift = false, ctrl = false } = {}) {
  const list = Array.isArray(current) ? current : []
  const incoming = hitsList || []
  if (!shift && !ctrl) return [...incoming]
  const next = [...list]
  incoming.forEach((id) => {
    const index = next.indexOf(id)
    if (index >= 0) next.splice(index, 1)
    else next.push(id)
  })
  return next
}

function openingPoint(wall, opening) {
  const len = segmentLength(wall.a, wall.b) || 1
  const t = (opening.offset || 0) / len
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  }
}

function openingSegment(wall, opening) {
  const len = segmentLength(wall.a, wall.b) || 1
  const half = (opening.width || 0.9) / 2
  const t0 = Math.max(0, (opening.offset - half) / len)
  const t1 = Math.min(1, (opening.offset + half) / len)
  return [
    { x: wall.a.x + (wall.b.x - wall.a.x) * t0, z: wall.a.z + (wall.b.z - wall.a.z) * t0 },
    { x: wall.a.x + (wall.b.x - wall.a.x) * t1, z: wall.a.z + (wall.b.z - wall.a.z) * t1 },
  ]
}

function fixtureCorners(fixture) {
  const tpl = fixtureTemplate(fixture.type)
  const w = fixture.w || tpl.w
  const d = fixture.d || tpl.d
  const rot = ((fixture.rotation || 0) * Math.PI) / 180
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => ({
    x: (fixture.x || 0) + lx * c - lz * s,
    z: (fixture.z || 0) + lx * s + lz * c,
  }))
}

function yardEntry(plan, collection, id) {
  const yard = ensureYard(plan)
  if (collection === 'plot') return yard.plot?.id === id || id === 'plot' ? yard.plot : null
  return (yard[collection] || []).find((item) => item.id === id) || null
}

export function entityOf(plan, sel) {
  if (!plan || !sel) return null
  if (sel.kind === 'wall') return (plan.walls || []).find((item) => item.id === sel.id) || null
  if (sel.kind === 'opening') return (plan.openings || []).find((item) => item.id === sel.id) || null
  if (sel.kind === 'fixture') return (plan.fixtures || []).find((item) => item.id === sel.id) || null
  if (sel.kind === 'room') return (plan.rooms || []).find((item) => item.id === sel.id) || null
  if (sel.kind === 'node') return ensureServices(plan).nodes.find((item) => item.id === sel.id) || null
  if (sel.kind === 'run') return ensureServices(plan).runs.find((item) => item.id === sel.id) || null
  if (sel.kind === 'yard') return yardEntry(plan, sel.collection, sel.id)
  if (sel.kind === 'service') {
    const services = ensureServices(plan)
    const spec = sel.service || sel
    return spec.target === 'run'
      ? services.runs.find((item) => item.id === spec.id)
      : services.nodes.find((item) => item.id === spec.id)
  }
  return null
}

function servicePick(item, target) {
  return { kind: target === 'run' ? 'run' : 'node', id: item.id, service: { target, id: item.id, system: item.system } }
}

export function planTargets(plan, { includeHidden = false } = {}) {
  const targets = []
  ;(plan.walls || []).forEach((wall) => {
    if (!includeHidden && wall.hidden) return
    targets.push({ kind: 'wall', id: wall.id })
  })
  ;(plan.openings || []).forEach((opening) => {
    if (!includeHidden && opening.hidden) return
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    if (!wall || (!includeHidden && wall.hidden)) return
    targets.push({ kind: 'opening', id: opening.id })
  })
  ;(plan.fixtures || []).forEach((fixture) => {
    if (!includeHidden && fixture.hidden) return
    targets.push({ kind: 'fixture', id: fixture.id })
  })
  ;(plan.rooms || []).forEach((room) => {
    if (room.suppressed) return
    targets.push({ kind: 'room', id: room.id })
  })
  const services = ensureServices(plan)
  services.nodes.forEach((node) => {
    if (!includeHidden && node.hidden) return
    if (!layerVisible(plan, node.system)) return
    targets.push(servicePick(node, 'node'))
  })
  services.runs.forEach((run) => {
    if (!includeHidden && run.hidden) return
    if (!layerVisible(plan, run.system)) return
    targets.push(servicePick(run, 'run'))
  })
  const yard = ensureYard(plan)
  YARD_POINTS.concat(YARD_LINES).forEach((collection) => {
    ;(yard[collection] || []).forEach((item) => {
      if (!includeHidden && item.hidden) return
      targets.push({ kind: 'yard', id: item.id, collection })
    })
  })
  if (yard.plot && (includeHidden || !yard.plot.hidden)) targets.push({ kind: 'yard', id: yard.plot.id, collection: 'plot' })
  return targets
}

function geometryOf(plan, sel) {
  if (sel.kind === 'wall') {
    const wall = entityOf(plan, sel)
    return wall ? [wall.a, wall.b] : []
  }
  if (sel.kind === 'opening') {
    const opening = entityOf(plan, sel)
    const wall = (plan.walls || []).find((item) => item.id === opening?.wallId)
    return opening && wall ? openingSegment(wall, opening) : []
  }
  if (sel.kind === 'fixture') {
    const fixture = entityOf(plan, sel)
    return fixture ? fixtureCorners(fixture) : []
  }
  if (sel.kind === 'room') {
    const room = entityOf(plan, sel)
    return room?.polygon || room?.gross || []
  }
  if (sel.kind === 'node') {
    const node = entityOf(plan, sel)
    return node ? [{ x: node.x, z: node.z }] : []
  }
  if (sel.kind === 'run') {
    const run = entityOf(plan, sel)
    return run?.points || []
  }
  if (sel.kind === 'yard') {
    const item = entityOf(plan, sel)
    if (!item) return []
    if (Array.isArray(item.points)) return item.points
    if (sel.collection === 'objects' || sel.collection === 'buildings') return footprint(item)
    return [{ x: item.x, z: item.z }]
  }
  return []
}

export function targetsInBox(plan, box) {
  return planTargets(plan).filter((sel) => {
    const points = geometryOf(plan, sel)
    const closed = sel.kind === 'room' || (sel.kind === 'yard' && (sel.collection === 'terraces' || sel.collection === 'beds' || sel.collection === 'plot'))
    return hits(points, box, closed)
  })
}

export function targetsByType(plan, type) {
  const all = planTargets(plan)
  if (!type || type === 'all') return all
  if (type === 'wall') return all.filter((item) => item.kind === 'wall')
  if (type === 'exterior' || type === 'interior' || type === 'bearing') {
    return all.filter((item) => item.kind === 'wall' && entityOf(plan, item)?.kind === type)
  }
  if (type === 'door' || type === 'window') {
    return all.filter((item) => item.kind === 'opening' && entityOf(plan, item)?.kind === type)
  }
  if (type === 'fixture') return all.filter((item) => item.kind === 'fixture')
  if (type === 'room') return all.filter((item) => item.kind === 'room')
  if (type === 'yard') return all.filter((item) => item.kind === 'yard')
  if (type === 'electric' || type === 'water' || type === 'drain' || type === 'iv' || type === 'heat') {
    return all.filter((item) => (item.kind === 'node' || item.kind === 'run') && entityOf(plan, item)?.system === type)
  }
  return all.filter((item) => entityOf(plan, item)?.layer === type || item.kind === type)
}

export function similarTargets(plan, selection) {
  const first = (selection || [])[0]
  if (!first) return []
  const ent = entityOf(plan, first)
  if (first.kind === 'opening') return targetsByType(plan, ent?.kind || 'door')
  if (first.kind === 'wall') return targetsByType(plan, ent?.kind || 'wall')
  if (first.kind === 'fixture') {
    return planTargets(plan).filter((item) => item.kind === 'fixture' && entityOf(plan, item)?.type === ent?.type)
  }
  if (first.kind === 'node' || first.kind === 'run') return targetsByType(plan, ent?.system || 'electric')
  if (first.kind === 'yard') return planTargets(plan).filter((item) => item.kind === 'yard' && item.collection === first.collection)
  return planTargets(plan).filter((item) => item.kind === first.kind)
}

function normalizePick(sel) {
  if (sel?.kind !== 'service') return sel
  const target = sel.service?.target === 'run' ? 'run' : 'node'
  return { ...sel, kind: target, id: sel.service?.id || sel.id }
}

function unionSelection(current, extra) {
  const next = (current || []).map((item) => ({ ...item }))
  ;(extra || []).forEach((hit) => {
    if (!next.some((item) => selectionKey(item) === selectionKey(hit))) next.push({ ...hit })
  })
  return next
}

export function expandGroups(plan, selection) {
  const picks = (selection || []).map(normalizePick)
  const groups = new Set()
  picks.forEach((sel) => {
    const groupId = entityOf(plan, sel)?.groupId
    if (groupId) groups.add(groupId)
  })
  if (!groups.size) return picks.map((item) => ({ ...item }))
  const extra = planTargets(plan, { includeHidden: true }).filter((sel) => groups.has(entityOf(plan, sel)?.groupId))
  return unionSelection(picks, extra)
}

export function expandSelection(plan, selection) {
  const grouped = expandGroups(plan, selection)
  const extra = []
  grouped.forEach((sel) => {
    if (sel.kind !== 'room') return
    const room = entityOf(plan, sel)
    ;(room?.walls || []).forEach((edge) => {
      if (edge.wallId) extra.push({ kind: 'wall', id: edge.wallId })
    })
  })
  return extra.length ? unionSelection(grouped, extra) : grouped
}

function editable(plan, sel) {
  const ent = entityOf(plan, sel)
  return Boolean(ent) && !ent.cadLock && !ent.hidden
}

function mapPoint(point, op) {
  const x = point?.x || 0
  const z = point?.z || 0
  let nx = x
  let nz = z
  if (op.type === 'translate') {
    nx = x + (op.dx || 0)
    nz = z + (op.dz || 0)
  } else if (op.type === 'rotate') {
    const rad = ((op.degrees || 0) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = x - (op.cx || 0)
    const dz = z - (op.cz || 0)
    nx = (op.cx || 0) + dx * cos - dz * sin
    nz = (op.cz || 0) + dx * sin + dz * cos
  } else if (op.type === 'scale') {
    const factor = Number.isFinite(op.factor) ? op.factor : 1
    nx = (op.cx || 0) + (x - (op.cx || 0)) * factor
    nz = (op.cz || 0) + (z - (op.cz || 0)) * factor
  } else if (op.type === 'mirror') {
    const mirrored = mirrorAcross(point, op)
    nx = mirrored.x
    nz = mirrored.z
  } else if (op.type === 'stretch') {
    if (op.box && pointInSelection(point, op.box)) {
      nx = x + (op.dx || 0)
      nz = z + (op.dz || 0)
    }
  }
  return { ...point, x: round3(nx), z: round3(nz) }
}

function mirrorAcross(point, op) {
  const x1 = op.x1 || 0
  const z1 = op.z1 || 0
  const x2 = op.x2 ?? x1
  const z2 = op.z2 ?? z1 + 1
  const dx = x2 - x1
  const dz = z2 - z1
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-9) return { x: point.x, z: point.z }
  const t = ((point.x - x1) * dx + (point.z - z1) * dz) / len2
  const px = x1 + t * dx
  const pz = z1 + t * dz
  return { x: px * 2 - point.x, z: pz * 2 - point.z }
}

function openingsOnly(selection) {
  const list = selection || []
  return list.length > 0 && list.every((sel) => sel?.kind === 'opening')
}

export function mirrorOpenings(plan, selection, { direction = false } = {}) {
  const ids = new Set((selection || []).filter((sel) => sel?.kind === 'opening').map((sel) => sel.id))
  if (!ids.size) return plan
  let changed = false
  const openings = (plan.openings || []).map((opening) => {
    if (!ids.has(opening.id) || opening.cadLock || opening.hidden) return opening
    changed = true
    if (direction) return { ...opening, inward: !opening.inward }
    return { ...opening, swing: -(opening.swing || 1) }
  })
  return changed ? { ...plan, openings } : plan
}

function transformWalls(plan, picks, op) {
  const ids = new Set(picks.filter((sel) => sel.kind === 'wall').map((sel) => sel.id))
  const walls = plan.walls || []
  const moved = []
  const followJoints = op.type === 'translate'
  walls.forEach((wall) => {
    if (!ids.has(wall.id) || wall.cadLock || wall.hidden) return
    ;['a', 'b'].forEach((end) => {
      const from = wall[end]
      const to = mapPoint(from, op)
      if (!near(from, to, 0.0001)) moved.push({ from, to })
    })
  })
  if (!moved.length && ![...ids].length) return { plan, dirty: false }
  let dirty = false
  const nextWalls = walls.map((wall) => {
    if (wall.cadLock || wall.hidden) return wall
    if (ids.has(wall.id)) {
      const a = mapPoint(wall.a, op)
      const b = mapPoint(wall.b, op)
      dirty = dirty || !near(a, wall.a, 0.0001) || !near(b, wall.b, 0.0001)
      return { ...wall, a: pt(a.x, a.z), b: pt(b.x, b.z) }
    }
    if (!followJoints) return wall
    let a = wall.a
    let b = wall.b
    const ha = moved.find((item) => near(item.from, wall.a))
    const hb = moved.find((item) => near(item.from, wall.b))
    if (ha) {
      a = { ...wall.a, x: ha.to.x, z: ha.to.z }
      dirty = true
    }
    if (hb) {
      b = { ...wall.b, x: hb.to.x, z: hb.to.z }
      dirty = true
    }
    if (a === wall.a && b === wall.b) return wall
    return { ...wall, a: pt(a.x, a.z), b: pt(b.x, b.z) }
  })
  return { plan: dirty ? { ...plan, walls: nextWalls } : plan, dirty }
}

function syncOpenings(plan, beforeWalls) {
  const openings = (plan.openings || []).flatMap((opening) => {
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    const prev = (beforeWalls || []).find((item) => item.id === opening.wallId)
    if (!wall) return []
    const len = segmentLength(wall.a, wall.b)
    const prevLen = prev ? segmentLength(prev.a, prev.b) : len
    let offset = opening.offset || 0
    if (prev && Math.abs(len - prevLen) > 0.002 && prevLen > 0.05) {
      const startMoved = !near(wall.a, prev.a, 0.002)
      const endMoved = !near(wall.b, prev.b, 0.002)
      if (startMoved && !endMoved) {
        const along = ((prev.a.x - wall.a.x) * (wall.b.x - wall.a.x) + (prev.a.z - wall.a.z) * (wall.b.z - wall.a.z)) / (len || 1)
        offset = (opening.offset || 0) + along
      } else offset = (opening.offset || 0) * (len / prevLen)
    }
    const half = (opening.width || 0.9) / 2 + 0.05
    if (len < (opening.width || 0.9) + 0.12) return [{ ...opening, offset: Math.min(len / 2, Math.max(0, offset)) }]
    return [{ ...opening, offset: Math.min(len - half, Math.max(half, offset)) }]
  })
  return { ...plan, openings }
}

function offsetAlong(wall, point) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len)
  return Math.min(len - 0.15, Math.max(0.15, t * len))
}

function transformLooseOpenings(plan, picks, op, movedWalls) {
  const ids = new Set(picks.filter((sel) => sel.kind === 'opening').map((sel) => sel.id))
  if (!ids.size) return plan
  return {
    ...plan,
    openings: (plan.openings || []).map((opening) => {
      if (!ids.has(opening.id) || opening.cadLock || opening.hidden) return opening
      if (movedWalls.has(opening.wallId)) return opening
      const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
      if (!wall) return opening
      const mapped = mapPoint(openingPoint(wall, opening), op)
      return { ...opening, offset: offsetAlong(wall, mapped) }
    }),
  }
}

function transformFixtures(plan, picks, op) {
  const ids = new Set(picks.filter((sel) => sel.kind === 'fixture').map((sel) => sel.id))
  if (!ids.size) return plan
  return {
    ...plan,
    fixtures: (plan.fixtures || []).map((fixture) => {
      if (!ids.has(fixture.id) || fixture.cadLock || fixture.hidden) return fixture
      const mapped = mapPoint(fixture, op)
      const tpl = fixtureTemplate(fixture.type)
      const next = { ...fixture, x: mapped.x, z: mapped.z }
      if (op.type === 'rotate') next.rotation = Math.round((((fixture.rotation || 0) + (op.degrees || 0)) % 360) * 1000) / 1000
      if (op.type === 'scale') {
        const factor = Math.abs(op.factor || 1)
        next.w = round3((fixture.w || tpl.w) * factor)
        next.d = round3((fixture.d || tpl.d) * factor)
      }
      if (op.type === 'mirror') next.mirror = !fixture.mirror
      return next
    }),
  }
}

function transformRuns(plan, picks, op) {
  const ids = new Set(picks.filter((sel) => sel.kind === 'run').map((sel) => sel.id))
  if (!ids.size) return plan
  let next = plan
  ensureServices(plan).runs.forEach((run) => {
    if (!ids.has(run.id) || run.cadLock || run.hidden) return
    const points = (run.points || []).map((point) => mapPoint(point, op))
    const changed = points.some((point, index) => !near(point, run.points[index], 0.0001))
    if (!changed) return
    next = commitRunGeometry(next, run.id, points, { locked: true })
  })
  return next
}

function transformNodes(plan, picks, op) {
  const ids = new Set(picks.filter((sel) => sel.kind === 'node').map((sel) => sel.id))
  if (!ids.size) return { plan, systems: new Set() }
  const services = ensureServices(plan)
  const previous = new Map()
  const systems = new Set()
  const nodes = services.nodes.map((node) => {
    if (!ids.has(node.id) || node.cadLock || node.hidden) return node
    const mapped = mapPoint(node, op)
    if (near(node, mapped, 0.0001)) return node
    previous.set(node.id, { x: node.x, y: node.y, z: node.z })
    systems.add(node.system)
    return { ...node, x: mapped.x, z: mapped.z }
  })
  let next = { ...plan, services: { ...services, nodes } }
  previous.forEach((from, id) => {
    next = followMovedNode(next, id, from)
  })
  return { plan: next, systems }
}

function transformYard(plan, picks, op) {
  const selected = picks.filter((sel) => sel.kind === 'yard')
  if (!selected.length) return { plan, dirty: false }
  const yard = ensureYard(plan)
  let dirty = false
  const next = { ...yard }
  selected.forEach((sel) => {
    if (sel.collection === 'plot') {
      if (!yard.plot || yard.plot.cadLock || yard.plot.hidden) return
      next.plot = { ...yard.plot, points: (yard.plot.points || []).map((point) => mapPoint(point, op)) }
      dirty = true
      return
    }
    if (GROUND_COLLECTIONS.includes(sel.collection)) {
      const mapped = mapGroundItem(next, sel.collection, sel.id, (point) => mapPoint(point, op))
      if (mapped) {
        next.ground = mapped.ground
        next.waste = mapped.waste
        dirty = true
      }
      return
    }
    const list = yard[sel.collection] || []
    const item = list.find((entry) => entry.id === sel.id)
    if (!item || item.cadLock || item.hidden) return
    next[sel.collection] = (next[sel.collection] || list).map((entry) => {
      if (entry.id !== sel.id) return entry
      if (Array.isArray(entry.points)) return { ...entry, points: entry.points.map((point) => mapPoint(point, op)) }
      const mapped = mapPoint(entry, op)
      const rotated = op.type === 'rotate' ? Math.round((((entry.rotation || 0) + (op.degrees || 0)) % 360 + 360) % 360) : entry.rotation
      const scaled = op.type === 'scale'
        ? { w: round3((entry.w || 1) * Math.abs(op.factor || 1)), d: round3((entry.d || 1) * Math.abs(op.factor || 1)) }
        : {}
      return { ...entry, x: mapped.x, z: mapped.z, ...(rotated != null ? { rotation: rotated } : {}), ...scaled }
    })
    dirty = true
  })
  return { plan: dirty ? { ...plan, yard: next } : plan, dirty }
}

function relinkRooms(walls, previous, op) {
  const detected = detectRooms(walls, previous)
  if (!op) return detected
  const used = new Set()
  return detected.map((room) => {
    let best = null
    ;(previous || []).forEach((prev) => {
      if (used.has(prev.id)) return
      const mapped = mapPoint({ x: prev.cx || 0, z: prev.cz || 0 }, op)
      const dist = Math.hypot(mapped.x - room.cx, mapped.z - room.cz)
      if (!best || dist < best.dist) best = { dist, prev }
    })
    if (!best || best.dist > 1.5) return room
    used.add(best.prev.id)
    const prev = best.prev
    return {
      ...room,
      id: prev.id,
      name: prev.name,
      type: prev.type,
      floorId: prev.floorId,
      interiorId: prev.interiorId,
      ceilingId: prev.ceilingId,
      ceilingHeight: prev.ceilingHeight,
      setpoint: prev.setpoint,
      showLabel: prev.showLabel !== false,
      suppressed: Boolean(prev.suppressed),
      drawId: prev.drawId || null,
      lx: prev.lx,
      lz: prev.lz,
    }
  })
}

function fixtureKey(plan) {
  return (plan?.fixtures || []).map((item) => [item.id, item.type, item.variant || '', item.x, item.z, item.hidden ? 1 : 0].join(':')).join(';')
}

function settle(before, next, options) {
  const finished = finishPlan(next, options)
  if (fixtureKey(before) === fixtureKey(finished)) return finished
  return syncFixtureServices(finished)
}

function finishPlan(plan, { walls = false, systems = new Set(), yard = false, op = null, previousRooms = null } = {}) {
  let next = walls ? { ...plan, rooms: relinkRooms(plan.walls, previousRooms || plan.rooms, op) } : plan
  if (systems.has('electric')) next = rewireElectric(next)
  if (systems.has('water')) next = rewireWater(next)
  if (systems.has('heat')) next = rewireHeat(next)
  if (yard) next = syncYardServices(next)
  if (walls) next = refreshHeat(next)
  return next
}

export function applyOp(plan, selection, op) {
  if (op?.type === 'mirror' && openingsOnly(selection)) {
    return mirrorOpenings(plan, selection, { direction: Boolean(op.direction) })
  }
  const picks = expandSelection(plan, selection).filter((sel) => editable(plan, sel) || sel.kind === 'room')
  const before = plan.walls || []
  const walled = transformWalls(plan, picks, op)
  let next = syncOpenings(walled.plan, before)
  const movedWalls = new Set(picks.filter((sel) => sel.kind === 'wall').map((sel) => sel.id))
  next = transformLooseOpenings(next, picks, op, movedWalls)
  next = transformFixtures(next, picks, op)
  next = transformRuns(next, picks, op)
  const nodes = transformNodes(next, picks, op)
  next = nodes.plan
  const yard = transformYard(next, picks, op)
  next = yard.plan
  return settle(plan, next, {
    walls: walled.dirty,
    systems: nodes.systems,
    yard: yard.dirty && picks.some((sel) => sel.collection === 'objects' || sel.collection === 'buildings' || GROUND_COLLECTIONS.includes(sel.collection)),
    op,
    previousRooms: plan.rooms,
  })
}

function alloc(plan, prefix) {
  const seq = (plan.seq || 1) + 1
  return { plan: { ...plan, seq }, id: `${prefix}-${seq}` }
}

function spawnWall(plan, wall, mapFn) {
  const issued = alloc(plan, 'wall')
  const copy = {
    ...wall,
    id: issued.id,
    a: pt(mapFn(wall.a).x, mapFn(wall.a).z),
    b: pt(mapFn(wall.b).x, mapFn(wall.b).z),
    cadLock: false,
    hidden: false,
    groupId: undefined,
  }
  return { plan: { ...issued.plan, walls: [...(issued.plan.walls || []), copy] }, id: issued.id }
}

function duplicatePicks(plan, selection, mapFn) {
  const picks = expandSelection(plan, selection).filter((sel) => editable(plan, sel))
  let next = plan
  const wallMap = new Map()
  picks.filter((sel) => sel.kind === 'wall').forEach((sel) => {
    const wall = entityOf(plan, sel)
    if (!wall) return
    const spawned = spawnWall(next, wall, mapFn)
    next = spawned.plan
    wallMap.set(wall.id, spawned.id)
  })
  const openingSources = (plan.openings || []).filter((opening) => wallMap.has(opening.wallId) || picks.some((sel) => sel.kind === 'opening' && sel.id === opening.id))
  openingSources.forEach((opening) => {
    if (opening.cadLock) return
    const issued = alloc(next, 'open')
    next = issued.plan
    const wallId = wallMap.get(opening.wallId) || opening.wallId
    const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
    const host = (next.walls || []).find((item) => item.id === wallId)
    let offset = opening.offset
    if (wall && host && !wallMap.has(opening.wallId)) offset = offsetAlong(host, mapFn(openingPoint(wall, opening)))
    next = { ...next, openings: [...(next.openings || []), { ...opening, id: issued.id, wallId, offset, cadLock: false, hidden: false, groupId: undefined }] }
  })
  picks.filter((sel) => sel.kind === 'fixture').forEach((sel) => {
    const fixture = entityOf(plan, sel)
    if (!fixture) return
    const issued = alloc(next, 'fix')
    const mapped = mapFn(fixture)
    next = { ...issued.plan, fixtures: [...(issued.plan.fixtures || []), { ...fixture, id: issued.id, x: mapped.x, z: mapped.z, cadLock: false, hidden: false, groupId: undefined }] }
  })
  const services = ensureServices(next)
  const nodes = [...services.nodes]
  const runs = [...services.runs]
  picks.filter((sel) => sel.kind === 'node').forEach((sel) => {
    const node = entityOf(plan, sel)
    if (!node) return
    const issued = alloc(next, 'svc')
    next = issued.plan
    const mapped = mapFn(node)
    nodes.push({ ...node, id: issued.id, x: mapped.x, z: mapped.z, cadLock: false, hidden: false, groupId: undefined, autoBox: false })
  })
  picks.filter((sel) => sel.kind === 'run').forEach((sel) => {
    const run = entityOf(plan, sel)
    if (!run) return
    const issued = alloc(next, 'run')
    next = issued.plan
    const points = (run.points || []).map((point) => mapFn(point))
    runs.push({
      ...run,
      id: issued.id,
      points,
      length: Math.round(routeLength(points) * 10) / 10,
      locked: true,
      manual: true,
      deviceId: null,
      cadLock: false,
      hidden: false,
      groupId: undefined,
    })
  })
  next = { ...next, services: { ...ensureServices(next), nodes, runs } }
  const yard = ensureYard(next)
  const yardNext = { ...yard }
  picks.filter((sel) => sel.kind === 'yard' && sel.collection !== 'plot').forEach((sel) => {
    const item = entityOf(plan, sel)
    if (!item) return
    const issued = alloc(next, 'yard')
    next = issued.plan
    const copy = { ...item, id: issued.id, cadLock: false, hidden: false, groupId: undefined }
    if (Array.isArray(copy.points)) copy.points = copy.points.map((point) => mapFn(point))
    else {
      const mapped = mapFn(item)
      copy.x = mapped.x
      copy.z = mapped.z
    }
    yardNext[sel.collection] = [...(yardNext[sel.collection] || []), copy]
  })
  next = { ...next, yard: yardNext }
  return settle(plan, next, {
    walls: wallMap.size > 0,
    systems: new Set(picks.filter((sel) => sel.kind === 'node').map((sel) => entityOf(plan, sel)?.system).filter(Boolean)),
    yard: picks.some((sel) => sel.collection === 'objects'),
  })
}

export function copySelection(plan, selection, dx, dz, count = 1) {
  let next = plan
  const copies = Math.max(1, Math.round(count) || 1)
  for (let i = 1; i <= copies; i += 1) {
    next = duplicatePicks(next, selection, (point) => pt((point.x || 0) + dx * i, (point.z || 0) + dz * i, point))
  }
  return next
}

export function arraySelection(plan, selection, { mode = 'linear', count = 3, cols = 3, rows = 2, dx = 1, dz = 0 } = {}) {
  if (mode === 'rect') {
    let next = plan
    const columns = Math.max(1, Math.round(cols) || 1)
    const rowCount = Math.max(1, Math.round(rows) || 1)
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        if (row === 0 && col === 0) continue
        next = duplicatePicks(next, selection, (point) => pt((point.x || 0) + dx * col, (point.z || 0) + dz * row, point))
      }
    }
    return next
  }
  return copySelection(plan, selection, dx, dz, Math.max(1, (Math.round(count) || 1) - 1))
}

function wallNormal(wall, sidePoint, distance) {
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const len = Math.hypot(dx, dz) || 1
  let nx = -dz / len
  let nz = dx / len
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
  const side = ((sidePoint?.x || 0) - mid.x) * nx + ((sidePoint?.z || 0) - mid.z) * nz
  if (side < 0) {
    nx = -nx
    nz = -nz
  }
  const d = Math.abs(distance) || 0
  return {
    a: pt(wall.a.x + nx * d, wall.a.z + nz * d),
    b: pt(wall.b.x + nx * d, wall.b.z + nz * d),
  }
}

export function offsetSelection(plan, selection, distance, sidePoint) {
  const picks = expandSelection(plan, selection).filter((sel) => editable(plan, sel))
  const walls = picks.filter((sel) => sel.kind === 'wall')
  if (!walls.length) {
    const dx = (sidePoint?.x || 0) - (picks[0] ? (geometryOf(plan, picks[0])[0]?.x || 0) : 0)
    const dz = (sidePoint?.z || 0) - (picks[0] ? (geometryOf(plan, picks[0])[0]?.z || 0) : 0)
    const len = Math.hypot(dx, dz) || 1
    return copySelection(plan, picks, (dx / len) * distance, (dz / len) * distance, 1)
  }
  let next = plan
  walls.forEach((sel) => {
    const wall = entityOf(plan, sel)
    if (!wall) return
    const shifted = wallNormal(wall, sidePoint, distance)
    const spawned = spawnWall(next, wall, (point) => (near(point, wall.a, 0.001) ? shifted.a : shifted.b))
    next = spawned.plan
  })
  return settle(plan, next, { walls: true })
}

export function alignSelection(plan, selection, edge, point) {
  const box = selectionBounds(plan, selection)
  let dx = 0
  let dz = 0
  if (edge === 'left') dx = point.x - box.minX
  else if (edge === 'right') dx = point.x - box.maxX
  else if (edge === 'center' || edge === 'center-x') dx = point.x - (box.minX + box.maxX) / 2
  else if (edge === 'top') dz = point.z - box.minZ
  else if (edge === 'bottom') dz = point.z - box.maxZ
  else if (edge === 'middle' || edge === 'center-z') dz = point.z - (box.minZ + box.maxZ) / 2
  return applyOp(plan, selection, { type: 'translate', dx, dz })
}

export function selectionBounds(plan, selection) {
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  expandSelection(plan, selection).forEach((sel) => {
    geometryOf(plan, sel).forEach((point) => {
      box.minX = Math.min(box.minX, point.x)
      box.maxX = Math.max(box.maxX, point.x)
      box.minZ = Math.min(box.minZ, point.z)
      box.maxZ = Math.max(box.maxZ, point.z)
    })
  })
  if (!Number.isFinite(box.minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  return box
}

export function deleteSelection(plan, selection) {
  const picks = expandGroups(plan, selection)
  const wallIds = new Set(picks.filter((sel) => sel.kind === 'wall').map((sel) => sel.id))
  const openingIds = new Set(picks.filter((sel) => sel.kind === 'opening').map((sel) => sel.id))
  const fixtureIds = new Set(picks.filter((sel) => sel.kind === 'fixture').map((sel) => sel.id))
  const roomIds = new Set(picks.filter((sel) => sel.kind === 'room').map((sel) => sel.id))
  const nodeIds = new Set(picks.filter((sel) => sel.kind === 'node').map((sel) => sel.id))
  const runIds = new Set(picks.filter((sel) => sel.kind === 'run').map((sel) => sel.id))
  const walls = (plan.walls || []).filter((wall) => !wallIds.has(wall.id) || wall.cadLock)
  const services = ensureServices(plan)
  const yard = ensureYard(plan)
  const yardNext = { ...yard }
  picks.filter((sel) => sel.kind === 'yard').forEach((sel) => {
    if (sel.collection === 'plot') yardNext.plot = null
    else if (GROUND_COLLECTIONS.includes(sel.collection)) {
      const removed = removeGroundItem(yardNext, sel.collection, sel.id)
      yardNext.ground = removed.ground
      yardNext.waste = removed.waste
    } else yardNext[sel.collection] = (yardNext[sel.collection] || []).filter((item) => item.id !== sel.id || item.cadLock)
  })
  const next = {
    ...plan,
    walls,
    openings: (plan.openings || []).filter((opening) => !openingIds.has(opening.id) && !wallIds.has(opening.wallId) && walls.some((wall) => wall.id === opening.wallId)),
    fixtures: (plan.fixtures || []).filter((fixture) => !fixtureIds.has(fixture.id) || fixture.cadLock),
    rooms: (plan.rooms || []).map((room) => (roomIds.has(room.id) && !room.drawId ? { ...room, suppressed: true, showLabel: false } : room)),
    yard: yardNext,
    services: {
      ...services,
      nodes: services.nodes.filter((node) => !nodeIds.has(node.id) || node.cadLock),
      runs: services.runs.filter((run) => !runIds.has(run.id) || run.cadLock),
    },
  }
  const drawn = new Set()
  ;(plan.rooms || []).forEach((room) => {
    if (roomIds.has(room.id) && room.drawId) drawn.add(room.drawId)
  })
  const walled = drawn.size
    ? { ...next, walls: next.walls.filter((wall) => !drawn.has(wall.drawId)) }
    : next
  return settle(plan,
    { ...walled, rooms: detectRooms(walled.walls, walled.rooms) },
    { walls: wallIds.size > 0 || drawn.size > 0, yard: picks.some((sel) => sel.collection === 'objects' || sel.collection === 'plot' || GROUND_COLLECTIONS.includes(sel.collection)) },
  )
}

function mapEntities(plan, selection, mapper) {
  const picks = expandGroups(plan, selection)
  const wallIds = new Set(picks.filter((sel) => sel.kind === 'wall').map((sel) => sel.id))
  const openingIds = new Set(picks.filter((sel) => sel.kind === 'opening').map((sel) => sel.id))
  const fixtureIds = new Set(picks.filter((sel) => sel.kind === 'fixture').map((sel) => sel.id))
  const nodeIds = new Set(picks.filter((sel) => sel.kind === 'node').map((sel) => sel.id))
  const runIds = new Set(picks.filter((sel) => sel.kind === 'run').map((sel) => sel.id))
  const services = ensureServices(plan)
  const yard = ensureYard(plan)
  const yardNext = { ...yard }
  picks.filter((sel) => sel.kind === 'yard').forEach((sel) => {
    if (sel.collection === 'plot' && yard.plot) yardNext.plot = mapper(yard.plot)
    else yardNext[sel.collection] = (yard[sel.collection] || []).map((item) => (item.id === sel.id ? mapper(item) : item))
  })
  return {
    ...plan,
    walls: (plan.walls || []).map((wall) => (wallIds.has(wall.id) ? mapper(wall) : wall)),
    openings: (plan.openings || []).map((opening) => (openingIds.has(opening.id) ? mapper(opening) : opening)),
    fixtures: (plan.fixtures || []).map((fixture) => (fixtureIds.has(fixture.id) ? mapper(fixture) : fixture)),
    yard: yardNext,
    services: {
      ...services,
      nodes: services.nodes.map((node) => (nodeIds.has(node.id) ? mapper(node) : node)),
      runs: services.runs.map((run) => (runIds.has(run.id) ? mapper(run) : run)),
    },
  }
}

export function setCadFlag(plan, selection, key, value) {
  return mapEntities(plan, selection, (item) => ({ ...item, [key]: value }))
}

export function groupSelection(plan, selection) {
  const issued = alloc(plan, 'grp')
  return setCadFlag(issued.plan, selection, 'groupId', issued.id)
}

export function ungroupSelection(plan, selection) {
  return setCadFlag(plan, selection, 'groupId', undefined)
}

export function hideSelection(plan, selection) {
  return setCadFlag(plan, selection, 'hidden', true)
}

export function isolateSelection(plan, selection) {
  const keys = new Set(expandGroups(plan, selection).map(selectionKey))
  const hidden = planTargets(plan, { includeHidden: true }).filter((sel) => !keys.has(selectionKey(sel)))
  return hideSelection(plan, hidden)
}

export function showAll(plan) {
  return mapEntities(plan, planTargets(plan, { includeHidden: true }), (item) => ({ ...item, hidden: false }))
}

export function changeLayer(plan, selection, layer) {
  return mapEntities(plan, selection, (item) => {
    const next = { ...item, layer }
    if (item.a && item.b && (layer === 'exterior' || layer === 'interior' || layer === 'bearing')) next.kind = layer
    return next
  })
}

const MATCH_KEYS = ['kind', 'thickness', 'height', 'structure', 'structureId', 'materialId', 'layer', 'width', 'sill', 'size', 'cable', 'material', 'insulation', 'heightMode', 'color', 'rotation', 'swing']

export function matchProperties(plan, source, selection) {
  const src = entityOf(plan, source)
  if (!src) return plan
  const patch = {}
  MATCH_KEYS.forEach((key) => {
    if (src[key] != null) patch[key] = src[key]
  })
  const targets = (selection || []).filter((sel) => sel.kind === source.kind && selectionKey(sel) !== selectionKey(source))
  return patchShared(plan, targets, patch)
}

export function sharedProperties(plan, selection) {
  const records = (selection || []).map((sel) => entityOf(plan, sel)).filter(Boolean)
  const same = (key) => {
    if (!records.length) return undefined
    const first = records[0][key]
    return records.every((item) => item[key] === first) ? first : undefined
  }
  return {
    count: records.length,
    kinds: [...new Set((selection || []).map((sel) => sel.kind))],
    layer: same('layer'),
    cadLock: same('cadLock'),
    hidden: same('hidden'),
    kind: same('kind'),
    structureId: same('structureId'),
    thickness: same('thickness'),
    height: same('height'),
    rotation: same('rotation'),
    material: same('material'),
    size: same('size'),
  }
}

export function patchShared(plan, selection, patch) {
  const clean = { ...patch }
  delete clean.id
  delete clean.points
  delete clean.a
  delete clean.b
  return mapEntities(plan, selection, (item) => ({ ...item, ...clean }))
}

export function floorClipboard(plan, selection) {
  const picks = expandGroups(plan, selection)
  const box = selectionBounds(plan, picks)
  const items = []
  picks.forEach((sel) => {
    const ent = entityOf(plan, sel)
    if (!ent) return
    const data = JSON.parse(JSON.stringify(ent))
    if (sel.kind === 'wall') {
      data.openings = (plan.openings || []).filter((opening) => opening.wallId === ent.id).map((opening) => JSON.parse(JSON.stringify(opening)))
    }
    items.push({ kind: sel.kind, collection: sel.collection, data })
  })
  return {
    source: 'floorplan',
    origin: { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 },
    items,
  }
}

export function pasteFloorClipboard(plan, payload, at) {
  if (!payload || payload.source !== 'floorplan' || !payload.items?.length) return plan
  const dx = (at?.x || 0) - (payload.origin?.x || 0)
  const dz = (at?.z || 0) - (payload.origin?.z || 0)
  const shift = (point) => pt((point?.x || 0) + dx, (point?.z || 0) + dz, point)
  let next = plan
  const wallMap = new Map()
  payload.items.filter((item) => item.kind === 'wall').forEach((item) => {
    const spawned = spawnWall(next, item.data, shift)
    next = spawned.plan
    wallMap.set(item.data.id, spawned.id)
    ;(item.data.openings || []).forEach((opening) => {
      const issued = alloc(next, 'open')
      next = { ...issued.plan, openings: [...(issued.plan.openings || []), { ...opening, id: issued.id, wallId: spawned.id }] }
    })
  })
  payload.items.filter((item) => item.kind === 'fixture').forEach((item) => {
    const issued = alloc(next, 'fix')
    const mapped = shift(item.data)
    next = { ...issued.plan, fixtures: [...(issued.plan.fixtures || []), { ...item.data, id: issued.id, x: mapped.x, z: mapped.z }] }
  })
  payload.items.filter((item) => item.kind === 'node').forEach((item) => {
    const issued = alloc(next, 'svc')
    const mapped = shift(item.data)
    const services = ensureServices(next)
    next = { ...issued.plan, services: { ...services, nodes: [...services.nodes, { ...item.data, id: issued.id, x: mapped.x, z: mapped.z }] } }
  })
  payload.items.filter((item) => item.kind === 'run').forEach((item) => {
    const issued = alloc(next, 'run')
    const services = ensureServices(issued.plan)
    const points = (item.data.points || []).map((point) => shift(point))
    next = {
      ...issued.plan,
      services: {
        ...services,
        runs: [...services.runs, { ...item.data, id: issued.id, points, deviceId: null, locked: true, manual: true }],
      },
    }
  })
  payload.items.filter((item) => item.kind === 'yard' && item.collection && item.collection !== 'plot').forEach((item) => {
    const issued = alloc(next, 'yard')
    const yard = ensureYard(issued.plan)
    const copy = { ...item.data, id: issued.id }
    if (Array.isArray(copy.points)) copy.points = copy.points.map((point) => shift(point))
    else {
      const mapped = shift(item.data)
      copy.x = mapped.x
      copy.z = mapped.z
    }
    next = { ...issued.plan, yard: { ...yard, [item.collection]: [...(yard[item.collection] || []), copy] } }
  })
  return settle(plan, next, { walls: wallMap.size > 0, yard: payload.items.some((item) => item.collection === 'objects') })
}

function typedNumber(value) {
  if (value == null || value === '') return null
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

export function commandDelta(command, cursor) {
  const base = command.base || cursor || { x: 0, z: 0 }
  const dx = (cursor?.x || 0) - base.x
  const dz = (cursor?.z || 0) - base.z
  const dist = Math.hypot(dx, dz)
  const ux = dist > 1e-6 ? dx / dist : 1
  const uz = dist > 1e-6 ? dz / dist : 0
  const typed = typedNumber(command.value)
  const metres = typed != null && command.name !== 'rotate' && command.name !== 'scale' ? typed / 1000 : dist
  return { base, dx: ux * metres, dz: uz * metres, dist: metres, typed, ux, uz }
}

export function runCommand(plan, selection, command, cursor) {
  if (!command) return plan
  const delta = commandDelta(command, cursor)
  if (command.name === 'measure') return plan
  if (command.name === 'move') return applyOp(plan, selection, { type: 'translate', dx: delta.dx, dz: delta.dz })
  if (command.name === 'copy') return copySelection(plan, selection, delta.dx, delta.dz, Math.max(1, Math.round(command.copies) || 1))
  if (command.name === 'rotate') {
    const degrees = delta.typed != null ? delta.typed : (Math.atan2((cursor?.z || 0) - delta.base.z, (cursor?.x || 0) - delta.base.x) * 180) / Math.PI
    return applyOp(plan, selection, { type: 'rotate', cx: delta.base.x, cz: delta.base.z, degrees })
  }
  if (command.name === 'scale') {
    const factor = delta.typed != null ? delta.typed : Math.max(0.05, delta.dist || 1)
    return applyOp(plan, selection, { type: 'scale', cx: delta.base.x, cz: delta.base.z, factor })
  }
  if (command.name === 'mirror') {
    if (openingsOnly(selection)) return mirrorOpenings(plan, selection, { direction: Boolean(command.shift) })
    const x2 = cursor?.x
    const z2 = cursor?.z
    if (!Number.isFinite(x2) || !Number.isFinite(z2)) return plan
    if (Math.hypot(x2 - delta.base.x, z2 - delta.base.z) < 0.05) return plan
    return applyOp(plan, selection, { type: 'mirror', x1: delta.base.x, z1: delta.base.z, x2, z2 })
  }
  if (command.name === 'array') {
    return arraySelection(plan, selection, {
      mode: command.arrayMode || 'linear',
      count: command.count,
      cols: command.cols,
      rows: command.rows,
      dx: delta.dx,
      dz: delta.dz,
    })
  }
  if (command.name === 'offset') return offsetSelection(plan, selection, Math.abs(delta.dist) || 0.1, cursor)
  if (command.name === 'stretch') return applyOp(plan, selection, { type: 'stretch', box: command.box, dx: delta.dx, dz: delta.dz })
  if (command.name === 'align') return alignSelection(plan, selection, command.edge || 'left', cursor || delta.base)
  return plan
}

export function measureReadout(command, cursor) {
  const delta = commandDelta(command, cursor)
  const mm = Math.round(delta.dist * 1000)
  const angle = Math.round((Math.atan2((cursor?.z || 0) - delta.base.z, (cursor?.x || 0) - delta.base.x) * 180) / Math.PI)
  return `${mm} mm · ${angle}°`
}

function designerOutline(room) {
  if (Array.isArray(room?.outline) && room.outline.length >= 3) return room.outline.map((point) => ({ x: point.x, z: point.z }))
  const left = (room?.x || 0) - (room?.width || 1) / 2
  const right = (room?.x || 0) + (room?.width || 1) / 2
  const top = (room?.z || 0) - (room?.depth || 1) / 2
  const bottom = (room?.z || 0) + (room?.depth || 1) / 2
  return [
    { x: left, z: top },
    { x: right, z: top },
    { x: right, z: bottom },
    { x: left, z: bottom },
  ]
}

function equipmentWorld(room, eq) {
  return { x: (room.x || 0) + (eq.x || 0), z: (room.z || 0) + (eq.z || 0) }
}

export function designerHits(scene, box) {
  const hitsList = []
  ;(scene?.rooms || []).forEach((room) => {
    if (room.hidden) return
    const outline = designerOutline(room)
    if (hits(outline, box, true)) hitsList.push({ kind: 'room', id: room.id })
    ;(room.equipment || []).forEach((eq) => {
      if (eq.hidden) return
      const center = equipmentWorld(room, eq)
      const corners = [
        { x: center.x - (eq.width || 0.6) / 2, z: center.z - (eq.depth || 0.6) / 2 },
        { x: center.x + (eq.width || 0.6) / 2, z: center.z - (eq.depth || 0.6) / 2 },
        { x: center.x + (eq.width || 0.6) / 2, z: center.z + (eq.depth || 0.6) / 2 },
        { x: center.x - (eq.width || 0.6) / 2, z: center.z + (eq.depth || 0.6) / 2 },
      ]
      if (hits(corners, box, true)) hitsList.push({ kind: 'equipment', id: eq.id, roomId: room.id })
    })
  })
  ;(scene?.pipes || []).forEach((pipe) => {
    if (!pipe.hidden && hits(pipe.points || [], box)) hitsList.push({ kind: 'pipe', id: pipe.id })
  })
  ;(scene?.cables || []).forEach((cable) => {
    if (!cable.hidden && hits(cable.points || [], box)) hitsList.push({ kind: 'cable', id: cable.id })
  })
  return hitsList
}

export function classifyDesignerIds(scene, ids) {
  const wanted = new Set(ids || [])
  const picks = []
  ;(scene?.rooms || []).forEach((room) => {
    if (wanted.has(room.id)) picks.push({ kind: 'room', id: room.id })
    ;(room.equipment || []).forEach((eq) => {
      if (wanted.has(eq.id)) picks.push({ kind: 'equipment', id: eq.id, roomId: room.id })
    })
  })
  ;(scene?.pipes || []).forEach((pipe) => {
    if (wanted.has(pipe.id)) picks.push({ kind: 'pipe', id: pipe.id })
  })
  ;(scene?.cables || []).forEach((cable) => {
    if (wanted.has(cable.id)) picks.push({ kind: 'cable', id: cable.id })
  })
  return picks
}

function freshId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function designerRoom(room, op, moves) {
  if (room.cadLock || room.hidden) return room
  const outline = designerOutline(room).map((point) => mapPoint(point, op))
  const cx = outline.reduce((sum, point) => sum + point.x, 0) / outline.length
  const cz = outline.reduce((sum, point) => sum + point.z, 0) / outline.length
  const rigid = op.type === 'translate'
  const equipment = (room.equipment || []).map((eq) => {
    const from = equipmentWorld(room, eq)
    const to = mapPoint(from, op)
    moves.push({ from, to })
    const next = { ...eq, x: round3(to.x - cx), z: round3(to.z - cz) }
    if (op.type === 'rotate') next.rotation = Math.round((((eq.rotation || 0) + (op.degrees || 0)) % 360) * 10) / 10
    if (op.type === 'mirror') next.rotation = Math.round((-((eq.rotation || 0))) * 10) / 10
    return next
  })
  return {
    ...room,
    x: round3(cx),
    z: round3(cz),
    width: rigid ? room.width : round3(Math.hypot(outline[1].x - outline[0].x, outline[1].z - outline[0].z) || room.width),
    depth: rigid ? room.depth : round3(Math.hypot((outline[2] || outline[0]).x - outline[1].x, (outline[2] || outline[0]).z - outline[1].z) || room.depth),
    outline: rigid && !room.outline ? room.outline : outline.map((point) => ({ x: point.x, z: point.z })),
    equipment,
  }
}

function followRoutes(list, moves, selectedIds) {
  return (list || []).map((item) => {
    if (item.cadLock) return item
    if (selectedIds.has(item.id)) {
      const points = (item.points || []).map((point) => mapPoint(point, { type: 'translate', dx: 0, dz: 0 }))
      return item
    }
    let points = item.points || []
    let changed = false
    moves.forEach((move) => {
      const next = followEndpoint(points, move.from, { ...move.to, y: points[0]?.y }, 0.9)
      if (next !== points) {
        points = next
        changed = true
      }
    })
    if (!changed) return item
    return { ...item, points, locked: true, riseM: riseMetres(points) }
  })
}

export function applyDesigner(scene, picks, op) {
  const rooms = scene.rooms || []
  const roomIds = new Set(picks.filter((sel) => sel.kind === 'room' && !rooms.find((room) => room.id === sel.id)?.cadLock).map((sel) => sel.id))
  const equipIds = new Set(picks.filter((sel) => sel.kind === 'equipment').map((sel) => sel.id))
  const pipeIds = new Set(picks.filter((sel) => sel.kind === 'pipe').map((sel) => sel.id))
  const cableIds = new Set(picks.filter((sel) => sel.kind === 'cable').map((sel) => sel.id))
  const moves = []
  const nextRooms = rooms.map((room) => {
    if (roomIds.has(room.id)) return designerRoom(room, op, moves)
    if (!(room.equipment || []).some((eq) => equipIds.has(eq.id))) return room
    return {
      ...room,
      equipment: (room.equipment || []).map((eq) => {
        if (!equipIds.has(eq.id) || eq.cadLock) return eq
        const from = equipmentWorld(room, eq)
        const to = mapPoint(from, op)
        moves.push({ from, to })
        const next = { ...eq, x: round3(eq.x + (to.x - from.x)), z: round3(eq.z + (to.z - from.z)) }
        if (op.type === 'rotate') next.rotation = Math.round((((eq.rotation || 0) + (op.degrees || 0)) % 360) * 10) / 10
        return next
      }),
    }
  })
  const mapRoutes = (list, ids) => (list || []).map((item) => {
    if (!ids.has(item.id) || item.cadLock || item.hidden) return item
    const points = (item.points || []).map((point) => mapPoint(point, op))
    return { ...item, points, locked: true, manual: true, riseM: riseMetres(points), length: Math.round(routeLength(points) * 10) / 10 }
  })
  let pipes = mapRoutes(scene.pipes, pipeIds)
  let cables = mapRoutes(scene.cables, cableIds)
  pipes = pipes.map((pipe) => (pipeIds.has(pipe.id) ? pipe : followRoutes([pipe], moves, pipeIds)[0]))
  cables = cables.map((cable) => (cableIds.has(cable.id) ? cable : followRoutes([cable], moves, cableIds)[0]))
  return { rooms: nextRooms, pipes, cables }
}

function cloneDesigner(scene, picks, op) {
  const roomIds = new Set(picks.filter((sel) => sel.kind === 'room').map((sel) => sel.id))
  const extras = []
  ;(scene.rooms || []).forEach((room) => {
    if (!roomIds.has(room.id) || room.cadLock) return
    const moved = designerRoom(room, op, [])
    const equipment = (moved.equipment || []).map((eq) => ({ ...eq, id: freshId('eq') }))
    extras.push({ ...moved, id: freshId('room'), equipment, groupId: undefined, cadLock: false, hidden: false })
  })
  const pipes = (scene.pipes || []).filter((pipe) => picks.some((sel) => sel.kind === 'pipe' && sel.id === pipe.id) && !pipe.cadLock).map((pipe) => {
    const points = (pipe.points || []).map((point) => mapPoint(point, op))
    return { ...pipe, id: freshId('pipe'), points, locked: true, riseM: riseMetres(points), groupId: undefined }
  })
  const cables = (scene.cables || []).filter((cable) => picks.some((sel) => sel.kind === 'cable' && sel.id === cable.id) && !cable.cadLock).map((cable) => {
    const points = (cable.points || []).map((point) => mapPoint(point, op))
    return { ...cable, id: freshId('cable'), points, locked: true, riseM: riseMetres(points), groupId: undefined }
  })
  return {
    rooms: [...(scene.rooms || []), ...extras],
    pipes: [...(scene.pipes || []), ...pipes],
    cables: [...(scene.cables || []), ...cables],
  }
}

export function copyDesigner(scene, picks, dx, dz, count = 1) {
  let next = scene
  const copies = Math.max(1, Math.round(count) || 1)
  for (let i = 1; i <= copies; i += 1) {
    next = cloneDesigner(next, picks, { type: 'translate', dx: dx * i, dz: dz * i })
  }
  return next
}

export function deleteDesigner(scene, picks) {
  const roomIds = new Set(picks.filter((sel) => sel.kind === 'room').map((sel) => sel.id))
  const equipIds = new Set(picks.filter((sel) => sel.kind === 'equipment').map((sel) => sel.id))
  const pipeIds = new Set(picks.filter((sel) => sel.kind === 'pipe').map((sel) => sel.id))
  const cableIds = new Set(picks.filter((sel) => sel.kind === 'cable').map((sel) => sel.id))
  return {
    rooms: (scene.rooms || []).filter((room) => !roomIds.has(room.id) || room.cadLock).map((room) => ({
      ...room,
      equipment: (room.equipment || []).filter((eq) => !equipIds.has(eq.id) || eq.cadLock),
    })),
    pipes: (scene.pipes || []).filter((pipe) => !pipeIds.has(pipe.id) || pipe.cadLock),
    cables: (scene.cables || []).filter((cable) => !cableIds.has(cable.id) || cable.cadLock),
  }
}

export function patchDesigner(scene, picks, patch) {
  const roomIds = new Set(picks.filter((sel) => sel.kind === 'room').map((sel) => sel.id))
  const equipIds = new Set(picks.filter((sel) => sel.kind === 'equipment').map((sel) => sel.id))
  const pipeIds = new Set(picks.filter((sel) => sel.kind === 'pipe').map((sel) => sel.id))
  const cableIds = new Set(picks.filter((sel) => sel.kind === 'cable').map((sel) => sel.id))
  const apply = (item) => ({ ...item, ...patch })
  return {
    rooms: (scene.rooms || []).map((room) => ({
      ...((roomIds.has(room.id) ? apply(room) : room)),
      equipment: (room.equipment || []).map((eq) => (equipIds.has(eq.id) ? apply(eq) : eq)),
    })),
    pipes: (scene.pipes || []).map((pipe) => (pipeIds.has(pipe.id) ? apply(pipe) : pipe)),
    cables: (scene.cables || []).map((cable) => (cableIds.has(cable.id) ? apply(cable) : cable)),
  }
}

export function designerShared(scene, ids) {
  const picks = classifyDesignerIds(scene, ids)
  const rooms = picks.filter((sel) => sel.kind === 'room').map((sel) => (scene.rooms || []).find((room) => room.id === sel.id)).filter(Boolean)
  const same = (list, key) => (list.length && list.every((item) => item[key] === list[0][key]) ? list[0][key] : undefined)
  return {
    count: (ids || []).length,
    kinds: [...new Set(picks.map((sel) => sel.kind))],
    temp: same(rooms, 'temp'),
    cadLock: same([...rooms], 'cadLock'),
    layer: same(rooms, 'layer'),
  }
}

export function runDesignerCommand(scene, ids, command, cursor) {
  const picks = classifyDesignerIds(scene, ids)
  const delta = commandDelta(command, cursor)
  if (!picks.length || command.name === 'measure') return scene
  if (command.name === 'copy') return copyDesigner(scene, picks, delta.dx, delta.dz, Math.max(1, Math.round(command.copies) || 1))
  if (command.name === 'array') {
    const spec = { mode: command.arrayMode || 'linear', count: command.count, cols: command.cols, rows: command.rows, dx: delta.dx, dz: delta.dz }
    if (spec.mode === 'rect') {
      let next = scene
      for (let row = 0; row < (spec.rows || 1); row += 1) {
        for (let col = 0; col < (spec.cols || 1); col += 1) {
          if (row === 0 && col === 0) continue
          next = cloneDesigner(next, picks, { type: 'translate', dx: delta.dx * col, dz: delta.dz * row })
        }
      }
      return next
    }
    return copyDesigner(scene, picks, delta.dx, delta.dz, Math.max(1, (Math.round(spec.count) || 1) - 1))
  }
  let op = { type: 'translate', dx: delta.dx, dz: delta.dz }
  if (command.name === 'rotate') {
    const degrees = delta.typed != null ? delta.typed : (Math.atan2((cursor?.z || 0) - delta.base.z, (cursor?.x || 0) - delta.base.x) * 180) / Math.PI
    op = { type: 'rotate', cx: delta.base.x, cz: delta.base.z, degrees }
  } else if (command.name === 'scale') {
    op = { type: 'scale', cx: delta.base.x, cz: delta.base.z, factor: delta.typed != null ? delta.typed : Math.max(0.05, delta.dist || 1) }
  } else if (command.name === 'mirror') {
    op = { type: 'mirror', x1: delta.base.x, z1: delta.base.z, x2: cursor?.x ?? delta.base.x + 1, z2: cursor?.z ?? delta.base.z }
  } else if (command.name === 'stretch') {
    op = { type: 'stretch', box: command.box, dx: delta.dx, dz: delta.dz }
  } else if (command.name === 'offset') {
    return copyDesigner(scene, picks, delta.dx, delta.dz, 1)
  }
  return applyDesigner(scene, picks, op)
}

export function designerClipboard(scene, ids) {
  const picks = classifyDesignerIds(scene, ids)
  return { source: 'designer', picks, rooms: scene.rooms, pipes: scene.pipes, cables: scene.cables }
}

export function pasteDesignerClipboard(scene, payload, at) {
  if (!payload || payload.source !== 'designer') return scene
  const stored = { rooms: payload.rooms || [], pipes: payload.pipes || [], cables: payload.cables || [] }
  const picks = payload.picks || []
  const boxPoints = []
  picks.forEach((sel) => {
    if (sel.kind === 'room') {
      const room = stored.rooms.find((item) => item.id === sel.id)
      if (room) boxPoints.push({ x: room.x, z: room.z })
    }
  })
  const origin = boxPoints.length
    ? {
      x: boxPoints.reduce((sum, point) => sum + point.x, 0) / boxPoints.length,
      z: boxPoints.reduce((sum, point) => sum + point.z, 0) / boxPoints.length,
    }
    : { x: 0, z: 0 }
  const dx = (at?.x || origin.x) - origin.x
  const dz = (at?.z || origin.z) - origin.z
  const copied = cloneDesigner(stored, picks, { type: 'translate', dx, dz })
  return {
    rooms: [...(scene.rooms || []), ...copied.rooms.slice((stored.rooms || []).length)],
    pipes: [...(scene.pipes || []), ...copied.pipes.slice((stored.pipes || []).length)],
    cables: [...(scene.cables || []), ...copied.cables.slice((stored.cables || []).length)],
  }
}
