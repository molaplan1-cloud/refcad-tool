import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateProject } from './heatLoad.js'
import { buildDxf } from './dxf.js'
import { buildEnquiryExample, internalDims, nextLabel, normalizeRooms } from './geometry.js'
import { clampTranslation, doorSymbol } from './cadDraw.js'
import { doorPlanSize, isoPoint } from './pdfExport.js'
import { fromTemp, toLength, toTemp } from './units.js'

test('internal dimensions subtract wall, ceiling and floor', () => {
  const dims = internalDims({
    width: 4, depth: 4, height: 3,
    wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1,
  })
  assert.equal(dims.width, 3.8)
  assert.equal(dims.depth, 3.8)
  assert.equal(Number(dims.height.toFixed(4)), 2.8)
  assert.equal(Number(dims.area.toFixed(4)), 14.44)
})

test('single room transmission matches U·A·ΔT', () => {
  const project = calculateProject([{
    id: 'a', type: 'chilled', name: 'Jäähdytys', label: 'J1',
    x: 0, z: 0, width: 4, depth: 4, height: 3,
    wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1,
    temp: 2, ambientTemp: 25, uWall: 0.3, uCeiling: 0.25, uFloor: 0.35,
    equipment: [],
    load: {
      dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
      people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
      safetyFactor: 1, fanRuntime: 0, groundTempC: 10, cp: 3.85, entryTempC: 2,
      doorOpenSeconds: 0, doorWidthM: 1, doorHeightM: 2, infiltrationVelocity: 0,
      peopleWatts: 0, peopleHoursPerDay: 0, lightingHoursPerDay: 0, equipmentHoursPerDay: 0,
      ceilingToParent: false, floorToParent: false,
    },
  }])
  const room = project.rooms[0]
  const wall = room.lines.find((line) => line.key === 'walls-ambient')
  const ceiling = room.lines.find((line) => line.key === 'ceiling')
  const floor = room.lines.find((line) => line.key === 'floor')
  assert.ok(Math.abs(wall.watts - 293.664) < 0.05, wall.watts)
  assert.ok(Math.abs(ceiling.watts - 83.03) < 0.05, ceiling.watts)
  assert.ok(Math.abs(floor.watts - 40.432) < 0.05, floor.watts)
  assert.ok(Math.abs(room.total - (293.664 + 83.03 + 40.432)) < 0.1)
})

test('product sensible load uses kg · cp · ΔT over 24 h', () => {
  const project = calculateProject([{
    id: 'a', type: 'chilled', label: 'J1', x: 0, z: 0, width: 4, depth: 4, height: 3,
    temp: 2, equipment: [],
    load: {
      dailyMassKg: 1000, cp: 3.85, entryTempC: 15, respirationWPerKg: 0.03,
      doorOpeningsPerDay: 0, airChangesPerDay: 0, people: 0, lightingWm2: 0,
      extraEquipmentW: 0, pullDownEnabled: false, safetyFactor: 1, fanRuntime: 0,
    },
  }])
  const product = project.rooms[0].lines.find((line) => line.key === 'product')
  const respiration = project.rooms[0].lines.find((line) => line.key === 'respiration')
  const expected = (1000 * 3.85 * 13 * 1000) / 86400
  assert.ok(Math.abs(product.watts - expected) < 0.01)
  assert.equal(respiration.watts, 30)
})

test('adjacent rooms exchange equal and opposite wall heat', () => {
  const load = {
    dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
    people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
    safetyFactor: 1, fanRuntime: 0, groundTempC: 12, ceilingToParent: false, floorToParent: false,
  }
  const project = calculateProject([
    { id: 'a', type: 'chilled', label: 'J1', x: 2, z: 0, width: 4, depth: 4, height: 3, temp: 2, uWall: 0.3, equipment: [], load },
    { id: 'b', type: 'frozen', label: 'P1', x: 6, z: 0, width: 4, depth: 4, height: 3, temp: -18, uWall: 0.22, equipment: [], load },
  ])
  const a = project.rooms[0].lines.find((line) => line.key.startsWith('share-'))
  const b = project.rooms[1].lines.find((line) => line.key.startsWith('share-'))
  assert.ok(a && b)
  assert.ok(Math.abs(a.watts + b.watts) < 0.01, `${a.watts} vs ${b.watts}`)
  assert.ok(b.watts > 0)
})

