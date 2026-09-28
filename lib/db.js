// Storage layer with three-tier strategy:
//   1. Vercel KV (production) — persistent Redis-compatible key-value store
//   2. /tmp JSON file (local dev / no KV) — works on Vercel serverless without KV
//   3. In-memory (last resort) — for read-only filesystems
//
// Set these env vars in Vercel Dashboard to enable KV persistence:
//   KV_URL         — Redis URL
//   KV_REST_API_URL — Upstash REST endpoint
//   KV_REST_API_TOKEN — Upstash REST token
// When KV is reachable, /tmp and memory are skipped entirely.

import { kv } from '@vercel/kv'
import fs from 'fs'
import path from 'path'

const USERS_KEY = 'refcad:users'
const PROJECTS_KEY = 'refcad:projects'

// Detect storage strategy
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
  return db.projects.filter((p) => p.userId === userId)
}

export async function findProject(id, userId) {
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
  await writeDb(db)
  return newProject
}

export async function updateProject(id, userId, updates) {
  const db = await readDb()
  const idx = db.projects.findIndex((p) => p.id === id && p.userId === userId)
  if (idx === -1) return null
  db.projects[idx] = {
    ...db.projects[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  await writeDb(db)
  return db.projects[idx]
}

export async function deleteProject(id, userId) {
  const db = await readDb()
  const before = db.projects.length
  db.projects = db.projects.filter((p) => !(p.id === id && p.userId === userId))
  if (db.projects.length < before) {
    await writeDb(db)
    return true
  }
  return false
}
