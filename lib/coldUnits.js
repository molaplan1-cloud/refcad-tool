// Several cold rooms can share one condensing unit. The units here are
// assignments (K1, K2, …). They do not place a symbol or draw pipes.
// Autoputkitus runs only when asked, and then to a unit the user has placed.

import { TEMPLATES, isRefrigerated, suggestEvaporators } from './catalog.js'
import { genId } from './geometry.js'

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

function templateById(id) {
  if (!id) return null
  return TEMPLATES.find((item) => item.id === id) || null
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

function memberOf(room, result) {
  const row = loadOf(result, room)
  if (!row) return null
  return {
    id: room.id,
    label: room.label,
    name: room.name,
    temp: room.temp,
    level: suctionLevel(room),
    kw: (row.total || 0) / 1000,
    evapKw: evapKw(room),
  }
}

function buildGroup(bucket, factor) {
  const plus = bucket.members.filter((item) => item.level === 'plus')
  const minus = bucket.members.filter((item) => item.level === 'minus')
  const plusKw = factored(plus.reduce((sum, item) => sum + item.kw, 0), plus.length, factor)
  const minusKw = factored(minus.reduce((sum, item) => sum + item.kw, 0), minus.length, factor)
  const totalKw = plusKw + minusKw
  const chosen = templateById(bucket.machine?.catalogId)
  return {
    id: bucket.machine?.id || 'unassigned',
    machine: bucket.machine,
    rooms: bucket.members,
    plusKw,
    minusKw,
    totalKw,
    diversity: factor,
    suggested: suggestCondensing(totalKw),
    chosen,
  }
}

function groupLogical(rooms, result, units, factor) {
  const buckets = new Map()
  ;(units || []).forEach((unit) => {
    const chosen = templateById(unit.catalogId)
    buckets.set(unit.id, {
      machine: {
        id: unit.id,
        name: unit.name,
        catalogId: unit.catalogId || '',
        capacityKw: chosen?.capacityKw || 0,
        category: 'combo',
        placedId: unit.placedId || null,
        logical: true,
      },
      members: [],
    })
  })
  buckets.set('unassigned', { machine: null, members: [] })
  ;(rooms || []).forEach((room) => {
    const member = memberOf(room, result)
    if (!member) return
    const key = room.unitId && buckets.has(room.unitId) ? room.unitId : 'unassigned'
    buckets.get(key).members.push(member)
  })
  const groups = [...buckets.values()]
    .filter((bucket) => bucket.machine || bucket.members.length)
    .map((bucket) => buildGroup(bucket, factor))
  return { diversity: factor, groups }
}

export function groupUnits(rooms, result, options = {}) {
  const factor = options.diversity ?? DEFAULT_DIVERSITY
  if (Array.isArray(options.units)) return groupLogical(rooms, result, options.units, factor)
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
    const member = memberOf(room, result)
    if (!member) return
    const key = room.unitId && buckets.has(room.unitId) ? room.unitId : 'unassigned'
    buckets.get(key).members.push(member)
  })
  const groups = [...buckets.values()].filter((bucket) => bucket.machine || bucket.members.length).map((bucket) => buildGroup(bucket, factor))
  return { diversity: factor, groups }
}

export function assignRooms(rooms, roomIds, unitId) {
  const ids = new Set(roomIds || [])
  return (rooms || []).map((room) => (ids.has(room.id) ? { ...room, unitId: unitId || null } : room))
}

export function nextUnitName(units) {
  const used = new Set((units || []).map((unit) => unit.name))
  let n = 1
  while (used.has(`K${n}`)) n += 1
  return `K${n}`
}

export function createUnit(units, fields = {}) {
  const unit = {
    id: fields.id || genId(),
    name: fields.name || nextUnitName(units),
    catalogId: fields.catalogId || null,
    placedId: fields.placedId || null,
  }
  return { unit, units: [...(units || []), unit] }
}

export function pickUnitModel(units, unitId, templateId) {
  const template = TEMPLATES.find((item) => item.id === templateId && item.category === 'combo')
  return (units || []).map((unit) => (
    unit.id === unitId ? { ...unit, catalogId: template ? template.id : null } : unit
  ))
}

export function bindPlacedUnit(units, unitId, placedId) {
  return (units || []).map((unit) => (
    unit.id === unitId ? { ...unit, placedId: placedId || null } : unit
  ))
}

function pruneEmpty(units, rooms) {
  const used = new Set((rooms || []).map((room) => room.unitId).filter(Boolean))
  return (units || []).filter((unit) => used.has(unit.id))
}

export function assignOwnUnit(rooms, units, roomId) {
  const created = createUnit(units)
  return {
    unit: created.unit,
    units: created.units,
    rooms: assignRooms(rooms, [roomId], created.unit.id),
  }
}

