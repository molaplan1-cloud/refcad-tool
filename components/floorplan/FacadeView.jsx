'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlanLocale } from '@/components/i18n/Locale'
import { finishesOf } from '@/lib/finishes'
import { ensureYard, terraceFacade } from '@/lib/yard'
import { text } from '@/lib/i18n'
import { northAngle, sideCompass } from '@/lib/orientation'
import {
  CLADDING,
  FACADE_SIDES,
  addFacadeBand,
  addFacadeSplit,
  addFacadeZone,
  applyBrickBelowWoodAbove,
  applyFacadePreset,
  assignFacadeCell,
  buildElevationPdf,
  claddingOf,
  deleteFacadeZone,
  facadeCells,
  facadeFlashings,
  facadeLayout,
  facadePaints,
  mergeFacadeRects,
  formatArea,
  formatMm,
  openingColour,
  plinthLook,
  roofLook,
  roofModel,
  surfaceLook,
} from '@/lib/floorplan'

const inputStyle = {
  padding: '5px 8px',
  borderRadius: 8,
  border: '1px solid #d6d3d1',
  fontSize: 12,
  background: '#fff',
  color: '#1c1917',
}

function patternNode(look) {
  const line = look.painted ? 'rgba(70,50,40,0.32)' : 'rgba(40,24,16,0.45)'
  const pid = `clad-${look.key}`
  if (look.pattern === 'brick') {
    return (
      <pattern key={look.key} id={pid} width="16" height="8" patternUnits="userSpaceOnUse">
        <rect width="16" height="8" fill={look.color} />
        <path d="M0 4 H16 M0 0 V4 M8 4 V8 M0 8 H16" fill="none" stroke={look.mortar || line} strokeWidth={look.painted ? '0.45' : '0.7'} />
      </pattern>
    )
  }
  if (look.pattern === 'boards-h') {
    const band = Math.max(4, Math.min(14, (look.boardWidthMm || 145) / 18))
    return (
      <pattern key={look.key} id={pid} width="8" height={band} patternUnits="userSpaceOnUse">
        <rect width="8" height={band} fill={look.color} />
        <path d={`M0 ${band} H8`} stroke={line} strokeWidth="0.8" />
      </pattern>
    )
  }
  if (look.pattern === 'boards-v' || look.pattern === 'batten') {
    const band = Math.max(6, Math.min(16, (look.boardWidthMm || 145) / 16))
    return (
      <pattern key={look.key} id={pid} width={band} height="12" patternUnits="userSpaceOnUse">
        <rect width={band} height="12" fill={look.color} />
        <path d={`M${band} 0 V12`} stroke={line} strokeWidth={look.pattern === 'batten' ? '1.4' : '0.7'} />
      </pattern>
    )
  }
  if (look.pattern === 'stone') {
    return (
      <pattern key={look.key} id={pid} width="18" height="12" patternUnits="userSpaceOnUse">
        <rect width="18" height="12" fill={look.color} />
        <path d="M0 6 H18 M0 0 V6 M9 6 V12 M4 0 V6 M14 6 V12" fill="none" stroke={line} strokeWidth="0.6" />
      </pattern>
    )
  }
  if (look.pattern === 'board') {
    return (
      <pattern key={look.key} id={pid} width="22" height="16" patternUnits="userSpaceOnUse">
        <rect width="22" height="16" fill={look.color} />
        <path d="M0 16 H22 M22 0 V16" fill="none" stroke={line} strokeWidth="0.7" />
      </pattern>
    )
  }
  if (look.pattern === 'concrete') {
    return (
      <pattern key={look.key} id={pid} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={look.color} />
        <circle cx="2" cy="3" r="0.6" fill="rgba(0,0,0,0.18)" />
        <circle cx="7" cy="7" r="0.5" fill="rgba(255,255,255,0.25)" />
      </pattern>
    )
  }
  return (
    <pattern key={look.key} id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill={look.color} />
      <circle cx="2" cy="3" r="0.5" fill="rgba(80,60,40,0.25)" />
      <circle cx="6" cy="6" r="0.5" fill="rgba(80,60,40,0.25)" />
    </pattern>
  )
}

