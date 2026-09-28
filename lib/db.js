// Simple JSON file-based database.
// For production scale this would be Supabase/PostgreSQL.
// Vercel runs on Node.js so fs-based persistence works fine.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], projects: [] }, null, 2))
  }
}

function readDb() {
  ensureDb()
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch (e) {
    return { users: [], projects: [] }
  }
}

function writeDb(data) {
  ensureDb()
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
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
