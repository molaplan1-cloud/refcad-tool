import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import SignupClient from './SignupClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) redirect('/projects')
  return <SignupClient />
}
