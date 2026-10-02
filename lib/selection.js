import { TEMPLATES } from './catalog.js'
import { sizeLine } from './pipeSizing.js'

const COVERING_COUNT = 3
const OVERSIZE = 1.6

function coversNeed(capacityKw, requiredKw) {
  return capacityKw + 1e-9 >= requiredKw * 0.98
}

export function offersForCapacity(templates, requiredKw, { limit = COVERING_COUNT } = {}) {
  const need = Math.max(0, requiredKw || 0)
  const sorted = [...(templates || [])].filter((item) => item && item.capacityKw > 0).sort((a, b) => a.capacityKw - b.capacityKw || a.name.localeCompare(b.name, 'fi'))
  if (!sorted.length) return { items: [], requiredKw: need, undersized: false }
  const covering = sorted.filter((item) => coversNeed(item.capacityKw, need))
  if (!covering.length) return { items: [sorted[sorted.length - 1]], requiredKw: need, undersized: true }
  return { items: covering.slice(0, limit), requiredKw: need, undersized: false }
}

export function capacityCheck(requiredKw, selectedKw) {
  const required = Math.max(0, requiredKw || 0)
  const selected = Math.max(0, selectedKw || 0)
  if (required <= 0.05 || selected <= 0.05) {
    return { requiredKw: required, selectedKw: selected, coverage: null, status: 'none', percent: null }
  }
  const coverage = selected / required
  let status = 'ok'
  if (!coversNeed(selected, required)) status = 'under'
  else if (coverage > OVERSIZE) status = 'over'
  return {
    requiredKw: required,
    selectedKw: selected,
    coverage,
    percent: Math.round(coverage * 100),
    status,
  }
}

function smallestCovering(list, requiredKw) {
  return offersForCapacity(list, requiredKw, { limit: 1 }).items[0] || null
}

export function suggestPackage(watts, options = {}) {
  const requiredKw = Math.max(0, (watts || 0) / 1000)
  const rejectionKw = requiredKw * (options.rejectionFactor || 1.25)
  const cubics = TEMPLATES.filter((item) => item.category === 'evaporator' && item.style !== 'slant')
  const slants = TEMPLATES.filter((item) => item.category === 'evaporator' && item.style === 'slant')
  const combos = TEMPLATES.filter((item) => item.category === 'combo' || item.category === 'unit')
  const condensers = TEMPLATES.filter((item) => item.category === 'condenser')
  const compressors = TEMPLATES.filter((item) => item.category === 'compressor')
  const evap = smallestCovering(cubics, requiredKw)
  const slant = smallestCovering(slants, requiredKw)
  const combo = smallestCovering(combos, requiredKw)
  const condenser = smallestCovering(condensers, rejectionKw)
  const compressor = smallestCovering(compressors, requiredKw)
  const duty = {
    refrigerant: options.refrigerant || 'R449A',
    capacityKw: requiredKw,
    teC: options.teC ?? -8,
    tcC: options.tcC ?? 40,
    lengthM: options.lengthM ?? 15,
    riseM: options.riseM ?? 3,
  }
  const suction = sizeLine({ ...duty, kind: 'suction' })
  const liquid = sizeLine({ ...duty, kind: 'liquid', riseM: options.liquidRiseM ?? 0 })
  return {
    requiredKw,
    rejectionKw,
    evap,
    slant,
    combo,
    condenser,
    compressor,
    suction,
    liquid,
    check: capacityCheck(requiredKw, evap?.capacityKw || 0),
  }
}

export function inTemplateGroup(item, groupId) {
  if (groupId === 'sensor') return item.category === 'sensor' || item.category === 'controller'
  if (groupId === 'combo') return item.category === 'combo' || item.category === 'unit'
  return item.category === groupId
}

export function templatesForGroup(groupId, requiredKw, { showAll = false, rejectionFactor = 1.25 } = {}) {
  const all = TEMPLATES.filter((item) => inTemplateGroup(item, groupId))
  const sized = groupId === 'evaporator' || groupId === 'condenser' || groupId === 'combo' || groupId === 'compressor'
  if (showAll || requiredKw == null || !sized) return all
  if (groupId === 'evaporator') {
    const cubic = offersForCapacity(all.filter((item) => item.style !== 'slant'), requiredKw)
    const slant = offersForCapacity(all.filter((item) => item.style === 'slant'), requiredKw)
    return [...cubic.items, ...slant.items]
  }
  const need = groupId === 'condenser' ? requiredKw * rejectionFactor : requiredKw
  return offersForCapacity(all, need).items
}
