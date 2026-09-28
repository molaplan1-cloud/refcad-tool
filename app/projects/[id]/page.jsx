import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { findProject } from '@/lib/db'
import DesignerClient from './DesignerClient'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const project = findProject(params.id, user.id)
  if (!project) notFound()

  return <DesignerClient user={user} initialProject={project} />
}
