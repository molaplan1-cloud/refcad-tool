import test from 'node:test'
import assert from 'node:assert/strict'
import { floorHeatDensity, floorLoops, heatedArea, heatingObstacles, heatFlowLs, pexSize, roomHeatLoss, tankElectric } from './hydronic.js'
import { addServiceNode, applyHeating, refreshHeat, rewireHeat, updateServiceNode } from './services.js'
import { heatingLoads } from './roominfo.js'
import { emptyPlan, exampleHouse, updateRoom } from './floorplan.js'

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
  const edge = 0.1
  loops.forEach((loop) => {
    loop.points.forEach((point) => {
      assert.ok(point.x >= edge && point.x <= 8 - edge && point.z >= edge && point.z <= 6 - edge)
    })
    const curved = loop.points.some((point, index) => {
      if (!index) return false
      const prev = loop.points[index - 1]
      return Math.abs(point.x - prev.x) > 0.01 && Math.abs(point.z - prev.z) > 0.01
    })
    assert.equal(curved, true)
  })
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
  const house = ['sink', 'shower', 'wc', 'washer', 'outdoor'].reduce((current, pointType, index) => (
    addServiceNode(current, { system: 'water', kind: 'water-point', pointType, x: 2 + index, z: 2 })
  ), exampleHouse())
  assert.equal(house.services.water.coldFlow, 0.9)
  assert.equal(house.services.water.hotFlow, 0.4)
  assert.equal(house.services.water.coldSize, 25)
  assert.equal(house.services.water.hotSize, 20)
})

test('radiators and floor loops follow the calculated room heat loss', () => {
  const house = exampleHouse()
  const loads = heatingLoads(house).filter((item) => item.floorArea >= 4 && !/sauna/i.test(item.name || ''))
  assert.ok(loads.length >= 2)
  const plan = rewireHeat(applyHeating(house, { source: 'district', distribution: 'both', buffer: false }))
  assert.ok(plan.services.heat.demandPower > 0)
  loads.forEach((load) => {
    const expected = Math.round(load.watts)
    const rads = plan.services.heat.radiators.filter((row) => row.roomName === load.name)
    assert.ok(rads.length >= 1, load.name)
    const share = Math.max(200, Math.round(expected / rads.length))
    assert.equal(rads.reduce((sum, row) => sum + row.power, 0), share * rads.length)
    const loops = plan.services.heat.loops.filter((row) => row.roomName === load.name)
    assert.ok(loops.length >= 1, load.name)
    const each = Math.round(expected / loops.length)
    assert.ok(loops.every((row) => row.power === each), load.name)
  })
  const cold = rewireHeat(applyHeating({ ...house, thermal: { zone: 'IV', year: 1970, energyClass: 'G' } }, { source: 'district', distribution: 'radiator' }))
  const mild = rewireHeat(applyHeating({ ...house, thermal: { zone: 'I', year: 2020, energyClass: 'A' } }, { source: 'district', distribution: 'radiator' }))
  const coldPower = cold.services.heat.radiators.reduce((sum, row) => sum + row.power, 0)
  const mildPower = mild.services.heat.radiators.reduce((sum, row) => sum + row.power, 0)
  assert.ok(coldPower > mildPower)
})

test('floor heating loops and radiators are generated from the house settings', () => {
  const plan = rewireHeat(applyHeating(exampleHouse(), { source: 'ground', distribution: 'both', buffer: true, bufferLitres: 200 }))
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

test('spiral loops stay within 100 m and obstacles stay out of the heated zone', () => {
  const room = {
    id: 'r',
    name: 'Olohuone',
    area: 24,
    polygon: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }],
  }
  const spiral = floorLoops(room, { spacing: 0.2, maxLength: 100, pattern: 'spiral' })
  assert.ok(spiral.length >= 1)
  assert.ok(spiral.every((loop) => loop.length <= 100.05))
  const shower = { minX: 4.2, maxX: 5.7, minZ: 2.4, maxZ: 3.7, type: 'shower' }
  const clipped = floorLoops(room, { spacing: 0.2, maxLength: 100, obstacles: [shower] })
  assert.ok(clipped.length >= 1)
  clipped.forEach((loop) => {
    loop.points.forEach((point) => {
      const inside = point.x > shower.minX && point.x < shower.maxX && point.z > shower.minZ && point.z < shower.maxZ
      assert.equal(inside, false)
    })
  })
  const obstacles = heatingObstacles({
    polygon: room.polygon,
  }, [{ type: 'shower', x: 5, z: 3, w: 0.9, d: 0.9, rotation: 0 }])
  assert.equal(obstacles.length, 1)
  assert.ok(heatedArea(room, obstacles) < room.area)
  assert.equal(floorHeatDensity('kylpyhuone'), 140)
  assert.equal(floorHeatDensity('olohuone'), 100)
  assert.equal(floorHeatDensity('kylpyhuone', 160), 160)
})

