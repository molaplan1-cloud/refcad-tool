// Summer cooling load for one room and for the house.
// A clear design day: beam from a simple air-mass model, vertical
// irradiance by compass bearing, sol-air temperature on walls and roof.

import { climateOf } from './places.js'

export const GLAZING = [
  { id: 'double', u: 2.7, g: 0.75 },
  { id: 'double-low-e', u: 1.1, g: 0.63 },
  { id: 'triple', u: 1.0, g: 0.5 },
  { id: 'triple-low-e', u: 0.7, g: 0.45 },
  { id: 'solar', u: 1.1, g: 0.28 },
]

export const FRAMES = [
  { id: 'wood', fraction: 0.2 },
  { id: 'aluminium', fraction: 0.15 },
  { id: 'pvc', fraction: 0.18 },
]

export const SHADING = [
  { id: 'none' },
  { id: 'overhang' },
  { id: 'blind' },
  { id: 'curtain' },
  { id: 'neighbour' },
]

const SOLAR = 1361
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

export function glazingOf(opening) {
  const id = opening?.glazing || 'double-low-e'
  return GLAZING.find((item) => item.id === id) || GLAZING[1]
}

export function frameOf(opening) {
  const id = opening?.frame || 'pvc'
  return FRAMES.find((item) => item.id === id) || FRAMES[2]
}

export function solarPosition(latitude, hour) {
  const phi = (Number(latitude) || 0) * Math.PI / 180
  const delta = 23.45 * Math.PI / 180
  const H = 15 * ((Number(hour) || 12) - 12) * Math.PI / 180
  const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H)
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)))
  const cosAlt = Math.cos(alt) || 1e-6
  let cosAz = (Math.sin(delta) * Math.cos(phi) - Math.cos(delta) * Math.sin(phi) * Math.cos(H)) / cosAlt
  cosAz = Math.max(-1, Math.min(1, cosAz))
  let az = Math.acos(cosAz) * 180 / Math.PI
  if (H > 0) az = 360 - az
  return { alt: alt * 180 / Math.PI, az }
}

function outdoorAt(summer, hour) {
  const swing = 10
  const phase = ((Number(hour) || 15) - 15) * Math.PI / 12
  return summer - (swing / 2) * (1 - Math.cos(phase))
}

function irradiance(latitude, hour) {
  const sun = solarPosition(latitude, hour)
  if (sun.alt <= 0) return { ...sun, idn: 0, diffuseH: 0, globalH: 0 }
  const sinAlt = Math.sin(sun.alt * Math.PI / 180)
  const mass = 1 / Math.max(sinAlt, 0.07)
  const idn = SOLAR * (0.7 ** (mass ** 0.678))
  const beamH = idn * sinAlt
  const diffuseH = 0.2 * beamH
  return { ...sun, idn, diffuseH, globalH: beamH + diffuseH }
}

function surfaceBeam(idn, alt, az, bearing) {
  const altR = alt * Math.PI / 180
  const diff = ((Number(az) || 0) - (Number(bearing) || 0)) * Math.PI / 180
  const cosTheta = Math.cos(altR) * Math.cos(diff)
  if (cosTheta <= 0) return 0
  return idn * cosTheta
}

function shadeFactor(window, alt) {
  const kind = window?.shading || 'none'
  if (kind === 'blind') return 0.15
  if (kind === 'curtain') return 0.55
  if (kind === 'neighbour') {
    const mask = Number(window.neighbourAlt) || 20
    return alt < mask ? 0.2 : 1
  }
  if (kind === 'overhang') {
    const depth = Number(window.overhang) || 0.6
    const gap = Number.isFinite(window.shadeHeight) ? window.shadeHeight : 0.3
    const winH = window.height || 1.2
    if (alt <= 0 || winH <= 0) return 1
    const shadow = depth * Math.tan(alt * Math.PI / 180) - gap
    const exposed = Math.max(0, winH - Math.max(0, shadow))
    return exposed / winH
  }
  return 1
}

function unshadedWarm(window) {
  const kind = window?.shading || 'none'
  if (kind === 'blind' || kind === 'overhang' || kind === 'neighbour') return false
  const bearing = ((Number(window?.bearing) || 0) + 360) % 360
  const southWest = bearing >= 157.5 && bearing <= 292.5
  return southWest && (window?.g ?? 0.63) >= 0.45
}

function occupants(roomType, area) {
  if (roomType === 'olohuone') return 2
  if (roomType === 'makuuhuone') return 1
  if (roomType === 'keittio') return 1
  if (roomType === 'autotalli' || roomType === 'tekninen' || roomType === 'vaatehuone') return 0
  return area > 12 ? 1 : 0
}

function applianceWatts(roomType) {
  if (roomType === 'keittio') return 350
  if (roomType === 'olohuone') return 180
  if (roomType === 'makuuhuone') return 40
  if (roomType === 'autotalli' || roomType === 'tekninen') return 0
  return 60
}

export function suggestEquipment(watts) {
  if (!(watts > 400)) return null
  const size = Math.ceil(watts / 500) * 500
  const kind = watts >= 7000 ? 'fan-coil' : watts >= 4000 ? 'air-air' : 'split'
  return { kind, watts: size }
}

