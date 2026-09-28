import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import SignupClient from './SignupClient'

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) redirect('/projects')
  return <SignupClient />
}
