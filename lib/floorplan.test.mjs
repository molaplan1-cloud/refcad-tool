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
  facadeCells,
  mergedFacadeSkins,
  facadeFlashings,
  addFacadeSplit,
  assignFacadeCell,
  splitWallAt,
  updateWall,
  contextMenuSpec,
  cornerAngles,
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
  doorLeafPose,
  doorSchedule,
  doorStyleOf,
  roofModel,
  roofOutline,
  roomLabelPoint,
  setCornerAngle,
  setWallDirection,
  straightenWalls,
  dedupeDimensions,
  snapDrawPoint,
  viewLayout,
  wallDirection,
  wallQuads,
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

test('an enclosed room subtracts from its parent and stays off the facade', () => {
  const house = exampleHouse()
  const before = materialsList(house)
  const livingBefore = house.rooms.find((room) => room.name === 'Olohuone').area
  const exteriorBefore = before.find((row) => row.group === 'exterior').area
  const facadeBefore = before.filter((row) => row.group === 'facade').reduce((sum, row) => sum + row.area, 0)
  let plan = house
  const box = [[1.5, 1.2], [3.5, 1.2], [3.5, 3.2], [1.5, 3.2]]
  for (let i = 0; i < box.length; i += 1) {
    const a = box[i]
    const b = box[(i + 1) % box.length]
    plan = addWall(plan, { x: a[0], z: a[1] }, { x: b[0], z: b[1] }, 'exterior')
  }
  const living = plan.rooms.find((room) => room.name === 'Olohuone')
  const inner = plan.rooms.find((room) => room !== living && room.cx > 1.4 && room.cx < 3.6 && room.cz > 1.1 && room.cz < 3.3)
  assert.ok(inner, plan.rooms.map((room) => `${room.name}:${room.area.toFixed(2)}`).join(', '))
  assert.ok(inner.area > 2 && inner.area < 5, inner.area)
  assert.ok(living.area < livingBefore - inner.area + 0.4, `${living.area} vs ${livingBefore}`)
  assert.ok(living.area > livingBefore - inner.area - 1.2, `${living.area} vs ${livingBefore}`)
  const listed = materialsList(plan)
  const livingFloor = listed.find((row) => row.group === 'floor' && row.roomName === 'Olohuone')
  assert.ok(livingFloor.area < livingBefore - 1, livingFloor.area)
  const exteriorAfter = listed.find((row) => row.group === 'exterior').area
  const facadeAfter = listed.filter((row) => row.group === 'facade').reduce((sum, row) => sum + row.area, 0)
  assert.ok(exteriorAfter <= exteriorBefore + 0.05, `${exteriorAfter} > ${exteriorBefore}`)
  assert.ok(facadeAfter <= facadeBefore + 0.05, `${facadeAfter} > ${facadeBefore}`)
  const innerWalls = plan.walls.filter((wall) => {
    const mx = (wall.a.x + wall.b.x) / 2
    const mz = (wall.a.z + wall.b.z) / 2
    return mx > 1.3 && mx < 3.7 && mz > 1 && mz < 3.4 && segmentLength(wall.a, wall.b) < 2.4
  })
  assert.ok(innerWalls.length >= 4, String(innerWalls.length))
  assert.ok(innerWalls.every((wall) => wall.kind === 'interior'))
})

