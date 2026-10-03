import './floorplan.test.mjs'
import './services.test.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateProject } from './heatLoad.js'
import { buildDxf } from './dxf.js'
import { buildEnquiryExample, internalDims, makeEquipment, nextLabel, normalizeRooms } from './geometry.js'
import { clampTranslation, doorSymbol } from './cadDraw.js'
import { doorPlanSize, isoPoint } from './pdfExport.js'
import { fromTemp, toLength, toTemp } from './units.js'
import { TEMPLATES, fanCountForWidth, getTemplate } from './catalog.js'
import { autoCircuit, outdoorMoves, outlineCrossings, pipeSupports, routeServiceLine, stampServiceHeights, validateRoute } from './pipeTopology.js'
import { offersForCapacity, suggestPackage, capacityCheck, templatesForGroup } from './selection.js'
import { sizeLine } from './pipeSizing.js'
import { resolvePipeCapacity, sizePlacedPipe } from './pipeDuty.js'
import { condenserFanBounds, condenserFanSpec } from './fanGuard.js'
import { comboBody, equipmentPorts, internalCeiling, outlinePoints, pointInOutline, resolvedElevation } from './placement.js'
import { buildSchematics } from './schematic.js'
import { buildingDimensionSpec, dimensionStyle, layoutRoomTags, roomDimensionSpec, technicalTagPosition } from './sceneDims.js'
import { panelSchedule, sharedWallPanels } from './sharedWalls.js'
import { doorChoices, doorContext, doorPlanFigures, doorSchedule, resolveDoor } from './doors.js'

test('room dimensions sit outside the shell in millimetres', () => {
  const room = { id: 'chilled', x: 0, z: 0, width: 8, depth: 6, height: 3.2 }
  const spec = roomDimensionSpec(room, { x: 0, z: 0 })
  const byAxis = Object.fromEntries(spec.labels.map((label) => [label.axis, label]))
  assert.equal(byAxis.x.text, '8000')
  assert.equal(byAxis.z.text, '6000')
  assert.equal(byAxis.y.text, '3200')
  assert.ok(byAxis.x.z > 3, 'length dimension is outside the depth')
  assert.ok(byAxis.z.x > 4, 'width dimension is outside the length')
  assert.ok(byAxis.y.y > 0.4 && byAxis.y.y < 3.2)
  const left = { id: 'left', x: 0, z: 0, width: 8, depth: 6, height: 3 }
  const right = { id: 'right', x: 8, z: 0, width: 5, depth: 6, height: 4 }
  const centroid = { x: 4, z: 0 }
  const leftZ = roomDimensionSpec(left, centroid).labels.find((label) => label.axis === 'z')
  const rightZ = roomDimensionSpec(right, centroid).labels.find((label) => label.axis === 'z')
  assert.ok(leftZ.x < -4, 'the left room dimensions stay on its outer side')
  assert.ok(rightZ.x > 10.5, 'the right room dimensions stay on its outer side')
  const tag = technicalTagPosition(room, { x: 0, z: 0 })
  assert.ok(tag[2] < 0 && byAxis.x.z > 0, 'the room tag sits opposite the length dimension')
  assert.ok(tag[0] < 0 && byAxis.z.x > 0, 'the room tag sits opposite the width dimension')
})

test('adjacent rooms share one wall and the quantity list counts it once', () => {
  const left = { id: 'left', type: 'chilled', x: 0, z: 0, width: 6, depth: 4, height: 3, wallThickness: 0.1 }
  const right = { id: 'right', type: 'frozen', x: 6, z: 0, width: 6, depth: 4, height: 3, wallThickness: 0.1 }
  const panels = sharedWallPanels([left, right])
  const shared = panels.filter((panel) => panel.shared)
  assert.equal(shared.length, 1)
  assert.equal(shared[0].thickness, 0.1)
  assert.ok(shared[0].b - shared[0].a > 3.5, 'the common run keeps the shared depth')
  const schedule = panelSchedule([left, right])
  const naive = 2 * (2 * (6 + 4) * 3)
  assert.equal(schedule.shared, 1)
  assert.ok(schedule.gross < naive - 10, `shared wall is not counted twice (${schedule.gross} vs ${naive})`)
  const apart = sharedWallPanels([
    left,
    { ...right, x: 20 },
  ])
  assert.equal(apart.filter((panel) => panel.shared).length, 0)
})

test('a door opening is cut from the shared wall once', () => {
  const room = {
    id: 'cold', type: 'chilled', x: 0, z: 0, width: 6, depth: 4, height: 3, wallThickness: 0.1,
    equipment: [{ id: 'd1', category: 'door', wall: 's', x: 0, z: 2, width: 1.2, height: 2.1, name: 'Liukuovi 1200' }],
  }
  const neighbour = { id: 'hall', type: 'corridor', x: 0, z: 4, width: 6, depth: 4, height: 3, wallThickness: 0.1, equipment: [] }
  const panels = sharedWallPanels([room, neighbour])
  const shared = panels.filter((panel) => panel.shared)
  assert.equal(shared.length, 1)
  assert.equal(shared[0].openings.length, 1)
  assert.ok(Math.abs((shared[0].openings[0].b - shared[0].openings[0].a) - 1.2) < 0.05)
  const coversDoor = shared[0].pieces.some((piece) => piece.y0 < 0.2 && piece.a < 0 && piece.b > 0)
  assert.equal(coversDoor, false)
})

