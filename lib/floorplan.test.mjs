import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addOpening,
  addWall,
  applyBrickBelowWoodAbove,
  buildElevationPdf,
  buildFloorPlanPdf,
  claddingAreas,
  facadeLayout,
  facadePaints,
  facadeSide,
  splitWallAt,
  contextMenuSpec,
  cornerCovered,
  detectRoomAt,
  detectRooms,
  dimensionRotation,
  drawRoom,
  emptyPlan,
  exampleHouse,
  familyHouse,
  formatArea,
  hitTest,
  materialsList,
  placeOpening,
  planBounds,
  polygonArea,
  segmentLength,
  dimensionChains,
  openingSymbol,
  roofModel,
  roofOutline,
  roomLabelPoint,
  snapDrawPoint,
  viewLayout,
  visibleRooms,
  snapFixture,
  wallPieces,
  wallSolids,
  wallThickness,
} from './floorplan.js'

test('a closed outline becomes one named room with inner area', () => {
  let plan = emptyPlan()
  const corners = [[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]
  for (let i = 0; i < corners.length - 1; i += 1) {
    plan = addWall(plan, { x: corners[i][0], z: corners[i][1] }, { x: corners[i + 1][0], z: corners[i + 1][1] }, 'exterior')
  }
  assert.equal(plan.rooms.length, 1)
  assert.equal(new Set(plan.walls.map((wall) => wall.id)).size, plan.walls.length)
  const innerW = 10 - wallThickness('exterior')
  const innerD = 8 - wallThickness('exterior')
  assert.ok(Math.abs(plan.rooms[0].area - innerW * innerD) < 0.05, plan.rooms[0].area)
  plan = { ...plan, rooms: plan.rooms.map((room) => ({ ...room, name: 'Olohuone' })) }
  const again = detectRooms(plan.walls, plan.rooms)
  assert.equal(again[0].name, 'Olohuone')
})

test('an interior wall splits the house and areas stay inside the shell', () => {
  const plan = exampleHouse()
  assert.equal(plan.rooms.length, 5)
  const names = plan.rooms.map((room) => room.name).sort()
  assert.deepEqual(names, ['Keittiö', 'Makuuhuone', 'Olohuone', 'Sauna', 'WC'])
  const total = plan.rooms.reduce((sum, room) => sum + room.area, 0)
  assert.ok(total < 12 * 9, 'room area includes the wall thickness')
  assert.ok(total > 90, total)
  const living = plan.rooms.find((room) => room.name === 'Olohuone')
  const kitchen = plan.rooms.find((room) => room.name === 'Keittiö')
  assert.ok(living.area > kitchen.area)
  assert.equal(formatArea(living.area).includes('m²'), true)
})

test('a door cuts an opening and stays on the wall', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  const wall = plan.walls[0]
  const placed = placeOpening(wall, { x: 2, z: 0.1 }, 'door')
  assert.equal(placed.kind, 'door')
  assert.ok(Math.abs(placed.offset - 2) < 0.05)
  plan = addOpening(plan, wall.id, { x: 2, z: 0 }, 'door')
  const parts = wallSolids(plan.walls[0], plan.openings)
  assert.equal(parts.cuts.length, 1)
  assert.equal(parts.solids.length, 2)
  assert.ok(parts.solids[0].to < placed.offset)
  assert.equal(addOpening(plan, wall.id, { x: 2, z: 0 }, 'door').openings.length, 1)
  const doorPieces = wallPieces(plan.walls[0], plan.openings)
  assert.ok(doorPieces.some((piece) => piece.y0 === 2.1))
  plan = addOpening(plan, wall.id, { x: 0.6, z: 0 }, 'window')
  const windowPieces = wallPieces(plan.walls[0], plan.openings)
  assert.ok(windowPieces.some((piece) => piece.y1 === 0.9))
})

