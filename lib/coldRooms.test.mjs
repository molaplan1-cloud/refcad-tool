import test from 'node:test'
import assert from 'node:assert/strict'
import { coldDutyTypes } from './catalog.js'
import { projectTypesFor, coldRoomEntry } from './access.js'
import { chainCloses, commitPanel, emptyPanelPlan, extendPanel, joinPanelCorner, panelCursor, roomsFromPanels } from './coldPanels.js'
import { applyUnitChoice, assignRooms, groupUnits, suggestCondensing } from './coldUnits.js'
import { parseDrawInput } from './drawInput.js'
import { calculateProject } from './heatLoad.js'
import { hydrateRoom } from './geometry.js'

test('cold room duties are not house types', () => {
  const ids = coldDutyTypes().map((type) => type.id)
  assert.ok(ids.includes('chilled'))
  assert.ok(ids.includes('frozen'))
  assert.ok(ids.includes('blast-freezer'))
  assert.ok(ids.includes('aging'))
  assert.ok(ids.includes('grow'))
  assert.ok(ids.includes('beverage'))
  assert.ok(ids.includes('process'))
  assert.equal(ids.includes('office'), false)
  assert.equal(ids.includes('yard'), false)
  assert.equal(ids.includes('omakotitalo'), false)
  const names = coldDutyTypes().map((type) => type.name)
  assert.ok(names.includes('Kylmiö'))
  assert.ok(names.includes('Pakastehuone'))
  assert.ok(names.includes('Pikapakastin'))
  assert.ok(names.includes('Kypsytyshuone'))
  assert.ok(names.includes('Kasvishuone'))
  assert.ok(names.includes('Juomakylmiö'))
  assert.ok(names.includes('Jalostustila'))
  assert.equal(projectTypesFor('cold').map((type) => type.id).includes('omakotitalo'), false)
  assert.deepEqual(projectTypesFor('cold').map((type) => type.id), ['kylmio'])
})

test('a logged-out visitor can open refrigeration and still prints a watermark', () => {
  const entry = coldRoomEntry(null)
  assert.equal(entry.allowed, true)
  assert.equal(entry.access.watermark, true)
  assert.ok(entry.access.workspaces.includes('kylma'))
})

test('panel walls reuse the floor-plan engine and detect two rooms on a shared wall', () => {
  let plan = emptyPanelPlan()
  const box = (x0, z0, x1, z1, skipShared = false) => {
    const corners = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      if (skipShared && a.x === x0 && b.x === x0) continue
      plan = commitPanel(plan, a, b, 100)
    }
  }
  box(0, 0, 4, 3)
  box(4, 0, 8, 3, true)
  const rooms = roomsFromPanels(plan, [], 'chilled')
  assert.equal(rooms.length, 2)
  assert.ok(rooms.every((room) => Math.abs(room.wallThickness - 0.1) < 0.001))
  assert.equal(plan.walls.every((wall) => wall.kind === 'panel' && wall.thicknessCustom), true)
  assert.ok(plan.walls.some((wall) => Math.abs(wall.thickness - 0.1) < 0.001))
  const shared = plan.walls.filter((wall) => Math.abs(wall.a.x - 4) < 0.02 && Math.abs(wall.b.x - 4) < 0.02)
  assert.equal(shared.length, 1)
})

test('typed length and angle use the same draw parser, and join closes a corner', () => {
  assert.deepEqual(parseDrawInput('@4000<90'), { lengthMm: 4000, angleDeg: 90 })
  const point = panelCursor({ x: 1, z: 0.2 }, { x: 0, z: 0 }, [], 40, '@4000<0')
  assert.ok(Math.abs(point.x - 4) < 0.02)
  assert.ok(Math.abs(point.z) < 0.05)
  let plan = commitPanel(emptyPanelPlan(), { x: 0, z: 0 }, { x: 3, z: 0 }, 80)
  plan = commitPanel(plan, { x: 2.6, z: 0.4 }, { x: 2.6, z: 3 }, 80)
  const joined = joinPanelCorner(plan, plan.walls[0].id, plan.walls[1].id)
  const first = joined.walls.find((wall) => wall.id === plan.walls[0].id)
  const second = joined.walls.find((wall) => wall.id === plan.walls[1].id)
  assert.ok(Math.hypot(first.b.x - second.a.x, first.b.z - second.a.z) < 0.05 || Math.hypot(first.b.x - second.b.x, first.b.z - second.b.z) < 0.05 || Math.hypot(first.a.x - second.a.x, first.a.z - second.a.z) < 0.05)
  const extended = extendPanel(commitPanel(commitPanel(emptyPanelPlan(), { x: 0, z: 0 }, { x: 2, z: 0 }, 120), { x: 3, z: -1 }, { x: 3, z: 2 }, 120), null)
  assert.equal(extended.walls.length, 2)
  assert.equal(chainCloses([{ x: 0, z: 0 }, { x: 1, z: 0 }], { x: 0, z: 0 }), true)
})

