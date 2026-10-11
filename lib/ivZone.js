/** Where an MEP route is installed. One catalog for IV, LVI and electrical. */

export const IV_ZONES = ['ylapohja', 'sisatilat', 'valipohja', 'alapohja']
export const LVI_ZONES = ['lattia', 'seinassa', 'pinta', 'ylapohja', 'valipohja', 'alapohja']
export const ELECTRIC_ZONES = ['lattia', 'pinta', 'seinassa', 'ylapohja', 'valipohja']

const ALL_ZONES = [...new Set([...IV_ZONES, ...LVI_ZONES, ...ELECTRIC_ZONES])]

const DEFAULT_ZONE = {
  iv: 'sisatilat',
  water: 'lattia',
  heat: 'lattia',
  drain: 'alapohja',
  electric: 'lattia',
}

const AUTO_INSULATION = {
  'wool-100': 'iv.insulation.wool',
  condensate: 'iv.insulation.condensate',
  suojaputki: 'zone.part.suojaputki',
  eristys: 'zone.part.eristys',
  kaapelikouru: 'zone.part.kaapelikouru',
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

export function disciplineOf(system) {
  if (system === 'iv') return 'iv'
  if (system === 'electric') return 'electric'
  if (system === 'water' || system === 'heat' || system === 'drain') return 'lvi'
  return ''
}

export function zonesFor(system) {
  if (system === 'iv') return IV_ZONES
  if (system === 'electric') return ELECTRIC_ZONES
  if (system === 'water' || system === 'heat' || system === 'drain') return LVI_ZONES
  return []
}

export function zoneAllowed(zone, system) {
  return zonesFor(system).includes(zone)
}

export function projectIvZone(plan) {
  const zone = plan?.ivZone || plan?.installZone?.iv
  return IV_ZONES.includes(zone) ? zone : 'sisatilat'
}

export function projectZone(plan, system) {
  if (system === 'iv') return projectIvZone(plan)
  const stored = plan?.installZone?.[system]
  return zoneAllowed(stored, system) ? stored : (DEFAULT_ZONE[system] || '')
}

export function zoneLabelKey(system, zone) {
  if (zone === 'ylapohja') return 'iv.zone.ylapohja'
  if (zone === 'valipohja') return 'iv.zone.valipohja'
  if (zone === 'sisatilat') return 'iv.zone.sisatilat'
  if (zone === 'alapohja' && system === 'iv') return 'iv.zone.alapohja'
  if (zone === 'alapohja') return 'zone.lvi.alapohja'
  if (zone === 'lattia' && system === 'electric') return 'zone.el.lattia'
  if (zone === 'lattia') return 'zone.lvi.lattia'
  if (zone === 'seinassa') return 'zone.seinassa'
  if (zone === 'pinta' && system === 'electric') return 'zone.el.pinta'
  if (zone === 'pinta') return 'zone.lvi.pinta'
  return `iv.zone.${zone}`
}

export function zoneHeight(plan, zone) {
  const ceiling = Number(plan?.floorHeight) || 2.6
  if (zone === 'ylapohja') return round3(ceiling + 0.22)
  if (zone === 'valipohja') return round3(Math.max(0.4, ceiling - 0.08))
  if (zone === 'alapohja') return -0.12
  if (zone === 'lattia') return 0.02
  if (zone === 'seinassa') return 0.4
  if (zone === 'pinta') return 1.1
  return round3(ceiling - 0.3)
}

/** Cold attic: 100 mm mineral wool on supply and extract, condensation protection on outdoor air and the exhaust to the roof. */
export function zoneInsulation(zone, kind) {
  if (zone !== 'ylapohja') return ''
  if (kind === 'ulko' || kind === 'jate') return 'condensate'
  return 'wool-100'
}

/** Extra material the zone adds: conduit in the slab or wall, insulation in a cold void, a tray on a surface cable. */
export function zoneHardware(zone, system, kind) {
  if (kind === 'floorheat' || kind === 'efloor' || kind === 'vent' || kind === 'ceiling' || kind === 'sensor') return ''
  if (system === 'iv') return ''
  if (system === 'electric') {
    if (zone === 'pinta' || zone === 'ylapohja' || zone === 'valipohja') return 'kaapelikouru'
    if (zone === 'lattia' || zone === 'seinassa') return 'suojaputki'
    return ''
  }
  if (zone === 'lattia' || zone === 'seinassa') return 'suojaputki'
  if (zone === 'ylapohja' || zone === 'valipohja' || zone === 'alapohja') return system === 'drain' ? '' : 'eristys'
  return ''
}

export function isAutoInsulation(value) {
  return Object.prototype.hasOwnProperty.call(AUTO_INSULATION, value)
}

export function insulationMessageKey(value) {
  return AUTO_INSULATION[value] || ''
}

export function segmentZone(run, index, plan) {
  const system = run?.system || 'iv'
  const list = run?.segmentZone
  const over = Array.isArray(list) ? list[index] : null
  if (zoneAllowed(over, system)) return over
  const pointZone = run?.points?.[index]?.zone
  const nextZone = run?.points?.[index + 1]?.zone
  if (zoneAllowed(pointZone, system) && pointZone === nextZone) return pointZone
  if (zoneAllowed(pointZone, system) && !zoneAllowed(nextZone, system)) return pointZone
  if (zoneAllowed(nextZone, system) && !zoneAllowed(pointZone, system)) return nextZone
  if (zoneAllowed(run?.zone, system)) return run.zone
  return projectZone(plan, system)
}

export function segmentInsulation(run, index, plan) {
  if (run?.insulation && !isAutoInsulation(run.insulation)) return run.insulation
  if ((run?.system || 'iv') !== 'iv') return ''
  return zoneInsulation(segmentZone(run, index, plan), run?.kind)
}

export function segmentParts(run, index, plan) {
  const codes = []
  const insulation = segmentInsulation(run, index, plan)
  if (insulation) codes.push(insulation)
  const hardware = zoneHardware(segmentZone(run, index, plan), run?.system, run?.kind)
  if (hardware && !codes.includes(hardware)) codes.push(hardware)
  return codes
}

export function freeCross(zone) {
  return zone === 'ylapohja' || zone === 'lattia' || zone === 'valipohja' || zone === 'alapohja'
}

export function isWallZone(zone) {
  return zone === 'pinta' || zone === 'seinassa'
}

export function pathMode(zone) {
  if (zone === 'pinta') return 'pinta'
  if (zone === 'seinassa') return 'seinassa'
  if (freeCross(zone)) return 'free'
  return 'indoor'
}

export function routeExempt(run) {
  return run?.kind === 'floorheat' || run?.kind === 'efloor' || run?.role === 'loop' || run?.kind === 'ceiling' || run?.kind === 'sensor'
}

/** Above-ceiling ducts are drawn dashed. A riser that only climbs up to the attic stays solid. */
export function segmentDashed(a, b, zone, plan) {
  return segmentStyle(zone, a, b, plan).above
}

/** Line style shared by the plan, the sheet and the legend. */
export function segmentStyle(zone, a, b, plan) {
  const ceiling = Number(plan?.floorHeight) || 2.6
  const mid = ((Number(a?.y) || 0) + (Number(b?.y) || 0)) / 2
  const above = zone === 'ylapohja' && mid > ceiling + 0.01
  if (above) return { dash: '6 4', weight: 1, above: true }
  if (zone === 'lattia') return { dash: '1.4 1.8', weight: 1, above: false }
  if (zone === 'alapohja') return { dash: '7 2 1.2 2', weight: 1, above: false }
  if (zone === 'valipohja') return { dash: '9 3', weight: 1, above: false }
  if (zone === 'pinta') return { dash: '', weight: 1.35, above: false }
  if (zone === 'seinassa') return { dash: '', weight: 0.75, above: false }
  return { dash: '', weight: 1, above: false }
}

/** Interior walls are not obstacles in a void: the route goes straight. */
export function obstacleWalls(plan, zone) {
  const walls = plan?.walls || []
  const chosen = zone || projectIvZone(plan)
  if (!freeCross(chosen)) return walls
  return walls.filter((wall) => wall.kind !== 'interior' && wall.kind !== 'partition')
}

function deviceY(nodes, point, system) {
  const node = (nodes || []).find((item) => item?.system === (system || 'iv') && Math.hypot((item.x || 0) - point.x, (item.z || 0) - point.z) < 0.09)
  return node && Number.isFinite(node.y) ? round3(node.y) : null
}

/**
 * Keep device ends at the device, and run the horizontal route at the zone height.
 * A rise or drop is inserted at the device so a void route sits at the zone.
 */
export function seatIvPoints(plan, run) {
  const src = (run?.points || []).map((point) => ({ ...point }))
  if (src.length < 2) return src
  const system = run?.system || 'iv'
  const nodes = plan?.services?.nodes || []
  const out = []
  const push = (point) => {
    const next = { x: round3(point.x), y: round3(point.y || 0), z: round3(point.z) }
    if (zoneAllowed(point.zone, system)) next.zone = point.zone
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - next.x, prev.y - next.y, prev.z - next.z) < 0.015) {
      if (next.zone) prev.zone = next.zone
      return
    }
    out.push(next)
  }
  for (let i = 0; i < src.length - 1; i += 1) {
    const a = src[i]
    const b = src[i + 1]
    const zone = segmentZone(run, i, plan)
    const hy = zoneHeight(plan, zone)
    const startY = i === 0 && deviceY(nodes, a, system) != null ? deviceY(nodes, a, system) : hy
    const endY = i === src.length - 2 && deviceY(nodes, b, system) != null ? deviceY(nodes, b, system) : hy
    if (i === 0) push({ ...a, y: startY })
    if (Math.abs((out[out.length - 1]?.y || 0) - hy) > 0.04) push({ x: a.x, y: hy, z: a.z, zone: a.zone })
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.03) push({ x: b.x, y: hy, z: b.z, zone: b.zone || a.zone })
    if (Math.abs(endY - hy) > 0.04) push({ ...b, y: endY })
    else if (i === src.length - 2) push({ ...b, y: endY })
  }
  return out
}

