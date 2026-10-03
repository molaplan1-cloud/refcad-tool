import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addOpening,
  addWall,
  buildFloorPlanPdf,
  detectRooms,
  emptyPlan,
  exampleHouse,
  formatArea,
  materialsList,
  placeOpening,
  polygonArea,
  roofModel,
  snapDrawPoint,
  viewLayout,
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
