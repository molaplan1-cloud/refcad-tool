'use client'

import { useLayoutEffect, useState } from 'react'
import { isCompactViewport, viewportKind } from '@/lib/viewport'

export function useViewport() {
  const [width, setWidth] = useState(1280)
  useLayoutEffect(() => {
    const read = () => setWidth(window.innerWidth || 1280)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  const kind = viewportKind(width)
  return { width, kind, compact: isCompactViewport(width), phone: kind === 'phone' }
}
