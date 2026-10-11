import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPanelPlan, roomsFromPanels } from './coldPanels.js'
import { doorPlacement, evaporatorPlacement, fitAgainstRooms, resizeRoomSpan, slideWallBy } from './coldEdit.js'
import { centerlineFromMeasure, commitRectangle, snapRectanglePoint } from './wallDraw.js'

const panel = { kind: 'panel', panel: true, thickness: 0.1, axisDeg: 0.01 }

test('drawn size snaps to the active grid', () => {
  const point = snapRectanglePoint({ x: 0, z: 0 }, { x: 2.392, z: 3.017 }, 0.1)
  assert.equal(point.x, 2.4)
  assert.equal(point.z, 3)
  assert.deepEqual(snapRectanglePoint({ x: 1, z: 1 }, { x: 1.04, z: 0.96 }, 0.05), { x: 1.05, z: 0.95 })
})

test('inner size expands the centerline and outer size shrinks it', () => {
  const inner = centerlineFromMeasure({ x: 0, z: 0 }, { x: 4, z: 3 }, 0.1, 'inner')
  assert.equal(inner.corner.x, -0.05)
  assert.equal(inner.opposite.x, 4.05)
  assert.equal(inner.opposite.z, 3.05)
  const outer = centerlineFromMeasure({ x: 0, z: 0 }, { x: 4, z: 3 }, 0.1, 'outer')
  assert.equal(outer.corner.x, 0.05)
  assert.equal(outer.opposite.x, 3.95)
  const rooms = roomsFromPanels(commitRectangle(emptyPanelPlan(), inner.corner, inner.opposite, panel))
  const box = rooms[0].outline.reduce((acc, point) => ({
    w: Math.max(acc.w, point.x) - Math.min(acc.minX, point.x),
    d: Math.max(acc.d, point.z) - Math.min(acc.minZ, point.z),
    minX: Math.min(acc.minX, point.x),
    minZ: Math.min(acc.minZ, point.z),
  }), { w: 0, d: 0, minX: Infinity, minZ: Infinity })
  assert.ok(Math.abs(box.w - 4) < 0.03, box.w)
  assert.ok(Math.abs(box.d - 3) < 0.03, box.d)
})

test('a shallow overlap snaps to the neighbouring face and a deep one is refused', () => {
  const plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  const rooms = roomsFromPanels(plan)
  const abut = fitAgainstRooms({ x: 3.6, z: 0 }, { x: 7.6, z: 3 }, rooms, { thickness: 0.1, basis: 'inner' })
  assert.equal(abut.rejected, false)
  assert.equal(abut.snapped, true)
  assert.ok(abut.corner.x > 3.9)
  const buried = fitAgainstRooms({ x: 1, z: 0.4 }, { x: 3, z: 2.4 }, rooms, { thickness: 0.1, basis: 'inner' })
  assert.equal(buried.rejected, true)
})

test('snapping onto a neighbour keeps both rooms on the grid and aligned', () => {
  const inner = centerlineFromMeasure({ x: 0, z: 0 }, { x: 4, z: 3 }, 0.1, 'inner')
  let plan = commitRectangle(emptyPanelPlan(), inner.corner, inner.opposite, panel)
  let rooms = roomsFromPanels(plan)
  const fitted = fitAgainstRooms(
    { x: 4.05, z: -0.05 },
    { x: 7.75, z: 3.05 },
    rooms,
    { thickness: 0.1, basis: 'inner', grid: 0.1, radius: 0.45 },
  )
  assert.equal(fitted.rejected, false)
  assert.equal(fitted.snapped, true)
  const line = centerlineFromMeasure(fitted.corner, fitted.opposite, 0.1, 'inner')
  plan = commitRectangle(plan, line.corner, line.opposite, panel)
  rooms = roomsFromPanels(plan, rooms)
  const measure = (room) => {
    const xs = room.outline.map((point) => point.x)
    const zs = room.outline.map((point) => point.z)
    return {
      w: Math.round((Math.max(...xs) - Math.min(...xs)) * 1000),
      d: Math.round((Math.max(...zs) - Math.min(...zs)) * 1000),
      top: Math.min(...zs),
      bottom: Math.max(...zs),
    }
  }
  const [first, second] = rooms.map(measure)
  assert.equal(first.w % 100, 0)
  assert.equal(first.d % 100, 0)
  assert.equal(second.w % 100, 0)
  assert.equal(second.d % 100, 0)
  assert.ok(Math.abs(first.top - second.top) < 0.001)
  assert.ok(Math.abs(first.bottom - second.bottom) < 0.001)
  assert.equal(first.d, 3000)
  assert.equal(second.d, 3000)
  assert.equal(plan.walls.length, 7)
})

