import assert from 'node:assert/strict'
import test from 'node:test'
import { addFixture, addWall, applyFixtureVariant, emptyPlan, exampleHouse, familyHouse, furnishRoom, pointInPolygon, setWallTvStand, snapFixture } from './floorplan.js'
import { FURNITURE, fixtureBounds, fixtureServiceSpecs, layoutFor, resolveFixture, scheduleRows, waterNeed } from './furniture.js'
import { syncFixtureServices } from './fixtureServices.js'
import { LOCALES, translate } from './i18n.js'
import { acceptEquipment, autoRoute } from './services.js'

const ids = new Set(FURNITURE.map((item) => item.id))

test('the catalog covers the rooms a Finnish house designer furnishes', () => {
  ;[
    'toilet', 'basin', 'vanity', 'mirror-cab', 'mirror', 'bidet', 'bidet-spray', 'paper', 'hooks', 'floor-drain', 'wc-store',
    'washer', 'dryer', 'laundry-stack', 'dry-cabinet', 'shower', 'bath', 'spa', 'soap', 'shower-bench', 'shower-rail', 'towel-rad', 'litter', 'hamper',
    'heater', 'bench', 'sauna-door', 'bucket', 'chimney',
    'cabinet', 'wall-cab', 'sink', 'stove', 'oven', 'microwave', 'hood', 'fridge', 'freezer', 'fridge-freezer', 'dishwasher', 'island', 'dining', 'chair', 'puuhella',
    'sofa', 'armchair', 'table', 'tv', 'wall-tv', 'tv-stand', 'speakers', 'dresser', 'bookcase', 'vitrine', 'rug', 'floor-lamp', 'fireplace', 'insert', 'kamiina', 'leivinuuni', 'kakluuni', 'piano',
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
  const mass = resolveFixture({ type: 'fireplace' })
  assert.equal(mass.name, 'Varaava takka')
  assert.equal(mass.storing, true)
  assert.equal(mass.heatKw, 4)
  const open = resolveFixture({ type: 'insert' })
  assert.equal(open.name, 'Avotakka / takkasydän')
  assert.equal(open.storing, false)
  assert.equal(open.heatKw, 7)
  assert.equal(open.symbol, 'insert')
  assert.equal(open.body, 'insert')
  assert.equal(open.flueKind, 'masonry')
  const steelStove = resolveFixture({ type: 'kamiina', heatKw: 5.5 })
  assert.equal(steelStove.name, 'Kamiina / takkauuni')
  assert.equal(steelStove.storing, false)
  assert.equal(steelStove.heatKw, 5.5)
  assert.equal(steelStove.symbol, 'kamiina')
  assert.equal(steelStove.body, 'kamiina')
  assert.equal(steelStove.flueKind, 'steel')
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

test('a wall-mounted TV uses real sizes, snaps to the wall face, and adds no socket or cable', () => {
  const tv = FURNITURE.find((item) => item.id === 'wall-tv')
  assert.equal(tv.wallMount, true)
  assert.equal(tv.mount, 1.2)
  assert.equal(tv.electric, null)
  assert.equal(resolveFixture({ type: 'tv' }).electric, null)
  const expected = {
    43: [970, 560, 60],
    50: [1120, 650, 65],
    55: [1230, 710, 60],
    65: [1450, 830, 60],
    75: [1670, 960, 65],
    85: [1900, 1090, 70],
  }
  Object.entries(expected).forEach(([id, [w, h, d]]) => {
    const size = tv.variants.find((item) => item.id === id)
    assert.equal(Math.round(size.w * 1000), w, id)
    assert.equal(Math.round(size.h * 1000), h, id)
    assert.equal(Math.round(size.d * 1000), d, id)
    assert.ok(size.standD > size.d)
  })
  LOCALES.forEach((locale) => {
    const label = translate(locale.id, 'furniture.wallTv')
    assert.notEqual(label, 'furniture.wallTv')
    assert.equal(translate(locale.id, 'furniture.wallTv.size', { n: 65 }), '65"')
    assert.notEqual(translate(locale.id, 'furniture.wallTv.stand'), 'furniture.wallTv.stand')
    assert.notEqual(translate(locale.id, 'furniture.wallTv.mount'), 'furniture.wallTv.mount')
  })

  let plan = emptyPlan('Taulu')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 6, z: 0 }, 'exterior')
  plan = addFixture(plan, 'wall-tv', 3, 2.4, 0.2)
  const placed = plan.fixtures.find((item) => item.type === 'wall-tv')
  assert.equal(placed.variant, '43')
  assert.equal(placed.mount, 1.2)
  assert.equal(placed.stand, false)
  assert.ok(Math.abs(placed.x - 3) < 0.05, placed.x)
  assert.ok(Math.abs(placed.z - 0.15) < 0.02, placed.z)
  assert.equal(Math.abs(placed.rotation), 0)
  assert.equal(fixtureServiceSpecs([placed]).some((item) => item.system === 'electric'), false)

  plan = applyFixtureVariant(plan, placed.id, '65')
  const sized = plan.fixtures.find((item) => item.id === placed.id)
  assert.equal(Math.round(sized.w * 1000), 1450)
  assert.equal(Math.round(sized.h * 1000), 830)
  assert.equal(sized.mount, 1.2)
  assert.equal(Math.round(sized.d * 1000), 60)

  plan = setWallTvStand(plan, placed.id, true)
  const stood = plan.fixtures.find((item) => item.id === placed.id)
  assert.equal(stood.stand, true)
  assert.equal(Math.round(stood.d * 1000), 400)
  assert.ok(stood.z > sized.z)
  assert.equal(stood.mount, Math.round((0.45 + 0.83 / 2) * 1000) / 1000)
  const synced = syncFixtureServices(plan)
  assert.equal(synced.services.nodes.filter((item) => item.system === 'electric').length, 0)
  assert.equal(synced.services.runs.length, 0)
  const plain = syncFixtureServices({ ...emptyPlan('Vanha'), fixtures: [{ id: 'fix-tv', type: 'tv', x: 1, z: 1 }] })
  assert.equal(plain.services.nodes.filter((item) => item.system === 'electric').length, 0)

  const row = scheduleRows(synced.fixtures, () => 'Olohuone').find((item) => item.nameKey === 'furniture.wallTv')
  assert.equal(row.name, 'Taulu-TV')
  assert.equal(row.inches, 65)
  assert.equal(row.stand, true)
  assert.equal(row.variantKey, 'furniture.wallTv.size')
  assert.equal(row.count, 1)
})

test('a 1500×300×300 TV stand occupies a 300 mm box on the floor', () => {
  const stand = fixtureBounds(resolveFixture({ type: 'tv-stand', w: 1.5, d: 0.3, h: 0.3 }))
  assert.equal(Math.round(stand.width * 1000), 1500)
  assert.equal(Math.round(stand.depth * 1000), 300)
  assert.equal(Math.round(stand.height * 1000), 300)
  assert.equal(stand.baseY, 0)
  assert.equal(Math.round(stand.centerY * 1000), 150)
  assert.equal(resolveFixture({ type: 'tv-stand', h: 0.3 }).h, 0.3)
  assert.equal(resolveFixture({ type: 'tv-stand' }).body, 'low')

  const shoes = fixtureBounds(resolveFixture({ type: 'shoes', h: 0.3 }))
  assert.equal(Math.round(shoes.height * 1000), 300)
  assert.equal(shoes.baseY, 0)
  const night = fixtureBounds(resolveFixture({ type: 'nightstand', h: 0.3 }))
  assert.equal(Math.round(night.height * 1000), 300)
  assert.equal(night.baseY, 0)
  const coffee = fixtureBounds(resolveFixture({ type: 'table' }))
  assert.equal(Math.round(coffee.height * 1000), 420)
  assert.equal(coffee.baseY, 0)
  const fridge = fixtureBounds(resolveFixture({ type: 'fridge', h: 1.2 }))
  assert.equal(Math.round(fridge.height * 1000), 1200)
  assert.equal(fridge.baseY, 0)
  const cabinet = fixtureBounds(resolveFixture({ type: 'cabinet', variant: '600' }))
  assert.equal(Math.round(cabinet.height * 1000), 900)
  assert.equal(cabinet.baseY, 0)
  const lifted = fixtureBounds({ body: 'low', w: 1.5, d: 0.3, h: 0.3, base: 0.1 })
  assert.equal(lifted.baseY, 0.1)
  assert.equal(Math.round(lifted.centerY * 1000), 250)
  assert.equal(Math.round(lifted.height * 1000), 300)
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
  const plan = autoRoute(acceptEquipment(exampleHouse(), 'water'), 'water')
  const toilet = exampleHouse().fixtures.find((item) => item.type === 'toilet')
  const hotNearToilet = plan.services.runs.filter((item) => item.kind === 'hot').some((item) => item.points.some((point) => Math.hypot(point.x - toilet.x, point.z - toilet.z) < 0.2))
  assert.equal(hotNearToilet, false)
  assert.ok(plan.services.nodes.some((item) => item.fixtureType === 'washer'))
})