function axes(wall) {
  const dx = wall.b.x - wall.a.x
  const dz = wall.b.z - wall.a.z
  const len = Math.hypot(dx, dz) || 1
  return { ux: dx / len, uz: dz / len, nx: -dz / len, nz: dx / len, len }
}

function wallKey(wall, index) {
  return wall?.id || `idx-${index}`
}

function projectOn(wall, point) {
  const ax = axes(wall)
  if (ax.len < 0.2) return null
  let t = (point.x - wall.a.x) * ax.ux + (point.z - wall.a.z) * ax.uz
  if (ax.len < 0.36) t = ax.len / 2
  else t = Math.max(0.12, Math.min(ax.len - 0.12, t))
  const x = wall.a.x + ax.ux * t
  const z = wall.a.z + ax.uz * t
  return { wall, x, z, t, dist: Math.hypot(point.x - x, point.z - z), ax }
}

function nearestHit(walls, point) {
  let best = null
  ;(walls || []).forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    const hit = projectOn(wall, point)
    if (hit && (!best || hit.dist < best.dist)) best = hit
  })
  return best
}

function faceOf(hit, point, mode) {
  if (!hit) return { x: round3(point.x), z: round3(point.z), wall: null, side: 1 }
  if (mode !== 'pinta') return { x: round3(hit.x), z: round3(hit.z), wall: hit.wall, side: 0 }
  const thick = Number(hit.wall.thickness) || (hit.wall.kind === 'exterior' ? 0.2 : 0.1)
  const side = Math.sign((point.x - hit.x) * hit.ax.nx + (point.z - hit.z) * hit.ax.nz) || 1
  const gap = thick / 2 + 0.04
  return {
    x: round3(hit.x + hit.ax.nx * side * gap),
    z: round3(hit.z + hit.ax.nz * side * gap),
    wall: hit.wall,
    side,
  }
}