test('building dimensions show one overall and a room chain without repeating the overall', () => {
  const left = { id: 'left', type: 'chilled', x: 0, z: 0, width: 8, depth: 6, height: 3 }
  const right = { id: 'right', type: 'frozen', x: 6.5, z: 0, width: 5, depth: 6, height: 4 }
  const spec = buildingDimensionSpec([left, right])
  const texts = spec.labels.map((label) => label.text)
  assert.ok(texts.includes('8000'))
  assert.ok(texts.includes('5000'))
  assert.ok(texts.includes('13000'))
  assert.equal(texts.filter((text) => text === '6000').length, 1)
  assert.ok(texts.includes('3000'))
  assert.ok(texts.includes('4000'))
  const alone = buildingDimensionSpec([left])
  const aloneText = alone.labels.map((label) => label.text)
  assert.equal(aloneText.filter((text) => text === '8000').length, 1)
  assert.equal(aloneText.filter((text) => text === '6000').length, 1)
  const dark = dimensionStyle('dark')
  assert.equal(dark.line, '#f4f7fb')
  assert.equal(dark.chipBg, '#14161a')
  assert.equal(dark.chipFg, '#f8fafc')
  const light = dimensionStyle('technical')
  assert.equal(light.chipBg, '#ffffff')
  assert.notEqual(light.chipFg, light.chipBg)
  const tags = layoutRoomTags([
    { id: 'a', name: 'Näytehuone', x: 0, z: 0, width: 2.8, depth: 2.6, height: 2.6, type: 'chilled' },
    { id: 'b', name: 'Vihanneshuone', x: 1.2, z: 0.4, width: 8, depth: 6, height: 3, type: 'chilled' },
  ])
  const gap = Math.hypot(tags[0].x - tags[1].x, tags[0].z - tags[1].z)
  assert.ok(gap >= 2, `room tags stay apart (${gap})`)
})

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

function placed(category, name, room, x, z, size) {
  return {
    id: `${category}-${name}`,
    category,
    name,
    x, z,
    rotation: 0,
    width: size.w,
    depth: size.d,
    height: size.h,
    capacityKw: size.kw || 0,
    mount: category === 'evaporator' ? 'ceiling' : 'floor',
    elevation: category === 'evaporator' ? 2.2 : 0,
  }
}

test('slanted evaporators use one to four fans by width', () => {
  assert.equal(fanCountForWidth(1.1), 1)
  assert.equal(fanCountForWidth(getTemplate('evap-slant-2').width), 2)
  assert.equal(fanCountForWidth(getTemplate('evap-slant-10').width), 3)
  assert.equal(fanCountForWidth(getTemplate('evap-slant-20').width), 4)
})

test('hot gas is sized on discharge density and the condenser drain line is one size larger', () => {
  const suction = sizeLine({ kind: 'suction', refrigerant: 'R449A', capacityKw: 15, teC: -8, tcC: 40, lengthM: 10, riseM: 0 })
  const hot = sizeLine({ kind: 'hotgas', refrigerant: 'R449A', capacityKw: 15, teC: -8, tcC: 40, lengthM: 10, riseM: 0 })
  assert.ok(hot.density > 40, hot.density)
  assert.ok(hot.odMm < suction.odMm, `${hot.odMm} vs ${suction.odMm}`)
  assert.match(hot.label, /Kuumakaasuputki/)
  assert.ok(hot.steps.some((step) => step.formula.includes('Painekaasu')))
  assert.ok(hot.steps.some((step) => step.formula.includes('Swamee-Jain')))
  const supply = sizeLine({ kind: 'liquid', refrigerant: 'R449A', capacityKw: 5, teC: -8, tcC: 40, lengthM: 12, riseM: 0, liquidService: 'supply' })
  const back = sizeLine({ kind: 'liquid', refrigerant: 'R449A', capacityKw: 5, teC: -8, tcC: 40, lengthM: 12, riseM: 0, liquidService: 'return' })
  assert.ok(back.odMm > supply.odMm, `${back.odMm} vs ${supply.odMm}`)
  assert.ok(back.steps.some((step) => /yhtä kokoa suurempi/.test(step.formula)))
})

test('pipes only join compatible ports and auto-pipe builds both circuits', () => {
  const cold = {
    id: 'cold', type: 'chilled', x: 0, z: 0, width: 6, depth: 4, height: 3, temp: 2, wallThickness: 0.1,
    equipment: [placed('evaporator', 'Höyrystin', { }, 0, 0, { w: 1.2, d: 0.6, h: 0.45, kw: 5 })],
  }
  const plant = {
    id: 'plant', type: 'plant', x: 8, z: 0, width: 4, depth: 4, height: 3, temp: 20, wallThickness: 0.1,
    equipment: [placed('compressor', 'Kompressori', {}, 0, 0.4, { w: 1.3, d: 0.7, h: 1.2, kw: 8 })],
  }
  const yard = {
    id: 'yard', type: 'warehouse', x: 8, z: -4.2, width: 4, depth: 3, height: 3, temp: 18, wallThickness: 0.1,
    equipment: [placed('condenser', 'Lauhdutin', {}, 0, 0, { w: 1.4, d: 0.6, h: 0.9, kw: 10 })],
  }
  const rooms = [cold, plant, yard]
  const evap = equipmentPorts(cold, cold.equipment[0])
  const comp = equipmentPorts(plant, plant.equipment[0])
  const cond = equipmentPorts(yard, yard.equipment[0])
  const badLiquid = validateRoute('liquid', [cond.liquid, evap.liquid], rooms)
  assert.equal(badLiquid.ok, false)
  assert.match(badLiquid.hint, /vastaanottimeen/)
  const badSuction = validateRoute('suction', [evap.suction, cond.hotgas], rooms)
  assert.equal(badSuction.ok, false)
  const goodReturn = validateRoute('liquid', [cond.liquid, comp.liquidIn], rooms)
  assert.equal(goodReturn.ok, true)
  assert.equal(goodReturn.segment, 'return')
  const split = autoCircuit(rooms, { id: (() => { let n = 0; return () => `p${n++}` })() })
  assert.equal(split.ok, true)
  const kinds = split.pipes.map((pipe) => pipe.kind + (pipe.segment ? `:${pipe.segment}` : ''))
  assert.ok(kinds.includes('suction'))
  assert.ok(kinds.includes('hotgas'))
  assert.ok(kinds.includes('liquid:return'))
  assert.ok(kinds.includes('liquid:supply'))
  assert.ok(split.pipes.some((pipe) => (pipe.points || []).some((point) => point.sleeve)))
  split.pipes.filter((pipe) => pipe.kind !== 'drain').forEach((pipe) => {
    const check = validateRoute(pipe.kind, pipe.points, rooms)
    assert.equal(check.ok, true, pipe.kind + (check.hint || ''))
  })
  const hot = split.pipes.find((pipe) => pipe.kind === 'hotgas')
  const sizedHot = sizePlacedPipe(hot, rooms, [], split.pipes).sized
  assert.match(sizedHot.label, /Kuumakaasuputki/)
  assert.ok(sizedHot.odMm > 0)
  const unitRoom = {
    ...cold,
    equipment: [
      ...cold.equipment,
      placed('combo', 'Koneikko', {}, 3.4, 0, { w: 1.1, d: 0.6, h: 0.8, kw: 8 }),
    ],
  }
  const onlyUnit = autoCircuit([unitRoom], { id: (() => { let n = 0; return () => `u${n++}` })() })
  assert.equal(onlyUnit.ok, true)
  assert.equal(onlyUnit.pipes.some((pipe) => pipe.kind === 'hotgas'), false)
  assert.ok(onlyUnit.pipes.some((pipe) => pipe.kind === 'liquid' && pipe.segment === 'supply'))
  assert.ok(onlyUnit.pipes.some((pipe) => pipe.kind === 'suction'))
})

