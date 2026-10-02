// Cold-room heat load, kept in SI and written so each line can be checked.
//
// Transmission uses internal surface area: Q = U · A · ΔT (watts, with U in
// W/m²K). A wall that faces another room uses that room's temperature. A
// partition wall that is flush with the outer shell is treated as envelope
// (ambient), and the parent room does not count that strip again. Heat that
// crosses from a parent room into a partition is added to the partition and
// subtracted from the parent, so the plant total does not count it twice.
//
// Product, sensible: Q = m_day · cp · ΔT / 24 h, cp in kJ/kg·K, result in W.
// Respiration is W/kg of the daily mass (treated as the resident mass).
// Door air: volume per day = openings · open seconds · door area · velocity,
// then Q = V · ρ · cp_air · ΔT / 86400. People, lights and extra equipment are
// averaged over 24 h. Evaporator fans are the equipment heat inside the room;
// condenser heat is assumed to stay outdoors. Slab pull-down is the average
// power to cool the floor mass over the chosen hours. A safety factor is
// applied to each room's net subtotal.

import { getType, suggestEvaporators } from './catalog.js'
import { hydrateRoom, internalDims, internalRect, externalRect, overlap1d, overlapArea } from './geometry.js'
import { flushContactLength, isCustomOutline, polygonMetrics, polygonTransmission } from './cadDraw.js'

export const AIR_DENSITY = 1.2
export const AIR_CP = 1005
export const SECONDS_PER_DAY = 86400
const TOUCH_TOL = 0.25
const FLUSH_TOL = 0.2

function n(value, digits) {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits)
}

function line(key, group, label, watts, formula) {
  return { key, group, label, watts, formula }
}

function sideLength(room, side) {
  const dims = internalDims(room)
  return side === 'n' || side === 's' ? dims.width : dims.depth
}

function facing(room, other, side) {
  const a = externalRect(room)
  const b = externalRect(other)
  if (side === 'e') return b.left - a.right
  if (side === 'w') return a.left - b.right
  if (side === 's') return b.top - a.bottom
  return a.top - b.bottom
}

function sideOverlap(room, other, side) {
  const a = internalRect(room)
  const b = internalRect(other)
  if (side === 'n' || side === 's') return overlap1d(a.left, a.right, b.left, b.right)
  return overlap1d(a.top, a.bottom, b.top, b.bottom)
}

function neighborsOnSide(room, side, rooms) {
  const found = []
  for (const other of rooms) {
    if (other.id === room.id) continue
    if (other.parentId === room.id) continue
    const gap = facing(room, other, side)
    const overlap = sideOverlap(room, other, side)
    if (Math.abs(gap) <= TOUCH_TOL && overlap > 0.15) found.push({ other, overlap })
  }
  return found
}

function flushLength(room, parent, side) {
  if (!parent) return 0
  const a = externalRect(room)
  const b = externalRect(parent)
  let flush = false
  if (side === 'e') flush = Math.abs(a.right - b.right) <= FLUSH_TOL
  else if (side === 'w') flush = Math.abs(a.left - b.left) <= FLUSH_TOL
  else if (side === 'n') flush = Math.abs(a.top - b.top) <= FLUSH_TOL
  else flush = Math.abs(a.bottom - b.bottom) <= FLUSH_TOL
  if (!flush) return 0
  return sideOverlap(room, parent, side)
}

function doorArea(room) {
  const doors = (room.equipment || []).filter((eq) => eq.category === 'door')
  if (!doors.length) return { area: room.load.doorWidthM * room.load.doorHeightM, count: 0 }
  const area = doors.reduce((sum, door) => sum + door.width * door.height, 0) / doors.length
  return { area, count: doors.length }
}

function childAreaInside(parent, child) {
  if (isCustomOutline(child)) return polygonMetrics(child).dims.area
  return overlapArea(internalRect(parent), internalRect(child))
}

function computeRoom(room, rooms) {
  const custom = isCustomOutline(room)
  const poly = custom ? polygonTransmission(room, rooms) : null
  const dims = custom ? poly.dims : internalDims(room)
  const parent = room.parentId ? rooms.find((r) => r.id === room.parentId) : null
  const load = room.load
  const lines = []
  let parentExchange = 0

  const ambient = { area: 0, u: room.uWall, dT: room.ambientTemp - room.temp }
  const interior = { area: 0, dT: parent ? parent.temp - room.temp : 0 }
  const height = dims.height

  if (custom) {
    poly.shares.forEach((share) => {
      const h = Math.min(height, isCustomOutline(share.other) ? polygonMetrics(share.other).dims.height : internalDims(share.other).height)
      const u = Math.min(room.uWall, share.other.uWall)
      const dT = share.other.temp - room.temp
      const area = share.length * h
      lines.push(line(
        `share-poly-${share.other.id}-${share.length.toFixed(2)}`,
        'transmission',
        `Väliseinä → ${share.other.label || share.other.name}`,
        u * area * dT,
        `${n(area, 2)} m² × ${n(u, 2)} W/m²K × ${n(dT, 1)} K`
      ))
    })
    ambient.area = poly.ambientLen * height
    interior.area = poly.interiorLen * height
  }

  for (const side of ['n', 's', 'e', 'w']) {
    if (custom) break
    const length = sideLength(room, side)
    let shared = 0
    for (const share of neighborsOnSide(room, side, rooms)) {
      const used = Math.min(share.overlap, Math.max(0, length - shared))
      if (used <= 0) continue
      shared += used
      const h = Math.min(height, internalDims(share.other).height)
      const u = Math.min(room.uWall, share.other.uWall)
      const dT = share.other.temp - room.temp
      const area = used * h
      const watts = u * area * dT
      lines.push(
        line(
          `share-${side}-${share.other.id}`,
          'transmission',
          `Väliseinä → ${share.other.label || share.other.name}`,
          watts,
          `${n(area, 2)} m² × ${n(u, 2)} W/m²K × ${n(dT, 1)} K`
        )
      )
    }
    const flush = Math.min(flushLength(room, parent, side), Math.max(0, length - shared))
    const rest = Math.max(0, length - shared - flush)
    ambient.area += (parent ? flush : rest + flush) * height
    if (parent) interior.area += rest * height
  }

  if (!room.parentId) {
    for (const child of rooms) {
      if (child.parentId !== room.id) continue
      if (isCustomOutline(child)) {
        const owned = flushContactLength(child, room)
        const childHeight = polygonMetrics(child).dims.height
        ambient.area -= owned * Math.min(height, childHeight)
        continue
      }
      for (const side of ['n', 's', 'e', 'w']) {
        const owned = flushLength(child, room, side)
        if (owned <= 0) continue
        const h = Math.min(height, internalDims(child).height)
        ambient.area -= owned * h
      }
    }
    ambient.area = Math.max(0, ambient.area)
  }

  if (ambient.area > 0) {
    const watts = room.uWall * ambient.area * ambient.dT
    lines.unshift(
      line(
        'walls-ambient',
        'transmission',
        'Ulkoseinät',
        watts,
        `${n(ambient.area, 2)} m² × ${n(room.uWall, 2)} W/m²K × ${n(ambient.dT, 1)} K`
      )
    )
  } else {
    lines.unshift(line('walls-ambient', 'transmission', 'Ulkoseinät', 0, 'ei ulkovaippaa tällä huoneella'))
  }

  if (parent && interior.area > 0) {
    const watts = room.uWall * interior.area * interior.dT
    parentExchange += watts
    lines.splice(1, 0, line(
      'walls-parent',
      'transmission',
      `Seinät → ${parent.label || parent.name}`,
      watts,
      `${n(interior.area, 2)} m² × ${n(room.uWall, 2)} W/m²K × ${n(interior.dT, 1)} K`
    ))
  }

  const children = rooms.filter((r) => r.parentId === room.id)
  let ceilArea = dims.area
  let floorArea = dims.area
  if (!parent) {
    for (const child of children) {
      const overlap = childAreaInside(room, child)
      if (!child.load.ceilingToParent) ceilArea -= overlap
      if (!child.load.floorToParent) floorArea -= overlap
    }
    ceilArea = Math.max(0, ceilArea)
    floorArea = Math.max(0, floorArea)
  }

  const ceilTemp = parent && load.ceilingToParent ? parent.temp : room.ambientTemp
  const ceilDt = ceilTemp - room.temp
  const ceilWatts = room.uCeiling * ceilArea * ceilDt
  if (parent && load.ceilingToParent) parentExchange += ceilWatts
  lines.push(line(
    'ceiling',
    'transmission',
    parent && load.ceilingToParent ? `Katto → ${parent.label || parent.name}` : 'Katto',
    ceilWatts,
    `${n(ceilArea, 2)} m² × ${n(room.uCeiling, 2)} W/m²K × ${n(ceilDt, 1)} K`
  ))

  const floorTemp = parent && load.floorToParent ? parent.temp : load.groundTempC
  const floorDt = floorTemp - room.temp
  const floorWatts = room.uFloor * floorArea * floorDt
  if (parent && load.floorToParent) parentExchange += floorWatts
  lines.push(line(
    'floor',
    'transmission',
    parent && load.floorToParent ? `Lattia → ${parent.label || parent.name}` : 'Lattia',
    floorWatts,
    `${n(floorArea, 2)} m² × ${n(room.uFloor, 2)} W/m²K × ${n(floorDt, 1)} K`
  ))

  const productDt = load.entryTempC - room.temp
  const productWatts = (load.dailyMassKg * load.cp * productDt * 1000) / SECONDS_PER_DAY
  lines.push(line(
    'product',
    'product',
    'Tuote, tuntuva',
    productWatts,
    `${n(load.dailyMassKg, 0)} kg/vrk × ${n(load.cp, 2)} kJ/kg·K × ${n(productDt, 1)} K / 24 h`
  ))

  const respWatts = load.dailyMassKg * load.respirationWPerKg
  lines.push(line(
    'respiration',
    'product',
    'Hengityslämpö',
    respWatts,
    `${n(load.dailyMassKg, 0)} kg × ${n(load.respirationWPerKg, 3)} W/kg`
  ))

  const surround = parent ? parent.temp : room.ambientTemp
  const { area: oneDoor, count: doorCount } = doorArea(room)
  const volumeDay = load.doorOpeningsPerDay * load.doorOpenSeconds * oneDoor * load.infiltrationVelocity
  const doorDt = surround - room.temp
  const doorWatts = (volumeDay * AIR_DENSITY * AIR_CP * doorDt) / SECONDS_PER_DAY
  const doorNote = doorCount
    ? `keskim. oviaukko ${n(oneDoor, 2)} m² (${doorCount} kpl)`
    : `oviaukko ${n(oneDoor, 2)} m² (ei sijoitettua ovea)`
  lines.push(line(
    'door',
    'infiltration',
    'Ovien ilmanvaihto',
    doorWatts,
    `${n(load.doorOpeningsPerDay, 0)} × ${n(load.doorOpenSeconds, 0)} s × ${doorNote} × ${n(load.infiltrationVelocity, 2)} m/s, ΔT ${n(doorDt, 1)} K`
  ))

  const achWatts = (load.airChangesPerDay * dims.volume * AIR_DENSITY * AIR_CP * doorDt) / SECONDS_PER_DAY
  lines.push(line(
    'ach',
    'infiltration',
    'Ilmanvaihtokerroin',
    achWatts,
    `${n(load.airChangesPerDay, 2)} 1/vrk × ${n(dims.volume, 1)} m³ × ΔT ${n(doorDt, 1)} K`
  ))

  const peopleWatts = load.people * load.peopleWatts * (load.peopleHoursPerDay / 24)
  lines.push(line(
    'people',
    'people',
    'Henkilöt',
    peopleWatts,
    `${n(load.people, 0)} × ${n(load.peopleWatts, 0)} W × ${n(load.peopleHoursPerDay, 1)} h / 24 h`
  ))

  let lightArea = dims.area
  if (!parent) {
    for (const child of children) lightArea -= childAreaInside(room, child)
    lightArea = Math.max(0, lightArea)
  }
  const lightWatts = lightArea * load.lightingWm2 * (load.lightingHoursPerDay / 24)
  lines.push(line(
    'lighting',
    'lighting',
    'Valaistus',
    lightWatts,
    `${n(lightArea, 2)} m² × ${n(load.lightingWm2, 1)} W/m² × ${n(load.lightingHoursPerDay, 1)} h / 24 h`
  ))

  const fanW = (room.equipment || [])
    .filter((eq) => eq.category === 'evaporator')
    .reduce((sum, eq) => sum + (eq.fanW || 0), 0)
  const fanWatts = fanW * (Number.isFinite(load.fanRuntime) ? load.fanRuntime : 1)
  lines.push(line(
    'fans',
    'equipment',
    'Höyrystimen puhaltimet',
    fanWatts,
    `${n(fanW, 0)} W × käyttö ${n(load.fanRuntime, 2)}`
  ))

  const extraWatts = load.extraEquipmentW * (load.equipmentHoursPerDay / 24)
  lines.push(line(
    'extra',
    'equipment',
    'Muu laitekuorma',
    extraWatts,
    `${n(load.extraEquipmentW, 0)} W × ${n(load.equipmentHoursPerDay, 1)} h / 24 h`
  ))

  let pullWatts = 0
  let pullFormula = 'ei mukana'
  if (load.pullDownEnabled) {
    const mass = floorArea * load.slabThicknessM * load.slabDensity
    const pullDt = load.slabInitialTempC - room.temp
    const hours = Math.max(1, load.pullDownHours)
    pullWatts = (mass * load.slabCp * pullDt * 1000) / (hours * 3600)
    pullFormula = `${n(mass, 0)} kg × ${n(load.slabCp, 2)} kJ/kg·K × ${n(pullDt, 1)} K / ${n(hours, 1)} h`
  }
  lines.push(line('pulldown', 'pulldown', 'Laatan jäähtyminen', pullWatts, pullFormula))

  return {
    id: room.id,
    name: room.name,
    label: room.label,
    type: room.type,
    typeName: getType(room.type).name,
    temp: room.temp,
    color: room.color,
    parentId: room.parentId,
    internal: dims,
    external: { width: room.width, depth: room.depth, height: room.height },
    lines,
    parentExchange,
    safetyFactor: load.safetyFactor > 0 ? load.safetyFactor : 1,
  }
}

function finish(draft) {
  const subtotal = draft.lines.reduce((sum, item) => sum + item.watts, 0)
  const total = subtotal * draft.safetyFactor
  return {
    ...draft,
    subtotal,
    total,
    suggestedEvap: suggestEvaporators(total),
  }
}

export function calculateProject(rawRooms) {
  const rooms = (rawRooms || []).map(hydrateRoom)
  const drafts = rooms.map((room) => computeRoom(room, rooms))

  for (const draft of drafts) {
    if (!draft.parentId || Math.abs(draft.parentExchange) < 0.05) continue
    const parent = drafts.find((item) => item.id === draft.parentId)
    if (!parent) continue
    parent.lines.push(line(
      `transfer-${draft.id}`,
      'transfer',
      `Siirto huoneeseen ${draft.label || draft.name}`,
      -draft.parentExchange,
      'sama lämpövirta kuin väliseinähuoneen sisäpinnoilla, vastakkaismerkkinen'
    ))
  }

  const results = drafts.map(finish)
  const subtotal = results.reduce((sum, room) => sum + room.subtotal, 0)
  const total = results.reduce((sum, room) => sum + room.total, 0)
  const internalArea = results.reduce((sum, room) => sum + room.internal.area, 0)
  const internalVolume = results.reduce((sum, room) => sum + room.internal.volume, 0)

  return {
    rooms: results,
    subtotal,
    total,
    internalArea,
    internalVolume,
    suggestedEvap: suggestEvaporators(total),
  }
}

export function resultFor(project, roomId) {
  return project.rooms.find((room) => room.id === roomId) || null
}
