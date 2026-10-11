// Several cold rooms can share one condensing unit. The calculated load stays
// a suggestion; the user picks the machine and the pipes are drawn only when
// Autoputkitus is asked for.

import { TEMPLATES } from './catalog.js'

export const DEFAULT_DIVERSITY = 0.85

export function suctionLevel(room) {
  return Number(room?.temp) < 0 ? 'minus' : 'plus'
}

export function suggestCondensing(kw) {
  const need = Math.max(0, Number(kw) || 0)
  const units = TEMPLATES.filter((item) => item.category === 'combo').sort((a, b) => a.capacityKw - b.capacityKw)
  if (!units.length) return null
  return units.find((item) => item.capacityKw + 0.001 >= need) || units[units.length - 1]
}

function loadOf(result, room) {
  return (result?.rooms || []).find((item) => item.id === room.id) || null
}

function evapKw(room) {
  return (room.equipment || [])
    .filter((item) => item.category === 'evaporator')
    .reduce((sum, item) => sum + (Number(item.capacityKw) || 0), 0)
}

function factored(sum, count, factor) {
  if (count <= 1) return sum
  const value = Number(factor)
  const used = Number.isFinite(value) && value > 0 && value <= 1 ? value : DEFAULT_DIVERSITY
  return sum * used
}

export function groupUnits(rooms, result, options = {}) {
  const factor = options.diversity ?? DEFAULT_DIVERSITY
  const list = rooms || []
  const machines = []
  list.forEach((room) => {
    ;(room.equipment || []).forEach((eq) => {
      if (eq.category === 'combo' || eq.category === 'compressor' || eq.category === 'unit') {
        machines.push({ id: eq.id, name: eq.name, catalogId: eq.catalogId, capacityKw: Number(eq.capacityKw) || 0, category: eq.category, roomId: room.id })
      }
    })
  })
  const buckets = new Map()
  machines.forEach((machine) => buckets.set(machine.id, { machine, members: [] }))
  buckets.set('unassigned', { machine: null, members: [] })
  list.forEach((room) => {
    const row = loadOf(result, room)
    if (!row) return
    const key = room.unitId && buckets.has(room.unitId) ? room.unitId : 'unassigned'
    buckets.get(key).members.push({
      id: room.id,
      label: room.label,
      name: room.name,
      temp: room.temp,
      level: suctionLevel(room),
      kw: (row.total || 0) / 1000,
      evapKw: evapKw(room),
    })
  })
  const build = (bucket) => {
    const plus = bucket.members.filter((item) => item.level === 'plus')
    const minus = bucket.members.filter((item) => item.level === 'minus')
    const plusKw = factored(plus.reduce((sum, item) => sum + item.kw, 0), plus.length, factor)
    const minusKw = factored(minus.reduce((sum, item) => sum + item.kw, 0), minus.length, factor)
    const totalKw = plusKw + minusKw
    return {
      id: bucket.machine?.id || 'unassigned',
      machine: bucket.machine,
      rooms: bucket.members,
      plusKw,
      minusKw,
      totalKw,
      diversity: factor,
      suggested: suggestCondensing(totalKw),
    }
  }
  const groups = [...buckets.values()].filter((bucket) => bucket.machine || bucket.members.length).map(build)
  return { diversity: factor, groups }
}

export function assignRooms(rooms, roomIds, unitId) {
  const ids = new Set(roomIds || [])
  return (rooms || []).map((room) => (ids.has(room.id) ? { ...room, unitId: unitId || null } : room))
}

export function applyUnitChoice(rooms, equipmentId, templateId) {
  const template = TEMPLATES.find((item) => item.id === templateId && (item.category === 'combo' || item.category === 'compressor'))
  if (!template) return rooms
  return (rooms || []).map((room) => ({
    ...room,
    equipment: (room.equipment || []).map((eq) => (
      eq.id === equipmentId
        ? {
          ...eq,
          catalogId: template.id,
          name: template.name,
          capacityKw: template.capacityKw,
          width: template.width,
          depth: template.depth,
          height: template.height,
          fanW: template.fanW,
        }
        : eq
    )),
  }))
}
