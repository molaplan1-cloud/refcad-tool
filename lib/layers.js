// One saved visibility for the layer bar and the Näytä panel.
import { applyDisplay, normalizeDisplay } from './display.js'
import { SERVICE_SYSTEMS, layerVisible, setServiceLayer } from './services.js'
import { workspaceSystems } from './workspaces.js'

export const LAYER_EYES = [
  { id: 'electric', key: 'service.electric' },
  { id: 'iv', key: 'service.iv' },
  { id: 'water', key: 'service.water' },
  { id: 'drain', key: 'service.drain' },
  { id: 'heat', key: 'service.heat' },
  { id: 'ground', key: 'service.ground' },
  { id: 'fixtures', key: 'display.fixtures' },
]

export function pinnedLayers(workspace) {
  const systems = workspaceSystems(workspace)
  if (workspace === 'kalusteet') return ['fixtures']
  return systems
}

export function layerStored(plan, id, sheet = 'plan') {
  if (id === 'fixtures') return normalizeDisplay(plan?.sheetDisplay?.[sheet] || plan?.display).fixtures !== false
  return layerVisible(plan, id)
}

export function layerEyeOn(plan, id, workspace, sheet = 'plan') {
  if (pinnedLayers(workspace).includes(id)) return true
  return layerStored(plan, id, sheet)
}

export function setLayerEye(plan, id, visible, workspace = 'rakenne', sheet = 'plan') {
  if (pinnedLayers(workspace).includes(id) && visible === false) return plan
  if (id === 'fixtures') return applyDisplay(plan, { fixtures: Boolean(visible) }, sheet)
  if (!SERVICE_SYSTEMS.some((item) => item.id === id)) return plan
  return setServiceLayer(plan, id, Boolean(visible))
}

export function setEveryLayer(plan, visible, workspace = 'rakenne', sheet = 'plan') {
  let next = plan
  SERVICE_SYSTEMS.forEach((item) => {
    next = setLayerEye(next, item.id, visible, workspace, sheet)
  })
  return setLayerEye(next, 'fixtures', visible, workspace, sheet)
}

export function revealedSystems(plan, workspace) {
  const pinned = new Set(pinnedLayers(workspace))
  return SERVICE_SYSTEMS.filter((item) => pinned.has(item.id) || layerVisible(plan, item.id)).map((item) => item.id)
}