test('an Ulkoseinä drawn inside the building becomes a väliseinä', () => {
  const house = exampleHouse()
  const plan = addWall(house, { x: 2, z: 1 }, { x: 2, z: 4 }, 'exterior')
  const wall = plan.walls.find((item) => Math.abs(item.a.x - 2) < 0.02 && Math.abs(item.b.x - 2) < 0.02 && Math.min(item.a.z, item.b.z) < 1.2 && Math.max(item.a.z, item.b.z) > 3.5)
  assert.ok(wall)
  assert.equal(wall.kind, 'interior')
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

test('a new door keeps the chosen hand and opening direction', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  const wall = plan.walls[0]
  const walls = JSON.stringify(plan.walls)
  plan = addOpening(plan, wall.id, { x: 2, z: 0 }, 'door', { swing: -1, inward: true })
  const door = plan.openings[0]
  assert.equal(door.swing, -1)
  assert.equal(door.inward, true)
  assert.equal(door.wallId, wall.id)
  assert.ok(Math.abs(door.offset - 2) < 0.05)
  assert.equal(JSON.stringify(plan.walls), walls)
  const right = openingSymbol(plan.walls[0], door, plan)
  const left = openingSymbol(plan.walls[0], { ...door, swing: 1, inward: false }, plan)
  assert.ok(Math.hypot(right.hinge.x - left.hinge.x, right.hinge.z - left.hinge.z) > 0.4)
  assert.ok(Math.hypot(right.leaf.x - left.leaf.x, right.leaf.z - left.leaf.z) > 0.2)
  const openOut = doorLeafPose(door, 1)
  const openIn = doorLeafPose({ ...door, inward: false }, 1)
  const otherHand = doorLeafPose({ ...door, swing: 1 }, 1)
  assert.ok(openOut.hingeX > 0)
  assert.ok(otherHand.hingeX < 0)
  assert.ok(openOut.rotY * openIn.rotY < 0)
  assert.equal(door.doorStyle, 'hinged')
  assert.equal(doorStyleOf(door), 'hinged')
})

test('each door type keeps a plan symbol and a schedule row', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 18, z: 0 }, 'exterior')
  const wall = plan.walls[0]
  const specs = [
    { doorStyle: 'hinged', swing: 1, inward: true },
    { doorStyle: 'sliding', slideMount: 'pocket', panels: 1, swing: 1 },
    { doorStyle: 'sliding', slideMount: 'surface', panels: 2, swing: -1, inward: true },
    { doorStyle: 'patio', swing: 1 },
    { doorStyle: 'double', swing: -1, inward: true },
    { doorStyle: 'glass', swing: 1, inward: false },
    { doorStyle: 'folding', swing: -1, inward: true },
  ]
  specs.forEach((spec, index) => {
    plan = addOpening(plan, wall.id, { x: 1.4 + index * 2.3, z: 0 }, 'door', spec)
  })
  assert.equal(plan.openings.length, specs.length)
  const rows = doorSchedule(plan)
  assert.deepEqual(rows.map((row) => row.style), specs.map((spec) => spec.doorStyle))
  assert.deepEqual(rows.map((row) => row.nameKey), [
    'opening.door', 'opening.sliding', 'opening.sliding', 'opening.patio', 'opening.double', 'opening.glass', 'opening.folding',
  ])
  assert.equal(rows[1].mount, 'pocket')
  assert.equal(rows[1].panels, 1)
  assert.equal(rows[1].handed, false)
  assert.equal(rows[2].mount, 'surface')
  assert.equal(rows[2].panels, 2)
  assert.equal(rows[3].panels, 2)
  assert.equal(rows[3].mount, null)
  assert.equal(rows[0].handed, true)
  assert.equal(rows[4].handed, true)
  assert.equal(rows[4].swing, -1)
  assert.equal(rows[4].inward, true)
  assert.equal(rows[5].handed, true)
  assert.equal(rows[6].handed, true)
  assert.equal(rows[6].panels, 4)
  assert.equal(plan.openings[1].width, 1.2)
  assert.equal(plan.openings[2].width, 1.8)
  assert.equal(plan.openings[3].width, 1.8)
  assert.equal(plan.openings[4].width, 1.6)
  assert.equal(plan.openings[6].width, 1.6)

  const symbol = (opening) => openingSymbol(wall, opening, plan)
  const hinged = symbol(plan.openings[0])
  assert.equal(hinged.arcs.length, 1)
  assert.equal(hinged.glass.length, 0)
  assert.equal(hinged.rails.length, 0)
  const pocket = symbol(plan.openings[1])
  const surface = symbol(plan.openings[2])
  assert.equal(pocket.rails.length, 1)
  assert.equal(pocket.rails[0].dashed, true)
  assert.equal(pocket.arrows.length, 1)
  assert.ok(pocket.arrows[0].to.x > pocket.arrows[0].from.x)
  assert.ok(pocket.rails[0].b.x > plan.openings[1].offset)
  const reversed = symbol({ ...plan.openings[1], swing: -1 })
  assert.ok(reversed.arrows[0].to.x < reversed.arrows[0].from.x)
  assert.equal(surface.mount, 'surface')
  assert.equal(surface.panels, 2)
  assert.equal(surface.rails.length, 2)
  assert.ok(surface.rails.every((rail) => !rail.dashed))
  assert.ok(Math.abs(surface.rails[0].a.z) > 0.08)
  const patio = symbol(plan.openings[3])
  assert.equal(patio.glass.length, 3)
  assert.equal(patio.rails.length, 1)
  assert.equal(patio.arrows.length, 1)
  assert.equal(patio.rails[0].dashed, false)
  const pair = symbol(plan.openings[4])
  assert.equal(pair.arcs.length, 2)
  assert.equal(pair.leaves.length, 2)
  assert.ok(pair.leaves[0].a.x < pair.leaves[1].a.x)
  assert.ok(Math.hypot(pair.leaves[0].a.x - pair.leaves[0].b.x, pair.leaves[0].a.z - pair.leaves[0].b.z) > 0.4)
  const glass = symbol(plan.openings[5])
  assert.equal(glass.style, 'glass')
  assert.equal(glass.glass.length, 3)
  assert.equal(glass.arcs.length, 1)
  const pose = doorLeafPose(plan.openings[5], 1)
  assert.ok(pose.hingeX < 0)
  const fold = symbol(plan.openings[6])
  assert.equal(fold.fold.length, 5)
  assert.equal(fold.arrows.length, 1)
  assert.ok(fold.arrows[0].to.x > fold.arrows[0].from.x)
})

