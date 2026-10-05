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
  const guide = snap.guides.find((item) => item.x1 === 0 && item.x2 === 0)
  assert.ok(guide)
  assert.ok(Math.min(guide.z1, guide.z2) <= 0)
  assert.ok(Math.max(guide.z1, guide.z2) >= 8, 'the guide runs across the plan')
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

test('an ortho lock stores the same millimetre on both ends', () => {
  const aperture = 7 * Math.PI / 180
  const horizontal = snapPoint(
    { x: 2.4, z: 1.4 },
    { origin: { x: 0.25, z: 1.25 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture },
  )
  assert.equal(horizontal.kind, 'angle')
  assert.equal(horizontal.point.z, 1.25)
  const vertical = snapPoint(
    { x: 2.7, z: 3.2 },
    { origin: { x: 2.5, z: 0.2 }, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture },
  )
  assert.equal(vertical.kind, 'angle')
  assert.equal(vertical.point.x, 2.5)
  let plan = emptyPlan()
  const a = { x: 0, z: 0 }
  const b = snapPoint({ x: 4.2, z: 0.3 }, { origin: a, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture }).point
  const c = snapPoint({ x: b.x + 0.25, z: b.z + 3 }, { origin: b, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture }).point
  const d = snapPoint({ x: c.x - 4, z: c.z + 0.3 }, { origin: c, walls: [], radius: 0.02, grid: 0.01, polarAperture: aperture }).point
  plan = addWall(plan, a, b, 'exterior')
  plan = addWall(plan, b, c, 'exterior')
  plan = addWall(plan, c, d, 'exterior')
  plan.walls.forEach((wall) => {
    const dx = wall.b.x - wall.a.x
    const dz = wall.b.z - wall.a.z
    assert.ok(Math.abs(dx) < 0.001 || Math.abs(dz) < 0.001, JSON.stringify(wall))
  })
  const nudged = addWall(emptyPlan(), { x: 0, z: 0 }, { x: 4, z: 0.02 }, 'exterior')
  const flat = nudged.walls[0]
  assert.equal(flat.a.z, flat.b.z)
  assert.equal(flat.a.x, 0)
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
  assert.ok(snap.kind === 'perpendicular' || snap.kind === 'intersection')
  assert.ok(snap.point.z < 2, snap.point.z)
  assert.ok(Math.abs(snap.point.z - 1.88) < 0.03, snap.point.z)
  assert.equal(snap.join.z, 2)
  assert.ok(snap.point.x < 2.05)
})

test('snap priority prefers an endpoint, then perpendicular, midpoint, face and alignment', () => {
  const host = { id: 'h', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, thickness: 0.24, kind: 'exterior' }
  const cross = { id: 'c', a: { x: 0.05, z: -2 }, b: { x: 0.05, z: 2 }, thickness: 0.12, kind: 'interior' }
  const corner = snapPoint({ x: 0.04, z: 0.02 }, { walls: [host, cross], radius: 0.3, grid: 0.01 })
  assert.equal(corner.kind, 'corner')
  assert.deepEqual(corner.point, { x: 0, z: 0 })
  const perp = snapPoint(
    { x: 2.12, z: 0.06 },
    { origin: { x: 2.2, z: 2 }, walls: [host], radius: 0.35, grid: 0.01 },
  )
  assert.equal(perp.kind, 'perpendicular')
  const mid = snapPoint({ x: 2.02, z: 0.1 }, { walls: [host], radius: 0.25, grid: 0.01 })
  assert.equal(mid.kind, 'midpoint')
  const face = snapPoint({ x: 1.2, z: 0.16 }, { walls: [host], radius: 0.08, grid: 0.01 })
  assert.equal(face.kind, 'face')
  const align = snapPoint({ x: 0.04, z: 2 }, { walls: [host], radius: 0.1, grid: 0.01 })
  assert.equal(align.kind, 'align')
  const ranks = ['corner', 'perpendicular', 'midpoint', 'face', 'align']
  assert.deepEqual([corner.kind, perp.kind, mid.kind, face.kind, align.kind], ranks)
})

test('an eight degree miss locks to the axis when ortho is on', () => {
  const snap = snapPoint(
    { x: 0.42, z: 3 },
    { origin: { x: 0, z: 0 }, walls: [], radius: 0.02, grid: 0.01, angleStep: 90 },
  )
  assert.equal(snap.kind, 'angle')
  assert.equal(snap.point.x, 0)
  assert.ok(snap.point.z > 2.9)
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
  const atNew = moved.walls.flatMap((item) => [item.a, item.b]).filter((end) => Math.hypot(end.x - 2.5, end.z) < 0.02)
  const stuck = moved.walls.flatMap((item) => [item.a, item.b]).some((end) => Math.hypot(end.x - 2, end.z) < 0.02)
  assert.equal(atNew.length, 3)
  assert.equal(stuck, false)
  const stub = moved.walls.find((item) => Math.abs(item.a.x - item.b.x) < 0.02)
  assert.ok(stub)
  assert.ok(Math.abs(stub.a.x - 2.5) < 0.02)
  moved.walls.forEach((item) => {
    const dx = Math.abs(item.b.x - item.a.x)
    const dz = Math.abs(item.b.z - item.a.z)
    assert.ok(dx < 0.02 || dz < 0.02)
  })
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
