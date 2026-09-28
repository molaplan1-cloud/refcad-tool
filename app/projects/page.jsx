import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { listProjects } from '@/lib/db'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  // Auth disabled in demo mode — getCurrentUser always returns demo user.
  // Keep this guard so adding auth back later is one-line.
  if (!user) redirect('/login')
  const projects = await listProjects(user.id)
  return <ProjectsClient user={user} initialProjects={projects} />
}