test('drawing snaps to an endpoint and to the axis', () => {
  const walls = [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' }]
  const end = snapDrawPoint({ x: 4.12, z: 0.1 }, null, walls)
  assert.deepEqual(end, { x: 4, z: 0 })
  const axis = snapDrawPoint({ x: 0.12, z: 3.22 }, { x: 0, z: 0 }, [])
  assert.equal(axis.x, 0)
  assert.ok(axis.z > 3)
})

test('a wall that lands on another wall splits a T-join', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 2, z: 0 }, { x: 2, z: 3 }, 'interior')
  const along = plan.walls.filter((wall) => Math.abs(wall.a.z) < 0.01 && Math.abs(wall.b.z) < 0.01)
  assert.equal(along.length, 2)
  assert.ok(along.every((wall) => Math.abs(Math.min(wall.a.x, wall.b.x) - 0) < 0.02 || Math.abs(Math.min(wall.a.x, wall.b.x) - 2) < 0.02))
  assert.equal(plan.walls.filter((wall) => wall.a.x === 2 && wall.b.x === 2).length, 1)
})

test('an angled corner keeps its degree, mitre and room area', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 3 }, { x: 0, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 0, z: 3 }, { x: 0, z: 0 }, 'exterior')
  plan = setCornerAngle(plan, { x: 4, z: 0 }, 60)
  const mark = cornerAngles(plan.walls).find((item) => Math.hypot(item.x - 4, item.z) < 0.05)
  assert.ok(mark)
  assert.ok(Math.abs(mark.degrees - 60) < 2)
  assert.equal(plan.rooms.length, 1)
  assert.ok(plan.rooms[0].area > 1)
  const quad = wallQuads(plan.walls[0], [], plan.walls, plan)[0]
  assert.equal(quad.length, 4)
  assert.equal(quad.some((point) => Math.hypot(point.x, point.z) > 0.05), true)
  const total = claddingAreas(plan).reduce((sum, row) => sum + row.area, 0)
  assert.ok(total > 20)
  const target = plan.walls.find((wall) => wall.a.x === 4 && wall.a.z === 0)
  plan = setWallDirection(plan, target.id, 30)
  const turned = plan.walls.find((wall) => wall.id === target.id)
  assert.equal(wallDirection(turned), 30)
  assert.ok(plan.walls.some((wall) => wall.id !== turned.id && (Math.hypot(wall.a.x - turned.b.x, wall.a.z - turned.b.z) < 0.02 || Math.hypot(wall.b.x - turned.b.x, wall.b.z - turned.b.z) < 0.02)))
})