test('a cold-room service line stays orthogonal and crosses one wall', () => {
  const cold = {
    id: 'cold', type: 'chilled', x: 0, z: 0, width: 10, depth: 6, height: 4, temp: 2, wallThickness: 0.1,
    equipment: [placed('evaporator', 'Höyrystin', {}, -2, 0.4, { w: 1.6, d: 0.7, h: 0.5, kw: 12 })],
  }
  const unit = placed('combo', 'Koneikko', {}, 5.5, 0.2, { w: 1.4, d: 0.6, h: 0.9, kw: 12 })
  unit.rotation = 270
  cold.equipment.push(unit)
  const evap = equipmentPorts(cold, cold.equipment[0])
  const ports = equipmentPorts(cold, unit)
  const suction = routeServiceLine(evap.suction, ports.suction, [cold], 0)
  const liquid = routeServiceLine(ports.liquid, evap.liquid, [cold], 1)
  ;[suction, liquid].forEach((points) => {
    for (let i = 1; i < points.length; i += 1) {
      const dx = Math.abs(points[i].x - points[i - 1].x)
      const dz = Math.abs(points[i].z - points[i - 1].z)
      assert.ok(dx < 0.02 || dz < 0.02, `diagonal ${dx.toFixed(2)},${dz.toFixed(2)}`)
    }
    assert.equal(outlineCrossings(points, [cold]), 1)
    assert.equal(validateRoute(points === suction ? 'suction' : 'liquid', points, [cold]).ok, true)
  })
})

function portLevel(room, eq) {
  const base = resolvedElevation(room, eq)
  const h = eq.height || 0.4
  if (eq.category === 'evaporator') return base + h * 0.42
  if (eq.category === 'combo' || eq.category === 'unit') return base + comboBody(eq).height / 3
  return base + Math.min(0.55, h * 0.4)
}

function drainTrapRise(point, stubY, room) {
  return point.y < stubY - 0.45 && !pointInOutline(point.x, point.z, outlinePoints(room))
}

function assertOneAxis(points) {
  for (let i = 1; i < points.length; i += 1) {
    const dx = Math.abs(points[i].x - points[i - 1].x)
    const dy = Math.abs((points[i].y || 0) - (points[i - 1].y || 0))
    const dz = Math.abs(points[i].z - points[i - 1].z)
    const axes = [dx > 0.03, dy > 0.03, dz > 0.03].filter(Boolean).length
    assert.ok(axes <= 1, `segment changes ${axes} axes (${dx.toFixed(3)}, ${dy.toFixed(3)}, ${dz.toFixed(3)})`)
  }
}

function applyOutdoorMoves(rooms, moves) {
  return rooms.map((room) => ({
    ...room,
    equipment: (room.equipment || []).map((eq) => {
      const move = moves.find((item) => item.roomId === room.id && item.eqId === eq.id)
      if (!move) return eq
      return {
        ...eq,
        x: move.x - room.x,
        z: move.z - room.z,
        rotation: move.rotation,
        mount: move.mount,
        elevation: move.elevation,
      }
    }),
  }))
}

test('service heights rise and drop on their own verticals', () => {
  const points = stampServiceHeights([
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 3 },
  ], 2.2, 1.2, 2.7)
  assertOneAxis(points)
  assert.equal(points[0].y, 2.2)
  assert.equal(points.at(-1).y, 1.2)
  assert.equal(points.at(-1).x, 2)
  assert.equal(points.at(-1).z, 3)
  assert.ok(points.some((point) => point.y === 2.7 && point.x === 2 && point.z === 0))
})

