import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.AUTH_SECRET = 'unit-test-auth-secret-value'
process.env.REFCAD_DB_FILE = join(mkdtempSync(join(tmpdir(), 'refcad-auth-')), 'db.json')
delete process.env.ADMIN_EMAIL
delete process.env.ADMIN_PASSWORD
delete process.env.DEMO_USERNAME
delete process.env.DEMO_PASSWORD

const { hashPassword, verifyPassword, createToken, verifyToken, registerUser, authenticateUser } = await import('./auth.js')

test('the auth source does not keep a demo password', () => {
  const auth = readFileSync(new URL('./auth.js', import.meta.url), 'utf8')
  const seed = readFileSync(new URL('./seed.js', import.meta.url), 'utf8')
  assert.equal(auth.includes("password: 'demo'"), false)
  assert.equal(auth.includes('demo-token'), true)
  assert.equal(seed.includes('ADMIN_PASSWORD'), true)
  assert.equal(seed.includes("password: '"), false)
  assert.equal(seed.includes('ADMIN_PASSWORD ||'), true)
})

test('a password is stored as a bcrypt hash and a session token round-trips', async () => {
  const hash = await hashPassword('correct horse battery')
  assert.notEqual(hash, 'correct horse battery')
  assert.match(hash, /^\$2[aby]\$/)
  assert.equal(await verifyPassword('correct horse battery', hash), true)
  assert.equal(await verifyPassword('wrong', hash), false)
  assert.equal(await verifyPassword('correct horse battery', 'correct horse battery'), false)
  const token = await createToken({ userId: 'user-1', email: 'a@b.c' })
  const payload = await verifyToken(token)
  assert.equal(payload.userId, 'user-1')
  assert.equal(await verifyToken('demo-token'), null)
})

test('registration keeps the hash off the returned user', async () => {
  const user = await registerUser('builder@example.com', 'sala-sana', 'Rakentaja')
  assert.equal(user.email, 'builder@example.com')
  assert.equal(user.passwordHash, undefined)
  assert.equal(user.password, undefined)
  assert.equal(user.plan, 'free')
  const again = await registerUser('builder@example.com', 'sala-sana', 'Rakentaja')
  assert.equal(again, null)
  const session = await authenticateUser('builder@example.com', 'sala-sana')
  assert.equal(session.id, user.id)
  assert.equal(session.passwordHash, undefined)
  assert.equal(await authenticateUser('builder@example.com', 'vaara'), null)
})

test('sessions are refused when AUTH_SECRET is missing', async () => {
  const previous = process.env.AUTH_SECRET
  delete process.env.AUTH_SECRET
  assert.equal(await createToken({ userId: 'user-1' }), null)
  process.env.AUTH_SECRET = previous
})
