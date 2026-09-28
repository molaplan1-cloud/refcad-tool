import { getCurrentUser } from '@/lib/auth'
import { findProject, updateProject, deleteProject } from '@/lib/db'

export const runtime = 'edge'

export async function GET(request, { params }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Ei kirjautunut' }, { status: 401 })
  const project = findProject(params.id, user.id)
  if (!project) return Response.json({ error: 'Ei löytynyt' }, { status: 404 })
  return Response.json({ project })
}

export async function PUT(request, { params }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Ei kirjautunut' }, { status: 401 })
  const body = await request.json()
  const project = updateProject(params.id, user.id, body)
  if (!project) return Response.json({ error: 'Ei löytynyt' }, { status: 404 })
  return Response.json({ project })
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Ei kirjautunut' }, { status: 401 })
  const ok = deleteProject(params.id, user.id)
  return Response.json({ success: ok })
}
