import assert from 'node:assert/strict'
import test from 'node:test'
import { addWall, emptyPlan, exampleHouse, materialsList, plinthArea, plinthLook, roofLook, surfaceLook } from './floorplan.js'
import { finishesOf, roofingOf } from './finishes.js'

test('a new plan uses a 400 mm grey plinth and white trim', () => {
  const finish = finishesOf(emptyPlan())
  assert.equal(finish.plinthHeight, 0.4)
  assert.equal(finish.plinthMaterial, 'render-grey')
  assert.equal(finish.trimColor, '#F4F1EA')
  assert.equal(finish.boardWidthMm, 145)
  const plinth = plinthLook(emptyPlan())
  assert.equal(plinth.code, 'RAL 7030')
  assert.ok(plinthArea(exampleHouse()) > 10)
})

test('wood cladding takes a named paint and brick can be painted', () => {
  const plan = {
    ...emptyPlan(),
    exteriorId: 'wood-horizontal',
    claddingColor: '#2E5984',
    claddingCode: 'NCS S 4030-R90B',
    boardWidthMm: 120,
  }
  const wood = surfaceLook(plan, 'wood-horizontal')
  assert.equal(wood.color, '#2E5984')
  assert.equal(wood.code, 'NCS S 4030-R90B')
  assert.equal(wood.pattern, 'boards-h')
  assert.equal(wood.boardWidthMm, 120)
  const painted = surfaceLook({ ...plan, exteriorId: 'brick-red', brickPaint: '#E0B03A', brickPaintCode: 'NCS S 1050-Y10R' }, 'brick-red')
  assert.equal(painted.painted, true)
  assert.equal(painted.pattern, 'brick')
  assert.equal(painted.color, '#E0B03A')
  const natural = surfaceLook(emptyPlan(), 'brick-red')
  assert.equal(natural.painted, false)
  assert.equal(natural.pattern, 'brick')
})

test('roofing, gutters and the bill list colour codes', () => {
  assert.equal(roofingOf('metal').id, 'standing-seam')
  assert.equal(roofingOf('tile-metal').pattern, 'tile-metal')
  const plan = {
    ...exampleHouse(),
    roofId: 'standing-seam',
    roofColor: '#1C1C1C',
    roofCode: 'RAL 9005',
    gutterColor: '#383E42',
    claddingColor: '#2E5984',
    claddingCode: 'NCS S 4030-R90B',
  }
  const roof = roofLook(plan)
  assert.equal(roof.color, '#1C1C1C')
  assert.equal(roof.code, 'RAL 9005')
  assert.equal(roof.pattern, 'seam')
  const rows = materialsList(plan)
  assert.ok(rows.some((row) => row.group === 'plinth' && row.code === 'RAL 7030' && row.area > 1))
  assert.ok(rows.some((row) => row.group === 'roof' && row.code === 'RAL 9005'))
  assert.ok(rows.some((row) => row.group === 'facade' && row.code === 'NCS S 4030-R90B'))
  assert.ok(rows.some((row) => row.groupLabel === 'Katto' && row.name === 'Konesaumattu pelti'))
})

test('a facade zone colour overrides the house paint', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = { ...plan, claddingColor: '#2E5984', claddingCode: 'NCS S 4030-R90B' }
  const zoned = surfaceLook(plan, 'wood-horizontal', { color: '#8E3924', colorCode: 'NCS S 4050-Y80R' })
  assert.equal(zoned.color, '#8E3924')
  assert.equal(zoned.code, 'NCS S 4050-Y80R')
})
