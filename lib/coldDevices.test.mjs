import test from 'node:test'
import assert from 'node:assert/strict'
import { getTemplate } from './catalog.js'
import {
  dragColdDevice,
  followHosts,
  formatDeviceLink,
  placeColdDevice,
  removalPrompt,
  reseatWallDevices,
} from './coldDevices.js'
import { doorFrame, doorOpensOut, doorPlanFigures } from './doors.js'
import { hydrateEquipment, makeEquipment } from './geometry.js'

function room(extra = {}) {
  return {
    id: 'room-1',
    type: 'chilled',
    label: 'J1',
    name: 'Kylmiö',
    x: 0,
    z: 0,
    width: 4,
    depth: 4,
    height: 3,
    wallThickness: 0.1,
    temp: 2,
    unitId: 'unit-1',
    equipment: [],
    ...extra,
  }
}

function leafTip(host, door) {
  const line = doorPlanFigures(host, door).figures.find((fig) => fig.kind === 'line' && fig.role === 'leaf')
  return line
}

test('room sensor snaps to the inner face only when placed', () => {
  const host = room()
  const before = host.equipment.length
  const hit = placeColdDevice(getTemplate('sensor-room'), host, 0.2, 1.6)
  assert.equal(hit.ok, true)
  assert.equal(host.equipment.length, before)
  assert.equal(hit.patch.face, 'inner')
  assert.equal(hit.patch.hostKind, 'wall')
  assert.ok(Math.abs(hit.patch.z - 1.9) < 0.02, hit.patch.z)
  assert.ok(Math.abs(hit.patch.x - 0.2) < 0.05, hit.patch.x)
  const dragged = dragColdDevice({ ...getTemplate('sensor-room'), id: 's', x: hit.patch.x, z: hit.patch.z, ...hit.patch }, host, 1.7, 0.1)
  assert.equal(dragged.face, 'inner')
  assert.ok(Math.abs(dragged.x - 1.9) < 0.02, dragged.x)
})

test('door switch snaps to the frame and is not created without a door', () => {
  const host = room()
  const missing = makeEquipment('sensor-door', host, 0.2, 1, [host])
  assert.equal(missing.refused, 'need-door')
  assert.equal(host.equipment.length, 0)
  host.equipment = [{
    id: 'door-1',
    category: 'door',
    catalogId: 'door-hinged-cold',
    name: 'Saranakylmäovi',
    wall: 's',
    x: 0,
    z: 2,
    width: 0.9,
    height: 2,
    depth: 0.08,
  }]
  const hit = placeColdDevice(getTemplate('sensor-door'), host, 0.3, 1.2)
  assert.equal(hit.ok, true)
  assert.equal(hit.patch.hostId, 'door-1')
  assert.equal(hit.patch.face, 'frame')
  assert.equal(hit.patch.z, 2)
  assert.ok(Math.abs(hit.patch.x - 0.5) < 0.02, hit.patch.x)
  assert.equal(host.equipment.length, 1)
  const moved = followHosts(host, [{ ...host.equipment[0], x: 1.2 }, { id: 'sw', ...hit.patch }], 'door-1')
  assert.ok(Math.abs(moved[1].x - 1.7) < 0.02, moved[1].x)
  assert.equal(moved[1].z, 2)
  assert.equal(moved[0].catalogId, 'door-hinged-cold')
})

test('defrost sensor snaps to the coil and leaves the evaporator model alone', () => {
  const evap = {
    id: 'evap-1',
    category: 'evaporator',
    style: 'slant',
    catalogId: 'evap-slant-5',
    name: 'Höyrystin 5 kW',
    width: 1.2,
    height: 0.45,
    depth: 0.7,
    x: 0,
    z: 0,
    rotation: 0,
  }
  const before = JSON.stringify(evap)
  const host = room({ equipment: [evap] })
  const missing = placeColdDevice(getTemplate('sensor-defrost'), room())
  assert.equal(missing.ok, false)
  assert.equal(missing.reason, 'need-evap')
  const hit = placeColdDevice(getTemplate('sensor-defrost'), host, 0, 0)
  assert.equal(hit.ok, true)
  assert.equal(JSON.stringify(evap), before)
  assert.equal(hit.patch.hostId, 'evap-1')
  assert.equal(hit.patch.face, 'coil')
  assert.ok(Math.abs(hit.patch.z - (-0.35)) < 0.02, hit.patch.z)
  assert.equal(evap.style, 'slant')
  const turned = { ...evap, x: 1, z: 0.2, rotation: 90 }
  const next = followHosts(host, [turned, { id: 'def', sensor: 'defrost', category: 'sensor', ...hit.patch }], 'evap-1')
  assert.equal(next[0].style, 'slant')
  assert.equal(next[0].catalogId, 'evap-slant-5')
  assert.ok(Math.abs(next[1].x - 1.35) < 0.02, next[1].x)
  assert.ok(Math.abs(next[1].z - 0.2) < 0.02, next[1].z)
})

test('door devices keep their own face and stay apart', () => {
  const host = room({
    equipment: [{
      id: 'door-1',
      category: 'door',
      catalogId: 'door-hinged-cold',
      name: 'Saranakylmäovi',
      wall: 's',
      x: 0,
      z: 2,
      width: 0.9,
    }],
  })
  const sw = placeColdDevice(getTemplate('sensor-door'), host, 0.3, 1.2).patch
  const ctrl = placeColdDevice(getTemplate('controller'), host, 1.1, 2.2).patch
  const sens = placeColdDevice(getTemplate('sensor-room'), host, 0.4, 1.7).patch
  assert.equal(sw.face, 'frame')
  assert.equal(ctrl.face, 'outer')
  assert.equal(sens.face, 'inner')
  assert.ok(sens.z < host.depth / 2 - 0.05, sens.z)
  assert.ok(ctrl.z > host.depth / 2, ctrl.z)
  assert.ok(sens.x < -0.5, sens.x)
  const spots = [sw, ctrl, sens]
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      const gap = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)
      assert.ok(gap >= 0.45, `${gap} between ${i} and ${j}`)
    }
  }
})

