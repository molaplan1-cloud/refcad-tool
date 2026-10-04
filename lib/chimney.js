// Chimneys, hearths and the safety distances around them.
// Distances are typical Finnish product / E3-style defaults (metres) and can be
// overridden on the fixture. They are not a substitute for the appliance's own instructions.

import { resolveFixture } from './furniture.js'
import {
  nearestWall,
  pointInPolygon,
  resolveFaceMaterial,
  roofModel,
  roomForWallSide,
  segmentLength,
  thicknessOf,
  wallNormal,
} from './floorplan.js'

export const CHIMNEY_CLEARANCE = {
  masonry: 0.1,
  element: 0.05,
  steel: 0.05,
}

const CAP_ABOVE_ROOF = 0.85
const LINK_REACH = 1.6

const FLUE_FOR = {
  masonry: ['half', 'full'],
  element: ['150', '200'],
  steel: ['115', '150', '200'],
}

const FLUE_NAME = {
  115: 'Ø115',
  150: 'Ø150',
  200: 'Ø200',
  half: '½-tiilen hormi',
  full: '1-tiilen hormi',
}

const WOOD_FACE = new Set(['panel', 'cladding', 'wood-horizontal', 'wood-vertical', 'wood-batten'])
const SAFE_FACE = new Set([
  'gypsum', 'tile', 'concrete', 'concrete-paint', 'plaster', 'paint', 'wallpaper',
  'brick', 'brick-red', 'brick-yellow', 'brick-white', 'brick-rendered', 'render',
  'board', 'stone', 'epoxy',
])

export function isChimney(fixture) {
  return fixture?.type === 'chimney'
}

export function needsChimney(fixture) {
  const spec = resolveFixture(fixture)
  return spec.fuel === 'wood' && spec.chimney
}

export function chimneyKind(fixture) {
  const variant = fixture?.variant
  if (variant === 'element' || variant === 'steel' || variant === 'masonry') return variant
  return 'masonry'
}

export function defaultFlue(kind) {
  if (kind === 'steel' || kind === 'element') return '150'
  return 'half'
}

export function flueOptions(kind) {
  return (FLUE_FOR[kind] || FLUE_FOR.masonry).map((id) => ({ id, name: FLUE_NAME[id] || id }))
}

export function chimneySize(kind, flue, flues = 1) {
  const twin = Number(flues) >= 2
  if (kind === 'masonry') {
    if (flue === 'full') return twin ? { w: 1.1, d: 0.64 } : { w: 0.64, d: 0.64 }
    return twin ? { w: 0.78, d: 0.48 } : { w: 0.48, d: 0.48 }
  }
  if (kind === 'element') {
    if (flue === '200') return twin ? { w: 0.86, d: 0.48 } : { w: 0.48, d: 0.48 }
    return twin ? { w: 0.72, d: 0.4 } : { w: 0.4, d: 0.4 }
  }
  const outer = flue === '115' ? 0.25 : flue === '200' ? 0.35 : 0.28
  return twin ? { w: outer * 2 + 0.04, d: outer } : { w: outer, d: outer }
}

export function withChimneyFields(fixture, patch = {}) {
  const kind = patch.variant || chimneyKind(fixture)
  const allowed = FLUE_FOR[kind] || FLUE_FOR.masonry
  let flue = patch.flue || fixture?.flue || defaultFlue(kind)
  if (!allowed.includes(flue)) flue = defaultFlue(kind)
  const flues = Number(patch.flues != null ? patch.flues : fixture?.flues) >= 2 ? 2 : 1
  const size = chimneySize(kind, flue, flues)
  return { ...patch, variant: kind, flue, flues, w: size.w, d: size.d }
}

function localAxes(rotation) {
  const theta = ((rotation || 0) * Math.PI) / 180
  return {
    x: { x: Math.cos(theta), z: -Math.sin(theta) },
    z: { x: Math.sin(theta), z: Math.cos(theta) },
  }
}

