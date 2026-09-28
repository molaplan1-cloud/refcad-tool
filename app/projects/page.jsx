import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { listProjects } from '@/lib/db'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const projects = await listProjects(user.id)
  return <ProjectsClient user={user} initialProjects={projects} />
}