function offsetAt(wall, at, side, mode) {
  const ax = axes(wall)
  let t = (at.x - wall.a.x) * ax.ux + (at.z - wall.a.z) * ax.uz
  t = Math.max(0, Math.min(ax.len, t))
  const cx = wall.a.x + ax.ux * t
  const cz = wall.a.z + ax.uz * t
  if (mode !== 'pinta') return { x: round3(cx), z: round3(cz) }
  const thick = Number(wall.thickness) || (wall.kind === 'exterior' ? 0.2 : 0.1)
  const gap = thick / 2 + 0.04
  const s = side || 1
  return { x: round3(cx + ax.nx * s * gap), z: round3(cz + ax.nz * s * gap) }
}

function endsTouch(a, b) {
  const ends = [a.a, a.b]
  return [b.a, b.b].some((point) => ends.some((other) => Math.hypot(point.x - other.x, point.z - other.z) < 0.55))
}

function sharedCorner(a, b) {
  let best = null
  ;[a.a, a.b].forEach((point) => {
    ;[b.a, b.b].forEach((other) => {
      const dist = Math.hypot(point.x - other.x, point.z - other.z)
      if (dist < 0.55 && (!best || dist < best.dist)) best = { x: (point.x + other.x) / 2, z: (point.z + other.z) / 2, dist }
    })
  })
  return best
}

