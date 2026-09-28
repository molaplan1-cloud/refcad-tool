import { registerUser, createToken, setSessionCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password, name } = await request.json()
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

    const token = await createToken({ userId: user.id, email: user.email })
    await setSessionCookie(token)

    return Response.json({ success: true, user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}
