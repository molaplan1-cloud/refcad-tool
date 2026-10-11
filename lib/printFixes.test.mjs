import test from 'node:test'
import assert from 'node:assert/strict'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { suggestEvaporators } from './catalog.js'
import { equipmentBrief, equipmentRows, formatEquipmentLine } from './coldUnits.js'
import { calculateProject } from './heatLoad.js'
import { buildPdf, fitSchematicBox } from './pdfExport.js'
import { translate } from './i18n.js'

const load = {
  safetyFactor: 1,
  productId: 'generic',
  dailyMassKg: 0,
  doorOpeningsPerDay: 0,
  people: 0,
  lightsWPerM2: 0,
  fansW: 0,
  defrostW: 0,
  pullDown: false,
}

function shell(id, label, unitId, x) {
  return {
    id,
    type: 'chilled',
    name: label,
    label,
    temp: 2,
    x,
    z: 0,
    width: 4,
    depth: 3,
    height: 3,
    wallThickness: 0.1,
    uWall: 0.3,
    uCeiling: 0.25,
    uFloor: 0.35,
    equipment: [],
    load,
    unitId,
  }
}

function fakeResult(rows) {
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    rooms: rows.map((row) => ({
      id: row.id,
      total: row.total,
      suggestedEvap: suggestEvaporators(row.total),
    })),
  }
}

async function pdfPages(doc) {
  const data = new Uint8Array(doc.output('arraybuffer'))
  const pdf = await getDocument({ data, disableWorker: true, isEvalSupported: false }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join('\n'))
  }
  return pages
}

test('each unit keeps its own evaporator sized from that room', () => {
  const units = [{ id: 'k1', name: 'K1' }, { id: 'k2', name: 'K2' }]
  const rooms = [shell('a', 'J1', 'k1', 0), shell('b', 'J2', 'k2', 4)]
  const result = fakeResult([{ id: 'a', total: 4590 }, { id: 'b', total: 2270 }])
  const brief = equipmentBrief(rooms, result, { units, diversity: 1 })
  assert.deepEqual(brief.map((group) => formatEquipmentLine(group)), [
    'K1: Koneikko 5 kW + Höyrystin 5 kW (J1)',
    'K2: Koneikko 2,5 kW + Höyrystin 2,5 kW (J2)',
  ])
  assert.equal(brief.some((group) => group.evaporators.some((ev) => /8/.test(ev.name))), false)
  const site = suggestEvaporators(result.total)
  assert.equal(site.template.name, 'Höyrystin 8 kW')
  assert.equal(brief.some((group) => group.machineName === site.template.name || group.evaporators.some((ev) => ev.name === site.template.name)), false)
  const rows = equipmentRows(brief)
  assert.deepEqual(rows.map((row) => `${row.kind}:${row.unit}:${row.name}`), [
    'unit:K1:Koneikko 5 kW',
    'evaporator:K1:Höyrystin 5 kW',
    'unit:K2:Koneikko 2,5 kW',
    'evaporator:K2:Höyrystin 2,5 kW',
  ])
})

test('two rooms on one unit get one machine and two evaporators', () => {
  const rooms = [shell('a', 'J1', 'k1', 0), shell('b', 'J2', 'k1', 4)]
  const result = fakeResult([{ id: 'a', total: 4590 }, { id: 'b', total: 2270 }])
  const brief = equipmentBrief(rooms, result, { units: [{ id: 'k1', name: 'K1' }], diversity: 1 })
  assert.equal(brief.length, 1)
  assert.equal(brief[0].machineName, 'Koneikko 8 kW')
  assert.equal(brief[0].evaporators.length, 2)
  assert.equal(formatEquipmentLine(brief[0]), 'K1: Koneikko 8 kW + Höyrystin 5 kW (J1), Höyrystin 2,5 kW (J2)')
  assert.equal(equipmentRows(brief).filter((row) => row.kind === 'evaporator').length, 2)
})

test('a placed evaporator is quoted instead of a site-wide suggestion', () => {
  const rooms = [shell('a', 'J1', 'k1', 0)]
  rooms[0].equipment = [{ id: 'ev', category: 'evaporator', name: 'Höyrystin 5 kW', capacityKw: 5 }]
  const result = fakeResult([{ id: 'a', total: 9000 }])
  const brief = equipmentBrief(rooms, result, { units: [{ id: 'k1', name: 'K1' }], diversity: 1 })
  assert.equal(brief[0].evaporators[0].name, 'Höyrystin 5 kW')
  assert.equal(brief[0].evaporators[0].capacityKw, 5)
  assert.equal(suggestEvaporators(9000).template.name, 'Höyrystin 10 kW')
})

