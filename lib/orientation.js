// Compass bearings for the floor plan. Screen-up is geographic north when
// the north angle is 0. The angle is degrees clockwise, the same value the
// north arrow and the site plan already store on yard.north.

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function northAngle(plan) {
  const value = Number(plan?.yard?.north)
  if (!Number.isFinite(value)) return 0
  return ((value % 360) + 360) % 360
}

export function bearingOf(dx, dz, northDeg = 0) {
  const theta = (Number(northDeg) || 0) * Math.PI / 180
  const northX = Math.sin(theta)
  const northZ = -Math.cos(theta)
  const eastX = Math.cos(theta)
  const eastZ = Math.sin(theta)
  const len = Math.hypot(dx, dz) || 1
  const x = dx / len
  const z = dz / len
  const deg = Math.atan2(x * eastX + z * eastZ, x * northX + z * northZ) * 180 / Math.PI
  return (deg + 360) % 360
}

export function compassCode(bearing) {
  const index = Math.round(((Number(bearing) || 0) % 360) / 45) % 8
  return COMPASS[index]
}

export function outwardNormal(wall, walls = []) {
  if (!wall?.a || !wall?.b) return { x: 0, z: -1 }
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1
  let nx = -((wall.b.z - wall.a.z) / len)
  let nz = (wall.b.x - wall.a.x) / len
  let cx = 0
  let cz = 0
  let count = 0
  ;(walls || []).forEach((item) => {
    if (!item?.a || !item?.b) return
    cx += item.a.x + item.b.x
    cz += item.a.z + item.b.z
    count += 2
  })
  if (count) {
    cx /= count
    cz /= count
    const midX = (wall.a.x + wall.b.x) / 2
    const midZ = (wall.a.z + wall.b.z) / 2
    if ((midX - cx) * nx + (midZ - cz) * nz < 0) {
      nx = -nx
      nz = -nz
    }
  }
  return { x: nx, z: nz }
}

export function wallBearing(plan, wall) {
  const normal = outwardNormal(wall, plan?.walls || [])
  const bearing = bearingOf(normal.x, normal.z, northAngle(plan))
  return { bearing: Math.round(bearing), code: compassCode(bearing), normal }
}

const SIDE_BEARING = { north: 0, east: 90, south: 180, west: 270 }

export function sideBearing(side, northDeg = 0) {
  const base = SIDE_BEARING[side]
  if (!Number.isFinite(base)) return 0
  return (base - northDeg + 360) % 360
}

export function sideCompass(side, northDeg = 0) {
  return compassCode(sideBearing(side, northDeg))
}
