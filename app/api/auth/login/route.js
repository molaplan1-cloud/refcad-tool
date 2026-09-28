import { authenticateUser, createToken, setSessionCookie } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return Response.json({ error: 'Sähköposti ja salasana vaaditaan' }, { status: 400 })
    }

    const user = await authenticateUser(email, password)
    if (!user) {
      return Response.json({ error: 'Väärä sähköposti tai salasana' }, { status: 401 })
    }

    const token = await createToken({ userId: user.id, email: user.email })
    await setSessionCookie(token)

    return Response.json({ success: true, user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}
