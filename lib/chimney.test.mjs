import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addChimneyFor,
  bindFlues,
  CHIMNEY_CLEARANCE,
  chimneySize,
  chimneyTop,
  flueWarnings,
  roofHeightAt,
} from './chimney.js'
import { addFixture, emptyPlan, exampleHouse, familyHouse, furnishRoom, roofModel, updateFixture, updateRoom } from './floorplan.js'
import { furnitureTemplate, resolveFixture } from './furniture.js'
import { autoRoute } from './services.js'

test('chimney sections follow the usual flue sizes', () => {
  assert.deepEqual(chimneySize('masonry', 'half', 1), { w: 0.48, d: 0.48 })
  assert.deepEqual(chimneySize('masonry', 'half', 2), { w: 0.78, d: 0.48 })
  assert.deepEqual(chimneySize('masonry', 'full', 1), { w: 0.64, d: 0.64 })
  assert.equal(chimneySize('element', '150', 1).w, 0.4)
  assert.equal(chimneySize('element', '150', 2).w, 0.72)
  assert.equal(chimneySize('element', '200', 1).w, 0.48)
  assert.equal(chimneySize('steel', '115', 1).w, 0.25)
  assert.equal(chimneySize('steel', '150', 1).w, 0.28)
  assert.equal(chimneySize('steel', '200', 1).w, 0.35)
  assert.ok(chimneySize('steel', '150', 2).w > chimneySize('steel', '150', 1).w)
  assert.equal(CHIMNEY_CLEARANCE.masonry, 0.1)
  assert.equal(CHIMNEY_CLEARANCE.element, 0.05)
  assert.equal(CHIMNEY_CLEARANCE.steel, 0.05)
})

test('an electric kiuas is a dedicated 400 V heater and a wood kiuas needs a chimney', () => {
  const variants = furnitureTemplate('heater').variants
  assert.equal(variants[0].id, 'electric')
  assert.equal(variants[0].electric.power, 9000)
  ;[['electric', 9000], ['kw6', 6000], ['kw105', 10500]].forEach(([id, watts]) => {
    const spec = resolveFixture({ type: 'heater', variant: id })
    assert.equal(spec.electric.kind, 'heater')
    assert.equal(spec.electric.voltage, 400)
    assert.equal(spec.electric.power, watts)
    assert.equal(spec.electric.dedicated, true)
    assert.equal(spec.chimney, false)
  })
  const wood = resolveFixture({ type: 'heater', variant: 'wood' })
  assert.equal(wood.electric, null)
  assert.equal(wood.fuel, 'wood')
  assert.equal(wood.chimney, true)
  assert.equal(wood.clearance.ceiling, 1.2)
  assert.equal(wood.shieldClearance.rear, 0.25)
  assert.ok(wood.hearth.front >= 0.4)
  ;['fireplace', 'insert', 'kamiina', 'leivinuuni', 'puuhella', 'kakluuni'].forEach((id) => {
    const spec = resolveFixture({ type: id })
    assert.equal(spec.fuel, 'wood', id)
    assert.equal(spec.chimney, true, id)
    assert.ok(spec.hearth.front > 0, id)
  })
})

test('the chimney follows the drawn roof and stops short when the stack is too low', () => {
  const house = exampleHouse()
  const model = roofModel(house)
  const ridge = roofHeightAt(house, 6, (model.minZ + model.maxZ) / 2)
  assert.ok(ridge > model.wallHeight)
  assert.ok(ridge <= model.wallHeight + model.rise + 0.001)
  assert.equal(roofHeightAt(house, 40, 40), null)
  const pose = chimneyTop(house, { x: 6, z: 4.5 })
  assert.equal(pose.reaches, true)
  assert.ok(pose.top >= pose.roof + 0.8)
  assert.equal(chimneyTop(house, { x: 6, z: 4.5, stack: 1 }).reaches, false)
  assert.equal(chimneyTop(house, { x: 40, z: 40 }).reaches, false)
})

test('a wood appliance warns until a chimney is linked, and a short chimney warns', () => {
  let plan = emptyPlan('Hormi')
  plan = addFixture(plan, 'heater', 2, 2, 0)
  const heaterId = plan.fixtures.at(-1).id
  plan = updateFixture(plan, heaterId, { variant: 'wood', w: 0.5, d: 0.5, h: 0.8 })
  assert.ok(flueWarnings(plan).some((item) => item.code === 'no-chimney'))
  plan = addFixture(plan, 'chimney', 2.5, 2, 0)
  const chimneyId = plan.fixtures.at(-1).id
  plan = updateFixture(plan, chimneyId, { variant: 'steel', flue: '150', w: 0.28, d: 0.28, x: 2.5, z: 2 })
  plan = bindFlues(plan)
  assert.equal(plan.fixtures.find((item) => item.id === heaterId).chimneyId, chimneyId)
  assert.equal(flueWarnings(plan).some((item) => item.code === 'no-chimney'), false)
  assert.equal(flueWarnings(plan).some((item) => item.code === 'short'), false)
  plan = updateFixture(plan, chimneyId, { stack: 1 })
  assert.ok(flueWarnings(plan).some((item) => item.code === 'short'))
  plan = updateFixture(plan, chimneyId, { x: 30, z: 30, stack: undefined })
  assert.ok(flueWarnings(plan).some((item) => item.code === 'short'))
})

