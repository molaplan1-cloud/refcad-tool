'use client'

import { useCallback, useEffect, useState } from 'react'
import { getProject as lsGet, updateProject as lsUpdate } from '@/lib/clientStore'
import DesignerApp from '@/components/designer/DesignerApp'

export default function DesignerClient({ user, projectId }) {
  const [ready, setReady] = useState(false)
  const [initial, setInitial] = useState(null)

  useEffect(() => {
    const stored = lsGet(projectId)
    if (stored) {
      setInitial(stored)
    } else {
      const created = {
        id: projectId,
        name: 'Projekti',
        data: { rooms: [], unitSystem: 'SI' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const all = JSON.parse(window.localStorage.getItem('refcad:projects:v1') || '[]')
      all.unshift(created)
      window.localStorage.setItem('refcad:projects:v1', JSON.stringify(all))
      setInitial(created)
    }
    setReady(true)
  }, [projectId])

  const onPersist = useCallback((data) => {
    lsUpdate(projectId, {
      name: data.name,
      data: { rooms: data.rooms, unitSystem: data.unitSystem, dimUnit: data.unitSystem === 'IP' ? 'ft' : 'm' },
    })
  }, [projectId])

  if (!ready || !initial) {
    return <div style={{ height: '100vh', background: '#0a0f1e' }} />
  }

  return (
    <DesignerApp
      key={projectId}
      initialName={initial.name}
      initialRooms={initial.data?.rooms || []}
      initialUnitSystem={initial.data?.unitSystem || 'SI'}
      onPersist={onPersist}
      user={user}
      persistLabel="projektiin"
    />
  )
}
