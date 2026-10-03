import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyPlan, exampleHouse, formatQuantity, materialsList, openingSymbol, setFaceMaterial, structureMarks, thicknessOf, updateHouse } from './floorplan.js'
import { thermalOf } from './roominfo.js'
import {
  annualHeatingKwh,
  assignHouseStructure,
  assignWallStructures,
  buildStructureCardPdf,
  hatchStrips,
  presetById,
  resolveStructure,
  resolveWallStructure,
  structureBill,
  structureCatalog,
  structurePerformance,
  writeWallLayers,
} from './structures.js'

function wall(id, a, b, kind, extra = {}) {
  return {
    id,
    a,
    b,
    kind,
    height: 2.6,
    thickness: kind === 'interior' ? 0.12 : 0.24,
    ...extra,
  }
}

function sample() {
  return {
    ...emptyPlan(),
    walls: [
      wall('e1', { x: 0, z: 0 }, { x: 6, z: 0 }, 'exterior'),
      wall('i1', { x: 2, z: 0 }, { x: 2, z: 4 }, 'interior'),
      wall('i2', { x: 4, z: 0 }, { x: 4, z: 4 }, 'interior'),
    ],
    openings: [],
    rooms: [{ id: 'r1', area: 24, suppressed: false }],
  }
}

test('timber-brick U ignores the cladding outside the ventilated cavity', () => {
  const spec = presetById('us-timber-brick')
  const full = structurePerformance(spec)
  const noBrick = structurePerformance({
    ...spec,
    layers: spec.layers.filter((item) => item.materialId !== 'brick'),
  })
  assert.equal(full.u, noBrick.u)
  assert.ok(full.u > 0.17 && full.u < 0.23, String(full.u))
  const siporex = structurePerformance(presetById('us-siporex-375'))
  assert.ok(Math.abs(siporex.u - 0.28) < 0.02, String(siporex.u))
  const wool = structurePerformance(presetById('vs-92-wool'))
  const bare = structurePerformance(presetById('vs-92'))
  assert.equal(wool.thicknessMm, 92)
  assert.ok(wool.u < bare.u)
})

test('each wall keeps its own structure code', () => {
  let plan = sample()
  plan = assignWallStructures(plan, ['e1'], 'us-timber-brick')
  plan = assignWallStructures(plan, ['i1'], 'vs-92-wool')
  plan = assignWallStructures(plan, ['i2'], 'vs-ei30')
  const codes = structureCatalog(plan).map((row) => `${row.code}:${row.id}`)
  assert.deepEqual(codes, ['US1:us-timber-brick', 'VS1:vs-92-wool', 'VS2:vs-ei30'])
  assert.equal(thicknessOf(plan.walls.find((item) => item.id === 'i1'), plan), 0.092)
  assert.equal(thicknessOf(plan.walls.find((item) => item.id === 'i2'), plan), 0.122)
  assert.ok(thicknessOf(plan.walls.find((item) => item.id === 'e1'), plan) > 0.3)
  const marks = structureMarks(plan).map((mark) => mark.code).sort()
  assert.deepEqual(marks, ['US1', 'VS1', 'VS2'])
})

test('the same structure on an exterior and an interior wall gets two codes', () => {
  let plan = sample()
  plan = assignWallStructures(plan, ['e1', 'i1'], 'vs-brick')
  const codes = structureCatalog(plan).map((row) => row.code)
  assert.deepEqual(codes, ['US1', 'VS1'])
})

test('a house default fills walls that have no own structure', () => {
  let plan = sample()
  plan = updateHouse(plan, assignHouseStructure(plan, 'interiorWall', 'vs-92-wool'))
  plan = assignWallStructures(plan, ['i2'], 'vs-brick')
  assert.equal(resolveWallStructure(plan, plan.walls.find((item) => item.id === 'i1')).id, 'vs-92-wool')
  assert.equal(resolveWallStructure(plan, plan.walls.find((item) => item.id === 'i2')).id, 'vs-brick')
  assert.equal(resolveWallStructure(plan, plan.walls.find((item) => item.id === 'e1')), null)
  assert.equal(thicknessOf(plan.walls.find((item) => item.id === 'e1'), plan), 0.24)
})

