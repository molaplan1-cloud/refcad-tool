import test from 'node:test'
import assert from 'node:assert/strict'
import { addOpening, addWall, emptyPlan, moveWallParallel } from './floorplan.js'
import {
  applyTemporaryDimension,
  nextTrackAxis,
  offsetForEndGap,
  openingEndGaps,
  parallelGaps,
  parseTrackText,
  pointAtOffset,
  temporaryDimensions,
  trackedPoint,
  wallShiftMetres,
} from './tracking.js'

function shell() {
  let plan = emptyPlan('Tarkkuus')
  const ring = [[0, 0], [8, 0], [8, 6], [0, 6]]
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    plan = addWall(plan, { x: a[0], z: a[1] }, { x: b[0], z: b[1] }, 'exterior')
  }
  return plan
}

function cornerSet(plan) {
  const points = []
  ;(plan.walls || []).forEach((wall) => {
    ;[wall.a, wall.b].forEach((point) => {
      if (!points.some((item) => Math.hypot(item.x - point.x, item.z - point.z) < 0.002)) points.push({ x: point.x, z: point.z })
    })
  })
  return points
}

test('a typed distance places the wall start 1250 mm from the corner', () => {
  const plan = shell()
  const south = plan.walls.find((wall) => Math.abs(wall.a.z) < 0.01 && Math.abs(wall.b.z) < 0.01 && wall.b.x > wall.a.x)
  const base = { x: 0, z: 0 }
  const live = trackedPoint(base, { x: 3.2, z: 0.01 }, plan.walls, { text: '1250' })
  assert.equal(live.label, '1250 mm nurkasta')
  assert.ok(Math.abs(live.point.x - 1.25) < 0.001)
  assert.ok(Math.abs(live.point.z) < 0.001)
  const built = addWall(plan, live.point, { x: live.point.x, z: 3 }, 'interior')
  const partition = built.walls.find((wall) => wall.kind === 'interior')
  const startX = Math.min(partition.a.x, partition.b.x)
  assert.ok(Math.abs(startX - 1.25) < 0.001, JSON.stringify(partition))
  assert.ok(Math.abs(partition.a.x - partition.b.x) < 0.001)
  assert.equal(parseTrackText('1250,400').kind, 'delta')
  const delta = trackedPoint(base, { x: 2, z: 1 }, plan.walls, { text: '1250,0' })
  assert.ok(Math.abs(delta.point.x - 1.25) < 0.001)
  assert.equal(delta.point.z, 0)
  assert.equal(nextTrackAxis('along'), 'x')
  const alongX = trackedPoint(base, { x: 2, z: 1.4 }, plan.walls, { axis: 'x', text: '1250' })
  const alongY = trackedPoint(base, { x: 2, z: 1.4 }, plan.walls, { axis: 'y', text: '800' })
  assert.deepEqual(alongX.point, { x: 1.25, z: 0 })
  assert.deepEqual(alongY.point, { x: 0, z: 0.8 })
  assert.ok(south)
})

test('a typed end distance places the door on the wall', () => {
  const plan = shell()
  const wall = plan.walls.find((item) => Math.abs(item.a.z) < 0.01 && Math.abs(item.b.z) < 0.01)
  const offset = offsetForEndGap(wall, 0.9, { fromStart: 1.25 })
  const gaps = openingEndGaps(wall, offset, 0.9)
  assert.ok(Math.abs(gaps.fromStart - 1.25) < 0.001)
  const placed = addOpening(plan, wall.id, pointAtOffset(wall, offset), 'door')
  const door = placed.openings[0]
  assert.ok(Math.abs(door.offset - offset) < 0.02)
  const shown = openingEndGaps(wall, door.offset, door.width)
  assert.ok(Math.abs(shown.fromStart * 1000 - 1250) < 25)
  const edited = applyTemporaryDimension(placed, {
    role: 'opening-end',
    openingId: door.id,
  }, 2000)
  const moved = edited.openings[0]
  const after = openingEndGaps(wall, moved.offset, moved.width)
  assert.ok(Math.abs(after.fromEnd - 2) < 0.02)
  assert.equal(moved.wallId, door.wallId)
})

test('a typed parallel offset keeps the corners square', () => {
  let plan = shell()
  plan = addWall(plan, { x: 4, z: 0 }, { x: 4, z: 6 }, 'interior')
  const partition = plan.walls.find((wall) => wall.kind === 'interior')
  const before = cornerSet(plan)
  const outer = [[0, 0], [8, 0], [8, 6], [0, 6]]
  const shifted = moveWallParallel(plan, partition.id, 0.4)
  const moved = shifted.walls.find((wall) => wall.id === partition.id)
  assert.ok(Math.abs(moved.a.x - 3.6) < 0.001)
  assert.ok(Math.abs(moved.b.x - 3.6) < 0.001)
  assert.ok(Math.abs(moved.a.z - moved.b.z) > 5)
  shifted.walls.forEach((wall) => {
    const dx = Math.abs(wall.b.x - wall.a.x)
    const dz = Math.abs(wall.b.z - wall.a.z)
    assert.ok(dx < 0.002 || dz < 0.002, JSON.stringify(wall))
  })
  outer.forEach(([x, z]) => {
    assert.ok(cornerSet(shifted).some((point) => Math.abs(point.x - x) < 0.002 && Math.abs(point.z - z) < 0.002))
  })
  assert.equal(cornerSet(shifted).length, before.length)
  const gaps = parallelGaps(shifted, partition.id)
  assert.ok(gaps.some((gap) => Math.abs(Math.abs(gap.gap) - 3.6) < 0.02))
  const exact = applyTemporaryDimension(shifted, {
    role: 'parallel',
    wallId: partition.id,
    otherId: gaps.find((gap) => Math.abs(Math.abs(gap.gap) - 3.6) < 0.02).otherId,
  }, 3000)
  const parked = exact.walls.find((wall) => wall.id === partition.id)
  assert.ok(Math.abs(Math.min(parked.a.x, parked.b.x) - 3) < 0.02 || Math.abs(Math.min(parked.a.x, parked.b.x) - 5) < 0.02)
  exact.walls.forEach((wall) => {
    const dx = Math.abs(wall.b.x - wall.a.x)
    const dz = Math.abs(wall.b.z - wall.a.z)
    assert.ok(dx < 0.002 || dz < 0.002)
  })
  const host = plan.walls.find((wall) => wall.a.z === 0 && wall.b.z === 0)
  const preview = wallShiftMetres(host || partition, { x: 4, z: 0 }, { x: 4.4, z: 0 }, '400')
  assert.ok(Math.abs(Math.abs(preview) - 0.4) < 0.001)
  const dims = temporaryDimensions(shifted, { kind: 'wall', id: partition.id })
  assert.ok(dims.some((dim) => dim.role === 'parallel' && dim.mm > 1000))
})
