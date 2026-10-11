'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DesignerApp from '@/components/designer/DesignerApp'
import { ShellLanguage, useLocale } from '@/components/i18n/Locale'
import { coldRoomEntry } from '@/lib/access'

const STORAGE_KEY = 'refcad-design-v1'

export default function Page() {
  const { t } = useLocale()
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(null)
  const [user, setUser] = useState(null)
  const [entry, setEntry] = useState(null)

  useEffect(() => {
    let cancel = false
    fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (cancel) return
        const next = data.user || null
        setUser(next)
        setEntry(coldRoomEntry(next))
      })
      .catch(() => {
        if (cancel) return
        setUser(null)
        setEntry(coldRoomEntry(null))
      })
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch (err) {
      console.error(err)
    }
    setReady(true)
    return () => { cancel = true }
  }, [])

  const onPersist = useCallback((data) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      projectName: data.name,
      rooms: data.rooms,
      pipes: data.pipes || [],
      cables: data.cables || [],
      unitSystem: data.unitSystem,
      schematic: data.schematic || null,
      panels: data.panels || null,
      dimUnit: data.unitSystem === 'IP' ? 'ft' : 'm',
      lastSaved: new Date().toISOString(),
    }))
  }, [])

  if (!ready || !entry) {
    return <div style={{ height: '100vh', background: '#0a0f1e' }} />
  }

  if (!entry.allowed) {
    const message = entry.access.admin
      ? t('gate.admin')
      : entry.access.pending
        ? t('price.thanks')
        : t('gate.cold')
    return (
      <div data-testid="cold-room-gate" style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
        <header className="picker-header safe-page" data-testid="cold-gate-header" style={{ paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
          <Link href="/" style={{ fontWeight: 800, color: '#0f172a', textDecoration: 'none' }}>RefCAD</Link>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <>
                <span data-testid="session-user" style={{ fontWeight: 700 }}>{user.username || user.email}</span>
                <span data-testid="session-plan" style={{ color: '#0369a1', fontWeight: 700 }}>{t(`plan.${entry.planId}.name`)}</span>
              </>
            ) : (
              <Link href="/login" style={{ color: '#0369a1', textDecoration: 'none' }}>{t('shell.login')}</Link>
            )}
            <ShellLanguage tone="light" />
          </span>
        </header>
        <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <h1 data-testid={entry.access.pending ? 'order-thanks' : 'cold-gate-title'} style={{ fontSize: 28, marginBottom: 12 }}>{message}</h1>
            <p style={{ color: '#475569', lineHeight: 1.5 }}>{t('price.cold')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
              <Link href="/#pricing" style={{ color: '#0369a1' }}>{t('shell.pricing')}</Link>
              <Link href={entry.access.admin ? '/admin' : '/uusi'} style={{ color: '#0369a1' }}>{entry.access.admin ? t('shell.admin') : t('designer.floorplan')}</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DesignerApp
      initialName={saved?.projectName || saved?.name || 'Uusi projekti'}
      initialRooms={saved?.rooms || []}
      initialPipes={saved?.pipes || []}
      initialCables={saved?.cables || []}
      initialSchematic={saved?.schematic || null}
      initialPanels={saved?.panels || null}
      initialUnitSystem={saved?.unitSystem || (saved?.dimUnit === 'ft' ? 'IP' : 'SI')}
      onPersist={onPersist}
      persistLabel={t('designer.browser')}
      user={user}
      watermark={entry.access.watermark}
    />
  )
}