test('drawing snaps to an endpoint and to the axis', () => {
  const walls = [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' }]
  const end = snapDrawPoint({ x: 4.12, z: 0.1 }, null, walls)
  assert.deepEqual(end, { x: 4, z: 0 })
  const axis = snapDrawPoint({ x: 0.12, z: 3.22 }, { x: 0, z: 0 }, [])
  assert.equal(axis.x, 0)
  assert.ok(axis.z > 3)
})

test('a fixture snaps onto the inner face of a wall', () => {
  const walls = [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'interior' }]
  const snapped = snapFixture({ id: 'f', type: 'sink', x: 1.5, z: 0.2, rotation: 0 }, walls)
  assert.ok(snapped.z > wallThickness('interior') / 2)
  assert.ok(Math.abs(snapped.rotation) % 180 === 0 || Math.abs(snapped.rotation) === 90 || Math.abs(snapped.rotation) === 0)
})

test('gable roof rises and a flat roof stays low', () => {
  const house = exampleHouse()
  const gable = roofModel(house)
  const flat = roofModel({ ...house, roofType: 'flat' })
  assert.equal(gable.type, 'gable')
  assert.ok(gable.rise > 1)
  assert.ok(flat.rise < 0.3)
  assert.equal(gable.wallHeight, 2.6)
  assert.ok(Math.abs(gable.overhang - (wallThickness('exterior') / 2 + 0.5)) < 0.001)
  const outline = roofOutline(gable)
  assert.equal(outline.length, 9)
  const ridge = outline[2]
  assert.ok(ridge.a[1] > gable.wallHeight)
  assert.ok(Math.abs(ridge.a[2] - (gable.minZ + gable.maxZ) / 2) < 0.001)
  assert.ok(Math.abs(outline[0].a[2] - (gable.minZ - gable.overhang)) < 0.001)
})

test('the materials list records room and shell finishes', () => {
  const house = exampleHouse()
  const rows = materialsList(house)
  const names = rows.map((row) => `${row.groupLabel}:${row.name}`)
  assert.ok(names.includes('Lattia:Parketti'))
  assert.ok(names.includes('Ulkoseinä:Puuverhous'))
  assert.ok(names.includes('Katto:Pelti'))
  assert.ok(names.includes('Sisäseinä:Tapetti'))
})

test('labels sit off the furniture and chains follow the walls', () => {
  const house = exampleHouse()
  const living = house.rooms.find((room) => room.name === 'Olohuone')
  const kitchen = house.rooms.find((room) => room.name === 'Keittiö')
  const table = house.fixtures.find((fixture) => fixture.type === 'table')
  const island = house.fixtures.find((fixture) => fixture.type === 'island')
  const livingLabel = roomLabelPoint(living, house.fixtures, house.openings, house.walls)
  const kitchenLabel = roomLabelPoint(kitchen, house.fixtures, house.openings, house.walls)
  assert.ok(Math.hypot(livingLabel.x - table.x, livingLabel.z - table.z) > 1.1, JSON.stringify(livingLabel))
  assert.ok(livingLabel.z > 1.1, JSON.stringify(livingLabel))
  assert.ok(Math.hypot(kitchenLabel.x - island.x, kitchenLabel.z - island.z) > 0.9, JSON.stringify(kitchenLabel))
  const dims = dimensionChains(house)
  const bench = house.fixtures.find((fixture) => fixture.type === 'bench')
  const saunaWidth = dims.rooms.find((dim) => dim.label === '4000' && Math.abs(dim.z1 - dim.z2) < 0.01)
  assert.ok(Math.abs(saunaWidth.z1 - bench.z) > 0.45, JSON.stringify(saunaWidth))
  const kitchenWidth = dims.rooms.find((dim) => dim.label === '5000' && dim.x1 > 6 && Math.abs(dim.z1 - dim.z2) < 0.01)
  assert.ok(Math.abs(kitchenWidth.z1 - island.z) > 0.5, JSON.stringify(kitchenWidth))
  const front = dims.chains.filter((dim) => dim.nz < 0).map((dim) => dim.label).sort()
  assert.deepEqual(front, ['5000', '7000'])
  assert.ok(dims.overall.some((dim) => dim.label === '12000'))
  assert.ok(dims.overall.some((dim) => dim.label === '9000'))
  assert.ok(dims.rooms.some((dim) => dim.label === '7000'))
  const wall = house.walls.find((item) => item.a.z === 0 && item.b.z === 0)
  const window = house.openings.find((item) => item.wallId === wall.id && item.kind === 'window')
  const symbol = openingSymbol(wall, window)
  assert.equal(symbol.glass.length, 3)
  const door = house.openings.find((item) => item.kind === 'door')
  const doorWall = house.walls.find((item) => item.id === door.wallId)
  const leaf = openingSymbol(doorWall, door)
  assert.ok(leaf.arc.length > 8)
  assert.ok(Math.hypot(leaf.leaf.x - leaf.hinge.x, leaf.leaf.z - leaf.hinge.z) > 0.7)
})

