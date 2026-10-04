import { addWall, emptyPlan, updateHouse } from './floorplan.js'

export const CURRENT_KEY = 'refcad-floorplan-v1'
export const LIBRARY_KEY = 'refcad-floorplan-library-v1'

export function newProjectId() {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptyLibrary() {
  return { projects: [] }
}

export function loadLibrary(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const projects = Array.isArray(parsed?.projects)
      ? parsed.projects.filter((item) => item && item.id && item.plan && Array.isArray(item.plan.walls))
      : []
    return { projects }
  } catch {
    return emptyLibrary()
  }
}

export function normalizePlan(parsed, fallbackName = 'Pohja') {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.walls)) {
    throw new Error('Tiedosto ei ole pohjakuva')
  }
  return {
    ...emptyPlan(parsed.name || fallbackName),
    ...parsed,
    name: parsed.name || fallbackName,
    projectId: parsed.projectId || newProjectId(),
    walls: parsed.walls,
    openings: Array.isArray(parsed.openings) ? parsed.openings : [],
    rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
    fixtures: Array.isArray(parsed.fixtures) ? parsed.fixtures : [],
    facades: Array.isArray(parsed.facades) ? parsed.facades : [],
    facadeSplits: Array.isArray(parsed.facadeSplits) ? parsed.facadeSplits : [],
  }
}

export function shellPlan(options = {}) {
  const length = Number(options.length) || 0
  const width = Number(options.width) || 0
  let plan = normalizePlan({
    ...emptyPlan(options.name || 'Uusi pohja'),
    projectId: options.projectId || newProjectId(),
    walls: [],
  }, options.name || 'Uusi pohja')
  plan = updateHouse(plan, {
    floorHeight: Number(options.floorHeight) || 2.6,
    exteriorThickness: Number(options.exteriorThickness) || 0.24,
    roofType: options.roofType || 'gable',
    roofPitch: Number.isFinite(Number(options.roofPitch)) ? Number(options.roofPitch) : 25,
    eaveOverhang: Number.isFinite(Number(options.eaveOverhang)) ? Number(options.eaveOverhang) : 0.5,
    roofId: options.roofId || plan.roofId,
    exteriorId: options.exteriorId || plan.exteriorId,
  })
  if (options.createWalls && length >= 1 && width >= 1) {
    const corners = [[0, 0], [length, 0], [length, width], [0, width], [0, 0]]
    for (let i = 0; i < corners.length - 1; i += 1) {
      plan = addWall(
        plan,
        { x: corners[i][0], z: corners[i][1] },
        { x: corners[i + 1][0], z: corners[i + 1][1] },
        'exterior',
      )
    }
  }
  return plan
}

export function saveProject(library, plan) {
  const source = library && Array.isArray(library.projects) ? library : emptyLibrary()
  const id = plan?.projectId || newProjectId()
  const stored = { ...plan, projectId: id }
  const entry = {
    id,
    name: stored.name || 'Pohja',
    updatedAt: new Date().toISOString(),
    plan: stored,
  }
  return {
    projects: [entry, ...source.projects.filter((item) => item.id !== id)].slice(0, 40),
  }
}

export function renameProject(library, id, name) {
  const next = String(name || '').trim() || 'Pohja'
  return {
    projects: (library?.projects || []).map((item) => (
      item.id === id ? { ...item, name: next, plan: { ...item.plan, name: next } } : item
    )),
  }
}

export function deleteProject(library, id) {
  return { projects: (library?.projects || []).filter((item) => item.id !== id) }
}

export function projectById(library, id) {
  return (library?.projects || []).find((item) => item.id === id) || null
}

export function exportPlanJson(plan) {
  return JSON.stringify(plan, null, 2)
}

export function importPlanJson(text) {
  const parsed = JSON.parse(text)
  return normalizePlan(parsed, 'Tuotu pohja')
}
