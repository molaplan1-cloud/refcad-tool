// Authentication DISABLED for demo mode.
// All users share a single demo account. Replace this with real auth when
// persistence is properly set up.

const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@refcad.local',
  name: 'Demo-käyttäjä',
  password: 'demo',
}

export async function hashPassword(password) {
  return password
}

export async function verifyPassword(plain, hash) {
  return plain === hash
}

export async function createToken(payload) {
  return 'demo-token'
}

export async function verifyToken(token) {
  return { userId: DEMO_USER.id, email: DEMO_USER.email }
}

export async function setSessionCookie(token) {
  // no-op in demo mode
}

export function clearSessionCookie() {
  // no-op in demo mode
}

export async function getCurrentUser() {
  return {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
  }
}

export async function authenticateUser(email, password) {
  if (email === DEMO_USER.email && password === DEMO_USER.password) {
    return DEMO_USER
  }
  return null
}

export async function registerUser(email, password, name) {
  // Demo mode: no-op, just return the demo user
  return {
    ...DEMO_USER,
    email,
    name: name || email,
  }
}
