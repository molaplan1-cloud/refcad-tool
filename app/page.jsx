'use client'

import { useCallback, useEffect, useState } from 'react'
import DesignerApp from '@/components/designer/DesignerApp'

const STORAGE_KEY = 'refcad-design-v1'

export default function Page() {
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch (err) {
      console.error(err)
    }
    setReady(true)
  }, [])

  const onPersist = useCallback((data) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      projectName: data.name,
      rooms: data.rooms,
      pipes: data.pipes || [],
      cables: data.cables || [],
      unitSystem: data.unitSystem,
      dimUnit: data.unitSystem === 'IP' ? 'ft' : 'm',
      lastSaved: new Date().toISOString(),
    }))
  }, [])

  if (!ready) {
    return <div style={{ height: '100vh', background: '#0a0f1e' }} />
  }

  return (
    <DesignerApp
      initialName={saved?.projectName || saved?.name || 'Uusi projekti'}
      initialRooms={saved?.rooms || []}
      initialPipes={saved?.pipes || []}
      initialCables={saved?.cables || []}
      initialUnitSystem={saved?.unitSystem || (saved?.dimUnit === 'ft' ? 'IP' : 'SI')}
      onPersist={onPersist}
      persistLabel="selaimeen"
    />
  )
}
