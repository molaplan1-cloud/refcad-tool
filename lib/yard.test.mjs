import test from 'node:test'
import assert from 'node:assert/strict'
import { exampleHouse } from './floorplan.js'
import {
  addTerrace,
  applyExampleYard,
  buildSitePdf,
  formatSquare,
  formatTerraceLevels,
  hitTestYard,
  patchTerrace,
  plotMetrics,
  setPlot,
  setbackList,
  siteViewLayout,
  syncYardServices,
  terraceElevations,
  terraceFacade,
  terraceSteps,
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
  const wide = setPlot(exampleHouse(), [
    { x: -16, z: -18 },
    { x: 36, z: -18 },
    { x: 36, z: 34 },
    { x: -16, z: 34 },
  ])
  const fitted = siteViewLayout(wide)
  assert.equal(fitted.ratio, 250)
  assert.ok(Math.max(fitted.worldW, fitted.worldH) * fitted.scale > 180)
})

const southDeck = [
  { x: 2, z: 9 },
  { x: 8, z: 9 },
  { x: 8, z: 13 },
  { x: 2, z: 13 },
]

test('a new terrace sits about 50 mm below the finished floor', () => {
  const plan = addTerrace(exampleHouse(), southDeck)
  const item = plan.yard.terraces[0]
  assert.equal(item.levelMm, -50)
  assert.equal(item.levelDatum, 'floor')
  assert.equal(item.steps, false)
  assert.equal(item.railing, false)
  assert.equal(formatTerraceLevels(item), '+0.000 / -0.050')
  const elev = terraceElevations(item)
  assert.equal(elev.deckY, -0.05)
  assert.equal(elev.suggestSteps, false)
  assert.equal(elev.suggestRailing, false)
})

test('a terrace 150 mm below the floor stays under the step and railing thresholds', () => {
  const plan = addTerrace(exampleHouse(), southDeck, { levelMm: -150 })
  const item = plan.yard.terraces[0]
  const elev = terraceElevations(item)
  assert.equal(formatTerraceLevels(item), '+0.000 / -0.150')
  assert.equal(elev.dropFromFloor, 0.15)
  assert.equal(elev.suggestSteps, false)
  assert.equal(elev.suggestRailing, false)
  assert.equal(terraceSteps(item, plan).enabled, false)
})

test('a terrace 600 mm below the floor gets steps and a suggested railing', () => {
  const plan = addTerrace(exampleHouse(), southDeck, { levelMm: -600 })
  const item = plan.yard.terraces[0]
  const elev = terraceElevations(item)
  assert.equal(item.steps, true)
  assert.equal(item.railing, true)
  assert.equal(item.stepsManual, false)
  assert.equal(item.railingManual, false)
  assert.equal(formatTerraceLevels(item), '+0.000 / -0.600')
  assert.ok(elev.fall > 0.5)
  const steps = terraceSteps(item, plan)
  assert.equal(steps.enabled, true)
  assert.equal(steps.direction, 'down')
  assert.ok(steps.count >= 3)
  assert.ok(Math.abs(steps.treads[steps.treads.length - 1].top - elev.deckY) < 0.001)
  const facade = terraceFacade(plan, item, 'south')
  assert.ok(facade)
  assert.equal(facade.label, '+0.000 / -0.600')
  assert.equal(facade.deckY, -0.6)
  assert.equal(facade.steps.count, steps.count)
  assert.equal(terraceFacade(plan, item, 'north'), null)
})

test('ground datum and a manual railing stay independent of the other terrace', () => {
  let plan = addTerrace(exampleHouse(), southDeck, { levelMm: -150, railing: false })
  const first = plan.yard.terraces[0].id
  plan = addTerrace(plan, [
    { x: 2, z: -4 },
    { x: 8, z: -4 },
    { x: 8, z: 0 },
    { x: 2, z: 0 },
  ], { levelMm: -50 })
  plan = patchTerrace(plan, first, { levelDatum: 'ground', inputMm: 250 })
  const lowered = plan.yard.terraces.find((item) => item.id === first)
  const other = plan.yard.terraces.find((item) => item.id !== first)
  assert.equal(lowered.levelDatum, 'ground')
  assert.equal(lowered.levelMm, 250)
  assert.equal(lowered.railing, false)
  assert.equal(lowered.steps, true)
  assert.equal(formatTerraceLevels(lowered), '+0.000 / +0.250')
  assert.equal(terraceElevations(lowered).suggestRailing, false)
  assert.equal(other.levelMm, -50)
  plan = patchTerrace(plan, first, { inputMm: 600, levelDatum: 'ground' })
  const raised = plan.yard.terraces.find((item) => item.id === first)
  assert.equal(raised.railing, false)
  assert.equal(raised.steps, true)
  assert.equal(terraceSteps(raised, plan).direction, 'up')
  assert.ok(terraceSteps(raised, plan).count >= 3)
})
