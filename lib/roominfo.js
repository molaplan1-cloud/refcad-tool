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
  roomForWallSide,
  segmentLength,
  visibleRooms,
} from './floorplan.js'
import { annualHeatingKwh, envelopeStructure, resolveWallStructure } from './structures.js'

export const CLIMATE_ZONES = [
  { id: 'I', name: 'I Etelä-Suomi', outdoor: -26, degreeDays: 4200 },
  { id: 'II', name: 'II', outdoor: -29, degreeDays: 4700 },
  { id: 'III', name: 'III Keski-Suomi', outdoor: -32, degreeDays: 5200 },
  { id: 'IV', name: 'IV Pohjois-Suomi', outdoor: -38, degreeDays: 6300 },
]

export const CLIMATE_PLACES = [
  { id: 'helsinki', name: 'Helsinki', zone: 'I' },
  { id: 'espoo', name: 'Espoo', zone: 'I' },
  { id: 'vantaa', name: 'Vantaa', zone: 'I' },
  { id: 'turku', name: 'Turku', zone: 'I' },
  { id: 'hanko', name: 'Hanko', zone: 'I' },
  { id: 'tampere', name: 'Tampere', zone: 'II' },
  { id: 'lahti', name: 'Lahti', zone: 'II' },
  { id: 'pori', name: 'Pori', zone: 'II' },
  { id: 'lappeenranta', name: 'Lappeenranta', zone: 'II' },
  { id: 'kouvola', name: 'Kouvola', zone: 'II' },
  { id: 'jyvaskyla', name: 'Jyväskylä', zone: 'III' },
  { id: 'kuopio', name: 'Kuopio', zone: 'III' },
  { id: 'seinajoki', name: 'Seinäjoki', zone: 'III' },
  { id: 'vaasa', name: 'Vaasa', zone: 'III' },
  { id: 'joensuu', name: 'Joensuu', zone: 'III' },
  { id: 'oulu', name: 'Oulu', zone: 'IV' },
  { id: 'kajaani', name: 'Kajaani', zone: 'IV' },
  { id: 'rovaniemi', name: 'Rovaniemi', zone: 'IV' },
  { id: 'sodankyla', name: 'Sodankylä', zone: 'IV' },
]

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
  const zone = CLIMATE_ZONES.find((item) => item.id === (stored.zone || 'II')) || CLIMATE_ZONES[1]
  const place = CLIMATE_PLACES.find((item) => item.id === stored.place) || null
  return {
    zone: zone.id,
    zoneName: zone.name,
    outdoor: zone.outdoor,
    degreeDays: zone.degreeDays,
    place: place?.id || '',
    placeName: place?.name || '',
    year,
    energyClass,
    u,
    ventilation: Number.isFinite(stored.ventilation) ? stored.ventilation : ref.ventilation,
    n50: Number.isFinite(stored.n50) ? stored.n50 : ref.n50,
  }
}

function num(value, digits = 1) {
  return (Number(value) || 0).toFixed(digits).replace('.', ',')
}

