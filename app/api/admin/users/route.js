import { PLAN_IDS, accessFor } from '@/lib/access'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { createUser, findUserByEmail, listUsers } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!accessFor(user).admin) return null
  return user
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: 'Ei oikeutta' }, { status: 403 })
  return Response.json({ users: await listUsers() })
}

export async function POST(request) {
  if (!(await requireAdmin())) return Response.json({ error: 'Ei oikeutta' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  if (!email || password.length < 6) {
    return Response.json({ error: 'Sähköposti ja vähintään 6 merkin salasana vaaditaan' }, { status: 400 })
  }
  if (await findUserByEmail(email)) {
    return Response.json({ error: 'Sähköposti on jo käytössä' }, { status: 409 })
  }
  const plan = PLAN_IDS.includes(body.plan) ? body.plan : 'free'
  const created = await createUser({
    email,
    username: '',
    name: body.name || email,
    passwordHash: await hashPassword(password),
    role: 'user',
    plan,
    payment: body.payment === 'received' ? 'received' : 'none',
    disabled: false,
    validFrom: body.validFrom || '',
    validUntil: body.validUntil || '',
    requestedPlan: '',
    billingCycle: '',
  })
  const user = { ...created }
  delete user.passwordHash
  delete user.password
  return Response.json({ user })
}
