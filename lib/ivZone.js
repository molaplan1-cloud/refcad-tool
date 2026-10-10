/** Where an IV duct is installed. The project default is plan.ivZone. */

export const IV_ZONES = ['ylapohja', 'sisatilat', 'valipohja', 'alapohja']

const AUTO_INSULATION = {
  'wool-100': 'iv.insulation.wool',
  condensate: 'iv.insulation.condensate',
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

export function projectIvZone(plan) {
  const zone = plan?.ivZone
  return IV_ZONES.includes(zone) ? zone : 'sisatilat'
}

export function zoneHeight(plan, zone) {
  const ceiling = Number(plan?.floorHeight) || 2.6
  if (zone === 'ylapohja') return round3(ceiling + 0.22)
  if (zone === 'valipohja') return round3(Math.max(0.4, ceiling - 0.08))
  if (zone === 'alapohja') return -0.12
  return round3(ceiling - 0.3)
}

/** Cold attic: 100 mm mineral wool on supply and extract, condensation protection on outdoor air and the exhaust to the roof. */
export function zoneInsulation(zone, kind) {
  if (zone !== 'ylapohja') return ''
  if (kind === 'ulko' || kind === 'jate') return 'condensate'
  return 'wool-100'
}

export function isAutoInsulation(value) {
  return Object.prototype.hasOwnProperty.call(AUTO_INSULATION, value)
}

export function insulationMessageKey(value) {
  return AUTO_INSULATION[value] || ''
}

export function segmentZone(run, index, plan) {
  const list = run?.segmentZone
  const over = Array.isArray(list) ? list[index] : null
  if (IV_ZONES.includes(over)) return over
  const pointZone = run?.points?.[index]?.zone
  const nextZone = run?.points?.[index + 1]?.zone
  if (IV_ZONES.includes(pointZone) && pointZone === nextZone) return pointZone
  if (IV_ZONES.includes(pointZone) && !IV_ZONES.includes(nextZone)) return pointZone
  if (IV_ZONES.includes(nextZone) && !IV_ZONES.includes(pointZone)) return nextZone
  if (IV_ZONES.includes(run?.zone)) return run.zone
  return projectIvZone(plan)
}

export function segmentInsulation(run, index, plan) {
  if (run?.insulation && !isAutoInsulation(run.insulation)) return run.insulation
  return zoneInsulation(segmentZone(run, index, plan), run?.kind)
}

/** Above-ceiling ducts are drawn dashed. A riser that only climbs up to the attic stays solid. */
export function segmentDashed(a, b, zone, plan) {
  if (zone !== 'ylapohja') return false
  const ceiling = Number(plan?.floorHeight) || 2.6
  const mid = ((Number(a?.y) || 0) + (Number(b?.y) || 0)) / 2
  return mid > ceiling + 0.01
}

/** Interior walls are not obstacles in the attic: the duct goes straight and penetrates the ceiling. */
export function obstacleWalls(plan) {
  const walls = plan?.walls || []
  if (projectIvZone(plan) !== 'ylapohja') return walls
  return walls.filter((wall) => wall.kind !== 'interior' && wall.kind !== 'partition')
}

function deviceY(nodes, point) {
  const node = (nodes || []).find((item) => item?.system === 'iv' && Math.hypot((item.x || 0) - point.x, (item.z || 0) - point.z) < 0.09)
  return node && Number.isFinite(node.y) ? round3(node.y) : null
}

/**
 * Keep device ends at the device, and run the horizontal duct at the zone height.
 * A rise or drop is inserted at the device so the attic duct sits above the ceiling.
 */
export function seatIvPoints(plan, run) {
  const src = (run?.points || []).map((point) => ({ ...point }))
  if (src.length < 2) return src
  const nodes = plan?.services?.nodes || []
  const out = []
  const push = (point) => {
    const next = { x: round3(point.x), y: round3(point.y || 0), z: round3(point.z) }
    if (IV_ZONES.includes(point.zone)) next.zone = point.zone
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
    const startY = i === 0 && deviceY(nodes, a) != null ? deviceY(nodes, a) : hy
    const endY = i === src.length - 2 && deviceY(nodes, b) != null ? deviceY(nodes, b) : hy
    if (i === 0) push({ ...a, y: startY })
    if (Math.abs((out[out.length - 1]?.y || 0) - hy) > 0.04) push({ x: a.x, y: hy, z: a.z, zone: a.zone })
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.03) push({ x: b.x, y: hy, z: b.z, zone: b.zone || a.zone })
    if (Math.abs(endY - hy) > 0.04) push({ ...b, y: endY })
    else if (i === src.length - 2) push({ ...b, y: endY })
  }
  return out
}

function crossOf(point, axis) {
  return axis === 'x' ? point.z : point.x
}

function alongOf(point, axis) {
  return axis === 'x' ? point.x : point.z
}

/** Building section through the longest duct, so attic ducts read above the ceiling line. */
export function ivSection(plan) {
  const box = boundsOf(plan)
  const ceiling = Number(plan?.floorHeight) || 2.6
  const runs = (plan?.services?.runs || []).filter((run) => run.system === 'iv' && (run.points || []).length >= 2)
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
      const au = alongOf(a, axis)
      const bu = alongOf(b, axis)
      const ac = crossOf(a, axis)
      const bc = crossOf(b, axis)
      const horizontal = Math.hypot(b.x - a.x, b.z - a.z)
      if (horizontal < 0.05) {
        if (Math.abs(ac - cut) > 0.55) continue
        ducts.push({
          u0: au, u1: au, y0: a.y || 0, y1: b.y || 0, zone, kind: run.kind, mode: 'riser', above: segmentDashed(a, b, zone, plan),
        })
        continue
      }
      const near = Math.abs(ac - cut) <= 0.55 && Math.abs(bc - cut) <= 0.55
      const crosses = (ac - cut) * (bc - cut) < 0
      if (near && Math.abs(au - bu) > 0.15) {
        ducts.push({
          u0: au, u1: bu, y0: a.y || 0, y1: b.y || 0, zone, kind: run.kind, mode: 'line', above: segmentDashed(a, b, zone, plan),
        })
      } else if (crosses) {
        const t = (cut - ac) / ((bc - ac) || 1)
        ducts.push({
          u0: au + (bu - au) * t,
          u1: au + (bu - au) * t,
          y0: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t,
          y1: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t,
          zone,
          kind: run.kind,
          mode: 'cut',
          above: segmentDashed(a, b, zone, plan),
        })
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
