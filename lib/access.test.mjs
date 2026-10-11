import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_WATERMARK, accessFor, canStartType, coldRoomEntry, paymentActive, projectTypeById } from './access.js'

const now = new Date('2026-06-15T12:00:00Z')

test('the demo watermark is the required sheet text', () => {
  assert.equal(DEMO_WATERMARK, 'RefCAD – DEMO / ILMAINEN VERSIO')
})

test('an anonymous visitor draws only the floor plan and prints a watermark', () => {
  const access = accessFor(null, 'omakotitalo', now)
  assert.deepEqual(access.workspaces, ['rakenne'])
  assert.equal(access.watermark, true)
  assert.equal(access.draw, true)
  assert.equal(canStartType(access, projectTypeById('kylmio')), true)
  assert.equal(canStartType(access, projectTypeById('halli')), false)
  assert.equal(canStartType(access, projectTypeById('omakotitalo')), true)
})

test('a pending payment stays on the free floor plan', () => {
  const access = accessFor({ role: 'user', plan: 'pro', payment: 'pending' }, 'toimisto', now)
  assert.equal(access.pending, true)
  assert.equal(access.watermark, true)
  assert.ok(access.workspaces.includes('rakenne'))
  assert.ok(access.workspaces.includes('kylma'))
  assert.equal(access.workspaces.includes('sahko'), false)
  assert.equal(paymentActive({ payment: 'pending' }, now), false)
})

test('a confirmed basic plan opens house services and a clean print', () => {
  const access = accessFor({ role: 'user', plan: 'basic', payment: 'received' }, 'omakotitalo', now)
  assert.equal(access.watermark, false)
  assert.equal(access.pending, false)
  assert.ok(access.workspaces.includes('sahko'))
  assert.ok(access.workspaces.includes('lvi'))
  assert.ok(access.workspaces.includes('iv'))
  assert.equal(access.workspaces.includes('kylma'), false)
  assert.equal(access.workspaces.includes('piha'), false)
})

test('a confirmed pro plan includes cold rooms, the hall and the yard', () => {
  const user = { role: 'user', plan: 'pro', payment: 'received', validFrom: '2026-01-01', validUntil: '2026-12-31' }
  assert.equal(paymentActive(user, now), true)
  const cold = accessFor(user, 'kylmio', now)
  assert.equal(canStartType(cold, projectTypeById('kylmio')), true)
  assert.ok(cold.workspaces.includes('kylma'))
  const hall = accessFor(user, 'halli', now)
  assert.equal(canStartType(hall, projectTypeById('halli')), true)
  assert.equal(hall.watermark, false)
  const yard = accessFor(user, 'omakotitalo', now)
  assert.ok(yard.workspaces.includes('piha'))
})

test('an expired confirmation falls back to the free floor plan', () => {
  const access = accessFor({ role: 'user', plan: 'pro', payment: 'received', validUntil: '2026-01-01' }, 'omakotitalo', now)
  assert.equal(access.watermark, true)
  assert.deepEqual(access.workspaces, ['rakenne'])
})

test('opening refrigeration keeps a lesser plan signed in and lets demo through', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const basic = coldRoomEntry({ role: 'user', plan: 'basic', payment: 'received', email: 'perus@example.com' }, )
  assert.equal(basic.allowed, true)
  assert.equal(basic.planId, 'basic')
  assert.equal(basic.access.watermark, false)
  const demo = coldRoomEntry({ role: 'demo', plan: 'free', payment: 'none', email: 'demo@demo.refcad.local' })
  assert.equal(demo.allowed, true)
  assert.equal(demo.access.watermark, true)
  assert.equal(demo.planId, 'free')
  const anon = coldRoomEntry(null)
  assert.equal(anon.allowed, true)
  assert.equal(anon.access.watermark, true)
  assert.equal(anon.planId, 'free')
  assert.equal(accessFor({ role: 'demo' }, 'kylmio', now).workspaces.includes('kylma'), true)
})

test('the demo account has every feature and a watermark', () => {
  const hall = accessFor({ role: 'demo', plan: 'free', payment: 'none' }, 'halli', now)
  const cold = accessFor({ role: 'demo' }, 'kylmio', now)
  assert.equal(hall.watermark, true)
  assert.equal(cold.watermark, true)
  assert.equal(canStartType(hall, projectTypeById('halli')), true)
  assert.equal(canStartType(cold, projectTypeById('kylmio')), true)
  assert.ok(cold.workspaces.includes('kylma'))
  assert.ok(hall.workspaces.includes('rakenne'))
})

test('an admin account does not draw', () => {
  const access = accessFor({ role: 'admin', payment: 'received', plan: 'company' }, 'omakotitalo', now)
  assert.equal(access.admin, true)
  assert.equal(access.draw, false)
  assert.deepEqual(access.workspaces, [])
})

test('a disabled account cannot draw', () => {
  const access = accessFor({ role: 'user', disabled: true, plan: 'pro', payment: 'received' }, null, now)
  assert.equal(access.draw, false)
})
