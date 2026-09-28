// Simple JSON file-based database.
// On Vercel/serverless, the project filesystem is read-only, so we write to /tmp
// (which is the only writable location). /tmp is ephemeral — data is lost between
// cold starts. For persistent storage in production, swap this for Vercel KV,
// Supabase, Postgres, etc. The exported function signatures are stable so only
// this file needs to change.

const fs = require('fs')
const path = require('path')

// Detect serverless environment. Vercel sets VERCEL=1; AWS Lambda sets AWS_LAMBDA_FUNCTION_NAME.
const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY
)

// On serverless, /tmp is writable. Locally, write to ./data so dev experience matches gitignore.
const DATA_DIR = IS_SERVERLESS
  ? '/tmp/data'
  : path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

function ensureDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], projects: [] }, null, 2))
    }
    return true
  } catch (e) {
    // Filesystem not writable — fall back to in-memory store.
    // This is the safe path for read-only filesystems (e.g. Vercel without /tmp access).
    return false
  }
}

// In-memory fallback when filesystem is unavailable.
const memoryDb = { users: [], projects: [] }
let useMemory = false

function readDb() {
  if (!ensureDb() || useMemory) return memoryDb
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch (e) {
    useMemory = true
    return memoryDb
  }
}

function writeDb(data) {
  if (!ensureDb()) {
    useMemory = true
    Object.assign(memoryDb, data)
    return
  }
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
  } catch (e) {
    // Read-only filesystem — switch to in-memory.
    useMemory = true
    Object.assign(memoryDb, data)
  }
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
