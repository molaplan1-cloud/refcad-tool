import { projectTypeById } from './access.js'
import { emptyServices } from './services.js'
import { emptyYard, hasYard } from './yard.js'

export function isColdProject(plan) {
  return plan?.projectType === 'kylmio'
}

export function hasHouseElements(plan) {
  if (!plan) return false
  if ((plan.walls || []).length) return true
  if ((plan.openings || []).length) return true
  if ((plan.rooms || []).length) return true
  if ((plan.fixtures || []).length) return true
  if ((plan.facades || []).length || (plan.facadeSplits || []).length) return true
  const services = plan.services
  if ((services?.nodes || []).length || (services?.runs || []).length) return true
  return hasYard(plan)
}

// Sets the project type and leaves every drawn object where it is.
export function applyProjectType(plan, typeId) {
  const type = projectTypeById(typeId)
  if (!plan || !type) return plan
  if (plan.projectType === type.id) return plan
  return { ...plan, projectType: type.id }
}

// Used only after the user confirms that house parts should be deleted.
export function stripHouseElements(plan) {
  if (!plan) return plan
  return {
    ...plan,
    walls: [],
    openings: [],
    rooms: [],
    fixtures: [],
    facades: [],
    facadeSplits: [],
    services: emptyServices(),
    yard: emptyYard(),
  }
}
