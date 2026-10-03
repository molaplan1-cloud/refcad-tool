import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cableFor,
  designCurrent,
  planCircuits,
  prepareDevice,
  sizeDevice,
  voltageDrop,
} from './electric.js'
import { addServiceNode, buildElectricPdf, emptyServices } from './services.js'
import { emptyPlan, exampleHouse } from './floorplan.js'

test('400 V 16 A is MMJ 5x2.5 and 230 V 10 A is 3x1.5', () => {
  const three = cableFor(400, 16)
  assert.equal(three.cores, 5)
  assert.equal(three.section, 2.5)
  assert.equal(three.label, '5x2,5')
  const one = cableFor(230, 10)
  assert.equal(one.cores, 3)
  assert.equal(one.section, 1.5)
  assert.equal(one.label, '3x1,5')
})

test('a 9 kW sauna stove and a 400 V stove are 16 A 5x2.5', () => {
  const sauna = sizeDevice('heater')
  assert.equal(sauna.voltage, 400)
  assert.ok(Math.abs(designCurrent(9000, 400, 1) - 12.99) < 0.05)
  assert.equal(sauna.fuse, 16)
  assert.equal(sauna.label, '5x2,5')
  const stove = sizeDevice('stove')
  assert.equal(stove.voltage, 400)
  assert.equal(stove.fuse, 16)
  assert.equal(stove.label, '5x2,5')
  const wet = planCircuits([{ id: 'k', kind: 'heater', roomKind: 'sauna' }])
  assert.equal(wet.circuits[0].fuse, 16)
  assert.equal(wet.circuits[0].cable, 'MMJ 5x2,5')
  assert.equal(wet.circuits[0].rcd, '30 mA')
  const cooker = planCircuits([{ id: 'l', kind: 'stove', roomKind: 'keittio' }])
  assert.equal(cooker.circuits[0].rcd, '')
  const socket = planCircuits([{ id: 's', kind: 'socket', roomKind: 'olohuone' }])
  assert.equal(socket.circuits[0].rcd, '30 mA')
})

test('1-phase groups balance across L1 L2 and L3', () => {
  const plan = planCircuits([
    { id: 'a', kind: 'radiator', power: 2000, voltage: 230, roomId: 'a' },
    { id: 'b', kind: 'radiator', power: 2000, voltage: 230, roomId: 'b' },
    { id: 'c', kind: 'radiator', power: 2000, voltage: 230, roomId: 'c' },
  ])
  assert.equal(plan.circuits.length, 3)
  assert.deepEqual(plan.circuits.map((item) => item.phase).sort(), ['L1', 'L2', 'L3'])
  assert.ok(plan.phaseLoads.L1 > 0 && plan.phaseLoads.L2 > 0 && plan.phaseLoads.L3 > 0)
  assert.match(plan.mainFuse, /^3x\d+ A$/)
})

test('voltage drop warns above 4 percent', () => {
  const fine = voltageDrop({ current: 10, lengthM: 12, section: 1.5, phases: 1, voltage: 230, cosPhi: 1 })
  assert.equal(fine.warning, false)
  const long = voltageDrop({ current: 16, lengthM: 80, section: 1.5, phases: 1, voltage: 230, cosPhi: 1 })
  assert.equal(long.warning, true)
  assert.ok(long.pct > 4)
})

test('adding a device routes a new cable and leaves a locked cable in place', () => {
  let plan = emptyPlan()
  plan.services = emptyServices()
  plan = addServiceNode(plan, { system: 'electric', kind: 'panel', x: 1, z: 1 })
  plan = addServiceNode(plan, { system: 'electric', kind: 'stove', x: 4, z: 1 })
  const stove = plan.services.nodes.find((node) => node.kind === 'stove')
  assert.equal(stove.fuse, 16)
  assert.equal(stove.cable, 'MMJ 5x2,5')
  const supply = plan.services.runs.find((run) => run.deviceId === stove.id || (run.circuit === stove.circuit && run.showMark))
  assert.ok(supply)
  assert.match(supply.marking, /MMJ 5x2,5 \/ R\d+/)
  const frozen = supply.points.map((point) => ({ ...point }))
  plan = {
    ...plan,
    services: {
      ...plan.services,
      runs: plan.services.runs.map((run) => (run.id === supply.id ? { ...run, locked: true } : run)),
    },
  }
  plan = addServiceNode(plan, { system: 'electric', kind: 'socket', x: 4, z: 4 })
  const kept = plan.services.runs.find((run) => run.id === supply.id)
  assert.deepEqual(kept.points, frozen)
  const socket = plan.services.nodes.find((node) => node.kind === 'socket')
  assert.ok(plan.services.runs.some((run) => run.deviceId === socket.id || run.circuit === socket.circuit))
  assert.equal(socket.rcd, true)
  assert.ok(plan.services.electric.circuits.length >= 2)
})

test('a socket placed on a wall stays in its room and gets a cable', () => {
  const plan = addServiceNode(exampleHouse(), { system: 'electric', kind: 'socket', x: 0, z: 2.6 })
  const socket = plan.services.nodes.find((node) => node.kind === 'socket')
  assert.equal(socket.roomKind, 'olohuone')
  assert.equal(socket.rcd, true)
  assert.ok(plan.services.runs.some((run) => run.deviceId === socket.id))
})

test('an undersized fuse or cable warns and stays overridable', () => {
  const device = prepareDevice({ kind: 'stove', fuseManual: true, fuse: 10 })
  assert.equal(device.recommendedFuse, 16)
  assert.match(device.warning, /10 A/)
  assert.match(device.warning, /1\.5 mm/)
  const doc = buildElectricPdf(addServiceNode(addServiceNode(Object.assign(emptyPlan(), { services: emptyServices() }), { system: 'electric', kind: 'panel', x: 1, z: 1 }), { system: 'electric', kind: 'heater', x: 3, z: 2 }))
  assert.equal(doc.getNumberOfPages(), 3)
  assert.match(doc.output(), /5x2,5/)
})
