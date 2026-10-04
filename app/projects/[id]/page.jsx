import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import DesignerClient from './DesignerClient'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/admin')
  // Pass only the user and project id. DesignerClient loads the project
  // itself from localStorage on the client side — no server DB lookup.
  return <DesignerClient user={user} projectId={params.id} />
}