test('controller snaps to the outer face beside the door', () => {
  const host = room({
    equipment: [{
      id: 'door-1',
      category: 'door',
      catalogId: 'door-hinged-cold',
      name: 'Saranakylmäovi',
      wall: 's',
      x: 0,
      z: 2,
      width: 0.9,
    }],
  })
  const hit = placeColdDevice(getTemplate('controller'), host, 1.1, 2.2)
  assert.equal(hit.ok, true)
  assert.equal(hit.patch.hostId, 'door-1')
  assert.equal(hit.patch.face, 'outer')
  assert.ok(hit.patch.z > 2, hit.patch.z)
  assert.ok(hit.patch.x > 0.6, hit.patch.x)
  const bare = placeColdDevice(getTemplate('controller'), room(), -1.8, 0)
  assert.equal(bare.patch.hostKind, 'wall')
  assert.equal(bare.patch.face, 'outer')
  assert.ok(bare.patch.x < -2, bare.patch.x)
})

test('a cold-room door sits in the wall opening and swings outward', () => {
  const host = room({ wallThickness: 0.1, outline: [
    { x: -2, z: -1.5 },
    { x: 2, z: -1.5 },
    { x: 2, z: 1.5 },
    { x: -2, z: 1.5 },
  ] })
  const door = {
    category: 'door',
    catalogId: 'door-hinged-cold',
    wall: 's',
    x: 0.2,
    z: 1.5,
    width: 0.9,
    height: 2,
  }
  const frame = doorFrame(host, door)
  assert.equal(frame.cardinal, 's')
  assert.ok(Math.abs(frame.center.z - 1.5) < 0.02, frame.center.z)
  assert.ok(Math.abs(frame.center.x - 0.2) < 0.02, frame.center.x)
  assert.equal(frame.hinge.y, 0)
  assert.ok(frame.hinge.z > frame.center.z, frame.hinge.z)
  assert.ok(Math.abs(frame.hinge.z - frame.center.z) - 0.05 < 0.02)
  assert.ok(frame.outward.z > 0.9)
  assert.ok(Math.abs(frame.tangent.z) < 0.05)
  assert.equal(frame.height, 2)
})

test('a cold-room door opens outward until the user flips it', () => {
  const host = room()
  const door = {
    category: 'door',
    catalogId: 'door-hinged-cold',
    name: 'Saranakylmäovi',
    wall: 's',
    x: 0,
    z: 2,
    width: 0.9,
    height: 2,
  }
  assert.equal(doorOpensOut(door, host), true)
  assert.ok(leafTip(host, door).z2 > 2.2)
  const flipped = { ...door, opensOut: false }
  assert.equal(doorOpensOut(flipped, host), false)
  assert.ok(leafTip(host, flipped).z2 < 1.8)
  const office = room({ type: 'office', id: 'off' })
  const ambient = { ...door, catalogId: 'door-wood', name: 'Väliovi', doorFamily: 'ambient', opensOut: undefined }
  delete ambient.opensOut
  assert.equal(doorOpensOut(ambient, office), false)
  assert.ok(leafTip(office, ambient).z2 < 1.8)
})

test('attached devices follow a resized wall and stay linked in the schedule', () => {
  const host = room()
  const placed = placeColdDevice(getTemplate('sensor-room'), host, 0.2, 1.6)
  host.equipment = [{ id: 'sens', name: 'Huoneanturi', category: 'sensor', sensor: 'room', ...placed.patch }]
  const grown = reseatWallDevices({ ...host, depth: 8 })
  assert.ok(Math.abs(grown.equipment[0].z - 3.9) < 0.02, grown.equipment[0].z)
  assert.equal(grown.equipment[0].face, 'inner')
  host.equipment.push({ id: 'unit-1', category: 'combo', name: 'Koneikko 8 kW' })
  const t = (key, vars) => {
    if (key === 'cold.deviceLink') return `${vars.room} ${vars.name} · ${vars.unit} · ${vars.host}`
    if (key === 'cold.hostInner') return 'Sisäpinta'
    if (key === 'cold.unassigned') return 'Ei koneikkoa'
    if (key === 'cold.removeDevice') return `remove ${vars.name} from ${vars.host}`
    if (key === 'cold.removeHost') return `host ${vars.name} devices ${vars.devices}`
    return key
  }
  assert.equal(formatDeviceLink(t, host, host.equipment[0], [host]), 'J1 Huoneanturi · Koneikko 8 kW · Sisäpinta')
  const kept = hydrateEquipment(host.equipment[0])
  assert.equal(kept.hostKind, 'wall')
  assert.equal(kept.face, 'inner')
  assert.equal(removalPrompt([host], ['sens'], t).includes('Huoneanturi'), true)
  assert.equal(removalPrompt([host], ['unit-1'], t), null)
  host.equipment.push({
    id: 'sw',
    name: 'Ovikytkin',
    category: 'sensor',
    sensor: 'door',
    hostId: 'door-9',
    hostKind: 'door',
  })
  host.equipment.push({ id: 'door-9', category: 'door', name: 'Saranakylmäovi' })
  assert.equal(removalPrompt([host], ['door-9'], t).includes('Ovikytkin'), true)
  assert.equal(removalPrompt([host], ['rack'], t), null)
})
