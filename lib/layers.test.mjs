import test from 'node:test'
import assert from 'node:assert/strict'
import { applyDisplay } from './display.js'
import { exampleHouse, buildFloorPlanPdf, sheetServiceItems } from './floorplan.js'
import { layerEyeOn, layerStored, pinnedLayers, setEveryLayer, setLayerEye } from './layers.js'
import { addServiceNode, setServiceLayer } from './services.js'

test('layer eyes and the Näytä panel share one stored flag', () => {
  let plan = exampleHouse()
  assert.equal(layerEyeOn(plan, 'electric', 'rakenne'), true)
  assert.equal(layerStored(plan, 'electric'), true)
  plan = setLayerEye(plan, 'electric', false, 'rakenne', 'plan')
  assert.equal(plan.services.layers.electric, false)
  assert.equal(layerEyeOn(plan, 'electric', 'rakenne'), false)
  assert.equal(layerStored(plan, 'electric'), false)
  plan = setServiceLayer(plan, 'iv', false)
  assert.equal(layerEyeOn(plan, 'iv', 'rakenne'), false)
  plan = setLayerEye(plan, 'fixtures', false, 'rakenne', 'plan')
  assert.equal(plan.display.fixtures, false)
  assert.equal(plan.sheetDisplay.plan.fixtures, false)
  assert.equal(layerEyeOn(plan, 'fixtures', 'rakenne', 'plan'), false)
})

test('the active tab stays visible and show-all / hide-all leave it pinned', () => {
  let plan = setEveryLayer(exampleHouse(), false, 'sahko', 'plan')
  assert.deepEqual(pinnedLayers('sahko'), ['electric'])
  assert.equal(layerEyeOn(plan, 'electric', 'sahko'), true)
  assert.equal(layerStored(plan, 'electric'), true)
  assert.equal(layerEyeOn(plan, 'iv', 'sahko'), false)
  assert.equal(layerEyeOn(plan, 'water', 'sahko'), false)
  assert.equal(layerEyeOn(plan, 'fixtures', 'sahko'), false)
  plan = setLayerEye(plan, 'electric', false, 'sahko', 'plan')
  assert.equal(layerStored(plan, 'electric'), true)
  plan = setEveryLayer(plan, false, 'lvi', 'plan')
  assert.equal(layerEyeOn(plan, 'water', 'lvi'), true)
  assert.equal(layerEyeOn(plan, 'heat', 'lvi'), true)
  assert.equal(layerEyeOn(plan, 'drain', 'lvi'), true)
  assert.equal(layerStored(plan, 'electric'), false)
  plan = setEveryLayer(plan, false, 'kalusteet', 'plan')
  assert.equal(layerEyeOn(plan, 'fixtures', 'kalusteet', 'plan'), true)
  assert.equal(layerStored(plan, 'fixtures', 'plan'), false)
  let pinned = setEveryLayer(exampleHouse(), true, 'kalusteet', 'plan')
  pinned = setEveryLayer(pinned, false, 'kalusteet', 'plan')
  assert.equal(layerStored(pinned, 'fixtures', 'plan'), true)
  assert.equal(layerEyeOn(pinned, 'fixtures', 'kalusteet', 'plan'), true)
  assert.equal(layerStored(pinned, 'electric'), false)
  assert.equal(layerEyeOn(pinned, 'electric', 'kalusteet'), false)
  plan = setEveryLayer(exampleHouse(), false, 'iv', 'plan')
  plan = setEveryLayer(plan, true, 'rakenne', 'plan')
  assert.equal(layerStored(plan, 'drain'), true)
  assert.equal(layerStored(plan, 'fixtures', 'plan'), true)
  assert.equal(layerEyeOn(plan, 'ground', 'piha'), true)
})

test('a hidden layer drops out of the PDF unless that tab forces it', () => {
  const house = addServiceNode(exampleHouse(), {
    system: 'electric',
    kind: 'panel',
    x: 2,
    z: 2,
    userPlaced: true,
  })
  const hidden = setLayerEye(applyDisplay(house, { fixtures: false }, 'plan'), 'electric', false, 'rakenne', 'plan')
  const off = sheetServiceItems(hidden)
  assert.equal(off.nodes.some((node) => node.kind === 'panel'), false)
  assert.equal(off.fixtures.length, 0)
  assert.equal(buildFloorPlanPdf(hidden).output().includes('SK'), false)
  const forced = sheetServiceItems(hidden, { forceSystems: ['electric'], forceFixtures: true })
  assert.equal(forced.nodes.some((node) => node.kind === 'panel'), true)
  assert.ok(forced.fixtures.length > 0)
  assert.equal(buildFloorPlanPdf(hidden, { forceSystems: ['electric'], forceFixtures: true }).output().includes('SK'), true)
  const shown = setLayerEye(applyDisplay(hidden, { fixtures: true }, 'plan'), 'electric', true, 'rakenne', 'plan')
  assert.equal(sheetServiceItems(shown).nodes.some((node) => node.kind === 'panel'), true)
  assert.ok(sheetServiceItems(shown).fixtures.length > 0)
})