test('auto-pipe keeps an indoor unit unpiped until it is moved onto the wall', () => {
  const cold = {
    id: 'cold', type: 'chilled', x: 0, z: 0, width: 6, depth: 4, height: 3, temp: 2, wallThickness: 0.1,
    equipment: [
      placed('evaporator', 'Höyrystin', {}, -1.2, 0.2, { w: 1.4, d: 0.6, h: 0.45, kw: 8 }),
      placed('combo', 'Koneikko', {}, 0.4, 0.3, { w: 1.15, d: 0.78, h: 0.58, kw: 8 }),
    ],
  }
  const ids = () => { let n = 0; return () => `b${n++}` }
  const blocked = autoCircuit([cold], { id: ids() })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.offerMove, true)
  assert.equal(blocked.pipes.length, 0)
  assert.equal(outdoorMoves([cold]).length, 1)
  assert.match(blocked.hint, /ulkoseinälle/)
  const moved = applyOutdoorMoves([cold], blocked.moves)
  assert.equal(outdoorMoves(moved).length, 0)
  const unit = moved[0].equipment.find((eq) => eq.category === 'combo')
  assert.equal(unit.mount, 'wall')
  assert.ok(Math.abs(unit.elevation - 1.15) < 0.01)
  const piped = autoCircuit(moved, { id: ids() })
  assert.equal(piped.ok, true, piped.hint)
  const suction = piped.pipes.find((pipe) => pipe.kind === 'suction')
  const liquid = piped.pipes.find((pipe) => pipe.kind === 'liquid')
  const drain = piped.pipes.find((pipe) => pipe.kind === 'drain')
  const evap = moved[0].equipment.find((eq) => eq.category === 'evaporator')
  const ports = equipmentPorts(moved[0], evap)
  const valves = equipmentPorts(moved[0], unit)
  ;[suction, liquid].forEach((pipe) => {
    assertOneAxis(pipe.points)
    assert.equal(outlineCrossings(pipe.points, moved), 1)
    assert.equal(validateRoute(pipe.kind, pipe.points, moved).ok, true, pipe.kind)
  })
  assert.ok(Math.hypot(suction.points[0].x - ports.suction.x, suction.points[0].z - ports.suction.z) < 0.05)
  assert.ok(Math.abs(suction.points[0].y - portLevel(moved[0], evap)) < 0.05)
  assert.ok(Math.hypot(suction.points.at(-1).x - valves.suction.x, suction.points.at(-1).z - valves.suction.z) < 0.05)
  assert.ok(Math.abs(suction.points.at(-1).y - portLevel(moved[0], unit)) < 0.05)
  assert.ok(Math.hypot(liquid.points[0].x - valves.liquid.x, liquid.points[0].z - valves.liquid.z) < 0.05)
  assert.ok(Math.hypot(liquid.points.at(-1).x - ports.liquid.x, liquid.points.at(-1).z - ports.liquid.z) < 0.05)
  const flats = (points) => {
    const runs = []
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1 || Math.abs((a.y || 0) - (b.y || 0)) > 0.04) continue
      runs.push([a, b])
    }
    return runs
  }
  const paired = flats(suction.points).some(([a, b]) => flats(liquid.points).some(([c, d]) => {
    const alongX = Math.abs(a.z - b.z) < 0.03 && Math.abs(c.z - d.z) < 0.03
    const alongZ = Math.abs(a.x - b.x) < 0.03 && Math.abs(c.x - d.x) < 0.03
    if (!alongX && !alongZ) return false
    const gap = alongX ? Math.abs(a.z - c.z) : Math.abs(a.x - c.x)
    const overlap = alongX
      ? Math.min(a.x, b.x) < Math.max(c.x, d.x) - 0.4 && Math.min(c.x, d.x) < Math.max(a.x, b.x) - 0.4
      : Math.min(a.z, b.z) < Math.max(c.z, d.z) - 0.4 && Math.min(c.z, d.z) < Math.max(a.z, b.z) - 0.4
    return overlap && gap > 0.1 && gap < 0.35 && Math.abs(a.y - c.y) < 0.05
  }))
  assert.ok(paired, 'suction and liquid do not share a parallel ceiling run')
  let prev = drain.points[0]
  assert.ok(Math.hypot(prev.x - ports.drain.x, prev.z - ports.drain.z) < 0.05)
  for (let i = 1; i < drain.points.length; i += 1) {
    const point = drain.points[i]
    if (!drainTrapRise(point, drain.points[0].y, moved[0])) {
      assert.ok(point.y <= prev.y + 1e-6, `drain rises ${prev.y} -> ${point.y}`)
    }
    const dx = Math.abs(point.x - prev.x)
    const dz = Math.abs(point.z - prev.z)
    assert.ok(dx < 0.03 || dz < 0.03, `drain diagonal ${dx},${dz}`)
    const dist = Math.hypot(dx, dz)
    if (dist > 0.2 && point.y > drain.points[0].y - 0.25) {
      const grade = (prev.y - point.y) / dist
      assert.ok(grade >= 0.01 && grade <= 0.02, `drain slope ${grade.toFixed(3)}`)
    }
    prev = point
  }
  assert.equal(outlineCrossings(drain.points, moved), 1)
  const frozen = {
    ...cold,
    id: 'frozen',
    type: 'frozen',
    temp: -22,
    equipment: [
      cold.equipment[0],
      placed('combo', 'Koneikko', {}, 3.6, 0, { w: 1.15, d: 0.6, h: 0.7, kw: 8 }),
    ],
  }
  const traced = autoCircuit([frozen], { id: ids() })
  assert.equal(traced.ok, true, traced.hint)
  assert.ok(traced.pipes.find((pipe) => pipe.kind === 'drain').roomTempC < 0)
})

test('an outdoor unit keeps clear of the door and prefers the wall nearest the evaporator', () => {
  const room = {
    id: 'cold', type: 'chilled', x: 0, z: 0, width: 8, depth: 5, height: 3, temp: 2, wallThickness: 0.1,
    equipment: [
      placed('evaporator', 'Höyrystin', {}, -3.2, 0.2, { w: 1.3, d: 0.6, h: 0.45, kw: 8 }),
      placed('door', 'Kylmäovi', {}, -4, 0, { w: 0.9, d: 0.08, h: 2 }),
      placed('combo', 'Koneikko', {}, -0.4, 0.2, { w: 1.15, d: 0.7, h: 0.7, kw: 8 }),
    ],
  }
  room.equipment[1].wall = 'w'
  room.equipment[1].mount = 'floor'
  room.equipment[1].elevation = 0
  const blocked = autoCircuit([room], { id: (() => { let n = 0; return () => `d${n++}` })() })
  assert.equal(blocked.offerMove, true)
  assert.equal(blocked.pipes.length, 0)
  const moved = applyOutdoorMoves([room], blocked.moves)
  const unit = moved[0].equipment.find((eq) => eq.category === 'combo')
  const wx = moved[0].x + unit.x
  const wz = moved[0].z + unit.z
  assert.ok(wx < -moved[0].width / 2, 'unit stays on the west wall nearest the evaporator')
  assert.equal(unit.mount, 'wall')
  const door = moved[0].equipment.find((eq) => eq.category === 'door')
  const doorZ = moved[0].z + door.z
  const frameGap = Math.abs(wz - doorZ) - unit.width / 2 - door.width / 2
  assert.ok(frameGap >= 0.3, `door frame clearance ${frameGap.toFixed(2)}`)
  assert.ok(frameGap >= 0.45, `service clearance ${frameGap.toFixed(2)}`)
  const piped = autoCircuit(moved, { id: (() => { let n = 0; return () => `e${n++}` })() })
  assert.equal(piped.ok, true, piped.hint)
  const drain = piped.pipes.find((pipe) => pipe.kind === 'drain')
  const stubY = drain.points[0].y
  const poly = outlinePoints(moved[0])
  let traveled = 0
  for (let i = 1; i < drain.points.length; i += 1) {
    const point = drain.points[i]
    const prev = drain.points[i - 1]
    traveled += Math.hypot(point.x - prev.x, point.z - prev.z)
    const inside = pointInOutline(point.x, point.z, poly)
    if (inside) {
      assert.ok(point.y >= stubY - 0.02 * traveled - 0.02, `drain fell inside to ${point.y}`)
      assert.ok(point.y > stubY - 0.2, `drain left the stub height inside the room (${point.y})`)
    }
    if (point.y < stubY - 0.2) assert.equal(inside, false)
    assert.ok(Math.abs(point.x - prev.x) < 0.03 || Math.abs(point.z - prev.z) < 0.03)
  }
  const dropped = drain.points.filter((point) => point.y < stubY - 0.2)
  assert.ok(dropped.length >= 1)
  const suction = piped.pipes.find((pipe) => pipe.kind === 'suction')
  const liquid = piped.pipes.find((pipe) => pipe.kind === 'liquid')
  const suctionSleeve = suction.points.find((point) => point.sleeve)
  const liquidSleeve = liquid.points.find((point) => point.sleeve)
  assert.ok(suctionSleeve && liquidSleeve)
  assert.ok(Math.hypot(suctionSleeve.x - liquidSleeve.x, suctionSleeve.z - liquidSleeve.z) < 0.4)
})

