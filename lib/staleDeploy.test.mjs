import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CHUNK_RELOAD_KEY,
  STALE_DEPLOY_ACTION,
  STALE_DEPLOY_MESSAGE,
  flushDrawings,
  isStaleChunkError,
  recoverStaleDeploy,
  refreshAfterStaleDeploy,
  registerDrawingFlush,
  resetStaleDeployForTests,
} from './staleDeploy.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
  }
}

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('chunk load failures are recognised and ordinary errors are not', () => {
  assert.equal(isStaleChunkError({ name: 'ChunkLoadError', message: 'Loading chunk 545 failed.' }), true)
  assert.equal(isStaleChunkError(new Error('Loading chunk 545 failed.\n(error: https://refcad-tool.vercel.app/_next/static/chunks/545.js)')), true)
  assert.equal(isStaleChunkError('Failed to fetch dynamically imported module: https://refcad-tool.vercel.app/_next/static/chunks/app/page.js'), true)
  assert.equal(isStaleChunkError({ reason: { message: 'error loading dynamically imported module' } }), true)
  assert.equal(isStaleChunkError({ message: 'Importing a module script failed.' }), true)
  assert.equal(isStaleChunkError(new Error('Tapahtui odottamaton virhe')), false)
  assert.equal(isStaleChunkError(null), false)
  assert.equal(STALE_DEPLOY_MESSAGE, 'Uusi versio julkaistu – päivitä sivu')
  assert.equal(STALE_DEPLOY_ACTION, 'Päivitä')
})

test('a stale chunk flushes the drawing and reloads once per tab', () => {
  resetStaleDeployForTests()
  const storage = memoryStorage()
  const order = []
  registerDrawingFlush(() => { order.push('flush') })
  registerDrawingFlush(() => { throw new Error('writer failed') })
  const reload = () => { order.push('reload') }

  assert.equal(recoverStaleDeploy({ storage, reload }), 'reloading')
  assert.deepEqual(order, ['flush', 'reload'])
  assert.equal(storage.getItem(CHUNK_RELOAD_KEY), '1')

  assert.equal(recoverStaleDeploy({ storage, reload }), 'reloading')
  assert.deepEqual(order, ['flush', 'reload', 'flush'])

  resetStaleDeployForTests()
  registerDrawingFlush(() => { order.push('flush') })
  assert.equal(recoverStaleDeploy({ storage, reload }), 'prompt')
  assert.deepEqual(order, ['flush', 'reload', 'flush', 'flush'])

  refreshAfterStaleDeploy({ reload })
  assert.deepEqual(order, ['flush', 'reload', 'flush', 'flush', 'flush', 'reload'])
})

test('flush still saves when an earlier writer throws', () => {
  resetStaleDeployForTests()
  const saved = []
  registerDrawingFlush(() => { throw new Error('first') })
  registerDrawingFlush(() => { saved.push('plan') })
  flushDrawings()
  assert.deepEqual(saved, ['plan'])
})

test('the error pages, the window handlers and both editors share the recovery', () => {
  const errorPage = source('../app/error.jsx')
  const globalError = source('../app/global-error.jsx')
  const recovery = source('../components/ChunkRecovery.jsx')
  const layout = source('../app/layout.jsx')
  for (const file of [errorPage, globalError]) {
    assert.equal(file.includes('isStaleChunkError'), true)
    assert.equal(file.includes('recoverStaleDeploy'), true)
    assert.equal(file.includes('StaleDeployNotice'), true)
    assert.equal(file.includes(STALE_DEPLOY_MESSAGE) || file.includes('StaleDeployNotice'), true)
  }
  assert.equal(recovery.includes("addEventListener('error'"), true)
  assert.equal(recovery.includes("addEventListener('unhandledrejection'"), true)
  assert.equal(recovery.includes('recoverStaleDeploy'), true)
  assert.equal(layout.includes('ChunkRecovery'), true)
  assert.equal(source('../components/floorplan/FloorPlanApp.jsx').includes('registerDrawingFlush'), true)
  assert.equal(source('../components/designer/DesignerApp.jsx').includes('registerDrawingFlush'), true)
  const notice = source('../components/StaleDeployNotice.jsx')
  assert.equal(notice.includes('STALE_DEPLOY_MESSAGE'), true)
  assert.equal(notice.includes('STALE_DEPLOY_ACTION'), true)
  assert.equal(notice.includes('refreshAfterStaleDeploy'), true)
})
