'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { paymentActive } from '@/lib/access'

const PLANS = [
  ['free', 'Ilmainen'],
  ['basic', 'Perus'],
  ['pro', 'Pro'],
  ['company', 'Yritys'],
]

function planName(id) {
  return PLANS.find((item) => item[0] === id)?.[1] || 'Ilmainen'
}

function statusOf(user) {
  if (user.disabled) return 'Pois käytöstä'
  if (user.payment === 'pending') return 'Odottaa maksun vahvistusta'
  if (user.payment === 'received' && !paymentActive(user)) return 'Vanhentunut'
  if (paymentActive(user)) return 'Voimassa'
  return 'Ei maksua'
}

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
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
    <div data-testid="admin-panel" className="safe-page" style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '24px 20px 48px', paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header className="admin-header" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0369a1', fontWeight: 700 }}>Ylläpito</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>Käyttäjät ja maksut</h1>
          </div>
          <Link href="/" style={{ color: '#0369a1' }}>Etusivu</Link>
        </header>
        <p style={{ color: '#475569', marginTop: 0 }}>Ylläpitäjä ei piirrä. Maksulliset työtilat avautuvat, kun maksu on kuitattu ja voimassaolo on käynnissä.</p>
        {error && <p data-testid="admin-error" style={{ color: '#9f1239' }}>{error}</p>}
        <div data-testid="admin-users" className="admin-users">
          <table>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f1f5f9' }}>
                {['Käyttäjä', 'Tilaus', 'Tila', 'Voimassa alkaen', 'Voimassa asti', 'Toiminnot'].map((label) => (
                  <th key={label} style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = statusOf(user)
                const open = editing === user.id
                return (
                  <tr key={user.id} data-testid="admin-user" data-status={status} style={{ borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    <td style={{ padding: '12px' }}>
                      <strong>{user.name || user.email}</strong>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{user.email}</div>
                      {user.requestedPlan && <div style={{ fontSize: 12 }}>Pyyntö: {planName(user.requestedPlan)}</div>}
                    </td>
                    <td style={{ padding: '12px' }} data-testid="admin-plan">{open ? (
                      <select aria-label="Tilaus" value={user.plan || 'free'} onChange={(event) => patch(user.id, { plan: event.target.value })} style={field}>
                        {PLANS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    ) : planName(user.plan)}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }} data-testid="admin-status">{status}</td>
                    <td style={{ padding: '12px' }}>{open ? (
                      <input aria-label="Voimassa alkaen" type="date" value={(user.validFrom || '').slice(0, 10)} onChange={(event) => patch(user.id, { validFrom: event.target.value })} style={field} />
                    ) : (user.validFrom || '—')}</td>
                    <td style={{ padding: '12px' }}>{open ? (
                      <input aria-label="Voimassa asti" type="date" value={(user.validUntil || '').slice(0, 10)} onChange={(event) => patch(user.id, { validUntil: event.target.value })} style={field} />
                    ) : (user.validUntil || '—')}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(status === 'Odottaa maksun vahvistusta' || status === 'Vanhentunut') && user.role !== 'admin' && user.role !== 'demo' && (
                          <button type="button" data-testid="admin-confirm" style={button} onClick={() => patch(user.id, { payment: 'received' })}>Uusi / kuittaa</button>
                        )}
                        <button type="button" data-testid="admin-edit" style={quiet} onClick={() => setEditing(open ? null : user.id)}>{open ? 'Sulje' : 'Muokkaa'}</button>
                        <button type="button" data-testid="admin-disable" style={quiet} onClick={() => patch(user.id, { disabled: !user.disabled })}>{user.disabled ? 'Ota käyttöön' : 'Poista käytöstä'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <form data-testid="admin-create" className="admin-create" onSubmit={create}>
          <label>Sähköposti<input data-testid="admin-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required style={field} /></label>
          <label>Nimi<input data-testid="admin-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={field} /></label>
          <label>Salasana<input data-testid="admin-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required style={field} /></label>
          <label>Tilaus<select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} style={field}>{PLANS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <button type="submit" style={button}>Luo käyttäjä</button>
        </form>
      </div>
    </div>
  )
}

const field = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }
const button = { padding: '8px 10px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const quiet = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }
