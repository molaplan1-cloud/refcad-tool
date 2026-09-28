import { getCurrentUser } from '@/lib/auth'
import { listProjects, createProject } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Ei kirjautunut' }, { status: 401 })
  const projects = listProjects(user.id)
  return Response.json({ projects })
}

export async function POST(request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Ei kirjautunut' }, { status: 401 })

  const body = await request.json()
  const project = createProject({
    userId: user.id,
    name: body.name || 'Uusi projekti',
    data: body.data || { rooms: [], dimUnit: 'auto', settings: {} }
  })
  return Response.json({ project })
}
