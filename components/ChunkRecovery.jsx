'use client'

import { useEffect, useState } from 'react'
import StaleDeployNotice from './StaleDeployNotice'
import { isStaleChunkError, recoverStaleDeploy } from '@/lib/staleDeploy'

export default function ChunkRecovery() {
  const [prompt, setPrompt] = useState(false)

  useEffect(() => {
    let timer = 0
    const onFailure = (event) => {
      const payload = event?.reason ?? event?.error ?? event?.message
      if (!isStaleChunkError(payload) && !isStaleChunkError(event?.message)) return
      event.preventDefault?.()
      if (recoverStaleDeploy() !== 'prompt') return
      // The error page paints the same notice. Wait for that commit before
      // adding a second copy for a failure the boundary did not catch.
      timer = window.setTimeout(() => {
        if (!document.querySelector('[data-testid="stale-deploy-notice"]')) setPrompt(true)
      }, 200)
    }
    window.addEventListener('error', onFailure)
    window.addEventListener('unhandledrejection', onFailure)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('error', onFailure)
      window.removeEventListener('unhandledrejection', onFailure)
    }
  }, [])

  if (!prompt) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
      <StaleDeployNotice />
    </div>
  )
}
