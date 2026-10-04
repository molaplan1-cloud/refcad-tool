export const WORKSPACES = [
  { id: 'rakenne', name: 'Rakenne', systems: [] },
  { id: 'kalusteet', name: 'Kalusteet', systems: [] },
  { id: 'sahko', name: 'Sähkö', systems: ['electric'] },
  { id: 'iv', name: 'IV', systems: ['iv'] },
  { id: 'lvi', name: 'LVI', systems: ['water', 'heat', 'drain'] },
  { id: 'piha', name: 'Piha', systems: [] },
]

export function workspaceById(id) {
  return WORKSPACES.find((item) => item.id === id) || WORKSPACES[0]
}

export function workspaceSystems(id) {
  return workspaceById(id).systems
}

export function applyWorkspaceSwitch(plan, workspaceId) {
  if (!WORKSPACES.some((item) => item.id === workspaceId)) return plan
  return plan
}

export function workspaceAllows(workspace, hit) {
  if (!hit) return false
  if (hit.kind === 'canvas') return true
  const system = hit.system || hit.service?.system
  if (hit.kind === 'service' || hit.target === 'node' || hit.target === 'run') {
    return workspaceSystems(workspace).includes(system)
  }
  if (workspace === 'rakenne') return ['wall', 'room', 'opening', 'corner', 'label', 'zone', 'roof'].includes(hit.kind)
  if (workspace === 'kalusteet') return hit.kind === 'fixture'
  if (workspace === 'piha') return hit.kind === 'yard' || Boolean(hit.collection)
  return false
}
