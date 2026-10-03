'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatLength, formatTemp } from '@/lib/units'
import { descendantIds, internalDims, snapDoorToWall } from '@/lib/geometry'
import { fanCountForWidth, isRefrigerated } from '@/lib/catalog'
import { pointInEquipment } from '@/lib/placement'
import { sizePlacedPipe } from '@/lib/pipeDuty'
import { highlightedPorts, pipeAppearance, snapPort } from '@/lib/pipeTopology'
import { calculateProject } from '@/lib/heatLoad'
import {
  applyBox,
  applyOutline,
  bboxOf,
  clampGroupTranslation,
  clampResizeBox,
  cleanOrthogonal,
  doorSymbol,
  edgesOf,
  fitView,
  footprintInside,
  gridSpec,
  insetOrthogonal,
  isCustomOutline,
  outlineOf,
  pointInPolygon,
  polygonArea,
  polygonMetrics,
  scaleBarMetres,
  selfIntersects,
  snapLabel,
  snapWorld,
  translateOutline,
} from '@/lib/cadDraw'
import { panelPolygon, sharedWallPanels } from '@/lib/sharedWalls'

const PAPER = '#f4f1ea'
const INK = '#292524'
const TEAL = '#0f766e'

function metricsOf(room) {
  return isCustomOutline(room) ? polygonMetrics(room).dims : internalDims(room)
}

