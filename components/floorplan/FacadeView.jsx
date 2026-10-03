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
  roofModel,
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

function ElevationOpening({ opening, X, Y, metres }) {
  const x = X(opening.u0)
  const y = Y(opening.y1)
  const w = Math.max(2, metres(opening.u1 - opening.u0))
  const h = Math.max(2, metres(opening.y1 - opening.y0))
  const frame = Math.max(2.4, Math.min(w, h) * 0.09)
  if (opening.kind === 'window') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#f8fafc" stroke="#1c1917" strokeWidth="1.35" />
        <rect x={x + frame} y={y + frame} width={Math.max(1, w - frame * 2)} height={Math.max(1, h - frame * 2)} fill="#dbeafe" stroke="#1c1917" strokeWidth="0.95" />
        <line x1={x + frame} y1={y + h / 2} x2={x + w - frame} y2={y + h / 2} stroke="#1c1917" strokeWidth="1.05" />
        <line x1={x + w / 2} y1={y + frame} x2={x + w / 2} y2={y + h - frame} stroke="#1c1917" strokeWidth="1.05" />
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#d6d3d1" stroke="#1c1917" strokeWidth="1.4" />
      <rect x={x + frame} y={y + frame * 0.55} width={Math.max(1, w - frame * 2)} height={Math.max(1, h - frame * 1.2)} fill="#f5f5f4" stroke="#1c1917" strokeWidth="0.9" />
      <line x1={x + frame} y1={y + h * 0.38} x2={x + w - frame} y2={y + h * 0.38} stroke="#1c1917" strokeWidth="0.7" />
      <line x1={x + frame} y1={y + h * 0.68} x2={x + w - frame} y2={y + h * 0.68} stroke="#1c1917" strokeWidth="0.7" />
      <circle cx={x + w - frame * 2.1} cy={y + h * 0.52} r={Math.max(1.5, frame * 0.32)} fill="#1c1917" />
    </g>
  )
}

