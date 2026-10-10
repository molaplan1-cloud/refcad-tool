import test from 'node:test'
import assert from 'node:assert/strict'
import { addWall, emptyPlan, exampleHouse, segmentLength, thicknessOf } from './floorplan.js'
import { faceOffsets } from './wall-outline.js'
import { addServiceNode, rewireElectric, rotateServiceNode, snapDeviceToWall } from './services.js'
import { applyOp } from './cadEdit.js'
import { deviceCorners, deviceEnvelope, PANEL_DEPTH, PANEL_HEIGHT, PANEL_MOUNT, PANEL_WIDTH } from './wallDevices.js'

function backPoint(pose) {
  const rad = ((pose.rotation || 0) * Math.PI) / 180
  return {
    x: pose.x - Math.sin(rad) * (pose.depth / 2 + 0.004),
    z: pose.z - Math.cos(rad) * (pose.depth / 2 + 0.004),
  }
}

function faceGap(plan, pose) {
  const wall = plan.walls.find((item) => item.id === pose.wallId)
  const len = segmentLength(wall.a, wall.b) || 1
  const ux = (wall.b.x - wall.a.x) / len
  const uz = (wall.b.z - wall.a.z) / len
  const nx = -uz
  const nz = ux
  const back = backPoint(pose)
  const t = ((back.x - wall.a.x) * ux + (back.z - wall.a.z) * uz)
  const cx = wall.a.x + ux * t
  const cz = wall.a.z + uz * t
  const signed = (back.x - cx) * nx + (back.z - cz) * nz
  const offsets = faceOffsets(wall, thicknessOf(wall, plan))
  const expected = pose.face === 'left' ? offsets.left : offsets.right
  return { signed, expected, wall }
}

test('a distribution board is 600 by 150 mm and sits with its back on the wall', () => {
  const env = deviceEnvelope({ kind: 'panel' })
  assert.equal(env.width, PANEL_WIDTH)
  assert.equal(env.depth, PANEL_DEPTH)
  assert.equal(env.height, PANEL_HEIGHT)
  assert.equal(env.mount, PANEL_MOUNT)
  assert.equal(env.width, 0.6)
  assert.equal(env.depth, 0.15)
  const kept = deviceEnvelope({ kind: 'panel', y: 1.4 })
  assert.ok(Math.abs(kept.mount - 1) < 0.001)
  assert.ok(Math.abs(kept.mount + kept.height / 2 - 1.4) < 0.001)

  const house = exampleHouse()
  const pose = snapDeviceToWall({ x: 0.5, z: 4 }, house, { kind: 'panel', system: 'electric' })
  assert.ok(pose)
  assert.equal(pose.rotation, 90)
  assert.ok(pose.x > 0.15 && pose.x < 0.28, pose.x)
  assert.ok(Math.abs(pose.z - 4) < 0.05)
  assert.equal(pose.y, 1.4)
  assert.equal(pose.mount, 1)
  const gap = faceGap(house, pose)
  assert.ok(Math.abs(gap.signed - gap.expected) < 0.008, `${gap.signed} vs ${gap.expected}`)
  const corners = deviceCorners({ ...pose, kind: 'panel' })
  const edge = Math.hypot(corners[1].x - corners[0].x, corners[1].z - corners[0].z)
  assert.ok(Math.abs(edge - 0.6) < 0.001)
  const depth = Math.hypot(corners[3].x - corners[0].x, corners[3].z - corners[0].z)
  assert.ok(Math.abs(depth - 0.15) < 0.001)
})

