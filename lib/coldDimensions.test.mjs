import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPanelPlan } from './coldPanels.js'
import { roomsFromPanels } from './coldPanels.js'
import { commitRectangle } from './wallDraw.js'
import { coldDimensionFigures, INNER_FACE_OFFSET, layoutColdInnerDims } from './coldDimensions.js'

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

function outlineBox(points) {
  return points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x),
    maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z),
    maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}

test('inner dimensions sit 300 mm off the inner face, clear of the centred label', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  const rooms = roomsFromPanels(plan)
  const laid = layoutColdInnerDims(coldDimensionFigures(plan, rooms), rooms, { scale: 36 })
  const inner = laid.figures.filter((item) => item.dim.kind === 'internal')
  assert.equal(inner.length, 2)
  const box = outlineBox(rooms[0].outline)
  inner.forEach((item) => {
    const dim = item.dim
    const horizontal = Math.abs(dim.z1 - dim.z2) < 1e-6
    const inset = horizontal
      ? Math.min(Math.abs(dim.z1 - box.minZ), Math.abs(dim.z1 - box.maxZ))
      : Math.min(Math.abs(dim.x1 - box.minX), Math.abs(dim.x1 - box.maxX))
    assert.ok(Math.abs(inset - INNER_FACE_OFFSET) < 0.02, inset)
    const mid = horizontal ? (box.minZ + box.maxZ) / 2 : (box.minX + box.maxX) / 2
    const at = horizontal ? dim.z1 : dim.x1
    assert.ok(Math.abs(at - mid) > 0.6)
  })
  assert.equal(laid.anchors[rooms[0].id], undefined)
  assert.equal(laid.figures.some((item) => item.dim.kind === 'overall'), true)
})

test('a wide room label slides off the inner dimension', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  const rooms = roomsFromPanels(plan)
  const laid = layoutColdInnerDims(coldDimensionFigures(plan, rooms), rooms, {
    scale: 36,
    labelSize: () => ({ w: 3.1, h: 0.5 }),
  })
  const anchor = laid.anchors[rooms[0].id]
  const box = outlineBox(rooms[0].outline)
  assert.ok(anchor)
  assert.ok(Math.abs(anchor.x - (box.minX + box.maxX) / 2) > 0.05)
  const vertical = laid.figures.find((item) => item.dim.kind === 'internal' && Math.abs(item.dim.x1 - item.dim.x2) < 1e-6)
  assert.ok(Math.abs(anchor.x - vertical.dim.x1) > 1.2)
})

test('inner dimensions hide when the room is small on screen or the toggle is off', () => {
  const plan = draw(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 })
  const rooms = roomsFromPanels(plan)
  const figures = coldDimensionFigures(plan, rooms)
  const small = layoutColdInnerDims(figures, rooms, { scale: 12 })
  assert.equal(small.figures.some((item) => item.dim.kind === 'internal'), false)
  assert.equal(small.figures.some((item) => item.dim.kind === 'overall'), true)
  const off = layoutColdInnerDims(figures, rooms, { scale: 36, enabled: false })
  assert.equal(off.figures.some((item) => item.dim.kind === 'internal'), false)
  assert.equal(off.figures.some((item) => item.dim.kind === 'overall'), true)
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