test('the condenser fan lies in the face plane inside the casing', () => {
  const body = comboBody({ width: 1.15, height: 0.78, depth: 0.58, capacityKw: 8 })
  const casingH = body.height * 0.86
  const casingD = body.depth * 0.88
  const radius = Math.min(body.height * 0.32, body.width * 0.26, 0.38)
  const spec = condenserFanSpec(radius)
  const bounds = condenserFanBounds(radius)
  const depth = bounds.max[2] - bounds.min[2]
  const span = bounds.max[0] - bounds.min[0]
  assert.ok(spec.shroudLength >= 0.06 && spec.shroudLength <= 0.08, 'shroud is a short recess')
  assert.ok(Math.abs(spec.bladeZ + 0.04) < 0.005, 'blades sit about 40 mm behind the face')
  assert.ok(spec.grilleZ + spec.wire <= 0.005 + 1e-9 && spec.grilleZ + spec.wire >= 0.004, 'grille is about 5 mm proud')
  assert.ok(spec.openingR > spec.shroudInner && spec.openingR > spec.grilleR && spec.openingR > spec.bladeR)
  assert.ok(spec.bladeZ < spec.grilleZ && -spec.shroudLength < spec.bladeZ)
  assert.ok(depth < span * 0.35, `fan is edge-on (${depth.toFixed(3)} vs ${span.toFixed(3)})`)
  const groupY = body.height * 0.52
  const groupZ = casingD / 2
  const holeY = groupY - body.height * 0.5
  const casing = {
    minX: -body.width / 2,
    maxX: body.width / 2,
    minY: body.height * 0.5 - casingH / 2,
    maxY: body.height * 0.5 + casingH / 2,
    minZ: -casingD / 2,
    maxZ: casingD / 2,
  }
  assert.ok(bounds.min[0] >= casing.minX && bounds.max[0] <= casing.maxX)
  assert.ok(groupY + bounds.min[1] >= casing.minY - 1e-6 && groupY + bounds.max[1] <= casing.maxY + 1e-6)
  assert.ok(Math.abs(holeY) + spec.openingR < casingH / 2, 'the face opening fits the front panel')
  assert.ok(groupZ + bounds.min[2] >= casing.minZ)
  assert.ok(groupZ + spec.grilleZ + spec.wire <= casing.maxZ + 0.005 + 1e-9, 'grille stands more than 5 mm proud')
  assert.ok(groupZ - spec.shroudLength >= casing.minZ)
  assert.ok(groupZ + 0 <= casing.maxZ + 1e-6, 'shroud crosses the face')
})

test('ceiling hangers stay inside the room envelope', () => {
  const cold = {
    id: 'cold', type: 'frozen', x: 0, z: 0, width: 4.6, depth: 3.2, height: 2.8, temp: -20, wallThickness: 0.1,
    equipment: [
      placed('evaporator', 'Höyrystin', {}, -0.15, -0.7, { w: 1.3, d: 0.7, h: 0.48, kw: 8 }),
      placed('combo', 'Koneikko', {}, 0.45, 0.1, { w: 1.15, d: 0.58, h: 0.78, kw: 8 }),
    ],
  }
  const blocked = autoCircuit([cold], { id: (() => { let n = 0; return () => `h${n++}` })() })
  assert.equal(blocked.offerMove, true)
  const moved = applyOutdoorMoves([cold], blocked.moves)
  const piped = autoCircuit(moved, { id: (() => { let n = 0; return () => `i${n++}` })() })
  assert.equal(piped.ok, true, piped.hint)
  const poly = outlinePoints(moved[0])
  const supports = piped.pipes
    .filter((pipe) => pipe.kind === 'suction' || pipe.kind === 'liquid')
    .map((pipe) => pipeSupports(pipe.points, moved))
  const hangers = supports.flatMap((item) => item.hangers)
  const clips = supports.flatMap((item) => item.wallClips)
  assert.ok(hangers.length >= 1, 'the ceiling run has no hangers')
  hangers.forEach((hanger) => {
    assert.equal(pointInOutline(hanger.x, hanger.z, poly), true, `hanger outside at ${hanger.x.toFixed(2)},${hanger.z.toFixed(2)}`)
  })
  assert.ok(clips.length >= 1, 'the outdoor drops have no wall clips')
  clips.forEach((clip) => {
    assert.equal(pointInOutline(clip.x, clip.z, poly), false, `wall clip inside at ${clip.x.toFixed(2)},${clip.z.toFixed(2)}`)
  })
})

function schematicRoom(type, equipment, temp = 2) {
  return {
    id: type + equipment.map((item) => item.id).join(''),
    type, name: type === 'frozen' ? 'Pakaste' : 'Kylmio', label: 'J1',
    x: 0, z: 0, width: 8, depth: 6, height: 4, temp,
    equipment,
  }
}