function ElevationOpening({ opening, X, Y, metres, colour, trim, technical }) {
  const x = X(opening.u0)
  const y = Y(opening.y1)
  const w = Math.max(2, metres(opening.u1 - opening.u0))
  const h = Math.max(2, metres(opening.y1 - opening.y0))
  const frame = Math.max(2.4, Math.min(w, h) * 0.09)
  const casing = Math.max(1.6, frame * 0.55)
  const face = technical ? '#f8fafc' : colour
  const board = technical ? '#f8fafc' : trim
  if (opening.kind === 'passage') {
    return (
      <g data-testid="facade-passage" data-lintel={opening.lintel ? '1' : '0'}>
        <rect x={x} y={y} width={w} height={h} fill="#f8fafc" stroke="#1c1917" strokeWidth="0.8" />
        <line x1={x} y1={y} x2={x} y2={y + h} stroke="#1c1917" strokeWidth="0.6" />
        <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke="#1c1917" strokeWidth="0.6" />
        {opening.lintel && <rect data-testid="facade-lintel" x={x - 2} y={y - Math.max(4, h * 0.08)} width={w + 4} height={Math.max(4, h * 0.08)} fill={board} stroke="#1c1917" strokeWidth="0.7" />}
      </g>
    )
  }
  if (opening.kind === 'window') {
    return (
      <g data-testid="facade-window">
        <rect x={x - casing} y={y - casing} width={w + casing * 2} height={h + casing * 2} fill={board} stroke="#1c1917" strokeWidth="0.7" />
        <rect x={x} y={y} width={w} height={h} fill={face} stroke="#1c1917" strokeWidth="1.35" />
        <rect x={x + frame} y={y + frame} width={Math.max(1, w - frame * 2)} height={Math.max(1, h - frame * 2)} fill="#dbeafe" stroke="#1c1917" strokeWidth="0.95" />
        <line x1={x + frame} y1={y + h / 2} x2={x + w - frame} y2={y + h / 2} stroke="#1c1917" strokeWidth="1.05" />
        <line x1={x + w / 2} y1={y + frame} x2={x + w / 2} y2={y + h - frame} stroke="#1c1917" strokeWidth="1.05" />
      </g>
    )
  }
  return (
    <g data-testid="facade-door">
      <rect x={x - casing} y={y - casing * 0.4} width={w + casing * 2} height={h + casing} fill={board} stroke="#1c1917" strokeWidth="0.7" />
      <rect x={x} y={y} width={w} height={h} fill={face} stroke="#1c1917" strokeWidth="1.4" />
      <rect x={x + frame} y={y + frame * 0.55} width={Math.max(1, w - frame * 2)} height={Math.max(1, h - frame * 1.2)} fill={technical ? '#f5f5f4' : '#f5f0e8'} stroke="#1c1917" strokeWidth="0.9" />
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
  if (ridge - wallH > 0.12) marks.push({ y: ridge, text: formatMm(ridge) })
  const unique = []
  marks.forEach((mark) => {
    if (!unique.some((item) => Math.abs(item.y - mark.y) < 0.08 || item.text === mark.text)) unique.push(mark)
  })
  const x = X(length + 0.72)
  return (
    <g fill="#1c1917">
      <line x1={x} y1={Y(0)} x2={x} y2={Y(ridge)} stroke="#292524" strokeWidth={0.85} />
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
    </g>
  )
}

function FacadeTerrace({ view, X, Y, metres }) {
  const deckColor = view.material === 'concrete' ? '#a8a29e' : view.material === 'paving' ? '#d6d3d1' : '#c4a574'
  const width = Math.max(0.2, view.u1 - view.u0)
  const underside = view.deckY - view.thickness
  const sunken = view.deckY < view.groundY - 0.02
  const raised = underside > view.groundY + 0.03
  const railY = Math.max(view.deckY, view.groundY) + 1
  return (
    <g data-testid="facade-terrace" data-level={view.label}>
      {sunken && (
        <rect x={X(view.u0)} y={Y(view.groundY)} width={metres(width)} height={metres(view.groundY - underside)} fill="#d6d3d1" stroke="#1c1917" strokeWidth={0.7} />
      )}
      {raised && view.supports.kind === 'plinth' && (
        <rect x={X(view.u0)} y={Y(underside)} width={metres(width)} height={metres(underside - view.groundY)} fill="#a8a29e" stroke="#1c1917" strokeWidth={0.6} />
      )}
      {raised && view.supports.kind === 'posts' && [0.12, 0.88].map((t) => (
        <line key={t} data-testid="facade-post" x1={X(view.u0 + width * t)} y1={Y(view.groundY)} x2={X(view.u0 + width * t)} y2={Y(underside)} stroke="#57534e" strokeWidth={2.2} />
      ))}
      <rect data-testid="facade-deck" x={X(view.u0)} y={Y(view.deckY)} width={metres(width)} height={metres(view.thickness)} fill={deckColor} stroke="#1c1917" strokeWidth={0.9} />
      {view.steps.enabled && (
        <g data-testid="facade-terrace-steps" data-count={view.steps.count}>
          {view.steps.treads.map((tread, index) => {
            const u = (view.u0 + view.u1) / 2
            const half = view.steps.width / 2
            return <line key={index} x1={X(u - half)} y1={Y(tread.top)} x2={X(u + half)} y2={Y(tread.top)} stroke="#1c1917" strokeWidth={1.15} />
          })}
        </g>
      )}
      {view.railing && <line data-testid="facade-railing" x1={X(view.u0 + 0.08)} y1={Y(railY)} x2={X(view.u1 - 0.08)} y2={Y(railY)} stroke="#1c1917" strokeWidth={1.4} />}
      <text data-testid="facade-terrace-level" data-level={view.label} x={X((view.u0 + view.u1) / 2)} y={Y(Math.min(view.deckY, view.groundY) - view.thickness - 0.22)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c1917">{view.label}</text>
    </g>
  )
}

function RoofElevation({ X, Y, metres, length, wallH, ridge, overhang, gableEnd, roofType, roofId, fill, edge, fascia, gutter, pattern }) {
  const style = { fill: fill || '#9aa6b2', edge: edge || '#1e293b', fascia: fascia || '#f4f1ea' }
  const tiled = pattern === 'tile' || pattern === 'tile-metal' || roofId === 'tile' || roofId === 'clay-tile' || roofId === 'concrete-tile'
  const left = -overhang
  const right = length + overhang
  const mid = length / 2
  const fasciaH = 0.16
  const flat = roofType === 'flat' || ridge - wallH < 0.2
  const courses = []
  for (let y = wallH + (tiled ? 0.18 : 0.28); y < ridge - 0.05; y += tiled ? 0.16 : 0.32) courses.push(y)
  const seams = []
  const step = tiled ? 0.42 : pattern === 'corrugated' ? 0.28 : 0.55
  for (let u = left + step * 0.5; u < right - 0.15; u += step) seams.push(u)
  const gutterBar = (key) => (
    <rect key={key} x={X(left)} y={Y(wallH - fasciaH)} width={metres(right - left)} height={metres(0.07)} fill={gutter || '#383E42'} stroke="#1c1917" strokeWidth={0.6} />
  )

  if (flat) {
    return (
      <g data-testid="facade-roof">
        <rect x={X(left)} y={Y(wallH + 0.18)} width={metres(right - left)} height={metres(0.18)} fill={style.fill} stroke={style.edge} strokeWidth={1.1} />
        <rect x={X(left)} y={Y(wallH)} width={metres(right - left)} height={metres(fasciaH)} fill={style.fascia} stroke={style.edge} strokeWidth={0.9} />
        {gutterBar('flat')}
        <line x1={X(left)} y1={Y(wallH)} x2={X(right)} y2={Y(wallH)} stroke="#f8fafc" strokeWidth={0.7} />
      </g>
    )
  }

  if (!gableEnd) {
    return (
      <g data-testid="facade-roof">
        <polygon
          points={`${X(left)},${Y(wallH)} ${X(right)},${Y(wallH)} ${X(right)},${Y(ridge)} ${X(left)},${Y(ridge)}`}
          fill={style.fill}
          stroke={style.edge}
          strokeWidth={1.15}
        />
        {tiled
          ? courses.map((y) => <line key={y} x1={X(left)} y1={Y(y)} x2={X(right)} y2={Y(y)} stroke={style.edge} strokeWidth={0.9} />)
          : seams.map((u) => <line key={u} x1={X(u)} y1={Y(wallH + 0.02)} x2={X(u)} y2={Y(ridge - 0.05)} stroke={style.edge} strokeWidth={pattern === 'seam' || pattern === 'corrugated' ? 1.15 : 0.7} />)}
        <rect x={X(left)} y={Y(ridge)} width={metres(right - left)} height={metres(0.07)} fill={style.edge} />
        <line x1={X(left)} y1={Y(ridge)} x2={X(right)} y2={Y(ridge)} stroke="#f8fafc" strokeWidth={0.8} />
        <rect x={X(left)} y={Y(wallH)} width={metres(right - left)} height={metres(fasciaH)} fill={style.fascia} stroke={style.edge} strokeWidth={0.9} />
        {gutterBar('eave')}
        <line x1={X(left)} y1={Y(wallH)} x2={X(right)} y2={Y(wallH)} stroke="#e2e8f0" strokeWidth={0.8} />
        <line x1={X(left)} y1={Y(wallH - fasciaH)} x2={X(right)} y2={Y(wallH - fasciaH)} stroke={gutter || style.edge} strokeWidth={1.4} />
      </g>
    )
  }

  const inset = (ax, ay, bx, by, dist) => {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const ox = (dy / len) * dist
    const oy = (-dx / len) * dist
    return [ax + ox, ay + oy, bx + ox, by + oy]
  }
  const barge = 0.12
  const leftBarge = inset(left, wallH, mid, ridge, barge)
  const rightBarge = inset(mid, ridge, right, wallH, barge)
  const clip = `${X(left)},${Y(wallH)} ${X(mid)},${Y(ridge)} ${X(right)},${Y(wallH)}`
  return (
    <g data-testid="facade-roof">
      <defs>
        <clipPath id="facade-roof-clip">
          <polygon points={clip} />
        </clipPath>
      </defs>
      <polygon points={clip} fill={style.fill} stroke={style.edge} strokeWidth={1.25} strokeLinejoin="miter" />
      <g clipPath="url(#facade-roof-clip)">
        {courses.map((y) => <line key={y} x1={X(left)} y1={Y(y)} x2={X(right)} y2={Y(y)} stroke={style.edge} strokeWidth={0.9} />)}
      </g>
      <line x1={X(leftBarge[0])} y1={Y(leftBarge[1])} x2={X(leftBarge[2])} y2={Y(leftBarge[3])} stroke={style.fascia} strokeWidth={2.4} />
      <line x1={X(rightBarge[0])} y1={Y(rightBarge[1])} x2={X(rightBarge[2])} y2={Y(rightBarge[3])} stroke={style.fascia} strokeWidth={2.4} />
      <line x1={X(left)} y1={Y(wallH)} x2={X(mid)} y2={Y(ridge)} stroke={style.edge} strokeWidth={1.35} />
      <line x1={X(mid)} y1={Y(ridge)} x2={X(right)} y2={Y(wallH)} stroke={style.edge} strokeWidth={1.35} />
      <line x1={X(left)} y1={Y(wallH)} x2={X(right)} y2={Y(wallH)} stroke={style.edge} strokeWidth={1.2} />
    </g>
  )
}

export default function FacadeView({ plan, side, onSide, onApply, onCommit, onSelect, selected }) {
  const { t, locale } = usePlanLocale(plan)
  const north = northAngle(plan)
  const hostRef = useRef(null)
  const [size, setSize] = useState({ w: 900, h: 640 })
  const [draft, setDraft] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [tool, setTool] = useState('select')
  const [menu, setMenu] = useState(null)
  const [ribbon, setRibbon] = useState(null)
  const [band, setBand] = useState({ y0: 0, y1: 900, materialId: 'brick-red' })
  const layout = facadeLayout(plan, side)
  const paints = facadePaints(plan, side)
  const finish = finishesOf(plan)
  const plinth = plinthLook(plan)
  const roofFace = roofLook(plan)
  const realistic = finish.sceneStyle !== 'technical'

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
  const rise = roof.rise
  const ridge = Math.round((wallH + rise) * 100) / 100
  const terraceViews = ensureYard(plan).terraces.map((item) => terraceFacade(plan, item, side)).filter(Boolean)
  const contentLeft = -overhang - 0.15
  const contentRight = layout.length + overhang + 1.7
  const contentTop = ridge + 0.4
  const contentBottom = terraceViews.reduce((min, view) => Math.min(min, view.deckY - view.thickness - 0.85), -0.85)
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
  const onPointerDown = (event) => {
    if (event.button !== 0) return
    setMenu(null)
    const point = toFacade(event)
    if (tool === 'rect') {
      setDraft(point)
      return
    }
    if (tool === 'split-h' || tool === 'split-v') {
      onCommit(addFacadeSplit(plan, side, tool === 'split-v' ? 'v' : 'h', tool === 'split-v' ? point.u : point.y))
      return
    }
    const cell = [...facadeCells(plan, side)].reverse().find((item) => point.u >= item.u0 && point.u <= item.u1 && point.y >= item.y0 && point.y <= item.y1)
    if (cell) onSelect?.(cell)
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
  const svgKey = (look) => `${look.id}-${look.color}-${look.pattern}${look.painted ? '-p' : ''}`.replace(/[^a-z0-9-]+/gi, '')
  const visiblePaints = paints.filter((piece) => piece.materialId && piece.y1 > plinth.height).map((piece) => {
    const look = surfaceLook(plan, piece.materialId, { color: piece.color, colorCode: piece.colorCode })
    return { ...piece, y0: Math.max(piece.y0, plinth.height), look, key: svgKey(look) }
  })
  visiblePaints.forEach((piece) => {
    const area = (piece.u1 - piece.u0) * (piece.y1 - piece.y0)
    const found = areas.find((row) => row.key === piece.key)
    if (found) found.area += area
    else areas.push({ key: piece.key, id: piece.materialId, area, item: claddingOf(piece.materialId), look: piece.look })
  })
  const patternLooks = []
  visiblePaints.forEach((piece) => {
    if (!patternLooks.some((item) => item.key === piece.key)) patternLooks.push({ ...piece.look, key: piece.key })
  })
  patternLooks.push({ ...plinth, id: 'plinth', key: 'plinth', painted: false, mortar: plinth.color, boardWidthMm: 145 })

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#d6d3d1' }}>
      <div data-testid="facade-toolbar" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', overflow: 'visible', minHeight: 40, padding: '4px 10px', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4' }}>
        {FACADE_SIDES.map((item) => {
          const code = sideCompass(item.id, north)
          const name = t(`compass.${code}`)
          return (
            <button key={item.id} type="button" data-testid={`facade-side-${item.id}`} data-compass={code} title={`${code} ${name}`} onClick={() => onSide(item.id)} style={chip(side === item.id)}>{code}</button>
          )
        })}
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" data-testid="facade-presets" title={t('facade.above')} style={chip(ribbon === 'preset')} onClick={() => setRibbon(ribbon === 'preset' ? null : 'preset')}>Vyöhykkeet</button>
          {ribbon === 'preset' && (
            <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 20, minWidth: 220, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <button type="button" data-testid="facade-preset-plinth" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'plinth')); setRibbon(null) }}>{t('facade.plinth')}</button>
              <button type="button" data-testid="facade-brick-wood" style={menuBtn} onClick={() => { onCommit(applyBrickBelowWoodAbove(plan, side)); setRibbon(null) }}>{t('facade.brickWood')}</button>
              <button type="button" data-testid="facade-rect" style={menuBtn} onClick={() => { setTool(tool === 'rect' ? 'select' : 'rect'); setRibbon(null) }}>{t('facade.rect')}</button>
            </div>
          )}
        </span>
        <button type="button" data-testid="facade-preset-above" style={chip(false)} onClick={() => onCommit(applyFacadePreset(plan, side, 'above', 'wood-horizontal'))}>{t('facade.above')}</button>
        <button type="button" data-testid="facade-preset-band" style={chip(false)} onClick={() => onCommit(applyFacadePreset(plan, side, 'band', 'brick-yellow'))}>{t('facade.band')}</button>
        <button type="button" data-testid="facade-split-h" style={chip(tool === 'split-h')} onClick={() => setTool(tool === 'split-h' ? 'select' : 'split-h')}>Vaakajako</button>
        <button type="button" data-testid="facade-split-v" style={chip(tool === 'split-v')} onClick={() => setTool(tool === 'split-v' ? 'select' : 'split-v')}>Pystyjako</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <span>mm</span>
          <input aria-label="Vyöhykkeen alareuna" style={{ ...inputStyle, width: 58 }} type="number" value={band.y0} onChange={(event) => setBand({ ...band, y0: Number(event.target.value) })} />
          <span>–</span>
          <input aria-label="Vyöhykkeen yläreuna" style={{ ...inputStyle, width: 58 }} type="number" value={band.y1} onChange={(event) => setBand({ ...band, y1: Number(event.target.value) })} />
          <select aria-label="Vyöhykkeen materiaali" title={CLADDING.find((item) => item.id === band.materialId)?.name || ''} style={{ ...inputStyle, width: 128 }} value={band.materialId} onChange={(event) => setBand({ ...band, materialId: event.target.value })}>
            {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" data-testid="facade-band" title={t('facade.horizontal')} style={chip(false)} onClick={() => onCommit(addFacadeBand(plan, side, band.y0 / 1000, band.y1 / 1000, band.materialId))}>Lisää</button>
        </label>
        <span style={{ width: 1, height: 18, background: '#d6d3d1', flexShrink: 0 }} />
        <button type="button" data-testid="facade-realistic" style={chip(realistic)} onClick={() => onApply({ ...plan, sceneStyle: 'realistic' })}>{t('finish.realistic')}</button>
        <button type="button" data-testid="facade-technical" style={chip(!realistic)} onClick={() => onApply({ ...plan, sceneStyle: 'technical' })}>{t('finish.technical')}</button>
        <button type="button" data-testid="facade-pdf" style={chip(false)} onClick={() => buildElevationPdf(plan, side).save(`julkisivu-${side}.pdf`)}>PDF</button>
        <button type="button" data-testid="facade-pdf-all" title={t('facade.allSides')} style={chip(false)} onClick={() => buildElevationPdf(plan, 'all').save('julkisivut.pdf')}>PDF 4</button>
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
            const cell = [...facadeCells(plan, side)].reverse().find((item) => point.u >= item.u0 && point.u <= item.u1 && point.y >= item.y0 && point.y <= item.y1)
            if (cell) onSelect?.(cell)
            setMenu({ kind: cell ? 'zone' : 'facade', id: cell?.id, cell, x: event.clientX, y: event.clientY, at: point })
          }}
          style={{ display: 'block', background: '#d6d3d1', touchAction: 'none', cursor: tool === 'rect' ? 'crosshair' : 'default' }}
        >
          <defs>{patternLooks.map((look) => patternNode(realistic ? look : { ...look, color: '#f8fafc', painted: false }))}</defs>
          <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fbfaf7" stroke="#1c1917" strokeWidth={1.3} />
          <rect x={sheet.x + 4} y={sheet.y + 4} width={sheet.w - 8} height={sheet.h - 8} fill="none" stroke="#a8a29e" strokeWidth={0.6} />
          <line x1={X(-overhang - 0.8)} y1={Y(-0.06)} x2={X(layout.length + overhang + 1.1)} y2={Y(-0.06)} stroke="#44403c" strokeWidth={2.4} />
          <line x1={X(-overhang - 0.35)} y1={Y(0)} x2={X(layout.length + overhang + 0.45)} y2={Y(0)} stroke="#1c1917" strokeWidth={1.3} />
          {mergeFacadeRects(visiblePaints.map((piece) => ({ ...piece, color: piece.look.color, colorCode: piece.look.code || '' }))).map((piece) => {
            const sample = visiblePaints.find((item) => item.materialId === piece.materialId && item.look.color === piece.color)
            return (
              <rect
                key={`${piece.materialId}-${piece.u0}-${piece.y0}-${piece.u1}`}
                data-testid="facade-skin"
                x={X(piece.u0)}
                y={Y(piece.y1)}
                width={Math.max(0, metres(piece.u1 - piece.u0))}
                height={Math.max(0, metres(piece.y1 - piece.y0))}
                fill={realistic && sample ? `url(#clad-${sample.key})` : '#f8fafc'}
                stroke="none"
              />
            )
          })}
          {facadeFlashings(plan).filter((joint) => joint.side === side).map((joint) => (
            <rect
              key={`flash-${joint.y}-${joint.u0}`}
              data-testid="facade-flashing"
              x={X(joint.u0)}
              y={Y(joint.y + 0.02)}
              width={metres(joint.u1 - joint.u0)}
              height={Math.max(1.2, metres(0.028))}
              fill="#6e6862"
              stroke="none"
            />
          ))}
          {(plan.facadeSplits || []).filter((item) => item.side === side).map((item) => (
            item.axis === 'v'
              ? <line key={item.id} data-testid="facade-split" x1={X(item.at)} y1={Y(0)} x2={X(item.at)} y2={Y(wallH)} stroke="#0f766e" strokeWidth={0.8} strokeDasharray="5 3" />
              : <line key={item.id} data-testid="facade-split" x1={X(0)} y1={Y(item.at)} x2={X(layout.length)} y2={Y(item.at)} stroke="#0f766e" strokeWidth={0.8} strokeDasharray="5 3" />
          ))}
          {selected?.kind === 'zone' && selected.side === side && (
            <rect
              data-testid="facade-zone-selected"
              x={X(selected.u0)}
              y={Y(selected.y1)}
              width={Math.max(0, metres(selected.u1 - selected.u0))}
              height={Math.max(0, metres(selected.y1 - selected.y0))}
              fill="none"
              stroke="#0f766e"
              strokeWidth={1.6}
            />
          )}
          <rect data-testid="facade-plinth" x={X(0)} y={Y(plinth.height)} width={metres(layout.length)} height={metres(plinth.height)} fill={realistic ? 'url(#clad-plinth)' : '#f8fafc'} stroke="#1c1917" strokeWidth={0.9} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(wallH)} stroke={realistic ? finish.trimColor : '#1c1917'} strokeWidth={3} />
          <line x1={X(layout.length)} y1={Y(0)} x2={X(layout.length)} y2={Y(wallH)} stroke={realistic ? finish.trimColor : '#1c1917'} strokeWidth={3} />
          <RoofElevation
            X={X}
            Y={Y}
            metres={metres}
            length={layout.length}
            wallH={wallH}
            ridge={ridge}
            overhang={overhang}
            gableEnd={gableEnd}
            roofType={roof.type}
            roofId={plan.roofId}
            fill={realistic ? roofFace.color : '#f8fafc'}
            edge="#1c1917"
            fascia={realistic ? finish.trimColor : '#f8fafc'}
            gutter={realistic ? roofFace.gutterColor : '#cbd5e1'}
            pattern={roofFace.pattern}
          />
          <line data-testid="facade-downpipe" x1={X(0.15)} y1={Y(wallH)} x2={X(0.15)} y2={Y(0)} stroke={realistic ? roofFace.gutterColor : '#1c1917'} strokeWidth={2.4} />
          <line x1={X(layout.length - 0.15)} y1={Y(wallH)} x2={X(layout.length - 0.15)} y2={Y(0)} stroke={realistic ? roofFace.gutterColor : '#1c1917'} strokeWidth={2.4} />
          {layout.openings.map((opening) => (
            <ElevationOpening key={opening.id} opening={opening} X={X} Y={Y} metres={metres} colour={openingColour(plan, opening).color} trim={finish.trimColor} technical={!realistic} />
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
          {terraceViews.map((view) => <FacadeTerrace key={view.id} view={view} X={X} Y={Y} metres={metres} />)}
          <FacadeHeights X={X} Y={Y} metres={metres} length={layout.length} wallH={wallH} ridge={ridge} openings={layout.openings} />
          {(areas.length > 0 || plinth.height > 0) && (
            <g data-testid="facade-legend">
              {(() => {
                const schedule = [
                  ...areas.map((row) => ({ key: row.key, name: row.item.name, code: row.look.code, area: row.area, swatch: row.key })),
                  { key: 'plinth', name: plinth.name, code: plinth.code, area: null, swatch: 'plinth', height: plinth.height },
                  { key: 'roof', name: roofFace.name, code: roofFace.code, area: null, swatch: null, color: roofFace.color },
                ]
                const legendW = Math.max(168, ...schedule.map((row) => 36 + (`${row.name} ${row.code || ''} ${row.area ? formatArea(row.area) : ''}`).length * 5.6))
                const legendH = 22 + schedule.length * 16
                const lx = sheet.x + 14
                const ly = sheet.y + 14
                return (
                  <>
                    <rect x={lx} y={ly} width={legendW} height={legendH} fill="#fff" stroke="#1c1917" strokeWidth={0.9} />
                    <text x={lx + 8} y={ly + 13} fontSize="10" fontWeight="700" fill="#1c1917">{t('facade.legend')}</text>
                    {schedule.map((row, index) => (
                      <g key={row.key} data-testid="facade-schedule" data-code={row.code || ''} transform={`translate(${lx + 8} ${ly + 20 + index * 16})`}>
                        <rect width="14" height="10" fill={row.swatch ? `url(#clad-${row.swatch})` : row.color} stroke="#44403c" strokeWidth="0.5" />
                        <text x="18" y="9" fontSize="11" fill="#1c1917">{row.name}{row.code ? ` ${row.code}` : ''}{row.area ? ` ${formatArea(row.area)}` : ''}</text>
                      </g>
                    ))}
                  </>
                )
              })()}
            </g>
          )}
          <g data-testid="facade-title">
            <rect x={sheet.x + (frame.x + frame.w - titleW - 2) * k} y={sheet.y + (frame.y + frame.h - titleH - 2) * k} width={titleW * k} height={titleH * k} fill="#fff" stroke="#1c1917" strokeWidth={1} />
            <text data-testid="facade-orientation" data-compass={layout.compass || sideCompass(side, north)} x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 14) * k} fontSize="13" fontWeight="750" fill="#1c1917">{t('facade.title', { side: `${layout.compass || ''} ${layout.name}`.trim() })}</text>
            <text x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 30) * k} fontSize="11" fill="#292524">{t('sheet.scale', { ratio })}</text>
            <text x={sheet.x + (frame.x + frame.w - titleW + 6) * k} y={sheet.y + (frame.y + frame.h - titleH + 44) * k} fontSize="11" fill="#292524">{text(locale, `facade.${roof.type}`, roof.type)}</text>
          </g>
        </svg>
        {menu && (
          <div
            data-testid="facade-menu"
            style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 280), zIndex: 60, width: 220, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.16)', padding: 8 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 6px 8px' }}>{menu.kind === 'zone' ? 'Vyöhyke' : 'Julkisivu'}</div>
            {menu.kind === 'zone' && menu.cell && (
              <>
                <label style={{ display: 'block', fontSize: 12, padding: '4px 6px' }}>
                  Materiaali
                  <select
                    data-testid="facade-zone-material"
                    style={{ ...inputStyle, width: '100%', marginTop: 4 }}
                    value={menu.cell.materialId || 'brick-yellow'}
                    onChange={(event) => onCommit(assignFacadeCell(plan, menu.cell, { materialId: event.target.value }))}
                  >
                    {CLADDING.map((item) => <option key={item.id} value={item.id}>{item.group}: {item.name}</option>)}
                  </select>
                </label>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'above', 'wood-horizontal')); setMenu(null) }}>{t('facade.above')}</button>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'band', 'brick-yellow')); setMenu(null) }}>{t('facade.band')}</button>
                {(() => {
                  const zone = (plan.facades || []).find((item) => item.id === menu.cell.zoneId)
                  const exact = zone && Math.abs(zone.u0 - menu.cell.u0) < 0.04 && Math.abs(zone.u1 - menu.cell.u1) < 0.04 && Math.abs(zone.y0 - menu.cell.y0) < 0.04 && Math.abs(zone.y1 - menu.cell.y1) < 0.04
                  if (!exact) return null
                  return <button type="button" data-testid="facade-zone-delete" onClick={() => { onCommit(deleteFacadeZone(plan, zone.id)); setMenu(null) }} style={menuBtn}>Poista</button>
                })()}
              </>
            )}
            {menu.kind === 'facade' && (
              <>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'above', 'wood-horizontal')); setMenu(null) }}>{t('facade.above')}</button>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'plinth')); setMenu(null) }}>Ikkunoiden alapuolinen sokkeli</button>
                <button type="button" style={menuBtn} onClick={() => { onCommit(applyFacadePreset(plan, side, 'band', 'brick-yellow')); setMenu(null) }}>{t('facade.band')}</button>
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
    flexShrink: 0,
    whiteSpace: 'nowrap',
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
