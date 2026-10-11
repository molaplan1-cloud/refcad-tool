import { addOpening, addWall, emptyPlan, planBounds, updateWall } from './floorplan.js'

export const UNDERLAY_MAX_BYTES = 380000
export const UNDERLAY_MAX_EDGE = 1600

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function dist(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0))
}

export function emptyUnderlay(partial = {}) {
  return {
    name: '',
    source: 'image',
    image: '',
    pixelWidth: 1,
    pixelHeight: 1,
    x: 5,
    z: 4,
    widthM: 10,
    heightM: 8,
    rotation: 0,
    opacity: 0.55,
    visible: true,
    locked: true,
    snapLines: false,
    includeInPdf: false,
    calibrated: false,
    scaleMode: '',
    ratio: 50,
    dpi: 72,
    page: 1,
    pageCount: 1,
    confidence: 'cad',
    suggestions: [],
    lines: [],
    ...partial,
  }
}

export function underlayOf(plan) {
  const raw = plan?.underlay
  if (!raw || typeof raw !== 'object' || !raw.image) return null
  const next = emptyUnderlay(raw)
  next.opacity = clamp(Number(next.opacity) || 0.55, 0.05, 1)
  next.rotation = Number(next.rotation) || 0
  next.locked = next.locked !== false
  next.visible = next.visible !== false
  next.includeInPdf = Boolean(raw.includeInPdf)
  next.snapLines = Boolean(raw.snapLines)
  next.suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : []
  next.lines = Array.isArray(raw.lines) ? raw.lines : []
  return next
}

export function fittedSize(width, height, maxEdge = UNDERLAY_MAX_EDGE) {
  const edge = Math.max(Number(width) || 1, Number(height) || 1)
  if (edge <= maxEdge) return { width, height, scale: 1 }
  const scale = maxEdge / edge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

export function scaleForBudget(width, height, bytes, maxBytes = UNDERLAY_MAX_BYTES) {
  const fitted = fittedSize(width, height)
  if (!(bytes > maxBytes)) return fitted
  const factor = Math.sqrt(maxBytes / bytes) * 0.9
  return fittedSize(Math.max(1, Math.round(fitted.width * factor)), Math.max(1, Math.round(fitted.height * factor)), Math.max(fitted.width, fitted.height))
}

export function pdfScaleMetres(pixels, dpi, ratio) {
  const safeDpi = Number(dpi) > 1 ? Number(dpi) : 72
  const paperM = (Number(pixels) || 0) / safeDpi * 0.0254
  return paperM * (Number(ratio) > 0 ? Number(ratio) : 1)
}

export function imageToWorld(underlay, u, v) {
  const item = underlay || emptyUnderlay()
  const localX = (u - 0.5) * item.widthM
  const localZ = (v - 0.5) * item.heightM
  const rad = (item.rotation || 0) * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: item.x + localX * cos - localZ * sin,
    z: item.z + localX * sin + localZ * cos,
  }
}

export function worldToImage(underlay, point) {
  const item = underlay || emptyUnderlay()
  const dx = (point?.x || 0) - item.x
  const dz = (point?.z || 0) - item.z
  const rad = (item.rotation || 0) * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const localX = dx * cos + dz * sin
  const localZ = -dx * sin + dz * cos
  return {
    u: item.widthM ? localX / item.widthM + 0.5 : 0.5,
    v: item.heightM ? localZ / item.heightM + 0.5 : 0.5,
  }
}

export function underlayCorners(underlay) {
  if (!underlay?.image) return []
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => imageToWorld(underlay, u, v))
}

export function underlayHit(underlay, point) {
  if (!underlay?.image || underlay.visible === false) return false
  const { u, v } = worldToImage(underlay, point)
  return u >= 0 && u <= 1 && v >= 0 && v <= 1
}

export function placeUnderlay(plan, spec) {
  const box = planBounds(plan && Array.isArray(plan.walls) ? plan : emptyPlan())
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const pixelWidth = Math.max(1, spec.pixelWidth || 1)
  const pixelHeight = Math.max(1, spec.pixelHeight || 1)
  const longM = 10
  const aspect = pixelHeight / pixelWidth
  const widthM = pixelWidth >= pixelHeight ? longM : longM / aspect
  const heightM = pixelWidth >= pixelHeight ? longM * aspect : longM
  return {
    ...plan,
    underlay: emptyUnderlay({
      ...spec,
      x: cx,
      z: cz,
      widthM: round3(widthM),
      heightM: round3(heightM),
      pixelWidth,
      pixelHeight,
      locked: true,
      visible: true,
      includeInPdf: Boolean(spec.includeInPdf),
      confidence: spec.source === 'jpeg' || spec.source === 'heic' ? 'photo' : 'cad',
    }),
  }
}

export function patchUnderlay(plan, patch) {
  const current = underlayOf(plan)
  if (!current) return plan
  return { ...plan, underlay: { ...current, ...patch } }
}

export function setUnderlayOpacity(plan, opacity) {
  return patchUnderlay(plan, { opacity: clamp(Number(opacity) || 0, 0.05, 1) })
}

export function setUnderlayVisible(plan, visible) {
  return patchUnderlay(plan, { visible: Boolean(visible) })
}

export function setUnderlayLocked(plan, locked) {
  return patchUnderlay(plan, { locked: Boolean(locked) })
}

export function moveUnderlay(plan, dx, dz) {
  const current = underlayOf(plan)
  if (!current || current.locked) return plan
  return patchUnderlay(plan, { x: round3(current.x + dx), z: round3(current.z + dz) })
}

export function rotateUnderlay(plan, deltaDeg) {
  const current = underlayOf(plan)
  if (!current || current.locked) return plan
  return patchUnderlay(plan, { rotation: round3((current.rotation || 0) + deltaDeg) })
}

export function setUnderlayRotation(plan, deg) {
  const current = underlayOf(plan)
  if (!current || current.locked) return plan
  return patchUnderlay(plan, { rotation: round3(Number(deg) || 0) })
}

export function applyPdfScale(plan, { ratio = 50, dpi = 72 } = {}) {
  const current = underlayOf(plan)
  if (!current) return plan
  return patchUnderlay(plan, {
    widthM: round3(pdfScaleMetres(current.pixelWidth, dpi, ratio)),
    heightM: round3(pdfScaleMetres(current.pixelHeight, dpi, ratio)),
    calibrated: true,
    scaleMode: 'ratio',
    ratio: Number(ratio) || 50,
    dpi: Number(dpi) || 72,
    suggestions: [],
    lines: [],
  })
}

export function calibrateUnderlay(plan, p1, p2, distanceMm) {
  const current = underlayOf(plan)
  if (!current) return plan
  const currentDist = dist(p1, p2)
  const wanted = (Number(distanceMm) || 0) / 1000
  if (currentDist < 0.02 || wanted < 0.05) return plan
  const factor = wanted / currentDist
  return patchUnderlay(plan, {
    x: round3(p1.x + (current.x - p1.x) * factor),
    z: round3(p1.z + (current.z - p1.z) * factor),
    widthM: round3(current.widthM * factor),
    heightM: round3(current.heightM * factor),
    calibrated: true,
    scaleMode: 'points',
    suggestions: [],
    lines: [],
  })
}

export function underlaySnapGuides(plan) {
  const item = underlayOf(plan)
  if (!item?.snapLines || item.visible === false) return []
  return (item.lines || []).map((line) => ({
    a: imageToWorld(item, line.u1, line.v1),
    b: imageToWorld(item, line.u2, line.v2),
  })).filter((seg) => dist(seg.a, seg.b) > 0.15)
}

function solve8(rows) {
  const m = rows.map((row) => row.slice())
  const n = 8
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null
    const swap = m[col]
    m[col] = m[pivot]
    m[pivot] = swap
    const div = m[col][col]
    for (let c = col; c <= n; c += 1) m[col][c] /= div
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue
      const factor = m[r][col]
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

function homography(src, dw, dh) {
  const dest = [[0, 0], [dw, 0], [dw, dh], [0, dh]]
  const rows = []
  dest.forEach(([x, y], index) => {
    const u = src[index].x
    const v = src[index].y
    rows.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u])
    rows.push([0, 0, 0, x, y, 1, -x * v, -y * v, v])
  })
  return solve8(rows)
}

function sampleBilinear(rgba, width, height, x, y) {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return [255, 255, 255, 255]
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const at = (px, py) => {
    const i = (py * width + px) * 4
    return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]]
  }
  const a = at(x0, y0)
  const b = at(x1, y0)
  const c = at(x0, y1)
  const d = at(x1, y1)
  return [0, 1, 2, 3].map((channel) => (
    a[channel] * (1 - tx) * (1 - ty)
    + b[channel] * tx * (1 - ty)
    + c[channel] * (1 - tx) * ty
    + d[channel] * tx * ty
  ))
}