function pathOf(points) {
  if (!points?.length) return ''
  return `${points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.z}`).join(' ')} Z`
}

function vertexAverage(points) {
  const n = points.length || 1
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / n,
    z: points.reduce((sum, point) => sum + point.z, 0) / n,
  }
}

function labelAnchor(room, inner, scale, line1, line2) {
  const box = bboxOf(inner)
  const center = vertexAverage(inner)
  const px = Math.max(line1.length, line2.length) * 7.1 + 22
  const chipW = Math.min(box.width * 0.78, px / Math.max(scale, 1))
  const chipH = 34 / Math.max(scale, 1)
  const candidates = [
    center,
    { x: center.x, z: box.top + box.depth * 0.22 },
    { x: center.x, z: box.bottom - box.depth * 0.22 },
    { x: box.left + box.width * 0.24, z: center.z },
    { x: box.right - box.width * 0.24, z: center.z },
    { x: box.left + box.width * 0.26, z: box.top + box.depth * 0.26 },
    { x: box.right - box.width * 0.26, z: box.bottom - box.depth * 0.26 },
  ]
  const blocks = (room.equipment || []).map((eq) => {
    const alongX = eq.rotation !== 90
    const halfW = (alongX ? eq.width : eq.depth) / 2 + 0.28
    const halfD = (alongX ? eq.depth : eq.width) / 2 + 0.28
    return { x: room.x + eq.x, z: room.z + eq.z, halfW, halfD }
  })
  const clear = (point) => {
    const corners = [
      [point.x - chipW / 2, point.z - chipH / 2],
      [point.x + chipW / 2, point.z - chipH / 2],
      [point.x - chipW / 2, point.z + chipH / 2],
      [point.x + chipW / 2, point.z + chipH / 2],
    ]
    if (corners.some(([x, z]) => !pointInPolygon(x, z, inner))) return false
    return !blocks.some((block) => (
      Math.abs(point.x - block.x) < chipW / 2 + block.halfW
      && Math.abs(point.z - block.z) < chipH / 2 + block.halfD
    ))
  }
  const point = candidates.find(clear) || center
  return { ...point, w: chipW, h: chipH }
}

function hitRoom(rooms, x, z) {
  const hits = rooms.filter((room) => pointInPolygon(x, z, outlineOf(room)))
  hits.sort((a, b) => polygonArea(outlineOf(a)) - polygonArea(outlineOf(b)))
  return hits[0] || null
}

function hitEquipment(rooms, x, z) {
  const ordered = [...rooms].sort((a, b) => a.width * a.depth - b.width * b.depth)
  for (const room of ordered) {
    for (const eq of room.equipment || []) {
      if (pointInEquipment(room, eq, x, z)) return { room, eq }
    }
  }
  return null
}

function distToSeg(px, pz, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz || 1
  let t = ((px - a.x) * dx + (pz - a.z) * dz) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t))
}

function hitRoute(items, x, z, limit = 0.22) {
  let best = null
  for (const item of items || []) {
    const points = item.points || []
    for (let i = 1; i < points.length; i += 1) {
      const dist = distToSeg(x, z, points[i - 1], points[i])
      if (dist <= limit && (!best || dist < best.dist)) best = { item, dist }
    }
  }
  return best?.item || null
}

function isRouteTool(tool) {
  return tool === 'polygon' || tool === 'pipe' || tool === 'cable'
}

function moveEdge(points, index, x, z) {
  const a = points[index]
  const b = points[(index + 1) % points.length]
  const horizontal = Math.abs(a.z - b.z) <= Math.abs(a.x - b.x)
  const next = points.map((point) => ({ ...point }))
  const end = (index + 1) % points.length
  if (horizontal) {
    next[index] = { ...next[index], z }
    next[end] = { ...next[end], z }
  } else {
    next[index] = { ...next[index], x }
    next[end] = { ...next[end], x }
  }
  return cleanOrthogonal(next)
}

function moveVertex(points, index, x, z) {
  const count = points.length
  const prevI = (index - 1 + count) % count
  const nextI = (index + 1) % count
  const prev = points[prevI]
  const current = points[index]
  const nextP = points[nextI]
  const prevHoriz = Math.abs(prev.z - current.z) <= Math.abs(prev.x - current.x)
  const nextHoriz = Math.abs(nextP.z - current.z) <= Math.abs(nextP.x - current.x)
  const out = points.map((point) => ({ ...point }))
  out[index] = { x, z }
  out[prevI] = prevHoriz ? { ...out[prevI], z } : { ...out[prevI], x }
  out[nextI] = nextHoriz ? { ...out[nextI], z } : { ...out[nextI], x }
  return cleanOrthogonal(out)
}

function DimLine({ x1, z1, x2, z2, scale, text }) {
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz) || 1
  const tick = 5 / scale
  const mx = (x1 + x2) / 2
  const mz = (z1 + z2) / 2
  return (
    <g>
      <line x1={x1} y1={z1} x2={x2} y2={z2} stroke="#44403c" strokeWidth={0.9 / scale} />
      <line x1={x1 - (dz / len) * tick} y1={z1 + (dx / len) * tick} x2={x1 + (dz / len) * tick} y2={z1 - (dx / len) * tick} stroke="#44403c" strokeWidth={0.9 / scale} />
      <line x1={x2 - (dz / len) * tick} y1={z2 + (dx / len) * tick} x2={x2 + (dz / len) * tick} y2={z2 - (dx / len) * tick} stroke="#44403c" strokeWidth={0.9 / scale} />
      <g>
        <rect x={mx - (text.length * 3.1) / scale} y={mz - 6 / scale} width={(text.length * 6.2) / scale} height={12 / scale} fill={PAPER} opacity="0.92" />
        <text x={mx} y={mz} textAnchor="middle" dominantBaseline="middle" fill={INK} fontSize={11 / scale} fontFamily="ui-sans-serif, sans-serif">
          {text}
        </text>
      </g>
    </g>
  )
}

function edgeDimension(edge, points, scale, unitSystem) {
  const len = edge.len || 1
  let nx = -(edge.z2 - edge.z1) / len
  let nz = (edge.x2 - edge.x1) / len
  const mx = (edge.x1 + edge.x2) / 2
  const mz = (edge.z1 + edge.z2) / 2
  if (pointInPolygon(mx + nx * 0.05, mz + nz * 0.05, points)) {
    nx = -nx
    nz = -nz
  }
  const off = 0.42
  return (
    <DimLine
      x1={edge.x1 + nx * off}
      z1={edge.z1 + nz * off}
      x2={edge.x2 + nx * off}
      z2={edge.z2 + nz * off}
      scale={scale}
      text={formatLength(len, unitSystem)}
    />
  )
}

function EquipmentMark({ eq, scale }) {
  const w = eq.width
  const d = eq.depth
  const sw = 1 / Math.max(scale, 1)
  if (eq.category === 'sensor') {
    const letter = eq.sensor === 'door' ? 'O' : eq.sensor === 'defrost' ? 'S' : eq.sensor === 'evap' ? 'H' : 'T'
    return (
      <g>
        <circle r={0.13} fill="#fff" stroke="#0369a1" strokeWidth={sw * 1.4} />
        <text y={4 / scale} textAnchor="middle" fontSize={11 / scale} fill="#0369a1" fontFamily="ui-sans-serif, system-ui, sans-serif">{letter}</text>
      </g>
    )
  }
  if (eq.category === 'controller') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.03} fill="#ccfbf1" stroke="#0f766e" strokeWidth={sw} />
        <text y={4 / scale} textAnchor="middle" fontSize={12 / scale} fill="#0f766e" fontFamily="ui-sans-serif, system-ui, sans-serif">S</text>
      </g>
    )
  }
  if (eq.category === 'column') {
    return <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#d6d3d1" stroke="#57534e" strokeWidth={sw * 1.4} />
  }
  if (eq.category === 'evaporator' && eq.style === 'slant') {
    const fans = fanCountForWidth(w)
    const fanR = Math.min(d * 0.2, (w * 0.72) / fans / 2.3)
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#f8fafc" stroke="#64748b" strokeWidth={sw} />
        <line x1={-w / 2} y1={-d * 0.22} x2={w / 2} y2={-d * 0.22} stroke="#94a3b8" strokeWidth={sw} />
        {[-1, 1].map((side) => (
          <rect key={side} x={side * w * 0.42 - 0.03} y={-d / 2 - 0.05} width={0.06} height={0.08} fill="#94a3b8" />
        ))}
        {Array.from({ length: fans }, (_, index) => (
          <circle key={index} cx={(index - (fans - 1) / 2) * ((w * 0.72) / fans)} cy={d * 0.08} r={fanR} fill="#eff6ff" stroke="#1d4ed8" strokeWidth={sw * 1.4} />
        ))}
        <circle cx={0} cy={d * 0.34} r={0.035} fill="#64748b" />
      </g>
    )
  }
  if (eq.category === 'evaporator') {
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.04} fill="#e0f2fe" stroke="#0369a1" strokeWidth={sw} />
        <circle r={Math.min(w, d) * 0.16} fill="none" stroke="#0369a1" strokeWidth={sw} />
        <path d={`M ${-w * 0.28} 0 l ${w * 0.16} ${-d * 0.12} l 0 ${d * 0.24} Z`} fill="#0369a1" />
        <path d={`M ${-w * 0.05} 0 l ${w * 0.16} ${-d * 0.12} l 0 ${d * 0.24} Z`} fill="#0369a1" />
      </g>
    )
  }
  if (eq.category === 'condenser' || eq.category === 'combo' || eq.category === 'unit' || eq.category === 'compressor') {
    const combo = eq.category === 'combo' || eq.category === 'unit'
    const rack = eq.category === 'compressor'
    return (
      <g>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#f8fafc" stroke="#334155" strokeWidth={sw} />
        <line x1={-w / 2} y1={d / 2 - 0.03} x2={w / 2} y2={d / 2 - 0.03} stroke="#44403c" strokeWidth={sw * 2.2} />
        {!rack && Array.from({ length: 4 }, (_, index) => (
          <line key={index} x1={combo ? -w * 0.05 : -w * 0.32} y1={-d * 0.28 + index * d * 0.14} x2={w * 0.36} y2={-d * 0.28 + index * d * 0.14} stroke="#64748b" strokeWidth={sw} />
        ))}
        {!rack && <circle cx={combo ? w * 0.12 : 0} cy={0} r={Math.min(w, d) * 0.16} fill="#fff" stroke="#0f172a" strokeWidth={sw} />}
        {combo && <ellipse cx={-w * 0.28} cy={0} rx={Math.min(w, d) * 0.16} ry={Math.min(w, d) * 0.2} fill="#1f2937" />}
        {rack && [-0.24, 0, 0.24].slice(0, w > 1 ? 3 : 2).map((offset) => (
          <circle key={offset} cx={w * offset} cy={0} r={Math.min(0.16, d * 0.22)} fill="#1f2937" />
        ))}
        {(rack || combo) && (
          <g>
            <rect x={w * 0.02} y={-d / 2 - 0.02} width={w * 0.16} height={0.07} rx={0.02} fill="#e2e8f0" stroke="#334155" strokeWidth={sw} />
            <circle cx={w * 0.24} cy={-d / 2 + 0.015} r={0.035} fill="#fff" stroke="#334155" strokeWidth={sw} />
            <circle cx={w * 0.33} cy={-d / 2 + 0.015} r={0.028} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={sw} />
          </g>
        )}
        <circle cx={-w * 0.12} cy={-d / 2} r={0.045} fill="#b45309" />
        <circle cx={w * 0.12} cy={-d / 2} r={0.045} fill="#b45309" />
      </g>
    )
  }
  return <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={eq.category === 'rack' ? '#ede9fe' : '#fef3c7'} stroke="#57534e" strokeWidth={sw} />
}

function longestMid(points) {
  let best = 0
  let mid = points[0]
  let dx = 1
  let dz = 0
  for (let i = 1; i < points.length; i += 1) {
    const sx = points[i].x - points[i - 1].x
    const sz = points[i].z - points[i - 1].z
    const len = Math.hypot(sx, sz)
    if (len >= best) {
      best = len
      mid = { x: (points[i].x + points[i - 1].x) / 2, z: (points[i].z + points[i - 1].z) / 2 }
      dx = sx
      dz = sz
    }
  }
  const span = Math.hypot(dx, dz) || 1
  return { ...mid, nx: -dz / span, nz: dx / span }
}

export default function PlanView({
  rooms,
  selectedIds = [],
  tool,
  placing,
  unitSystem,
  gridSize,
  snapOn,
  snapFlags,
  fitToken = 0,
  onSelect,
  onPreview,
  onGestureStart,
  onGestureEnd,
  onCreateRect,
  onCreatePolygon,
  onCreateRoute,
  onPlace,
  onContextMenu,
  pipes = [],
  cables = [],
  pipeKind = 'suction',
  notice,
}) {
  const hostRef = useRef(null)
  const viewRef = useRef({ scale: 36, offsetX: 480, offsetY: 320 })
  const [view, setView] = useState(viewRef.current)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cursor, setCursor] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [poly, setPoly] = useState([])
  const [polyHover, setPolyHover] = useState(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const gesture = useRef(null)
  const autoFit = useRef(true)
  const typed = useRef({ field: 'w', w: '', d: '' })
  const polyTyped = useRef('')
  const polyRef = useRef([])
  const propsRef = useRef({})
  polyRef.current = poly
  propsRef.current = {
    rooms, selectedIds, tool, placing, gridSize, snapOn, snapFlags, pipes, cables, pipeKind,
    onSelect, onPreview, onGestureStart, onGestureEnd, onCreateRect, onCreatePolygon, onCreateRoute, onPlace, onContextMenu,
  }

  const setCamera = (next) => {
    viewRef.current = next
    setView(next)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => {
      const next = { w: host.clientWidth, h: host.clientHeight }
      setSize(next)
      if (autoFit.current && next.w > 40 && next.h > 40) {
        setCamera(fitView(propsRef.current.rooms, next.w, next.h))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    autoFit.current = true
    const frame = requestAnimationFrame(() => {
      const host = hostRef.current
      if (!host) return
      setCamera(fitView(propsRef.current.rooms, host.clientWidth, host.clientHeight))
    })
    return () => cancelAnimationFrame(frame)
  }, [fitToken])

  const roomCount = rooms.length
  const seenRooms = useRef(0)
  useEffect(() => {
    if (seenRooms.current === 0 && roomCount > 0) {
      autoFit.current = true
      const frame = requestAnimationFrame(() => {
        const host = hostRef.current
        if (host) setCamera(fitView(propsRef.current.rooms, host.clientWidth, host.clientHeight))
      })
      seenRooms.current = roomCount
      return () => cancelAnimationFrame(frame)
    }
    seenRooms.current = roomCount
    return undefined
  }, [roomCount])

  useEffect(() => {
    if (tool !== 'polygon') {
      setPoly([])
      polyTyped.current = ''
    }
  }, [tool])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      autoFit.current = false
      const current = viewRef.current
      const rect = host.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const pinch = event.ctrlKey || event.metaKey
      const trackpad = !pinch && event.deltaMode === 0 && Math.abs(event.deltaY) < 40 && Math.abs(event.deltaX) < 40
      if ((trackpad && !event.shiftKey) || event.shiftKey) {
        const next = {
          ...current,
          offsetX: current.offsetX - (event.shiftKey ? event.deltaY : event.deltaX),
          offsetY: current.offsetY - (event.shiftKey ? 0 : event.deltaY),
        }
        setCamera(next)
        return
      }
      const worldX = (px - current.offsetX) / current.scale
      const worldZ = (py - current.offsetY) / current.scale
      const factor = Math.exp(-event.deltaY * (pinch ? 0.01 : 0.0016))
      const scale = Math.max(6, Math.min(220, current.scale * factor))
      setCamera({
        scale,
        offsetX: px - worldX * scale,
        offsetY: py - worldZ * scale,
      })
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceDown(event.type === 'keydown')
        return
      }
      if (event.type !== 'keydown') return
      const drawing = gesture.current?.kind === 'draw'
      const points = polyRef.current
      if (event.key === 'Escape' && (drawing || points.length)) {
        gesture.current = null
        typed.current = { field: 'w', w: '', d: '' }
        polyTyped.current = ''
        setDraft(null)
        setPoly([])
        event.stopPropagation()
        return
      }
      if (event.key === 'Backspace' && points.length && !drawing) {
        event.preventDefault()
        event.stopPropagation()
        if (polyTyped.current) polyTyped.current = polyTyped.current.slice(0, -1)
        else setPoly(points.slice(0, -1))
        return
      }
      if (drawing && event.key === 'Tab') {
        event.preventDefault()
        typed.current.field = typed.current.field === 'w' ? 'd' : 'w'
        return
      }
      if ((drawing || points.length) && /^[0-9.,]$/.test(event.key)) {
        event.preventDefault()
        event.stopPropagation()
        if (drawing) {
          const field = typed.current.field
          typed.current[field] = `${typed.current[field]}${event.key}`.slice(0, 8)
        } else {
          polyTyped.current = `${polyTyped.current}${event.key}`.slice(0, 8)
        }
        return
      }
      if (event.key === 'Enter' && drawing) {
        event.preventDefault()
        event.stopPropagation()
        const g = gesture.current
        gesture.current = null
        setDraft(null)
        propsRef.current.onCreateRect(g.x1, g.z1, g.x2, g.z2)
        typed.current = { field: 'w', w: '', d: '' }
        return
      }
      if (event.key === 'Enter' && points.length) {
        event.preventDefault()
        event.stopPropagation()
        if (polyTyped.current && points.length) {
          const last = points[points.length - 1]
          const hover = snapWorld(last.x + 1, last.z, {
            origin: last,
            scale: viewRef.current.scale,
            grid: propsRef.current.snapOn ? propsRef.current.gridSize : 0,
            rooms: propsRef.current.rooms,
            flags: propsRef.current.snapFlags,
          })
          const length = parseFloat(polyTyped.current.replace(',', '.'))
          if (Number.isFinite(length) && length >= 0.3) {
            const dx = hover.x - last.x
            const dz = hover.z - last.z
            const mag = Math.hypot(dx, dz) || 1
            setPoly([...points, { x: last.x + (dx / mag) * length, z: last.z + (dz / mag) * length }])
          }
          polyTyped.current = ''
          return
        }
        const route = propsRef.current.tool === 'pipe' || propsRef.current.tool === 'cable'
        if (route && points.length >= 2) {
          propsRef.current.onCreateRoute?.(points)
          setPoly([])
        } else if (!route && points.length >= 4) {
          propsRef.current.onCreatePolygon(points)
          setPoly([])
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
    }
  }, [])

  useEffect(() => {
    const move = (event) => {
      const host = hostRef.current
      if (!host) return
      const current = viewRef.current
      const rect = host.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const world = { x: (px - current.offsetX) / current.scale, z: (py - current.offsetY) / current.scale, px, py }
      const p = propsRef.current
      const g = gesture.current
      if (polyRef.current.length && isRouteTool(p.tool)) {
        const last = polyRef.current[polyRef.current.length - 1]
        let hover = snapWorld(world.x, world.z, {
          origin: last,
          scale: current.scale,
          grid: p.snapOn ? p.gridSize : 0,
          rooms: p.rooms,
          flags: { ...p.snapFlags, ortho: true },
        })
        const typedLength = parseFloat(polyTyped.current.replace(',', '.'))
        if (Number.isFinite(typedLength) && typedLength >= 0.3) {
          const dx = hover.x - last.x
          const dz = hover.z - last.z
          const mag = Math.hypot(dx, dz) || 1
          hover = { ...hover, x: last.x + (dx / mag) * typedLength, z: last.z + (dz / mag) * typedLength, kind: 'ortho' }
        }
        setPolyHover(hover)
      }
      if (!g) {
        setCursor({ ...world, kind: null })
        const eq = hitEquipment(p.rooms, world.x, world.z)
        setHoverId(eq?.room?.id || hitRoom(p.rooms, world.x, world.z)?.id || null)
        return
      }
      if (g.kind === 'right') {
        if (Math.hypot(event.clientX - g.sx, event.clientY - g.sy) > 4) {
          g.kind = 'pan'
          g.moved = true
        }
      }
      if (g.kind === 'pan') {
        autoFit.current = false
        setCamera({
          ...current,
          offsetX: g.offsetX + (event.clientX - g.sx),
          offsetY: g.offsetY + (event.clientY - g.sy),
        })
        return
      }
      if (g.kind === 'marquee') {
        setDraft({ kind: 'marquee', x1: g.x1, z1: g.z1, x2: world.x, z2: world.z })
        return
      }
      const snapped = snapWorld(world.x, world.z, {
        origin: g.kind === 'draw' ? { x: g.x1, z: g.z1 } : null,
        scale: current.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: g.kind === 'draw' ? { ...p.snapFlags, ortho: false } : { ...p.snapFlags, ortho: false },
        ignoreIds: g.ignoreIds,
      })
      setCursor({ ...world, x: snapped.x, z: snapped.z, kind: snapped.kind })
      if (g.kind === 'draw') {
        let x2 = snapped.x
        let z2 = snapped.z
        const widthText = parseFloat(typed.current.w.replace(',', '.'))
        const depthText = parseFloat(typed.current.d.replace(',', '.'))
        if (Number.isFinite(widthText) && widthText >= 0.3) {
          const sign = snapped.x - g.x1 >= 0 ? 1 : -1
          x2 = g.x1 + sign * widthText
        }
        if (Number.isFinite(depthText) && depthText >= 0.3) {
          const sign = snapped.z - g.z1 >= 0 ? 1 : -1
          z2 = g.z1 + sign * depthText
        }
        g.x2 = x2
        g.z2 = z2
        setDraft({ kind: 'rect', x1: g.x1, z1: g.z1, x2, z2 })
        return
      }
      if (!g.started) {
        g.started = true
        p.onGestureStart()
      }
      if (g.kind === 'move') {
        const primary = g.orig.find((room) => room.id === g.id)
        const anchorX = primary.x - primary.width / 2
        const anchorZ = primary.z - primary.depth / 2
        const anchor = snapWorld(anchorX + (world.x - g.startX), anchorZ + (world.z - g.startZ), {
          scale: current.scale,
          grid: p.snapOn ? p.gridSize : 0,
          rooms: p.rooms,
          flags: { ...p.snapFlags, ortho: false },
          ignoreIds: g.ignoreIds,
        })
        const limited = clampGroupTranslation(g.orig, g.ids, anchor.x - anchorX, anchor.z - anchorZ)
        setCursor((prev) => ({ ...(prev || world), kind: anchor.kind }))
        p.onPreview(g.orig.map((room) => {
          if (!g.ids.has(room.id)) return room
          return {
            ...room,
            x: room.x + limited.dx,
            z: room.z + limited.dz,
            outline: translateOutline(room.outline, limited.dx, limited.dz),
          }
        }))
        return
      }
      if (g.kind === 'resize') {
        const room = g.orig.find((item) => item.id === g.id)
        const box = bboxOf(outlineOf(room))
        let left = box.left
        let right = box.right
        let top = box.top
        let bottom = box.bottom
        const handle = g.corner
        if (handle.includes('e')) right = snapped.x
        if (handle.includes('w')) left = snapped.x
        if (handle.includes('s')) bottom = snapped.z
        if (handle.includes('n')) top = snapped.z
        if (right - left < 1) {
          if (handle.includes('e')) right = left + 1
          else left = right - 1
        }
        if (bottom - top < 1) {
          if (handle.includes('s')) bottom = top + 1
          else top = bottom - 1
        }
        const limited = clampResizeBox(room, g.orig, left, top, right, bottom)
        if (!limited) return
        p.onPreview(g.orig.map((item) => (
          item.id === room.id ? applyBox(item, limited.left, limited.top, limited.right, limited.bottom) : item
        )))
        return
      }
      if (g.kind === 'edge' || g.kind === 'vertex') {
        const room = g.orig.find((item) => item.id === g.id)
        const points = g.kind === 'edge'
          ? moveEdge(outlineOf(room), g.index, snapped.x, snapped.z)
          : moveVertex(outlineOf(room), g.index, snapped.x, snapped.z)
        if (points.length < 4 || selfIntersects(points) || polygonArea(points) < 0.5) return
        const proposed = applyOutline(room, points)
        const parent = room.parentId ? g.orig.find((item) => item.id === room.parentId) : null
        if (parent && !footprintInside(parent, proposed)) return
        const children = g.orig.filter((item) => item.parentId === room.id)
        if (children.some((child) => !footprintInside(proposed, child))) return
        p.onPreview(g.orig.map((item) => (item.id === room.id ? proposed : item)))
        return
      }
      if (g.kind === 'equip') {
        const dx = world.x - g.startX
        const dz = world.z - g.startZ
        p.onPreview(g.orig.map((room) => {
          if (room.id !== g.roomId) return room
          return {
            ...room,
            equipment: room.equipment.map((eq) => {
              if (eq.id !== g.eqId) return eq
              const localX = eq.x + dx
              const localZ = eq.z + dz
              if (eq.category === 'door') return { ...eq, ...snapDoorToWall(room, localX, localZ, eq.width) }
              return { ...eq, x: localX, z: localZ }
            }),
          }
        }))
      }
    }
    const up = (event) => {
      const g = gesture.current
      gesture.current = null
      if (!g) return
      const p = propsRef.current
      if (g.kind === 'right') {
        if (!g.moved) {
          const eqHit = hitEquipment(p.rooms, g.world.x, g.world.z)
          const pipeHit = hitRoute(p.pipes, g.world.x, g.world.z)
          const cableHit = hitRoute(p.cables, g.world.x, g.world.z)
          const roomHit = hitRoom(p.rooms, g.world.x, g.world.z)
          const hit = eqHit
            ? { id: eqHit.eq.id, kind: 'equipment' }
            : pipeHit
              ? { id: pipeHit.id, kind: 'pipe' }
              : cableHit
                ? { id: cableHit.id, kind: 'cable' }
                : roomHit
                  ? { id: roomHit.id, kind: 'room' }
                  : null
          if (hit) p.onContextMenu?.({ ...hit, x: event.clientX, y: event.clientY })
        }
        return
      }
      if (g.kind === 'draw') {
        setDraft(null)
        typed.current = { field: 'w', w: '', d: '' }
        p.onCreateRect(g.x1, g.z1, g.x2 ?? g.x1, g.z2 ?? g.z1)
      } else if (g.kind === 'marquee') {
        setDraft(null)
        const host = hostRef.current
        const current = viewRef.current
        const rect = host.getBoundingClientRect()
        const x2 = (event.clientX - rect.left - current.offsetX) / current.scale
        const z2 = (event.clientY - rect.top - current.offsetY) / current.scale
        const left = Math.min(g.x1, x2)
        const right = Math.max(g.x1, x2)
        const top = Math.min(g.z1, z2)
        const bottom = Math.max(g.z1, z2)
        if (right - left < 0.15 && bottom - top < 0.15) {
          if (!g.shift) p.onSelect([])
          return
        }
        const hits = p.rooms.filter((room) => {
          const box = bboxOf(outlineOf(room))
          return box.right >= left && box.left <= right && box.bottom >= top && box.top <= bottom
        }).map((room) => room.id)
        p.onSelect(g.shift ? [...new Set([...p.selectedIds, ...hits])] : hits)
      } else if (g.started) {
        p.onGestureEnd()
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  const onMouseDown = (event) => {
    const host = hostRef.current
    const world = {
      x: (event.clientX - host.getBoundingClientRect().left - view.offsetX) / view.scale,
      z: (event.clientY - host.getBoundingClientRect().top - view.offsetY) / view.scale,
    }
    if (event.button === 1 || spaceDown) {
      gesture.current = { kind: 'pan', sx: event.clientX, sy: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY }
      return
    }
    if (event.button === 2) {
      gesture.current = {
        kind: 'right',
        sx: event.clientX,
        sy: event.clientY,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
        world,
        moved: false,
      }
      return
    }
    if (event.button !== 0) return
    const p = propsRef.current
    const handle = event.target?.dataset?.handle
    const handleRoom = event.target?.dataset?.room
    if (isRouteTool(p.tool)) {
      const route = p.tool === 'pipe' || p.tool === 'cable'
      if (event.detail >= 2 && polyRef.current.length >= (route ? 2 : 4)) {
        if (route) p.onCreateRoute?.(polyRef.current)
        else p.onCreatePolygon(polyRef.current)
        setPoly([])
        polyTyped.current = ''
        return
      }
      const origin = polyRef.current.length ? polyRef.current[polyRef.current.length - 1] : null
      let point = snapWorld(world.x, world.z, {
        origin,
        scale: view.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: { ...p.snapFlags, ortho: origin ? true : p.snapFlags?.ortho },
      })
      const typedLength = parseFloat(polyTyped.current.replace(',', '.'))
      if (origin && Number.isFinite(typedLength) && typedLength >= 0.3) {
        const dx = point.x - origin.x
        const dz = point.z - origin.z
        const mag = Math.hypot(dx, dz) || 1
        point = { x: origin.x + (dx / mag) * typedLength, z: origin.z + (dz / mag) * typedLength }
      }
      if (p.tool === 'pipe') {
        const port = snapPort(p.rooms, point.x, point.z, p.pipeKind, polyRef.current)
        if (port) point = { x: port.x, z: port.z }
      }
      polyTyped.current = ''
      if (!route && polyRef.current.length >= 3) {
        const first = polyRef.current[0]
        if (Math.hypot(point.x - first.x, point.z - first.z) < 16 / view.scale) {
          p.onCreatePolygon(polyRef.current)
          setPoly([])
          return
        }
      }
      setPoly([...polyRef.current, { x: point.x, z: point.z }])
      return
    }
    if (p.tool === 'draw' || p.tool === 'partition') {
      const point = snapWorld(world.x, world.z, {
        scale: view.scale,
        grid: p.snapOn ? p.gridSize : 0,
        rooms: p.rooms,
        flags: { ...p.snapFlags, ortho: false },
      })
      typed.current = { field: 'w', w: '', d: '' }
      gesture.current = { kind: 'draw', x1: point.x, z1: point.z, x2: point.x, z2: point.z }
      setDraft({ kind: 'rect', x1: point.x, z1: point.z, x2: point.x, z2: point.z })
      return
    }
    if (p.placing) {
      let room = hitRoom(p.rooms, world.x, world.z)
      const outdoor = ['condenser', 'unit', 'combo', 'compressor'].includes(p.placing.category)
      if (!room && outdoor) {
        room = [...p.rooms].sort((a, b) => Math.hypot(a.x - world.x, a.z - world.z) - Math.hypot(b.x - world.x, b.z - world.z))[0]
      }
      if (room) p.onPlace(room.id, world.x, world.z)
      return
    }
    if (handle && handleRoom) {
      const orig = p.rooms.map((room) => ({ ...room, equipment: [...(room.equipment || [])], outline: room.outline ? room.outline.map((pt) => ({ ...pt })) : null }))
      if (handle.startsWith('v-') || handle.startsWith('e-')) {
        gesture.current = {
          kind: handle.startsWith('v-') ? 'vertex' : 'edge',
          id: handleRoom,
          index: Number(handle.slice(2)),
          orig,
          started: false,
        }
      } else {
        gesture.current = { kind: 'resize', id: handleRoom, corner: handle, orig, started: false }
      }
      p.onSelect([handleRoom])
      return
    }
    const pipeHit = hitRoute(p.pipes, world.x, world.z)
    if (pipeHit && p.tool === 'select') {
      p.onSelect([pipeHit.id])
      return
    }
    const cableHit = hitRoute(p.cables, world.x, world.z)
    if (cableHit && p.tool === 'select') {
      p.onSelect([cableHit.id])
      return
    }
    const eqHit = hitEquipment(p.rooms, world.x, world.z)
    if (eqHit) {
      p.onSelect([eqHit.eq.id])
      gesture.current = {
        kind: 'equip',
        roomId: eqHit.room.id,
        eqId: eqHit.eq.id,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((room) => ({ ...room, equipment: room.equipment.map((item) => ({ ...item })) })),
        started: false,
      }
      return
    }
    const room = hitRoom(p.rooms, world.x, world.z)
    if (room) {
      const next = event.shiftKey
        ? (p.selectedIds.includes(room.id) ? p.selectedIds.filter((id) => id !== room.id) : [...p.selectedIds, room.id])
        : (p.selectedIds.includes(room.id) ? p.selectedIds : [room.id])
      p.onSelect(next)
      const ids = new Set(next)
      next.forEach((id) => descendantIds(p.rooms, id).forEach((child) => ids.add(child)))
      gesture.current = {
        kind: 'move',
        id: room.id,
        ids,
        ignoreIds: ids,
        startX: world.x,
        startZ: world.z,
        orig: p.rooms.map((item) => ({ ...item, equipment: [...(item.equipment || [])], outline: item.outline ? item.outline.map((pt) => ({ ...pt })) : null })),
        started: false,
      }
      return
    }
    gesture.current = { kind: 'marquee', x1: world.x, z1: world.z, shift: event.shiftKey }
  }

  const { minor, major } = gridSpec(view.scale)
  const left = -view.offsetX / view.scale
  const top = -view.offsetY / view.scale
  const right = left + size.w / view.scale
  const bottom = top + size.h / view.scale
  const gridLines = []
  if (snapOn) {
    const startX = Math.floor(left / minor) * minor
    const startZ = Math.floor(top / minor) * minor
    for (let x = startX; x <= right; x += minor) {
      const majorLine = Math.abs(x / major - Math.round(x / major)) < 1e-6
      gridLines.push({ x1: x, z1: top, x2: x, z2: bottom, major: majorLine })
    }
    for (let z = startZ; z <= bottom; z += minor) {
      const majorLine = Math.abs(z / major - Math.round(z / major)) < 1e-6
      gridLines.push({ x1: left, z1: z, x2: right, z2: z, major: majorLine })
    }
  }
  const bar = scaleBarMetres(view.scale)
  const wallPanels = useMemo(() => sharedWallPanels(rooms), [rooms])
  const selected = new Set(selectedIds)
  const drawing = tool === 'draw' || tool === 'partition' || isRouteTool(tool)
  const hint = tool === 'pipe'
    ? 'Putki: klikkaa pisteet, suora kulma napsahtaa. Enter päättää, portti napsahtaa laitteeseen.'
    : tool === 'cable'
      ? 'Kaapeli: klikkaa reitti anturista säätimelle. Enter päättää.'
      : tool === 'polygon'
        ? 'Klikkaa nurkat. Seinä pysyy suorassa. Enter sulkee, askelpalautin peruu pisteen.'
        : tool === 'draw' || tool === 'partition'
          ? 'Vedä huone tai muu tila. Näppäile mitta, Tab vaihtaa sivua, Enter vahvistaa.'
          : 'Vedä siirtää · oikea näppäin valikko · kahvat mitoittavat · rulla zoomaa'

  const rectDraft = draft?.kind === 'rect' ? draft : null
  const draftWidth = rectDraft ? Math.abs(rectDraft.x2 - rectDraft.x1) : 0
  const draftDepth = rectDraft ? Math.abs(rectDraft.z2 - rectDraft.z1) : 0

  return (
    <div
      ref={hostRef}
      data-testid="plan-canvas"
      onMouseDown={onMouseDown}
      onContextMenu={(event) => event.preventDefault()}
      onMouseLeave={() => { if (!gesture.current) setCursor(null) }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: PAPER,
        overflow: 'hidden',
        cursor: spaceDown ? 'grab' : drawing || placing ? 'crosshair' : hoverId ? 'move' : 'default',
        userSelect: 'none',
      }}
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id="panel-hatch" width="0.18" height="0.18" patternUnits="userSpaceOnUse">
            <path d="M0 0.18 L0.18 0" stroke="#d6d0c6" strokeWidth="0.012" />
          </pattern>
        </defs>
        <g transform={`translate(${view.offsetX} ${view.offsetY}) scale(${view.scale})`}>
          {gridLines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.z1}
              x2={line.x2}
              y2={line.z2}
              stroke={line.major ? '#d9d3c8' : '#ebe6dc'}
              strokeWidth={(line.major ? 1.1 : 0.7) / view.scale}
            />
          ))}
          {wallPanels.map((panel) => {
            const points = panelPolygon(panel)
            return (
              <polygon
                key={panel.id}
                points={points.map((point) => `${point.x},${point.z}`).join(' ')}
                fill={panel.shared ? '#e7e5e4' : 'url(#panel-hatch)'}
                stroke="#44403c"
                strokeWidth={0.7 / view.scale}
                style={{ pointerEvents: 'none' }}
              />
            )
          })}
          {rooms.map((room) => {
            const outer = outlineOf(room)
            const inner = insetOrthogonal(outer, room.wallThickness) || outer
            const active = selected.has(room.id)
            const hot = hoverId === room.id
            const dims = metricsOf(room)
            const line1 = `${room.label}  ${formatTemp(room.temp, unitSystem, 0)}`
            const line2 = `${dims.area.toFixed(1)} m²`
            const label = labelAnchor(room, inner, view.scale, line1, line2)
            const showHandles = active && selectedIds.length === 1 && tool === 'select' && !placing
            const rectLike = !isCustomOutline(room)
            return (
              <g key={room.id}>
                <path
                  data-room={room.id}
                  d={pathOf(room.type === 'yard' ? outer : inner)}
                  fill={room.type === 'yard' ? '#d9e7c4' : isRefrigerated(room.type) ? (room.color || '#3b82f6') : '#f5f5f4'}
                  fillOpacity={room.type === 'yard' ? 0.85 : isRefrigerated(room.type) ? (active || hot ? 0.22 : 0.14) : 1}
                  stroke={active ? TEAL : 'none'}
                  strokeWidth={(active ? 1.6 : 0) / view.scale}
                />
                {(room.equipment || []).map((eq) => {
                  if (eq.category === 'door') {
                    const symbol = doorSymbol(room, eq)
                    const thickness = Math.max(room.wallThickness, 0.08) * 2.2
                    const gapW = symbol.iz !== 0 ? symbol.width : thickness
                    const gapD = symbol.ix !== 0 ? symbol.width : thickness
                    const gx = (symbol.x1 + symbol.x2) / 2
                    const gz = (symbol.z1 + symbol.z2) / 2
                    return (
                      <g key={eq.id} data-eq={eq.id}>
                        <rect x={gx - gapW / 2} y={gz - gapD / 2} width={gapW} height={gapD} fill={PAPER} />
                        <polyline
                          points={symbol.arc.map((point) => `${point.x},${point.z}`).join(' ')}
                          fill="none"
                          stroke="#9a3412"
                          strokeWidth={1 / view.scale}
                        />
                        <line x1={symbol.hinge.x} y1={symbol.hinge.z} x2={symbol.open.x} y2={symbol.open.z} stroke="#9a3412" strokeWidth={1.4 / view.scale} />
                      </g>
                    )
                  }
                  const ex = room.x + eq.x
                  const ez = room.z + eq.z
                  return (
                    <g key={eq.id} data-eq={eq.id} data-cat={eq.category} data-style={eq.style || ''} transform={`translate(${ex} ${ez}) rotate(${eq.rotation || 0})`}>
                      <EquipmentMark eq={eq} scale={view.scale} />
                    </g>
                  )
                })}
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={label.x - label.w / 2}
                    y={label.z - label.h / 2}
                    width={label.w}
                    height={label.h}
                    rx={0.08}
                    fill="rgba(255,255,255,0.94)"
                    stroke="#e7e5e4"
                    strokeWidth={1 / view.scale}
                  />
                  <text
                    x={label.x}
                    y={label.z - 4 / view.scale}
                    textAnchor="middle"
                    fill={INK}
                    fontSize={12 / view.scale}
                    fontWeight="700"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {line1}
                  </text>
                  <text
                    x={label.x}
                    y={label.z + 8 / view.scale}
                    textAnchor="middle"
                    fill="#57534e"
                    fontSize={10 / view.scale}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {line2}
                  </text>
                </g>
                {active && (rectLike ? (
                  <>
                    <DimLine
                      x1={bboxOf(outer).left}
                      z1={bboxOf(outer).top - 0.45}
                      x2={bboxOf(outer).right}
                      z2={bboxOf(outer).top - 0.45}
                      scale={view.scale}
                      text={formatLength(room.width, unitSystem)}
                    />
                    <DimLine
                      x1={bboxOf(outer).left - 0.45}
                      z1={bboxOf(outer).top}
                      x2={bboxOf(outer).left - 0.45}
                      z2={bboxOf(outer).bottom}
                      scale={view.scale}
                      text={formatLength(room.depth, unitSystem)}
                    />
                  </>
                ) : edgesOf(outer).map((edge) => (
                  <g key={edge.index}>{edgeDimension(edge, outer, view.scale, unitSystem)}</g>
                )))}
                {showHandles && (rectLike ? ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] : []).map((corner) => {
                  const box = bboxOf(outer)
                  const x = corner.includes('w') ? box.left : corner.includes('e') ? box.right : box.x
                  const z = corner.includes('n') ? box.top : corner.includes('s') ? box.bottom : box.z
                  return (
                    <circle key={corner} data-handle={corner} data-room={room.id} cx={x} cy={z} r={5.5 / view.scale} fill="#fff" stroke={TEAL} strokeWidth={1.4 / view.scale} />
                  )
                })}
                {showHandles && !rectLike && outlineOf(room).map((point, index) => (
                  <g key={index}>
                    <circle data-handle={`v-${index}`} data-room={room.id} cx={point.x} cy={point.z} r={5.5 / view.scale} fill="#fff" stroke={TEAL} strokeWidth={1.4 / view.scale} />
                    <rect
                      data-handle={`e-${index}`}
                      data-room={room.id}
                      x={(point.x + outer[(index + 1) % outer.length].x) / 2 - 4 / view.scale}
                      y={(point.z + outer[(index + 1) % outer.length].z) / 2 - 4 / view.scale}
                      width={8 / view.scale}
                      height={8 / view.scale}
                      fill={TEAL}
                    />
                  </g>
                ))}
              </g>
            )
          })}
          {(() => {
            const projectNow = calculateProject(rooms)
            const placedLabels = []
            return pipes.map((pipe) => {
              const points = pipe.points || []
              if (points.length < 2) return null
              const { sized } = sizePlacedPipe(pipe, rooms, projectNow.rooms, pipes)
              const traced = pipe.kind === 'drain' && sized.heatTraced
              const look = pipeAppearance(pipe, traced)
              const color = look.color
              const mid = longestMid(points)
              const active = selected.has(pipe.id)
              const side = pipe.kind === 'suction' ? -1.7
                : pipe.kind === 'hotgas' ? 1.85
                  : pipe.kind === 'drain' ? 2.6
                    : pipe.segment === 'return' ? -2.55
                      : 1
              const along = pipe.kind === 'hotgas' ? 0.22 : pipe.segment === 'return' ? -0.2 : pipe.kind === 'drain' ? 0.28 : 0
              const planText = sized.odMm
                ? `${look.short || look.legend} ${Number(sized.odMm).toFixed(1)} mm`
                : sized.label
              let labelX = mid.x + mid.nx * (22 / view.scale) * side + mid.nz * (28 / view.scale) * along
              let labelZ = mid.z + mid.nz * (22 / view.scale) * side - mid.nx * (28 / view.scale) * along
              const halfW = (planText.length * 3.2) / view.scale
              const halfH = 7 / view.scale
              const overlaps = (x, z) => placedLabels.some((box) => Math.abs(box.x - x) < box.hw + halfW && Math.abs(box.z - z) < box.hh + halfH)
              const nudge = [
                [mid.nx, mid.nz], [-mid.nx, -mid.nz], [mid.nz, -mid.nx], [-mid.nz, mid.nx],
              ]
              if (overlaps(labelX, labelZ)) {
                const step = 20 / view.scale
                let clear = false
                for (let ring = 1; ring <= 8 && !clear; ring += 1) {
                  for (const [dx, dz] of nudge) {
                    const x = labelX + dx * step * ring
                    const z = labelZ + dz * step * ring
                    if (!overlaps(x, z)) {
                      labelX = x
                      labelZ = z
                      clear = true
                      break
                    }
                  }
                }
              }
              placedLabels.push({ x: labelX, z: labelZ, hw: halfW, hh: halfH })
              let arrow = null
              let bestLen = 0
              for (let i = 1; i < points.length; i += 1) {
                const len = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
                if (len < bestLen) continue
                bestLen = len
                const ax = points[i - 1].x + (points[i].x - points[i - 1].x) * 0.62
                const az = points[i - 1].z + (points[i].z - points[i - 1].z) * 0.62
                const ang = Math.atan2(points[i].z - points[i - 1].z, points[i].x - points[i - 1].x) * 180 / Math.PI
                arrow = { x: ax, z: az, ang }
              }
              return (
                <g key={pipe.id} data-pipe={pipe.id} data-kind={pipe.kind} data-segment={pipe.segment || ''}>
                  <polyline
                    points={points.map((point) => `${point.x},${point.z}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={(traced ? 3.4 : 2.8) / view.scale}
                    strokeDasharray={look.dash ? look.dash.split(' ').map((part) => Number(part)).join(' ') : undefined}
                  />
                  {traced && (
                    <polyline
                      points={points.map((point) => `${point.x},${point.z - 0.08}`).join(' ')}
                      fill="none"
                      stroke="#fdba74"
                      strokeWidth={1.1 / view.scale}
                      strokeDasharray={`${0.08} ${0.1}`}
                    />
                  )}
                  {points.map((point, index) => {
                    if (!point.sleeve && !point.riser && !point.vertical) return null
                    const prev = points[Math.max(0, index - 1)]
                    const next = points[Math.min(points.length - 1, index + 1)]
                    const dx = next.x - prev.x
                    const dz = next.z - prev.z
                    const span = Math.hypot(dx, dz) || 1
                    const nx = (-dz / span) * 0.16
                    const nz = (dx / span) * 0.16
                    return (
                      <g key={`${pipe.id}-mark-${index}`}>
                        {point.sleeve && (
                          <line x1={point.x - nx} y1={point.z - nz} x2={point.x + nx} y2={point.z + nz} stroke={color} strokeWidth={1.4 / view.scale} />
                        )}
                        {point.vertical && (
                          <text x={point.x + nx} y={point.z + nz} fontSize={9 / view.scale} fill={color} fontFamily="ui-sans-serif, system-ui, sans-serif">{point.vertical}</text>
                        )}
                      </g>
                    )
                  })}
                  {arrow && bestLen > 0.35 && (
                    <polygon
                      transform={`translate(${arrow.x} ${arrow.z}) rotate(${arrow.ang})`}
                      points="0,-0.1 0.24,0 0,0.1"
                      fill={color}
                    />
                  )}
                  <g>
                    <rect
                      x={labelX - halfW}
                      y={labelZ - 8 / view.scale}
                      width={halfW * 2}
                      height={13 / view.scale}
                      rx={0.05}
                      fill="rgba(255,255,255,0.94)"
                      stroke={color}
                      strokeWidth={1 / view.scale}
                    />
                    <text
                      data-testid="pipe-label"
                      x={labelX}
                      y={labelZ + 1.5 / view.scale}
                      textAnchor="middle"
                      fill={active ? TEAL : color}
                      fontSize={10 / view.scale}
                      fontWeight="700"
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      {planText}
                    </text>
                  </g>
                </g>
              )
            })
          })()}
          {tool === 'pipe' && highlightedPorts(rooms, pipeKind, poly).map((port) => (
            <g key={port.id} data-port={port.id}>
              <circle cx={port.x} cy={port.z} r={7 / view.scale} fill={pipeAppearance({ kind: port.kind, segment: port.key === 'liquidIn' ? 'return' : null }).color} fillOpacity="0.18" stroke={pipeAppearance({ kind: port.kind }).color} strokeWidth={1.4 / view.scale} />
              <text x={port.x + 8 / view.scale} y={port.z - 6 / view.scale} fontSize={9 / view.scale} fill="#1c1917" fontFamily="ui-sans-serif, system-ui, sans-serif">{port.label}</text>
            </g>
          ))}
          {cables.map((cable) => (
            <polyline
              key={cable.id}
              points={(cable.points || []).map((point) => `${point.x},${point.z}`).join(' ')}
              fill="none"
              stroke={selected.has(cable.id) ? TEAL : '#7c3aed'}
              strokeWidth={1.2 / view.scale}
              strokeDasharray={`${0.12} ${0.08}`}
            />
          ))}
          {rectDraft && (
            <g>
              <rect
                x={Math.min(rectDraft.x1, rectDraft.x2)}
                y={Math.min(rectDraft.z1, rectDraft.z2)}
                width={draftWidth}
                height={draftDepth}
                fill="rgba(15,118,110,0.08)"
                stroke={TEAL}
                strokeWidth={1.4 / view.scale}
                strokeDasharray={`${6 / view.scale} ${4 / view.scale}`}
              />
              <DimLine
                x1={Math.min(rectDraft.x1, rectDraft.x2)}
                z1={Math.min(rectDraft.z1, rectDraft.z2) - 0.35}
                x2={Math.max(rectDraft.x1, rectDraft.x2)}
                z2={Math.min(rectDraft.z1, rectDraft.z2) - 0.35}
                scale={view.scale}
                text={formatLength(draftWidth, unitSystem)}
              />
              <DimLine
                x1={Math.min(rectDraft.x1, rectDraft.x2) - 0.35}
                z1={Math.min(rectDraft.z1, rectDraft.z2)}
                x2={Math.min(rectDraft.x1, rectDraft.x2) - 0.35}
                z2={Math.max(rectDraft.z1, rectDraft.z2)}
                scale={view.scale}
                text={formatLength(draftDepth, unitSystem)}
              />
            </g>
          )}
          {poly.length > 0 && (
            <g>
              <polyline
                points={[...poly, polyHover].filter(Boolean).map((point) => `${point.x},${point.z}`).join(' ')}
                fill="none"
                stroke={TEAL}
                strokeWidth={1.6 / view.scale}
              />
              {poly.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.z} r={4 / view.scale} fill={TEAL} />
              ))}
              {polyHover && poly.length > 0 && (
                <DimLine
                  x1={poly[poly.length - 1].x}
                  z1={poly[poly.length - 1].z}
                  x2={polyHover.x}
                  z2={polyHover.z}
                  scale={view.scale}
                  text={formatLength(Math.hypot(polyHover.x - poly[poly.length - 1].x, polyHover.z - poly[poly.length - 1].z), unitSystem)}
                />
              )}
            </g>
          )}
          {draft?.kind === 'marquee' && (
            <rect
              x={Math.min(draft.x1, draft.x2)}
              y={Math.min(draft.z1, draft.z2)}
              width={Math.abs(draft.x2 - draft.x1)}
              height={Math.abs(draft.z2 - draft.z1)}
              fill="rgba(15,118,110,0.08)"
              stroke={TEAL}
              strokeWidth={1 / view.scale}
            />
          )}
          {cursor?.kind && (
            <g>
              <circle cx={cursor.x} cy={cursor.z} r={6 / view.scale} fill="none" stroke={TEAL} strokeWidth={1.5 / view.scale} />
              <text x={cursor.x + 10 / view.scale} y={cursor.z - 8 / view.scale} fill={TEAL} fontSize={11 / view.scale} fontWeight="700">
                {snapLabel(cursor.kind)}
              </text>
            </g>
          )}
        </g>
        {drawing && cursor && (
          <>
            <line x1={cursor.px} y1={0} x2={cursor.px} y2={size.h} stroke="#a8a29e" strokeWidth="0.6" opacity="0.55" />
            <line x1={0} y1={cursor.py} x2={size.w} y2={cursor.py} stroke="#a8a29e" strokeWidth="0.6" opacity="0.55" />
          </>
        )}
      </svg>
      <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 22, height: 22, border: '1.5px solid #44403c', borderRadius: 11, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: 2, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #0f766e' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#44403c' }}>POHJOINEN</span>
      </div>
      {notice && (
        <div style={{ position: 'absolute', left: 14, top: 44, maxWidth: 420, padding: '6px 10px', background: 'rgba(255,251,235,0.95)', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
          {notice}
        </div>
      )}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12,
        alignItems: 'flex-end', pointerEvents: 'none', fontSize: 11, color: '#57534e',
      }}>
        <div>
          <div style={{ width: bar * view.scale, height: 8, borderLeft: '1.5px solid #44403c', borderRight: '1.5px solid #44403c', borderBottom: '1.5px solid #44403c' }} />
          <div style={{ marginTop: 2 }}>{formatLength(bar, unitSystem)}</div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>{hint}</div>
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {cursor ? `X ${formatLength(cursor.x, unitSystem)}   Y ${formatLength(cursor.z, unitSystem)}` : 'X —   Y —'}
          {cursor?.kind ? ` · ${snapLabel(cursor.kind)}` : ''}
        </div>
      </div>
    </div>
  )
}
