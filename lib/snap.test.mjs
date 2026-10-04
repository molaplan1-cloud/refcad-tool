import test from 'node:test'
import assert from 'node:assert/strict'
import { snapAlongWall, snapFixturePoint, snapPoint, snapRadius, pointAtLength, shouldCloseChain } from './snap.js'
import { addWall, emptyPlan, moveCorner } from './floorplan.js'
import { FIT_CAMERA, fitRect, panBy, wheelZoomFactor, zoomAt, zoomPercent } from './zoom.js'

const wall = { id: 'w', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior', thickness: 0.24 }

test('a corner inside the snap radius wins over the grid', () => {
  const snap = snapPoint({ x: 4.08, z: 0.06 }, { walls: [wall], grid: 0.1, radius: 0.2 })
  assert.equal(snap.kind, 'corner')
  assert.deepEqual(snap.point, { x: 4, z: 0 })
})

test('a corner outside the snap radius stays on the grid', () => {
  const snap = snapPoint({ x: 4.4, z: 0.4 }, { walls: [wall], grid: 0.1, radius: 0.12 })
  assert.equal(snap.kind, 'grid')
  assert.deepEqual(snap.point, { x: 4.4, z: 0.4 })
})

test('the midpoint, face and perpendicular snaps are named', () => {
  const mid = snapPoint({ x: 2.02, z: 0.04 }, { walls: [wall], radius: 0.2, grid: 0.1 })
  assert.equal(mid.kind, 'midpoint')
  assert.deepEqual(mid.point, { x: 2, z: 0 })
  const face = snapPoint({ x: 1, z: 0.12 }, { walls: [wall], radius: 0.08, grid: 0.01 })
  assert.equal(face.kind, 'face')
  assert.ok(Math.abs(Math.abs(face.point.z) - 0.12) < 0.001)
  const foot = snapPoint({ x: 1.02, z: 0.05 }, { origin: { x: 1, z: 2 }, walls: [wall], radius: 0.3 })
  assert.equal(foot.kind, 'perpendicular')
  assert.deepEqual(foot.point, { x: 1, z: 0 })
})

test('angle steps lock to 90, 15 or stay free', () => {
  const right = snapPoint({ x: 3.2, z: 0.4 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.05, grid: 0.1, angleStep: 90 })
  assert.equal(right.kind, 'angle')
  assert.equal(right.point.z, 0)
  const fine = snapPoint({ x: 2, z: 0.55 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, angleStep: 15 })
  assert.equal(fine.kind, 'angle')
  const heading = Math.atan2(fine.point.z, fine.point.x) * 180 / Math.PI
  assert.ok(Math.abs(heading - 15) < 0.6, String(heading))
  const free = snapPoint({ x: 2, z: 0.55 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.1, angleStep: 0 })
  assert.equal(free.kind, 'grid')
  assert.equal(free.point.z, 0.6)
})

test('drawing snaps to 45 degrees and ortho locks to an axis', () => {
  const angle = snapPoint({ x: 2, z: 2.15 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.3, grid: 0.1 })
  assert.equal(angle.kind, 'angle')
  assert.ok(Math.abs(angle.point.x - angle.point.z) < 0.05)
  const ortho = snapPoint({ x: 3.2, z: 0.8 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.05, grid: 0.1, ortho: true })
  assert.equal(ortho.kind, 'angle')
  assert.equal(ortho.point.z, 0)
})

test('Alt returns the raw point and a 50 mm grid rounds the cursor', () => {
  const raw = snapPoint({ x: 1.234, z: 2.2 }, { walls: [wall], enabled: false })
  assert.equal(raw.kind, null)
  assert.deepEqual(raw.point, { x: 1.234, z: 2.2 })
  const grid = snapPoint({ x: 1.23, z: 0.8 }, { walls: [], grid: 0.05, radius: 0.01 })
  assert.equal(grid.kind, 'grid')
  assert.deepEqual(grid.point, { x: 1.25, z: 0.8 })
})

test('an aligned corner publishes a dashed guide', () => {
  const snap = snapPoint({ x: 0.02, z: 2 }, { walls: [wall], radius: 0.08, grid: 0.01 })
  assert.equal(snap.kind, 'align')
  assert.equal(snap.point.x, 0)
  assert.ok(snap.guides.some((guide) => guide.x1 === 0 && guide.z2 === 2))
})

test('doors snap along a wall and fixtures sit on the face', () => {
  const opening = snapAlongWall({ x: 1.5, z: 0.2 }, [wall], 0.3)
  assert.equal(opening.kind, 'edge')
  assert.equal(opening.point.z, 0)
  assert.equal(opening.wall.id, 'w')
  const fixture = snapFixturePoint({ x: 1.5, z: 0.3 }, [wall], { depth: 0.6, radius: 0.4 })
  assert.equal(fixture.kind, 'face')
  assert.ok(fixture.z > 0.12)
})

test('endpoint wins over a closer midpoint, then intersection, perpendicular and the wall', () => {
  const short = { id: 's', a: { x: 0, z: 0 }, b: { x: 0.2, z: 0 }, thickness: 0.02 }
  const end = snapPoint({ x: 0.08, z: 0.02 }, { walls: [short], radius: 0.15, grid: 0.01 })
  assert.equal(end.kind, 'corner')
  assert.deepEqual(end.point, { x: 0, z: 0 })
  const crossA = { a: { x: 0, z: 1 }, b: { x: 4, z: 1 }, thickness: 0.2 }
  const crossB = { a: { x: 2, z: 0 }, b: { x: 2, z: 3 }, thickness: 0.2 }
  const crossing = snapPoint({ x: 2.05, z: 1.04 }, { walls: [crossA, crossB], radius: 0.2, grid: 0.01 })
  assert.equal(crossing.kind, 'intersection')
  assert.deepEqual(crossing.point, { x: 2, z: 1 })
  const perp = snapPoint({ x: 1.02, z: 0.05 }, { origin: { x: 1, z: 2 }, walls: [wall], radius: 0.3, grid: 0.01, polarAperture: 7 * Math.PI / 180 })
  assert.equal(perp.kind, 'perpendicular')
  const mid = snapPoint({ x: 2.02, z: 0.04 }, { walls: [wall], radius: 0.2, grid: 0.1, polarAperture: 7 * Math.PI / 180 })
  assert.equal(mid.kind, 'midpoint')
})

test('polar tracking locks within 7 degrees of an axis and of the previous wall', () => {
  const aperture = 7 * Math.PI / 180
  const locked = snapPoint({ x: 2, z: 0.12 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture })
  assert.equal(locked.kind, 'angle')
  assert.equal(locked.point.z, 0)
  const loose = snapPoint({ x: 2, z: 0.8 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture })
  assert.notEqual(loose.kind, 'angle')
  const free = snapPoint({ x: 2, z: 0.12 }, { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture, freeAngle: true })
  assert.notEqual(free.kind, 'angle')
  const length = 3
  const aim = 106 * Math.PI / 180
  const turn = snapPoint(
    { x: length * Math.cos(aim), z: length * Math.sin(aim) },
    { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture, headings: [20 * Math.PI / 180] },
  )
  const heading = Math.atan2(turn.point.z, turn.point.x) * 180 / Math.PI
  assert.ok(Math.abs(heading - 110) < 0.6, String(heading))
})

test('a new wall stops on the wall it meets instead of overshooting', () => {
  const host = { id: 'h', a: { x: 0, z: 2 }, b: { x: 4, z: 2 }, thickness: 0.24, kind: 'exterior' }
  const snap = snapPoint(
    { x: 2.05, z: 2.18 },
    { origin: { x: 0.2, z: 0 }, walls: [host], radius: 0.3, grid: 0.01, polarAperture: 7 * Math.PI / 180, joinWalls: true },
  )
  assert.equal(snap.kind, 'intersection')
  assert.equal(snap.point.z, 2)
  assert.ok(snap.point.x < 2.05)
})

test('the magnetic radius is a fixed screen distance and a typed length is exact', () => {
  assert.equal(snapRadius(100), 0.14)
  assert.equal(snapRadius(50, 15), 0.3)
  assert.deepEqual(pointAtLength({ x: 0, z: 0 }, { x: 2, z: 0 }, 1500), { x: 1.5, z: 0 })
  assert.equal(shouldCloseChain({ start: { x: 0, z: 0 }, count: 2 }, { x: 0.01, z: 0 }), true)
  assert.equal(shouldCloseChain({ start: { x: 0, z: 0 }, count: 1 }, { x: 0, z: 0 }), false)
})

test('meeting walls share a node and the corner moves both', () => {
  let plan = emptyPlan('join')
  plan = addWall(plan, { x: 0, z: 0 }, { x: 4, z: 0 }, 'exterior')
  plan = addWall(plan, { x: 2, z: 0 }, { x: 2, z: 3 }, 'interior')
  const joined = plan.walls.filter((item) => [item.a, item.b].some((end) => Math.hypot(end.x - 2, end.z) < 0.02))
  assert.equal(joined.length, 3)
  const moved = moveCorner(plan, { x: 2, z: 0 }, { x: 2.5, z: 0.2 })
  const atNew = moved.walls.flatMap((item) => [item.a, item.b]).filter((end) => Math.hypot(end.x - 2.5, end.z - 0.2) < 0.02)
  const stuck = moved.walls.flatMap((item) => [item.a, item.b]).some((end) => Math.hypot(end.x - 2, end.z) < 0.02)
  assert.equal(atNew.length, 3)
  assert.equal(stuck, false)
})

test('zoom stays centred on the cursor and the percent follows the scale', () => {
  const next = zoomAt({ zoom: 1, x: 0, y: 0 }, 100, 50, 2)
  assert.equal(next.zoom, 2)
  assert.equal(next.x, -100)
  assert.equal(next.y, -50)
  const back = zoomAt(next, 100, 50, 0.5)
  assert.equal(back.zoom, 1)
  assert.equal(Math.round(back.x), 0)
  assert.equal(Math.round(back.y), 0)
  assert.equal(zoomPercent(next), 200)
  assert.ok(wheelZoomFactor(-100, false) > 1)
  assert.deepEqual(panBy(FIT_CAMERA, 12, -4), { zoom: 1, x: 12, y: -4 })
  const fitted = fitRect({ left: 100, top: 100, right: 300, bottom: 200 }, { w: 800, h: 600 }, 0)
  assert.equal(fitted.zoom, 4)
  assert.equal(fitted.x, -400)
  assert.equal(fitted.y, -300)
})