function FacadeHeights({ X, Y, length, wallH, ridge, openings }) {
  const windows = openings.filter((item) => item.kind === 'window')
  const marks = [{ y: 0, text: '0' }]
  if (windows.length) {
    const sill = Math.min(...windows.map((item) => item.y0))
    const head = Math.max(...windows.map((item) => item.y1))
    marks.push({ y: sill, text: formatMm(sill) })
    marks.push({ y: head, text: formatMm(head) })
  }
  marks.push({ y: wallH, text: formatMm(wallH) })
  marks.push({ y: ridge, text: formatMm(ridge) })
  const unique = []
  marks.forEach((mark) => {
    if (!unique.some((item) => Math.abs(item.y - mark.y) < 0.08)) unique.push(mark)
  })
  const x = X(length + 0.72)
  const x2 = X(length + 1.45)
  return (
    <g fill="#1c1917">
      <line x1={x} y1={Y(0)} x2={x} y2={Y(ridge)} stroke="#292524" strokeWidth={0.85} />
      <line x1={x2} y1={Y(0)} x2={x2} y2={Y(ridge)} stroke="#292524" strokeWidth={0.85} />
      {unique.map((mark) => (
        <g key={`${mark.text}-${mark.y}`}>
          <line x1={X(length)} y1={Y(mark.y)} x2={x + 4} y2={Y(mark.y)} stroke="#a8a29e" strokeWidth={0.55} />
          <line x1={x - 3.5} y1={Y(mark.y) - 3.5} x2={x + 3.5} y2={Y(mark.y) + 3.5} stroke="#292524" strokeWidth={0.8} />
          <text x={x + 7} y={Y(mark.y) + 3} fontSize="10" stroke="none">{mark.text}</text>
        </g>
      ))}
      <line x1={X(0)} y1={Y(-0.42)} x2={X(length)} y2={Y(-0.42)} stroke="#292524" strokeWidth={0.85} />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(-0.55)} stroke="#a8a29e" strokeWidth={0.55} />
      <line x1={X(length)} y1={Y(0)} x2={X(length)} y2={Y(-0.55)} stroke="#a8a29e" strokeWidth={0.55} />
      <text x={(X(0) + X(length)) / 2} y={Y(-0.42) + 12} textAnchor="middle" fontSize="10">{formatMm(length)}</text>
      <text x={x2 + 8} y={(Y(0) + Y(ridge)) / 2} fontSize="10" transform={`rotate(90 ${x2 + 8} ${(Y(0) + Y(ridge)) / 2})`}>{formatMm(ridge)}</text>
    </g>
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

  const roof = roofModel(plan)
  const gableEnd = roof.alongX ? (side === 'east' || side === 'west') : (side === 'north' || side === 'south')
  const overhang = roof.overhang
  const wallH = layout.height
  const rise = roof.type === 'flat' ? roof.rise : roof.rise
  const ridge = wallH + rise
  const contentLeft = -overhang - 0.15
  const contentRight = layout.length + overhang + 1.7
  const contentTop = ridge + 0.4
  const contentBottom = -0.85
  const worldW = contentRight - contentLeft
  const worldH = contentTop - contentBottom
  const pageW = 420
  const pageH = 297
  const margin = 12
  const titleW = 84
  const titleH = 54
  const frame = { x: margin, y: margin, w: pageW - margin * 2, h: pageH - margin * 2 }
  const drawW = frame.w - titleW - 8
  const drawH = frame.h - 16
  const ratio = worldW * 20 <= drawW && worldH * 20 <= drawH ? 50 : 100
  const mm = 1000 / ratio
  const oxMm = frame.x + 8 + Math.max(0, (drawW - worldW * mm) / 2)
  const oyMm = frame.y + 8 + Math.max(0, (drawH - worldH * mm) / 2)
  const sheetPad = 12
  const availW = Math.max(280, size.w - sheetPad * 2)
  const availH = Math.max(200, size.h - sheetPad * 2)
  let sheetW = availW
  let sheetH = sheetW / (pageW / pageH)
  if (sheetH > availH) {
    sheetH = availH
    sheetW = sheetH * (pageW / pageH)
  }
  const sheet = { x: (size.w - sheetW) / 2, y: (size.h - sheetH) / 2, w: sheetW, h: sheetH, k: sheetW / pageW }
  const k = sheet.k
  const X = (u) => sheet.x + (oxMm + (u - contentLeft) * mm) * k
  const Y = (y) => sheet.y + (oyMm + (contentTop - y) * mm) * k
  const metres = (value) => value * mm * k
  const toFacade = (event) => {
    const rect = hostRef.current.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    return {
      u: contentLeft + ((px - sheet.x) / k - oxMm) / mm,
      y: contentTop - ((py - sheet.y) / k - oyMm) / mm,
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
          style={{ display: 'block', background: '#d6d3d1', touchAction: 'none', cursor: tool === 'rect' ? 'crosshair' : 'default' }}
        >
          <PatternDefs />
          <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fbfaf7" stroke="#1c1917" strokeWidth={1.3} />
          <rect x={sheet.x + 4} y={sheet.y + 4} width={sheet.w - 8} height={sheet.h - 8} fill="none" stroke="#a8a29e" strokeWidth={0.6} />
          <line x1={X(-overhang - 0.8)} y1={Y(-0.06)} x2={X(layout.length + overhang + 1.1)} y2={Y(-0.06)} stroke="#44403c" strokeWidth={2.4} />
          <line x1={X(-overhang - 0.35)} y1={Y(0)} x2={X(layout.length + overhang + 0.45)} y2={Y(0)} stroke="#1c1917" strokeWidth={1.3} />
          {paints.filter((piece) => piece.materialId && piece.y1 > 0.3).map((piece, index) => {
            const y0 = Math.max(piece.y0, 0.3)
            return (
              <rect
                key={`${piece.wallId}-${index}-${piece.y0}`}
                x={X(piece.u0)}
                y={Y(piece.y1)}
                width={Math.max(0, metres(piece.u1 - piece.u0))}
                height={Math.max(0, metres(piece.y1 - y0))}
                fill={`url(#clad-${claddingOf(piece.materialId).id})`}
                stroke="#44403c"
                strokeWidth="0.35"
              />
            )
          })}
          <rect x={X(0)} y={Y(0.3)} width={metres(layout.length)} height={metres(0.3)} fill="#9ca3af" stroke="#1c1917" strokeWidth={0.9} />
          {gableEnd ? (
            <polygon
              points={`${X(-overhang)},${Y(wallH)} ${X(layout.length / 2)},${Y(ridge)} ${X(layout.length + overhang)},${Y(wallH)}`}
              fill="#e7e5e4"
              stroke="#1c1917"
              strokeWidth={1.2}
              strokeLinejoin="miter"
            />
          ) : (
            <g>
              <polygon
                points={`${X(-overhang)},${Y(wallH)} ${X(layout.length + overhang)},${Y(wallH)} ${X(layout.length + overhang)},${Y(ridge)} ${X(-overhang)},${Y(ridge)}`}
                fill="#e7e5e4"
                stroke="#1c1917"
                strokeWidth={1.15}
              />
              <line x1={X(-overhang)} y1={Y(ridge)} x2={X(layout.length + overhang)} y2={Y(ridge)} stroke="#1c1917" strokeWidth={1.5} />
            </g>
          )}
          <rect x={X(-overhang)} y={Y(wallH)} width={metres(layout.length + overhang * 2)} height={metres(0.14)} fill="#d6d3d1" stroke="#1c1917" strokeWidth={0.8} />
          {layout.openings.map((opening) => (
            <ElevationOpening key={opening.id} opening={opening} X={X} Y={Y} metres={metres} />
          ))}
          {draft && cursor && (
            <rect
              x={X(Math.min(draft.u, cursor.u))}
              y={Y(Math.max(draft.y, cursor.y))}
              width={metres(Math.abs(cursor.u - draft.u))}
              height={metres(Math.abs(cursor.y - draft.y))}
              fill="#0f766e33"
              stroke="#0f766e"
              strokeDasharray="4 3"
            />
          )}
          <FacadeHeights X={X} Y={Y} metres={metres} length={layout.length} wallH={wallH} ridge={ridge} openings={layout.openings} />
          <g data-testid="facade-legend">
            {areas.map((row, index) => (
              <g key={row.id} transform={`translate(${sheet.x + 18} ${sheet.y + 18 + index * 16})`}>
                <rect width="14" height="10" fill={`url(#clad-${row.item.id})`} stroke="#44403c" strokeWidth="0.5" />
                <text x="18" y="9" fontSize="11" fill="#1c1917">{row.item.name} {formatArea(row.area)}</text>
              </g>
            ))}
          </g>
          <g data-testid="facade-title">
            <rect x={sheet.x + (frame.x + frame.w - titleW - 2) * k} y={sheet.y + (frame.y + frame.h - titleH - 2) * k} width={titleW * k} height={titleH * k} fill="#fff" stroke="#1c1917" strokeWidth={1} />
            <text x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 14) * k} fontSize="13" fontWeight="750" fill="#1c1917">Julkisivu {layout.name}</text>
            <text x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 30) * k} fontSize="11" fill="#292524">Mittakaava 1:{ratio}</text>
            <text x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 44) * k} fontSize="11" fill="#292524">{roof.type === 'gable' ? 'Harjakatto' : roof.type === 'hip' ? 'Aumakatto' : roof.type === 'shed' ? 'Pulpettikatto' : 'Tasakatto'}</text>
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
