import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPanelCommand, panelCommand, readPanels, writePanels } from './panels.js'
import { holdSheetView } from './zoom.js'
import { materialsCsv } from './materialsReport.js'

test('panel shortcuts collapse one side or both', () => {
  assert.equal(panelCommand({ key: '[' }), null)
  assert.equal(panelCommand({ key: '[', ctrlKey: true }), 'left')
  assert.equal(panelCommand({ key: ']', metaKey: true }), 'right')
  assert.equal(panelCommand({ key: 'F11' }), 'full')
  assert.equal(panelCommand({ key: 'f', ctrlKey: true, shiftKey: true }), 'full')
  assert.equal(panelCommand({ key: '[', ctrlKey: true, target: { tagName: 'INPUT' } }), null)
  const left = applyPanelCommand({ left: false, right: false }, 'left')
  assert.deepEqual({ left: left.left, right: left.right }, { left: true, right: false })
  const full = applyPanelCommand({ left: false, right: true, legend: true }, 'full')
  assert.equal(full.left, true)
  assert.equal(full.right, true)
  assert.equal(full.legend, true)
  const open = applyPanelCommand(full, 'full')
  assert.equal(open.left, false)
  assert.equal(open.right, false)
})

test('panel layout is stored per user', () => {
  const store = new Map()
  const storage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  }
  writePanels('enn', { left: true, right: false, legend: true }, storage)
  writePanels('other', { left: false, right: true }, storage)
  assert.deepEqual(readPanels('enn', storage), { left: true, right: false, legend: true })
  assert.equal(readPanels('other', storage).right, true)
  assert.equal(readPanels('enn', storage).left, true)
})

test('a resize keeps the sheet scale and the view centre', () => {
  const camera = { zoom: 2, x: 10, y: 20 }
  const prev = { w: 800, h: 600, sheetX: 40, sheetY: 30, k: 2 }
  const next = { w: 1000, h: 600, sheetX: 50, sheetY: 30, k: 2.5 }
  const held = holdSheetView(camera, prev, next)
  assert.equal(held.zoom * next.k, camera.zoom * prev.k)
  const paperX = ((prev.w / 2 - camera.x) / camera.zoom - prev.sheetX) / prev.k
  const back = ((next.w / 2 - held.x) / held.zoom - next.sheetX) / next.k
  assert.ok(Math.abs(back - paperX) < 1e-6)
})

test('the material report is a csv table', () => {
  const csv = materialsCsv([{ group: 'floor', name: 'Parketti, olo', room: 'Olohuone', quantity: '12,5', unit: 'm²', code: 'VS-1' }])
  assert.match(csv, /^group,name,room,quantity,unit,code/)
  assert.match(csv, /"Parketti, olo",Olohuone,"12,5",m²,VS-1/)
})