test('the editor frame pads the sheet without stretching the dimensions', () => {
  const house = exampleHouse()
  const view = viewLayout(house)
  assert.equal(view.worldW, 12)
  assert.equal(view.worldH, 9)
  assert.equal(view.building.maxX - view.building.minX, 12)
  assert.ok(view.box.maxX - view.box.minX > 12)
})

test('the floor-plan sheet is an A3 drawing with the room name', () => {
  const house = exampleHouse()
  const doc = buildFloorPlanPdf(house)
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 420) < 0.01)
  const raw = doc.output()
  assert.ok(raw.includes('Olohuone'))
  assert.ok(raw.includes('Pohjakuva'))
  assert.ok(raw.includes('A3'))
  const a4 = buildFloorPlanPdf({ ...house, paper: 'a4' })
  assert.ok(Math.abs(a4.internal.pageSize.getWidth() - 297) < 0.01)
  assert.ok(polygonArea(house.rooms[0].polygon) > 1)
})

test('context menus cover every floor-plan object', () => {
  assert.deepEqual(contextMenuSpec('wall'), ['thickness', 'type', 'height', 'material', 'length', 'split', 'facade', 'door', 'window', 'delete'])
  assert.ok(contextMenuSpec('opening').includes('sill'))
  assert.ok(contextMenuSpec('opening').includes('flip'))
  assert.ok(contextMenuSpec('room').includes('type'))
  assert.ok(contextMenuSpec('room').includes('showArea'))
  assert.ok(contextMenuSpec('fixture').includes('mirror'))
  assert.deepEqual(contextMenuSpec('canvas'), ['paste', 'wall', 'room', 'house'])
  assert.equal(dimensionRotation(true), 90)
  assert.equal(dimensionRotation(false), 0)
})

test('drawing a room inside the shell adds a partition and a named area', () => {
  let plan = emptyPlan()
  const corners = [[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]
  for (let i = 0; i < corners.length - 1; i += 1) {
    plan = addWall(plan, { x: corners[i][0], z: corners[i][1] }, { x: corners[i + 1][0], z: corners[i + 1][1] }, 'exterior')
  }
  assert.equal(plan.rooms.length, 1)
  assert.equal(cornerCovered(plan), true)
  const before = plan.walls.length
  plan = drawRoom(plan, [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 8 },
    { x: 0, z: 8 },
  ], { name: 'Eteinen', type: 'eteinen' })
  assert.ok(plan.walls.length > before)
  const named = visibleRooms(plan).find((room) => room.name === 'Eteinen')
  assert.ok(named)
  assert.ok(named.area > 10)
  const total = visibleRooms(plan).reduce((sum, room) => sum + room.area, 0)
  assert.ok(total > 50)
  assert.equal(visibleRooms(plan).length >= 2, true)
  const hit = hitTest(plan, { x: 1, z: 2 })
  assert.equal(hit.kind === 'room' || hit.kind === 'wall', true)
  const wallHit = hitTest(plan, { x: 5, z: 0 })
  assert.equal(wallHit.kind, 'wall')
  const detected = detectRoomAt(plan, { x: 7, z: 4 })
  assert.equal(visibleRooms(detected).some((room) => pointInside(room, 7, 4)), true)
})

function pointInside(room, x, z) {
  const points = room.polygon || []
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const hit = ((points[i].z > z) !== (points[j].z > z))
      && (x < ((points[j].x - points[i].x) * (z - points[i].z)) / ((points[j].z - points[i].z) || 1e-9) + points[i].x)
    if (hit) inside = !inside
  }
  return inside
}

