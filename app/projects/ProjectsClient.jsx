'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProjectsClient({ user, initialProjects }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const createProject = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Uusi projekti', data: { rooms: [], dimUnit: 'auto' } })
      })
      const data = await res.json()
      if (data.project) {
        router.push(`/projects/${data.project.id}`)
      }
    } catch (e) {
      alert('Projektin luonti epäonnistui')
      setCreating(false)
    }
  }

  const deleteProject = async (id) => {
    if (!confirm('Poistetaanko projekti pysyvästi?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(projects.filter(p => p.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <svg width="28" height="28" viewBox="0 0 64 64">
            <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
            <polygon points="32,8 52,20 32,32 12,20" fill="#dbeafe" opacity="0.9" />
            <polygon points="12,20 12,44 32,56 32,32" fill="#bfdbfe" opacity="0.9" />
            <polygon points="52,20 52,44 32,56 32,32" fill="url(#lg)" />
          </svg>
          <span style={{ fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '15px' }}>RefCAD Tool</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{user.email}</span>
          <form action="/api/auth/logout" method="POST" style={{ display: 'inline' }}>
            <button type="submit" style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#f1f5f9', cursor: 'pointer', fontSize: '12px' }}>Kirjaudu ulos</button>
          </form>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>Projektit</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{projects.length} projektia</p>
          </div>
          <button onClick={() => setCreating(true)} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            ➕ Uusi projekti
          </button>
        </div>

        {creating && (
          <div style={{ padding: '20px', background: 'rgba(30,41,59,0.6)', border: '1px solid #06b6d4', borderRadius: '12px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Projektin nimi" onKeyDown={(e) => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setCreating(false) }}
              style={{ flex: 1, padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f1f5f9', fontSize: '14px' }} />
            <button onClick={createProject} disabled={creating} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Luo
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: '10px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              Peruuta
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(30,41,59,0.4)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>❄️</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Ei vielä projekteja</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>Aloita ensimmäisellä kylmähuoneprojektilla</div>
            <button onClick={() => setCreating(true)} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              ➕ Luo ensimmäinen projekti
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {projects.map(p => (
              <div key={p.id} style={{ padding: '20px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', transition: 'all 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      Luotu: {new Date(p.createdAt).toLocaleDateString('fi-FI')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      Muokattu: {new Date(p.updatedAt).toLocaleDateString('fi-FI')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                  <Link href={`/projects/${p.id}`} style={{ flex: 1, padding: '8px 12px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
                    Avaa
                  </Link>
                  <button onClick={() => deleteProject(p.id)} style={{ padding: '8px 12px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px', cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