function loadAt(input, hour) {
  const sun = irradiance(input.latitude, hour)
  const tout = outdoorAt(input.summer, hour)
  const tin = input.coolSet
  const parts = []
  let solar = 0
  let glass = 0
  ;(input.windows || []).forEach((window) => {
    const area = Math.max(0, window.area || 0)
    if (!(area > 0)) return
    const beam = sun.alt > 0 ? surfaceBeam(sun.idn, sun.alt, sun.az, window.bearing) : 0
    const diffuse = sun.alt > 0 ? 0.5 * sun.diffuseH : 0
    const shade = shadeFactor(window, sun.alt)
    const glassFactor = Math.max(0, 1 - (window.frameFraction ?? 0.18))
    solar += area * (window.g ?? 0.63) * glassFactor * shade * (beam + diffuse)
    glass += Math.max(0, (window.u ?? 1.1) * area * (tout - tin))
  })
  if (solar > 1) parts.push({ id: 'solar', watts: solar })
  if (glass > 1) parts.push({ id: 'glass', watts: glass })
  let wall = 0
  ;(input.walls || []).forEach((item) => {
    const beam = sun.alt > 0 ? surfaceBeam(sun.idn, sun.alt, sun.az, item.bearing) : 0
    const diffuse = sun.alt > 0 ? 0.5 * sun.diffuseH : 0
    const tsa = tout + 0.6 * (beam + diffuse) / 17
    wall += Math.max(0, (item.u || 0) * (item.area || 0) * (tsa - tin))
  })
  if (wall > 1) parts.push({ id: 'wall', watts: wall })
  const roofI = sun.globalH
  const roofT = tout + 0.8 * roofI / 17
  const roof = Math.max(0, (input.roofU || 0) * (input.roofArea || 0) * (roofT - tin))
  if (roof > 1) parts.push({ id: 'roof', watts: roof })
  const people = occupants(input.roomType, input.floorArea) * 75
  const lighting = (input.floorArea || 0) * 8
  const appliances = applianceWatts(input.roomType)
  const internal = people + lighting + appliances
  if (internal > 1) parts.push({ id: 'internal', watts: internal })
  const ventLps = (input.ventilation || 0) * (input.floorArea || 0)
  const infilLps = ((input.n50 || 0) / 20) * (input.floorArea || 0) * (input.height || 2.6) * (1000 / 3600)
  const vent = Math.max(0, 0.34 * (ventLps + infilLps) * (tout - tin))
  if (vent > 1) parts.push({ id: 'vent', watts: vent })
  const watts = parts.reduce((sum, part) => sum + part.watts, 0)
  return { hour, watts, parts, outdoor: tout }
}

export function coolingLoad(input) {
  const coolSet = input.setpoint <= 20 ? 25 : input.setpoint
  const spec = { ...input, coolSet }
  const hours = HOURS.map((hour) => loadAt(spec, hour))
  const peak = hours.reduce((best, row) => (row.watts > best.watts ? row : best), hours[0])
  const warmArea = (input.windows || []).filter(unshadedWarm).reduce((sum, item) => sum + (item.area || 0), 0)
  const ratio = (input.floorArea || 0) > 0.05 ? warmArea / input.floorArea : 0
  return {
    watts: peak.watts,
    wattsPerM2: (input.floorArea || 0) > 0.05 ? peak.watts / input.floorArea : 0,
    hour: peak.hour,
    parts: peak.parts,
    hours,
    floorArea: input.floorArea || 0,
    coolSet,
    summer: input.summer,
    overheat: ratio > 0.08,
    warmRatio: ratio,
    equipment: suggestEquipment(peak.watts),
  }
}

export function coincidentPeak(loads) {
  const list = (loads || []).filter((item) => item?.hours?.length)
  if (!list.length) return { hour: 15, watts: 0, wattsPerM2: 0, area: 0 }
  let best = { hour: list[0].hours[0].hour, watts: -1 }
  list[0].hours.forEach((slot, index) => {
    const watts = list.reduce((sum, load) => sum + (load.hours[index]?.watts || 0), 0)
    if (watts > best.watts) best = { hour: slot.hour, watts }
  })
  const area = list.reduce((sum, load) => sum + (load.floorArea || 0), 0)
  return { ...best, area, wattsPerM2: area > 0.05 ? best.watts / area : 0 }
}

export function coolingInput(plan, report, thermal) {
  const climate = thermal || climateOf(plan)
  const windows = (report?.windows || []).map((item) => ({
    area: item.area,
    height: item.height || 1.2,
    u: item.u,
    g: item.g,
    frameFraction: item.frameFraction,
    bearing: item.bearing,
    shading: item.shading,
    overhang: item.overhang,
    shadeHeight: item.shadeHeight,
    neighbourAlt: item.neighbourAlt,
  }))
  const walls = (report?.walls || []).filter((item) => item.exterior).map((item) => ({
    area: item.net,
    u: item.u,
    bearing: item.bearing,
  }))
  return {
    latitude: climate.latitude,
    summer: climate.summer,
    setpoint: report?.heat?.setpoint ?? 21,
    floorArea: report?.floorArea || 0,
    height: report?.height || 2.6,
    ventilation: climate.ventilation ?? report?.heat?.ventilation ?? 0.35,
    n50: climate.n50 ?? report?.heat?.n50 ?? 2,
    roofArea: report?.ceilingArea || report?.floorArea || 0,
    roofU: report?.roofU ?? climate.u?.roof ?? 0.09,
    roomType: report?.type,
    windows,
    walls,
  }
}