function wallPath(walls, from, to) {
  const keys = walls.map((wall, index) => wallKey(wall, index))
  const fromKey = wallKey(from, walls.indexOf(from))
  const toKey = wallKey(to, walls.indexOf(to))
  if (fromKey === toKey) return [fromKey]
  const adj = new Map(keys.map((key) => [key, []]))
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      if (!endsTouch(walls[i], walls[j])) continue
      adj.get(keys[i]).push(keys[j])
      adj.get(keys[j]).push(keys[i])
    }
  }
  const queue = [[fromKey]]
  const seen = new Set([fromKey])
  while (queue.length) {
    const path = queue.shift()
    const head = path[path.length - 1]
    const nexts = adj.get(head) || []
    for (let i = 0; i < nexts.length; i += 1) {
      const next = nexts[i]
      if (seen.has(next)) continue
      const grown = path.concat(next)
      if (next === toKey) return grown
      seen.add(next)
      queue.push(grown)
    }
  }
  return null
}

function chooseSide(wall, near, mode) {
  if (mode !== 'pinta') return 0
  const plus = offsetAt(wall, near, 1, mode)
  const minus = offsetAt(wall, near, -1, mode)
  const dp = Math.hypot(plus.x - near.x, plus.z - near.z)
  const dm = Math.hypot(minus.x - near.x, minus.z - near.z)
  return dp <= dm ? 1 : -1
}

function wallLeg(plan, a, b, zone) {
  const walls = (plan?.walls || []).filter((wall) => wall?.a && wall?.b)
  const mode = zone === 'seinassa' ? 'seinassa' : 'pinta'
  const y = a.y
  if (walls.length < 1) return [{ ...a }, { ...b }]
  const startHit = nearestHit(walls, a)
  const endHit = nearestHit(walls, b)
  if (!startHit || !endHit) return [{ ...a }, { ...b }]
  const startFace = faceOf(startHit, a, mode)
  const endFace = faceOf(endHit, b, mode)
  const byKey = new Map(walls.map((wall, index) => [wallKey(wall, index), wall]))
  const path = wallPath(walls, startHit.wall, endHit.wall)
  const out = []
  const push = (point) => {
    const next = { x: round3(point.x), y: round3(point.y ?? y), z: round3(point.z) }
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - next.x, prev.z - next.z) < 0.03) return
    out.push(next)
  }
  push(a)
  push(startFace)
  if (path && path.length > 1) {
    let prev = startFace
    for (let i = 0; i < path.length - 1; i += 1) {
      const left = byKey.get(path[i])
      const right = byKey.get(path[i + 1])
      const corner = left && right ? sharedCorner(left, right) : null
      if (!corner) continue
      const side1 = i === 0 ? (startFace.side || chooseSide(left, prev, mode)) : chooseSide(left, prev, mode)
      const c1 = offsetAt(left, corner, side1, mode)
      const side2 = chooseSide(right, c1, mode)
      const c2 = offsetAt(right, corner, side2, mode)
      push(c1)
      push(c2)
      prev = c2
    }
  }
  push(endFace)
  push(b)
  return out
}

/** Surface and embedded routes follow the wall. Device ends stay put. */
export function viaWalls(plan, points, zone, system) {
  const src = points || []
  if (src.length < 2 || !isWallZone(zone)) return src.map((point) => ({ ...point }))
  const nodes = (plan?.services?.nodes || []).filter((node) => !system || node.system === system)
  const stations = [0]
  for (let i = 1; i < src.length - 1; i += 1) {
    const point = src[i]
    if (nodes.some((node) => Math.hypot(node.x - point.x, node.z - point.z) < 0.25)) stations.push(i)
  }
  stations.push(src.length - 1)
  const out = []
  const push = (point) => {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - point.x, prev.y - point.y, prev.z - point.z) < 0.02) return
    out.push(point)
  }
  for (let s = 0; s < stations.length - 1; s += 1) {
    const leg = wallLeg(plan, src[stations[s]], src[stations[s + 1]], zone)
    leg.forEach((point, index) => {
      if (s > 0 && index === 0) return
      push(point)
    })
  }
  return out.length >= 2 ? out : src.map((point) => ({ ...point }))
}

export function zoneLegendRows(plan, system) {
  const runs = (plan?.services?.runs || []).filter((run) => run.system === system && (run.points || []).length >= 2)
  const seen = []
  runs.forEach((run) => {
    if (routeExempt(run)) return
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const zone = segmentZone(run, i - 1, plan)
      if (zone && !seen.includes(zone)) seen.push(zone)
    }
  })
  return seen.map((zone) => {
    const y = zoneHeight(plan, zone)
    const style = segmentStyle(zone, { y }, { y }, plan)
    return {
      key: zoneLabelKey(system, zone),
      name: zone,
      zoneId: zone,
      zone: true,
      dash: style.dash,
      color: '#44403c',
    }
  })
}

function crossOf(point, axis) {
  return axis === 'x' ? point.z : point.x
}

