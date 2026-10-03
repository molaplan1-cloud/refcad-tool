import assert from 'node:assert/strict'
import test from 'node:test'
import { addWall, emptyPlan, exampleHouse, familyHouse, furnishRoom, pointInPolygon, snapFixture } from './floorplan.js'
import { FURNITURE, layoutFor, resolveFixture, waterNeed } from './furniture.js'
import { syncFixtureServices } from './fixtureServices.js'
import { autoRoute } from './services.js'

const ids = new Set(FURNITURE.map((item) => item.id))

test('the catalog covers the rooms a Finnish house designer furnishes', () => {
  ;[
    'toilet', 'basin', 'vanity', 'mirror-cab', 'mirror', 'bidet', 'bidet-spray', 'paper', 'hooks', 'floor-drain', 'wc-store',
    'washer', 'dryer', 'laundry-stack', 'dry-cabinet', 'shower', 'bath', 'spa', 'soap', 'shower-bench', 'shower-rail', 'towel-rad', 'litter', 'hamper',
    'heater', 'bench', 'sauna-door', 'bucket',
    'cabinet', 'wall-cab', 'sink', 'stove', 'oven', 'microwave', 'hood', 'fridge', 'freezer', 'fridge-freezer', 'dishwasher', 'island', 'dining', 'chair',
    'sofa', 'armchair', 'table', 'tv', 'tv-stand', 'speakers', 'dresser', 'bookcase', 'vitrine', 'rug', 'floor-lamp', 'fireplace', 'piano',
    'bed', 'bunk', 'nightstand', 'wardrobe', 'vanity-table', 'desk',
    'laundry-sink', 'drying-rack', 'ironing', 'clean-cab',
    'coat', 'shoes', 'hall-bench', 'hall-cab',
    'office-chair', 'printer',
    'car', 'garage-bench', 'garage-shelf', 'tires',
    'stool', 'bin',
  ].forEach((id) => assert.ok(ids.has(id), id))
  const toilet = FURNITURE.find((item) => item.id === 'toilet')
  assert.ok(toilet.variants.some((item) => item.id === 'floor'))
  assert.ok(toilet.variants.some((item) => item.id === 'wall'))
  const shower = FURNITURE.find((item) => item.id === 'shower')
  ;['open', 'cabin', 'corner', 'walk', 'screen'].forEach((id) => assert.ok(shower.variants.some((item) => item.id === id), id))
  const bed = FURNITURE.find((item) => item.id === 'bed')
  ;['80', '90', '120', '140', '160', '180'].forEach((id) => assert.ok(bed.variants.some((item) => item.id === id)))
  const sofa = FURNITURE.find((item) => item.id === 'sofa')
  ;['2', '3', 'corner', 'divan'].forEach((id) => assert.ok(sofa.variants.some((item) => item.id === id)))
  assert.equal(FURNITURE.find((item) => item.id === 'cabinet').variants.find((item) => item.id === '600').w, 0.6)
  ;['wc', 'kylpyhuone', 'sauna', 'keittio', 'olohuone', 'makuuhuone', 'kodinhoitohuone', 'eteinen', 'tyohuone', 'autotalli'].forEach((kind) => {
    assert.ok(layoutFor(kind).length > 2, kind)
  })
})

test('water fixtures are cold-only or hot-and-cold, and appliances carry a rating', () => {
  const toilet = waterNeed({ type: 'toilet' })
  assert.equal(toilet.cold, true)
  assert.equal(toilet.hot, false)
  assert.equal(waterNeed({ type: 'sink' }).hot, true)
  assert.equal(waterNeed({ type: 'chair' }), null)
  const stove = resolveFixture({ type: 'stove', variant: 'induction' })
  assert.equal(stove.electric.voltage, 400)
  assert.equal(stove.electric.power, 7600)
  assert.equal(stove.electric.kind, 'stove')
  const heater = resolveFixture({ type: 'heater', variant: 'electric' })
  assert.equal(heater.electric.kind, 'heater')
  assert.equal(heater.electric.power, 9000)
  assert.equal(resolveFixture({ type: 'heater', variant: 'wood' }).electric, null)
})

test('placing a fixture creates the matching water, drain and power points', () => {
  let plan = emptyPlan('Pisteet')
  plan = { ...plan, walls: [], fixtures: [] }
  const toilet = { id: 'fix-wc', type: 'toilet', variant: 'floor', x: 1, z: 1, rotation: 0 }
  const stove = { id: 'fix-stove', type: 'stove', variant: 'induction', x: 3, z: 1, rotation: 0 }
  plan = syncFixtureServices({ ...plan, fixtures: [toilet, stove] })
  const nodes = plan.services.nodes
  const water = nodes.find((item) => item.linkedFrom === 'fix:fix-wc:water')
  assert.equal(water.kind, 'fixture')
  assert.equal(water.cold, true)
  assert.equal(water.hot, false)
  assert.ok(nodes.some((item) => item.linkedFrom === 'fix:fix-wc:drain' && item.kind === 'drain-point'))
  const electric = nodes.find((item) => item.linkedFrom === 'fix:fix-stove:electric')
  assert.equal(electric.kind, 'stove')
  assert.equal(electric.voltage, 400)
  assert.equal(electric.power, 7600)
})

test('a corner snap sits inside the corner and a mid-wall snap stays on that wall', () => {
  let plan = emptyPlan('Kulma')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 0, z: 3 }, 'exterior')
  const corner = snapFixture({ type: 'cabinet', x: 0.12, z: 0.12, d: 0.6, w: 0.6 }, plan.walls)
  assert.ok(corner.x > 0.25, corner.x)
  assert.ok(corner.z > 0.25, corner.z)
  const mid = snapFixture({ type: 'cabinet', x: 2, z: 0.15, d: 0.6, w: 0.6 }, plan.walls)
  assert.ok(Math.abs(mid.x - 2) < 0.05, mid.x)
  assert.ok(Math.abs(mid.z - 0.42) < 0.05, mid.z)
})

test('a typical bathroom layout stays inside the room', () => {
  const house = familyHouse()
  const bath = house.rooms.find((room) => room.name === 'Kylpyhuone')
  const next = furnishRoom(house, bath.id)
  const shower = next.fixtures.find((item) => item.type === 'shower')
  const toilet = next.fixtures.find((item) => item.type === 'toilet')
  assert.ok(shower && toilet)
  assert.equal(pointInPolygon(shower.x, shower.z, bath.polygon), true)
  assert.equal(pointInPolygon(toilet.x, toilet.z, bath.polygon), true)
  const kitchen = house.rooms.find((room) => room.name === 'Keittiö')
  const furnished = furnishRoom(house, kitchen.id)
  const stove = furnished.fixtures.find((item) => item.type === 'stove')
  const oven = furnished.fixtures.find((item) => item.type === 'oven')
  assert.ok(stove && oven)
  assert.ok(Math.hypot(stove.x - oven.x, stove.z - oven.z) > 0.4)
})

test('the example house still routes water without a hot pipe on the WC', () => {
  const plan = autoRoute(exampleHouse(), 'water')
  const toilet = exampleHouse().fixtures.find((item) => item.type === 'toilet')
  const hotNearToilet = plan.services.runs.filter((item) => item.kind === 'hot').some((item) => item.points.some((point) => Math.hypot(point.x - toilet.x, point.z - toilet.z) < 0.2))
  assert.equal(hotNearToilet, false)
  assert.ok(plan.services.nodes.some((item) => item.fixtureType === 'washer'))
})