export function assignAllToOne(rooms, units) {
  const targets = (rooms || []).filter((room) => isRefrigerated(room?.type))
  if (!targets.length) return { rooms: rooms || [], units: units || [] }
  let list = [...(units || [])]
  let host = list[0]
  if (!host) {
    const created = createUnit(list)
    host = created.unit
    list = created.units
  }
  const nextRooms = assignRooms(rooms, targets.map((room) => room.id), host.id)
  return { rooms: nextRooms, units: pruneEmpty(list, nextRooms) }
}

export function assignEachOwn(rooms, units) {
  let list = [...(units || [])]
  let next = rooms || []
  ;(rooms || []).filter((room) => isRefrigerated(room?.type)).forEach((room) => {
    const mates = next.filter((item) => item.unitId && item.unitId === room.unitId)
    const known = list.some((unit) => unit.id === room.unitId)
    if (known && mates.length === 1) return
    const created = createUnit(list)
    list = created.units
    next = assignRooms(next, [room.id], created.unit.id)
  })
  return { rooms: next, units: pruneEmpty(list, next) }
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

// Autoputkitus uses a placed symbol. A logical unit routes there only when
// the user has bound that symbol; otherwise the caller keeps the nearest unit.
export function placedMachineId(units, unitId) {
  if (!unitId) return null
  const logical = (units || []).find((unit) => unit.id === unitId)
  if (!logical) return unitId
  return logical.placedId || null
}

function findEquipment(rooms, id) {
  if (!id) return null
  for (const room of rooms || []) {
    const hit = (room.equipment || []).find((item) => item.id === id)
    if (hit) return hit
  }
  return null
}

function evaporatorsFor(member, rooms, result) {
  const full = (rooms || []).find((room) => room.id === member.id)
  const placed = (full?.equipment || []).filter((item) => item.category === 'evaporator')
  if (placed.length) {
    return placed.map((item) => ({
      roomId: member.id,
      roomLabel: member.label,
      roomName: member.name,
      name: item.name,
      capacityKw: Number(item.capacityKw) || 0,
      count: 1,
      placed: true,
    }))
  }
  const row = (result?.rooms || []).find((item) => item.id === member.id)
  const watts = row ? row.total : (member.kw || 0) * 1000
  const suggested = row?.suggestedEvap || suggestEvaporators(watts)
  return [{
    roomId: member.id,
    roomLabel: member.label,
    roomName: member.name,
    name: suggested?.template?.name || '',
    capacityKw: suggested?.template?.capacityKw || 0,
    count: suggested?.count || 1,
    placed: false,
  }]
}

// One condensing unit per logical unit, and one evaporator per room from that
// room's own load. The site total is never turned into a single evaporator.
export function equipmentBrief(rooms, result, options = {}) {
  const board = groupUnits(rooms, result, options)
  return board.groups.filter((group) => group.rooms.length).map((group) => {
    const placed = findEquipment(rooms, group.machine?.placedId)
    const picked = group.chosen || group.suggested
    return {
      id: group.id,
      name: group.machine?.name || '',
      unassigned: !group.machine,
      totalKw: group.totalKw,
      machineName: placed?.name || picked?.name || '',
      machineKw: placed ? (Number(placed.capacityKw) || picked?.capacityKw || 0) : (picked?.capacityKw || 0),
      evaporators: group.rooms.flatMap((member) => evaporatorsFor(member, rooms, result)),
    }
  })
}

export function formatEquipmentLine(group, labels = {}) {
  const unassigned = labels.unassigned || 'Ei koneikkoa'
  const head = group.unassigned ? unassigned : group.name
  const evaps = (group.evaporators || []).map((ev) => {
    const count = ev.count > 1 ? `${ev.count} × ` : ''
    const room = ev.roomLabel || ev.roomName || ''
    return `${count}${ev.name}${room ? ` (${room})` : ''}`
  }).join(', ')
  if (group.machineName && evaps) return `${head}: ${group.machineName} + ${evaps}`
  if (group.machineName) return `${head}: ${group.machineName}`
  return evaps ? `${head}: ${evaps}` : head
}

export function equipmentRows(groups) {
  const rows = []
  ;(groups || []).forEach((group) => {
    if (group.machineName) {
      rows.push({
        kind: 'unit',
        unit: group.unassigned ? '' : group.name,
        room: '',
        name: group.machineName,
        count: 1,
        capacityKw: group.machineKw,
      })
    }
    ;(group.evaporators || []).forEach((ev) => {
      rows.push({
        kind: 'evaporator',
        unit: group.unassigned ? '' : group.name,
        room: ev.roomLabel || '',
        name: ev.name,
        count: ev.count || 1,
        capacityKw: ev.capacityKw,
      })
    })
  })
  return rows
}