function doorName(opening) {
  if (opening?.doorStyle === 'garage' || opening?.kind === 'garage') return 'Nosto-ovi'
  if (opening?.doorStyle === 'sliding') return 'Liukuovi'
  if (opening?.doorStyle === 'double') return 'Pariovi'
  if (opening?.doorStyle === 'sectional') return 'Nosto-ovi'
  return opening?.kind === 'window' ? 'Ikkuna' : 'Ovi'
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
      role: exterior ? 'ulkoseinä' : coldPartition ? 'kylmä väliseinä' : 'väliseinä',
    })
    openings.forEach((opening) => {
      const row = {
        id: opening.id,
        kind: opening.kind,
        type: doorName(opening),
        size: sizeLabel(opening),
        width: opening.width,
        height: opening.height,
        area: opening.area,
      }
      if (opening.kind === 'window') windows.push(row)
      else doors.push(row)
    })
    if (exterior) {
      const winArea = openings.filter((item) => item.kind === 'window').reduce((sum, item) => sum + item.area, 0)
      const doorArea = openings.filter((item) => item.kind !== 'window').reduce((sum, item) => sum + item.area, 0)
      const wallU = resolveWallStructure(plan, wall)?.u || thermal.u.wall
      addHeat('wall', 'Ulkoseinät', net, wallU, setpoint - thermal.outdoor)
      addHeat('window', 'Ikkunat', winArea, thermal.u.window, setpoint - thermal.outdoor)
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

  const merged = []
  heatParts.forEach((part) => {
    const found = merged.find((item) => item.id === part.id)
    if (found) {
      found.area += part.area
      found.watts += part.watts
    } else merged.push({ ...part })
  })
  const watts = merged.reduce((sum, part) => sum + part.watts, 0)
  return {
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
  }
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

export function formatRoomInfo(report) {
  if (!report) return ''
  const lines = [
    `Huoneen tiedot\t${report.name}`,
    `Lattiapinta-ala\t${num(report.floorArea)} m²`,
    `Kattopinta-ala\t${num(report.ceilingArea)} m²`,
    `Piiri\t${num(report.perimeter)} m`,
    `Huonekorkeus\t${num(report.height, 2)} m`,
    `Tilavuus\t${num(report.volume)} m³`,
    `Seinät brutto\t${num(report.grossWall)} m²`,
    `Seinät netto\t${num(report.netWall)} m²`,
    'Seinä\tNaapuri\tMateriaali\tRakenne\tBrutto m²\tNetto m²',
  ]
  report.walls.forEach((wall) => {
    lines.push(`Seinä ${wall.index}\t${wall.neighbor || wall.role}\t${wall.materialName}\t${wall.structureName || '—'}\t${num(wall.gross)}\t${num(wall.net)}`)
  })
  lines.push('Materiaali\tAla m²')
  report.byMaterial.forEach((row) => lines.push(`${row.name}\t${num(row.area)}`))
  lines.push(`Ikkunat\t${report.windowCount} kpl\t${num(report.windowArea)} m²`)
  report.windows.forEach((item) => lines.push(`${item.type}\t${item.size}\t${num(item.area)} m²`))
  lines.push(`Ovet\t${report.doorCount} kpl\t${num(report.doorArea)} m²`)
  report.doors.forEach((item) => lines.push(`${item.type}\t${item.size}\t${num(item.area)} m²`))
  lines.push(`Lämmitystarve\t${report.heat.zoneName}\tulko ${report.heat.outdoor} °C\tsisä ${report.heat.setpoint} °C`)
  lines.push('Osa\tAla\tU tai ilmanvaihto\tW')
  report.heat.parts.forEach((part) => lines.push(`${part.name}\t${num(part.area)}\t${num(part.u, 2)}\t${Math.round(part.watts)}`))
  lines.push(`Yhteensä\t${Math.round(report.heat.watts)} W\t${num(report.heat.wattsPerM2)} W/m²`)
  if (report.heat.annualKwh) lines.push(`Lämmitysenergia\t${report.heat.annualKwh} kWh/a\t${report.heat.degreeDays} Kd`)
  return lines.join('\n')
}

function pdfAscii(value) {
  return String(value ?? '')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Å/g, 'A')
    .replace(/²/g, '2').replace(/³/g, '3').replace(/×/g, 'x')
}

export function appendRoomReport(doc, plan) {
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
    y += size * 0.45 + 1.6
  }
  write('Huoneen tiedot', 14, true)
  write(`${plan?.name || 'Pohjakuva'}  ·  lämmityksen mitoitus`, 9)
  y += 2
  rooms.forEach((report) => {
    write(`${report.name}`, 12, true)
    write(`Lattia ${num(report.floorArea)} m2   Katto ${num(report.ceilingArea)} m2   Piiri ${num(report.perimeter)} m   Korkeus ${num(report.height, 2)} m   Tilavuus ${num(report.volume)} m3`)
    write(`Seinat brutto ${num(report.grossWall)} m2, netto ${num(report.netWall)} m2`)
    report.walls.forEach((wall) => {
      write(`  Seina ${wall.index}: ${wall.materialName}${wall.structureName ? ` (${wall.structureName})` : ''}  ${wall.neighbor || wall.role}  brutto ${num(wall.gross)}  netto ${num(wall.net)} m2`)
    })
    report.byMaterial.forEach((row) => write(`  ${row.name}: ${num(row.area)} m2`))
    write(`Ikkunat ${report.windowCount} kpl, ${num(report.windowArea)} m2${report.windows.map((item) => `  ${item.size}`).join('')}`)
    write(`Ovet ${report.doorCount} kpl, ${num(report.doorArea)} m2${report.doors.map((item) => `  ${item.type} ${item.size}`).join('')}`)
    write(`Lammitystarve ${report.heat.zone}  ulko ${report.heat.outdoor} C  sisapiste ${report.heat.setpoint} C  ${Math.round(report.heat.watts)} W  ${num(report.heat.wattsPerM2)} W/m2`, 9, true)
    report.heat.parts.forEach((part) => write(`  ${part.name}: ${Math.round(part.watts)} W`))
    y += 2
  })
  if (!rooms.length) write('Ei huoneita.')
  doc.setFontSize(8)
  doc.text(pdfAscii(plan?.name || ''), 14, pageH - 8)
  return doc
}

export function buildPlanPdf(plan) {
  const doc = buildFloorPlanPdf(plan)
  return appendRoomReport(doc, plan)
}
