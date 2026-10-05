import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the editor type is a label and each setting has one home', () => {
  const chrome = source('../components/floorplan/PlanChrome.jsx')
  const plan = source('../components/floorplan/FloorPlanApp.jsx')
  const services = source('../components/floorplan/ServicesLayer.jsx')
  const cold = source('../components/designer/DesignerApp.jsx')
  const coldChrome = source('../components/designer/ColdChrome.jsx')
  const menus = source('../components/floorplan/FloorMenus.jsx')

  assert.equal(chrome.includes('<select data-testid="project-type"'), false)
  assert.equal(cold.includes('<select data-testid="project-type"'), false)
  assert.equal(chrome.includes('data-testid="project-type"'), true)
  assert.equal(coldChrome.includes('data-testid="project-type"'), true)
  assert.equal(chrome.includes('data-testid="project-info"'), true)
  assert.equal(coldChrome.includes('data-testid="project-info"'), true)
  assert.equal(chrome.includes('room-partitions'), false)
  assert.equal(chrome.includes('floor-heating'), false)
  assert.equal(chrome.includes('north-angle'), false)
  assert.equal(chrome.includes('toolbar-preset-'), false)
  assert.equal(services.includes('floor-heating'), false)
  assert.equal(plan.includes('data-testid="room-partitions"'), true)
  assert.equal(plan.includes('data-testid="tool-properties"'), true)
  assert.equal(plan.includes('wall-ref-outer'), true)
  assert.equal(menus.includes('data-testid="paper-a3"'), true)
  assert.equal(menus.includes('data-testid="house-north"'), true)
  assert.equal(coldChrome.includes('data-testid="workspace-tabs"'), true)
  assert.equal(coldChrome.includes('data-testid="menu-bar"'), true)
  assert.equal(coldChrome.includes('data-testid="tool-ribbon"'), true)
  assert.equal(coldChrome.includes('data-testid="auto-pipe"'), true)
  assert.equal(cold.includes('data-testid="status-tool"'), true)
  assert.equal(cold.includes('data-testid="pipe-settings"'), true)
  assert.equal(cold.includes('data-testid="unit-si"'), true)
  assert.equal(chrome.includes('data-ortho="true"'), true)
})
