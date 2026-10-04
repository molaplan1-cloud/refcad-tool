import { PLAN_IDS } from '@/lib/access'
import { getCurrentUser } from '@/lib/auth'
import { updateUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Kirjaudu sisään' }, { status: 401 })
  if (user.role === 'admin' || user.role === 'demo') {
    return Response.json({ error: 'Tälle tilille ei pyydetä maksua' }, { status: 400 })
  }
  const body = await request.json().catch(() => ({}))
  if (!PLAN_IDS.includes(body.plan) || body.plan === 'free') {
    return Response.json({ error: 'Valitse maksullinen tilaus' }, { status: 400 })
  }
  const updated = await updateUser(user.id, {
    payment: 'pending',
    requestedPlan: body.plan,
    billingCycle: body.cycle === 'year' ? 'year' : 'month',
    plan: 'free',
  })
  return Response.json({ user: updated, pending: true })
}
