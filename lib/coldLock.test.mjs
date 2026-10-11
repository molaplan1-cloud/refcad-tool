import assert from 'node:assert/strict'
import test from 'node:test'
import { bboxOf } from './cadDraw.js'
import { coldDimensions } from './coldDimensions.js'
import {
  emptyPanelPlan,
  repairRoomsFromWalls,
  resizePanelRoom,
  roomsFromPanels,
  translatePanelRooms,
} from './coldPanels.js'
import { resizeDimension } from './floorplan.js'
import { commitRectangle } from './wallDraw.js'

function draw(plan, a, b) {
  return commitRectangle(plan, a, b, { kind: 'panel', panel: true, thickness: 0.1, axisDeg: 0.01 })
}

function span(room) {
  const box = bboxOf(room.outline)
  return {
    width: Math.round(box.width * 1000),
    depth: Math.round(box.depth * 1000),
    x: box.x,
    z: box.z,
  }
}

function wallBox(plan) {
  const points = (plan.walls || []).flatMap((wall) => [wall.a, wall.b])
  return bboxOf(points)
}

test('a drifted room polygon is rebuilt from its walls on repair', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 5, z: 3 })
  const rooms = roomsFromPanels(plan, [], 'chilled')
  const room = rooms[0]
  const drifted = [{
    ...room,
    x: room.x + 2.2,
    z: room.z + 0.4,
    outline: room.outline.map((point) => ({ x: point.x + 2.2, z: point.z + 0.4 })),
    equipment: [{ id: 'evap-1', name: 'Höyrystin', x: 0.2, z: 0.2 }],
  }]
  const healed = repairRoomsFromWalls(plan, drifted, 'chilled')
  assert.equal(healed.length, 1)
  assert.equal(healed[0].id, room.id)
  assert.equal(healed[0].label, room.label)
  assert.equal(healed[0].equipment[0].id, 'evap-1')
  assert.ok(Math.abs(healed[0].x - room.x) < 0.02)
  assert.ok(Math.abs(healed[0].z - room.z) < 0.02)
  const back = span(healed[0])
  const original = span(room)
  assert.equal(back.width, original.width)
  assert.equal(back.depth, original.depth)
})

test('dragging a room translates its walls and the fill stays on them', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 5, z: 3 })
  const rooms = roomsFromPanels(plan)
  const before = wallBox(plan)
  const moved = translatePanelRooms(plan, rooms, [rooms[0].id], 1.6, -0.8)
  assert.equal(moved.copied, false)
  assert.equal(moved.plan.walls.length, plan.walls.length)
  const after = wallBox(moved.plan)
  assert.ok(Math.abs(after.x - (before.x + 1.6)) < 0.02)
  assert.ok(Math.abs(after.z - (before.z - 0.8)) < 0.02)
  const synced = roomsFromPanels(moved.plan, rooms)
  assert.equal(synced.length, 1)
  assert.equal(synced[0].id, rooms[0].id)
  assert.ok(Math.abs(synced[0].x - (rooms[0].x + 1.6)) < 0.05)
  assert.ok(Math.abs(synced[0].z - (rooms[0].z - 0.8)) < 0.05)
  const fill = bboxOf(synced[0].outline)
  const walls = wallBox(moved.plan)
  assert.ok(fill.left > walls.left - 0.001 && fill.right < walls.right + 0.001)
  assert.ok(fill.top > walls.top - 0.001 && fill.bottom < walls.bottom + 0.001)
})

function collinearOverlap(plan) {
  const walls = plan.walls || []
  let count = 0
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const A = walls[i]
      const B = walls[j]
      const adx = A.b.x - A.a.x
      const adz = A.b.z - A.a.z
      const al = Math.hypot(adx, adz) || 1
      const bdx = B.b.x - B.a.x
      const bdz = B.b.z - B.a.z
      const bl = Math.hypot(bdx, bdz) || 1
      if (Math.abs((adx * bdx + adz * bdz) / (al * bl)) < 0.98) continue
      const cross = Math.abs((B.a.x - A.a.x) * adz - (B.a.z - A.a.z) * adx) / al
      if (cross > 0.02) continue
      const proj = (point) => ((point.x - A.a.x) * adx + (point.z - A.a.z) * adz) / (al * al)
      const t0 = Math.min(proj(B.a), proj(B.b))
      const t1 = Math.max(proj(B.a), proj(B.b))
      const lo = Math.max(0, t0)
      const hi = Math.min(1, t1)
      if (hi - lo > 0.03) count += 1
    }
  }
  return count
}

