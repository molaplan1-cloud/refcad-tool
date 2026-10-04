import test from 'node:test'
import assert from 'node:assert/strict'
import { addOpening, addWall, emptyPlan } from './floorplan.js'
import { commitRunGeometry, ensureServices } from './services.js'
import {
  applyDesigner,
  applyOp,
  arraySelection,
  copySelection,
  designerHits,
  expandGroups,
  groupSelection,
  mergeSelection,
  offsetSelection,
  pasteFloorClipboard,
  floorClipboard,
  runCommand,
  selectionBox,
  targetsByType,
  targetsInBox,
} from './cadEdit.js'

function twoWalls() {
  let plan = emptyPlan('test')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 3 }, 'exterior')
  return plan
}

test('window selection keeps a touched wall out and crossing takes it', () => {
  const plan = twoWalls()
  const horizontal = plan.walls[0]
  const vertical = plan.walls[1]
  const windowBox = selectionBox({ x: -0.2, z: -0.3 }, { x: 4.2, z: 0.3 })
  const crossingBox = selectionBox({ x: 4.2, z: -0.3 }, { x: -0.2, z: 0.3 })
  assert.equal(windowBox.mode, 'window')
  assert.equal(crossingBox.mode, 'crossing')
  const windowHits = targetsInBox(plan, windowBox).filter((item) => item.kind === 'wall').map((item) => item.id)
  const crossingHits = targetsInBox(plan, crossingBox).filter((item) => item.kind === 'wall').map((item) => item.id)
  assert.deepEqual(windowHits, [horizontal.id])
  assert.ok(crossingHits.includes(horizontal.id))
  assert.ok(crossingHits.includes(vertical.id))
})

test('shift and ctrl toggle selection membership', () => {
  const first = [{ kind: 'wall', id: 'a' }]
  const added = mergeSelection(first, [{ kind: 'wall', id: 'b' }], { shift: true })
  assert.equal(added.length, 2)
  const removed = mergeSelection(added, [{ kind: 'wall', id: 'a' }], { ctrl: true })
  assert.deepEqual(removed.map((item) => item.id), ['b'])
  const replaced = mergeSelection(added, [{ kind: 'wall', id: 'c' }], {})
  assert.deepEqual(replaced.map((item) => item.id), ['c'])
})

test('moving a wall keeps the welded joint and the opening offset', () => {
  let plan = twoWalls()
  const horizontal = plan.walls[0]
  const vertical = plan.walls[1]
  plan = addOpening(plan, horizontal.id, { x: 2, z: 0 }, 'door')
  const opening = plan.openings[0]
  const moved = applyOp(plan, [{ kind: 'wall', id: horizontal.id }], { type: 'translate', dx: 1, dz: 0 })
  const movedHorizontal = moved.walls.find((wall) => wall.id === horizontal.id)
  const movedVertical = moved.walls.find((wall) => wall.id === vertical.id)
  assert.equal(movedHorizontal.a.x, 1)
  assert.equal(movedHorizontal.b.x, 5)
  assert.equal(movedVertical.a.x, 5)
  assert.equal(movedVertical.b.x, 4)
  assert.equal(moved.openings[0].offset, opening.offset)
  assert.equal(moved.openings[0].wallId, horizontal.id)
})

test('stretch moves only the vertices inside the window', () => {
  const plan = twoWalls()
  const horizontal = plan.walls[0]
  const box = selectionBox({ x: -0.4, z: -0.4 }, { x: 0.4, z: 0.4 })
  const stretched = applyOp(plan, [{ kind: 'wall', id: horizontal.id }], { type: 'stretch', box, dx: 0, dz: 1 })
  const wall = stretched.walls.find((item) => item.id === horizontal.id)
  assert.equal(wall.a.z, 1)
  assert.equal(wall.b.z, 0)
  assert.equal(wall.b.x, 4)
})

