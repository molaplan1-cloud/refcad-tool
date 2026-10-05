import test from 'node:test'
import assert from 'node:assert/strict'
import { dropDegenerateWalls, guidesAllowed, releaseGuides, visibleSnap } from './guides.js'

const verticalGuide = {
  point: { x: 4, z: 2 },
  kind: 'align',
  guides: [{ x1: 4, z1: 0, x2: 4, z2: 18 }],
}

test('alignment guides clear when the gesture ends or the pointer leaves', () => {
  const shown = visibleSnap(verticalGuide, guidesAllowed({ tool: 'exterior', pointerInside: true }))
  assert.equal(shown.guides.length, 1)
  assert.equal(visibleSnap(verticalGuide, guidesAllowed({ tool: 'exterior', pointerInside: false })), null)
  assert.equal(visibleSnap(verticalGuide, guidesAllowed({ tool: 'select', pointerInside: true })), null)
  assert.equal(visibleSnap(verticalGuide, guidesAllowed({ tool: 'door', pointerInside: true }))?.kind, 'align')
  const released = releaseGuides()
  assert.equal(released.snap, null)
  assert.equal(released.track, null)
  assert.equal(released.drawGuide, null)
  assert.equal(released.preview, null)
  assert.equal(visibleSnap(released.snap, guidesAllowed({ tool: 'exterior' })), null)
})

test('a zero-length wall is dropped and a real wall stays', () => {
  const plan = dropDegenerateWalls({
    walls: [
      { id: 'real', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, thickness: 0.24 },
      { id: 'dot', a: { x: 4, z: 0 }, b: { x: 4, z: 0 }, thickness: 0.24 },
      { id: 'hair', a: { x: 1, z: 0 }, b: { x: 1, z: 0.01 }, thickness: 0 },
    ],
    openings: [
      { id: 'keep', wallId: 'real' },
      { id: 'gone', wallId: 'dot' },
    ],
  })
  assert.deepEqual(plan.walls.map((wall) => wall.id), ['real'])
  assert.deepEqual(plan.openings.map((opening) => opening.id), ['keep'])
  assert.equal(dropDegenerateWalls(plan), plan)
})
