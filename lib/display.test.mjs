import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDisplay, deviceLabelObstacles, dimensionMode, displayCommand, heatingLabelObstacles, labelObstacles, layoutRoomLabels, normalizeDisplay, routeLabelObstacles } from './display.js'
import { emptyPlan, exampleHouse, familyHouse, planBounds, planDimensions, viewLayout } from './floorplan.js'
import { acceptEquipment, applyHeating, autoRoute, rewireHeat } from './services.js'

test('the default sheet keeps chains outside and drops room-internal dimensions', () => {
  const house = exampleHouse()
  const lines = planDimensions(house)
  assert.equal(normalizeDisplay(undefined).preset, 'measure')
  assert.equal(lines.some((dim) => dim.kind === 'internal'), false)
  assert.ok(lines.some((dim) => dim.kind === 'overall' && dim.label === '12000'))
  assert.ok(lines.some((dim) => dim.kind === 'room'))
  assert.ok(lines.some((dim) => dim.kind === 'opening'))
  const box = planBounds(house)
  lines.forEach((dim) => {
    const x = dim.x1 + (dim.nx || 0) * (dim.offset || 0)
    const z = dim.z1 + (dim.nz || 0) * (dim.offset || 0)
    const outside = z < box.minZ - 0.2 || z > box.maxZ + 0.2 || x < box.minX - 0.2 || x > box.maxX + 0.2
    assert.equal(outside, true, `${dim.kind} ${dim.label}`)
  })
})

test('a plain preset keeps overall dimensions and room names only', () => {
  const plan = applyDisplay(emptyPlan(), { preset: 'plain' }, 'plan')
  const display = normalizeDisplay(plan.display)
  assert.equal(display.preset, 'plain')
  assert.deepEqual(display.dims, { overall: true, room: false, openings: false, internal: false })
  assert.equal(display.roomNames, true)
  assert.equal(display.areas, false)
  assert.equal(display.fixtures, false)
  assert.equal(plan.sheetDisplay.plan.preset, 'plain')
  assert.equal(dimensionMode(display), 'overall')
  const lines = planDimensions(exampleHouse(), display)
  assert.ok(lines.every((dim) => dim.kind === 'overall'))
})

test('small wet rooms abbreviate and their labels stay apart', () => {
  const house = familyHouse()
  const labels = layoutRoomLabels(house.rooms, { ratio: 100, showNames: true, showAreas: true })
  const bath = labels.find((label) => label.roomName === 'Kylpyhuone')
  const sauna = labels.find((label) => label.roomName === 'Sauna')
  const living = labels.find((label) => label.roomName === 'Olohuone')
  assert.equal(bath.text, 'KPH')
  assert.equal(living.text, 'Olohuone')
  assert.ok(sauna.text === 'Sauna' || sauna.text === 'S')
  const hit = Math.abs(bath.x - sauna.x) < (bath.w + sauna.w) / 2
    && Math.abs(bath.z - sauna.z) < (bath.h + sauna.h) / 2
  assert.equal(hit, false)
  labels.forEach((label, index) => {
    labels.slice(index + 1).forEach((other) => {
      const overlap = Math.abs(label.x - other.x) < (label.w + other.w) / 2 + 0.05
        && Math.abs(label.z - other.z) < (label.h + other.h) / 2 + 0.04
      assert.equal(overlap, false, `${label.roomName} / ${other.roomName}`)
    })
  })
})

test('room names move off valves that sit on them', () => {
  const plan = acceptEquipment(exampleHouse(), 'iv')
  const layout = viewLayout(plan)
  const obstacles = deviceLabelObstacles(plan, layout.scale * 2.2)
  const labels = layoutRoomLabels(plan.rooms, {
    ratio: layout.ratio,
    showNames: true,
    showAreas: true,
    obstacles,
  })
  const rooms = ['Sauna', 'Makuuhuone']
  rooms.forEach((name) => {
    const label = labels.find((item) => item.roomName === name)
    const valves = plan.services.nodes.filter((node) => node.kind === 'valve' && node.roomId === label.id)
    assert.ok(valves.length > 0, name)
    valves.forEach((valve) => {
      const obstacle = obstacles.find((item) => item.x === valve.x && item.z === valve.z)
      const hit = Math.abs(label.x - obstacle.x) < (label.w + obstacle.w) / 2
        && Math.abs(label.z - obstacle.z) < (label.h + obstacle.h) / 2
      assert.equal(hit, false, name)
    })
  })
})

function segmentHitsLabel(label, obstacle, pad = 0) {
  const left = label.x - label.w / 2 - pad
  const right = label.x + label.w / 2 + pad
  const top = label.z - label.h / 2 - pad
  const bottom = label.z + label.h / 2 + pad
  const inside = (x, z) => x >= left && x <= right && z >= top && z <= bottom
  if (inside(obstacle.x1, obstacle.z1) || inside(obstacle.x2, obstacle.z2)) return true
  const edges = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ]
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const det = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx)
    if (Math.abs(det) < 1e-9) return false
    const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / det
    const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / det
    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }
  return edges.some(([ax, az, bx, bz]) => cross(obstacle.x1, obstacle.z1, obstacle.x2, obstacle.z2, ax, az, bx, bz))
}