function alongOf(point, axis) {
  return axis === 'x' ? point.x : point.z
}

/** Building section through the longest route, so a void route reads at its height. */
export function ivSection(plan) {
  const box = boundsOf(plan)
  const ceiling = Number(plan?.floorHeight) || 2.6
  const runs = (plan?.services?.runs || []).filter((run) => zonesFor(run.system).length && (run.points || []).length >= 2 && !routeExempt(run))
  let best = null
  runs.forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
      if (len < 0.4) continue
      if (!best || len > best.len) {
        best = { a: points[i - 1], b: points[i], len, run, index: i - 1 }
      }
    }
  })
  const alongX = best
    ? Math.abs(best.b.x - best.a.x) >= Math.abs(best.b.z - best.a.z)
    : (box.maxX - box.minX) >= (box.maxZ - box.minZ)
  const axis = alongX ? 'x' : 'z'
  const cut = best ? crossOf({ x: (best.a.x + best.b.x) / 2, z: (best.a.z + best.b.z) / 2 }, axis) : (alongX ? (box.minZ + box.maxZ) / 2 : (box.minX + box.maxX) / 2)
  const u0 = alongX ? box.minX : box.minZ
  const u1 = alongX ? box.maxX : box.maxZ
  const pitch = Number.isFinite(plan?.roofPitch) ? plan.roofPitch : 25
  const half = Math.max(0.5, ((alongX ? box.maxX - box.minX : box.maxZ - box.minZ) || 1) / 2)
  const rise = plan?.roofType === 'flat' ? 0.18 : Math.max(1.1, Math.tan((pitch * Math.PI) / 180) * half)
  const ducts = []
  runs.forEach((run) => {
    const points = run.points || []
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      const zone = segmentZone(run, i - 1, plan)
      const style = segmentStyle(zone, a, b, plan)
      const au = alongOf(a, axis)
      const bu = alongOf(b, axis)
      const ac = crossOf(a, axis)
      const bc = crossOf(b, axis)
      const horizontal = Math.hypot(b.x - a.x, b.z - a.z)
      const row = {
        zone,
        kind: run.kind,
        system: run.system,
        above: style.above,
        dash: style.dash,
      }
      if (horizontal < 0.05) {
        if (Math.abs(ac - cut) > 0.55) continue
        ducts.push({ ...row, u0: au, u1: au, y0: a.y || 0, y1: b.y || 0, mode: 'riser' })
        continue
      }
      const near = Math.abs(ac - cut) <= 0.55 && Math.abs(bc - cut) <= 0.55
      const crosses = (ac - cut) * (bc - cut) < 0
      if (near && Math.abs(au - bu) > 0.15) {
        ducts.push({ ...row, u0: au, u1: bu, y0: a.y || 0, y1: b.y || 0, mode: 'line' })
      } else if (crosses) {
        const t = (cut - ac) / ((bc - ac) || 1)
        const u = au + (bu - au) * t
        const y = (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t
        ducts.push({ ...row, u0: u, u1: u, y0: y, y1: y, mode: 'cut' })
      }
    }
  })
  const walls = []
  ;(plan?.walls || []).forEach((wall) => {
    if (!wall?.a || !wall?.b) return
    const ac = crossOf(wall.a, axis)
    const bc = crossOf(wall.b, axis)
    if (Math.abs(ac - bc) < 0.05) return
    if ((ac - cut) * (bc - cut) > 0) return
    const t = (cut - ac) / (bc - ac)
    if (t < -0.02 || t > 1.02) return
    const u = alongOf(wall.a, axis) + (alongOf(wall.b, axis) - alongOf(wall.a, axis)) * t
    walls.push({ u, kind: wall.kind || 'exterior', y0: 0, y1: ceiling })
  })
  return {
    axis,
    cut: round3(cut),
    u0,
    u1,
    ceiling,
    rise,
    roof: [
      { u: u0 - 0.4, y: ceiling },
      { u: (u0 + u1) / 2, y: round3(ceiling + rise) },
      { u: u1 + 0.4, y: ceiling },
    ],
    walls,
    ducts,
  }
}

function boundsOf(plan) {
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  ;(plan?.walls || []).forEach((wall) => {
    ;[wall?.a, wall?.b].forEach((point) => {
      if (!point) return
      box.minX = Math.min(box.minX, point.x)
      box.maxX = Math.max(box.maxX, point.x)
      box.minZ = Math.min(box.minZ, point.z)
      box.maxZ = Math.max(box.maxZ, point.z)
    })
  })
  if (!Number.isFinite(box.minX)) return { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }
  return box
}
