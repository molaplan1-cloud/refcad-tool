import { PLAN_IDS } from '@/lib/access'
import { registerUser, createToken, setSessionCookie } from '@/lib/auth'
import { updateUser } from '@/lib/db'

export async function POST(request) {
  try {
    const { email, password, name, plan, cycle } = await request.json()
    if (!email || !password) {
      return Response.json({ error: 'Sähköposti ja salasana vaaditaan' }, { status: 400 })
    }
    if (password.length < 6) {
      return Response.json({ error: 'Salasanan on oltava vähintään 6 merkkiä' }, { status: 400 })
    }
    const user = await registerUser(email, password, name)
    if (!user) {
      return Response.json({ error: 'Sähköposti on jo käytössä' }, { status: 409 })
    }
    const requested = PLAN_IDS.includes(plan) && plan !== 'free' ? plan : ''
    if (requested) {
      await updateUser(user.id, {
        payment: 'pending',
        requestedPlan: requested,
        billingCycle: cycle === 'year' ? 'year' : 'month',
        plan: 'free',
      })
    }
    const token = await createToken({ userId: user.id, email: user.email })
    if (!token) {
      return Response.json({ error: 'Palvelin ei ole valmis kirjautumiseen' }, { status: 500 })
    }
    await setSessionCookie(token)
    return Response.json({
      success: true,
      user: requested ? { ...user, payment: 'pending', requestedPlan: requested, plan: 'free' } : user,
    })
  } catch (e) {
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}