test('a family house has named rooms and a standard scale', () => {
  const plan = familyHouse()
  const names = visibleRooms(plan).map((room) => room.name)
  ;['Eteinen', 'Olohuone', 'Keittiö', 'Kylpyhuone', 'Sauna'].forEach((name) => {
    assert.equal(names.includes(name), true, name)
  })
  assert.equal(names.filter((name) => name === 'Makuuhuone').length, 2)
  visibleRooms(plan).forEach((room) => assert.ok(room.area > 1, room.name))
  const total = visibleRooms(plan).reduce((sum, room) => sum + room.area, 0)
  assert.ok(total > 70, total)
  const view = viewLayout(plan)
  assert.ok(view.ratio === 50 || view.ratio === 100, view.ratio)
  assert.equal(view.scale, 1000 / view.ratio)
  assert.notEqual(view.ratio, 61)
  const forced = viewLayout({ ...plan, drawingScale: 50 })
  assert.equal(forced.ratio, 50)
  assert.equal(forced.scale, 20)
})

test('a facade splits brick below the openings from wood above them', () => {
  let plan = emptyPlan()
  const corners = [[0, 0], [10, 0], [10, 6], [0, 6], [0, 0]]
  for (let i = 0; i < corners.length - 1; i += 1) {
    plan = addWall(plan, { x: corners[i][0], z: corners[i][1] }, { x: corners[i + 1][0], z: corners[i + 1][1] }, 'exterior')
  }
  const north = plan.walls.find((wall) => facadeSide(wall, { minX: 0, maxX: 10, minZ: 0, maxZ: 6 }) === 'north')
  assert.ok(north)
  plan = splitWallAt(plan, north.id, 4)
  const parts = plan.walls.filter((wall) => facadeSide(wall, planBounds(plan)) === 'north')
  assert.equal(parts.length, 2)
  const lengths = parts.map((wall) => segmentLength(wall.a, wall.b)).sort((a, b) => a - b)
  assert.ok(Math.abs(lengths[0] - 4) < 0.05, lengths[0])
  assert.ok(Math.abs(lengths[1] - 6) < 0.05, lengths[1])
  const host = plan.walls.find((wall) => facadeSide(wall, planBounds(plan)) === 'north' && segmentLength(wall.a, wall.b) > 5)
  plan = addOpening(plan, host.id, { x: (host.a.x + host.b.x) / 2, z: 0 }, 'window')
  plan = addOpening(plan, plan.walls.find((wall) => facadeSide(wall, planBounds(plan)) === 'north' && segmentLength(wall.a, wall.b) < 5).id, { x: 2, z: 0 }, 'door')
  plan = applyBrickBelowWoodAbove(plan, 'north')
  const layout = facadeLayout(plan, 'north')
  assert.ok(layout.openings.some((opening) => opening.kind === 'door'))
  assert.ok(layout.openings.some((opening) => opening.kind === 'window'))
  const paints = facadePaints(plan, 'north')
  const areaOf = (id) => paints.filter((piece) => piece.materialId === id).reduce((sum, piece) => sum + (piece.u1 - piece.u0) * (piece.y1 - piece.y0), 0)
  const wood = areaOf('wood-horizontal')
  const brick = areaOf('brick-red')
  assert.ok(wood > 4.5 && wood < 5.5, wood)
  assert.ok(Math.abs(brick - (10 * 2.1 - 0.9 * 2.1 - 1.2 * 1.2)) < 0.15, brick)
  const listed = claddingAreas(plan)
  assert.ok(listed.some((row) => row.id === 'brick-red' && row.area > 10))
  assert.ok(listed.some((row) => row.id === 'wood-horizontal' && row.area > wood - 0.1))
  const doc = buildElevationPdf(plan, 'north')
  const raw = doc.output()
  assert.ok(raw.includes('Julkisivu'))
  assert.ok(raw.includes('Pohjoinen'))
  assert.ok(raw.includes('Punatiili'))
})
