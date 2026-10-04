import test from 'node:test'
import assert from 'node:assert/strict'
import { exampleHouse } from './floorplan.js'
import { autoRoute, ensureServices, equipmentSnapshot } from './services.js'

test('auto-routing IV, electric and LVI leaves every device in place and only adds routes', () => {
  const house = exampleHouse()
  const nodes = [
    { id: 'eq-ahu', system: 'iv', kind: 'ahu', name: 'IV-kone', x: 3.25, y: 2.3, z: 4.4, size: 160 },
    { id: 'eq-tulo', system: 'iv', kind: 'valve', role: 'tulo', name: 'Tuloventtiili', x: 6.1, y: 2.3, z: 2.2, flow: 12, size: 100 },
    { id: 'eq-poisto', system: 'iv', kind: 'valve', role: 'poisto', name: 'Poistoventtiili', x: 2.2, y: 2.3, z: 6.4, flow: 12, size: 100 },
    { id: 'eq-panel', system: 'electric', kind: 'panel', name: 'Sähkökeskus', x: 1.1, y: 1.4, z: 1.2 },
    { id: 'eq-socket', system: 'electric', kind: 'socket', name: 'Pistorasia', x: 4.4, y: 0.3, z: 2.6, circuit: 2 },
    { id: 'eq-light', system: 'electric', kind: 'light', name: 'Valaisin', x: 5, y: 2.5, z: 3, circuit: 1 },
    { id: 'eq-manifold', system: 'water', kind: 'manifold', name: 'Jakotukki', x: 1.5, y: 0.35, z: 2 },
    { id: 'eq-sink', system: 'water', kind: 'fixture', name: 'Vesipiste', fixtureType: 'sink', hot: true, cold: true, x: 7.2, y: 0.35, z: 3.3 },
    { id: 'eq-heat', system: 'heat', kind: 'floor-manifold', name: 'Lattialämmityksen jakotukki', x: 1.8, y: 0.5, z: 2.4 },
    { id: 'eq-source', system: 'heat', kind: 'heat-source', name: 'Lämmönlähde', x: 1.1, y: 0.9, z: 1.6 },
    { id: 'eq-drain', system: 'drain', kind: 'floor-drain', name: 'Lattiakaivo', x: 8, y: 0, z: 5, size: 75 },
  ]
  const plan = { ...house, services: { ...ensureServices(house), nodes, runs: [] } }
  const systems = ['iv', 'electric', 'water', 'heat', 'drain']
  const before = equipmentSnapshot(plan, systems)
  let next = plan
  for (const system of systems) next = autoRoute(next, system, { floorHeating: true })
  const after = equipmentSnapshot(next, systems)
  assert.deepEqual(after, before)
  assert.equal(next.services.nodes.length, nodes.length)
  const runs = next.services.runs
  const iv = runs.filter((run) => run.system === 'iv')
  const cables = runs.filter((run) => run.system === 'electric' && run.kind === 'wire')
  const pipes = runs.filter((run) => run.system === 'water' || run.system === 'heat' || run.system === 'drain')
  assert.ok(iv.length >= 1)
  assert.ok(cables.length >= 1)
  assert.ok(pipes.length >= 1)
  assert.ok(runs.every((run) => ['iv', 'electric', 'water', 'heat', 'drain'].includes(run.system)))
  assert.ok(iv.some((run) => (run.points || []).some((point) => Math.hypot(point.x - 3.25, point.z - 4.4) < 0.05)))
  assert.equal(next.services.nodes.find((node) => node.id === 'eq-ahu').x, 3.25)
  assert.equal(next.services.nodes.find((node) => node.id === 'eq-ahu').z, 4.4)
})

test('routing with no IV unit or panel does not create equipment', () => {
  const house = exampleHouse()
  const iv = autoRoute(house, 'iv')
  assert.equal(iv.services.nodes.filter((node) => node.system === 'iv').length, 0)
  assert.match(iv.routeNotice, /IV-kone/)
  const withSocket = {
    ...house,
    services: {
      ...ensureServices(house),
      nodes: [{ id: 'sock', system: 'electric', kind: 'socket', name: 'Pistorasia', x: 2, y: 0.3, z: 2 }],
      runs: [],
    },
  }
  const electric = autoRoute(withSocket, 'electric')
  assert.equal(electric.services.nodes.length, 1)
  assert.equal(electric.services.nodes[0].x, 2)
  assert.equal(electric.services.nodes[0].z, 2)
  assert.match(electric.routeNotice, /Sähkökeskus/)
  assert.equal(electric.services.runs.filter((run) => run.system === 'electric').length, 0)
})