test('partition inside a room credits the parent', () => {
  const load = {
    dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
    people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
    safetyFactor: 1, fanRuntime: 0, ceilingToParent: true, floorToParent: false, groundTempC: 12,
  }
  const project = calculateProject([
    { id: 'parent', type: 'chilled', label: 'J1', x: 0, z: 0, width: 10, depth: 10, height: 4, temp: 2, equipment: [], load: { ...load, ceilingToParent: false } },
    { id: 'child', type: 'frozen', label: 'P1', parentId: 'parent', x: 0, z: 0, width: 4, depth: 4, height: 3, temp: -18, equipment: [], load },
  ])
  const child = project.rooms.find((room) => room.id === 'child')
  const parent = project.rooms.find((room) => room.id === 'parent')
  const credit = parent.lines.find((line) => line.key === 'transfer-child')
  assert.ok(credit)
  assert.ok(Math.abs(credit.watts + child.parentExchange) < 0.05)
  assert.ok(child.parentExchange > 0)
})

test('a flush partition owns that part of the outer wall', () => {
  const load = {
    dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
    people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
    safetyFactor: 1, fanRuntime: 0, groundTempC: 12, ceilingToParent: false, floorToParent: false,
  }
  const parent = {
    id: 'parent', type: 'chilled', label: 'J1', x: 0, z: 0, width: 10, depth: 6, height: 3,
    temp: 2, uWall: 0.3, equipment: [], load,
  }
  const child = {
    id: 'child', type: 'frozen', label: 'P1', parentId: 'parent',
    x: 3, z: 0, width: 4, depth: 6, height: 3, temp: -18, uWall: 0.22, equipment: [], load,
  }
  const alone = calculateProject([parent]).rooms[0].lines.find((line) => line.key === 'walls-ambient').watts
  const shared = calculateProject([parent, child])
  const parentWall = shared.rooms[0].lines.find((line) => line.key === 'walls-ambient').watts
  const childWall = shared.rooms[1].lines.find((line) => line.key === 'walls-ambient').watts
  assert.ok(parentWall < alone - 20, `${parentWall} vs ${alone}`)
  assert.ok(childWall > 0)
})

test('labels and enquiry example stay stable', () => {
  assert.equal(nextLabel([{ label: 'J1' }], 'chilled'), 'J2')
  assert.equal(nextLabel([{ label: 'J1' }], 'frozen'), 'P1')
  const sample = buildEnquiryExample()
  assert.equal(sample.length, 2)
  assert.equal(sample[0].label, 'J1')
  assert.equal(sample[1].label, 'P1')
  assert.equal(sample[1].parentId, sample[0].id)
  const normalized = normalizeRooms([{ type: 'frozen', width: 5, depth: 4, height: 3 }])
  assert.equal(normalized[0].label, 'P1')
  assert.ok(normalized[0].load.safetyFactor >= 1)
})

test('DXF is real scale with layers, title and schedule', () => {
  const dxf = buildDxf({ projectName: 'Kasvikset', rooms: buildEnquiryExample() })
  assert.match(dxf, /AC1009/)
  assert.match(dxf, /\nWALLS\n/)
  assert.match(dxf, /\nPARTITIONS\n/)
  assert.match(dxf, /\nDOORS\n/)
  assert.match(dxf, /\nEVAPORATORS\n/)
  assert.match(dxf, /\nTITLE\n/)
  assert.match(dxf, /\nSCHEDULE\n/)
  assert.match(dxf, /\nLINE\n/)
  assert.match(dxf, /yksikko = 1 mm/)
})

test('an L-shaped outline uses its real floor area', () => {
  const outline = [
    { x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 3 },
    { x: 3, z: 3 }, { x: 3, z: 6 }, { x: 0, z: 6 },
  ]
  const project = calculateProject([{
    id: 'L', type: 'chilled', name: 'Kulma', label: 'J1',
    x: 3, z: 3, width: 6, depth: 6, height: 3,
    wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1,
    temp: 2, ambientTemp: 25, uWall: 0.3, uCeiling: 0.25, uFloor: 0.35,
    outline,
    equipment: [],
    load: {
      dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
      people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
      safetyFactor: 1, fanRuntime: 0, groundTempC: 10, cp: 3.85, entryTempC: 2,
      doorOpenSeconds: 0, doorWidthM: 1, doorHeightM: 2, infiltrationVelocity: 0,
      peopleWatts: 0, peopleHoursPerDay: 0, lightingHoursPerDay: 0, equipmentHoursPerDay: 0,
      ceilingToParent: false, floorToParent: false,
    },
  }])
  const room = project.rooms[0]
  assert.ok(room.internal.area < 27 && room.internal.area > 20, room.internal.area)
  const ceiling = room.lines.find((line) => line.key === 'ceiling')
  const boxCeiling = 0.25 * (5.8 * 5.8) * 23
  assert.ok(ceiling.watts > 100)
  assert.ok(ceiling.watts < boxCeiling - 20, `${ceiling.watts} should follow the L area, not ${boxCeiling}`)
})