function projectHalf(rotation, w, d, nx, nz) {
  const axes = localAxes(rotation)
  const alongX = Math.abs(axes.x.x * nx + axes.x.z * nz)
  const alongZ = Math.abs(axes.z.x * nx + axes.z.z * nz)
  return alongX * w / 2 + alongZ * d / 2
}

export function applianceClearance(fixture) {
  const spec = resolveFixture(fixture)
  const base = spec.clearance
  if (!base) return null
  const shielded = fixture?.shield !== false && spec.shieldClearance
  if (!shielded) return { side: base.side || 0, rear: base.rear || 0, front: base.front || 0, ceiling: base.ceiling || 0, shield: false }
  return {
    side: spec.shieldClearance.side ?? base.side ?? 0,
    rear: spec.shieldClearance.rear ?? base.rear ?? 0,
    front: base.front || 0,
    ceiling: base.ceiling || 0,
    shield: true,
  }
}

export function drawingOf(fixture) {
  if (isChimney(fixture)) {
    const kind = chimneyKind(fixture)
    const need = CHIMNEY_CLEARANCE[kind] ?? 0.1
    return {
      chimney: true,
      kind,
      flues: Number(fixture?.flues) >= 2 ? 2 : 1,
      clearance: { side: need, rear: need, front: need, ceiling: 0 },
      hearth: null,
      shield: false,
    }
  }
  const spec = resolveFixture(fixture)
  const clearance = applianceClearance(fixture)
  return {
    chimney: false,
    kind: null,
    flues: 1,
    clearance,
    hearth: spec.hearth || null,
    shield: Boolean(clearance?.shield),
  }
}

function roofCorners(model) {
  return {
    x0: model.minX - model.overhang,
    x1: model.maxX + model.overhang,
    z0: model.minZ - model.overhang,
    z1: model.maxZ + model.overhang,
    y0: model.wallHeight,
    y1: model.wallHeight + model.rise,
  }
}

export function roofHeightAt(plan, x, z) {
  const model = roofModel(plan)
  const { x0, x1, z0, z1, y0, y1 } = roofCorners(model)
  if (x < x0 - 1e-6 || x > x1 + 1e-6 || z < z0 - 1e-6 || z > z1 + 1e-6) return null
  if (model.type === 'flat') return y1
  if (model.type === 'shed') {
    const t = (z - z0) / ((z1 - z0) || 1)
    return y1 + (y0 - y1) * t
  }
  if (model.type === 'hip') {
    const inset = Math.min(x1 - x0, z1 - z0) / 2
    if (model.alongX) {
      const zm = (model.minZ + model.maxZ) / 2
      const rx0 = x0 + inset
      const rx1 = x1 - inset
      const u = Math.abs(z - zm) / (Math.abs(zm - z0) || 1)
      let v = 0
      if (x < rx0) v = (rx0 - x) / (inset || 1)
      else if (x > rx1) v = (x - rx1) / (inset || 1)
      return y1 + (y0 - y1) * Math.min(1, Math.max(u, v))
    }
    const xm = (model.minX + model.maxX) / 2
    const rz0 = z0 + inset
    const rz1 = z1 - inset
    const u = Math.abs(x - xm) / (Math.abs(xm - x0) || 1)
    let v = 0
    if (z < rz0) v = (rz0 - z) / (inset || 1)
    else if (z > rz1) v = (z - rz1) / (inset || 1)
    return y1 + (y0 - y1) * Math.min(1, Math.max(u, v))
  }
  if (model.alongX) {
    const zm = (model.minZ + model.maxZ) / 2
    const t = Math.min(1, Math.abs(z - zm) / (Math.abs(zm - z0) || 1))
    return y1 + (y0 - y1) * t
  }
  const xm = (model.minX + model.maxX) / 2
  const t = Math.min(1, Math.abs(x - xm) / (Math.abs(xm - x0) || 1))
  return y1 + (y0 - y1) * t
}