test('the principle diagram is scaled inside the page margins', () => {
  const fit = fitSchematicBox(297, 210, 1680, 1188)
  assert.ok(fit.scale > 0)
  assert.ok(fit.ox >= fit.margin - 0.01)
  assert.ok(fit.oy >= fit.margin + fit.header - 0.01)
  assert.ok(fit.ox + fit.drawnW <= 297 - fit.margin + 0.01)
  assert.ok(fit.oy + fit.drawnH <= 210 - fit.footer + 0.01)
  const tall = fitSchematicBox(210, 297, 900, 1600)
  assert.ok(tall.oy + tall.drawnH <= 297 - tall.footer + 0.01)
  assert.ok(tall.scale < 1)
})

const VIEW_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('the cold-room PDF lists each unit, keeps Finnish, and uses a 3D view instead of an isometric drawing', async () => {
  const units = [{ id: 'k1', name: 'K1' }, { id: 'k2', name: 'K2' }]
  const rooms = [shell('a', 'J1', 'k1', 0), shell('b', 'J2', 'k2', 4)]
  rooms[0].equipment = [{ id: 'ev-a', category: 'evaporator', name: 'Höyrystin 5 kW', capacityKw: 5, width: 0.9, depth: 0.55, height: 0.4, mount: 'ceiling', elevation: 2.2, x: 0, z: 0 }]
  rooms[1].equipment = [{ id: 'ev-b', category: 'evaporator', name: 'Höyrystin 2,5 kW', capacityKw: 2.5, width: 0.8, depth: 0.5, height: 0.35, mount: 'ceiling', elevation: 2.2, x: 0, z: 0 }]
  const result = calculateProject(rooms)
  const brief = equipmentBrief(rooms, result, { units, diversity: 1 })
  const doc = buildPdf({ projectName: 'Kylmävarasto', rooms, schematic: { units, diversity: 1, drawing: 'technical' }, viewImage: VIEW_PNG })
  const pages = await pdfPages(doc)
  const text = pages.join('\n')
  assert.match(text, /Kylmähuoneen suunnitelma/)
  assert.match(text, /Päiväys/)
  assert.match(text, /Sisäpinta-ala/)
  assert.match(text, /Kokonaislämpökuorma/)
  assert.match(text, /Väliseinä → J2/)
  assert.match(text, /lämpökuorma/i)
  for (const line of brief.map((group) => formatEquipmentLine(group))) {
    assert.ok(text.includes(line), line)
  }
  assert.equal(text.includes('Isometria'), false)
  const viewAt = pages.findIndex((page) => page.includes(translate('fi', 'designer.view3d')))
  assert.ok(viewAt >= 0, '3D view page')
  assert.equal(text.includes('koko kohteelle'), false)
  const siteName = suggestEvaporators(result.total).template.name
  const quoted = new Set(brief.flatMap((group) => [group.machineName, ...group.evaporators.map((ev) => ev.name)]))
  if (!quoted.has(siteName)) assert.equal(text.includes(siteName), false)
  assert.match(text, new RegExp(translate('fi', 'cold.quoteTitle').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(text, /Höyrystin 5 kW/)
  assert.match(text, /Höyrystin 2,5 kW/)
  assert.ok(pages.length >= 4)
  const data = new Uint8Array(doc.output('arraybuffer'))
  const parsed = await getDocument({ data, disableWorker: true, isEvalSupported: false }).promise
  const sheet = await parsed.getPage(parsed.numPages)
  const view = sheet.getViewport({ scale: 1 })
  assert.ok(view.width > view.height, 'the principle diagram page is landscape')
  const viewPage = await parsed.getPage(viewAt + 1)
  const viewBox = viewPage.getViewport({ scale: 1 })
  assert.ok(viewBox.width > viewBox.height, 'the 3D view page is landscape')
  const ops = await viewPage.getOperatorList()
  assert.ok(ops.fnArray.includes(OPS.paintImageXObject), 'the 3D view page embeds the captured image')
})