test('schematic liquid line runs condenser, receiver, drier, sight glass, solenoid, TXV, evaporator', () => {
  const rooms = [
    schematicRoom('chilled', [
      { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 5, width: 1.4, x: 0, z: 0 },
    ]),
    schematicRoom('plant', [
      { id: 'comp', category: 'compressor', name: 'Kompressori', x: 6, z: 0 },
      { id: 'cond', category: 'condenser', name: 'Lauhdutin', x: 6, z: -4 },
    ]),
  ]
  const model = buildSchematics(rooms, { refrigerant: 'R449A', teC: -8, tcC: 40, projectName: 'Kaukoylauhdutin' })
  assert.equal(model.circuits.length, 1)
  const circuit = model.circuits[0]
  assert.equal(circuit.remote, true)
  assert.deepEqual(circuit.topology.liquid, ['condenser', 'receiver', 'filterDrier', 'sightGlass', 'solenoid', 'txv', 'evaporator'])
  assert.deepEqual(circuit.topology.discharge, ['compressor', 'condenser'])
  assert.deepEqual(circuit.topology.suction, ['evaporator', 'compressor'])
  assert.ok(circuit.boxes.some((box) => box.role === 'condenser'))
  assert.ok(circuit.boxes.some((box) => box.role === 'unit'))
  assert.ok(circuit.boxes.some((box) => box.role === 'room'))
  const suction = sizeLine({ kind: 'suction', refrigerant: 'R449A', capacityKw: 5, teC: -8, tcC: 40, lengthM: 15, riseM: 3, roomTempC: 2 })
  assert.match(circuit.sizes.suction, new RegExp(suction.odMm.toFixed(1).replace('.', '\\.')))
  assert.ok(circuit.sizes.liquidReturnOd >= circuit.sizes.liquidOd)
  assert.equal(circuit.drawing, 'technical')
  assert.ok(circuit.lines.some((line) => line.kind === 'discharge' && /^D-/.test(line.label)))
  const room = circuit.boxes.find((item) => item.role === 'room')
  const tt2 = circuit.symbols.find((item) => item.tag === 'TT2')
  assert.ok(tt2.x > room.x + 40 && tt2.x + tt2.w < room.x + room.w - 40)
  assert.ok(tt2.y > room.y && tt2.y + tt2.h < room.y + room.h)
  const ends = circuit.lines.map((line) => line.points[line.points.length - 1])
  circuit.symbols.find((item) => item.type === 'controller').terminals.forEach((term) => {
    if (term.n === '5' || term.n === '6') return
    const at = { x: 860 + term.x, y: 400 + term.y }
    assert.ok(ends.some((point) => Math.hypot(point.x - at.x, point.y - at.y) < 2), term.n)
  })
  const bulb = circuit.lines.find((line) => line.endCap === 'bulb')
  const tee = circuit.lines.find((line) => line.endCap === 'tee')
  const suctionX = circuit.symbols.find((item) => item.type === 'evaporator').ports.suction.x
  const suctionY = circuit.symbols.find((item) => item.type === 'evaporator').ports.suction.y
  assert.equal(bulb.points.at(-1).x, suctionX)
  assert.ok(bulb.points.at(-1).y > suctionY && bulb.points.at(-1).y < suctionY + 30)
  assert.equal(tee.points.at(-1).x, suctionX)
  assert.ok(tee.points.at(-1).y > bulb.points.at(-1).y)
  assert.equal(circuit.symbols.find((item) => item.type === 'compressor').tag, '1')
  assert.ok(circuit.parts.some((row) => row.tag === '1' && row.name === 'Kompressori'))
  const dxf = buildDxf({ projectName: 'Kaukoylauhdutin', rooms, schematic: { refrigerant: 'R449A', teC: -8, tcC: 40 } })
  assert.match(dxf, /\nSCH_SUCTION\n/)
  assert.match(dxf, /\nSCH_HOTGAS\n/)
  assert.match(dxf, /\nSCH_LIQUID\n/)
})

test('a combined condensing unit keeps the condenser inside the machine box', () => {
  const rooms = [schematicRoom('chilled', [
    { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 8, width: 1.6, x: 0, z: -1 },
    { id: 'unit', category: 'combo', name: 'Koneikko', x: 5, z: 0 },
    { id: 'ctrl', category: 'controller', name: 'Ohjain', x: -2, z: 2 },
  ])]
  const model = buildSchematics(rooms, { teC: -8, tcC: 40 })
  const circuit = model.circuits[0]
  assert.equal(circuit.remote, false)
  assert.equal(circuit.boxes.some((box) => box.role === 'condenser'), false)
  assert.equal(circuit.symbols.find((item) => item.type === 'condenser').group, 'unit')
  assert.equal(circuit.symbols.find((item) => item.type === 'receiver').group, 'unit')
  assert.ok(circuit.lines.some((line) => line.kind === 'control'))
  assert.ok(circuit.lines.some((line) => line.kind === 'sensor'))
})

function lineCutsSymbol(circuit) {
  const hits = []
  circuit.lines.forEach((line) => {
    line.points.forEach((point, index) => {
      if (!index) return
      const a = line.points[index - 1]
      const b = point
      for (let step = 1; step < 24; step += 1) {
        const t = step / 24
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        circuit.symbols.forEach((symbol) => {
          const pad = 3
          if (x > symbol.x + pad && x < symbol.x + symbol.w - pad && y > symbol.y + pad && y < symbol.y + symbol.h - pad) {
            hits.push(`${line.kind} through ${symbol.type}`)
          }
        })
      }
    })
  })
  return [...new Set(hits)]
}

test('schematic pipes stay outside component bodies', () => {
  const remote = buildSchematics([
    schematicRoom('chilled', [
      { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 5, width: 1.4, x: 0, z: 0 },
    ]),
    schematicRoom('plant', [
      { id: 'comp', category: 'compressor', name: 'Kompressori', x: 6, z: 0 },
      { id: 'cond', category: 'condenser', name: 'Lauhdutin', x: 6, z: -4 },
    ]),
  ], { refrigerant: 'R449A', teC: -8, tcC: 40 })
  const unit = buildSchematics([schematicRoom('frozen', [
    { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 10, width: 1.8, x: 0, z: -1 },
    { id: 'unit', category: 'combo', name: 'Koneikko', x: 4, z: 0 },
    { id: 'ctrl', category: 'controller', name: 'Ohjain', x: -2, z: 1 },
  ], -18)], { refrigerant: 'R449A', teC: -25, tcC: 40 })
  assert.deepEqual(lineCutsSymbol(remote.circuits[0]), [])
  assert.deepEqual(lineCutsSymbol(unit.circuits[0]), [])
  const labels = unit.circuits[0].labels
  labels.forEach((label, index) => {
    labels.slice(index + 1).forEach((other) => {
      const overlapX = Math.abs(label.x - other.x) < (label.w + other.w) / 2
      const overlapY = Math.abs(label.y - other.y) < (label.h + other.h) / 2
      assert.equal(overlapX && overlapY, false, `${label.text} / ${other.text}`)
    })
  })
})

