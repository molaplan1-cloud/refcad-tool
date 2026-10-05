import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPlan } from './floorplan.js'
import { applyProjectType, hasHouseElements, isColdProject, stripHouseElements } from './projectMode.js'

test('a cold project is only the kylmio type', () => {
  assert.equal(isColdProject(emptyPlan()), false)
  assert.equal(isColdProject(applyProjectType(emptyPlan(), 'omakotitalo')), false)
  assert.equal(isColdProject(applyProjectType(emptyPlan(), 'kylmio')), true)
})

test('switching to kylmio keeps house walls until removal is confirmed', () => {
  const house = {
    ...emptyPlan('Koti'),
    projectType: 'omakotitalo',
    walls: [{ id: 'w1', a: { x: 0, z: 0 }, b: { x: 6, z: 0 } }],
    fixtures: [{ id: 'f1', type: 'bed' }],
    services: { nodes: [{ id: 'n1' }], runs: [] },
    yard: { terraces: [{ id: 't1' }] },
  }
  assert.equal(hasHouseElements(house), true)
  assert.equal(hasHouseElements({ ...emptyPlan(), rooms: [{ id: 'r1' }] }), true)
  assert.equal(hasHouseElements(emptyPlan()), false)
  const hidden = applyProjectType(house, 'kylmio')
  assert.equal(hidden.projectType, 'kylmio')
  assert.equal(hidden.name, 'Koti')
  assert.equal(hidden.walls.length, 1)
  assert.equal(hidden.fixtures.length, 1)
  assert.equal(hidden.services.nodes.length, 1)
  assert.equal(hidden.yard.terraces.length, 1)
  const removed = stripHouseElements(hidden)
  assert.equal(removed.projectType, 'kylmio')
  assert.equal(removed.name, 'Koti')
  assert.equal(removed.walls.length, 0)
  assert.equal(removed.fixtures.length, 0)
  assert.equal(removed.services.nodes.length, 0)
  assert.equal(hasHouseElements(removed), false)
})
