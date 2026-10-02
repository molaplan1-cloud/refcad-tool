import { jsPDF } from 'jspdf'
import { hydrateRoom, externalRect, internalDims } from './geometry.js'
import { isCustomOutline, outlineOf, polygonMetrics } from './cadDraw.js'
import { calculateProject } from './heatLoad.js'
import { formatLength } from './units.js'
import { isRefrigerated } from './catalog.js'
import { footprintCorners, mountLabel, resolvedElevation } from './placement.js'
import { routeLength } from './pipeSizing.js'
import { sizePlacedPipe } from './pipeDuty.js'
import { INTERNAL_LIQUID_TRAIN, pipeAppearance } from './pipeTopology.js'
import { ascii, buildSchematics } from './schematic.js'

const MARGIN = 14

function rgb(hex) {
  const h = (hex || '#3b82f6').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function footer(doc, projectName) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i)
    const pageH = doc.internal.pageSize.getHeight()
    const pageW = doc.internal.pageSize.getWidth()
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`RefCAD Tool  ·  ${ascii(projectName)}`, MARGIN, pageH - 6)
    doc.text(`${i} / ${pages}`, pageW - MARGIN, pageH - 6, { align: 'right' })
  }
}

function ensure(doc, y, need = 12) {
  if (y + need < 280) return y
  doc.addPage()
  return 18
}