test('moving a room off a shared wall copies that wall and leaves the neighbour', () => {
  let plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  plan = draw(plan, { x: 4, z: 0 }, { x: 8, z: 3 })
  const rooms = roomsFromPanels(plan)
  assert.equal(rooms.length, 2)
  assert.equal(plan.walls.length, 7)
  const left = rooms.slice().sort((a, b) => a.x - b.x)[0]
  const right = rooms.find((room) => room.id !== left.id)
  const moved = translatePanelRooms(plan, rooms, [left.id], 0, 2.4)
  assert.equal(moved.copied, true)
  assert.equal(collinearOverlap(moved.plan), 0)
  const synced = roomsFromPanels(moved.plan, rooms)
  assert.equal(synced.length, 2)
  const nextLeft = synced.find((room) => room.id === left.id)
  const nextRight = synced.find((room) => room.id === right.id)
  assert.ok(nextLeft)
  assert.ok(nextRight)
  assert.ok(Math.abs(nextLeft.z - (left.z + 2.4)) < 0.08, nextLeft.z)
  assert.ok(Math.abs(nextRight.z - right.z) < 0.05, nextRight.z)
  assert.ok(Math.abs(nextRight.x - right.x) < 0.05)
  assert.ok(Math.abs(nextLeft.width - left.width) < 0.04)
  assert.ok(Math.abs(nextLeft.depth - left.depth) < 0.04)
  const fill = bboxOf(nextLeft.outline)
  const own = (moved.plan.walls || []).filter((wall) => String(nextLeft.panelKey).split('|').includes(wall.id))
  const box = bboxOf(own.flatMap((wall) => [wall.a, wall.b]))
  assert.ok(fill.left > box.left - 0.02 && fill.right < box.right + 0.02)
  assert.ok(fill.top > box.top - 0.02 && fill.bottom < box.bottom + 0.02)
  const labels = coldDimensions(moved.plan, synced).map((dim) => Number(dim.label))
  labels.forEach((label) => {
    assert.equal(label % 50, 0, String(label))
  })
})

test('a room that moves clear of its neighbour keeps one wall each and its own outer size', () => {
  let plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  plan = draw(plan, { x: 4, z: 0 }, { x: 8, z: 3 })
  const rooms = roomsFromPanels(plan)
  const left = rooms.slice().sort((a, b) => a.x - b.x)[0]
  const moved = translatePanelRooms(plan, rooms, [left.id], -2, 0)
  assert.equal(moved.copied, true)
  assert.equal(collinearOverlap(moved.plan), 0)
  const synced = roomsFromPanels(moved.plan, rooms)
  const nextLeft = synced.find((room) => room.id === left.id)
  const dims = coldDimensions(moved.plan, synced)
  const overall = dims.filter((dim) => dim.kind === 'overall').map((dim) => dim.label)
  assert.ok(overall.includes('4100'), overall.join(','))
  assert.ok(overall.includes('3100'), overall.join(','))
  assert.equal(overall.includes('10000'), false)
  assert.equal(nextLeft.outline.length >= 4, true)
  const again = translatePanelRooms(moved.plan, synced, [nextLeft.id], 0, 1.2)
  assert.equal(collinearOverlap(again.plan), 0)
  const twice = roomsFromPanels(again.plan, synced)
  assert.equal(twice.length, 2)
  assert.ok(Math.abs(twice.find((room) => room.id === left.id).z - (nextLeft.z + 1.2)) < 0.08)
})

test('a grip resize moves the walls with the inner face', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 5, z: 3 })
  const rooms = roomsFromPanels(plan)
  const box = bboxOf(rooms[0].outline)
  const resized = resizePanelRoom(plan, rooms, rooms[0], {
    left: box.left,
    top: box.top,
    right: box.left + 2.2,
    bottom: box.bottom,
  })
  assert.equal(resized.copied, false)
  const synced = roomsFromPanels(resized.plan, rooms)
  const next = span(synced[0])
  assert.equal(next.width, 2200)
  assert.equal(next.depth, span(rooms[0]).depth)
  const fill = bboxOf(synced[0].outline)
  const walls = wallBox(resized.plan)
  assert.ok(Math.abs((walls.right - walls.left) - (fill.width + 0.1)) < 0.03)
  assert.ok(fill.left > walls.left && fill.right < walls.right)
})

test('editing a dimension to 2200 resizes the walls and the room together', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 5, z: 3 })
  const rooms = roomsFromPanels(plan)
  const dims = coldDimensions(plan, rooms)
  const overall = dims.find((dim) => dim.kind === 'overall' && dim.label === '5100')
  assert.ok(overall)
  const next = resizeDimension(plan, overall, 2.2)
  assert.notEqual(next, plan)
  const synced = roomsFromPanels(next, rooms)
  const labels = coldDimensions(next, synced).filter((dim) => dim.kind === 'overall').map((dim) => dim.label).sort()
  assert.ok(labels.includes('2200'), labels.join(','))
  const fill = bboxOf(synced[0].outline)
  const walls = wallBox(next)
  assert.ok(Math.abs(fill.x - walls.x) < 0.05)
  assert.ok(Math.abs(fill.z - walls.z) < 0.05)
  assert.ok(fill.left > walls.left - 0.001 && fill.right < walls.right + 0.001)
})
