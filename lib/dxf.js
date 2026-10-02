// Minimal ASCII DXF (R12). One drawing unit is one millimetre, so a measured
// plan drops into CAD at true scale. Finnish letters are written as Latin-1.

import { hydrateRoom, externalRect, internalDims } from './geometry.js'
import { insetOrthogonal, isCustomOutline, outlineOf, polygonMetrics } from './cadDraw.js'
import { isRefrigerated } from './catalog.js'
import { footprintCorners, mountLabel, resolvedElevation } from './placement.js'
import { calculateProject } from './heatLoad.js'
import { sizePlacedPipe } from './pipeDuty.js'
import { pipeAppearance } from './pipeTopology.js'

const LAYERS = [
  ['WALLS', 7],
  ['PARTITIONS', 4],
  ['BUILDING', 8],
  ['DOORS', 30],
  ['EVAPORATORS', 5],
  ['EQUIPMENT', 3],
  ['COLUMNS', 9],
  ['SUCTION', 5],
  ['LIQUID', 3],
  ['LIQUID_RETURN', 3],
  ['HOTGAS', 1],
  ['DRAIN', 30],
  ['DRAIN_HEAT', 30],
  ['CABLES', 6],
  ['SENSORS', 4],
  ['CONTROLS', 6],
  ['DIMS', 2],
  ['TEXT', 7],
  ['TITLE', 7],
  ['SCHEDULE', 7],
]

function pair(code, value) {
  return `${code}\n${value}\n`
}

function entity(type, layer, body) {
  return pair(0, type) + pair(8, layer) + body
}

function line(layer, x1, y1, x2, y2, ltype) {
  return entity(
    'LINE',
    layer,
    (ltype ? pair(6, ltype) : '') + pair(10, r(x1)) + pair(20, r(y1)) + pair(30, 0) + pair(11, r(x2)) + pair(21, r(y2)) + pair(31, 0)
  )
}

function text(layer, x, y, height, value) {
  const safe = String(value).replace(/[\r\n]/g, ' ')
  return entity('TEXT', layer, pair(10, r(x)) + pair(20, r(y)) + pair(30, 0) + pair(40, r(height)) + pair(1, safe))
}

function rect(layer, x1, y1, x2, y2) {
  return (
    line(layer, x1, y1, x2, y1) +
    line(layer, x2, y1, x2, y2) +
    line(layer, x2, y2, x1, y2) +
    line(layer, x1, y2, x1, y1)
  )
}

function r(n) {
  return Math.round(n * 100) / 100
}

function toDxf(x, z) {
  return { x: x * 1000, y: -z * 1000 }
}

