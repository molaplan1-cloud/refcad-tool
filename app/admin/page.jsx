'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const PLANS = [
  ['free', 'Ilmainen'],
  ['basic', 'Perus'],
  ['pro', 'Pro'],
  ['company', 'Yritys'],
]

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', name: '', password: '', plan: 'basic' })

  const load = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Ei oikeutta')
      setUsers([])
      return
    }
    setError('')
    setUsers(data.users || [])
  }

  useEffect(() => { load() }, [])

  const patch = async (id, body) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Tallennus epäonnistui')
      return
    }
    await load()
  }

  const create = async (event) => {
    event.preventDefault()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Käyttäjää ei luotu')
      return
    }
    setForm({ email: '', name: '', password: '', plan: 'basic' })
    await load()
  }

  return (
    <div data-testid="admin-panel" style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '28px 24px 64px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0369a1', fontWeight: 700 }}>Ylläpito</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 32 }}>Käyttäjät ja maksut</h1>
          </div>
          <Link href="/" style={{ color: '#0369a1' }}>Etusivu</Link>
        </header>
        <p style={{ color: '#475569', maxWidth: 680 }}>Ylläpitäjä ei piirrä. Maksu kuitataan käsin. Käyttäjä pääsee maksullisiin työtiloihin vasta kuitauksen jälkeen, ja vain voimassaoloaikana.</p>
        {error && <p data-testid="admin-error" style={{ color: '#9f1239' }}>{error}</p>}
        <form data-testid="admin-create" onSubmit={create} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto auto', gap: 8, margin: '20px 0', alignItems: 'end' }}>
          <label>Sähköposti<input data-testid="admin-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required style={field} /></label>
          <label>Nimi<input data-testid="admin-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={field} /></label>
          <label>Salasana<input data-testid="admin-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required style={field} /></label>
          <label>Tilaus<select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} style={field}>{PLANS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <button type="submit" style={button}>Luo käyttäjä</button>
        </form>
        <div data-testid="admin-users" style={{ display: 'grid', gap: 12 }}>
          {users.map((user) => (
            <article key={user.id} data-testid="admin-user" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{user.name || user.email}</strong>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{user.email}{user.username ? ` · ${user.username}` : ''} · {user.role}</div>
                  {user.requestedPlan && <div style={{ fontSize: 13 }}>Pyyntö: {user.requestedPlan} / {user.billingCycle || 'kk'}</div>}
                  {user.payment === 'pending' && <div data-testid="admin-pending">Odottaa maksun vahvistusta</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select aria-label="Tilaus" value={user.plan || 'free'} onChange={(event) => patch(user.id, { plan: event.target.value })} style={field}>
                    {PLANS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                  <input aria-label="Voimassa alkaen" type="date" value={(user.validFrom || '').slice(0, 10)} onChange={(event) => patch(user.id, { validFrom: event.target.value })} style={field} />
                  <input aria-label="Voimassa asti" type="date" value={(user.validUntil || '').slice(0, 10)} onChange={(event) => patch(user.id, { validUntil: event.target.value })} style={field} />
                  <button type="button" data-testid="admin-confirm" style={button} onClick={() => patch(user.id, { payment: 'received' })}>Maksu kuitattu</button>
                  <button type="button" style={quiet} onClick={() => patch(user.id, { disabled: !user.disabled })}>{user.disabled ? 'Ota käyttöön' : 'Poista käytöstä'}</button>
                  <button type="button" style={quiet} onClick={() => { if (window.confirm('Poistetaanko käyttäjä?')) fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' }).then(load) }}>Poista</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

const field = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }
const button = { padding: '9px 12px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const quiet = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }
