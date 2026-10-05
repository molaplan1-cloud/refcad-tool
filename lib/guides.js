// Transient drawing guides. They follow the pointer and must disappear
// when the gesture ends, the pointer leaves, or the model is committed.

const SNAP_TOOLS = new Set(['exterior', 'interior', 'room', 'door', 'window', 'passage'])

export function guidesAllowed({ tool = 'select', placing = false, yardTool = null, pointerInside = true } = {}) {
  if (!pointerInside) return false
  if (placing || yardTool) return true
  return SNAP_TOOLS.has(tool)
}

export function visibleSnap(snap, allowed) {
  if (!allowed || !snap?.point || !snap.kind) return null
  return snap
}

export function releaseGuides() {
  return { snap: null, track: null, drawGuide: null, preview: null }
}

export function dropDegenerateWalls(plan) {
  if (!plan) return plan
  const walls = (plan.walls || []).filter((wall) => {
    if (!wall?.a || !wall?.b) return false
    const len = Math.hypot((wall.b.x || 0) - (wall.a.x || 0), (wall.b.z || 0) - (wall.a.z || 0))
    if (!Number.isFinite(len) || len < 0.05) return false
    const thick = Number(wall.thickness)
    if (Number.isFinite(thick) && thick <= 0) return false
    return true
  })
  const ids = new Set(walls.map((wall) => wall.id))
  const openings = (plan.openings || []).filter((opening) => ids.has(opening.wallId))
  if (walls.length === (plan.walls || []).length && openings.length === (plan.openings || []).length) return plan
  return { ...plan, walls, openings }
}
