'use client'

import { useEffect, useState } from 'react'
import StaleDeployNotice from '@/components/StaleDeployNotice'
import { normalizeLocale, translate } from '@/lib/i18n'
import { isStaleChunkError, recoverStaleDeploy } from '@/lib/staleDeploy'

// Global error boundary for the root layout.
// Cloudflare's @cloudflare/next-on-pages 1.13.15 flags /_error as missing
// edge runtime if no explicit global error page exists. This must be a Client
// Component and must include html/body tags (it replaces the root layout).

export default function GlobalError({ error, reset }) {
  const [locale, setLocale] = useState('fi')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('refcad-locale')
      if (saved) setLocale(normalizeLocale(saved))
    } catch { /* storage can be blocked */ }
  }, [])
  const t = (key) => translate(locale, key)
  const stale = isStaleChunkError(error)
  useEffect(() => {
    if (stale) recoverStaleDeploy()
  }, [stale])

  if (stale) {
    return (
      <html lang={locale}>
        <body style={{ margin: 0 }}>
          <StaleDeployNotice />
        </body>
      </html>
    )
  }

  return (
    <html lang={locale}>
      <body
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
        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, color: '#f87171' }}>
          {t('error.app')}
        </h1>
        <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
          {t('error.reload')}
        </p>
        {error?.message && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              color: '#fca5a5',
              maxWidth: '600px',
              overflow: 'auto',
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          onClick={() => reset?.()}
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
          {t('error.retry')}
        </button>
      </body>
    </html>
  )
}