test('several rooms share one condensing unit and the total uses diversity', () => {
  const load = { safetyFactor: 1, productId: 'generic', dailyMassKg: 0, doorOpeningsPerDay: 0, people: 0, lightsWPerM2: 0, fansW: 0, defrostW: 0, pullDown: false }
  const rooms = [
    { id: 'cool', type: 'chilled', name: 'Kylmiö', label: 'K1', temp: 2, x: 0, z: 0, width: 4, depth: 3, height: 3, wallThickness: 0.1, uWall: 0.3, uCeiling: 0.25, uFloor: 0.35, equipment: [{ id: 'ev1', category: 'evaporator', capacityKw: 2, style: 'slant' }], load, unitId: 'unit-1' },
    { id: 'freeze', type: 'frozen', name: 'Pakastehuone', label: 'P1', temp: -20, x: 4, z: 0, width: 4, depth: 3, height: 3, wallThickness: 0.12, uWall: 0.22, uCeiling: 0.2, uFloor: 0.28, equipment: [{ id: 'ev2', category: 'evaporator', capacityKw: 3, style: 'slant' }], load, unitId: 'unit-1' },
    { id: 'veg', type: 'grow', name: 'Kasvishuone', label: 'G1', temp: 16, x: 0, z: 3, width: 4, depth: 3, height: 3, wallThickness: 0.08, uWall: 0.4, uCeiling: 0.35, uFloor: 0.45, equipment: [{ id: 'ev3', category: 'evaporator', capacityKw: 1.5, style: 'slant' }], load, unitId: 'unit-1' },
    { id: 'plant', type: 'plant', name: 'Konehuone', label: 'M1', temp: 25, x: 8, z: 0, width: 3, depth: 2, height: 3, wallThickness: 0.18, equipment: [{ id: 'unit-1', category: 'combo', catalogId: 'combo-8', name: 'Koneikko 8 kW', capacityKw: 8, width: 1.2, depth: 0.6, height: 0.7 }], load: {} },
  ]
  const result = calculateProject(rooms)
  const board = groupUnits(rooms, result, { diversity: 0.8 })
  const group = board.groups.find((item) => item.id === 'unit-1')
  assert.equal(group.rooms.length, 3)
  assert.ok(group.plusKw > 0)
  assert.ok(group.minusKw > 0)
  assert.ok(Math.abs(group.totalKw - (group.plusKw + group.minusKw)) < 0.001)
  const rawPlus = group.rooms.filter((item) => item.level === 'plus').reduce((sum, item) => sum + item.kw, 0)
  assert.ok(group.plusKw < rawPlus)
  assert.ok(group.suggested)
  assert.ok(group.suggested.capacityKw + 0.001 >= group.totalKw || group.suggested.capacityKw >= 15)
  const picked = applyUnitChoice(rooms, 'unit-1', suggestCondensing(group.totalKw).id)
  const machine = picked.find((room) => room.id === 'plant').equipment[0]
  assert.equal(machine.category, 'combo')
  assert.equal(picked.find((room) => room.id === 'cool').equipment[0].style, 'slant')
  const moved = assignRooms(picked, ['freeze'], null)
  assert.equal(moved.find((room) => room.id === 'freeze').unitId, null)
  assert.equal(hydrateRoom({ id: 'cool', type: 'chilled', unitId: 'unit-1', panelKey: 'wall-2' }).unitId, 'unit-1')
})
