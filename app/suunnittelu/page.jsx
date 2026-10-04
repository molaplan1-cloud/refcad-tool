'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DesignerApp from '@/components/designer/DesignerApp'
import { accessFor } from '@/lib/access'

const STORAGE_KEY = 'refcad-design-v1'

export default function Page() {
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(null)
  const [access, setAccess] = useState(null)

  useEffect(() => {
    let cancel = false
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!cancel) setAccess(accessFor(data.user, 'kylmio'))
      })
      .catch(() => {
        if (!cancel) setAccess(accessFor(null, 'kylmio'))
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
      dimUnit: data.unitSystem === 'IP' ? 'ft' : 'm',
      lastSaved: new Date().toISOString(),
    }))
  }, [])

  if (!ready || !access) {
    return <div style={{ height: '100vh', background: '#0a0f1e' }} />
  }

  if (!access.workspaces.includes('kylma')) {
    const message = access.admin
      ? 'Ylläpitäjä ei piirrä.'
      : access.pending
        ? 'Odottaa maksun vahvistusta'
        : 'Kylmätekniikka kuuluu Pro-tilaukseen.'
    return (
      <div data-testid="cold-room-gate" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#0f172a', padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>{message}</h1>
          <p style={{ color: '#475569', lineHeight: 1.5 }}>Höyrystin, koneikko, putkistot ja kuormalaskenta avautuvat, kun ylläpito on kuitannut maksun.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <Link href="/#pricing" style={{ color: '#0369a1' }}>Hinnasto</Link>
            <Link href={access.admin ? '/admin' : '/uusi'} style={{ color: '#0369a1' }}>{access.admin ? 'Ylläpito' : 'Pohjakuva'}</Link>
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
      initialUnitSystem={saved?.unitSystem || (saved?.dimUnit === 'ft' ? 'IP' : 'SI')}
      onPersist={onPersist}
      persistLabel="selaimeen"
    />
  )
}
