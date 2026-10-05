'use client'

import { useEffect, useState } from 'react'
import { normalizeLocale, translate } from '@/lib/i18n'
import { STALE_DEPLOY_ACTION, STALE_DEPLOY_MESSAGE, refreshAfterStaleDeploy } from '@/lib/staleDeploy'

export default function StaleDeployNotice() {
  const [locale, setLocale] = useState('fi')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('refcad-locale')
      if (saved) setLocale(normalizeLocale(saved))
    } catch { /* storage can be blocked */ }
  }, [])
  const message = locale === 'fi' ? STALE_DEPLOY_MESSAGE : translate(locale, 'stale.message')
  const action = locale === 'fi' ? STALE_DEPLOY_ACTION : translate(locale, 'stale.action')
  return (
    <div
      data-testid="stale-deploy-notice"
      style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, maxWidth: '24rem', lineHeight: 1.35 }}>
        {message}
      </h1>
      <p style={{ fontSize: '1rem', marginTop: '1rem', color: '#94a3b8', maxWidth: '28rem' }}>
        {translate(locale, 'stale.saved')}
      </p>
      <button
        type="button"
        data-testid="stale-deploy-refresh"
        onClick={() => refreshAfterStaleDeploy()}
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#22d3ee',
          color: '#0f172a',
          border: 'none',
          borderRadius: '0.5rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {action}
      </button>
    </div>
  )
}
