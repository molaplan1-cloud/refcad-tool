import assert from 'node:assert/strict'
import test from 'node:test'
import { addServiceNode, autoRoute, commitRunGeometry, emptyServices, rerouteRun, splitServiceRun, updateServiceNode, updateServiceRun } from './services.js'
import { exampleHouse, emptyPlan } from './floorplan.js'
import {
  followEndpoint,
  insertRisers,
  joinPoints,
  moveVertexPoints,
  routeLength,
  setPointsHeight,
  splitPoints,
} from './routeEdit.js'

test('a height change inserts an explicit riser', () => {
  const flat = [
    { x: 0, y: 2.4, z: 0 },
    { x: 3, y: 2.4, z: 0 },
    { x: 3, y: 0.3, z: 1 },
  ]
  const raised = insertRisers(flat)
  const riser = raised.find((point) => point.riser)
  assert.ok(riser)
  assert.equal(riser.vertical, 'lasku')
  const vertical = raised.some((point, index) => {
    if (!index) return false
    const prev = raised[index - 1]
    return Math.hypot(point.x - prev.x, point.z - prev.z) < 0.04 && Math.abs(point.y - prev.y) > 0.2
  })
  assert.equal(vertical, true)
  const withMode = setPointsHeight(flat, 0.05, { mode: 'floor' })
  assert.ok(withMode.some((point) => point.riser || Math.abs((point.y || 0) - 0.05) < 0.02))
})

test('dragging a vertex changes the route length', () => {
  const points = [
    { x: 0, y: 2.4, z: 0 },
    { x: 2, y: 2.4, z: 0 },
    { x: 2, y: 2.4, z: 2 },
  ]
  const before = routeLength(points)
  const moved = moveVertexPoints(points, 1, { x: 4, z: 0 }, { ortho: true })
  assert.ok(routeLength(moved) > before + 1)
  assert.equal(moved[1].z, 0)
})

test('split and join keep a continuous manual route', () => {
  const points = [
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 2, y: 1, z: 2 },
  ]
  const parts = splitPoints(points, 0, 0.5)
  assert.equal(parts.left.length >= 2, true)
  assert.equal(parts.right[0].x, 1)
  const joined = joinPoints(parts.left, parts.right)
  assert.ok(joined.length >= 3)
  assert.ok(Math.abs(routeLength(joined) - routeLength(points)) < 0.05)
})

test('a moved device pulls the locked route end with it', () => {
  const points = [
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
  ]
  const same = followEndpoint(points, { x: 9, z: 9 }, { x: 3, z: 0 })
  assert.equal(same, points)
  const followed = followEndpoint(points, { x: 2, z: 0 }, { x: 3, y: 0.2, z: 1 })
  assert.notEqual(followed, points)
  assert.equal(followed[followed.length - 1].x, 3)
  assert.ok(followed.some((point) => point.riser))
})

test('a locked cable survives automatic routing and a geometry edit updates the circuit length', () => {
  let plan = emptyPlan()
  plan.services = emptyServices()
  plan = addServiceNode(plan, { system: 'electric', kind: 'panel', x: 1, z: 1 })
  plan = addServiceNode(plan, { system: 'electric', kind: 'stove', x: 4, z: 1 })
  const supply = plan.services.runs.find((run) => run.system === 'electric' && run.points?.length >= 2)
  assert.ok(supply)
  const frozen = supply.points.map((point) => ({ ...point }))
  plan = updateServiceRun(plan, supply.id, { locked: true, label: 'Liesi' })
  const circuitId = supply.circuit
  const before = plan.services.electric.circuits.find((item) => item.id === circuitId)?.length || 0
  plan = autoRoute(plan, 'electric')
  const kept = plan.services.runs.find((run) => run.id === supply.id)
  assert.ok(kept)
  assert.equal(kept.locked, true)
  assert.deepEqual(kept.points, frozen)
  const longer = kept.points.map((point, index) => (index === 1 ? { ...point, x: point.x + 3 } : { ...point }))
  plan = commitRunGeometry(plan, kept.id, longer)
  const edited = plan.services.runs.find((run) => run.id === kept.id)
  assert.equal(edited.locked, true)
  assert.ok(routeLength(edited.points) > routeLength(frozen) + 1)
  const after = plan.services.electric.circuits.find((item) => item.id === circuitId)?.length || 0
  assert.ok(after > before)
  const stove = plan.services.nodes.find((node) => node.kind === 'stove')
  plan = updateServiceNode(plan, stove.id, { x: stove.x + 1.5, z: stove.z + 0.8 })
  const followed = plan.services.runs.find((run) => run.id === kept.id)
  const end = followed.points[followed.points.length - 1]
  const start = followed.points[0]
  const near = Math.min(
    Math.hypot(end.x - (stove.x + 1.5), end.z - (stove.z + 0.8)),
    Math.hypot(start.x - (stove.x + 1.5), start.z - (stove.z + 0.8)),
  )
  assert.ok(near < 0.35)
  const split = splitServiceRun(plan, followed.id, 0, 0.5)
  assert.equal(split.services.runs.filter((run) => run.locked && run.system === 'electric').length >= 2, true)
  const again = rerouteRun(split, followed.id)
  assert.equal(again.services.runs.some((run) => run.id === followed.id && run.locked), false)
})

test('a locked ventilation duct is kept when the system is routed again', () => {
  let plan = autoRoute(exampleHouse(), 'iv')
  const duct = plan.services.runs.find((run) => run.system === 'iv' && (run.points || []).length >= 2)
  assert.ok(duct)
  const frozen = duct.points.map((point) => ({ ...point }))
  plan = updateServiceRun(plan, duct.id, { locked: true, material: 'Pelti', insulation: 'Vuorivilla' })
  plan = autoRoute(plan, 'iv')
  const kept = plan.services.runs.find((run) => run.id === duct.id)
  assert.ok(kept)
  assert.equal(kept.material, 'Pelti')
  assert.deepEqual(kept.points, frozen)
  const lowered = updateServiceRun(plan, duct.id, { heightMode: 'floor' })
  const next = lowered.services.runs.find((run) => run.id === duct.id)
  assert.equal(next.locked, true)
  assert.ok(next.points.some((point, index) => index > 0 && Math.abs((point.y || 0) - (next.points[index - 1].y || 0)) > 0.2 && Math.hypot(point.x - next.points[index - 1].x, point.z - next.points[index - 1].z) < 0.05))
})
