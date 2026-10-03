'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CLADDING,
  FACADE_SIDES,
  addFacadeBand,
  addFacadeZone,
  applyBrickBelowWoodAbove,
  applyFacadePreset,
  buildElevationPdf,
  claddingOf,
  deleteFacadeZone,
  facadeLayout,
  facadePaints,
  formatArea,
  formatMm,
  updateFacadeZone,
} from '@/lib/floorplan'

const inputStyle = {
  padding: '5px 8px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  fontSize: 12,
  background: '#fff',
  color: '#1c1917',
}

function PatternDefs() {
  return (
    <defs>
      {CLADDING.map((item) => {
        const line = 'rgba(40,24,16,0.45)'
        if (item.pattern === 'brick') {
          return (
            <pattern key={item.id} id={`clad-${item.id}`} width="16" height="8" patternUnits="userSpaceOnUse">
              <rect width="16" height="8" fill={item.color} />
              <path d="M0 4 H16 M0 0 V4 M8 4 V8 M0 8 H16" fill="none" stroke={line} strokeWidth="0.7" />
            </pattern>
          )
        }
        if (item.pattern === 'boards-h') {
          return (
            <pattern key={item.id} id={`clad-${item.id}`} width="8" height="6" patternUnits="userSpaceOnUse">
              <rect width="8" height="6" fill={item.color} />
              <path d="M0 6 H8" stroke={line} strokeWidth="0.8" />
            </pattern>
          )
        }
        if (item.pattern === 'boards-v' || item.pattern === 'batten') {
          return (
            <pattern key={item.id} id={`clad-${item.id}`} width={item.pattern === 'batten' ? '14' : '7'} height="12" patternUnits="userSpaceOnUse">
              <rect width={item.pattern === 'batten' ? '14' : '7'} height="12" fill={item.color} />
              <path d={item.pattern === 'batten' ? 'M2 0 V12 M12 0 V12' : 'M7 0 V12'} stroke={line} strokeWidth={item.pattern === 'batten' ? '1.4' : '0.7'} />
            </pattern>
          )
        }
        if (item.pattern === 'stone') {
          return (
            <pattern key={item.id} id={`clad-${item.id}`} width="18" height="12" patternUnits="userSpaceOnUse">
              <rect width="18" height="12" fill={item.color} />
              <path d="M0 6 H18 M0 0 V6 M9 6 V12 M4 0 V6 M14 6 V12" fill="none" stroke={line} strokeWidth="0.6" />
            </pattern>
          )
        }
        if (item.pattern === 'board') {
          return (
            <pattern key={item.id} id={`clad-${item.id}`} width="22" height="16" patternUnits="userSpaceOnUse">
              <rect width="22" height="16" fill={item.color} />
              <path d="M0 16 H22 M22 0 V16" fill="none" stroke={line} strokeWidth="0.7" />
            </pattern>
          )
        }
        return (
          <pattern key={item.id} id={`clad-${item.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={item.color} />
            <circle cx="2" cy="3" r="0.5" fill="rgba(80,60,40,0.25)" />
            <circle cx="6" cy="6" r="0.5" fill="rgba(80,60,40,0.25)" />
          </pattern>
        )
      })}
    </defs>
  )
}

export default function FacadeView({ plan, side, onSide, onApply, onCommit }) {
  const hostRef = useRef(null)
  const [size, setSize] = useState({ w: 900, h: 640 })
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [tool, setTool] = useState('select')
  const [menu, setMenu] = useState(null)
  const [band, setBand] = useState({ y0: 0, y1: 900, materialId: 'brick-red' })
  const layout = facadeLayout(plan, side)
  const paints = facadePaints(plan, side)

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

  const pad = 56
  const scale = Math.min((size.w - pad * 2) / layout.length, (size.h - pad * 2) / Math.max(layout.height, 0.1))
  const ox = (size.w - layout.length * scale) / 2
  const base = (size.h + layout.height * scale) / 2
  const X = (u) => ox + u * scale
  const Y = (y) => base - y * scale
  const toFacade = (event) => {
    const rect = hostRef.current.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    return {
      u: Math.max(0, Math.min(layout.length, (px - ox) / scale)),
      y: Math.max(0, Math.min(layout.height, (base - py) / scale)),
    }
  }
  const hitZone = (point) => {
    const zones = [...(layout.zones || [])].reverse()
    return zones.find((zone) => point.u >= zone.u0 && point.u <= zone.u1 && point.y >= zone.y0 && point.y <= zone.y1) || null
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    setMenu(null)
    const point = toFacade(event)
    if (tool === 'rect') {
      setDraft(point)
      return
    }
    setMenu(null)
  }
  const onPointerMove = (event) => {
    const point = toFacade(event)
    setCursor(point)
  }
  const onPointerUp = (event) => {
    if (!draft || tool !== 'rect') return
    const point = toFacade(event)
    onCommit(addFacadeZone(plan, side, { u0: draft.u, u1: point.u, y0: draft.y, y1: point.y, materialId: 'wood-horizontal' }))
    setDraft(null)
    setTool('select')
  }

  const areas = []
  paints.forEach((piece) => {
    if (!piece.materialId) return
    const area = (piece.u1 - piece.u0) * (piece.y1 - piece.y0)
    const found = areas.find((row) => row.id === piece.materialId)
    if (found) found.area += area
    else areas.push({ id: piece.materialId, area, item: claddingOf(piece.materialId) })
  })

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#d6d3d1' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
        {FACADE_SIDES.map((item) => (
          <button key={item.id} type="button" data-testid={`facade-side-${item.id}`} onClick={() => onSide(item.id)} style={chip(side === item.id)}>{item.name}</button>
        ))}
        <button type="button" data-testid="facade-preset-above" style={chip(false)} onClick={() => onCommit(applyFacadePreset(plan, side, 'above'))}>Yläpuolinen vyöhyke</button>
        <button type="button" data-testid="facade-preset-plinth" style={chip(false)} onClick={() => onCommit(applyFacadePreset(plan, side, 'plinth'))}>Sokkelivyöhyke</button>
        <button type="button" data-testid="facade-preset-band" style={chip(false)} onClick={() => onCommit(applyFacadePreset(plan, side, 'band'))}>Ikkunanauha</button>
        <button type="button" data-testid="facade-brick-wood" style={chip(false)} onClick={() => onCommit(applyBrickBelowWoodAbove(plan, side))}>Tiili alle, puu päälle</button>
        <button type="button" data-testid="facade-rect" style={chip(tool === 'rect')} onClick={() => setTool(tool === 'rect' ? 'select' : 'rect')}>Suorakulmio</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>mm</span>
          <input aria-label="Vyöhykkeen alareuna" style={{ ...inputStyle, width: 64 }} type="number" value={band.y0} onChange={(event) => setBand({ ...band, y0: Number(event.target.value) })} />
          <span>–</span>
          <input aria-label="Vyöhykkeen yläreuna" style={{ ...inputStyle, width: 64 }} type="number" value={band.y1} onChange={(event) => setBand({ ...band, y1: Number(event.target.value) })} />
          <select style={inputStyle} value={band.materialId} onChange={(event) => setBand({ ...band, materialId: event.target.value })}>
            {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" data-testid="facade-band" style={chip(false)} onClick={() => onCommit(addFacadeBand(plan, side, band.y0 / 1000, band.y1 / 1000, band.materialId))}>Vaakavyöhyke</button>
        </label>
        <button type="button" data-testid="facade-pdf" style={chip(false)} onClick={() => buildElevationPdf(plan, side).save(`julkisivu-${side}.pdf`)}>PDF</button>
        <button type="button" data-testid="facade-pdf-all" style={chip(false)} onClick={() => buildElevationPdf(plan, 'all').save('julkisivut.pdf')}>Kaikki sivut</button>
      </div>
      <div ref={hostRef} data-testid="facade-view" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          width="100%"
          height="100%"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={(event) => {
            event.preventDefault()
            const point = toFacade(event)
            const zone = hitZone(point)
            setMenu({ kind: zone ? 'zone' : 'facade', id: zone?.id, x: event.clientX, y: event.clientY, at: point })
          }}
          style={{ display: 'block', background: '#fbfaf7', touchAction: 'none', cursor: tool === 'rect' ? 'crosshair' : 'default' }}
        >
          <PatternDefs />
          <text x={ox} y={Y(layout.height) - 16} fontSize="14" fontWeight="700" fill="#1c1917">Julkisivu {layout.name}</text>
          {paints.filter((piece) => piece.materialId).map((piece, index) => (
            <rect
              key={`${piece.wallId}-${index}-${piece.y0}`}
              x={X(piece.u0)}
              y={Y(piece.y1)}
              width={Math.max(0, (piece.u1 - piece.u0) * scale)}
              height={Math.max(0, (piece.y1 - piece.y0) * scale)}
              fill={`url(#clad-${claddingOf(piece.materialId).id})`}
              stroke="#44403c"
              strokeWidth="0.4"
            />
          ))}
          {layout.openings.map((opening) => (
            <g key={opening.id}>
              <rect
                x={X(opening.u0)}
                y={Y(opening.y1)}
                width={(opening.u1 - opening.u0) * scale}
                height={(opening.y1 - opening.y0) * scale}
                fill="#f8fafc"
                stroke="#1c1917"
                strokeWidth="1.3"
              />
              {opening.kind === 'window' && (
                <g stroke="#1c1917" strokeWidth="0.8">
                  <line x1={X(opening.u0)} y1={Y((opening.y0 + opening.y1) / 2)} x2={X(opening.u1)} y2={Y((opening.y0 + opening.y1) / 2)} />
                  <line x1={X((opening.u0 + opening.u1) / 2)} y1={Y(opening.y0)} x2={X((opening.u0 + opening.u1) / 2)} y2={Y(opening.y1)} />
                </g>
              )}
            </g>
          ))}
          {draft && cursor && (
            <rect
              x={X(Math.min(draft.u, cursor.u))}
              y={Y(Math.max(draft.y, cursor.y))}
              width={Math.abs(cursor.u - draft.u) * scale}
              height={Math.abs(cursor.y - draft.y) * scale}
              fill="#0f766e33"
              stroke="#0f766e"
              strokeDasharray="4 3"
            />
          )}
          <line x1={X(0)} y1={Y(0)} x2={X(layout.length)} y2={Y(0)} stroke="#1c1917" strokeWidth="1.2" />
          <text x={(X(0) + X(layout.length)) / 2} y={Y(0) + 16} textAnchor="middle" fontSize="11" fill="#1c1917">{formatMm(layout.length)}</text>
          <text x={X(layout.length) + 8} y={(Y(0) + Y(layout.height)) / 2} fontSize="11" fill="#1c1917" transform={`rotate(90 ${X(layout.length) + 8} ${(Y(0) + Y(layout.height)) / 2})`}>{formatMm(layout.height)}</text>
          <g data-testid="facade-legend">
            {areas.map((row, index) => (
              <g key={row.id} transform={`translate(${ox} ${Y(0) + 28 + index * 16})`}>
                <rect width="14" height="10" fill={`url(#clad-${row.item.id})`} stroke="#44403c" strokeWidth="0.5" />
                <text x="18" y="9" fontSize="11" fill="#1c1917">{row.item.name} {formatArea(row.area)}</text>
              </g>
            ))}
          </g>
        </svg>
        {menu && (
          <div
            data-testid="facade-menu"
            style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 280), zIndex: 60, width: 220, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{menu.kind === 'zone' ? 'Vyöhyke' : 'Julkisivu'}</div>
            {menu.kind === 'zone' && (
              <>
                <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
                  Materiaali
                  <select
                    data-testid="facade-zone-material"
                    style={{ ...inputStyle, width: '100%', marginTop: 4 }}
                    value={(plan.facades || []).find((zone) => zone.id === menu.id)?.materialId || 'brick-red'}
                    onChange={(event) => onApply(updateFacadeZone(plan, menu.id, { materialId: event.target.value }))}
                  >
                    {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
                  </select>
                </label>
                <button type="button" data-testid="facade-zone-delete" onClick={() => { onCommit(deleteFacadeZone(plan, menu.id)); setMenu(null) }} style={menuBtn}>Poista</button>
              </>
            )}
            {menu.kind === 'facade' && (
              <>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'above')); setMenu(null) }}>Aukkojen yläpuolinen vyöhyke</button>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'plinth')); setMenu(null) }}>Ikkunoiden alapuolinen sokkeli</button>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'band')); setMenu(null) }}>Ikkunanauha</button>
                <button type="button" style={menuBtn} onClick={() => { setTool('rect'); setMenu(null) }}>Piirrä suorakulmio</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function chip(active) {
  return {
    height: 28,
    padding: '0 8px',
    borderRadius: 8,
    border: '1px solid #d6d3d1',
    background: active ? '#134e4a' : '#fff',
    color: active ? '#ccfbf1' : '#1c1917',
    fontSize: 12,
    fontWeight: 650,
    cursor: 'pointer',
    transform: 'none',
  }
}

const menuBtn = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  border: 'none',
  background: 'transparent',
  color: '#1c1917',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
  transform: 'none',
}
