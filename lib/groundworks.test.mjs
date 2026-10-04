import test from 'node:test'
import assert from 'node:assert/strict'
import { exampleHouse, materialsList } from './floorplan.js'
import { applyHeating, serviceItemVisible, setServiceLayer, syncGroundworks, updateServiceRun } from './services.js'
import { addEnergyWell, addGroundArea, addWasteUnit, deleteYardItem, syncYardServices } from './yard.js'
import { groundWarnings, sizeBoreholes } from './groundworks.js'

test('borehole length follows peak power and annual energy', () => {
  const one = sizeBoreholes({ peakW: 6000, annualKwh: 0 })
  assert.equal(one.metres, 240)
  assert.equal(one.count, 1)
  assert.equal(one.depth, 240)
  const split = sizeBoreholes({ peakW: 9000, annualKwh: 0 })
  assert.equal(split.metres, 360)
  assert.equal(split.count, 2)
  assert.equal(split.depth, 180)
  const year = sizeBoreholes({ peakW: 6000, annualKwh: 40000 })
  assert.ok(year.metres > 240)
  assert.equal(year.count, 2)
})

function shell(extra = {}) {
  return {
    walls: [
      { id: 'w1', kind: 'exterior', a: { x: 0, z: 0 }, b: { x: 10, z: 0 } },
      { id: 'w2', kind: 'exterior', a: { x: 10, z: 0 }, b: { x: 10, z: 8 } },
    ],
    yard: {
      plot: { id: 'plot', points: [{ x: -30, z: -30 }, { x: 50, z: -30 }, { x: 50, z: 50 }, { x: -30, z: 50 }] },
      objects: [],
      ground: { mode: 'borehole', wells: [], loop: null, water: [] },
      waste: { mode: 'onsite', units: [], areas: [], lines: [] },
      ...extra.yard,
    },
    ...extra,
    yard: {
      plot: { id: 'plot', points: [{ x: -30, z: -30 }, { x: 50, z: -30 }, { x: 50, z: 50 }, { x: -30, z: 50 }] },
      objects: extra.objects || [],
      buildings: extra.buildings || [],
      ground: extra.ground || { mode: 'borehole', wells: [], loop: null, water: [] },
      waste: extra.waste || { mode: 'onsite', units: [], areas: [], lines: [] },
    },
  }
}

test('energy-well clearances warn against the plot, buildings, wells and sewage', () => {
  const tight = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 5, z: 2, depth: 100 }, { id: 'b', x: 5, z: 12, depth: 100 }] },
  }))
  assert.ok(tight.some((item) => item.code === 'building' && item.level === 'fail'))
  assert.ok(tight.some((item) => item.code === 'spacing' && item.level === 'fail'))

  const plot = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 46, z: 10, depth: 100 }] },
  }))
  assert.ok(plot.some((item) => item.code === 'plot' && item.level === 'fail'))

  const warnGap = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }, { id: 'b', x: 38, z: 20, depth: 80 }] },
  }))
  assert.ok(warnGap.some((item) => item.code === 'spacing' && item.level === 'warn'))
  assert.equal(warnGap.some((item) => item.code === 'spacing' && item.level === 'fail'), false)

  const okGap = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }, { id: 'b', x: 42, z: 20, depth: 80 }] },
  }))
  assert.equal(okGap.some((item) => item.code === 'spacing'), false)

  const drinkFail = groundWarnings(shell({
    objects: [{ id: 'dw', kind: 'well', x: 20, z: 35 }],
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
  }))
  assert.ok(drinkFail.some((item) => item.code === 'drinking' && item.level === 'fail'))

  const drinkWarn = groundWarnings(shell({
    objects: [{ id: 'dw', kind: 'well', x: 20, z: 50 }],
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
  }))
  assert.ok(drinkWarn.some((item) => item.code === 'drinking' && item.level === 'warn'))

  const drinkOk = groundWarnings(shell({
    objects: [{ id: 'dw', kind: 'well', x: 20, z: 70 }],
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
  }))
  assert.equal(drinkOk.some((item) => item.code === 'drinking'), false)

  const sewage = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
    waste: { mode: 'onsite', units: [{ id: 's', kind: 'septic', x: 30, z: 20, w: 2, d: 1 }], areas: [], lines: [] },
  }))
  assert.ok(sewage.some((item) => item.code === 'sewage' && item.level === 'fail'))

  const storm = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
    waste: { mode: 'onsite', units: [{ id: 'r', kind: 'stormwell', x: 23, z: 20, w: 0.8, d: 0.8 }], areas: [], lines: [] },
  }))
  assert.ok(storm.some((item) => item.code === 'storm'))
  const stormOk = groundWarnings(shell({
    ground: { mode: 'borehole', wells: [{ id: 'a', x: 20, z: 20, depth: 80 }] },
    waste: { mode: 'onsite', units: [{ id: 'r', kind: 'stormwell', x: 28, z: 20, w: 0.8, d: 0.8 }], areas: [], lines: [] },
  }))
  assert.equal(stormOk.some((item) => item.code === 'storm'), false)
})