test('room names sit inside the room and clear ducts, devices and furniture', () => {
  const plan = autoRoute(acceptEquipment(exampleHouse(), 'iv'), 'iv')
  const obstacles = labelObstacles(plan, 22)
  const labels = layoutRoomLabels(plan.rooms, {
    ratio: 100,
    showNames: true,
    showAreas: true,
    obstacles,
  })
  const routes = routeLabelObstacles(plan, 0)
  ;['Makuuhuone', 'WC', 'Sauna', 'Olohuone', 'Keittiö'].forEach((name) => {
    const label = labels.find((item) => item.roomName === name)
    const room = plan.rooms.find((item) => item.id === label.id)
    const box = room.polygon.reduce((acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minZ: Math.min(acc.minZ, point.z),
      maxZ: Math.max(acc.maxZ, point.z),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
    assert.ok(label.x > box.minX && label.x < box.maxX && label.z > box.minZ && label.z < box.maxZ, `${name} stays in the room`)
    routes.forEach((segment) => {
      assert.equal(segmentHitsLabel(label, segment), false, `${name} crosses a duct`)
    })
    obstacles.filter((item) => item.kind !== 'route').forEach((obstacle) => {
      const hit = Math.abs(label.x - obstacle.x) < (label.w + obstacle.w) / 2
        && Math.abs(label.z - obstacle.z) < (label.h + obstacle.h) / 2
      assert.equal(hit, false, `${name} covers a ${obstacle.kind || 'device'}`)
    })
    assert.equal(Boolean(label.halo), false, name)
  })
})

test('a room with no free spot keeps the text and adds a white halo', () => {
  const polygon = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2.4 }, { x: 0, z: 2.4 }]
  const points = []
  for (let z = 0.15; z <= 2.25; z += 0.3) points.push({ x: 0, z }, { x: 3, z })
  const plan = {
    fixtures: [{ x: 1.5, z: 1.2, w: 2.4, d: 1.8, rotation: 0 }],
    services: {
      layers: { iv: true },
      nodes: [{ system: 'iv', kind: 'valve', x: 1.5, z: 1.2 }],
      runs: [{ system: 'iv', points }],
    },
  }
  const labels = layoutRoomLabels([{ id: 'tight', name: 'Varasto', area: 7.2, polygon }], {
    ratio: 100,
    showNames: true,
    showAreas: true,
    obstacles: labelObstacles(plan, 22),
  })
  assert.equal(labels.length, 1)
  assert.equal(labels[0].text, 'Varasto')
  assert.equal(labels[0].halo, true)
  assert.ok(labels[0].x > 0 && labels[0].x < 3 && labels[0].z > 0 && labels[0].z < 2.4)
})

test('Näytä closes on escape and toggles on V without stealing modified keys', () => {
  assert.equal(displayCommand(true, { key: 'Escape' }), 'close')
  assert.equal(displayCommand(false, { key: 'Escape' }), null)
  assert.equal(displayCommand(false, { key: 'v' }), 'toggle')
  assert.equal(displayCommand(true, { key: 'V' }), 'toggle')
  assert.equal(displayCommand(true, { key: 'v', ctrlKey: true }), null)
  assert.equal(displayCommand(true, { key: 'v', metaKey: true }), null)
  assert.equal(displayCommand(true, { key: 'v', target: { tagName: 'INPUT' } }), null)
  assert.equal(displayCommand(true, { key: 'Escape', target: { tagName: 'SELECT' } }), null)
  assert.equal(displayCommand(true, { key: 'a' }), null)
})

test('display toggles persist on the plan and change names, areas and dimensions', () => {
  let plan = applyDisplay(exampleHouse(), { preset: 'all' }, 'plan')
  assert.equal(plan.display.preset, 'all')
  assert.equal(plan.sheetDisplay.plan.openingSizes, true)
  assert.equal(plan.sheetDisplay.plan.structures, true)
  assert.equal(plan.display.fixtures, true)
  const full = layoutRoomLabels(plan.rooms, { ratio: 100, showNames: true, showAreas: true })
  assert.ok(full.some((label) => label.text && label.area))
  plan = applyDisplay(plan, {
    roomNames: false,
    areas: false,
    openingSizes: false,
    structures: false,
    fixtures: false,
    dims: { overall: true, room: false, openings: false, internal: false },
  }, 'plan')
  assert.equal(plan.display.preset, 'custom')
  assert.equal(plan.display.roomNames, false)
  assert.equal(plan.display.areas, false)
  assert.equal(plan.display.openingSizes, false)
  assert.equal(plan.display.structures, false)
  assert.equal(plan.display.fixtures, false)
  assert.equal(plan.sheetDisplay.plan.fixtures, false)
  assert.equal(layoutRoomLabels(plan.rooms, { ratio: 100, showNames: plan.display.roomNames, showAreas: plan.display.areas }).length, 0)
  const lines = planDimensions(exampleHouse(), plan.display)
  assert.ok(lines.length > 0)
  assert.ok(lines.every((dim) => dim.kind === 'overall'))
})

test('the Eteinen name moves off the floor-heating manifold', () => {
  const plan = rewireHeat(applyHeating(familyHouse(), { source: 'district', distribution: 'floor', buffer: false }))
  const obstacles = heatingLabelObstacles(plan)
  assert.ok(obstacles.some((item) => item.w >= 0.8))
  const labels = layoutRoomLabels(familyHouse().rooms, {
    ratio: 100,
    showNames: true,
    showAreas: true,
    obstacles,
  })
  const hall = labels.find((label) => label.roomName === 'Eteinen')
  assert.equal(hall.text, 'Eteinen')
  obstacles.forEach((obstacle) => {
    const hit = Math.abs(hall.x - obstacle.x) < (hall.w + obstacle.w) / 2 + 0.04
      && Math.abs(hall.z - obstacle.z) < (hall.h + obstacle.h) / 2 + 0.04
    assert.equal(hit, false)
  })
})
