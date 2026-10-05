'use client'

import { useEffect, useState } from 'react'
import DesignerApp from '@/components/designer/DesignerApp'

const STORAGE_KEY = 'refcad-design-v1'

export default function ColdWorkspace({ plan, onProjectType, onName }) {
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

  if (!ready) {
    return <div data-testid="cold-workspace" style={{ height: '100vh', background: '#e7e5e4' }} />
  }

  return (
    <DesignerApp
      initialName={plan?.name || saved?.projectName || 'Kylmiö'}
      initialRooms={saved?.rooms || []}
      initialPipes={saved?.pipes || []}
      initialCables={saved?.cables || []}
      initialSchematic={saved?.schematic || null}
      initialUnitSystem={saved?.unitSystem || (saved?.dimUnit === 'ft' ? 'IP' : 'SI')}
      projectType="kylmio"
      onProjectType={onProjectType}
      onPersist={(data) => {
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
        if (data.name && data.name !== plan?.name) onName?.(data.name)
      }}
      persistLabel="selaimeen"
    />
  )
}
