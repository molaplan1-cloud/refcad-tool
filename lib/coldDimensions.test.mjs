import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPanelPlan } from './coldPanels.js'
import { roomsFromPanels } from './coldPanels.js'
import { commitRectangle } from './wallDraw.js'
import { coldDimensionFigures } from './coldDimensions.js'

function draw(plan, a, b) {
  return commitRectangle(plan, a, b, { kind: 'panel', panel: true, thickness: 0.1, axisDeg: 0.01 })
}

test('a cold rectangle gets overall size, inner size and outside extension lines', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  const rooms = roomsFromPanels(plan)
  const figures = coldDimensionFigures(plan, rooms)
  const dims = figures.map((item) => item.dim)
  const overall = dims.filter((dim) => dim.kind === 'overall')
  const inner = dims.filter((dim) => dim.kind === 'internal')
  assert.equal(overall.length, 2)
  assert.deepEqual(overall.map((dim) => dim.label).sort(), ['3000', '4000'])
  assert.deepEqual(inner.map((dim) => dim.label).sort(), ['2900', '3900'])
  const witnessed = figures.filter((item) => item.dim.kind === 'overall' && item.witnesses.length === 2)
  assert.equal(witnessed.length, 2)
  witnessed.forEach((item) => {
    item.witnesses.forEach((line) => {
      const outside = item.dim.nz > 0
        ? Math.min(line.z1, line.z2) > 3
        : item.dim.nx > 0
          ? Math.min(line.x1, line.x2) > 4
          : true
      assert.equal(outside, true)
    })
  })
  dims.forEach((dim) => {
    const horizontal = Math.abs(dim.z1 - dim.z2) < 1e-6
    const vertical = Math.abs(dim.x1 - dim.x2) < 1e-6
    assert.equal(horizontal || vertical, true)
  })
})

test('two rooms produce an outer chain and still share one wall', () => {
  let plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  plan = draw(plan, { x: 4, z: 0 }, { x: 7, z: 3 })
  const rooms = roomsFromPanels(plan)
  assert.equal(rooms.length, 2)
  assert.equal(plan.walls.length, 7)
  const dims = coldDimensionFigures(plan, rooms).map((item) => item.dim)
  assert.equal(dims.some((dim) => dim.kind === 'room'), true)
  assert.equal(dims.some((dim) => dim.kind === 'overall' && dim.label === '7000'), true)
})
