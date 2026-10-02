import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateProject } from './heatLoad.js'
import { buildDxf } from './dxf.js'
import { buildEnquiryExample, internalDims, makeEquipment, nextLabel, normalizeRooms } from './geometry.js'
import { clampTranslation, doorSymbol } from './cadDraw.js'
import { doorPlanSize, isoPoint } from './pdfExport.js'
import { fromTemp, toLength, toTemp } from './units.js'
import { TEMPLATES } from './catalog.js'
import { offersForCapacity, suggestPackage, capacityCheck } from './selection.js'
import { sizeLine } from './pipeSizing.js'
import { resolvePipeCapacity } from './pipeDuty.js'
import { equipmentPorts, internalCeiling } from './placement.js'

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

test('suction and liquid lines follow velocity, pressure drop and oil return', () => {
  const suction = sizeLine({
    kind: 'suction', refrigerant: 'R449A', capacityKw: 10, teC: -10, tcC: 40, lengthM: 20, riseM: 3,
  })
  const liquid = sizeLine({
    kind: 'liquid', refrigerant: 'R449A', capacityKw: 10, teC: -10, tcC: 40, lengthM: 20, riseM: 0,
  })
  assert.ok(suction.odMm > liquid.odMm, `${suction.odMm} vs ${liquid.odMm}`)
  assert.ok(suction.velocity >= 6 && suction.velocity <= 20, suction.velocity)
  assert.ok(liquid.velocity <= 2, liquid.velocity)
  assert.ok(suction.steps.some((step) => step.formula.includes('Q / q0')))
  assert.match(suction.label, /mm/)
  assert.match(suction.inch, /\//)
  const freezerDrain = sizeLine({ kind: 'drain', roomTempC: -18 })
  assert.equal(freezerDrain.heatTraced, true)
  assert.equal(freezerDrain.insulated, true)
  assert.equal(freezerDrain.odMm, 25)
  assert.match(freezerDrain.label, /lämmityskaapeli/)
  const chilledDrain = sizeLine({ kind: 'drain', roomTempC: 2 })
  assert.equal(chilledDrain.heatTraced, false)
  assert.equal(chilledDrain.odMm, 20)
  const co2 = sizeLine({ kind: 'suction', refrigerant: 'R744', capacityKw: 5, teC: -10, tcC: 40, lengthM: 12, riseM: 0 })
  assert.ok(co2.odMm > 0)
  assert.ok(co2.warnings.some((warning) => /kriittinen|kaasujäähdytin/.test(warning)))
  for (const id of ['R404A', 'R449A', 'R452A', 'R134a', 'R290', 'R744']) {
    const sized = sizeLine({ kind: 'suction', refrigerant: id, capacityKw: 4, teC: -8, tcC: 35, lengthM: 15, riseM: 2 })
    assert.ok(sized.odMm >= 6, id)
  }
})

test('a 2 kW load is offered covering sizes, not a 5 or 10 kW evaporator', () => {
  const cubics = TEMPLATES.filter((item) => item.category === 'evaporator' && item.style !== 'slant')
  const offers = offersForCapacity(cubics, 2)
  assert.equal(offers.items[0].capacityKw, 2)
  assert.ok(offers.items.length >= 2)
  assert.ok(offers.items.every((item) => item.capacityKw >= 2 && item.capacityKw <= 4))
  assert.equal(capacityCheck(2, 1).status, 'under')
  assert.equal(capacityCheck(2, 10).status, 'over')
  assert.equal(capacityCheck(2, 2.5).status, 'ok')
  assert.equal(capacityCheck(2, 2.5).percent, 125)
  assert.equal(capacityCheck(2.02, 2).status, 'ok')
  const pack = suggestPackage(2000, { refrigerant: 'R449A', teC: -8, tcC: 40, lengthM: 15, riseM: 3 })
  assert.equal(pack.evap.capacityKw, 2)
  assert.equal(pack.slant.style, 'slant')
  assert.equal(pack.slant.capacityKw, 2)
  assert.ok(pack.combo.capacityKw >= 2 && pack.combo.capacityKw <= 3)
  assert.ok(pack.condenser.capacityKw + 1e-6 >= pack.rejectionKw)
  assert.ok(pack.suction.odMm >= pack.liquid.odMm)
  assert.ok(TEMPLATES.some((item) => item.category === 'compressor' && item.capacityKw === 2))
  assert.ok(TEMPLATES.some((item) => item.id === 'evap-5' && item.style === 'cubic'))
  assert.ok(TEMPLATES.some((item) => item.id === 'unit-8' && item.category === 'combo'))
})

test('a non-refrigerated space is left out of the load but feeds the shared wall', () => {
  const cold = {
    id: 'c', type: 'chilled', label: 'J1', x: 2, z: 0, width: 4, depth: 4, height: 3,
    temp: 2, ambientTemp: 25, uWall: 0.3, equipment: [], load: quietLoad,
  }
  const warehouse = {
    id: 'w', type: 'warehouse', label: 'A1', name: 'Varasto', x: 6, z: 0, width: 4, depth: 4, height: 4,
    temp: 5, uWall: 5, wallThickness: 0.2, equipment: [], load: quietLoad,
  }
  const only = calculateProject([cold])
  const both = calculateProject([cold, warehouse])
  assert.equal(both.rooms.length, 1)
  assert.equal(both.rooms[0].id, 'c')
  assert.ok(Math.abs(both.total - only.total) > 1, `${both.total} vs ${only.total}`)
  assert.ok(both.rooms[0].lines.some((line) => line.key.startsWith('share-')))
})

test('evaporators default to the ceiling and condensing units leave the cold room', () => {
  const room = {
    id: 'r', type: 'chilled', x: 0, z: 0, width: 8, depth: 6, height: 4,
    wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1, equipment: [],
  }
  const evap = makeEquipment('evap-5', room, 1, 0.4, [room])
  assert.equal(evap.mount, 'ceiling')
  assert.ok(Math.abs(evap.elevation + evap.height - internalCeiling(room)) < 0.02)
  const outdoor = makeEquipment('cond-15', room, 0, 0, [room])
  assert.ok(Math.abs(outdoor.x) > room.width / 2 - 0.05 || Math.abs(outdoor.z) > room.depth / 2 - 0.05)
  assert.match(outdoor.warning, /ulkosein/)
  assert.equal(outdoor.mount, 'wall')
})

test('DXF keeps pipe layers and mounting height in the schedule', () => {
  const dxf = buildDxf({
    projectName: 'Putki',
    rooms: [{
      type: 'chilled', label: 'J1', name: 'Jaahdytys', x: 0, z: 0, width: 6, depth: 4, height: 3,
      equipment: [{
        id: 'e', category: 'evaporator', name: 'Hoyrystin', width: 1, depth: 0.5, height: 0.4,
        x: 0, z: 0, capacityKw: 2, elevation: 2.2, mount: 'ceiling',
      }],
    }],
    pipes: [{
      id: 'p', kind: 'suction', refrigerant: 'R449A', capacityKw: 2, teC: -8, tcC: 40, riseM: 1, roomTempC: 2,
      points: [{ x: 0, z: 0 }, { x: 4, z: 0 }],
    }],
    cables: [{ id: 'c', points: [{ x: 0, z: 1 }, { x: 2, z: 1 }] }],
  })
  assert.match(dxf, /\nSUCTION\n/)
  assert.match(dxf, /\nLIQUID\n/)
  assert.match(dxf, /\nDRAIN\n/)
  assert.match(dxf, /\nCABLES\n/)
  assert.match(dxf, /\nBUILDING\n/)
  assert.match(dxf, /koro 2.20 m/)
  assert.match(dxf, /Imuputki/)
  assert.match(dxf, /12\.7 mm/)
})

test('a line with no capacity is not given the smallest tube', () => {
  const sized = sizeLine({ kind: 'suction', refrigerant: 'R449A', capacityKw: 0, teC: -8, tcC: 40, lengthM: 2.3, riseM: 3 })
  assert.equal(sized.missingCapacity, true)
  assert.equal(sized.odMm, 0)
  assert.match(sized.warnings.join(' '), /Liitä putki höyrystimeen tai syötä teho/)
  assert.equal(sized.steps.some((step) => /64 \/ Re/.test(step.formula)), false)
})

test('a small R449A evaporator sizes near 1/2 inch suction and 1/4 inch liquid', () => {
  const suction = sizeLine({
    kind: 'suction', refrigerant: 'R449A', capacityKw: 3, teC: -8, tcC: 40, lengthM: 2.3, riseM: 3,
  })
  const liquid = sizeLine({
    kind: 'liquid', refrigerant: 'R449A', capacityKw: 3, teC: -8, tcC: 40, lengthM: 2.3, riseM: 0,
  })
  assert.equal(suction.odMm, 12.7)
  assert.equal(suction.inch, '1/2')
  assert.ok(suction.velocity >= 6 && suction.velocity <= 15, suction.velocity)
  assert.ok(suction.equivalentTempK <= 1.1, suction.equivalentTempK)
  assert.ok(suction.steps.some((step) => step.formula.includes('Swamee-Jain')))
  assert.equal(liquid.odMm, 6.35)
  assert.equal(liquid.inch, '1/4')
  assert.ok(liquid.velocity <= 1.5, liquid.velocity)
  const twoKw = sizeLine({
    kind: 'suction', refrigerant: 'R449A', capacityKw: 2, teC: -8, tcC: 40, lengthM: 5, riseM: 3,
  })
  assert.equal(twoKw.inch, '1/2')
  const longRun = sizeLine({
    kind: 'suction', refrigerant: 'R449A', capacityKw: 3, teC: -8, tcC: 40, lengthM: 15.2, riseM: 0,
  })
  assert.equal(longRun.inch, '5/8')
  const r134a = sizeLine({ kind: 'suction', refrigerant: 'R134a', capacityKw: 3, teC: -8, tcC: 40, lengthM: 8, riseM: 0 })
  const r449 = sizeLine({ kind: 'suction', refrigerant: 'R449A', capacityKw: 3, teC: -8, tcC: 40, lengthM: 8, riseM: 0 })
  const r744 = sizeLine({ kind: 'suction', refrigerant: 'R744', capacityKw: 3, teC: -8, tcC: 40, lengthM: 8, riseM: 0 })
  assert.ok(r134a.odMm > r449.odMm)
  assert.ok(r744.odMm < r449.odMm)
  const liquidTable = sizeLine({ kind: 'liquid', refrigerant: 'R449A', capacityKw: 5, teC: -8, tcC: 40, lengthM: 15, riseM: 0 })
  assert.ok(liquidTable.odMm >= 6.35 && liquidTable.odMm <= 12.7)
})

test('pipe capacity follows the connected evaporator, then the room, then a manual override', () => {
  const room = {
    id: 'r', type: 'chilled', label: 'J2', name: 'Näyte', x: 0, z: 0, width: 4, depth: 3, height: 3,
    temp: 2, equipment: [{
      id: 'ev', category: 'evaporator', name: 'Höyrystin 3 kW', width: 1.1, depth: 0.6, height: 0.4,
      x: 0, z: 0, rotation: 0, capacityKw: 3,
    }],
  }
  const ports = equipmentPorts(room, room.equipment[0])
  const linked = {
    id: 's', kind: 'suction', points: [ports.suction, { x: ports.suction.x + 2.3, z: ports.suction.z }],
  }
  const fromEvap = resolvePipeCapacity(linked, [room], [{ id: 'r', total: 2000 }])
  assert.equal(fromEvap.source, 'evaporator')
  assert.equal(fromEvap.kw, 3)
  const inside = { id: 's2', kind: 'suction', points: [{ x: 1.5, z: 1.1 }, { x: 1.5, z: 0.6 }] }
  const fromRoom = resolvePipeCapacity(inside, [room], [{ id: 'r', total: 2500 }])
  assert.equal(fromRoom.source, 'room')
  assert.ok(Math.abs(fromRoom.kw - 2.5) < 0.01)
  const outside = { id: 's3', kind: 'suction', points: [{ x: 20, z: 20 }, { x: 22, z: 20 }] }
  const missing = resolvePipeCapacity(outside, [room], [{ id: 'r', total: 2500 }])
  assert.equal(missing.source, 'missing')
  assert.equal(missing.kw, 0)
  const manual = resolvePipeCapacity({ ...linked, capacityManual: true, capacityKw: 4.5 }, [room], [])
  assert.equal(manual.source, 'manual')
  assert.equal(manual.kw, 4.5)
  assert.match(manual.note, /3\.00 kW/)
})
