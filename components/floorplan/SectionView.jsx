'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlanLocale } from '@/components/i18n/Locale'
import { ivSection } from '@/lib/ivZone'
import { runColor } from '@/lib/services'

export default function SectionView({ plan }) {
  const { t } = usePlanLocale(plan)
  const hostRef = useRef(null)
  const [size, setSize] = useState({ w: 900, h: 640 })
  const section = ivSection(plan)

  useEffect(() => {
    const node = hostRef.current
    if (!node) return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setSize({ w: Math.max(320, rect.width), h: Math.max(240, rect.height) })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const pad = 36
  const u0 = Math.min(section.u0, ...section.roof.map((point) => point.u)) - 0.3
  const u1 = Math.max(section.u1, ...section.roof.map((point) => point.u)) + 0.3
  const y0 = -0.45
  const y1 = section.ceiling + section.rise + 0.35
  const worldW = Math.max(1, u1 - u0)
  const worldH = Math.max(1, y1 - y0)
  const scale = Math.min((size.w - pad * 2) / worldW, (size.h - pad * 2) / worldH)
  const X = (u) => pad + (u - u0) * scale
  const Y = (y) => size.h - pad - (y - y0) * scale
  const roof = section.roof.map((point) => `${X(point.u)},${Y(point.y)}`).join(' ')

  return (
    <div ref={hostRef} data-testid="section-view" style={{ flex: 1, minHeight: 0, background: '#d6d3d1', position: 'relative' }}>
      <svg width={size.w} height={size.h} style={{ display: 'block' }}>
        <rect x={8} y={8} width={Math.max(0, size.w - 16)} height={Math.max(0, size.h - 16)} fill="#fff" stroke="#d6d3d1" />
        <text x={pad} y={26} fontSize="13" fontWeight="700" fill="#1c1917">{t('view.section')}</text>
        <line data-testid="section-floor" x1={X(section.u0)} y1={Y(0)} x2={X(section.u1)} y2={Y(0)} stroke="#78716c" strokeWidth={2} />
        <line data-testid="section-ceiling" x1={X(u0)} y1={Y(section.ceiling)} x2={X(u1)} y2={Y(section.ceiling)} stroke="#a8a29e" strokeWidth={1.25} strokeDasharray="5 4" />
        <text data-testid="section-ceiling-label" x={X(u1) - 4} y={Y(section.ceiling) - 6} textAnchor="end" fontSize="11" fill="#57534e">{t('section.ceiling')}</text>
        <polyline data-testid="section-roof" points={roof} fill="#f5f5f4" stroke="#44403c" strokeWidth={1.4} />
        <text x={X((section.u0 + section.u1) / 2)} y={Y(section.ceiling + section.rise * 0.45)} textAnchor="middle" fontSize="11" fill="#78716c">{t('section.attic')}</text>
        {section.walls.map((wall, index) => (
          <line
            key={`wall-${index}`}
            data-testid="section-wall"
            data-kind={wall.kind}
            x1={X(wall.u)}
            y1={Y(wall.y0)}
            x2={X(wall.u)}
            y2={Y(wall.y1)}
            stroke={wall.kind === 'interior' || wall.kind === 'partition' ? '#a8a29e' : '#1c1917'}
            strokeWidth={wall.kind === 'interior' || wall.kind === 'partition' ? 3 : 5}
          />
        ))}
        {section.ducts.map((duct, index) => {
          const color = runColor({ system: 'iv', kind: duct.kind })
          if (duct.mode === 'cut') {
            return (
              <circle
                key={`duct-${index}`}
                data-testid="section-duct"
                data-zone={duct.zone}
                data-above={duct.above ? '1' : '0'}
                data-kind={duct.kind}
                cx={X(duct.u0)}
                cy={Y(duct.y0)}
                r={5}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeDasharray={duct.above ? '3 2' : undefined}
              />
            )
          }
          return (
            <line
              key={`duct-${index}`}
              data-testid="section-duct"
              data-zone={duct.zone}
              data-above={duct.above ? '1' : '0'}
              data-kind={duct.kind}
              x1={X(duct.u0)}
              y1={Y(duct.y0)}
              x2={X(duct.u1)}
              y2={Y(duct.y1)}
              stroke={color}
              strokeWidth={2.4}
              strokeDasharray={duct.above ? '7 4' : undefined}
              strokeLinecap="round"
            />
          )
        })}
      </svg>
    </div>
  )
}
