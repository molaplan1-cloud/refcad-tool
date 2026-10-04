import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPlan } from './floorplan.js'
import { ensureServices } from './services.js'
import { placeServiceNode, removeStacked, REPEAT_MS } from './placeOnce.js'

const socket = { system: 'electric', kind: 'socket', name: 'Pistorasia', x: 1.2, z: 0.4 }

function socketsOf(plan) {
  return ensureServices(plan).nodes.filter((item) => item.kind === 'socket')
}

test('one click places exactly one socket', () => {
  let plan = emptyPlan()
  let last = null
  const down = { at: 1000, px: 80, py: 120, x: socket.x, z: socket.z }
  const first = placeServiceNode(plan, socket, down, last)
  assert.equal(first.placed, true)
  assert.equal(first.verdict.action, 'place')
  plan = first.plan
  last = first.last

  const up = { at: 1016, px: 82, py: 121, x: socket.x, z: socket.z }
  const second = placeServiceNode(plan, socket, up, last)
  assert.equal(second.placed, false)
  assert.equal(second.verdict.action, 'ignore')
  plan = second.plan
  assert.equal(socketsOf(plan).length, 1)

  const later = placeServiceNode(
    plan,
    socket,
    { at: 1000 + REPEAT_MS + 80, px: 180, py: 220, x: socket.x, z: socket.z },
    second.last,
  )
  assert.equal(later.placed, false)
  assert.equal(later.verdict.action, 'duplicate')
  assert.equal(later.verdict.existing.kind, 'socket')
  assert.equal(socketsOf(later.plan).length, 1)
})

test('cleanup removes an exact duplicate socket and keeps one', () => {
  let plan = placeServiceNode(emptyPlan(), socket, { at: 1, px: 0, py: 0 }, null).plan
  const services = ensureServices(plan)
  const existing = services.nodes.find((item) => item.kind === 'socket')
  plan = {
    ...plan,
    services: { ...services, nodes: [...services.nodes, { ...existing, id: 'svc-dup' }] },
  }
  assert.equal(socketsOf(plan).length, 2)
  const cleaned = removeStacked(plan)
  assert.equal(cleaned.removed, 1)
  assert.equal(socketsOf(cleaned.plan).length, 1)
})
