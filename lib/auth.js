import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { findUserById, findUserByEmail, findUserByLogin, createUser, publicUser } from './db.js'
import { ensureSeeded } from './seed.js'

const COOKIE = 'refcad-session'
const WEEK = 60 * 60 * 24 * 7

function secretKey() {
  const value = process.env.AUTH_SECRET || ''
  if (value.length < 16) return null
  return new TextEncoder().encode(value)
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 10)
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash || hash === plain) return false
  try {
    return await bcrypt.compare(String(plain), String(hash))
  } catch {
    return false
  }
}

export async function createToken(payload) {
  const key = secretKey()
  if (!key || !payload?.userId) return null
  return new SignJWT({ userId: payload.userId, email: payload.email || '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

export async function verifyToken(token) {
  const key = secretKey()
  if (!key || !token || token === 'demo-token') return null
  try {
    const { payload } = await jwtVerify(token, key)
    return payload
  } catch {
    return null
  }
}

async function readCookie() {
  try {
    const { cookies } = await import('next/headers')
    return cookies().get(COOKIE)?.value || ''
  } catch {
    return ''
  }
}

export async function setSessionCookie(token) {
  if (!token) return
  const { cookies } = await import('next/headers')
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WEEK,
  })
}

export async function clearSessionCookie() {
  const { cookies } = await import('next/headers')
  cookies().set(COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function getCurrentUser() {
  await ensureSeeded()
  const payload = await verifyToken(await readCookie())
  if (!payload?.userId) return null
  const user = await findUserById(payload.userId)
  if (!user || user.disabled) return null
  return publicUser(user)
}

export async function authenticateUser(login, password) {
  await ensureSeeded()
  const user = await findUserByLogin(login)
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null
  if (user.disabled) return { error: 'disabled' }
  return publicUser(user)
}

export async function registerUser(email, password, name) {
  await ensureSeeded()
  const normalised = String(email || '').trim()
  if (!normalised || !password) return null
  if (await findUserByEmail(normalised)) return null
  const created = await createUser({
    email: normalised,
    username: '',
    name: name || normalised,
    passwordHash: await hashPassword(password),
    role: 'user',
    plan: 'free',
    payment: 'none',
    disabled: false,
    validFrom: '',
    validUntil: '',
    requestedPlan: '',
    billingCycle: '',
  })
  return publicUser(created)
}
