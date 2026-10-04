import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { jsPDF } from 'jspdf'
import { DEMO_WATERMARK } from './access.js'
import { stampDemoWatermark } from './watermark.js'

test('a free print carries the diagonal demo watermark', () => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  doc.text('Pohjakuva', 20, 20)
  stampDemoWatermark(doc)
  const raw = doc.output()
  assert.equal(raw.includes('DEMO'), true)
  assert.equal(raw.includes('ILMAINEN'), true)
  assert.equal(DEMO_WATERMARK, 'RefCAD – DEMO / ILMAINEN VERSIO')
  const source = readFileSync(new URL('./watermark.js', import.meta.url), 'utf8')
  assert.equal(source.includes('DEMO_WATERMARK'), true)
})