test('room settings choose water loops, electric floor heating and electric radiators', () => {
  const house = exampleHouse()
  const living = house.rooms.find((room) => room.name === 'Olohuone')
  const wc = house.rooms.find((room) => room.name === 'WC')
  const bed = house.rooms.find((room) => room.name === 'Makuuhuone')
  const kitchen = house.rooms.find((room) => room.name === 'Keittiö')
  let plan = addServiceNode(house, { system: 'electric', kind: 'panel', x: 1.5, z: 1.5, userPlaced: true })
  plan = updateRoom(plan, living.id, { heating: { methods: ['wfloor'], spacing: 0.2, pattern: 'serpentine' } })
  plan = updateRoom(plan, wc.id, { heating: { methods: ['efloor'], spacing: 0.15, pattern: 'serpentine' } })
  plan = updateRoom(plan, bed.id, { heating: { methods: ['erad'], spacing: 0.15, pattern: 'serpentine' } })
  plan = updateRoom(plan, kitchen.id, { heating: { methods: ['none'] } })
  plan = rewireHeat(refreshHeat(plan))
  const loops = plan.services.heat.loops.filter((loop) => loop.roomId === living.id)
  assert.ok(loops.length >= 1)
  assert.ok(loops.every((loop) => loop.length <= 100.05))
  assert.ok(loops.every((loop) => loop.area > 0 && loop.spacing === 0.2 && loop.outlet > 0))
  assert.equal(plan.services.heat.loops.some((loop) => loop.roomId === kitchen.id), false)
  assert.equal(plan.services.heat.loops.some((loop) => loop.roomId === wc.id), false)
  const manifold = plan.services.nodes.find((node) => node.kind === 'floor-manifold')
  assert.ok(manifold)
  assert.ok(plan.services.heat.manifolds.some((row) => row.id === manifold.id && row.outlets === loops.length))
  assert.ok(plan.services.runs.some((run) => run.kind === 'floorheat' && run.roomId === living.id && run.dashed && run.points.every((point) => point.y < 0.05)))
  assert.ok(plan.services.runs.some((run) => run.role === 'feeder' && run.roomId === living.id && run.dashed))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'thermostat' && node.roomId === living.id))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'actuator' && node.roomId === living.id))
  const panels = plan.services.nodes.filter((node) => node.kind === 'panel')
  assert.equal(panels.length, 1)
  assert.equal(panels[0].x, 1.5)
  assert.equal(panels[0].z, 1.5)
  const pump = plan.services.nodes.find((node) => node.kind === 'manifold-pump')
  assert.ok(pump)
  assert.equal(pump.dedicated, true)
  assert.ok(pump.circuit)
  assert.match(pump.cable, /MMJ/)
  const mat = plan.services.nodes.find((node) => node.kind === 'floor-heat' && node.roomId === wc.id)
  assert.ok(mat)
  assert.equal(mat.dedicated, true)
  assert.equal(mat.rcd, true)
  assert.equal(mat.voltage, 230)
  assert.ok(mat.power >= 200)
  assert.equal(mat.wattsPerM2, 140)
  assert.ok(Math.abs(mat.power - Math.round(mat.heatArea * 140)) < 2)
  assert.ok(mat.circuit)
  assert.match(mat.cable, /MMJ/)
  assert.ok(plan.services.runs.some((run) => run.kind === 'efloor' && run.roomId === wc.id && run.dashed))
  assert.ok(plan.services.runs.some((run) => run.kind === 'sensor' && run.roomId === wc.id))
  assert.ok(plan.services.nodes.some((node) => node.kind === 'thermostat' && node.roomId === wc.id && node.sensor))
  const rads = plan.services.nodes.filter((node) => node.kind === 'radiator' && node.roomId === bed.id)
  assert.ok(rads.length >= 1)
  assert.ok(rads.every((node) => node.dedicated && node.heatAuto && node.power >= 200))
  assert.equal(new Set(rads.map((node) => node.circuit)).size, rads.length)
  const electric = plan.services.heat.electric
  assert.ok(electric.some((row) => row.kind === 'floor-heat' && row.roomId === wc.id && row.circuit))
  assert.ok(electric.some((row) => row.kind === 'manifold-pump'))
  assert.ok(electric.some((row) => row.kind === 'actuator' && row.roomId === living.id))
  const before = plan.services.nodes.length
  plan = refreshHeat(updateRoom(plan, wc.id, { heating: { methods: ['none'] } }))
  assert.equal(plan.services.nodes.length, before)
  assert.equal(plan.services.nodes.some((node) => node.kind === 'floor-heat' && node.roomId === wc.id), true)
  assert.ok(plan.services.heat.loops.some((loop) => loop.roomId === living.id))
})
