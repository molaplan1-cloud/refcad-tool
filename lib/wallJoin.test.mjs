import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPlan, resizeDimension, setWallLength } from './floorplan.js'
import { wallFigures } from './wall-outline.js'
import { extendToWall, healCandidate, joinCorner, snapWallEnd } from './wallJoin.js'

function ennStub() {
  return {
    ...emptyPlan('Enn'),
    walls: [
      { id: 'top', a: { x: 0, z: 0 }, b: { x: 3.376, z: 0 }, kind: 'exterior', thickness: 0.24 },
      { id: 'step', a: { x: 3.376, z: 0 }, b: { x: 3.376, z: 0.6 }, kind: 'exterior', thickness: 0.24 },
      { id: 'run', a: { x: 3.376, z: 0.6 }, b: { x: 6.2, z: 0.6 }, kind: 'exterior', thickness: 0.24 },
      { id: 'right', a: { x: 6.2, z: 0.6 }, b: { x: 6.2, z: 4 }, kind: 'exterior', thickness: 0.24 },
      { id: 'bottom', a: { x: 6.2, z: 4 }, b: { x: 0, z: 4 }, kind: 'exterior', thickness: 0.24 },
      { id: 'left', a: { x: 0, z: -0.78 }, b: { x: 0, z: 4 }, kind: 'exterior', thickness: 0.24 },
    ],
    openings: [],
    rooms: [],
  }
}

function leftWall(plan) {
  return plan.walls.find((wall) => wall.id === 'left')
}

function flush(plan) {
  const left = leftWall(plan)
  assert.ok(Math.abs(left.a.x) < 0.002 && Math.abs(left.a.z) < 0.002)
  assert.ok(Math.abs(left.b.z - 4) < 0.002)
  const figures = wallFigures(plan.walls, [], (wall) => wall.thickness || 0.24)
  const quad = figures.quads.find((item) => item.wallId === 'left')
  assert.ok(quad.quad.every((point) => point.z > -0.16))
  assert.ok(quad.quad.some((point) => Math.hypot(point.x + 0.12, point.z + 0.12) < 0.03))
  const past = [...figures.cladding, ...figures.insulation].some((loop) => loop.points.some((point) => point.z < -0.2 && Math.abs(point.x) < 0.3))
  assert.equal(past, false)
}

test('join corner trims the 780 mm stub into a clean L', () => {
  flush(joinCorner(ennStub(), 'left', 'top'))
})

test('extend or trim to the top wall closes the same L', () => {
  flush(extendToWall(ennStub(), 'left', 'a', 'top'))
})

test('an end grip snaps to the face and stays on the wall axis', () => {
  const plan = ennStub()
  const left = leftWall(plan)
  const snap = snapWallEnd({ x: 0.04, z: -0.1 }, left, 'a', plan.walls, 0.25, plan)
  assert.equal(snap.onFace, true)
  assert.equal(snap.targetId, 'top')
  assert.ok(Math.abs(snap.point.x) < 0.002)
  assert.ok(snap.point.z < -0.05)
  flush(extendToWall(plan, 'left', 'a', snap.targetId))
})

test('a face snap beats a nearer corner', () => {
  const plan = ennStub()
  const left = leftWall(plan)
  const snap = snapWallEnd({ x: 0, z: -0.02 }, left, 'a', plan.walls, 0.3, plan)
  assert.equal(snap.kind, 'face')
})

test('typing the stub dimension moves the free end', () => {
  const plan = ennStub()
  const dim = { x1: 0, z1: -0.78, x2: 0, z2: 0, label: '780' }
  const next = resizeDimension(plan, dim, 0.2)
  const left = leftWall(next)
  assert.ok(Math.abs(left.a.z + 0.2) < 0.02)
  assert.ok(Math.abs(left.b.z - 4) < 0.002)
  assert.ok(Math.abs(next.walls.find((wall) => wall.id === 'top').a.z) < 0.002)
})

test('typing the wall length keeps the connected end', () => {
  const next = setWallLength(ennStub(), 'left', 4.2)
  const left = leftWall(next)
  assert.ok(Math.abs(left.b.z - 4) < 0.002)
  assert.ok(left.a.z < -0.1)
})

test('a 40 mm miss offers one snap-join and a 780 mm stub does not', () => {
  assert.equal(healCandidate(ennStub()), null)
  const plan = ennStub()
  plan.walls = plan.walls.map((wall) => (wall.id === 'left' ? { ...wall, a: { x: 0, z: -0.16 } } : wall))
  const offer = healCandidate(plan)
  assert.equal(offer.wallId, 'left')
  assert.equal(offer.end, 'a')
  assert.equal(offer.targetId, 'top')
  flush(extendToWall(plan, offer.wallId, offer.end, offer.targetId))
})

test('a mid-wall trim stops on the outer face', () => {
  const plan = {
    ...emptyPlan('T'),
    walls: [
      { id: 'bar', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior', thickness: 0.24 },
      { id: 'stem', a: { x: 2, z: -0.8 }, b: { x: 2, z: 2 }, kind: 'interior', thickness: 0.12 },
    ],
  }
  const next = extendToWall(plan, 'stem', 'a', 'bar')
  const stem = next.walls.find((wall) => wall.id === 'stem')
  assert.ok(Math.abs(stem.a.x - 2) < 0.002)
  assert.ok(Math.abs(stem.a.z + 0.12) < 0.03)
  assert.ok(Math.abs(stem.b.z - 2) < 0.002)
})
