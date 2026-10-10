import test from 'node:test'
import assert from 'node:assert/strict'
import { detectRooms, drawRoom, exampleHouse, straightenWalls } from './floorplan.js'
import { normalizePlan } from './projects.js'
import { addServiceNode, applyLocation, autoRoute, rewireElectric } from './services.js'
import { applyExampleYard, syncYardServices } from './yard.js'

function panels(plan) {
  return (plan?.services?.nodes || []).filter((node) => node.system === 'electric' && node.kind === 'panel')
}

function placePanel(plan) {
  return addServiceNode(plan, {
    system: 'electric',
    kind: 'panel',
    name: 'Sähkökeskus',
    x: 3.25,
    z: 4.5,
    userPlaced: true,
  })
}

function assertStill(plan, id, x, z, label) {
  const found = panels(plan)
  assert.equal(found.length, 1, label)
  assert.equal(found[0].id, id, label)
  assert.equal(found[0].x, x, label)
  assert.equal(found[0].z, z, label)
}

test('load, locality, routing, walls and room detection leave the sähkökeskus where it was', () => {
  const plan = placePanel(exampleHouse())
  const panel = panels(plan)[0]
  assert.equal(panel.x, 3.25)
  assert.equal(panel.z, 4.5)
  const { id, x, z } = panel
  assertStill(normalizePlan(JSON.parse(JSON.stringify(plan))), id, x, z, 'load')
  assertStill(straightenWalls(plan, 0.5), id, x, z, 'straighten')
  assertStill({ ...plan, rooms: detectRooms(plan.walls, plan.rooms, plan.openings) }, id, x, z, 'detect')
  assertStill(applyLocation(plan, 'SE', 'kiruna'), id, x, z, 'locality')
  const routed = autoRoute(plan, 'electric')
  assertStill(routed, id, x, z, 'route')
  assert.notEqual(routed.routeNotice, 'Lisää ensin sähkökeskus')
  assertStill(rewireElectric(plan), id, x, z, 'rewire')
  assertStill(syncYardServices(plan), id, x, z, 'yard sync')
  const edited = drawRoom(plan, [{ x: 7.4, z: 0.4 }, { x: 11.4, z: 0.4 }, { x: 11.4, z: 5 }, { x: 7.4, z: 5 }], { name: 'Lisähuone', type: 'huone' })
  assertStill(edited, id, x, z, 'draw room')
  assertStill({ ...edited, rooms: detectRooms(edited.walls, edited.rooms, edited.openings) }, id, x, z, 'detect after edit')
  const again = JSON.parse(JSON.stringify(edited))
  assertStill(again, id, x, z, 'undo snapshot')
})

test('routing without a sähkökeskus asks for one and draws nothing', () => {
  const plan = addServiceNode(exampleHouse(), {
    system: 'electric',
    kind: 'socket',
    x: 2,
    z: 2,
    userPlaced: true,
  })
  assert.equal(panels(plan).length, 0)
  const before = (plan.services.runs || []).filter((run) => run.system === 'electric').length
  const routed = autoRoute(plan, 'electric')
  assert.equal(routed.routeNotice, 'Lisää ensin sähkökeskus')
  assert.equal(panels(routed).length, 0)
  assert.equal((routed.services.runs || []).filter((run) => run.system === 'electric').length, before)
  assert.equal(routed.services.nodes.filter((node) => node.kind === 'socket').length, 1)
  assert.equal(routed.services.nodes.find((node) => node.kind === 'socket').x, plan.services.nodes.find((node) => node.kind === 'socket').x)
})

test('the example yard does not invent a sähkökeskus', () => {
  const plan = syncYardServices(applyExampleYard(exampleHouse()))
  assert.equal(panels(plan).length, 0)
  const kept = syncYardServices(placePanel(applyExampleYard(exampleHouse())))
  const panel = panels(kept)[0]
  assert.equal(panels(kept).length, 1)
  assert.equal(panel.x, 3.25)
  assert.equal(panel.z, 4.5)
})