test('a corner edit keeps the other corners and a free wall keeps its length', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 3 }, { x: 0, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 0, z: 3 }, { x: 0, z: 0 }, 'exterior')
  plan = setCornerAngle(plan, { x: 4, z: 0 }, 60)
  ;[{ x: 4, z: 3 }, { x: 0, z: 3 }].forEach((point) => {
    const still = plan.walls.some((wall) => [wall.a, wall.b].some((end) => Math.hypot(end.x - point.x, end.z - point.z) < 0.02))
    assert.equal(still, true, JSON.stringify(point))
  })
  const slid = plan.walls.flatMap((wall) => [wall.a, wall.b]).filter((end) => Math.abs(end.x) < 0.02 && end.z > 0.3 && end.z < 2.8)
  assert.ok(slid.length >= 1, JSON.stringify(slid))
  assert.equal(cornerAngles(plan.walls).filter((mark) => Math.hypot(mark.x - mark.x, 0) < 1 && Math.hypot(mark.x - 4, mark.z) < 0.08).length, 1)

  let open = emptyPlan()
  open = addWall(open, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  open = addWall(open, { x: 0, z: 0 }, { x: 0, z: 3 }, 'exterior')
  open = setCornerAngle(open, { x: 0, z: 0 }, 60)
  const turned = open.walls.find((wall) => [wall.a, wall.b].some((end) => Math.hypot(end.x - 1.5, end.z - 2.598) < 0.08))
  assert.ok(turned)
  assert.ok(Math.abs(segmentLength(turned.a, turned.b) - 3) < 0.03)
  const fixed = open.walls.some((wall) => [wall.a, wall.b].some((end) => Math.hypot(end.x - 4, end.z) < 0.02))
  assert.equal(fixed, true)
})

test('right angles stay hidden and a corner has one label', () => {
  const square = [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 4, z: 0 } },
    { id: 'b', a: { x: 4, z: 0 }, b: { x: 4, z: 3 } },
    { id: 'c', a: { x: 4, z: 3 }, b: { x: 0, z: 3 } },
    { id: 'd', a: { x: 0, z: 3 }, b: { x: 0, z: 0 } },
  ]
  assert.equal(cornerAngles(square).length, 0)
  const skew = [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 4, z: 0 } },
    { id: 'b', a: { x: 0, z: 0 }, b: { x: 0.45, z: 3 } },
    { id: 'c', a: { x: 0, z: 0 }, b: { x: -2.2, z: 0.4 } },
  ]
  const marks = cornerAngles(skew)
  assert.equal(marks.length, 1)
  assert.notEqual(marks[0].degrees, 90)
})

test('straighten repairs a near-axis wall and leaves a real diagonal', () => {
  let plan = emptyPlan()
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0.06 }, 'exterior')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 2, z: 2 }, 'exterior')
  const before = plan.walls.find((wall) => wall.b.x > 3)
  assert.ok(Math.abs(before.a.z - before.b.z) > 0.02)
  plan = straightenWalls(plan, 2)
  const flat = plan.walls.find((wall) => wall.b.x > 3)
  assert.equal(flat.a.z, flat.b.z)
  assert.equal(wallDirection(flat) % 90, 0)
  const diagonal = plan.walls.find((wall) => Math.abs(wall.b.x - wall.a.x) > 1 && Math.abs(wall.b.z - wall.a.z) > 1)
  assert.ok(Math.abs((wallDirection(diagonal) % 90) - 45) < 3 || Math.abs(wallDirection(diagonal) - 45) < 3)
  assert.equal(straightenWalls(plan, 2), plan)
})