test('editing one wall forks a copy and leaves the shared preset alone', () => {
  let plan = sample()
  plan = assignWallStructures(plan, ['i1', 'i2'], 'vs-92-wool')
  const before = presetById('vs-92-wool').layers.map((item) => item.thicknessMm)
  const source = resolveWallStructure(plan, plan.walls.find((item) => item.id === 'i1'))
  plan = writeWallLayers(plan, ['i1'], {
    id: source.id,
    category: 'interior',
    name: 'Oma makuuhuoneen seinä',
    frameFraction: source.frameFraction,
    layers: source.layers.map((item, index) => (index === 1 ? { ...item, thicknessMm: 90 } : { ...item })),
  })
  assert.deepEqual(presetById('vs-92-wool').layers.map((item) => item.thicknessMm), before)
  const edited = plan.walls.find((item) => item.id === 'i1')
  const other = plan.walls.find((item) => item.id === 'i2')
  assert.match(edited.structureId, /^wt-/)
  assert.equal(other.structureId, 'vs-92-wool')
  assert.equal(resolveWallStructure(plan, edited).thicknessMm, 116)
  assert.equal(resolveStructure(plan, other.structureId).thicknessMm, 92)
})

test('assigning a structure leaves the face material alone', () => {
  let plan = sample()
  plan = setFaceMaterial(plan, 'i1', 'left', 'wallpaper')
  plan = setFaceMaterial(plan, 'i1', 'right', 'tile')
  plan = assignWallStructures(plan, ['i1'], 'vs-wet')
  const wall = plan.walls.find((item) => item.id === 'i1')
  assert.equal(wall.faces.left, 'wallpaper')
  assert.equal(wall.faces.right, 'tile')
  assert.equal(wall.structureId, 'vs-wet')
  assert.equal(wall.thicknessCustom, false)
})

test('the bill splits quantities by structure code and layer', () => {
  let plan = sample()
  plan = assignWallStructures(plan, ['i1'], 'vs-92-wool')
  plan = assignWallStructures(plan, ['i2'], 'vs-ei30')
  const rows = structureBill(plan)
  const wool = rows.filter((row) => row.code === 'VS1' && row.name === 'Mineraalivilla')
  assert.ok(wool.some((row) => row.unit === 'm²' && row.qty === 10.4))
  assert.ok(wool.some((row) => row.unit === 'm³' && Math.abs(row.qty - 10.4 * 0.066) < 0.02))
  const fire = rows.filter((row) => row.code === 'VS2')
  assert.ok(fire.length > 0)
  assert.ok(fire.every((row) => row.structureName.includes('EI30')))
  const listed = materialsList(plan).filter((row) => row.group === 'structure')
  assert.ok(listed.some((row) => row.unit === 'm³' && row.code === 'VS1'))
  assert.match(formatQuantity(0.686, 'm³'), /m³/)
})

test('hatch strips stop at openings and an unassigned plan stays unchanged', () => {
  const host = wall('i1', { x: 0, z: 0 }, { x: 4, z: 0 }, 'interior')
  const strips = hatchStrips(host, [{ wallId: 'i1', offset: 2, width: 1, kind: 'door' }], [host], presetById('vs-brick').layers)
  assert.equal(strips.length, 2)
  const span = (face) => [face.points[0].x, face.points[1].x]
  assert.deepEqual(span(strips[0]), [0, 1.5])
  assert.deepEqual(span(strips[1]), [2.5, 4])
  const house = exampleHouse()
  assert.equal(structureBill(house).length, 0)
  assert.equal(structureMarks(house).length, 0)
  const exterior = house.walls.find((item) => item.kind === 'exterior')
  assert.equal(thicknessOf(exterior, house), 0.24)
})

test('opening jambs follow the structure thickness', () => {
  const plan = assignWallStructures(sample(), ['e1'], 'vs-brick')
  const host = plan.walls.find((item) => item.id === 'e1')
  const symbol = openingSymbol(host, { wallId: 'e1', offset: 2, width: 1, kind: 'window', swing: 1 }, plan)
  const span = Math.hypot(symbol.jambA[0].x - symbol.jambA[1].x, symbol.jambA[0].z - symbol.jambA[1].z)
  assert.ok(Math.abs(span - 0.13) < 0.002, String(span))
})

test('climate degree days and annual heating energy', () => {
  const thermal = thermalOf({ ...emptyPlan(), thermal: { zone: 'I', place: 'helsinki' } })
  assert.equal(thermal.outdoor, -26)
  assert.equal(thermal.degreeDays, 4200)
  assert.equal(thermal.placeName, 'Helsinki')
  assert.equal(annualHeatingKwh(1000, 21, -29, 4700), 2256)
  const spec = resolveStructure(emptyPlan(), 'us-timber-brick')
  const doc = buildStructureCardPdf(spec)
  assert.equal(typeof doc.save, 'function')
  assert.equal(doc.getNumberOfPages(), 1)
})