test('wall devices follow an angled wall and stay attached when slid along it', () => {
  let plan = addWall(emptyPlan(), { x: 0, z: 0 }, { x: 2, z: 1 }, 'interior')
  const kinds = ['panel', 'socket', 'switch', 'junction']
  kinds.forEach((kind) => {
    const pose = snapDeviceToWall({ x: 0.3, z: 1.1 }, plan, { kind, system: 'electric', y: kind === 'socket' ? 0.3 : undefined })
    assert.ok(pose, kind)
    const wall = plan.walls.find((item) => item.id === pose.wallId)
    const len = segmentLength(wall.a, wall.b)
    const ux = (wall.b.x - wall.a.x) / len
    const uz = (wall.b.z - wall.a.z) / len
    const corners = deviceCorners({ ...pose, kind })
    const ex = corners[1].x - corners[0].x
    const ez = corners[1].z - corners[0].z
    const elen = Math.hypot(ex, ez) || 1
    assert.ok(Math.abs(ex / elen * ux + ez / elen * uz) > 0.99, kind)
    const gap = faceGap(plan, pose)
    assert.ok(Math.abs(gap.signed - gap.expected) < 0.008, kind)
  })
  const near = snapDeviceToWall({ x: 0.35, z: 0.9 }, plan, { kind: 'socket', system: 'electric', y: 0.3 })
  const far = snapDeviceToWall({ x: 1.3, z: 1.15 }, plan, { kind: 'socket', system: 'electric', y: 0.3 })
  assert.equal(near.wallId, far.wallId)
  assert.equal(near.face, far.face)
  assert.equal(near.rotation, far.rotation)
  assert.ok(Math.hypot(near.x - far.x, near.z - far.z) > 0.4)
  assert.equal(near.y, 0.3)
})

test('rotate flips a wall device onto the other face and does not add wiring', () => {
  const house = exampleHouse()
  const pose = snapDeviceToWall({ x: 0.8, z: 3 }, house, { kind: 'panel', system: 'electric' })
  let plan = addServiceNode(house, {
    system: 'electric',
    kind: 'panel',
    name: 'Sähkökeskus',
    userPlaced: true,
    ...pose,
  })
  const before = plan.services.nodes.find((node) => node.kind === 'panel')
  assert.equal(before.x, pose.x)
  assert.equal(before.z, pose.z)
  assert.equal((plan.services.runs || []).filter((run) => run.system === 'electric').length, 0)
  const turned = rotateServiceNode(plan, before.id)
  const after = turned.services.nodes.find((node) => node.kind === 'panel')
  assert.equal(after.wallId, before.wallId)
  assert.notEqual(after.face, before.face)
  assert.notEqual(after.rotation, before.rotation)
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.1)
  assert.equal((turned.services.runs || []).filter((run) => run.system === 'electric').length, 0)
  const again = rewireElectric(turned)
  const stayed = again.services.nodes.find((node) => node.kind === 'panel')
  assert.equal(stayed.x, after.x)
  assert.equal(stayed.z, after.z)
  assert.equal((again.services.runs || []).filter((run) => run.system === 'electric').length, 0)

  for (const kind of ['socket', 'switch', 'junction']) {
    const seat = snapDeviceToWall({ x: 2, z: 0.4 }, house, { kind, system: 'electric' })
    let hosted = addServiceNode(house, { system: 'electric', kind, userPlaced: true, ...seat, x: seat.x, z: seat.z, y: seat.y })
    const id = hosted.services.nodes.find((node) => node.kind === kind).id
    const flipped = rotateServiceNode(hosted, id).services.nodes.find((node) => node.id === id)
    assert.notEqual(flipped.face, seat.face, kind)
    assert.equal(flipped.wallId, seat.wallId, kind)
  }
})

test('a rotate command turns a wall device even when the pivot is its own center', () => {
  const house = exampleHouse()
  const pose = snapDeviceToWall({ x: 1, z: 2 }, house, { kind: 'switch', system: 'electric' })
  const plan = addServiceNode(house, { system: 'electric', kind: 'switch', userPlaced: true, ...pose })
  const before = plan.services.nodes.find((node) => node.kind === 'switch')
  const moved = applyOp(plan, [{ kind: 'node', id: before.id }], { type: 'rotate', cx: before.x, cz: before.z, degrees: 90 })
  const after = moved.services.nodes.find((node) => node.id === before.id)
  assert.notEqual(after.face, before.face)
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.05)
  const runs = (moved.services.runs || []).filter((run) => run.system === 'electric')
  assert.equal(runs.length, 0)
})

test('placing a sähkökeskus through addServiceNode does not slide it or invent a cable', () => {
  const plan = addServiceNode(exampleHouse(), {
    system: 'electric',
    kind: 'panel',
    name: 'Sähkökeskus',
    x: 3.25,
    z: 4.5,
    userPlaced: true,
  })
  const panel = plan.services.nodes.find((node) => node.kind === 'panel')
  assert.equal(panel.x, 3.25)
  assert.equal(panel.z, 4.5)
  assert.equal((plan.services.runs || []).filter((run) => run.system === 'electric').length, 0)
})
