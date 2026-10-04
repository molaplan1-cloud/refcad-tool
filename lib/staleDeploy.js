// A deploy replaces hashed chunks while an open tab still asks for the old ones.
// Reload the document once per tab. The sessionStorage flag blocks a loop when
// the new document fails the same way. It lasts for the tab, so a later failure
// shows the refresh message instead of reloading again.

export const CHUNK_RELOAD_KEY = 'refcad-chunk-reload'
export const STALE_DEPLOY_MESSAGE = 'Uusi versio julkaistu – päivitä sivu'
export const STALE_DEPLOY_ACTION = 'Päivitä'

const flushers = new Set()
let reloadArmed = false

export function registerDrawingFlush(flush) {
  if (typeof flush !== 'function') return () => {}
  flushers.add(flush)
  return () => { flushers.delete(flush) }
}

export function flushDrawings() {
  flushers.forEach((flush) => {
    try { flush() } catch { /* one writer must not block the others or the reload */ }
  })
}

function textOf(error) {
  const parts = []
  const visit = (value, depth) => {
    if (value == null || depth > 3) return
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value))
      return
    }
    if (typeof value !== 'object') return
    parts.push(value.name, value.message, value.code)
    visit(value.reason, depth + 1)
    visit(value.error, depth + 1)
    visit(value.cause, depth + 1)
  }
  visit(error, 0)
  return parts.filter(Boolean).join(' ')
}

export function isStaleChunkError(error) {
  const text = textOf(error)
  return text.includes('ChunkLoadError')
    || /Loading chunk/i.test(text)
    || /Failed to fetch dynamically imported module/i.test(text)
    || /error loading dynamically imported module/i.test(text)
    || /Importing a module script failed/i.test(text)
}

function sessionOf(storage) {
  if (storage) return storage
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch { /* private mode */ }
  return null
}

function guardSet(storage) {
  try { return storage?.getItem(CHUNK_RELOAD_KEY) === '1' } catch { return false }
}

function armGuard(storage) {
  try { storage?.setItem(CHUNK_RELOAD_KEY, '1') } catch { /* still reload once */ }
}

function hardReload(reload) {
  if (typeof reload === 'function') {
    reload()
    return
  }
  if (typeof window !== 'undefined' && window.location?.reload) window.location.reload()
}

// 'reloading' means this document started its one reload.
// 'prompt' means this tab already reloaded and the user must press Päivitä.
export function recoverStaleDeploy(options = {}) {
  flushDrawings()
  if (reloadArmed) return 'reloading'
  const storage = sessionOf(options.storage)
  if (guardSet(storage)) return 'prompt'
  reloadArmed = true
  armGuard(storage)
  try {
    hardReload(options.reload)
  } catch {
    return 'prompt'
  }
  return 'reloading'
}

export function refreshAfterStaleDeploy(options = {}) {
  flushDrawings()
  hardReload(options.reload)
}

export function resetStaleDeployForTests() {
  reloadArmed = false
  flushers.clear()
}
