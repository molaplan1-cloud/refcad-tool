'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShellLanguage, useLocale } from '@/components/i18n/Locale'

export default function LoginClient() {
  const { t } = useLocale()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('auth.failed'))
        setLoading(false)
        return
      }
      router.push(data.user?.role === 'admin' ? '/admin' : '/uusi')
    } catch (e) {
      setError(t('auth.network'))
      setLoading(false)
    }
  }

  return (
    <div className="safe-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <header className="landing-header" style={{ background: 'transparent', border: 'none', padding: '0 0 16px' }}>
        <Link href="/" style={{ color: '#e2e8f0', fontWeight: 800, textDecoration: 'none' }}>RefCAD</Link>
        <ShellLanguage tone="dark" />
      </header>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(12px)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit', marginBottom: '16px' }}>
            <svg width="28" height="28" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <polygon points="32,8 52,20 32,32 12,20" fill="#dbeafe" opacity="0.9" />
              <polygon points="12,20 12,44 32,56 32,32" fill="#bfdbfe" opacity="0.9" />
              <polygon points="52,20 52,44 32,56 32,32" fill="url(#logoGrad)" />
            </svg>
            <span style={{ fontSize: '15px', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RefCAD Tool</span>
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>{t('auth.welcome')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{t('auth.continue')}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>{t('auth.user')}</label>
            <input type="text" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nimi@yritys.fi"
              style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>{t('auth.password')}</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '14px' }} />
          </div>
          {error && (
            <div style={{ padding: '10px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', color: '#fca5a5' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', background: loading ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
          }}>
            {loading ? t('auth.signing') : t('auth.submit')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          {t('auth.noAccount')} <Link href="/signup" style={{ color: '#06b6d4', fontWeight: 600, textDecoration: 'none' }}>{t('auth.signupFree')}</Link>
        </div>
      </div>
      </div>
    </div>
  )
}
