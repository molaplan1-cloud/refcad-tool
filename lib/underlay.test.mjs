import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPlan, buildFloorPlanPdf } from './floorplan.js'
import { layerEyeOn, setLayerEye } from './layers.js'
import { MESSAGES } from './messages.js'
import { snapPoint } from './snap.js'
import {
  UNDERLAY_MAX_EDGE,
  acceptUnderlaySuggestions,
  analyzeUnderlay,
  applyPdfScale,
  calibrateUnderlay,
  fittedSize,
  moveUnderlay,
  pdfScaleMetres,
  placeUnderlay,
  rejectUnderlaySuggestions,
  rotateUnderlay,
  scaleForBudget,
  setUnderlayLocked,
  warpRaster,
} from './underlay.js'

function blank(width, height) {
  const data = new Uint8Array(width * height)
  data.fill(255)
  return data
}

function hline(data, width, y, x0, x1, thick = 2) {
  for (let t = 0; t < thick; t += 1) {
    for (let x = x0; x <= x1; x += 1) data[(y + t) * width + x] = 0
  }
}

function vline(data, width, x, y0, y1, thick = 2) {
  for (let t = 0; t < thick; t += 1) {
    for (let y = y0; y <= y1; y += 1) data[y * width + (x + t)] = 0
  }
}

function cadSheet() {
  const width = 400
  const height = 280
  const data = blank(width, height)
  hline(data, width, 40, 30, 360)
  hline(data, width, 48, 30, 140)
  hline(data, width, 48, 190, 360)
  hline(data, width, 200, 30, 360)
  hline(data, width, 208, 30, 360)
  vline(data, width, 30, 40, 208)
  vline(data, width, 38, 40, 208)
  vline(data, width, 352, 40, 208)
  vline(data, width, 360, 40, 208)
  return { width, height, data }
}

function noisyPhoto() {
  const width = 80
  const height = 60
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i += 1) data[i] = i % 3 === 0 ? 20 : 40
  return { width, height, data }
}

test('a floor-plan underlay starts locked and out of the PDF', () => {
  const plan = placeUnderlay(emptyPlan(), {
    name: 'pohja.pdf',
    source: 'pdf',
    image: 'data:image/jpeg;base64,abc',
    pixelWidth: 720,
    pixelHeight: 500,
  })
  assert.equal(plan.underlay.locked, true)
  assert.equal(plan.underlay.visible, true)
  assert.equal(plan.underlay.includeInPdf, false)
  assert.equal(plan.walls.length, 0)
  assert.equal(layerEyeOn(plan, 'underlay', 'rakenne'), true)
  const hidden = setLayerEye(plan, 'underlay', false, 'rakenne')
  assert.equal(layerEyeOn(hidden, 'underlay', 'rakenne'), false)
  assert.equal(moveUnderlay(plan, 2, 0), plan)
  const moved = moveUnderlay(setUnderlayLocked(plan, false), 2, 0)
  assert.equal(moved.underlay.x, plan.underlay.x + 2)
})

test('two points and a typed distance set the underlay scale', () => {
  const plan = placeUnderlay(emptyPlan(), {
    name: 'scan.png',
    source: 'png',
    image: 'data:image/png;base64,abc',
    pixelWidth: 400,
    pixelHeight: 300,
  })
  const scaled = calibrateUnderlay(plan, { x: 0, z: 4 }, { x: 2, z: 4 }, 10000)
  assert.equal(scaled.underlay.calibrated, true)
  assert.equal(scaled.underlay.scaleMode, 'points')
  assert.ok(Math.abs(scaled.underlay.widthM / plan.underlay.widthM - 5) < 0.02)
  assert.equal(scaled.walls.length, 0)
})

test('a PDF scale of 1:50 at 72 DPI uses the paper size', () => {
  assert.ok(Math.abs(pdfScaleMetres(720, 72, 50) - 12.7) < 0.001)
  const plan = applyPdfScale(placeUnderlay(emptyPlan(), {
    name: 'a.pdf',
    source: 'pdf',
    image: 'data:image/jpeg;base64,abc',
    pixelWidth: 720,
    pixelHeight: 360,
  }), { ratio: 100, dpi: 72 })
  assert.ok(Math.abs(plan.underlay.widthM - 25.4) < 0.02)
  assert.equal(plan.underlay.ratio, 100)
})

test('rotation is refused while the underlay is locked', () => {
  const plan = placeUnderlay(emptyPlan(), {
    name: 'a.png',
    source: 'png',
    image: 'data:image/png;base64,abc',
    pixelWidth: 100,
    pixelHeight: 50,
  })
  assert.equal(rotateUnderlay(plan, 90).underlay.rotation, 0)
  const turned = rotateUnderlay(setUnderlayLocked(plan, false), 90)
  assert.equal(turned.underlay.rotation, 90)
})

test('stored images are kept under the size budget', () => {
  const fitted = fittedSize(3200, 2000, UNDERLAY_MAX_EDGE)
  assert.ok(fitted.width <= UNDERLAY_MAX_EDGE)
  assert.ok(fitted.height < 2000)
  const shrunk = scaleForBudget(1600, 1200, 900000)
  assert.ok(shrunk.width < 1600)
})