test('a room drawn just short of a neighbour shares that wall', () => {
  const inner = centerlineFromMeasure({ x: 0, z: 0 }, { x: 4, z: 3 }, 0.1, 'inner')
  let plan = commitRectangle(emptyPanelPlan(), inner.corner, inner.opposite, panel)
  const rooms = roomsFromPanels(plan)
  const fitted = fitAgainstRooms({ x: 4.05, z: 0 }, { x: 8, z: 3 }, rooms, { thickness: 0.1, basis: 'inner' })
  assert.equal(fitted.rejected, false)
  assert.equal(fitted.snapped, true)
  const line = centerlineFromMeasure(fitted.corner, fitted.opposite, 0.1, 'inner')
  plan = commitRectangle(plan, line.corner, line.opposite, panel)
  const xs = [...new Set(plan.walls.filter((wall) => Math.abs(wall.a.x - wall.b.x) < 0.02).map((wall) => Math.round(((wall.a.x + wall.b.x) / 2) * 100) / 100))]
  assert.deepEqual(xs.sort((a, b) => a - b), [-0.05, 4.05, 8.1])
  assert.equal(plan.walls.length, 7)
})

test('two new rooms from one plan get different names', () => {
  let plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  plan = commitRectangle(plan, { x: 4, z: 0 }, { x: 8, z: 3 }, panel)
  const rooms = roomsFromPanels(plan, [], 'chilled')
  assert.equal(rooms.length, 2)
  assert.equal(new Set(rooms.map((room) => room.label)).size, 2)
  assert.equal(new Set(rooms.map((room) => room.id)).size, 2)
})

test('sliding a wall keeps the rectangle orthogonal and resizes it', () => {
  const plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  const right = plan.walls.find((wall) => Math.abs(wall.a.x - 4) < 0.02 && Math.abs(wall.b.x - 4) < 0.02)
  const moved = slideWallBy(plan, right.id, 0.5, 0.2)
  const shifted = moved.walls.find((wall) => wall.id === right.id)
  assert.ok(Math.abs(shifted.a.x - 4.5) < 0.02)
  assert.ok(Math.abs(shifted.b.x - 4.5) < 0.02)
  assert.ok(moved.walls.every((wall) => Math.abs(wall.a.x - wall.b.x) < 1e-6 || Math.abs(wall.a.z - wall.b.z) < 1e-6))
})

test('a shared-wall dimension grows the outer wall unless the party wall is chosen', () => {
  let plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  plan = commitRectangle(plan, { x: 4, z: 0 }, { x: 8, z: 3 }, panel)
  const rooms = roomsFromPanels(plan)
  const left = rooms.find((room) => room.x < 3)
  const dim = { x1: 0.05, x2: 3.95, z1: 1.5, z2: 1.5, roomId: left.id, kind: 'internal' }
  const outer = resizeRoomSpan(plan, dim, 4.4, 'outer')
  const shared = resizeRoomSpan(plan, dim, 4.4, 'shared')
  const xOf = (source, id) => {
    const wall = source.walls.find((item) => item.id === id)
    return (wall.a.x + wall.b.x) / 2
  }
  const leftWall = plan.walls.find((wall) => Math.abs(wall.a.x) < 0.02 && Math.abs(wall.b.x) < 0.02)
  const party = plan.walls.find((wall) => Math.abs(wall.a.x - 4) < 0.02 && Math.abs(wall.b.x - 4) < 0.02)
  const far = plan.walls.find((wall) => Math.abs(wall.a.x - 8) < 0.02 && Math.abs(wall.b.x - 8) < 0.02)
  assert.ok(xOf(outer, leftWall.id) < -0.3)
  assert.ok(Math.abs(xOf(outer, party.id) - 4) < 0.05)
  assert.ok(Math.abs(xOf(outer, far.id) - 8) < 0.05)
  assert.ok(Math.abs(xOf(shared, leftWall.id)) < 0.05)
  assert.ok(xOf(shared, party.id) > 4.3)
  assert.ok(Math.abs(xOf(shared, far.id) - 8) < 0.05)
})

test('a door and an evaporator follow the hovered wall', () => {
  const plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  const rooms = roomsFromPanels(plan)
  const door = doorPlacement(rooms, plan.walls, { x: 2, z: 0.02 }, 0.9)
  assert.equal(door.wall, 'n')
  assert.equal(door.opensOut, true)
  assert.ok(Math.abs(door.worldX - 2) < 0.15)
  const evap = evaporatorPlacement(rooms, plan.walls, { x: 0.05, z: 1.5 }, { width: 1.2, depth: 0.5 })
  assert.equal(evap.roomId, rooms[0].id)
  assert.ok(evap.worldX > 0.2)
  assert.ok(Math.abs(evap.rotation) < 1 || Math.abs(evap.rotation - 360) < 1)
})
