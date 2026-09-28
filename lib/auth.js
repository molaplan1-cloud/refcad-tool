import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { findUserByEmail, findUserById, createUser } from './db'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'refcad-tool-secret-key-change-in-production-min-32-chars'
)
const COOKIE_NAME = 'refcad-session'
const COOKIE_DAYS = 7

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_DAYS}d`)
    .sign(SECRET)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch (e) {
    return null
  }
}

export async function setSessionCookie(token) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * COOKIE_DAYS,
    path: '/'
  })
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export async function getCurrentUser() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload?.userId) return null
  const user = findUserById(payload.userId)
  if (!user) return null
  // Don't return password hash
  const { password, ...safe } = user
  return safe
}

export async function authenticateUser(email, password) {
  const user = findUserByEmail(email)
  if (!user) return null
  const ok = await verifyPassword(password, user.password)
  if (!ok) return null
  return user
}

export async function registerUser(email, password, name) {
  if (findUserByEmail(email)) return null
  const hash = await hashPassword(password)
  const user = createUser({
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    password: hash
  })
  return user
}