test('copy and array add the requested number of walls', () => {
  const plan = twoWalls()
  const horizontal = plan.walls[0]
  const copied = copySelection(plan, [{ kind: 'wall', id: horizontal.id }], 0, 2, 2)
  assert.equal(copied.walls.length, plan.walls.length + 2)
  const arrayed = arraySelection(plan, [{ kind: 'wall', id: horizontal.id }], { mode: 'rect', cols: 2, rows: 2, dx: 0, dz: 3 })
  assert.equal(arrayed.walls.length, plan.walls.length + 3)
})

test('a locked wall stays put and a hidden wall is not selectable', () => {
  const plan = twoWalls()
  const horizontal = { ...plan.walls[0], cadLock: true }
  const vertical = { ...plan.walls[1], hidden: true }
  const locked = { ...plan, walls: [horizontal, vertical] }
  const moved = applyOp(locked, [{ kind: 'wall', id: horizontal.id }], { type: 'translate', dx: 2, dz: 0 })
  assert.equal(moved.walls.find((wall) => wall.id === horizontal.id).a.x, 0)
  const hits = targetsInBox(locked, selectionBox({ x: -1, z: -1 }, { x: 6, z: 5 }))
  assert.ok(hits.some((item) => item.id === horizontal.id))
  assert.equal(hits.some((item) => item.id === vertical.id), false)
})

test('rotating a closed room keeps its name', () => {
  let plan = emptyPlan('huone')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 4, z: 3 }, { x: 0, z: 3 }, 'exterior')
  plan = addWall(plan, { x: 0, z: 3 }, { x: 0, z: 0 }, 'exterior')
  assert.equal(plan.rooms.length, 1)
  plan = { ...plan, rooms: [{ ...plan.rooms[0], name: 'Olohuone', type: 'olohuone' }] }
  const rotated = applyOp(
    plan,
    plan.walls.map((wall) => ({ kind: 'wall', id: wall.id })),
    { type: 'rotate', cx: 0, cz: 0, degrees: 90 },
  )
  assert.equal(rotated.rooms.length, 1)
  assert.equal(rotated.rooms[0].name, 'Olohuone')
  assert.equal(rotated.rooms[0].type, 'olohuone')
  assert.ok(Math.abs(rotated.rooms[0].cx - (-plan.rooms[0].cz)) < 0.2)
  assert.ok(Math.abs(rotated.rooms[0].cz - plan.rooms[0].cx) < 0.2)
})

test('offset copies a wall to the chosen side and rotate turns it', () => {
  const plan = twoWalls()
  const horizontal = plan.walls[0]
  const offset = offsetSelection(plan, [{ kind: 'wall', id: horizontal.id }], 1, { x: 2, z: 1 })
  assert.equal(offset.walls.length, plan.walls.length + 1)
  const copy = offset.walls[offset.walls.length - 1]
  assert.equal(copy.a.z, 1)
  assert.equal(copy.b.z, 1)
  const rotated = runCommand(plan, [{ kind: 'wall', id: horizontal.id }], { name: 'rotate', base: { x: 0, z: 0 }, value: '90' }, { x: 1, z: 0 })
  const wall = rotated.walls.find((item) => item.id === horizontal.id)
  assert.ok(Math.abs(wall.b.x) < 0.01)
  assert.ok(Math.abs(wall.b.z - 4) < 0.01)
})

test('select by type and group membership', () => {
  let plan = twoWalls()
  plan = addOpening(plan, plan.walls[0].id, { x: 1, z: 0 }, 'door')
  plan = addOpening(plan, plan.walls[1].id, { x: 4, z: 1 }, 'window')
  assert.equal(targetsByType(plan, 'door').length, 1)
  assert.equal(targetsByType(plan, 'window').length, 1)
  assert.equal(targetsByType(plan, 'exterior').length, 2)
  const grouped = groupSelection(plan, [{ kind: 'wall', id: plan.walls[0].id }, { kind: 'wall', id: plan.walls[1].id }])
  const expanded = expandGroups(grouped, [{ kind: 'wall', id: plan.walls[0].id }])
  assert.equal(expanded.length, 2)
})

test('clipboard paste shifts a copied wall', () => {
  const plan = twoWalls()
  const payload = floorClipboard(plan, [{ kind: 'wall', id: plan.walls[0].id }])
  const pasted = pasteFloorClipboard(plan, payload, { x: payload.origin.x + 3, z: payload.origin.z })
  assert.equal(pasted.walls.length, plan.walls.length + 1)
  const copy = pasted.walls[pasted.walls.length - 1]
  assert.equal(copy.a.x, plan.walls[0].a.x + 3)
})

test('moving a device follows a locked cable', () => {
  let plan = emptyPlan('sähkö')
  plan = {
    ...plan,
    services: {
      ...ensureServices(plan),
      nodes: [{ id: 'n1', system: 'electric', kind: 'socket', name: 'Pistorasia', x: 1, z: 1, y: 0.3 }],
      runs: [],
    },
  }
  plan = commitRunGeometry(plan, 'missing', [])
  plan = {
    ...plan,
    services: {
      ...plan.services,
      runs: [{
        id: 'r1',
        system: 'electric',
        kind: 'cable',
        locked: true,
        manual: true,
        deviceId: 'n1',
        points: [{ x: 1, y: 0.3, z: 1 }, { x: 3, y: 0.3, z: 1 }],
      }],
    },
  }
  const moved = applyOp(plan, [{ kind: 'node', id: 'n1' }], { type: 'translate', dx: 0, dz: 2 })
  const node = moved.services.nodes.find((item) => item.id === 'n1')
  const run = moved.services.runs.find((item) => item.id === 'r1')
  assert.equal(node.z, 3)
  assert.equal(run.points[0].z, 3)
  assert.equal(run.points[1].z, 1)
  assert.equal(run.locked, true)
})

test('designer crossing select and room move keeps a connected pipe', () => {
  const scene = {
    rooms: [{ id: 'r1', x: 5, z: 5, width: 4, depth: 3, height: 3, equipment: [{ id: 'eq1', x: 0, z: 0, width: 0.6, depth: 0.6 }] }],
    pipes: [{ id: 'p1', points: [{ x: 5, y: 1, z: 5 }, { x: 8, y: 1, z: 5 }] }],
    cables: [],
  }
  const windowHits = designerHits(scene, selectionBox({ x: 2, z: 2 }, { x: 8, z: 8 }))
  assert.ok(windowHits.some((item) => item.id === 'r1'))
  const outside = designerHits(scene, selectionBox({ x: 0, z: 0 }, { x: 2, z: 2 }))
  assert.equal(outside.some((item) => item.id === 'r1'), false)
  const crossing = designerHits(scene, selectionBox({ x: 8, z: 2 }, { x: 2, z: 4 }))
  assert.equal(crossing.mode, undefined)
  assert.ok(crossing.some((item) => item.id === 'r1'))
  const moved = applyDesigner(scene, [{ kind: 'room', id: 'r1' }], { type: 'translate', dx: 1, dz: 0 })
  assert.equal(moved.rooms[0].x, 6)
  assert.equal(moved.pipes[0].points[0].x, 6)
  assert.equal(moved.pipes[0].points[1].x, 8)
  assert.equal(moved.pipes[0].locked, true)
})

function houseWithDoor() {
  let plan = emptyPlan('ovi')
  const corners = [[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]]
  for (let i = 0; i < corners.length - 1; i += 1) {
    plan = addWall(plan, { x: corners[i][0], z: corners[i][1] }, { x: corners[i + 1][0], z: corners[i + 1][1] }, 'exterior')
  }
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 6 }, 'interior')
  plan = addOpening(plan, plan.walls[0].id, { x: 2, z: 0 }, 'door')
  return plan
}

function wallKey(plan) {
  return (plan.walls || []).map((wall) => `${wall.id}:${wall.a.x},${wall.a.z}:${wall.b.x},${wall.b.z}`).join('|')
}