test('a ground-source house gets a dashed collector and on-site drains keep their slope', () => {
  let plan = addEnergyWell(exampleHouse(), 28, 4)
  const collector = plan.services.runs.find((run) => run.kind === 'collector')
  assert.ok(collector)
  assert.equal(collector.dashed, true)
  assert.equal(collector.locked, true)
  assert.ok(String(collector.linkedFrom).startsWith('yard:ground:'))
  assert.ok(collector.points.every((point) => point.y === -0.8))
  const pump = plan.services.nodes.find((node) => node.kind === 'heatpump')
  assert.equal(pump, undefined)
  assert.ok(plan.yard.ground.wells.length >= 1)
  assert.ok(plan.yard.ground.wells.every((well) => well.depth > 20))

  plan = addWasteUnit(plan, 'septic', 28, 30)
  plan = addGroundArea(plan, 'field', [
    { x: 24, z: 34 },
    { x: 36, z: 34 },
    { x: 36, z: 42 },
    { x: 24, z: 42 },
  ])
  const sewer = plan.services.runs.find((run) => String(run.linkedFrom || '').endsWith(':sewer'))
  assert.ok(sewer)
  assert.equal(sewer.system, 'drain')
  assert.equal(sewer.locked, true)
  assert.ok(sewer.points[sewer.points.length - 1].y < sewer.points[0].y)
  const edited = updateServiceRun(plan, sewer.id, { slope: 2 })
  const sloped = edited.services.runs.find((run) => run.id === sewer.id)
  assert.equal(sloped.manual, true)
  assert.ok(sloped.points[sloped.points.length - 1].y < sewer.points[sewer.points.length - 1].y)
  const kept = syncYardServices(edited)
  const again = kept.services.runs.find((run) => run.id === sewer.id)
  assert.equal(again.points[again.points.length - 1].y, sloped.points[sloped.points.length - 1].y)
  assert.ok(kept.services.runs.some((run) => String(run.linkedFrom || '').includes(':dist:')))

  const hidden = setServiceLayer(kept, 'ground', false)
  assert.equal(serviceItemVisible(hidden, collector), false)
  assert.equal(serviceItemVisible(setServiceLayer(kept, 'ground', true), collector), true)

  const settings = applyHeating(exampleHouse(), { source: 'ground', borehole: false })
  assert.equal(settings.services.nodes.length, 0)
  assert.equal(settings.services.runs.length, 0)
  const looped = syncGroundworks(settings)
  assert.equal(looped.yard.ground.mode, 'loop')
  assert.ok(looped.yard.ground.loop.points.length >= 3)
  assert.equal(looped.yard.ground.wells.length, 0)
  assert.ok(looped.services.runs.some((run) => run.kind === 'collector' && run.dashed))
})

test('a treatment-plant pump is an outdoor electrical device and the works are listed', () => {
  let plan = addWasteUnit(exampleHouse(), 'plant', 30, 28)
  plan = addWasteUnit(plan, 'holding', 30, 40)
  const pump = plan.services.nodes.find((node) => node.kind === 'treatment-pump')
  assert.ok(pump)
  assert.equal(pump.voltage, 230)
  assert.equal(pump.power, 400)
  assert.equal(pump.outdoor, true)
  assert.equal(pump.ip, 'IP68')
  assert.ok(String(pump.linkedFrom).startsWith('yard:waste:'))
  assert.ok(String(pump.linkedFrom).endsWith(':pump'))
  const holding = plan.yard.waste.units.find((item) => item.kind === 'holding')
  assert.equal(holding.volume, 8)
  assert.match(holding.accessNote, /Tyhjennys/)
  const removed = deleteYardItem(plan, 'waste-units', plan.yard.waste.units.find((item) => item.kind === 'plant').id)
  assert.equal(removed.services.nodes.some((node) => node.kind === 'treatment-pump'), false)
  const listed = materialsList(plan)
  assert.ok(listed.some((row) => row.group === 'ground' && /Energiakaivo|Pienpuhdistamo|Umpisäiliö/.test(row.name)))
  assert.ok(listed.some((row) => row.groupLabel === 'Katto' && row.name === 'Pelti'))
})
