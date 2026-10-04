import { authenticateUser, createToken, setSessionCookie } from '@/lib/auth'
import { accessFor } from '@/lib/access'

export async function POST(request) {
  try {
    const { email, password, username } = await request.json()
    const login = email || username
    if (!login || !password) {
      return Response.json({ error: 'Tunnus ja salasana vaaditaan' }, { status: 400 })
    }
    const user = await authenticateUser(login, password)
    if (user?.error === 'disabled') {
      return Response.json({ error: 'Tili on poistettu käytöstä' }, { status: 403 })
    }
    if (!user) {
      return Response.json({ error: 'Väärä tunnus tai salasana' }, { status: 401 })
    }
    const token = await createToken({ userId: user.id, email: user.email })
    if (!token) {
      return Response.json({ error: 'Palvelin ei ole valmis kirjautumiseen' }, { status: 500 })
    }
    await setSessionCookie(token)
    return Response.json({ success: true, user, access: accessFor(user) })
  } catch (e) {
    return Response.json({ error: 'Palvelinvirhe' }, { status: 500 })
  }
}
