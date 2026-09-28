import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import LoginClient from './LoginClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/projects')
  return <LoginClient />
}
