import { clearSessionCookie } from '@/lib/auth'

export const runtime = 'edge'

export async function POST() {
  clearSessionCookie()
  return Response.json({ success: true })
}