test('duplicate dimension labels on the same run collapse', () => {
  const dims = [
    { x1: 0, z1: 0, x2: 4, z2: 0, label: '4000', nx: 0, nz: -1, offset: 0.4 },
    { x1: 0, z1: 0, x2: 4, z2: 0, label: '4000', nx: 0, nz: -1, offset: 0.55 },
    { x1: 4, z1: 0, x2: 4, z2: 3, label: '3000', nx: 1, nz: 0, offset: 0.4 },
  ]
  const kept = dedupeDimensions(dims, 0.35)
  assert.equal(kept.length, 2)
  assert.ok(kept.some((dim) => dim.label === '3000'))
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
  const window = house.openings.find((item) => item.kind === 'window' && house.walls.some((wall) => wall.id === item.wallId && wall.a.z === 0 && wall.b.z === 0))
  const wall = house.walls.find((item) => item.id === window.wallId)
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
  assert.deepEqual(contextMenuSpec('wall'), ['thickness', 'align', 'type', 'height', 'material', 'length', 'angle', 'split', 'facade', 'door', 'window', 'delete'])
  assert.ok(contextMenuSpec('opening').includes('sill'))
  assert.ok(contextMenuSpec('opening').includes('hand'))
  assert.ok(contextMenuSpec('opening').includes('leaf'))
  assert.ok(contextMenuSpec('room').includes('type'))
  assert.ok(contextMenuSpec('room').includes('showArea'))
  assert.ok(contextMenuSpec('fixture').includes('mirror'))
  assert.deepEqual(contextMenuSpec('canvas'), ['paste', 'wall', 'room', 'house'])
  assert.equal(dimensionRotation(true), 90)
  assert.equal(dimensionRotation(false), 0)
})

test('a split wall and an interior join do not seam the facade', () => {
  let plan = emptyPlan()
  const corners = [[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]]
  for (let i = 0; i < corners.length - 1; i += 1) {
    plan = addWall(plan, { x: corners[i][0], z: corners[i][1] }, { x: corners[i + 1][0], z: corners[i + 1][1] }, 'exterior')
  }
  const south = plan.walls.find((wall) => facadeSide(wall, planBounds(plan)) === 'north')
  plan = splitWallAt(plan, south.id, 3)
  plan = addWall(plan, { x: 3, z: 0 }, { x: 3, z: 4 }, 'interior')
  plan = applyBrickBelowWoodAbove(plan, 'north', 'brick-yellow')
  const southSkins = mergedFacadeSkins(plan).filter((skin) => skin.side === 'north')
  const brick = southSkins.filter((skin) => skin.materialId === 'brick-yellow')
  const wood = southSkins.filter((skin) => skin.materialId === 'wood-horizontal')
  assert.equal(brick.length, 1)
  assert.ok(Math.abs((brick[0].u1 - brick[0].u0) - 8) < 0.15, brick[0].u1 - brick[0].u0)
  assert.equal(wood.length, 1)
  assert.ok(wood[0].y0 > brick[0].y1 - 0.05)
  const flash = facadeFlashings(plan).filter((joint) => joint.side === 'north')
  assert.equal(flash.length, 1)
  assert.equal(flash[0].below, 'brick-yellow')
  assert.equal(flash[0].above, 'wood-horizontal')
  assert.ok(flash[0].u1 - flash[0].u0 > 7)
  const interior = plan.walls.find((wall) => wall.kind === 'interior')
  const pieces = wallPieces(interior, [], plan.floorHeight, plan.walls, plan)
  assert.ok(pieces[0].from > 0.1, pieces[0].from)
  const cells = facadeCells(plan, 'north')
  const aboveWindow = cells.find((cell) => cell.materialId === 'wood-horizontal')
  const painted = assignFacadeCell(plan, aboveWindow, { materialId: 'wood-vertical' })
  assert.ok(facadeCells(painted, 'north').some((cell) => cell.materialId === 'wood-vertical' && cell.u0 === aboveWindow.u0))
  const split = addFacadeSplit(plan, 'north', 'h', 1.4)
  assert.equal(split.facadeSplits.length, 1)
  assert.ok(facadeCells(split, 'north').some((cell) => Math.abs(cell.y1 - 1.4) < 0.02 || Math.abs(cell.y0 - 1.4) < 0.02))
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
  const sheetX = (x) => forced.ox + (x - forced.box.minX) * forced.scale
  const sheetY = (z) => forced.oy + (z - forced.box.minZ) * forced.scale
  const building = forced.building
  ;[[building.maxX, building.maxZ], [building.maxX, building.minZ], [building.minX, building.maxZ]].forEach(([x, z]) => {
    const sx = sheetX(x)
    const sy = sheetY(z)
    const covered = sx >= forced.title.x - 1 && sx <= forced.title.x + forced.title.w && sy >= forced.title.y - 1 && sy <= forced.title.y + forced.title.h
    assert.equal(covered, false, `${sx},${sy}`)
  })
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
  const skins = mergedFacadeSkins(plan).filter((skin) => skin.side === 'north' && skin.materialId === 'brick-red')
  const brickSpan = skins.reduce((sum, skin) => sum + (skin.u1 - skin.u0), 0)
  assert.ok(skins.length === 1 || brickSpan > 9, JSON.stringify(skins.map((skin) => [skin.u0, skin.u1, skin.y0, skin.y1])))
  const cells = facadeCells(plan, 'north')
  const above = cells.find((cell) => cell.materialId === 'wood-horizontal' && cell.y0 >= 2)
  assert.ok(above, 'area above the openings is its own zone')
  assert.ok(above.u1 - above.u0 < 9.5, 'the cell above one opening is not the whole wall')
  const doc = buildElevationPdf(plan, 'north')
  const raw = doc.output()
  assert.ok(raw.includes('Julkisivu'))
  assert.ok(raw.includes('Pohjoinen'))
  assert.ok(raw.includes('Punatiili'))
})

