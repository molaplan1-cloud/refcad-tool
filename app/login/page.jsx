import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user?.role === 'admin') redirect('/admin')
  if (user) redirect('/uusi')
  return <LoginClient />
}
