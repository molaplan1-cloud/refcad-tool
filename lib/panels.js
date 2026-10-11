// Side panels are stored per account so the canvas layout follows the user.

const KEY = 'refcad-side-panels-v1'

export function emptyPanels() {
  return { left: false, right: false, legend: false }
}

function owner(userId) {
  return userId || 'local'
}

export function readPanels(userId, storage = globalThis.localStorage) {
  try {
    const all = JSON.parse(storage?.getItem(KEY) || '{}')
    const row = all[owner(userId)] || {}
    return {
      left: Boolean(row.left),
      right: Boolean(row.right),
      legend: Boolean(row.legend),
    }
  } catch {
    return emptyPanels()
  }
}

export function writePanels(userId, state, storage = globalThis.localStorage) {
  if (!storage) return state
  let all = {}
  try { all = JSON.parse(storage.getItem(KEY) || '{}') || {} } catch { all = {} }
  const next = {
    left: Boolean(state?.left),
    right: Boolean(state?.right),
    legend: Boolean(state?.legend),
  }
  all[owner(userId)] = next
  storage.setItem(KEY, JSON.stringify(all))
  return next
}

export function panelCommand(event = {}) {
  const tag = event.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return null
  const key = String(event.key || '')
  const mod = Boolean(event.ctrlKey || event.metaKey)
  if (mod && !event.altKey && !event.shiftKey && key === '[') return 'left'
  if (mod && !event.altKey && !event.shiftKey && key === ']') return 'right'
  if (key === 'F11') return 'full'
  if (mod && event.shiftKey && !event.altKey && key.toLowerCase() === 'f') return 'full'
  return null
}

// left/right true means that panel is collapsed. Full canvas collapses both,
// and opens both again when they are already collapsed.
export function applyPanelCommand(state, command) {
  const current = { ...emptyPanels(), ...(state || {}) }
  if (command === 'left') return { ...current, left: !current.left }
  if (command === 'right') return { ...current, right: !current.right }
  if (command === 'full') {
    const collapsed = current.left && current.right
    return { ...current, left: !collapsed, right: !collapsed }
  }
  return current
}
