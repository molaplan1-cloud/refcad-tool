import test from 'node:test'
import assert from 'node:assert/strict'
import { exampleHouse } from './floorplan.js'
import {
  applyExampleYard,
  buildSitePdf,
  formatSquare,
  hitTestYard,
  plotMetrics,
  setbackList,
  syncYardServices,
} from './yard.js'

test('a plot has an area, edge lengths and setbacks to the house', () => {
  const plan = applyExampleYard(exampleHouse())
  const metrics = plotMetrics(plan)
  assert.ok(metrics.area > 700)
  assert.equal(metrics.edges.length, 5)
  assert.ok(metrics.perimeter > metrics.edges[0].length)
  const setbacks = setbackList(plan)
  assert.equal(setbacks.length, 5)
  assert.ok(setbacks.some((edge) => edge.dist > 8 && edge.dist < 11))
  assert.match(formatSquare(metrics.area), /m²/)
  assert.equal(plan.yard.terraces[0].railing, true)
  assert.equal(plan.yard.terraces[0].steps, true)
  assert.ok(plan.yard.terraces[0].wallId)
  assert.ok(plan.yard.plants.some((item) => item.kind === 'conifer' && item.canopy > 1))
  assert.ok(plan.yard.buildings.some((item) => item.kind === 'garage' && item.roof === 'gable'))
  assert.ok(plan.yard.fences.some((item) => item.gates?.length))
})

test('plants, paths and the plot are selectable', () => {
  const plan = applyExampleYard(exampleHouse())
  const tree = plan.yard.plants.find((item) => item.kind === 'deciduous')
  const hit = hitTestYard(plan, { x: tree.x, z: tree.z })
  assert.equal(hit.collection, 'plants')
  assert.equal(hit.id, tree.id)
  const path = hitTestYard(plan, { x: 3.5, z: -6 })
  assert.equal(path.collection, 'paths')
  const outside = hitTestYard(plan, { x: 40, z: 40 })
  assert.equal(outside, null)
})

test('yard lights, a charger and the wells join the service layers', () => {
  const plan = syncYardServices(applyExampleYard(exampleHouse()))
  const electric = plan.services.nodes.filter((node) => node.system === 'electric' && String(node.linkedFrom || '').startsWith('yard:'))
  assert.ok(electric.some((node) => node.kind === 'light' && node.outdoor && node.ip === 'IP65'))
  assert.ok(electric.some((node) => node.kind === 'ev' && node.outdoor))
  assert.ok(electric.some((node) => node.name.includes('Poreallas')))
  const water = plan.services.nodes.filter((node) => node.system === 'water' && String(node.linkedFrom || '').startsWith('yard:'))
  assert.ok(water.some((node) => node.pointType === 'well'))
  assert.ok(water.some((node) => node.pointType === 'rainwell'))
  const circuits = plan.services.electric.circuits
  const yardLight = circuits.find((circuit) => circuit.description === 'Pihavalaistus')
  assert.ok(yardLight)
  assert.match(yardLight.cable, /^MCMK /)
  assert.equal(yardLight.rcd, '30 mA')
  assert.ok(yardLight.deviceIds.length >= 2)
  const charger = circuits.find((circuit) => /Autolaturi/.test(circuit.description))
  assert.ok(charger)
  assert.equal(charger.topology, 'radial')
  assert.match(charger.cable, /^MCMK /)
  const saved = JSON.parse(JSON.stringify(plan.yard))
  assert.equal(saved.plot.points.length, 5)
  assert.ok(saved.objects.length > 8)
})

test('the site sheet is a landscape drawing with a scale', () => {
  const plan = applyExampleYard(exampleHouse())
  const doc = buildSitePdf(plan)
  const raw = doc.output()
  assert.match(raw, /Asemapiirros/)
  assert.match(raw, /1:200|1:500|1:100/)
})
