import { PLAN_IDS, accessFor } from '@/lib/access'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { deleteUser, setUserPassword, updateUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!accessFor(user).admin) return null
  return user
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Ei oikeutta' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const patch = {}
  if (body.name != null) patch.name = String(body.name)
  if (PLAN_IDS.includes(body.plan)) patch.plan = body.plan
  if (['none', 'pending', 'received'].includes(body.payment)) patch.payment = body.payment
  if (typeof body.disabled === 'boolean') patch.disabled = body.disabled
  if (body.validFrom != null) patch.validFrom = String(body.validFrom).slice(0, 10)
  if (body.validUntil != null) patch.validUntil = String(body.validUntil).slice(0, 10)
  let user = await updateUser(params.id, patch)
  if (!user) return Response.json({ error: 'Käyttäjää ei löydy' }, { status: 404 })
  if (body.password) {
    if (String(body.password).length < 6) {
      return Response.json({ error: 'Salasanan on oltava vähintään 6 merkkiä' }, { status: 400 })
    }
    user = await setUserPassword(params.id, await hashPassword(body.password))
  }
  return Response.json({ user })
}

export async function DELETE(_request, { params }) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Ei oikeutta' }, { status: 403 })
  if (params.id === admin.id) {
    return Response.json({ error: 'Et voi poistaa omaa ylläpitäjätiliä' }, { status: 400 })
  }
  const ok = await deleteUser(params.id)
  if (!ok) return Response.json({ error: 'Käyttäjää ei löydy' }, { status: 404 })
  return Response.json({ success: true })
}
