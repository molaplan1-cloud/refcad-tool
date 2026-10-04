import { ensureServices, addServiceNode, rewireElectric, rewireHeat, rewireWater } from './services.js'

export const REPEAT_MS = 300
export const REPEAT_PX = 8
export const STACK_M = 0.12

export function sameSpot(a, b, metres = STACK_M) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0)) <= metres
}

/** A second pointer event from the same gesture, or a twitch on the same pixels. */
export function repeatGesture(last, next) {
  if (!last || !next) return false
  const dt = Number(next.at) - Number(last.at)
  if (Number.isFinite(dt) && dt >= 0 && dt < REPEAT_MS) return true
  if ([last.px, last.py, next.px, next.py].every(Number.isFinite)) {
    if (Math.hypot(next.px - last.px, next.py - last.py) <= REPEAT_PX) return true
  }
  return false
}

export function serviceKey(node) {
  return [node?.system || '', node?.kind || '', node?.pointType || ''].join('|')
}

export function fixtureKey(item) {
  return item?.type || item?.catalogId || ''
}

export function footprintsOverlap(a, b) {
  const aw = Number(a?.w ?? a?.width)
  const ad = Number(a?.d ?? a?.depth)
  const bw = Number(b?.w ?? b?.width)
  const bd = Number(b?.d ?? b?.depth)
  if (![aw, ad, bw, bd].every((value) => Number.isFinite(value) && value > 0)) return false
  const dx = Math.abs((a.x || 0) - (b.x || 0))
  const dz = Math.abs((a.z || 0) - (b.z || 0))
  return dx < aw / 2 + bw / 2 - 0.02 && dz < ad / 2 + bd / 2 - 0.02
}

export function findStack(items, candidate, keyFn, metres = STACK_M) {
  const key = keyFn(candidate)
  return (items || []).find((item) => keyFn(item) === key && (sameSpot(item, candidate, metres) || footprintsOverlap(item, candidate))) || null
}

export function judgePlacement({ items, candidate, last, gesture, key }) {
  if (repeatGesture(last, gesture)) return { action: 'ignore', existing: null }
  const existing = findStack(items, candidate, key)
  if (existing) return { action: 'duplicate', existing }
  return { action: 'place', existing: null }
}

export function dedupeList(items, keyFn, metres = 0.08) {
  const kept = []
  let removed = 0
  for (const item of items || []) {
    if (kept.some((other) => keyFn(other) === keyFn(item) && sameSpot(other, item, metres))) removed += 1
    else kept.push(item)
  }
  return { items: kept, removed }
}

/**
 * One gesture (pointer down plus the matching pointer up) creates at most one socket.
 * A later click on the same snap point is refused.
 */
export function placeServiceNode(plan, node, gesture, last) {
  const items = ensureServices(plan).nodes
  const verdict = judgePlacement({ items, candidate: node, last, gesture, key: serviceKey })
  if (verdict.action !== 'place') return { plan, placed: false, verdict, last: verdict.action === 'duplicate' ? gesture : last, created: null }
  const next = addServiceNode(plan, node)
  const oldIds = new Set(items.map((item) => item.id))
  const created = ensureServices(next).nodes.find((item) => item.kind === node.kind && !oldIds.has(item.id)) || null
  return { plan: next, placed: true, verdict, last: gesture, created }
}

export function removeStacked(plan) {
  const services = ensureServices(plan)
  const nodes = dedupeList(services.nodes, serviceKey, 0.08)
  const fixtures = dedupeList(plan?.fixtures || [], fixtureKey, 0.08)
  if (!nodes.removed && !fixtures.removed) return { plan, removed: 0 }
  const kept = new Set(nodes.items)
  const dropped = new Set(services.nodes.filter((node) => !kept.has(node)).map((node) => node.system))
  let next = { ...plan, fixtures: fixtures.items, services: { ...services, nodes: nodes.items } }
  if (dropped.has('electric')) next = rewireElectric(next)
  if (dropped.has('water')) next = rewireWater(next)
  if (dropped.has('heat')) next = rewireHeat(next)
  return { plan: next, removed: nodes.removed + fixtures.removed }
}

export function removeStackedEquipment(rooms) {
  let removed = 0
  const next = (rooms || []).map((room) => {
    const kept = []
    for (const eq of room.equipment || []) {
      const stacked = kept.some((other) => (other.catalogId || other.id) === (eq.catalogId || eq.id) && sameSpot(other, eq, 0.08))
      if (stacked) removed += 1
      else kept.push(eq)
    }
    return { ...room, equipment: kept }
  })
  return { rooms: next, removed }
}
