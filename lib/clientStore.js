'use client'
// Client-side persistent storage using localStorage.
// Works on every browser, every device, every deployment.
// Trade-off: data is per-browser (not synced across devices) and lost if
// the user clears browser storage.

const PROJECTS_KEY = 'refcad:projects:v1'
const ACTIVE_PROJECT_KEY = 'refcad:active-project:v1'

function safeRead(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function safeWrite(key, value) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('localStorage write failed:', e)
    return false
  }
}

// Generate a stable-ish id without crypto.randomUUID (works everywhere)
export function makeId() {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  )
}

// === Projects ===
export function listProjects() {
  return safeRead(PROJECTS_KEY) || []
}

export function getProject(id) {
  const all = listProjects()
  return all.find((p) => p.id === id) || null
}

export function createProject(name = 'Uusi projekti') {
  const project = {
    id: makeId(),
    name,
    data: {
      rooms: [],
      dimUnit: 'auto',
      settings: {},
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const all = listProjects()
  all.unshift(project)
  safeWrite(PROJECTS_KEY, all)
  return project
}

export function updateProject(id, updates) {
  const all = listProjects()
  const idx = all.findIndex((p) => p.id === id)
  if (idx === -1) return null
  all[idx] = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  safeWrite(PROJECTS_KEY, all)
  return all[idx]
}

export function deleteProject(id) {
  const all = listProjects().filter((p) => p.id !== id)
  safeWrite(PROJECTS_KEY, all)
  return true
}

export function getActiveProjectId() {
  return safeRead(ACTIVE_PROJECT_KEY)
}

export function setActiveProjectId(id) {
  safeWrite(ACTIVE_PROJECT_KEY, id)
}
