import test from 'node:test'
import assert from 'node:assert/strict'
import { annotationFont, placeLineLabels, textBox } from './annotations.js'

test('annotation text stays at paper size and stops growing on screen', () => {
  const paper = annotationFont(2, 1, 2.3, 14)
  assert.equal(paper, 4.6)
  const zoomed = annotationFont(2, 6, 2.3, 14)
  assert.ok(Math.abs(zoomed * 6 - 14) < 0.001)
  assert.ok(zoomed < paper)
})

test('a trunk label slides off a room name and is not repeated on the same segment', () => {
  const font = 10
  const room = textBox(100, 50, 'Olohuone', 16)
  room.kind = 'room'
  const labels = placeLineLabels([
    { key: 'a', text: 'Ø160  60 l/s', color: '#dc2626', ax: 20, ay: 50, bx: 180, by: 50 },
    { key: 'a-repeat', text: 'Ø160  60 l/s', color: '#dc2626', ax: 20, ay: 50, bx: 180, by: 50 },
  ], [room], { font, bounds: { x: 0, y: 0, w: 240, h: 120 } })
  assert.equal(labels.length, 2)
  labels.forEach((label) => {
    const hit = label.box.x < room.x + room.w && label.box.x + label.box.w > room.x
      && label.box.y < room.y + room.h && label.box.y + label.box.h > room.y
    assert.equal(hit, false)
  })
  const overlap = labels[0].box.x < labels[1].box.x + labels[1].box.w
    && labels[0].box.x + labels[0].box.w > labels[1].box.x
    && labels[0].box.y < labels[1].box.y + labels[1].box.h
    && labels[0].box.y + labels[0].box.h > labels[1].box.y
  assert.equal(overlap, false)
})

test('parallel ducts keep their own labels clear of a dimension', () => {
  const font = 8
  const dim = { x: 70, y: 8, w: 36, h: 12, kind: 'dim' }
  const labels = placeLineLabels([
    { key: 'tulo', text: 'Ø160  60 l/s', color: '#dc2626', ax: 10, ay: 20, bx: 160, by: 20 },
    { key: 'poisto', text: 'Ø160  60 l/s', color: '#ca8a04', ax: 10, ay: 36, bx: 160, by: 36 },
  ], [dim], { font, bounds: { x: 0, y: 0, w: 200, h: 80 } })
  assert.equal(labels.length, 2)
  assert.notEqual(labels[0].key, labels[1].key)
  labels.forEach((label) => {
    const hit = label.box.x < dim.x + dim.w && label.box.x + label.box.w > dim.x
      && label.box.y < dim.y + dim.h && label.box.y + label.box.h > dim.y
    assert.equal(hit, false)
  })
})
