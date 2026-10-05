'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { paymentActive } from '@/lib/access'
import { ShellLanguage, useLocale } from '@/components/i18n/Locale'

const PLAN_IDS = ['free', 'basic', 'pro', 'company']

function statusOf(user) {
  if (user.disabled) return 'disabled'
  if (user.payment === 'pending') return 'pending'
  if (user.payment === 'received' && !paymentActive(user)) return 'expired'
  if (paymentActive(user)) return 'active'
  return 'none'
}

export default function AdminPage() {
  const { t } = useLocale()
  const planName = (id) => t(`plan.${id || 'free'}.name`)
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', password: '', plan: 'basic' })

  const load = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || t('admin.forbidden'))
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
      setError(data.error || t('admin.saveFailed'))
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
      setError(data.error || t('admin.createFailed'))
      return
    }
    setForm({ email: '', name: '', password: '', plan: 'basic' })
    await load()
  }

  return (
    <div data-testid="admin-panel" className="safe-page" style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '24px 20px 48px', paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header className="admin-header" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0369a1', fontWeight: 700 }}>{t('admin.kicker')}</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 28 }}>{t('admin.title')}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShellLanguage tone="light" />
            <Link href="/" style={{ color: '#0369a1' }}>{t('shell.home')}</Link>
          </div>
        </header>
        <p style={{ color: '#475569', marginTop: 0 }}>{t('admin.lead')}</p>
        {error && <p data-testid="admin-error" style={{ color: '#9f1239' }}>{error}</p>}
        <div data-testid="admin-users" className="admin-users">
          <table>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f1f5f9' }}>
                {[t('admin.user'), t('admin.plan'), t('admin.status'), t('admin.from'), t('admin.until'), t('admin.actions')].map((label) => (
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
                      {user.requestedPlan && <div style={{ fontSize: 12 }}>{t('admin.request')}: {planName(user.requestedPlan)}</div>}
                    </td>
                    <td style={{ padding: '12px' }} data-testid="admin-plan">{open ? (
                      <select aria-label={t('admin.plan')} value={user.plan || 'free'} onChange={(event) => patch(user.id, { plan: event.target.value })} style={field}>
                        {PLAN_IDS.map((id) => <option key={id} value={id}>{planName(id)}</option>)}
                      </select>
                    ) : planName(user.plan)}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }} data-testid="admin-status">{t(`admin.status.${status}`)}</td>
                    <td style={{ padding: '12px' }}>{open ? (
                      <input aria-label={t('admin.from')} type="date" value={(user.validFrom || '').slice(0, 10)} onChange={(event) => patch(user.id, { validFrom: event.target.value })} style={field} />
                    ) : (user.validFrom || '—')}</td>
                    <td style={{ padding: '12px' }}>{open ? (
                      <input aria-label={t('admin.until')} type="date" value={(user.validUntil || '').slice(0, 10)} onChange={(event) => patch(user.id, { validUntil: event.target.value })} style={field} />
                    ) : (user.validUntil || '—')}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(status === 'pending' || status === 'expired') && user.role !== 'admin' && user.role !== 'demo' && (
                          <button type="button" data-testid="admin-confirm" style={button} onClick={() => patch(user.id, { payment: 'received' })}>{t('admin.confirm')}</button>
                        )}
                        <button type="button" data-testid="admin-edit" style={quiet} onClick={() => setEditing(open ? null : user.id)}>{open ? t('admin.close') : t('admin.edit')}</button>
                        <button type="button" data-testid="admin-disable" style={quiet} onClick={() => patch(user.id, { disabled: !user.disabled })}>{user.disabled ? t('admin.enable') : t('admin.disable')}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <form data-testid="admin-create" className="admin-create" onSubmit={create}>
          <label>{t('auth.email')}<input data-testid="admin-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required style={field} /></label>
          <label>{t('auth.name')}<input data-testid="admin-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={field} /></label>
          <label>{t('auth.password')}<input data-testid="admin-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required style={field} /></label>
          <label>{t('admin.plan')}<select aria-label={t('admin.plan')} value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} style={field}>{PLAN_IDS.map((id) => <option key={id} value={id}>{planName(id)}</option>)}</select></label>
          <button type="submit" style={button}>{t('admin.createUser')}</button>
        </form>
      </div>
    </div>
  )
}

const field = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }
const button = { padding: '8px 10px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const quiet = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }
