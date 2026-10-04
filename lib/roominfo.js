// Live room quantities and design heat loss for Pohjakuva.
// heatingLoads() is the input the radiator and floor-heating sizing uses.

import { jsPDF } from 'jspdf'
import {
  WALL_HEIGHT,
  buildFloorPlanPdf,
  defaultRoomSetpoint,
  faceSide,
  materialOf,
  resolveFaceMaterial,
  pointInPolygon,
  roomForWallSide,
  segmentLength,
  visibleRooms,
} from './floorplan.js'
import { resolveFixture } from './furniture.js'
import { annualHeatingKwh, envelopeStructure, resolveWallStructure } from './structures.js'
import { climateOf, CLIMATE_PLACES, CLIMATE_ZONES } from './places.js'
import { coolingInput, coolingLoad, frameOf, glazingOf } from './cooling.js'
import { wallBearing } from './orientation.js'
import { formatNumber, pdfAscii, translate } from './i18n.js'
import { pdfLeadingMm } from './annotations.js'

export { CLIMATE_PLACES, CLIMATE_ZONES }

const YEAR_U = [
  { year: 1976, wall: 0.7, roof: 0.4, floor: 0.47, window: 2.8, door: 2.5, n50: 8 },
  { year: 1985, wall: 0.4, roof: 0.29, floor: 0.4, window: 2.1, door: 1.8, n50: 6 },
  { year: 2003, wall: 0.28, roof: 0.22, floor: 0.36, window: 1.8, door: 1.4, n50: 4 },
  { year: 2008, wall: 0.25, roof: 0.16, floor: 0.25, window: 1.4, door: 1.4, n50: 4 },
  { year: 9999, wall: 0.17, roof: 0.09, floor: 0.16, window: 1.0, door: 1.0, n50: 2 },
]

const CLASS_U = {
  A: { wall: 0.12, roof: 0.07, floor: 0.1, window: 0.8, door: 0.8, n50: 0.6 },
  B: { wall: 0.14, roof: 0.08, floor: 0.12, window: 0.9, door: 0.9, n50: 1 },
  D: { wall: 0.26, roof: 0.14, floor: 0.22, window: 1.4, door: 1.4, n50: 3 },
  E: { wall: 0.35, roof: 0.2, floor: 0.3, window: 1.8, door: 1.6, n50: 4 },
  F: { wall: 0.5, roof: 0.3, floor: 0.4, window: 2.1, door: 2.0, n50: 6 },
  G: { wall: 0.7, roof: 0.4, floor: 0.47, window: 2.8, door: 2.5, n50: 8 },
}

function yearReference(year) {
  const found = YEAR_U.find((row) => year < row.year)
  return found || YEAR_U[YEAR_U.length - 1]
}

export function referenceThermal({ year = 2018, energyClass = 'C' } = {}) {
  const base = CLASS_U[energyClass] || yearReference(year)
  return { ...base, partition: 0.5, ventilation: 0.35 }
}

export function thermalOf(plan, room) {
  const stored = plan?.thermal || {}
  const year = Number(stored.year) || 2018
  const energyClass = stored.energyClass || 'C'
  const ref = referenceThermal({ year, energyClass })
  const u = { ...ref, ...(stored.u || {}), ...(room?.thermal?.u || {}) }
  const climate = climateOf(plan)
  return {
    zone: climate.zone,
    zoneName: climate.zoneName,
    outdoor: climate.outdoor,
    summer: climate.summer,
    degreeDays: climate.degreeDays,
    coolingDegreeDays: climate.coolingDegreeDays,
    latitude: climate.latitude,
    place: climate.place,
    placeName: climate.placeName,
    year,
    energyClass,
    u,
    ventilation: Number.isFinite(stored.ventilation) ? stored.ventilation : ref.ventilation,
    n50: Number.isFinite(stored.n50) ? stored.n50 : ref.n50,
    electrical: climate.electrical,
    uMax: climate.uMax,
    country: climate.country,
  }
}

function num(value, digits = 1, locale = 'fi') {
  return formatNumber(value, locale, digits)
}