export function warpRaster(rgba, width, height, corners) {
  if (!rgba || corners?.length !== 4) return null
  const span = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const dw = Math.max(8, Math.round((span(corners[0], corners[1]) + span(corners[3], corners[2])) / 2))
  const dh = Math.max(8, Math.round((span(corners[0], corners[3]) + span(corners[1], corners[2])) / 2))
  const coeff = homography(corners, dw, dh)
  if (!coeff) return null
  const [a, b, c, d, e, f, g, h] = coeff
  const out = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const den = g * x + h * y + 1
      const u = (a * x + b * y + c) / den
      const v = (d * x + e * y + f) / den
      const pixel = sampleBilinear(rgba, width, height, u, v)
      const i = (y * dw + x) * 4
      out[i] = pixel[0]
      out[i + 1] = pixel[1]
      out[i + 2] = pixel[2]
      out[i + 3] = pixel[3]
    }
  }
  return { rgba: out, width: dw, height: dh }
}

function grayOf(data, width, height) {
  if (data.length === width * height) return data
  const gray = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i += 1) {
    const o = i * 4
    gray[i] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) | 0
  }
  return gray
}

function downscale(gray, width, height, maxEdge) {
  const edge = Math.max(width, height)
  if (edge <= maxEdge) return { gray, width, height, step: 1 }
  const step = edge / maxEdge
  const nw = Math.max(8, Math.round(width / step))
  const nh = Math.max(8, Math.round(height / step))
  const out = new Uint8Array(nw * nh)
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(height - 1, Math.floor(y * step))
    for (let x = 0; x < nw; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x * step))
      out[y * nw + x] = gray[sy * width + sx]
    }
  }
  return { gray: out, width: nw, height: nh, step }
}

function inkAt(gray, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false
  return gray[y * width + x] < 168
}

function runsAlong(gray, width, height, mpp, axis) {
  const minRun = Math.max(4, Math.round(0.28 / mpp))
  const maxThick = Math.max(3, Math.round(0.055 / mpp))
  const major = axis === 'h' ? height : width
  const minor = axis === 'h' ? width : height
  const rows = []
  for (let i = 0; i < major; i += 1) {
    const found = []
    let start = -1
    for (let j = 0; j <= minor; j += 1) {
      const on = j < minor && (axis === 'h' ? inkAt(gray, width, height, j, i) : inkAt(gray, width, height, i, j))
      if (on && start < 0) start = j
      if (!on && start >= 0) {
        if (j - start >= minRun) found.push({ a: start, b: j - 1 })
        start = -1
      }
    }
    rows.push(found)
  }
  const used = new Set()
  const bands = []
  for (let i = 0; i < major; i += 1) {
    rows[i].forEach((run) => {
      const key = `${i}:${run.a}`
      if (used.has(key)) return
      used.add(key)
      let end = i
      let a = run.a
      let b = run.b
      for (let n = i + 1; n < major && n - i <= maxThick; n += 1) {
        const hit = rows[n].find((item) => {
          const overlap = Math.min(item.b, b) - Math.max(item.a, a)
          return overlap > 0.55 * Math.min(item.b - item.a, b - a)
        })
        if (!hit || used.has(`${n}:${hit.a}`)) break
        used.add(`${n}:${hit.a}`)
        a = Math.min(a, hit.a)
        b = Math.max(b, hit.b)
        end = n
      }
      if ((b - a) * mpp >= 0.35) bands.push({ axis, a, b, c: (i + end) / 2, thick: end - i + 1, gaps: [] })
    })
  }
  bands.sort((p, q) => p.c - q.c || p.a - q.a)
  const bridged = []
  const spent = new Set()
  const maxGap = Math.round(2.8 / mpp)
  bands.forEach((band, index) => {
    if (spent.has(index)) return
    spent.add(index)
    let current = { ...band, gaps: [] }
    for (let j = index + 1; j < bands.length; j += 1) {
      if (spent.has(j)) continue
      const other = bands[j]
      if (Math.abs(other.c - current.c) > maxThick) continue
      const gap = other.a - current.b
      if (gap < 2 || gap > maxGap) continue
      if (gap * mpp < 0.4) continue
      current.gaps.push({ a: current.b, b: other.a })
      current.b = other.b
      current.c = (current.c + other.c) / 2
      spent.add(j)
    }
    bridged.push(current)
  })
  return bridged
}

