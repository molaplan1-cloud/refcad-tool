import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDisplay, dimensionMode, layoutRoomLabels, normalizeDisplay } from './display.js'
import { emptyPlan, exampleHouse, familyHouse, planBounds, planDimensions } from './floorplan.js'

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
