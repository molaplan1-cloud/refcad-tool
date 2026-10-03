import test from 'node:test'
import assert from 'node:assert/strict'
import { floorLoops, heatFlowLs, pexSize, roomHeatLoss, tankElectric } from './hydronic.js'
import { addServiceNode, applyHeating, updateServiceNode } from './services.js'
import { emptyPlan, exampleHouse } from './floorplan.js'

test('PEX size follows the summed design flow', () => {
  assert.equal(pexSize(0.2), 16)
  assert.equal(pexSize(0.4), 20)
  assert.equal(pexSize(0.8), 25)
  assert.equal(pexSize(1.1), 32)
  const cold = 0.2 + 0.2 + 0.1 + 0.2 + 0.2 + 0.2
  assert.equal(pexSize(cold), 32)
  assert.equal(pexSize(0.2 + 0.2), 20)
})

test('floor loops stay within 100 m', () => {
  const room = {
    id: 'r',
    name: 'Olohuone',
    area: 48,
    polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }],
  }
  const loops = floorLoops(room, { spacing: 0.3, maxLength: 100 })
  assert.ok(loops.length >= 2)
  assert.ok(loops.every((loop) => loop.length <= 100.05))
  assert.ok(loops.every((loop) => loop.length > 10))
  const small = floorLoops({ polygon: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }] }, { spacing: 0.3 })
  assert.equal(small.length, 1)
  assert.ok(small[0].length <= 100)
})

test('a radiator is sized from room area and a 300 l tank is 400 V', () => {
  const loss = roomHeatLoss(20, 'olohuone')
  assert.equal(loss.wattsPerM2, 40)
  assert.equal(loss.power, 800)
  assert.ok(heatFlowLs(800, 10) > 0.01 && heatFlowLs(800, 10) < 0.03)
  const tank = tankElectric(300, 'electric')
  assert.equal(tank.voltage, 400)
  assert.equal(tank.power, 6000)
})

test('adding a water point re-routes and a locked pipe stays', () => {
  let plan = addServiceNode(exampleHouse(), { system: 'water', kind: 'water-point', pointType: 'sink', x: 9.4, z: 1.4 })
  const sink = plan.services.nodes.find((node) => node.pointType === 'sink')
  assert.equal(sink.supply, 'both')
  assert.equal(sink.flowCold, 0.2)
  const coldMain = plan.services.runs.find((run) => run.system === 'water' && run.kind === 'cold' && run.role === 'main')
  assert.equal(coldMain.size, 16)
  assert.ok(plan.services.runs.some((run) => run.kind === 'hot' && run.size === 16))
  const tank = plan.services.nodes.find((node) => node.kind === 'dhw-tank')
  assert.equal(tank.litres, 300)
  const electric = plan.services.nodes.find((node) => node.linkedFrom === tank.id)
  assert.equal(electric.voltage, 400)
  assert.equal(electric.power, 6000)
  const branch = plan.services.runs.find((run) => run.deviceId === sink.id)
  const frozen = branch.points.map((point) => ({ ...point }))
  plan = {
    ...plan,
    services: {
      ...plan.services,
      runs: plan.services.runs.map((run) => (run.id === branch.id ? { ...run, locked: true } : run)),
    },
  }
  plan = addServiceNode(plan, { system: 'water', kind: 'water-point', pointType: 'shower', x: 6.6, z: 7.4 })
  const kept = plan.services.runs.find((run) => run.id === branch.id)
  assert.deepEqual(kept.points, frozen)
  assert.ok(plan.services.runs.filter((run) => run.system === 'water' && run.kind === 'cold').length >= 2)
  const shower = plan.services.nodes.find((node) => node.pointType === 'shower')
  assert.ok(plan.services.runs.some((run) => run.deviceId === shower.id))
  plan = updateServiceNode(plan, sink.id, { circulation: true })
  assert.ok(plan.services.runs.some((run) => run.kind === 'circ'))
})

test('floor heating loops and radiators are generated from the house settings', () => {
  const plan = applyHeating(exampleHouse(), { source: 'ground', distribution: 'both', buffer: true, bufferLitres: 200 })
  const heat = plan.services.heat
  assert.equal(heat.sourceId, 'ground')
  assert.ok(heat.loops.length >= 2)
  assert.ok(heat.loops.every((loop) => loop.length <= 100.05))
  assert.ok(heat.radiators.length >= 1)
  assert.ok(heat.radiators.every((row) => row.power >= 200))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'heat-source' && node.source === 'ground'))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'buffer-tank'))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'floor-manifold'))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'thermostat'))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'actuator'))
  const pump = plan.services.nodes.find((node) => node.kind === 'heatpump' && node.linkedFrom)
  assert.equal(pump.voltage, 400)
  assert.equal(pump.power, 6000)
  assert.ok(plan.services.runs.some((run) => run.kind === 'floorheat' && run.points.every((point) => point.y < 0.05)))
  const empty = applyHeating(emptyPlan(), { source: 'direct-electric', distribution: 'none' })
  assert.equal(empty.services.heat.distribution, 'none')
})
