import assert from 'node:assert/strict'
import test from 'node:test'
import { jsPDF } from 'jspdf'
import {
  CABLE_LABEL_MM,
  DEVICE_TAG_MM,
  SYMBOL_STROKE_MM,
  drawSchematicSymbol,
  groupCableCallouts,
  symbolFigures,
  symbolSizeMm,
} from './electricSymbols.js'

const KINDS = ['socket', 'switch', 'light', 'junction', 'panel', 'heater-control', 'stove', 'data', 'antenna', 'washer']

test('electrical plan symbols are 3–5 mm on paper with a thin stroke', () => {
  KINDS.forEach((kind) => {
    const box = symbolSizeMm(kind)
    const span = Math.max(box.w, box.h)
    assert.ok(span >= 3 && span <= 5, `${kind} spans ${span} mm`)
    assert.ok(Math.min(box.w, box.h) >= 2.8, `${kind} is flatter than a plan symbol`)
  })
  assert.ok(SYMBOL_STROKE_MM <= 0.25)
  assert.ok(CABLE_LABEL_MM <= 2.2)
  assert.ok(DEVICE_TAG_MM <= 2)
  const socket = symbolFigures('socket').find((fig) => fig.op === 'circle')
  assert.equal(socket.r * 2, 4)
  const panel = symbolSizeMm('panel')
  assert.equal(panel.w, 5)
  assert.equal(panel.h, 3.4)
})

test('identical cable marks collapse nearby and stay once per distant group', () => {
  const grouped = groupCableCallouts([
    { text: 'MMJ 3x1,5 / R4', ax: 0, ay: 0, bx: 20, by: 0, len: 20, key: 'a' },
    { text: 'MMJ 3x1,5 / R4', ax: 10, ay: 8, bx: 18, by: 8, len: 8, key: 'b' },
    { text: 'MMJ 3x1,5 / R4', ax: 200, ay: 0, bx: 260, by: 0, len: 60, key: 'c' },
    { text: 'MMJ 3x2,5 / R1', ax: 0, ay: 4, bx: 12, by: 4, len: 12, key: 'd' },
  ], 32)
  assert.equal(grouped.length, 3)
  const r4 = grouped.filter((item) => item.text === 'MMJ 3x1,5 / R4')
  assert.equal(r4.length, 2)
  assert.ok(r4.some((item) => item.key === 'c'))
  assert.ok(r4.some((item) => item.key === 'a'))
})

test('the PDF draws a schematic SK, not the cabinet outline', () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape' })
  drawSchematicSymbol(doc, { kind: 'panel', system: 'electric', rotation: 90 }, 40, 50)
  drawSchematicSymbol(doc, { kind: 'socket', system: 'electric', rotation: 0 }, 60, 50)
  const raw = doc.output()
  assert.ok(raw.includes('SK'))
})