test('changing a partition thickness keeps the nodes and the door axis-aligned', () => {
  let plan = emptyPlan('Väliseinä')
  for (const [a, b] of [[[0, 0], [8, 0]], [[8, 0], [8, 6]], [[8, 6], [0, 6]], [[0, 6], [0, 0]]]) {
    plan = addWall(plan, { x: a[0], z: a[1] }, { x: b[0], z: b[1] }, 'exterior')
  }
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 6 }, 'interior')
  const part = plan.walls.find((wall) => wall.kind === 'interior')
  plan = splitWallAt(plan, part.id, 2.6)
  const parts = plan.walls.filter((wall) => wall.kind === 'interior')
  const upper = parts.find((wall) => Math.min(wall.a.z, wall.b.z) < 0.2)
  const lower = parts.find((wall) => wall.id !== upper.id)
  plan = addOpening(plan, lower.id, { x: 4, z: 3.15 }, 'door')
  const before = plan.walls.map((wall) => ({ id: wall.id, a: { ...wall.a }, b: { ...wall.b } }))
  plan = updateWall(plan, upper.id, { thickness: 0.24, thicknessCustom: true })
  plan = updateWall(plan, lower.id, { thickness: 0.09, thicknessCustom: true })
  before.forEach((wall) => {
    const now = plan.walls.find((item) => item.id === wall.id)
    assert.deepEqual(now.a, wall.a)
    assert.deepEqual(now.b, wall.b)
  })
  const host = plan.walls.find((wall) => wall.id === lower.id)
  const door = plan.openings.find((opening) => opening.wallId === host.id)
  const symbol = openingSymbol(host, door, plan)
  assert.ok(Math.abs(symbol.jambA[0].z - symbol.jambA[1].z) < 1e-6)
  assert.ok(Math.abs(symbol.jambB[0].z - symbol.jambB[1].z) < 1e-6)
  assert.ok(Math.abs(Math.abs(symbol.jambA[0].x - symbol.jambA[1].x) - host.thickness) < 1e-6)
  const diagonal = (plan.rooms || []).some((room) => (room.polygon || []).some((point, index, poly) => {
    const next = poly[(index + 1) % poly.length]
    return Math.abs(next.x - point.x) > 0.004 && Math.abs(next.z - point.z) > 0.004
  }))
  assert.equal(diagonal, false)
  plan = updateWall(plan, upper.id, { thickness: 0.3, thicknessCustom: true, align: 'left' })
  const grown = plan.walls.find((wall) => wall.id === upper.id)
  const saved = before.find((wall) => wall.id === upper.id)
  assert.deepEqual(grown.a, saved.a)
  assert.deepEqual(grown.b, saved.b)
  assert.equal(grown.align, 'left')
  const onReference = (plan.rooms || []).some((room) => (room.polygon || []).some((point) => (
    Math.abs(point.x - 4) < 0.002 && point.z > 0.05 && point.z < 2.7
  )))
  assert.equal(onReference, true)
})
