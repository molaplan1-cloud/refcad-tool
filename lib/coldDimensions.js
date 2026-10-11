// Cold-room dimensions are the house dimension chains: outer runs, the
// overall box, and a clear size inside each room. Extension lines are
// resolved by the same witness function as the floor plan.

import { emptyPanelPlan } from './coldPanels.js'
import { dedupeDimensions, extensionWitnesses, planDimensions } from './floorplan.js'

export function coldDimensionPlan(panelPlan, rooms = []) {
  const base = panelPlan?.walls ? panelPlan : emptyPanelPlan()
  return {
    ...base,
    rooms: (rooms || []).filter((room) => (room.outline || []).length >= 3 && !room.hidden).map((room) => ({
      id: room.id,
      name: room.label || room.name || '',
      polygon: room.outline,
      gross: room.outline,
    })),
  }
}

export function coldDimensions(panelPlan, rooms = []) {
  const plan = coldDimensionPlan(panelPlan, rooms)
  if (!(plan.walls || []).length) return []
  return planDimensions(plan, {
    preset: 'custom',
    dims: { overall: true, room: true, openings: false, internal: true },
  })
}

export function coldDimensionFigures(panelPlan, rooms = [], minGap = 0.35) {
  const plan = coldDimensionPlan(panelPlan, rooms)
  const dims = dedupeDimensions(coldDimensions(panelPlan, rooms), minGap)
  return dims.map((dim) => ({
    dim,
    witnesses: extensionWitnesses(dim, plan),
  }))
}