test('SI and IP length and temperature convert both ways', () => {
  assert.ok(Math.abs(toLength(8, 'IP') - 26.2467) < 0.01)
  assert.ok(Math.abs(toTemp(2, 'IP') - 35.6) < 0.01)
  assert.ok(Math.abs(fromTemp(32, 'IP')) < 0.001)
})

const quietLoad = {
  dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 0, airChangesPerDay: 0,
  people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
  safetyFactor: 1, fanRuntime: 0, groundTempC: 12, ceilingToParent: false, floorToParent: false,
}

test('project area counts a nested room once', () => {
  const project = calculateProject([
    {
      id: 'parent', type: 'chilled', label: 'J1', x: 0, z: 0, width: 10, depth: 10, height: 4,
      wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1, temp: 2, equipment: [], load: quietLoad,
    },
    {
      id: 'child', type: 'frozen', label: 'P1', parentId: 'parent', x: 0, z: 0, width: 4, depth: 4, height: 3,
      wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1, temp: -18, equipment: [], load: quietLoad,
    },
  ])
  const parent = project.rooms.find((room) => room.id === 'parent')
  const child = project.rooms.find((room) => room.id === 'child')
  assert.ok(project.internalArea < parent.internal.area + child.internal.area - 1)
  assert.ok(Math.abs(project.internalArea - parent.internal.area) < 0.5, project.internalArea)
  assert.ok(project.internalVolume < parent.internal.volume + child.internal.volume - 1)
})

test('different safety factors do not invent transfer heat', () => {
  const rooms = (childFactor) => ([
    {
      id: 'parent', type: 'chilled', label: 'J1', x: 0, z: 0, width: 10, depth: 10, height: 4,
      temp: 2, equipment: [], load: { ...quietLoad, safetyFactor: 1 },
    },
    {
      id: 'child', type: 'frozen', label: 'P1', parentId: 'parent', x: 0, z: 0, width: 4, depth: 4, height: 3,
      temp: -18, equipment: [], load: { ...quietLoad, safetyFactor: childFactor, ceilingToParent: true },
    },
  ])
  const even = calculateProject(rooms(1))
  const uneven = calculateProject(rooms(2))
  const child = even.rooms.find((room) => room.id === 'child')
  const own = child.subtotal - child.parentExchange
  assert.ok(child.parentExchange > 1)
  assert.ok(Math.abs(uneven.total - (even.total + own)) < 1, `${uneven.total} vs ${even.total + own}`)
})

test('a side-wall door keeps its opening length', () => {
  const room = { x: 0, z: 0, width: 6, depth: 4 }
  const eq = { wall: 'e', x: 3, z: 0.2, width: 1.2, depth: 0.08, rotation: 90 }
  const symbol = doorSymbol(room, eq)
  assert.ok(Math.abs(Math.abs(symbol.z2 - symbol.z1) - 1.2) < 1e-6)
  assert.ok(Math.abs(symbol.x1 - symbol.x2) < 1e-6)
  const plan = doorPlanSize(eq)
  assert.equal(plan.d, 1.2)
  assert.ok(plan.w < 0.2)
  const south = doorPlanSize({ wall: 's', width: 1.5, depth: 0.1, rotation: 0 })
  assert.equal(south.w, 1.5)
  assert.ok(south.d < 0.2)
})

test('pdf isometric puts the roof above the floor', () => {
  const floor = isoPoint(1, 0, 1)
  const roof = isoPoint(1, 4, 1)
  assert.ok(roof.y > floor.y)
})

test('a partition cannot be translated out of its parent', () => {
  const parent = { id: 'parent', x: 0, z: 0, width: 10, depth: 10 }
  const child = { id: 'child', parentId: 'parent', x: 0, z: 0, width: 4, depth: 4 }
  const limited = clampTranslation(parent, child, 10, -8)
  assert.ok(limited.dx < 3.05 && limited.dx > 2.9, limited.dx)
  assert.ok(limited.dz > -3.05 && limited.dz < -2.9, limited.dz)
})

test('narrow rooms do not export a negative internal size', () => {
  const dxf = buildDxf({
    projectName: 'Kapea',
    rooms: [{
      type: 'chilled', name: 'Kapea', label: 'J1', x: 0, z: 0,
      width: 0.4, depth: 0.4, height: 3, wallThickness: 0.3,
      equipment: [],
    }],
  })
  assert.doesNotMatch(dxf, /sisus -/)
  assert.match(dxf, /sisus 0.20 x 0.20 m/)
})
