import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { jsPDF } from 'jspdf'
import { DEMO_WATERMARK } from './access.js'
import { stampDemoWatermark } from './watermark.js'

test('the drawing canvas does not paint the demo watermark', () => {
  const canvas = readFileSync(new URL('../components/floorplan/FloorPlanApp.jsx', import.meta.url), 'utf8')
  assert.equal(canvas.includes('sheet-watermark'), false)
  assert.equal(canvas.includes('DEMO_WATERMARK'), false)
  assert.equal(canvas.includes('stampDemoWatermark'), true)
})

test('a free print carries the diagonal demo watermark', () => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  doc.text('Pohjakuva', 20, 20)
  stampDemoWatermark(doc)
  const raw = doc.output()
  assert.equal(raw.includes('DEMO'), true)
  assert.equal(raw.includes('ILMAINEN'), true)
  assert.equal(raw.split('ILMAINEN').length - 1, 1)
  assert.equal(DEMO_WATERMARK, 'RefCAD – DEMO / ILMAINEN VERSIO')
  const source = readFileSync(new URL('./watermark.js', import.meta.url), 'utf8')
  assert.equal(source.includes('DEMO_WATERMARK'), true)
})
