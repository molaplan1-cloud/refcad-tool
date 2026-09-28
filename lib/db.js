// Storage layer with three-tier strategy:
//   1. Vercel KV (production, persistent) — when KV_REST_API_URL env var set
//   2. /tmp JSON file (serverless, ephemeral across cold starts)
//   3. In-memory (last resort) — survives within a single function instance
//
// Plus an ephemeral-projects cache that returns the same in-memory project on
// subsequent GETs within the same function instance. This means even if DB
// writes completely fail, the UI can create + load a project during a single
// session without errors.

import { kv } from '@vercel/kv'
import fs from 'fs'
import path from 'path'

const USERS_KEY = 'refcad:users'
const PROJECTS_KEY = 'refcad:projects'

function hasKv() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY
)

const DATA_DIR = IS_SERVERLESS ? '/tmp/data' : path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

let useMemory = false
const memoryDb = { users: [], projects: [] }

// Ephemeral projects: created during a single function instance, never persisted.
// Survives GETs within the same function instance.
const ephemeralProjects = new Map()

async function ensureDb() {
  if (hasKv()) return true
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], projects: [] }, null, 2))
    }
    return true
  } catch {
    useMemory = true
    return false
  }
}

async function readDb() {
  if (hasKv()) {
    const users = (await kv.get(USERS_KEY)) || []
    const projects = (await kv.get(PROJECTS_KEY)) || []
    return { users, projects }
  }
  if (!(await ensureDb()) || useMemory) return memoryDb
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch {
    useMemory = true
    return memoryDb
  }
}

async function writeDb(data) {
  if (hasKv()) {
    await Promise.all([kv.set(USERS_KEY, data.users), kv.set(PROJECTS_KEY, data.projects)])
    return
  }
  if (!(await ensureDb())) {
    useMemory = true
    Object.assign(memoryDb, data)
    return
  }
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
  } catch {
    useMemory = true
    Object.assign(memoryDb, data)
  }
}

// Users
export async function findUserByEmail(email) {
  const db = await readDb()
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export async function findUserById(id) {
  const db = await readDb()
  return db.users.find((u) => u.id === id)
}

export async function createUser(user) {
  const db = await readDb()
  const newUser = { ...user, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  db.users.push(newUser)
  await writeDb(db)
  return newUser
}

// Projects
export async function listProjects(userId) {
  const db = await readDb()
  const persisted = db.projects.filter((p) => p.userId === userId)
  const eph = [...ephemeralProjects.values()].filter((p) => p.userId === userId)
  return [...persisted, ...eph]
}

export async function findProject(id, userId) {
  // Ephemeral first
  const eph = ephemeralProjects.get(id)
  if (eph && eph.userId === userId) return eph
  const db = await readDb()
  return db.projects.find((p) => p.id === id && p.userId === userId)
}

export async function createProject(project) {
  const db = await readDb()
  const newProject = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.projects.push(newProject)
  try {
    await writeDb(db)
  } catch (e) {
    console.error('createProject: writeDb failed, storing ephemerally:', e)
  }
  // Always also cache in memory for the lifetime of this function instance
  ephemeralProjects.set(newProject.id, newProject)
  return newProject
}

export async function updateProject(id, userId, updates) {
  // Ephemeral first
  const eph = ephemeralProjects.get(id)
  if (eph && eph.userId === userId) {
    const updated = { ...eph, ...updates, updatedAt: new Date().toISOString() }
    ephemeralProjects.set(id, updated)
    return updated
  }
  const db = await readDb()
  const idx = db.projects.findIndex((p) => p.id === id && p.userId === userId)
  if (idx === -1) return null
  db.projects[idx] = {
    ...db.projects[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  try {
    await writeDb(db)
  } catch (e) {
    console.error('updateProject: writeDb failed:', e)
  }
  return db.projects[idx]
}

export async function deleteProject(id, userId) {
  ephemeralProjects.delete(id)
  const db = await readDb()
  const before = db.projects.length
  db.projects = db.projects.filter((p) => !(p.id === id && p.userId === userId))
  if (db.projects.length < before) {
    try {
      await writeDb(db)
    } catch (e) {
      console.error('deleteProject: writeDb failed:', e)
    }
    return true
  }
  return false
}
