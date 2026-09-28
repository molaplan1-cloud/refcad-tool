import { getCurrentUser } from '@/lib/auth'
import { listProjects, createProject } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const projects = await listProjects(user.id)
    return Response.json({ projects })
  } catch (e) {
    console.error('GET /api/projects failed:', e)
    // Always return a valid array so UI doesn't crash
    return Response.json({ projects: [] })
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser()
    const body = await request.json().catch(() => ({}))
    const project = await createProject({
      userId: user.id,
      name: body.name || 'Uusi projekti',
      data: body.data || { rooms: [], dimUnit: 'auto', settings: {} },
    }).catch((e) => {
      console.error('createProject DB write failed, returning ephemeral project:', e)
      // DB write failed — return an in-memory ephemeral project so UI works
      return {
        id: 'ephemeral-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        userId: user.id,
        name: body.name || 'Uusi projekti',
        data: body.data || { rooms: [], dimUnit: 'auto', settings: {} },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })
    return Response.json({ project })
  } catch (e) {
    console.error('POST /api/projects failed:', e)
    return Response.json(
      { error: 'Projektin luonti epäonnistui', detail: String(e) },
      { status: 500 }
    )
  }
}