function roomKey(plan) {
  return (plan.rooms || []).map((room) => {
    const poly = (room.polygon || []).map((point) => `${point.x},${point.z}`).join(';')
    return `${room.id}:${room.area}:${room.cx},${room.cz}:${poly}`
  }).join('|')
}

test('mirroring a selected door leaves every wall and room in place', () => {
  const plan = houseWithDoor()
  const door = plan.openings[0]
  const walls = wallKey(plan)
  const rooms = roomKey(plan)
  const before = JSON.parse(JSON.stringify({ walls: plan.walls, rooms: plan.rooms, openings: plan.openings }))
  const mirrored = runCommand(plan, [{ kind: 'opening', id: door.id }], { name: 'mirror', base: { x: 1, z: 1 } }, { x: 6, z: 4 })
  const opening = mirrored.openings.find((item) => item.id === door.id)
  assert.equal(wallKey(plan), walls)
  assert.equal(roomKey(plan), rooms)
  assert.equal(wallKey(mirrored), walls)
  assert.equal(roomKey(mirrored), rooms)
  assert.equal(opening.wallId, door.wallId)
  assert.equal(opening.offset, door.offset)
  assert.equal(opening.swing, -(door.swing || 1))
  assert.equal(opening.inward, door.inward)
  assert.equal(mirrored.rooms.length, plan.rooms.length)
  assert.ok(mirrored.rooms.every((room) => room.area > 1))
  const directed = runCommand(plan, [{ kind: 'opening', id: door.id }], { name: 'mirror', shift: true, base: { x: 0, z: 0 } }, { x: 0, z: 3 })
  const leaf = directed.openings.find((item) => item.id === door.id)
  assert.equal(leaf.swing, door.swing)
  assert.equal(leaf.inward, !door.inward)
  assert.equal(leaf.offset, door.offset)
  assert.equal(wallKey(directed), walls)
  const undone = before
  assert.equal(undone.openings[0].swing, door.swing)
  assert.equal(undone.walls.length, plan.walls.length)
})

test('mirroring selected walls keeps their joints and does not shear the rest', () => {
  const plan = houseWithDoor()
  const selected = plan.walls.filter((wall) => wall.kind !== 'interior')
  const interior = plan.walls.find((wall) => wall.kind === 'interior')
  const mirrored = applyOp(
    plan,
    selected.map((wall) => ({ kind: 'wall', id: wall.id })),
    { type: 'mirror', x1: 0, z1: 0, x2: 0, z2: 1 },
  )
  const stayed = mirrored.walls.find((wall) => wall.id === interior.id)
  assert.equal(stayed.a.x, interior.a.x)
  assert.equal(stayed.a.z, interior.a.z)
  assert.equal(stayed.b.x, interior.b.x)
  assert.equal(stayed.b.z, interior.b.z)
  selected.forEach((wall) => {
    const next = mirrored.walls.find((item) => item.id === wall.id)
    const before = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
    const after = Math.hypot(next.b.x - next.a.x, next.b.z - next.a.z)
    assert.ok(Math.abs(before - after) < 0.02)
  })
  const ends = mirrored.walls.filter((wall) => wall.id !== interior.id).flatMap((wall) => [wall.a, wall.b])
  ends.forEach((point) => {
    const mates = ends.filter((other) => Math.hypot(other.x - point.x, other.z - point.z) < 0.02)
    assert.ok(mates.length >= 2)
  })
  const whole = applyOp(
    plan,
    plan.walls.map((wall) => ({ kind: 'wall', id: wall.id })),
    { type: 'mirror', x1: 0, z1: 0, x2: 0, z2: 1 },
  )
  const beforeArea = plan.rooms.reduce((sum, room) => sum + room.area, 0)
  const afterArea = whole.rooms.reduce((sum, room) => sum + room.area, 0)
  assert.ok(Math.abs(beforeArea - afterArea) < 0.2)
  assert.ok(whole.rooms.every((room) => room.area > 1))
  assert.equal(whole.rooms.length, plan.rooms.length)
})