test('deskew keeps a pixel that is already on the rectangle', () => {
  const rgba = new Uint8ClampedArray(8 * 8 * 4).fill(255)
  rgba[0] = 0
  rgba[1] = 0
  rgba[2] = 0
  const warped = warpRaster(rgba, 8, 8, [
    { x: 0, y: 0 },
    { x: 7, y: 0 },
    { x: 7, y: 7 },
    { x: 0, y: 7 },
  ])
  assert.ok(warped.width >= 7)
  assert.ok(warped.rgba[0] < 40)
})

test('wall detection only proposes ghosts until the user accepts them', () => {
  const raster = cadSheet()
  const plan = placeUnderlay(emptyPlan(), {
    name: 'cad.png',
    source: 'png',
    image: 'data:image/png;base64,abc',
    pixelWidth: raster.width,
    pixelHeight: raster.height,
    widthM: 8,
    heightM: 5.6,
    x: 4,
    z: 2.8,
  })
  const traced = analyzeUnderlay(plan.underlay, raster, { suggest: false })
  assert.ok(traced.lines.length >= 4)
  assert.equal(traced.suggestions.length, 0)
  const found = analyzeUnderlay(plan.underlay, raster, { suggest: true })
  const walls = found.suggestions.filter((item) => item.kind === 'wall')
  const openings = found.suggestions.filter((item) => item.kind === 'opening')
  assert.ok(walls.length >= 3, `walls ${walls.length}`)
  const vertical = walls.filter((item) => Math.abs(item.a.x - item.b.x) < 0.05)
  assert.ok(vertical.some((item) => Math.abs(item.a.z - item.b.z) > 3), JSON.stringify(vertical))
  assert.ok(openings.some((item) => item.guess === 'door'), JSON.stringify(openings))
  const proposed = { ...plan, underlay: found }
  assert.equal(proposed.walls.length, 0)
  assert.equal(proposed.openings.length, 0)
  const rejected = rejectUnderlaySuggestions(proposed)
  assert.equal(rejected.walls.length, 0)
  assert.equal(rejected.underlay.suggestions.length, 0)
  const accepted = acceptUnderlaySuggestions(proposed, 'all')
  assert.ok(accepted.walls.length >= 3)
  assert.ok(accepted.openings.length >= 1)
  assert.equal(accepted.underlay.suggestions.length, 0)
})

test('a noisy photo does not invent walls', () => {
  const raster = noisyPhoto()
  const underlay = placeUnderlay(emptyPlan(), {
    name: 'kuva.heic',
    source: 'heic',
    image: 'data:image/jpeg;base64,abc',
    pixelWidth: raster.width,
    pixelHeight: raster.height,
  }).underlay
  const found = analyzeUnderlay(underlay, raster, { suggest: true })
  assert.equal(found.confidence, 'photo')
  assert.equal(found.suggestions.length, 0)
})

test('snapping can use an underlay line', () => {
  const hit = snapPoint({ x: 1.1, z: 0.05 }, {
    walls: [],
    guides: [{ a: { x: 0, z: 0 }, b: { x: 4, z: 0 } }],
    radius: 0.2,
    grid: 1,
  })
  assert.equal(hit.kind, 'underlay')
  assert.ok(Math.abs(hit.point.z) < 0.001)
})

test('the floor PDF leaves the underlay out unless the project asks for it', () => {
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k='
  const bare = buildFloorPlanPdf(emptyPlan())
  const hidden = buildFloorPlanPdf(placeUnderlay(emptyPlan(), {
    name: 'pohja.jpg',
    source: 'jpeg',
    image: jpeg,
    pixelWidth: 1,
    pixelHeight: 1,
  }))
  const shown = buildFloorPlanPdf(placeUnderlay(emptyPlan(), {
    name: 'pohja.jpg',
    source: 'jpeg',
    image: jpeg,
    pixelWidth: 1,
    pixelHeight: 1,
    includeInPdf: true,
  }))
  assert.equal(bare.output().includes('/Subtype /Image'), hidden.output().includes('/Subtype /Image'))
  assert.equal(hidden.output().includes('/Subtype /Image'), false)
  assert.equal(shown.output().includes('/Subtype /Image'), true)
})

test('underlay strings exist in five languages', () => {
  ;['fi', 'en', 'sv', 'es', 'et'].forEach((locale) => {
    assert.equal(MESSAGES[locale]['underlay.import'], MESSAGES[locale]['underlay.import'])
    assert.ok(MESSAGES[locale]['underlay.import'])
    assert.ok(MESSAGES[locale]['underlay.detect'])
    assert.ok(MESSAGES[locale]['underlay.photo'])
    assert.ok(MESSAGES[locale]['underlay.layer'])
  })
  assert.equal(MESSAGES.fi['underlay.import'], 'Tuo pohjakuva')
  assert.equal(MESSAGES.fi['underlay.detect'], 'Tunnista seinät')
})