function pairLines(lines, mpp, width, height) {
  const used = new Set()
  const pairs = []
  lines.forEach((line, index) => {
    if (used.has(index)) return
    let best = null
    lines.forEach((other, j) => {
      if (j <= index || used.has(j) || other.axis !== line.axis) return
      const sep = Math.abs(other.c - line.c) * mpp
      if (sep < 0.07 || sep > 0.45) return
      const overlap0 = Math.max(line.a, other.a)
      const overlap1 = Math.min(line.b, other.b)
      if ((overlap1 - overlap0) * mpp < 0.55) return
      if (!best || sep < best.sep) best = { j, sep, overlap0, overlap1 }
    })
    if (!best) return
    used.add(index)
    used.add(best.j)
    const other = lines[best.j]
    const thickness = best.sep
    const center = (line.c + other.c) / 2
    const gaps = [...line.gaps, ...other.gaps].filter((gap) => gap.b > best.overlap0 && gap.a < best.overlap1)
    pairs.push({
      axis: line.axis,
      a: best.overlap0,
      b: best.overlap1,
      c: center,
      thickness,
      gaps,
      width,
      height,
    })
  })
  return pairs
}

function solidWalls(gray, width, height, mpp) {
  const seen = new Uint8Array(width * height)
  const found = []
  const stack = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (seen[start] || !inkAt(gray, width, height, x, y)) continue
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0
      stack.push(start)
      seen[start] = 1
      while (stack.length) {
        const cur = stack.pop()
        const cx = cur % width
        const cy = (cur / width) | 0
        count += 1
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = cx + dx
          const ny = cy + dy
          if (!inkAt(gray, width, height, nx, ny)) return
          const ni = ny * width + nx
          if (seen[ni]) return
          seen[ni] = 1
          stack.push(ni)
        })
      }
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      const minor = Math.min(bw, bh) * mpp
      const major = Math.max(bw, bh) * mpp
      const fill = count / (bw * bh)
      if (minor < 0.08 || minor > 0.42 || major < 0.9 || fill < 0.55) continue
      if (minor * 4 > major) continue
      const horizontal = bw >= bh
      found.push({
        axis: horizontal ? 'h' : 'v',
        a: horizontal ? minX : minY,
        b: horizontal ? maxX : maxY,
        c: horizontal ? (minY + maxY) / 2 : (minX + maxX) / 2,
        thickness: minor,
        gaps: [],
        width,
        height,
        solid: true,
      })
    }
  }
  return found
}

function pairToWorld(underlay, pair, rasterW, rasterH) {
  if (pair.axis === 'h') {
    return {
      a: imageToWorld(underlay, pair.a / rasterW, pair.c / rasterH),
      b: imageToWorld(underlay, pair.b / rasterW, pair.c / rasterH),
    }
  }
  return {
    a: imageToWorld(underlay, pair.c / rasterW, pair.a / rasterH),
    b: imageToWorld(underlay, pair.c / rasterW, pair.b / rasterH),
  }
}

function covered(pair, solids, mpp) {
  return solids.some((solid) => {
    if (solid.axis !== pair.axis) return false
    const along = Math.min(pair.b, solid.b) - Math.max(pair.a, solid.a)
    return along * mpp > 0.4 && Math.abs(pair.c - solid.c) * mpp < Math.max(pair.thickness, solid.thickness)
  })
}