export function chimneyTop(plan, fixture) {
  const roof = roofHeightAt(plan, fixture?.x || 0, fixture?.z || 0)
  if (Number.isFinite(fixture?.stack)) {
    return { roof, top: fixture.stack, reaches: roof != null && fixture.stack >= roof + 0.02 }
  }
  if (roof == null) return { roof: null, top: (plan?.floorHeight || 2.6) + 0.4, reaches: false }
  return { roof, top: roof + CAP_ABOVE_ROOF, reaches: true }
}

export function materialBurns(materialId, structure) {
  if (structure === 'hirsi') return true
  if (WOOD_FACE.has(materialId)) return true
  if (SAFE_FACE.has(materialId)) return false
  return structure === 'puuranka'
}

function structureOf(plan, wall) {
  if (wall?.structure) return wall.structure
  if (wall?.kind === 'exterior' || wall?.kind === 'bearing') return plan?.exteriorStructure || 'puuranka'
  return ''
}

function faceMaterial(plan, wall, side) {
  const room = roomForWallSide(plan, wall, side)
  if (!room && (wall.kind === 'exterior' || wall.kind === 'bearing')) return wall.materialId || plan?.exteriorId || 'cladding'
  return resolveFaceMaterial(plan, wall, side)
}

function sideOf(wall, point) {
  const normal = wallNormal(wall)
  const dot = (point.x - wall.a.x) * normal.x + (point.z - wall.a.z) * normal.z
  return dot >= 0 ? 'left' : 'right'
}

function clearanceNeed(clearance, rotation, nx, nz) {
  const axes = localAxes(rotation)
  const lx = nx * axes.x.x + nz * axes.x.z
  const lz = nx * axes.z.x + nz * axes.z.z
  if (Math.abs(lz) >= Math.abs(lx)) return lz >= 0 ? (clearance.front || 0) : (clearance.rear || 0)
  return clearance.side || 0
}

function wallClearanceHit(plan, fixture, w, d, clearance) {
  let worst = null
  ;(plan?.walls || []).forEach((wall) => {
    const len = segmentLength(wall.a, wall.b)
    if (len < 0.05) return
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    const tRaw = ((fixture.x - wall.a.x) * dx + (fixture.z - wall.a.z) * dz) / (len * len)
    if (tRaw < 0 || tRaw > 1) return
    const hit = nearestWall([wall], fixture, Math.max(w, d) + 1.4)
    if (!hit || hit.dist < 0.001) return
    const face = hit.dist - thicknessOf(wall, plan) / 2
    const nx = (hit.x - fixture.x) / (hit.dist || 1)
    const nz = (hit.z - fixture.z) / (hit.dist || 1)
    const gap = face - projectHalf(fixture.rotation, w, d, nx, nz)
    const need = clearanceNeed(clearance, fixture.rotation, nx, nz)
    if (need <= 0 || gap >= need - 1e-6) return
    const side = sideOf(wall, fixture)
    if (!materialBurns(faceMaterial(plan, wall, side), structureOf(plan, wall))) return
    if (!worst || gap < worst.gap) worst = { gap, need }
  })
  return worst
}

function ceilingHit(plan, fixture) {
  const spec = resolveFixture(fixture)
  const clearance = applianceClearance(fixture)
  const need = clearance?.ceiling || 0
  if (need <= 0) return null
  const room = (plan?.rooms || []).find((item) => pointInPolygon(fixture.x, fixture.z, item.polygon || item.gross || []))
  const material = room?.ceilingId || 'paint'
  if (!materialBurns(material, '')) return null
  const ceiling = room?.ceilingHeight || plan?.floorHeight || 2.6
  const gap = ceiling - (spec.h || 0)
  if (gap >= need - 1e-6) return null
  return { gap, need, ceiling: true }
}

