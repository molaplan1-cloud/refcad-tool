import test from 'node:test'
import assert from 'node:assert/strict'
import { alignForReference, lockOrthoPoint, parseDrawFields, parseDrawInput, pointFromDraw } from './drawInput.js'

test('typed wall input accepts a length, @length<angle and a comma decimal', () => {
  assert.deepEqual(parseDrawInput('4500'), { lengthMm: 4500, angleDeg: null })
  assert.deepEqual(parseDrawInput('@4500<90'), { lengthMm: 4500, angleDeg: 90 })
  assert.deepEqual(parseDrawInput('4500 < 45'), { lengthMm: 4500, angleDeg: 45 })
  assert.deepEqual(parseDrawInput('12,5<180'), { lengthMm: 12.5, angleDeg: 180 })
  assert.equal(parseDrawInput(''), null)
  assert.equal(parseDrawInput('seinä'), null)
  assert.deepEqual(parseDrawFields('4500', '90'), { lengthMm: 4500, angleDeg: 90 })
  assert.deepEqual(parseDrawFields('4500<15', '90'), { lengthMm: 4500, angleDeg: 90 })
})

test('a near-axis heading snaps to the exact axis and a real diagonal stays', () => {
  const origin = { x: 1, z: 2 }
  const crooked = {
    x: origin.x + Math.cos(89.4 * Math.PI / 180) * 8,
    z: origin.z + Math.sin(89.4 * Math.PI / 180) * 8,
  }
  const locked = lockOrthoPoint(origin, crooked, 2)
  assert.equal(locked.x, origin.x)
  assert.ok(Math.abs(locked.z - (origin.z + 8)) < 0.02)
  const diagonal = lockOrthoPoint(origin, { x: origin.x + 3, z: origin.z + 3 }, 2)
  assert.ok(Math.abs(diagonal.x - (origin.x + 3)) < 0.001)
  assert.ok(Math.abs(diagonal.z - (origin.z + 3)) < 0.001)
})

test('a typed length keeps the locked direction and a typed angle is exact', () => {
  const origin = { x: 0, z: 0 }
  const along = pointFromDraw(origin, { x: 1, z: 0.2 }, { lengthMm: 12000, angleDeg: null }, { ortho: true })
  assert.deepEqual(along, { x: 12, z: 0 })
  const turned = pointFromDraw(origin, { x: 1, z: 0 }, { lengthMm: 4500, angleDeg: 90 }, { ortho: true })
  assert.equal(turned.x, 0)
  assert.equal(turned.z, 4.5)
  const near = pointFromDraw(origin, { x: 1, z: 0 }, { lengthMm: 8000, angleDeg: 89.4 }, {})
  assert.equal(near.x, 0)
  assert.ok(Math.abs(near.z - 8) < 0.02)
})

test('an exterior wall reference line is the outer face', () => {
  assert.equal(alignForReference('outer', 'left'), 'right')
  assert.equal(alignForReference('inner', 'left'), 'left')
  assert.equal(alignForReference('center', 'left'), 'center')
  assert.equal(alignForReference('outer', 'right'), 'left')
})
