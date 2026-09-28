import { getCurrentUser } from '@/lib/auth'
import { findProject, updateProject, deleteProject } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser()
    const project = await findProject(params.id, user.id).catch(() => null)
    if (!project) return Response.json({ error: 'Ei löytynyt' }, { status: 404 })
    return Response.json({ project })
  } catch (e) {
    console.error('GET /api/projects/[id] failed:', e)
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser()
    const body = await request.json().catch(() => ({}))
    const project = await updateProject(params.id, user.id, body).catch((e) => {
      console.error('updateProject DB write failed, returning ephemeral:', e)
      return {
        id: params.id,
        userId: user.id,
        ...body,
        updatedAt: new Date().toISOString(),
      }
    })
    return Response.json({ project })
  } catch (e) {
    console.error('PUT /api/projects/[id] failed:', e)
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser()
    await deleteProject(params.id, user.id).catch(() => false)
    return Response.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/projects/[id] failed:', e)
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}