export function flueWarnings(plan) {
  const fixtures = (plan?.fixtures || []).filter((item) => !item.hidden)
  const chimneys = new Set(fixtures.filter((item) => isChimney(item)).map((item) => item.id))
  const warnings = []
  fixtures.forEach((fixture) => {
    const spec = resolveFixture(fixture)
    if (needsChimney(fixture) && (!fixture.chimneyId || !chimneys.has(fixture.chimneyId))) {
      warnings.push({ id: fixture.id, code: 'no-chimney', text: `${spec.name} on ilman hormia` })
    }
    if (isChimney(fixture) && !chimneyTop(plan, fixture).reaches) {
      warnings.push({ id: fixture.id, code: 'short', text: 'Hormi ei yllä katolle' })
    }
    const draw = drawingOf(fixture)
    if (draw.clearance) {
      const hit = wallClearanceHit(plan, fixture, spec.w, spec.d, draw.clearance)
      if (hit) {
        warnings.push({
          id: fixture.id,
          code: 'clearance',
          text: `${spec.name}: paloturvaetäisyys alittuu (${Math.round(hit.gap * 1000)} mm, vaaditaan ${Math.round(hit.need * 1000)} mm)`,
        })
      }
    }
    const ceiling = ceilingHit(plan, fixture)
    if (ceiling) {
      warnings.push({
        id: fixture.id,
        code: 'clearance',
        text: `${spec.name}: katon paloturvaetäisyys alittuu (${Math.round(ceiling.gap * 1000)} mm, vaaditaan ${Math.round(ceiling.need * 1000)} mm)`,
      })
    }
  })
  return warnings
}

export function bindFlues(plan) {
  const fixtures = plan?.fixtures || []
  if (!fixtures.length) return plan
  const chimneys = fixtures.filter((item) => isChimney(item) && !item.hidden)
  let changed = false
  const next = fixtures.map((fixture) => {
    if (!needsChimney(fixture) || fixture.hidden) {
      if (!fixture.chimneyId) return fixture
      changed = true
      const copy = { ...fixture }
      delete copy.chimneyId
      return copy
    }
    if (fixture.chimneyId && chimneys.some((item) => item.id === fixture.chimneyId)) return fixture
    let best = null
    chimneys.forEach((chimney) => {
      const dist = Math.hypot(chimney.x - fixture.x, chimney.z - fixture.z)
      if (dist <= LINK_REACH && (!best || dist < best.dist)) best = { id: chimney.id, dist }
    })
    if (!best) {
      if (!fixture.chimneyId) return fixture
      changed = true
      const copy = { ...fixture }
      delete copy.chimneyId
      return copy
    }
    changed = true
    return { ...fixture, chimneyId: best.id }
  })
  return changed ? { ...plan, fixtures: next } : plan
}

export function addChimneyFor(plan, applianceId) {
  const fixture = (plan?.fixtures || []).find((item) => item.id === applianceId)
  if (!fixture || !needsChimney(fixture)) return plan
  if (fixture.chimneyId && (plan.fixtures || []).some((item) => item.id === fixture.chimneyId && item.type === 'chimney')) return plan
  const spec = resolveFixture(fixture)
  const kind = spec.flueKind || (fixture.type === 'heater' ? 'steel' : 'masonry')
  const flue = defaultFlue(kind)
  const size = chimneySize(kind, flue, 1)
  const axes = localAxes(fixture.rotation)
  const along = spec.w / 2 + size.w / 2 + 0.08
  const back = Math.max(0, spec.d / 2 - size.d / 2)
  const seq = (plan.seq || 1) + 1
  const created = {
    id: `fix-${seq}`,
    type: 'chimney',
    x: Math.round((fixture.x + axes.x.x * along - axes.z.x * back) * 1000) / 1000,
    z: Math.round((fixture.z + axes.x.z * along - axes.z.z * back) * 1000) / 1000,
    rotation: fixture.rotation || 0,
    variant: kind,
    flue,
    flues: 1,
    w: size.w,
    d: size.d,
    h: 1.2,
  }
  return {
    ...plan,
    seq,
    fixtures: [
      ...plan.fixtures.map((item) => (item.id === fixture.id ? { ...item, chimneyId: created.id } : item)),
      created,
    ],
  }
}
