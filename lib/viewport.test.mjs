import test from 'node:test'
import assert from 'node:assert/strict'
import { isCompactViewport, viewportKind } from './viewport.js'
import { touchAction } from './touch.js'
import { pinchScale, pinchZoom } from './zoom.js'

test('phone and tablet widths are compact and a desktop stays wide', () => {
  assert.equal(viewportKind(375), 'phone')
  assert.equal(viewportKind(390), 'phone')
  assert.equal(viewportKind(667), 'phone')
  assert.equal(viewportKind(768), 'tablet')
  assert.equal(viewportKind(1024), 'tablet')
  assert.equal(viewportKind(1280), 'desktop')
  assert.equal(isCompactViewport(390), true)
  assert.equal(isCompactViewport(1024), true)
  assert.equal(isCompactViewport(1280), false)
})

test('touch pans, taps, and pinches without turning a wall tap into a pan', () => {
  assert.equal(touchAction({ pointerType: 'mouse' }), 'mouse')
  assert.equal(touchAction({ pointerType: 'touch', pointers: 2, drawing: true }), 'pinch')
  assert.equal(touchAction({ pointerType: 'touch', hand: true, drawing: true }), 'pan')
  assert.equal(touchAction({ pointerType: 'touch', drawing: true, longPress: true }), 'pan')
  assert.equal(touchAction({ pointerType: 'touch', drawing: true, moved: false }), 'tap')
  assert.equal(touchAction({ pointerType: 'touch', drawing: true, moved: true }), 'ignore')
  assert.equal(touchAction({ pointerType: 'touch', drawing: false, moved: true }), 'pan')
  assert.equal(touchAction({ pointerType: 'touch', drawing: false, moved: false }), 'tap')
})

test('a pinch zooms around the finger midpoint and follows the gesture', () => {
  const zoomed = pinchZoom(
    { zoom: 1, x: 0, y: 0 },
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } },
  )
  assert.equal(zoomed.zoom, 2)
  assert.equal(zoomed.x, 0)
  assert.equal(zoomed.y, 0)
  const scaled = pinchScale(
    { scale: 10, offsetX: 0, offsetY: 0 },
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 } },
    { a: { x: 0, y: 0 }, b: { x: 80, y: 0 } },
  )
  assert.equal(scaled.scale, 20)
  assert.equal(scaled.offsetX, 0)
  assert.equal(scaled.offsetY, 0)
})
