import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyPanelPlan } from './coldPanels.js'
import { commitRectangle, drawCursor, parseRectangleSize, sealClosedLoop, stepWallChain } from './wallDraw.js'

const panel = { kind: 'panel', panel: true, thickness: 0.1, axisDeg: 2 }

function axisAligned(wall) {
  const dx = Math.abs(wall.b.x - wall.a.x)
  const dz = Math.abs(wall.b.z - wall.a.z)
  return dx < 1e-6 || dz < 1e-6
}

function degrees(walls) {
  const ends = []
  walls.forEach((wall) => {
    ends.push(wall.a, wall.b)
  })
  const key = (point) => `${point.x.toFixed(3)}:${point.z.toFixed(3)}`
  const count = new Map()
  ends.forEach((point) => count.set(key(point), (count.get(key(point)) || 0) + 1))
  return count
}

test('a rectangle is closed, orthogonal and has no dangling end', () => {
  const plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  assert.equal(plan.walls.length, 4)
  assert.ok(plan.walls.every((wall) => wall.kind === 'panel' && axisAligned(wall)))
  const count = degrees(plan.walls)
  assert.ok([...count.values()].every((value) => value === 2))
})

test('typed WxL is millimetres and a skewed click still locks to the axis', () => {
  assert.deepEqual(parseRectangleSize('4000×3000'), { width: 4, depth: 3 })
  assert.deepEqual(parseRectangleSize('4000x3000'), { width: 4, depth: 3 })
  const point = drawCursor({ x: 4.2, z: 0.7 }, { x: 0, z: 0 }, [], 36, '')
  assert.ok(Math.abs(point.z) < 1e-6)
  assert.ok(point.x > 3)
})

test('closing a chain mitres a clean loop and drops the overshoot', () => {
  let plan = emptyPanelPlan()
  let chain = null
  ;[
    { x: 0, z: 0.12 },
    { x: 4.08, z: 0.2 },
    { x: 4.2, z: 2.9 },
    { x: 0.05, z: 3.1 },
  ].forEach((point) => {
    const step = stepWallChain(plan, chain, point, panel)
    plan = step.plan
    chain = step.chain
  })
  const closed = stepWallChain(plan, chain, chain.start, panel)
  plan = closed.plan
  assert.equal(closed.closed, true)
  assert.equal(closed.chain, null)
  assert.ok(plan.walls.length >= 4)
  assert.ok(plan.walls.every(axisAligned))
  const count = degrees(plan.walls)
  assert.ok([...count.values()].every((value) => value >= 2))
  const stray = sealClosedLoop({
    ...plan,
    walls: [
      ...plan.walls,
      {
        ...plan.walls[0],
        id: 'stub',
        a: { x: plan.walls[0].b.x, z: plan.walls[0].b.z },
        b: { x: plan.walls[0].b.x + 0.8, z: plan.walls[0].b.z },
      },
    ],
  })
  assert.equal(stray.walls.some((wall) => wall.id === 'stub'), false)
})

test('two rectangles share one wall', () => {
  let plan = commitRectangle(emptyPanelPlan(), { x: 0, z: 0 }, { x: 4, z: 3 }, panel)
  plan = commitRectangle(plan, { x: 4, z: 0 }, { x: 8, z: 3 }, panel)
  const shared = plan.walls.filter((wall) => Math.abs(wall.a.x - 4) < 0.02 && Math.abs(wall.b.x - 4) < 0.02)
  assert.equal(shared.length, 1)
  assert.ok(plan.walls.every(axisAligned))
})