export function buildPdf({ projectName = 'Projekti', userEmail = '', rooms = [], unitSystem = 'SI', pipes = [], cables = [], schematic = null } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hydrated = (rooms || []).map(hydrateRoom)
  const result = calculateProject(hydrated)
  const W = 210

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 36, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('RefCAD Tool', MARGIN, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(186, 230, 253)
  doc.text('Kylmahuoneen suunnitelma', MARGIN, 24)
  doc.setTextColor(30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(projectName, MARGIN, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(70)
  const meta = [
    `Paivays ${new Date().toLocaleDateString('fi-FI')}`,
    userEmail ? `Tekija ${userEmail}` : null,
    `Huoneita ${hydrated.length}`,
    `Sisapinta-ala ${result.internalArea.toFixed(1)} m2`,
    `Sisatilavuus ${result.internalVolume.toFixed(1)} m3`,
  ].filter(Boolean)
  meta.forEach((row, i) => doc.text(row, MARGIN, 58 + i * 5))

  doc.setFillColor(240, 249, 255)
  doc.roundedRect(MARGIN, 88, W - MARGIN * 2, 28, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(14, 116, 144)
  doc.text('Kokonaislampokuorma, varmuuskerroin mukana', MARGIN + 4, 98)
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(16)
  doc.text(`${(result.total / 1000).toFixed(2)} kW`, MARGIN + 4, 108)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${Math.round(result.total).toLocaleString('fi-FI')} W   ·   ${Math.round(result.total * 3.41214).toLocaleString('fi-FI')} BTU/h`, 80, 108)

  const ev = result.suggestedEvap
  doc.setTextColor(70)
  doc.text(
    ev ? `Suuntaa antava koneisto koko kohteelle: ${ev.count} x ${ev.template.name}` : '',
    MARGIN,
    128
  )
  doc.setFontSize(8)
  doc.text('Luvut ovat tarkastettava mitoitusarvio. Kaavat ovat lampokuormasivulla.', MARGIN, 136)

  drawPlanPage(doc, hydrated, unitSystem, pipes)
  drawIsoPage(doc, hydrated)
  drawLoadPages(doc, result)
  drawSchedule(doc, hydrated, pipes, cables)
  drawSchematicPages(doc, projectName, hydrated, schematic)
  footer(doc, projectName)
  return doc
}

function drawPlanPage(doc, rooms, unitSystem, pipes = []) {
  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Pohja', MARGIN, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Ulkomitat keltaisella, sisamitat huoneen nimessa. Pohjoinen ylospain.', MARGIN, 22)

  const box = { x: MARGIN, y: 28, w: 182, h: 150 }
  doc.setDrawColor(203, 213, 225)
  doc.rect(box.x, box.y, box.w, box.h)

  if (!rooms.length) {
    doc.text('Ei huoneita.', box.x + 4, box.y + 8)
    return
  }

  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  rooms.forEach((room) => {
    const rect = externalRect(room)
    minX = Math.min(minX, rect.left)
    maxX = Math.max(maxX, rect.right)
    minZ = Math.min(minZ, rect.top)
    maxZ = Math.max(maxZ, rect.bottom)
  })
  ;(pipes || []).forEach((pipe) => {
    ;(pipe.points || []).forEach((point) => {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    })
  })
  const pad = 1.2
  minX -= pad
  minZ -= pad
  maxX += pad
  maxZ += pad
  const scale = Math.min(box.w / (maxX - minX), box.h / (maxZ - minZ))
  const ox = box.x + (box.w - (maxX - minX) * scale) / 2
  const oy = box.y + (box.h - (maxZ - minZ) * scale) / 2
  const px = (x) => ox + (x - minX) * scale
  const py = (z) => oy + (z - minZ) * scale

  const ordered = [...rooms].sort((a, b) => Number(isRefrigerated(b.type)) - Number(isRefrigerated(a.type)))
  ordered.forEach((room) => {
    const rect = externalRect(room)
    const x = px(rect.left)
    const y = py(rect.top)
    const w = room.width * scale
    const h = room.depth * scale
    const cold = isRefrigerated(room.type)
    const [cr, cg, cb] = cold ? rgb(room.color) : [214, 211, 209]
    doc.setFillColor(cr, cg, cb)
    doc.setDrawColor(cr, cg, cb)
    doc.setLineWidth(0.4)
    doc.rect(x, y, w, h, 'FD')
    const wall = room.wallThickness * scale
    doc.setFillColor(255, 255, 255)
    doc.rect(x + wall, y + wall, Math.max(0.4, w - wall * 2), Math.max(0.4, h - wall * 2), 'F')
    if (isCustomOutline(room)) {
      doc.setDrawColor(41, 37, 36)
      doc.setLineWidth(0.55)
      const loop = outlineOf(room)
      loop.forEach((point, index) => {
        const next = loop[(index + 1) % loop.length]
        doc.line(px(point.x), py(point.z), px(next.x), py(next.z))
      })
    }
    doc.setFontSize(Math.max(7, Math.min(11, w / 8)))
    doc.setTextColor(15, 23, 42)
    doc.text(`${room.label}  ${room.name}`, x + w / 2, y + h / 2 - 1, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(70)
    const inner = shownInternal(room)
    doc.text(`${formatLength(inner.width, unitSystem)} x ${formatLength(inner.depth, unitSystem)}`, x + w / 2, y + h / 2 + 3, { align: 'center' })

    doc.setDrawColor(180, 130, 20)
    doc.setLineWidth(0.2)
    doc.line(x, y - 2.5, x + w, y - 2.5)
    doc.setFontSize(7)
    doc.setTextColor(146, 100, 10)
    doc.text(formatLength(room.width, unitSystem), x + w / 2, y - 3.2, { align: 'center' })

    room.equipment.forEach((eq) => {
      const ex = px(room.x + eq.x)
      const ez = py(room.z + eq.z)
      const ew = (eq.rotation === 90 ? eq.depth : eq.width) * scale
      const ed = (eq.rotation === 90 ? eq.width : eq.depth) * scale
      if (eq.category === 'door') {
        const span = doorPlanSize(eq)
        doc.setFillColor(120, 72, 28)
        doc.rect(ex - (span.w * scale) / 2, ez - (span.d * scale) / 2, span.w * scale, span.d * scale, 'F')
      } else if (eq.category === 'sensor' || eq.category === 'controller') {
        doc.setFillColor(eq.category === 'controller' ? 15 : 14, eq.category === 'controller' ? 118 : 116, eq.category === 'controller' ? 110 : 144)
        doc.circle(ex, ez, Math.max(0.8, Math.min(ew, ed) / 2), 'F')
      } else {
        const corners = footprintCorners(room.x + eq.x, room.z + eq.z, eq.width, eq.depth, eq.rotation).map((point) => ({ x: px(point.x), y: py(point.z) }))
        const fill = eq.category === 'evaporator' ? [125, 211, 252] : eq.style === 'slant' ? [186, 230, 253] : [226, 232, 240]
        doc.setFillColor(fill[0], fill[1], fill[2])
        doc.setDrawColor(30, 41, 59)
        if (corners.length > 2) doc.lines(toRel(corners), corners[0].x, corners[0].y, [1, 1], 'FD', true)
        else doc.rect(ex - ew / 2, ez - ed / 2, ew, ed, 'FD')
      }
    })
  })
  ;(pipes || []).forEach((pipe) => {
    const points = pipe.points || []
    if (points.length < 2) return
    const sized = sizePlacedPipe(pipe, rooms, calculateProject(rooms).rooms, pipes).sized
    const look = pipeAppearance(pipe, pipe.kind === 'drain' && sized.heatTraced)
    doc.setDrawColor(look.pdf[0], look.pdf[1], look.pdf[2])
    doc.setLineWidth(pipe.kind === 'drain' && sized.heatTraced ? 0.8 : 0.45)
    doc.setLineDash(look.pdfDash || [], 0)
    for (let i = 1; i < points.length; i += 1) {
      doc.line(px(points[i - 1].x), py(points[i - 1].z), px(points[i].x), py(points[i].z))
    }
    doc.setLineDash([], 0)
    let best = 0
    let mid = points[0]
    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
      if (len >= best) {
        best = len
        mid = { x: (points[i].x + points[i - 1].x) / 2, z: (points[i].z + points[i - 1].z) / 2 }
      }
    }
    doc.setFontSize(7)
    doc.setTextColor(look.pdf[0], look.pdf[1], look.pdf[2])
    doc.text(sized.labelAscii, px(mid.x), py(mid.z) - 1.2)
  })

  doc.setFontSize(8)
  doc.setTextColor(80)
  let legend = 'Huoneet: ' + rooms.map((room) => `${room.label} ${room.name} ${room.temp} C`).join('   ·   ')
  legend += '   |   Putket: imu, neste vastaanotin-hoyrystin, neste lauhdutin-vastaanotin, kuumakaasu, kondenssivesi, lammitetty kondenssivesi.'
  const lines = doc.splitTextToSize(legend, 182)
  doc.text(lines, MARGIN, 186)
}

export function isoPoint(x, y, z) {
  const c = Math.cos(Math.PI / 6)
  const s = Math.sin(Math.PI / 6)
  return { x: (x - z) * c, y: (x + z) * s + y }
}

export function doorPlanSize(eq) {
  const vertical = eq.wall === 'e' || eq.wall === 'w' || (eq.rotation === 90 && eq.wall !== 'n' && eq.wall !== 's')
  const thick = Math.max(0.06, eq.depth || 0.08)
  return vertical ? { w: thick, d: eq.width } : { w: eq.width, d: thick }
}

function shownInternal(room) {
  if (isCustomOutline(room)) {
    const dims = polygonMetrics(room).dims
    return { width: dims.width, depth: dims.depth }
  }
  const dims = internalDims(room)
  return { width: dims.width, depth: dims.depth }
}

function doorIsoFace(eq, y0, y1) {
  const half = eq.width / 2
  const wall = eq.wall || (eq.rotation === 90 ? 'e' : 's')
  const x = wall === 'e' ? 0.04 : wall === 'w' ? -0.04 : 0
  const z = wall === 's' ? 0.04 : wall === 'n' ? -0.04 : 0
  if (wall === 'e' || wall === 'w') {
    return [[x, y0, -half], [x, y0, half], [x, y1, half], [x, y1, -half]]
  }
  return [[-half, y0, z], [half, y0, z], [half, y1, z], [-half, y1, z]]
}

function drawIsoPage(doc, rooms) {
  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Isometria', MARGIN, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Huoneet, ovet ja hoyrystimet. Nakyma on ehdotuskuva, ei renderoitu malli.', MARGIN, 22)

  const box = { x: MARGIN, y: 28, w: 182, h: 200 }
  doc.setDrawColor(203, 213, 225)
  doc.rect(box.x, box.y, box.w, box.h)
  if (!rooms.length) return

  const pts = []
  const remember = (p) => pts.push(p)
  rooms.forEach((room) => {
    const L = room.width / 2
    const D = room.depth / 2
    const H = room.height
    ;[
      [-L, 0, -D], [L, 0, -D], [L, 0, D], [-L, 0, D],
      [-L, H, -D], [L, H, -D], [L, H, D], [-L, H, D],
    ].forEach(([x, y, z]) => remember(isoPoint(room.x + x, y, room.z + z)))
  })
  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  const maxY = Math.max(...pts.map((p) => p.y))
  const scale = Math.min((box.w - 16) / (maxX - minX || 1), (box.h - 16) / (maxY - minY || 1))
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * scale
  const oy = box.y + box.h / 2 + ((minY + maxY) / 2) * scale
  const map = (x, y, z) => {
    const p = isoPoint(x, y, z)
    return { x: ox + p.x * scale, y: oy - p.y * scale }
  }
  const poly = (points, color, fill) => {
    doc.setDrawColor(color[0], color[1], color[2])
    doc.setLineWidth(0.25)
    if (fill) doc.setFillColor(fill[0], fill[1], fill[2])
    const start = points[0]
    const rest = points.slice(1).flatMap((p) => [p.x, p.y])
    if (fill) doc.lines(toRel(points), start.x, start.y, [1, 1], 'FD', true)
    else {
      doc.line(points[0].x, points[0].y, points[1].x, points[1].y)
      for (let i = 1; i < points.length - 1; i += 1) doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
      doc.line(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y)
    }
    return rest
  }

  rooms.forEach((room) => {
    const L = room.width / 2
    const D = room.depth / 2
    const H = room.height
    const p = (x, y, z) => map(room.x + x, y, room.z + z)
    const c = rgb(room.color)
    const floor = [p(-L, 0, -D), p(L, 0, -D), p(L, 0, D), p(-L, 0, D)]
    const top = [p(-L, H, -D), p(L, H, -D), p(L, H, D), p(-L, H, D)]
    const south = [p(-L, 0, D), p(L, 0, D), p(L, H, D), p(-L, H, D)]
    const east = [p(L, 0, -D), p(L, 0, D), p(L, H, D), p(L, H, -D)]
    doc.setFillColor(c[0], c[1], c[2])
    poly(floor, c, [c[0], c[1], c[2]])
    poly(south, [100, 116, 139], [226, 232, 240])
    poly(east, [71, 85, 105], [203, 213, 225])
    poly(top, [148, 163, 184], [241, 245, 249])
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    const label = p(0, H, 0)
    doc.text(`${room.label}  ${room.temp} C`, label.x, label.y - 2, { align: 'center' })

    room.equipment.forEach((eq) => {
      const alongX = eq.rotation !== 90
      const hw = (alongX ? eq.width : eq.depth) / 2
      const hd = (alongX ? eq.depth : eq.width) / 2
      const y0 = eq.category === 'evaporator' || eq.category === 'condenser' ? room.height - eq.height - 0.15 : 0
      const y1 = y0 + eq.height
      const q = (x, y, z) => map(room.x + eq.x + x, y, room.z + eq.z + z)
      const corners = eq.category === 'door'
        ? doorIsoFace(eq, y0, y1)
        : [[-hw, y0, hd], [hw, y0, hd], [hw, y1, hd], [-hw, y1, hd]]
      const face = corners.map(([x, y, z]) => q(x, y, z))
      const fill = eq.category === 'door' ? [146, 90, 40] : eq.category === 'evaporator' ? [125, 211, 252] : [250, 204, 21]
      poly(face, [30, 41, 59], fill)
    })
  })
}

function toRel(points) {
  const rel = []
  for (let i = 1; i < points.length; i += 1) {
    rel.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y])
  }
  rel.push([points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y])
  return rel
}

function drawLoadPages(doc, result) {
  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Lampokuorma huoneittain', MARGIN, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text('Q = U A dT, tuote m cp dT / 24 h, ovi-ilma V rho cp dT / 24 h, laatta keskim. teho, sitten varmuuskerroin.', MARGIN, 22)

  let y = 30
  result.rooms.forEach((room) => {
    y = ensure(doc, y, 28)
    doc.setFillColor(248, 250, 252)
    doc.rect(MARGIN, y, 182, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(`${room.label}  ${room.name}   ${room.temp} C`, MARGIN + 2, y + 6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`${(room.total / 1000).toFixed(2)} kW`, 190, y + 6.5, { align: 'right' })
    y += 14
    doc.setFontSize(8)
    room.lines.forEach((item) => {
      y = ensure(doc, y, 10)
      doc.setTextColor(30)
      doc.text(item.label, MARGIN + 2, y)
      doc.text(`${Math.round(item.watts)} W`, 190, y, { align: 'right' })
      doc.setTextColor(100)
      const formula = doc.splitTextToSize(item.formula, 150)
      doc.text(formula, MARGIN + 2, y + 3.5)
      y += 4 + formula.length * 3.4
    })
    y = ensure(doc, y, 12)
    doc.setTextColor(14, 116, 144)
    doc.text(
      `Valisumma ${Math.round(room.subtotal)} W  x  varmuus ${room.safetyFactor.toFixed(2)}  =  ${Math.round(room.total)} W. Suositus ${room.suggestedEvap.count} x ${room.suggestedEvap.template.name}.`,
      MARGIN + 2,
      y
    )
    y += 8
    doc.setTextColor(90)
    doc.text(
      `Sisamitat ${room.internal.width.toFixed(2)} x ${room.internal.depth.toFixed(2)} x ${room.internal.height.toFixed(2)} m`,
      MARGIN + 2,
      y
    )
    y += 10
  })

  if (!result.rooms.length) {
    doc.setFontSize(10)
    doc.text('Lisaa huone, niin erittely tulostuu tahan.', MARGIN, 36)
  }
}

function drawSchedule(doc, rooms, pipes = [], cables = []) {
  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Ovi- ja laiteluettelo', MARGIN, 16)
  let y = 26
  const rows = []
  rooms.forEach((room) => {
    room.equipment.forEach((eq) => rows.push({ room, eq }))
  })
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Huone', MARGIN, y)
  doc.text('Laite', 42, y)
  doc.text('Koko (m)', 108, y)
  doc.text('kW', 150, y)
  doc.text('Koro', 168, y)
  y += 3
  doc.setDrawColor(203, 213, 225)
  doc.line(MARGIN, y, 196, y)
  y += 5
  if (!rows.length) {
    doc.setTextColor(80)
    doc.text('Ei sijoitettuja ovia tai laitteita.', MARGIN, y)
    y += 8
  }
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30)
  rows.forEach((row) => {
    y = ensure(doc, y, 8)
    const koro = resolvedElevation(row.room, row.eq)
    const mount = row.eq.mount || (row.eq.category === 'evaporator' ? 'ceiling' : 'floor')
    doc.text(`${row.room.label} ${row.room.name}`, MARGIN, y)
    doc.text(String(row.eq.name).replace(/[^\x20-\x7E]/g, ' '), 42, y)
    doc.text(`${row.eq.width.toFixed(2)} x ${row.eq.depth.toFixed(2)} x ${row.eq.height.toFixed(2)}`, 108, y)
    doc.text(row.eq.capacityKw ? String(row.eq.capacityKw) : '-', 150, y)
    doc.text(`${koro.toFixed(2)} m ${mountLabel(mount, true)}`, 168, y)
    y += 6
  })

  y = ensure(doc, y + 6, 24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Putket ja ohjaus', MARGIN, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const project = calculateProject(rooms)
  ;(pipes || []).forEach((pipe) => {
    y = ensure(doc, y, 16)
    const sized = sizePlacedPipe(pipe, rooms, project.rooms, pipes).sized
    doc.setTextColor(30)
    doc.text(`${sized.labelAscii}   ${routeLength(pipe.points).toFixed(1)} m`, MARGIN, y)
    y += 4
    doc.setTextColor(90)
    sized.steps.slice(0, 3).forEach((step) => {
      y = ensure(doc, y, 6)
      doc.text(`${step.label}: ${step.formula}`, MARGIN + 2, y)
      y += 3.6
    })
    y += 2
  })
  y = ensure(doc, y, 12)
  doc.setTextColor(80)
  doc.text(INTERNAL_LIQUID_TRAIN.replace(/[^\x20-\x7E]/g, ' '), MARGIN, y)
  y += 6
  if (cables?.length) {
    y = ensure(doc, y, 8)
    doc.setTextColor(30)
    doc.text(`Ohjauskaapeleita ${cables.length} kpl`, MARGIN, y)
    y += 6
  }
  const devices = []
  rooms.forEach((room) => {
    room.equipment.forEach((eq) => {
      if (eq.category === 'sensor' || eq.category === 'controller') devices.push(`${room.label} ${eq.name}`)
    })
  })
  if (devices.length) {
    y = ensure(doc, y, 8)
    doc.text(devices.join('  ·  ').replace(/[^\x20-\x7E]/g, ' '), MARGIN, y)
  }
}

const SCHEMATIC_RGB = {
  discharge: [220, 38, 38],
  liquid: [234, 88, 12],
  suction: [29, 78, 216],
  oil: [161, 98, 7],
  control: [21, 128, 61],
  sensor: [71, 85, 105],
}

function drawSchematicPages(doc, projectName, rooms, schematic) {
  const model = buildSchematics(rooms, { ...(schematic || {}), projectName })
  model.circuits.forEach((circuit, index) => {
    doc.addPage([297, 210])
    const pageW = 297
    const pageH = 210
    doc.setFillColor(244, 246, 248)
    doc.rect(0, 0, pageW, pageH, 'F')
    const scale = Math.min((pageW - 16) / circuit.width, (pageH - 16) / circuit.height)
    const ox = (pageW - circuit.width * scale) / 2
    const oy = 6
    const X = (x) => ox + x * scale
    const Y = (y) => oy + y * scale
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(`Periaatekaavio ${index + 1}/${model.circuits.length}`, 8, 8)
    circuit.boxes.forEach((box) => {
      doc.setDrawColor(100, 116, 139)
      doc.setLineWidth(0.3)
      doc.roundedRect(X(box.x), Y(box.y), box.w * scale, box.h * scale, 1.2, 1.2)
      doc.setFontSize(7)
      doc.setTextColor(71, 85, 105)
      doc.text(ascii(box.title), X(box.x) + 1.5, Y(box.y) + 3.2)
    })
    circuit.lines.forEach((line) => {
      const rgb = SCHEMATIC_RGB[line.kind] || SCHEMATIC_RGB.suction
      doc.setDrawColor(...rgb)
      doc.setLineWidth(line.kind === 'sensor' || line.kind === 'control' ? 0.35 : 0.9)
      if (line.kind === 'control' || line.kind === 'sensor' || line.kind === 'oil') doc.setLineDashPattern([1.2, 0.8], 0)
      else doc.setLineDashPattern([], 0)
      for (let i = 1; i < line.points.length; i += 1) {
        const a = line.points[i - 1]
        const b = line.points[i]
        doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y))
      }
    })
    doc.setLineDashPattern([], 0)
    circuit.symbols.forEach((symbol) => {
      doc.setDrawColor(15, 23, 42)
      doc.setFillColor(226, 232, 240)
      doc.setLineWidth(0.25)
      doc.roundedRect(X(symbol.x), Y(symbol.y), Math.max(symbol.w, 8) * scale, Math.max(symbol.h, 8) * scale, 0.8, 0.8, 'FD')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(15, 23, 42)
      doc.text(ascii(symbol.label || symbol.type), X(symbol.x) + 0.6, Y(symbol.y) + Math.min(symbol.h * scale, 3.2))
    })
    circuit.labels.forEach((label) => {
      doc.setFontSize(6)
      doc.setTextColor(...(SCHEMATIC_RGB[label.kind] || [15, 23, 42]))
      doc.text(ascii(label.text), X(label.x), Y(label.y))
    })
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    doc.text(ascii(`${circuit.refrigerant}  Te ${circuit.teC} C  Tc ${circuit.tcC} C  ${circuit.capacityKw.toFixed(1)} kW`), 8, pageH - 10)
  })
}

export function pdfFilename(projectName) {
  const slug = String(projectName || 'refcad').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40)
  return `${slug || 'refcad'}_suunnitelma.pdf`
}
