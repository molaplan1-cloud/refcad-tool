import { getCurrentUser } from '@/lib/auth'
import LandingClient from './LandingClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await getCurrentUser()
  return <LandingClient user={user} />
}