test('clearance is checked against combustible faces and ignored on tile', () => {
  const house = familyHouse()
  const sauna = house.rooms.find((room) => room.name === 'Sauna')
  const bath = house.rooms.find((room) => room.name === 'Kylpyhuone')
  const saunaZ = Math.min(...sauna.polygon.map((point) => point.z))
  let tight = addFixture(house, 'chimney', 11, 6, 0)
  const tightId = tight.fixtures.at(-1).id
  tight = updateFixture(tight, tightId, { x: 11, z: saunaZ + 0.16, rotation: 0, variant: 'steel', flue: '150', w: 0.28, d: 0.28 })
  assert.ok(flueWarnings(tight).some((item) => item.id === tightId && item.code === 'clearance'))

  const bathZ = Math.min(...bath.polygon.map((point) => point.z))
  const bathX = bath.polygon.reduce((sum, point) => sum + point.x, 0) / bath.polygon.length
  let safe = addFixture(house, 'chimney', bathX, bathZ + 0.4, 0)
  const safeId = safe.fixtures.at(-1).id
  safe = updateFixture(safe, safeId, { x: bathX, z: bathZ + 0.26, rotation: 0, variant: 'masonry', flue: 'half', w: 0.48, d: 0.48 })
  assert.equal(flueWarnings(safe).some((item) => item.id === safeId && item.code === 'clearance'), false)

  const living = house.rooms.find((room) => room.name === 'Olohuone')
  const livingZ = Math.min(...living.polygon.map((point) => point.z))
  const livingX = 6
  let log = { ...house, exteriorStructure: 'hirsi' }
  log = addFixture(log, 'chimney', livingX, livingZ + 0.5, 0)
  const logId = log.fixtures.at(-1).id
  log = updateFixture(log, logId, { x: livingX, z: livingZ + 0.28, rotation: 0, variant: 'masonry', w: 0.48, d: 0.48 })
  assert.ok(flueWarnings(log).some((item) => item.id === logId && item.code === 'clearance'))
})

test('the furnished sauna and living room keep a roofed flue and the safety distances', () => {
  const house = familyHouse()
  const sauna = house.rooms.find((room) => room.name === 'Sauna')
  let furnished = bindFlues(furnishRoom(house, sauna.id))
  const heater = furnished.fixtures.find((item) => item.type === 'heater')
  const flue = furnished.fixtures.find((item) => item.type === 'chimney')
  assert.equal(heater.variant, 'wood')
  assert.equal(flue.variant, 'steel')
  assert.equal(heater.chimneyId, flue.id)
  assert.deepEqual(flueWarnings(furnished), [])

  const living = house.rooms.find((room) => room.name === 'Olohuone')
  furnished = bindFlues(furnishRoom(house, living.id))
  const fire = furnished.fixtures.find((item) => item.type === 'fireplace')
  assert.equal(fire.chimneyId, furnished.fixtures.find((item) => item.type === 'chimney').id)
  assert.deepEqual(flueWarnings(furnished), [])
})

test('a wood ceiling that is too close to a stove is flagged', () => {
  let plan = familyHouse()
  const sauna = plan.rooms.find((room) => room.name === 'Sauna')
  plan = updateRoom(plan, sauna.id, { ceilingId: 'panel', ceilingHeight: 1.5 })
  plan = addFixture(plan, 'heater', 11, 7, 0)
  const id = plan.fixtures.at(-1).id
  plan = updateFixture(plan, id, { variant: 'wood', x: 11, z: 7, w: 0.5, d: 0.5, h: 0.8, rotation: 0 })
  plan = addFixture(plan, 'chimney', 11.4, 7, 0)
  const flue = plan.fixtures.at(-1).id
  plan = updateFixture(plan, flue, { variant: 'steel', x: 11.4, z: 7, w: 0.28, d: 0.28 })
  plan = bindFlues(plan)
  assert.ok(flueWarnings(plan).some((item) => item.id === id && item.text.includes('katon')))
})

test('adding a chimney links the appliance, and the example kiuas still gets a control panel', () => {
  let plan = emptyPlan('Takka')
  plan = addFixture(plan, 'fireplace', 4, 3, 0)
  const id = plan.fixtures.at(-1).id
  plan = addChimneyFor(plan, id)
  const fire = plan.fixtures.find((item) => item.id === id)
  const flue = plan.fixtures.find((item) => item.id === fire.chimneyId)
  assert.equal(flue.type, 'chimney')
  assert.equal(flue.variant, 'masonry')
  const routed = autoRoute(exampleHouse(), 'electric')
  assert.ok(routed.services.nodes.some((node) => node.kind === 'heater-control' && node.name === 'Kiukaan ohjaus'))
  const heater = exampleHouse().fixtures.find((item) => item.type === 'heater')
  assert.equal(resolveFixture(heater).electric.power, 9000)
})
