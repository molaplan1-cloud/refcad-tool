import assert from 'node:assert/strict'
import test from 'node:test'
import { exampleHouse } from './floorplan.js'
import { elementMenu, everyElementTarget } from './menus.js'
import {
  deleteProject,
  exportPlanJson,
  importPlanJson,
  loadLibrary,
  projectById,
  renameProject,
  saveProject,
  shellPlan,
} from './projects.js'

test('a new shell can stay empty or grow a rectangular outer wall', () => {
  const blank = shellPlan({ name: 'Tyhjä', createWalls: false, floorHeight: 2.7, exteriorThickness: 0.3, roofType: 'hip', roofPitch: 30 })
  assert.equal(blank.walls.length, 0)
  assert.equal(blank.name, 'Tyhjä')
  assert.equal(blank.floorHeight, 2.7)
  assert.equal(blank.exteriorThickness, 0.3)
  assert.equal(blank.roofType, 'hip')
  assert.equal(blank.roofPitch, 30)
  assert.ok(blank.projectId)
  const house = shellPlan({ length: 12, width: 9, createWalls: true, exteriorThickness: 0.2 })
  assert.equal(house.walls.length, 4)
  assert.equal(house.walls.every((wall) => wall.kind === 'exterior'), true)
  assert.equal(house.rooms.length > 0, true)
  const xs = house.walls.flatMap((wall) => [wall.a.x, wall.b.x])
  const zs = house.walls.flatMap((wall) => [wall.a.z, wall.b.z])
  assert.equal(Math.max(...xs) - Math.min(...xs), 12)
  assert.equal(Math.max(...zs) - Math.min(...zs), 9)
})

test('saved plans can be renamed, opened and deleted without loading the example', () => {
  const first = shellPlan({ name: 'Aita', projectId: 'plan-a', createWalls: false })
  const second = shellPlan({ name: 'Mökki', projectId: 'plan-b', length: 8, width: 6, createWalls: true })
  let library = saveProject({ projects: [] }, first)
  library = saveProject(library, second)
  assert.deepEqual(library.projects.map((item) => item.id), ['plan-b', 'plan-a'])
  library = renameProject(library, 'plan-a', 'Varasto')
  assert.equal(projectById(library, 'plan-a').name, 'Varasto')
  assert.equal(projectById(library, 'plan-a').plan.name, 'Varasto')
  const opened = projectById(library, 'plan-b').plan
  assert.equal(opened.walls.length, 4)
  assert.equal(opened.name === 'Esimerkkitalo', false)
  library = deleteProject(library, 'plan-b')
  assert.equal(projectById(library, 'plan-b'), null)
  assert.equal(library.projects.length, 1)
  const raw = JSON.stringify(library)
  assert.equal(loadLibrary(raw).projects[0].id, 'plan-a')
  assert.equal(loadLibrary('ei json').projects.length, 0)
  const example = exampleHouse()
  assert.equal(example.name, 'Esimerkkitalo')
  assert.equal(loadLibrary(null).projects.some((item) => item.plan?.name === 'Esimerkkitalo'), false)
})

test('a plan exports and imports as JSON', () => {
  const plan = shellPlan({ name: 'Vienti', projectId: 'plan-json', length: 10, width: 7, createWalls: true })
  const text = exportPlanJson(plan)
  const back = importPlanJson(text)
  assert.equal(back.name, 'Vienti')
  assert.equal(back.projectId, 'plan-json')
  assert.equal(back.walls.length, 4)
  assert.throws(() => importPlanJson('{"name":"ei"}'), /pohjakuva/)
  assert.throws(() => importPlanJson('['), /JSON|Unexpected|pohjakuva/)
})

test('every element type has its own settings menu', () => {
  const targets = everyElementTarget()
  const labels = targets.map((item) => item.label)
  ;['seinä', 'ovi', 'ikkuna', 'huone', 'kaluste', 'julkisivuvyöhyke', 'katto', 'talo', 'IV-kone', 'Tuloventtiili', 'Tulokanava', 'Jakotukki', 'Lattiakaivo', 'Kokoojaviemäri', 'Pistorasia', 'Kytkin', 'Valaisin', 'Sähkökeskus'].forEach((label) => {
    assert.equal(labels.includes(label), true, label)
  })
  targets.forEach((target) => {
    const menu = elementMenu(target)
    assert.ok(menu.length > 0, target.label)
    assert.ok(menu.some((field) => field !== 'delete'), `${target.label} settings`)
  })
  assert.ok(elementMenu({ kind: 'wall' }).includes('cladding'))
  assert.ok(elementMenu({ kind: 'door' }).includes('swing'))
  assert.ok(elementMenu({ kind: 'window' }).includes('sill'))
  assert.ok(elementMenu({ kind: 'fixture' }).includes('rotate'))
  assert.ok(elementMenu({ kind: 'zone' }).includes('material'))
  assert.ok(elementMenu({ kind: 'roof' }).includes('pitch'))
  assert.ok(elementMenu({ kind: 'house' }).includes('thickness'))
  assert.ok(elementMenu({ kind: 'service', serviceKind: 'valve', system: 'iv', mode: 'node' }).includes('flow'))
  assert.ok(elementMenu({ kind: 'service', serviceKind: 'branch', system: 'drain', mode: 'run' }).includes('slope'))
  assert.ok(elementMenu({ kind: 'service', serviceKind: 'socket', system: 'electric', mode: 'node' }).includes('circuit'))
  assert.ok(elementMenu({ kind: 'service', serviceKind: 'floor-drain', system: 'drain', mode: 'node' }).includes('size'))
})
