import assert from 'node:assert/strict'
import test from 'node:test'
import { faceQuads, silhouetteOf, wallFigures } from './wall-outline.js'

const thick = (wall) => wall.thickness || (wall.kind === 'interior' ? 0.12 : 0.24)

test('a 90 degree outside corner is sharp and closed', () => {
  const walls = [
    { id: 's', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' },
    { id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 3 }, kind: 'exterior' },
  ]
  const south = faceQuads(walls[0], [], walls, thick)[0]
  const east = faceQuads(walls[1], [], walls, thick)[0]
  const outer = { x: -0.12, z: -0.12 }
  const hit = [...south, ...east].some((point) => Math.hypot(point.x - outer.x, point.z - outer.z) < 0.02)
  assert.equal(hit, true)
  const loops = silhouetteOf([south, east])
  assert.ok(loops.length >= 1)
  const ring = loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0].points
  const corner = ring.some((point) => Math.hypot(point.x - outer.x, point.z - outer.z) < 0.03)
  assert.equal(corner, true)
  const diagonal = ring.some((point, index) => {
    const next = ring[(index + 1) % ring.length]
    const dx = next.x - point.x
    const dz = next.z - point.z
    return Math.abs(dx) > 0.05 && Math.abs(dz) > 0.05 && Math.hypot(point.x, point.z) < 0.3
  })
  assert.equal(diagonal, false)
})

test('a 45 degree corner meets on the face intersection', () => {
  const walls = [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 3, z: 0 }, kind: 'exterior', thickness: 0.2 },
    { id: 'b', a: { x: 0, z: 0 }, b: { x: 2.121, z: 2.121 }, kind: 'exterior', thickness: 0.2 },
  ]
  const quad = faceQuads(walls[0], [], walls, thick)[0]
  assert.equal(quad.length, 4)
  const far = quad.some((point) => Math.hypot(point.x, point.z) > 0.12)
  assert.equal(far, true)
  const loops = silhouetteOf([quad, faceQuads(walls[1], [], walls, thick)[0]])
  assert.ok(loops.length >= 1)
})

test('collinear partitions of different thickness meet in a step', () => {
  const walls = [
    { id: 'u', a: { x: 4, z: 0 }, b: { x: 4, z: 2.4 }, kind: 'interior', thickness: 0.24 },
    { id: 'l', a: { x: 4, z: 2.4 }, b: { x: 4, z: 5.5 }, kind: 'interior', thickness: 0.09 },
  ]
  const figures = wallFigures(walls, [], (wall) => wall.thickness)
  const diagonal = figures.core.some((loop) => loop.points.some((point, index) => {
    const next = loop.points[(index + 1) % loop.points.length]
    return Math.abs(next.x - point.x) > 0.02 && Math.abs(next.z - point.z) > 0.02
  }))
  assert.equal(diagonal, false)
  const stepped = figures.core.some((loop) => (
    loop.points.some((point) => Math.abs(point.x - 3.88) < 0.01 && Math.abs(point.z - 2.4) < 0.01)
    && loop.points.some((point) => Math.abs(point.x - 3.955) < 0.01 && Math.abs(point.z - 2.4) < 0.01)
  ))
  assert.equal(stepped, true)
})

test('left alignment keeps the left face on the reference line', () => {
  const wall = { id: 'u', a: { x: 4, z: 0 }, b: { x: 4, z: 2 }, kind: 'interior', thickness: 0.3, align: 'left' }
  const quad = faceQuads(wall, [], [wall], (item) => item.thickness)[0]
  const xs = quad.map((point) => point.x)
  assert.ok(xs.some((x) => Math.abs(x - 4) < 0.002))
  assert.ok(xs.some((x) => Math.abs(x - 4.3) < 0.002))
  assert.ok(xs.every((x) => Math.abs(x - 4) < 0.002 || Math.abs(x - 4.3) < 0.002))
})

test('a cladding band does not diagonalise along a thickness step', () => {
  const walls = [
    { id: 'u', a: { x: 0, z: 0 }, b: { x: 0, z: 3 }, kind: 'exterior', thickness: 0.3 },
    { id: 'l', a: { x: 0, z: 3 }, b: { x: 0, z: 6 }, kind: 'exterior', thickness: 0.18 },
    { id: 'e', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior', thickness: 0.24 },
  ]
  const figures = wallFigures(walls, [], (wall) => wall.thickness || 0.24)
  const slanted = figures.cladding.some((loop) => loop.points.some((point, index) => {
    const next = loop.points[(index + 1) % loop.points.length]
    return Math.abs(next.z - point.z) > 1 && Math.abs(next.x - point.x) > 0.02
  }))
  assert.equal(slanted, false)
})

test('a T-junction butts into the crossing face', () => {
  const walls = [
    { id: 'bar', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, kind: 'exterior' },
    { id: 'stem', a: { x: 2, z: 0 }, b: { x: 2, z: 2 }, kind: 'interior', thickness: 0.12 },
  ]
  const stem = faceQuads(walls[1], [], walls, thick)[0]
  const past = stem.some((point) => point.z < -0.02)
  assert.equal(past, false)
  const figures = wallFigures(walls, [], thick)
  assert.ok(figures.core.length >= 1)
  assert.ok(figures.cladding.length >= 1)
})