export function buildDxf({ projectName = 'RefCAD', rooms = [], pipes = [], cables = [] } = {}) {
  const hydrated = (rooms || []).map(hydrateRoom)
  let ents = ''
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const track = (x, y) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const schedule = []

  hydrated.forEach((room) => {
    const ext = externalRect(room)
    const inn = innerFootprint(room)
    const a = toDxf(ext.left, ext.top)
    const b = toDxf(ext.right, ext.bottom)
    const c = toDxf(inn.left, inn.top)
    const d = toDxf(inn.right, inn.bottom)
    const layer = !isRefrigerated(room.type) ? 'BUILDING' : room.parentId ? 'PARTITIONS' : 'WALLS'
    if (isCustomOutline(room)) {
      const drawLoop = (points) => {
        for (let i = 0; i < points.length; i += 1) {
          const p1 = toDxf(points[i].x, points[i].z)
          const p2 = toDxf(points[(i + 1) % points.length].x, points[(i + 1) % points.length].z)
          ents += line(layer, p1.x, p1.y, p2.x, p2.y)
          track(p1.x, p1.y)
        }
      }
      drawLoop(outlineOf(room))
      const innerLoop = insetOrthogonal(outlineOf(room), room.wallThickness)
      if (innerLoop) drawLoop(innerLoop)
    } else {
      ents += rect(layer, a.x, a.y, b.x, b.y)
      ents += rect(layer, c.x, c.y, d.x, d.y)
      ;[a, b, c, d].forEach((p) => track(p.x, p.y))
    }

    const center = toDxf(room.x, room.z)
    ents += text('TEXT', center.x, center.y + 200, 350, `${room.label}  ${room.name}`)
    ents += text('TEXT', center.x, center.y - 250, 220, `${room.temp} C   sisus ${innWidth(room)} x ${innDepth(room)} m`)

    const top = toDxf(ext.left, ext.top)
    const topR = toDxf(ext.right, ext.top)
    const dimY = top.y + 600
    ents += line('DIMS', top.x, dimY, topR.x, dimY)
    ents += line('DIMS', top.x, dimY - 150, top.x, dimY + 150)
    ents += line('DIMS', topR.x, dimY - 150, topR.x, dimY + 150)
    ents += text('DIMS', (top.x + topR.x) / 2, dimY + 120, 220, `${room.width.toFixed(2)} m`)
    track(top.x, dimY + 400)

    const left = toDxf(ext.left, ext.bottom)
    const leftT = toDxf(ext.left, ext.top)
    const dimX = left.x - 700
    ents += line('DIMS', dimX, left.y, dimX, leftT.y)
    ents += text('DIMS', dimX - 200, (left.y + leftT.y) / 2, 220, `${room.depth.toFixed(2)} m`)
    track(dimX - 400, left.y)

    for (const eq of room.equipment) {
      const worldX = room.x + eq.x
      const worldZ = room.z + eq.z
      const eqLayer = eq.category === 'door'
        ? 'DOORS'
        : eq.category === 'evaporator'
          ? 'EVAPORATORS'
          : eq.category === 'column'
            ? 'COLUMNS'
            : eq.category === 'sensor'
              ? 'SENSORS'
              : eq.category === 'controller'
                ? 'CONTROLS'
                : 'EQUIPMENT'
      if (eq.category === 'door') {
        const hw = (eq.rotation === 90 ? eq.depth : eq.width) / 2
        const hd = (eq.rotation === 90 ? eq.width : eq.depth) / 2
        const p1 = toDxf(worldX - hw, worldZ - hd)
        const p2 = toDxf(worldX + hw, worldZ + hd)
        ents += rect(eqLayer, p1.x, p1.y, p2.x, p2.y)
        track(p1.x, p1.y)
        track(p2.x, p2.y)
      } else {
        const corners = footprintCorners(worldX, worldZ, eq.width, eq.depth, eq.rotation)
        for (let i = 0; i < corners.length; i += 1) {
          const a = toDxf(corners[i].x, corners[i].z)
          const b = toDxf(corners[(i + 1) % corners.length].x, corners[(i + 1) % corners.length].z)
          ents += line(eqLayer, a.x, a.y, b.x, b.y)
          track(a.x, a.y)
        }
      }
      const labelAt = toDxf(worldX, worldZ)
      const koro = resolvedElevation(room, eq)
      ents += text(eqLayer, labelAt.x, labelAt.y + 180, 180, `${eq.name}  koro ${koro.toFixed(2)} m ${mountLabel(eq.mount || (eq.category === 'evaporator' ? 'ceiling' : 'floor'), true)}`)
      schedule.push({ room, eq })
    }
  })

  const pipeLoads = calculateProject(hydrated).rooms
  ;(pipes || []).forEach((pipe) => {
    const points = pipe.points || []
    if (points.length < 2) return
    const sized = sizePlacedPipe(pipe, hydrated, pipeLoads, pipes).sized
    const look = pipeAppearance(pipe, pipe.kind === 'drain' && sized.heatTraced)
    for (let i = 1; i < points.length; i += 1) {
      const a = toDxf(points[i - 1].x, points[i - 1].z)
      const b = toDxf(points[i].x, points[i].z)
      ents += line(look.layer, a.x, a.y, b.x, b.y, look.ltype)
      track(a.x, a.y)
      track(b.x, b.y)
    }
    const mid = toDxf((points[0].x + points[1].x) / 2, (points[0].z + points[1].z) / 2)
    ents += text(look.layer, mid.x, mid.y + 250, 180, sized.labelAscii)
  })
  ;(cables || []).forEach((cable) => {
    const points = cable.points || []
    for (let i = 1; i < points.length; i += 1) {
      const a = toDxf(points[i - 1].x, points[i - 1].z)
      const b = toDxf(points[i].x, points[i].z)
      ents += line('CABLES', a.x, a.y, b.x, b.y)
    }
  })

  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 4000
    maxY = 3000
  }

  const titleX = minX
  const titleY = minY - 2800
  ents += rect('TITLE', titleX, titleY, titleX + 9000, titleY + 2200)
  ents += text('TITLE', titleX + 200, titleY + 1700, 400, 'RefCAD Tool')
  ents += text('TITLE', titleX + 200, titleY + 1100, 280, projectName)
  ents += text('TITLE', titleX + 200, titleY + 650, 200, `Paivays ${new Date().toLocaleDateString('fi-FI')}`)
  ents += text('TITLE', titleX + 200, titleY + 300, 200, 'Mittakaava 1:1   yksikko = 1 mm   pohja')

  let sy = maxY
  const sx = maxX + 2000
  ents += text('SCHEDULE', sx, sy, 350, 'Ovet ja laitteet')
  sy -= 500
  ents += text('SCHEDULE', sx, sy, 180, 'Huone    Laite    Koko mm    kW')
  sy -= 350
  if (!schedule.length) {
    ents += text('SCHEDULE', sx, sy, 180, 'Ei sijoitettuja laitteita')
  }
  schedule.forEach((row) => {
    const eq = row.eq
    const size = `${Math.round(eq.width * 1000)} x ${Math.round(eq.depth * 1000)} x ${Math.round(eq.height * 1000)}`
    const kw = eq.capacityKw ? eq.capacityKw.toFixed(1) : '-'
    ents += text('SCHEDULE', sx, sy, 180, `${row.room.label}   ${eq.name}   ${size}   ${kw}`)
    sy -= 300
  })

  let layers = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length)
  for (const [name, color] of LAYERS) {
    layers += pair(0, 'LAYER') + pair(2, name) + pair(70, 0) + pair(62, color) + pair(6, 'CONTINUOUS')
  }
  layers += pair(0, 'ENDTAB')

  return (
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$ACADVER') +
    pair(1, 'AC1009') +
    pair(9, '$INSUNITS') +
    pair(70, 4) +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'TABLES') +
    layers +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'ENTITIES') +
    ents +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF')
  )
}

function innerSize(room) {
  if (isCustomOutline(room)) return polygonMetrics(room).dims
  return internalDims(room)
}

function innerFootprint(room) {
  const dims = innerSize(room)
  return {
    left: room.x - dims.width / 2,
    right: room.x + dims.width / 2,
    top: room.z - dims.depth / 2,
    bottom: room.z + dims.depth / 2,
  }
}

function innWidth(room) {
  return innerSize(room).width.toFixed(2)
}

function innDepth(room) {
  return innerSize(room).depth.toFixed(2)
}

export function dxfFilename(projectName) {
  const slug = String(projectName || 'refcad').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40)
  return `${slug || 'refcad'}_pohja.dxf`
}
