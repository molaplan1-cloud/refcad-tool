import { getCurrentUser } from '@/lib/auth'
import LandingClient from './LandingClient'

export default async function HomePage() {
  const user = await getCurrentUser()
  return <LandingClient user={user} />
}
