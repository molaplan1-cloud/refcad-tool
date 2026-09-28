// Simple in-memory database for Cloudflare Pages Edge Runtime.
//
// The original implementation used `fs` to read/write data/db.json, but Cloudflare
// Pages + Edge runtime has no persistent filesystem. This implementation keeps the
// DB in module-level state so the API surface stays identical.
//
// IMPORTANT: data is per-isolate and resets when the Worker is redeployed or
// scaled. For production persistence, replace this module with Cloudflare KV
// (or D1 / R2). The exported function signatures are designed so only this
// file needs to change.

const memoryDb = { users: [], projects: [] }

function readDb() {
  return memoryDb
}

function writeDb(data) {
  Object.assign(memoryDb, data)
}

// Users
export function findUserByEmail(email) {
  const db = readDb()
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id) {
  const db = readDb()
  return db.users.find((u) => u.id === id)
}

export function createUser(user) {
  const db = readDb()
  const newUser = { ...user, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  db.users.push(newUser)
  writeDb(db)
  return newUser
}

// Projects
export function listProjects(userId) {
  const db = readDb()
  return db.projects.filter((p) => p.userId === userId)
}

export function findProject(id, userId) {
  const db = readDb()
  return db.projects.find((p) => p.id === id && p.userId === userId)
}

export function createProject(project) {
  const db = readDb()
  const newProject = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.projects.push(newProject)
  writeDb(db)
  return newProject
}

export function updateProject(id, userId, updates) {
  const db = readDb()
  const idx = db.projects.findIndex((p) => p.id === id && p.userId === userId)
  if (idx === -1) return null
  db.projects[idx] = {
    ...db.projects[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  writeDb(db)
  return db.projects[idx]
}

export function deleteProject(id, userId) {
  const db = readDb()
  const before = db.projects.length
  db.projects = db.projects.filter((p) => !(p.id === id && p.userId === userId))
  if (db.projects.length < before) {
    writeDb(db)
    return true
  }
  return false
}