function openingKey(opening) {
  if (opening?.doorStyle === 'garage' || opening?.kind === 'garage' || opening?.doorStyle === 'sectional') return 'opening.garage'
  if (opening?.doorStyle === 'sliding') return 'opening.sliding'
  if (opening?.doorStyle === 'double') return 'opening.double'
  return opening?.kind === 'window' ? 'opening.window' : 'opening.door'
}

function sizeLabel(opening) {
  const width = Math.round((opening.width || 0) * 1000)
  const height = Math.round((opening.height || (opening.kind === 'window' ? 1.2 : 2.1)) * 1000)
  return `${width}×${height}`
}

function edgeOpenings(plan, wall, edge) {
  if (!wall) return []
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const along = (point) => (point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz
  const lo = Math.min(along(edge.a), along(edge.b))
  const hi = Math.max(along(edge.a), along(edge.b))
  return (plan.openings || []).filter((opening) => {
    if (opening.wallId !== wall.id) return false
    const overlap = Math.min(hi, opening.offset + opening.width / 2) - Math.max(lo, opening.offset - opening.width / 2)
    return overlap > 0.05
  }).map((opening) => {
    const overlap = Math.min(hi, opening.offset + opening.width / 2) - Math.max(lo, opening.offset - opening.width / 2)
    const height = opening.height || (opening.kind === 'window' ? 1.2 : 2.1)
    return { ...opening, overlap, area: Math.max(0, overlap) * height, height }
  })
}

export function instantFireplaceWatts(plan, room) {
  const poly = room?.polygon || room?.gross || []
  if (poly.length < 3) return 0
  let watts = 0
  ;(plan?.fixtures || []).forEach((fixture) => {
    if (fixture.hidden) return
    const spec = resolveFixture(fixture)
    if (spec.storing || !(spec.heatKw > 0)) return
    if (!pointInPolygon(fixture.x, fixture.z, poly)) return
    watts += spec.heatKw * 1000
  })
  return watts
}

export function roomReport(plan, room) {
  if (!room) return null
  const thermal = thermalOf(plan, room)
  const height = room.ceilingHeight || plan?.floorHeight || WALL_HEIGHT
  const floorArea = room.area || 0
  const ceilingArea = floorArea
  const setpoint = Number.isFinite(room.setpoint) ? room.setpoint : defaultRoomSetpoint(room.type)
  const edges = room.walls || []
  let perimeter = 0
  let grossWall = 0
  let netWall = 0
  const walls = []
  const windows = []
  const doors = []
  const materialArea = new Map()
  const heatParts = []

  const addHeat = (id, name, area, u, delta) => {
    if (!(area > 0.01) || !(delta > 0)) return
    heatParts.push({ id, name, area, u, watts: u * area * delta })
  }

  edges.forEach((edge, index) => {
    const wall = (plan.walls || []).find((item) => item.id === edge.wallId)
    const length = segmentLength(edge.a, edge.b)
    const side = wall ? faceSide(wall, edge.a, edge.b) : 'left'
    const materialId = wall ? resolveFaceMaterial(plan, wall, side) : (room.interiorId || 'paint')
    const material = materialOf('interior', materialId)
    const gross = length * height
    const openings = edgeOpenings(plan, wall, edge)
    const compass = wall ? wallBearing(plan, wall) : { bearing: 0, code: '' }
    const openingArea = openings.reduce((sum, item) => sum + item.area, 0)
    const net = Math.max(0, gross - openingArea)
    perimeter += length
    grossWall += gross
    netWall += net
    materialArea.set(materialId, (materialArea.get(materialId) || 0) + net)
    const otherSide = side === 'left' ? 'right' : 'left'
    const neighbor = wall ? roomForWallSide(plan, wall, otherSide) : null
    const neighborSet = neighbor ? (Number.isFinite(neighbor.setpoint) ? neighbor.setpoint : defaultRoomSetpoint(neighbor.type)) : null
    const exterior = edge.kind === 'exterior' || edge.kind === 'bearing' || !neighbor
    const coldPartition = !exterior && neighbor && neighbor.id !== room.id && neighborSet < setpoint - 2
    walls.push({
      index: index + 1,
      wallId: edge.wallId,
      side,
      length,
      gross,
      net,
      materialId,
      materialName: material.name,
      structure: wall?.structure || '',
      structureName: wall?.structure === 'ei30' ? 'EI30' : wall?.structure === 'ei60' ? 'EI60' : '',
      shared: Boolean(neighbor && neighbor.id !== room.id),
      neighbor: neighbor?.name || '',
      exterior,
      bearing: compass.bearing,
      code: compass.code,
      u: exterior ? (resolveWallStructure(plan, wall)?.u || thermal.u.wall) : (resolveWallStructure(plan, wall)?.u || thermal.u.partition),
      role: exterior ? 'ulkoseinä' : coldPartition ? 'kylmä väliseinä' : 'väliseinä',
    })
    openings.forEach((opening) => {
      const glass = glazingOf(opening)
      const frame = frameOf(opening)
      const row = {
        id: opening.id,
        kind: opening.kind,
        typeKey: openingKey(opening),
        type: translate('fi', openingKey(opening)),
        size: sizeLabel(opening),
        width: opening.width,
        height: opening.height,
        area: opening.area,
        bearing: compass.bearing,
        code: compass.code,
        u: glass.u,
        g: glass.g,
        frameFraction: frame.fraction,
        shading: opening.shading || 'none',
        overhang: opening.overhang,
        shadeHeight: opening.shadeHeight,
        neighbourAlt: opening.neighbourAlt,
      }
      if (opening.kind === 'window') windows.push(row)
      else doors.push(row)
    })
    if (exterior) {
      const winArea = openings.filter((item) => item.kind === 'window').reduce((sum, item) => sum + item.area, 0)
      const doorArea = openings.filter((item) => item.kind !== 'window').reduce((sum, item) => sum + item.area, 0)
      const wallU = resolveWallStructure(plan, wall)?.u || thermal.u.wall
      addHeat('wall', 'Ulkoseinät', net, wallU, setpoint - thermal.outdoor)
      openings.filter((item) => item.kind === 'window').forEach((item) => {
        addHeat('window', 'Ikkunat', item.area, glazingOf(item).u, setpoint - thermal.outdoor)
      })
      if (!openings.some((item) => item.kind === 'window') && winArea > 0) addHeat('window', 'Ikkunat', winArea, thermal.u.window, setpoint - thermal.outdoor)
      addHeat('door', 'Ovet', doorArea, thermal.u.door, setpoint - thermal.outdoor)
    } else if (coldPartition) {
      const delta = setpoint - neighborSet
      const hole = openings.reduce((sum, item) => sum + item.area, 0)
      const partitionU = resolveWallStructure(plan, wall)?.u || thermal.u.partition
      addHeat('partition', 'Väliseinä kylmään', Math.max(0, net), partitionU, delta)
      addHeat('partition-opening', 'Aukot kylmään tilaan', hole, thermal.u.door, delta)
    }
  })

  const floorU = envelopeStructure(plan, 'floor')?.u || thermal.u.floor
  const roofU = envelopeStructure(plan, 'roof')?.u || thermal.u.roof
  addHeat('floor', 'Lattia', floorArea, floorU, setpoint - thermal.outdoor)
  addHeat('roof', 'Yläpohja', ceilingArea, roofU, setpoint - thermal.outdoor)

  const volume = floorArea * height
  const ventLps = thermal.ventilation * floorArea
  const infilN = thermal.n50 / 20
  const infilLps = infilN * volume * (1000 / 3600)
  const air = 0.34
  const ventWatts = air * ventLps * Math.max(0, setpoint - thermal.outdoor)
  const infilWatts = air * infilLps * Math.max(0, setpoint - thermal.outdoor)
  if (ventWatts > 0.5) heatParts.push({ id: 'vent', name: 'Ilmanvaihto', area: floorArea, u: thermal.ventilation, watts: ventWatts })
  if (infilWatts > 0.5) heatParts.push({ id: 'infil', name: 'Vuotoilma', area: volume, u: thermal.n50, watts: infilWatts })

  const instant = instantFireplaceWatts(plan, room)
  if (instant > 0) heatParts.push({ id: 'wood', name: 'Puulämpö, hetkellinen', area: 0, u: 0, watts: -instant, storing: false })

  const merged = []
  heatParts.forEach((part) => {
    const found = merged.find((item) => item.id === part.id)
    if (found) {
      found.area += part.area
      found.watts += part.watts
    } else merged.push({ ...part })
  })
  const watts = Math.max(0, merged.reduce((sum, part) => sum + part.watts, 0))
  const report = {
    id: room.id,
    name: room.name || 'Huone',
    type: room.type || 'huone',
    floorArea,
    ceilingArea,
    perimeter,
    height,
    volume,
    walls,
    grossWall,
    netWall,
    byMaterial: [...materialArea.entries()].map(([id, area]) => ({
      id,
      name: materialOf('interior', id).name,
      area,
    })),
    windows,
    windowCount: windows.length,
    windowArea: windows.reduce((sum, item) => sum + item.area, 0),
    doors,
    doorCount: doors.length,
    doorArea: doors.reduce((sum, item) => sum + item.area, 0),
    heat: {
      setpoint,
      outdoor: thermal.outdoor,
      zone: thermal.zone,
      zoneName: thermal.zoneName,
      delta: setpoint - thermal.outdoor,
      year: thermal.year,
      energyClass: thermal.energyClass,
      watts,
      wattsPerM2: floorArea > 0.05 ? watts / floorArea : 0,
      degreeDays: thermal.degreeDays,
      annualKwh: annualHeatingKwh(watts, setpoint, thermal.outdoor, thermal.degreeDays),
      parts: merged,
      u: thermal.u,
      ventilation: thermal.ventilation,
      n50: thermal.n50,
    },
    roofU: roofU,
  }
  report.cooling = coolingLoad(coolingInput(plan, report, thermal))
  return report
}

export function heatingLoads(plan) {
  return visibleRooms(plan).map((room) => {
    const report = roomReport(plan, room)
    return {
      roomId: room.id,
      name: report.name,
      floorArea: report.floorArea,
      setpoint: report.heat.setpoint,
      watts: report.heat.watts,
      wattsPerM2: report.heat.wattsPerM2,
      parts: report.heat.parts,
    }
  })
}

export function formatRoomInfo(report, locale = 'fi') {
  if (!report) return ''
  const t = (key, vars) => translate(locale, key, vars)
  const n = (value, digits = 1) => num(value, digits, locale)
  const lines = [
    `${t('room.info')}\t${report.name}`,
    `${t('info.floorArea')}\t${n(report.floorArea)} m²`,
    `${t('info.ceilingArea')}\t${n(report.ceilingArea)} m²`,
    `${t('room.perimeter')}\t${n(report.perimeter)} m`,
    `${t('room.ceilingHeight')}\t${n(report.height, 2)} m`,
    `${t('room.volume')}\t${n(report.volume)} m³`,
    `${t('room.gross')}\t${n(report.grossWall)} m²`,
    `${t('room.net')}\t${n(report.netWall)} m²`,
    t('info.wallsHead'),
  ]
  report.walls.forEach((wall) => {
    const role = wall.exterior ? t('wall.role.exterior') : wall.role === 'kylmä väliseinä' ? t('wall.role.cold') : t('wall.role.partition')
    lines.push(`${t('room.wallN', { n: wall.index })}\t${wall.neighbor || role}\t${wall.materialName}\t${wall.structureName || '—'}\t${n(wall.gross)}\t${n(wall.net)}`)
  })
  lines.push(t('info.materialHead'))
  report.byMaterial.forEach((row) => lines.push(`${row.name}\t${n(row.area)}`))
  lines.push(`${t('room.windows')}\t${t('info.count', { count: report.windowCount })}\t${n(report.windowArea)} m²`)
  report.windows.forEach((item) => lines.push(`${item.typeKey ? t(item.typeKey) : item.type}\t${item.size}\t${n(item.area)} m²`))
  lines.push(`${t('room.doors')}\t${t('info.count', { count: report.doorCount })}\t${n(report.doorArea)} m²`)
  report.doors.forEach((item) => lines.push(`${item.typeKey ? t(item.typeKey) : item.type}\t${item.size}\t${n(item.area)} m²`))
  lines.push(`${t('heat.title')}\t${report.heat.zoneName}\t${t('heat.summary', { zone: '', outdoor: report.heat.outdoor, indoor: report.heat.setpoint })}`)
  lines.push(t('heat.partHead'))
  report.heat.parts.forEach((part) => lines.push(`${t(`heat.${part.id}`) === `heat.${part.id}` ? part.name : t(`heat.${part.id}`)}\t${n(part.area)}\t${n(part.u, 2)}\t${Math.round(part.watts)}`))
  lines.push(`${t('heat.total')}\t${Math.round(report.heat.watts)} W\t${n(report.heat.wattsPerM2)} W/m²`)
  if (report.heat.annualKwh) lines.push(`${t('heat.annual', { kwh: report.heat.annualKwh, hdd: report.heat.degreeDays })}`)
  if (report.cooling) {
    const hour = `${String(report.cooling.hour).padStart(2, '0')}:00`
    lines.push(`${t('cool.title')}\t${t('cool.hour', { hour })}\t${Math.round(report.cooling.watts)} W\t${n(report.cooling.wattsPerM2)} W/m²`)
    report.cooling.parts.forEach((part) => lines.push(`${t(`cool.${part.id}`)}\t${Math.round(part.watts)} W`))
    if (report.cooling.overheat) lines.push(t('cool.overheat'))
  }
  return lines.join('\n')
}

export function appendRoomReport(doc, plan) {
  const locale = plan?.locale || 'fi'
  const t = (key, vars) => translate(locale, key, vars)
  const rooms = visibleRooms(plan).map((room) => roomReport(plan, room)).filter(Boolean)
  doc.addPage()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 16
  const write = (text, size = 9, bold = false) => {
    if (y > pageH - 14) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(20)
    doc.text(pdfAscii(text), 14, y)
    y += pdfLeadingMm(size)
  }
  write(t('room.info'), 14, true)
  write(`${plan?.name || t('sheet.plan')}  ·  ${t('report.design')}`, 9)
  y += 2
  rooms.forEach((report) => {
    write(`${report.name}`, 12, true)
    write(t('report.floorLine', {
      floor: num(report.floorArea, 1, locale),
      ceiling: num(report.ceilingArea, 1, locale),
      perimeter: num(report.perimeter, 1, locale),
      height: num(report.height, 2, locale),
      volume: num(report.volume, 1, locale),
    }))
    write(`${t('room.gross')} ${num(report.grossWall, 1, locale)} m2, ${t('room.net')} ${num(report.netWall, 1, locale)} m2`)
    report.walls.forEach((wall) => {
      write(`  ${t('room.wallN', { n: wall.index })}: ${wall.materialName}${wall.structureName ? ` (${wall.structureName})` : ''}  ${wall.neighbor || wall.role}  ${num(wall.gross, 1, locale)} / ${num(wall.net, 1, locale)} m2`)
    })
    report.byMaterial.forEach((row) => write(`  ${row.name}: ${num(row.area, 1, locale)} m2`))
    write(`${t('room.windows')} ${t('info.count', { count: report.windowCount })}, ${num(report.windowArea, 1, locale)} m2${report.windows.map((item) => `  ${item.size}`).join('')}`)
    write(`${t('room.doors')} ${t('info.count', { count: report.doorCount })}, ${num(report.doorArea, 1, locale)} m2${report.doors.map((item) => `  ${item.typeKey ? t(item.typeKey) : item.type} ${item.size}`).join('')}`)
    write(`${t('heat.title')} ${report.heat.zone}  ${report.heat.outdoor} C  ${report.heat.setpoint} C  ${Math.round(report.heat.watts)} W  ${num(report.heat.wattsPerM2, 1, locale)} W/m2`, 9, true)
    report.heat.parts.forEach((part) => write(`  ${t(`heat.${part.id}`) === `heat.${part.id}` ? part.name : t(`heat.${part.id}`)}: ${Math.round(part.watts)} W`))
    if (report.cooling) {
      const hour = `${String(report.cooling.hour).padStart(2, '0')}:00`
      write(`${t('cool.title')} ${t('cool.hour', { hour })}  ${Math.round(report.cooling.watts)} W  ${num(report.cooling.wattsPerM2, 1, locale)} W/m2`, 9, true)
    }
    y += 2
  })
  if (!rooms.length) write(t('report.none'))
  doc.setFontSize(8)
  doc.text(pdfAscii(plan?.name || ''), 14, pageH - 8)
  return doc
}

export function buildPlanPdf(plan) {
  const doc = buildFloorPlanPdf(plan)
  return appendRoomReport(doc, plan)
}
