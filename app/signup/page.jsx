import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import SignupClient from './SignupClient'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user?.role === 'admin') redirect('/admin')
  if (user) redirect('/uusi')
  return <SignupClient />
}
