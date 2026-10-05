'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PROJECT_TYPES, accessFor, canStartType } from '@/lib/access'
import { emptyPlan } from '@/lib/floorplan'
import { CURRENT_KEY } from '@/lib/projects'
import { ShellLanguage, useLocale } from '@/components/i18n/Locale'

export default function TypePage() {
  const { t } = useLocale()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true))
  }, [])

  const access = accessFor(user)
  const start = (type) => {
    const gate = accessFor(user, type.id)
    if (!canStartType(gate, type)) return
    if (type.route === '/suunnittelu') {
      window.sessionStorage.setItem('refcad-project-type', type.id)
      router.push('/suunnittelu')
      return
    }
    const plan = { ...emptyPlan(type.defaults.name || type.name), ...type.defaults, projectType: type.id }
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(plan))
    router.push('/pohjakuva')
  }

  return (
    <div data-testid="type-picker" style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      <header className="picker-header safe-page" style={{ paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
        <Link href="/" style={{ fontWeight: 800, color: '#0f172a', textDecoration: 'none' }}>RefCAD</Link>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <Link href={access.admin ? '/admin' : '/login'} style={{ color: '#0369a1', textDecoration: 'none' }}>{access.admin ? t('shell.admin') : user ? user.email : t('shell.login')}</Link>
          <ShellLanguage tone="light" />
        </span>
      </header>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 24px 64px' }}>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12, color: '#0369a1', fontWeight: 700 }}>{t('type.new')}</p>
        <h1 className="picker-title" style={{ fontSize: 40, lineHeight: 1.1, margin: '8px 0 12px' }}>{t('type.heading')}</h1>
        <p style={{ maxWidth: 640, color: '#475569', fontSize: 17, lineHeight: 1.5 }}>{t('type.lead')}</p>
        {access.pending && (
          <p data-testid="payment-pending" style={{ marginTop: 16, padding: '10px 14px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10 }}>
            {t('shell.pending')}
          </p>
        )}
        {access.admin && (
          <p data-testid="admin-no-draw" style={{ marginTop: 16 }}>{t('type.adminNoDraw')}</p>
        )}
        <div className="picker-grid" style={{ marginTop: 28 }}>
          {PROJECT_TYPES.map((type) => {
            const allowed = loaded && canStartType(accessFor(user, type.id), type)
            return (
              <button
                key={type.id}
                type="button"
                data-testid={`type-${type.id}`}
                disabled={!allowed}
                onClick={() => start(type)}
                style={{
                  textAlign: 'left',
                  padding: 20,
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: allowed ? 'pointer' : 'not-allowed',
                  opacity: allowed ? 1 : 0.72,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 750 }}>{t(`type.${type.id}.name`)}</div>
                <p style={{ color: '#475569', lineHeight: 1.45, minHeight: 64 }}>{t(`type.${type.id}.summary`)}</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: allowed ? '#0f766e' : '#9a3412' }}>
                  {allowed ? t('type.start') : t('type.needsPro')}
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