test('technical sheet sizes a 2 kW hot gas line by pressure drop and keeps the presentation drawing', () => {
  const chilled = [schematicRoom('chilled', [
    { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 2, width: 1.2, x: 0, z: 0 },
    { id: 'unit', category: 'combo', name: 'Koneikko', x: 4, z: 0 },
  ])]
  const technical = buildSchematics(chilled, { refrigerant: 'R449A', teC: -8, tcC: 40 }).circuits[0]
  assert.ok(technical.sizes.hotgasOd >= 9.5, technical.sizes.hotgas)
  assert.match(technical.lines.find((line) => line.kind === 'suction' && line.label).label, /^S-/)
  assert.match(technical.lines.find((line) => line.kind === 'liquid' && line.label).label, /^L-/)
  assert.ok(technical.sizes.liquidReturnOd >= technical.sizes.liquidOd)
  const presented = buildSchematics(chilled, { drawing: 'presentation', teC: -8, tcC: 40 }).circuits[0]
  assert.equal(presented.drawing, 'presentation')
  assert.match(presented.lines.find((line) => line.kind === 'discharge').label, /Kuumakaasu/)
  const dxf = buildDxf({ projectName: 'Kaavio', rooms: chilled, schematic: { refrigerant: 'R449A', teC: -8, tcC: 40 } })
  assert.match(dxf, /\nCOMP\n/)
  assert.match(dxf, /\nINSERT\n/)
  assert.match(dxf, /\nSCH_FRAME\n/)
})

test('schematic accessories edit the topology', () => {
  const rooms = [schematicRoom('frozen', [
    { id: 'ev', category: 'evaporator', name: 'Hoyrystin', capacityKw: 4, x: 0, z: 0 },
    { id: 'comp', category: 'compressor', name: 'Kompressori', x: 8, z: 0 },
    { id: 'cond', category: 'condenser', name: 'Lauhdutin', x: 8, z: -3 },
  ], -18)]
  const model = buildSchematics(rooms, { teC: -25, tcC: 40 })
  assert.ok(model.circuits[0].topology.suction.includes('accumulator'))
  assert.equal(model.circuits[0].topology.oilReturn, false)
  const edited = buildSchematics(rooms, {
    teC: -25,
    tcC: 40,
    overrides: { comp: { oilSeparator: true, receiver: false, expansion: 'eev', accumulator: false, solenoid: false } },
  })
  const circuit = edited.circuits[0]
  assert.deepEqual(circuit.topology.discharge, ['compressor', 'oilSeparator', 'condenser'])
  assert.equal(circuit.topology.oilReturn, true)
  assert.equal(circuit.topology.liquid.includes('receiver'), false)
  assert.ok(circuit.topology.liquid.includes('eev'))
  assert.equal(circuit.topology.suction.includes('accumulator'), false)
  assert.ok(circuit.lines.some((line) => line.kind === 'oil'))
})

test('door types follow the room, and a cold boundary stays a cold door', () => {
  const cold = { id: 'cold', type: 'chilled', name: 'Jäähdytys', temp: 2, x: 0, z: 0, width: 4, depth: 4, height: 3 }
  const office = { id: 'office', type: 'office', name: 'Toimisto', temp: 21, x: -6, z: 0, width: 4, depth: 4, height: 3 }
  const corridor = { id: 'hall', type: 'corridor', name: 'Käytävä', temp: 18, x: 0, z: 3.5, width: 4, depth: 3, height: 3 }
  const dock = { id: 'dock', type: 'dock', name: 'Lastaus', temp: 12, x: 8, z: 0, width: 6, depth: 5, height: 5 }
  const ambientIds = templatesForGroup('door', null, { room: office, rooms: [cold, office] }).map((item) => item.id)
  assert.ok(ambientIds.includes('door-sectional'))
  assert.ok(ambientIds.includes('door-wood'))
  assert.ok(ambientIds.includes('door-fire-30'))
  assert.ok(ambientIds.includes('door-fire-60'))
  assert.ok(ambientIds.includes('door-roll'))
  assert.equal(ambientIds.includes('door-hinged-cold'), false)
  assert.equal(ambientIds.includes('door-leveler'), false)
  const coldIds = templatesForGroup('door', null, { room: cold }).map((item) => item.id)
  assert.ok(coldIds.includes('door-hinged-cold'))
  assert.ok(coldIds.includes('door-freezer'))
  assert.ok(coldIds.includes('door-strip'))
  assert.equal(coldIds.includes('door-wood'), false)
  const dockIds = templatesForGroup('door', null, { room: dock }).map((item) => item.id)
  assert.ok(dockIds.includes('door-leveler'))
  assert.ok(dockIds.includes('door-seal'))
  const between = { category: 'door', catalogId: 'door-wood', name: 'Väliovi', wall: 'n', x: 0, z: -1.5, width: 0.9, height: 2.1, doorFamily: 'auto' }
  const ctx = doorContext(corridor, between, [cold, corridor])
  assert.equal(ctx.autoFamily, 'cold')
  assert.equal(ctx.other.id, 'cold')
  const filtered = doorChoices(corridor, [cold, corridor], between).map((item) => item.id)
  assert.ok(filtered.includes('door-hinged-cold'))
  assert.equal(filtered.includes('door-wood'), false)
  const overridden = doorChoices(corridor, [cold, corridor], { ...between, doorFamily: 'ambient' }).map((item) => item.id)
  assert.ok(overridden.includes('door-wood'))
  assert.equal(overridden.includes('door-hinged-cold'), false)
  const legacy = resolveDoor({ catalogId: 'door-900', name: 'Kylmäovi 900', category: 'door', width: 0.9, height: 2 })
  assert.equal(legacy.style, 'hinged')
  assert.equal(legacy.family, 'cold')
  assert.equal(legacy.uValue, 0.5)
  const placed = makeEquipment('door-wood', corridor, 0, 2, [cold, corridor])
  assert.equal(placed.catalogId, 'door-hinged-cold')
  assert.equal(placed.wall, 'n')
})

test('a corridor door does not load a cold room, and a connecting door uses the corridor temperature', () => {
  const load = {
    dailyMassKg: 0, respirationWPerKg: 0, doorOpeningsPerDay: 20, airChangesPerDay: 0,
    people: 0, lightingWm2: 0, extraEquipmentW: 0, pullDownEnabled: false,
    safetyFactor: 1, fanRuntime: 0, groundTempC: 10, cp: 3.5, entryTempC: 2,
    doorOpenSeconds: 8, doorWidthM: 1, doorHeightM: 2, infiltrationVelocity: 0.5,
    peopleWatts: 0, peopleHoursPerDay: 0, lightingHoursPerDay: 0, equipmentHoursPerDay: 0,
    ceilingToParent: false, floorToParent: false,
  }
  const cold = {
    id: 'cold', type: 'chilled', name: 'Jäähdytys', label: 'J1', x: 0, z: 0, width: 4, depth: 4, height: 3,
    wallThickness: 0.1, ceilingThickness: 0.1, floorThickness: 0.1,
    temp: 2, ambientTemp: 25, uWall: 0.3, uCeiling: 0.25, uFloor: 0.35,
    equipment: [], load,
  }
  const corridor = {
    id: 'hall', type: 'corridor', name: 'Käytävä', label: 'K1', x: 0, z: 3.5, width: 4, depth: 3, height: 3,
    temp: 18, wallThickness: 0.18, equipment: [
      { id: 'office-door', category: 'door', catalogId: 'door-wood', name: 'Väliovi', doorStyle: 'hinged', uValue: 2, wall: 'e', x: 2, z: 0, width: 0.9, height: 2.1, depth: 0.06 },
    ],
    load,
  }
  const alone = calculateProject([cold]).rooms[0].lines.find((item) => item.key === 'door')
  const beside = calculateProject([cold, corridor]).rooms[0]
  const besideDoor = beside.lines.find((item) => item.key === 'door')
  assert.ok(Math.abs(besideDoor.watts - alone.watts) < 0.05, besideDoor.watts)
  assert.equal(beside.lines.some((item) => item.key.startsWith('door-u')), false)
  const connectedCold = {
    ...cold,
    equipment: [{ id: 'cd', category: 'door', catalogId: 'door-900', name: 'Kylmäovi 900', wall: 's', x: 0, z: 2, width: 1, height: 2, depth: 0.08 }],
  }
  const linked = calculateProject([connectedCold, { ...corridor, equipment: [] }]).rooms[0]
  const infiltration = linked.lines.find((item) => item.key === 'door')
  const expected = (20 * 8 * 2 * 0.5 * 1.2 * 1005 * 16) / 86400
  assert.ok(Math.abs(infiltration.watts - expected) < 0.2, `${infiltration.watts} vs ${expected}`)
  const transmission = linked.lines.find((item) => item.key === 'door-u-cd')
  assert.ok(transmission)
  assert.ok(Math.abs(transmission.watts - 0.5 * 2 * 16) < 0.2, transmission.watts)
  const steel = resolveDoor({ catalogId: 'door-steel', name: 'Teräsovi' })
  const sectional = resolveDoor({ catalogId: 'door-sectional', name: 'Nosto-ovi' })
  assert.ok(sectional.uValue < steel.uValue)
  assert.equal(sectional.insulated, true)
  assert.equal(steel.insulated, false)
  const freezer = calculateProject([{
    ...cold,
    equipment: [{ id: 'fz', category: 'door', catalogId: 'door-freezer', name: 'Pakkasovi', doorStyle: 'freezer', uValue: 0.28, heated: true, heaterW: 70, wall: 's', x: 0, z: 2, width: 0.9, height: 2, depth: 0.12 }],
  }, { ...corridor, equipment: [] }]).rooms[0]
  const heater = freezer.lines.find((item) => item.key === 'door-heat-fz')
  assert.equal(heater.watts, 70)
  const schedule = doorSchedule([
    connectedCold,
    { ...corridor, equipment: corridor.equipment },
    { id: 'off', equipment: [{ id: 'od', category: 'door', catalogId: 'door-wood', name: 'Väliovi', uValue: 2 }] },
  ])
  assert.ok(schedule.some((row) => row.name === 'Väliovi' && row.count === 2))
  const sectionalMark = doorPlanFigures(corridor, { catalogId: 'door-sectional', name: 'Nosto-ovi', wall: 's', x: 0, z: 1.5, width: 2.4, height: 2.5 })
  assert.equal(sectionalMark.style, 'sectional')
  assert.ok(sectionalMark.figures.filter((fig) => fig.role === 'panel').length >= 4)
  const rollMark = doorPlanFigures(corridor, { catalogId: 'door-roll', name: 'Rullaovi', wall: 's', x: 0, z: 1.5, width: 2.5, height: 2.6 })
  assert.ok(rollMark.figures.some((fig) => fig.role === 'box'))
  const dock = { id: 'dock', type: 'dock', x: 8, z: 0, width: 6, depth: 5, height: 5, wallThickness: 0.2 }
  const plate = doorPlanFigures(dock, { catalogId: 'door-leveler', name: 'Lastaussilta', wall: 's', x: 0, z: 2.5, width: 2, height: 0.2, depth: 2.2 })
  assert.ok(plate.figures.some((fig) => fig.role === 'plate'))
  const panels = sharedWallPanels([
    cold,
    { ...corridor, equipment: [{ id: 'lv', category: 'door', catalogId: 'door-leveler', name: 'Lastaussilta', doorStyle: 'leveler', cutsWall: false, wall: 'n', x: 0, z: -1.5, width: 2, height: 0.2 }] },
  ])
  assert.equal(panels.filter((panel) => panel.shared).every((panel) => panel.openings.length === 0), true)
})