export function analyzeUnderlay(underlay, raster, options = {}) {
  const item = underlay || emptyUnderlay()
  if (!raster?.width || !raster?.height || !raster.data) {
    return { ...item, lines: [], suggestions: [], confidence: item.confidence || 'cad' }
  }
  const full = grayOf(raster.data, raster.width, raster.height)
  const small = downscale(full, raster.width, raster.height, 420)
  const mpp = (item.widthM / raster.width) * small.step
  let ink = 0
  for (let i = 0; i < small.gray.length; i += 1) if (small.gray[i] < 168) ink += 1
  const inkRatio = ink / small.gray.length
  const photoLike = inkRatio > 0.22 || item.source === 'jpeg' || item.source === 'heic'
  if (inkRatio > 0.32) {
    return { ...item, lines: [], suggestions: options.suggest ? [] : item.suggestions, confidence: 'photo' }
  }
  const horizontal = runsAlong(small.gray, small.width, small.height, mpp, 'h')
  const vertical = runsAlong(small.gray, small.width, small.height, mpp, 'v')
  const lines = [...horizontal, ...vertical].map((line) => {
    const u0 = line.axis === 'h' ? line.a / small.width : line.c / small.width
    const u1 = line.axis === 'h' ? line.b / small.width : line.c / small.width
    const v0 = line.axis === 'h' ? line.c / small.height : line.a / small.height
    const v1 = line.axis === 'h' ? line.c / small.height : line.b / small.height
    return { u1: u0, v1: v0, u2: u1, v2: v1 }
  })
  if (!options.suggest) {
    return { ...item, lines, confidence: photoLike ? 'photo' : 'cad' }
  }
  const solids = solidWalls(small.gray, small.width, small.height, mpp)
  const pairs = [...pairLines(horizontal, mpp, small.width, small.height), ...pairLines(vertical, mpp, small.width, small.height)]
    .filter((pair) => !covered(pair, solids, mpp))
  const walls = [...solids, ...pairs]
  let seq = 1
  const suggestions = []
  walls.forEach((pair) => {
    const world = pairToWorld(item, pair, small.width, small.height)
    if (dist(world.a, world.b) < 0.4) return
    const id = `sug-${seq}`
    seq += 1
    suggestions.push({
      id,
      kind: 'wall',
      selected: true,
      a: { x: round3(world.a.x), z: round3(world.a.z) },
      b: { x: round3(world.b.x), z: round3(world.b.z) },
      thickness: round3(pair.thickness),
    })
    pair.gaps.forEach((gap) => {
      const span = (gap.b - gap.a) * mpp
      if (span < 0.5 || span > 2.6) return
      const mid = (Math.max(gap.a, pair.a) + Math.min(gap.b, pair.b)) / 2
      const at = pair.axis === 'h'
        ? imageToWorld(item, mid / small.width, pair.c / small.height)
        : imageToWorld(item, pair.c / small.width, mid / small.height)
      const openingId = `sug-${seq}`
      seq += 1
      suggestions.push({
        id: openingId,
        kind: 'opening',
        selected: true,
        parentId: id,
        at: { x: round3(at.x), z: round3(at.z) },
        width: round3(span),
        guess: span <= 1.35 ? 'door' : 'window',
      })
    })
  })
  const pairCount = suggestions.filter((item) => item.kind === 'wall').length
  const confidence = inkRatio > 0.22 && pairCount < 2 ? 'photo' : (photoLike ? 'photo' : 'cad')
  return { ...item, lines, suggestions, confidence }
}

export function toggleSuggestion(plan, id) {
  const current = underlayOf(plan)
  if (!current) return plan
  return patchUnderlay(plan, {
    suggestions: current.suggestions.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
  })
}

export function rejectUnderlaySuggestions(plan) {
  const current = underlayOf(plan)
  if (!current) return plan
  return patchUnderlay(plan, { suggestions: [] })
}

export function acceptUnderlaySuggestions(plan, mode = 'selected') {
  const current = underlayOf(plan)
  if (!current) return plan
  const picked = current.suggestions.filter((item) => mode === 'all' || item.selected)
  const parents = new Set(picked.filter((item) => item.kind === 'opening').map((item) => item.parentId))
  const walls = current.suggestions.filter((item) => item.kind === 'wall' && (mode === 'all' || item.selected || parents.has(item.id)))
  let next = plan
  const wallIds = new Map()
  walls.forEach((suggestion) => {
    const before = new Set((next.walls || []).map((wall) => wall.id))
    const kind = suggestion.thickness >= 0.18 ? 'exterior' : 'interior'
    next = addWall(next, suggestion.a, suggestion.b, kind, { thickness: suggestion.thickness })
    const created = (next.walls || []).filter((wall) => !before.has(wall.id))
    const host = created.sort((a, b) => dist(b.a, b.b) - dist(a.a, a.b))[0]
    if (!host) return
    wallIds.set(suggestion.id, host.id)
    next = updateWall(next, host.id, { thickness: suggestion.thickness, thicknessCustom: true, kind })
  })
  picked.filter((item) => item.kind === 'opening').forEach((opening) => {
    const wallId = wallIds.get(opening.parentId)
    if (!wallId) return
    next = addOpening(next, wallId, opening.at, opening.guess || 'door', { width: opening.width })
  })
  const acceptedWalls = new Set(walls.map((item) => item.id))
  return {
    ...next,
    underlay: {
      ...underlayOf(next),
      suggestions: mode === 'all' ? [] : current.suggestions.filter((item) => {
        if (acceptedWalls.has(item.id)) return false
        if (item.kind === 'opening' && acceptedWalls.has(item.parentId)) return false
        return true
      }),
    },
  }
}

export function underlayPdfBox(underlay, X, Y) {
  const item = underlay
  if (!item?.image || item.visible === false || !item.includeInPdf) return null
  const corners = underlayCorners(item).map((point) => ({ x: X(point.x), y: Y(point.z) }))
  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    rotation: item.rotation || 0,
  }
}
